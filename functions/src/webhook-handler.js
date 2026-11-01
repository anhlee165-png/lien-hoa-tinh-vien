/* WebhookHandler: nhận báo có từ cổng thanh toán, xác thực, ghép đơn và cộng xu đúng một lần.
   Mọi bước ghi (dấu giao dịch đã dùng, trạng thái đơn, ví, sổ cái, đối soát) nằm trong một transaction.
   Sai lệch bất kỳ → KHÔNG cộng xu, đưa vào hàng đối soát (reconcile). */
const { db, now, audit, alert, rateLimit } = require('./core');
const { post } = require('./wallet-service');
const { CODE_RE, paymentConfig } = require('./payment-service');

async function handle(adapter, req, res, secret) {
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const v = adapter.verify(raw, req.headers, secret);
  if (!v.ok) {
    await audit('webhook', 'webhook_rejected', { provider: adapter.name, why: v.why, ip: req.ip || '' });
    try { await rateLimit('webhook_bad', 5, 600); } catch { await alert('webhook_error', `Webhook ${adapter.name} bị từ chối nhiều lần (${v.why})`); }
    return res.status(401).json({ success: false });
  }
  const t = adapter.parse(req.body);
  if (!t || !t.txId || !Number.isFinite(t.amount)) {
    await alert('webhook_error', `Webhook ${adapter.name} thiếu dữ liệu`, { body: JSON.stringify(req.body || {}).slice(0, 2000) });
    return res.status(400).json({ success: false });
  }
  try {
    const out = await process(t);
    await audit('webhook', 'webhook_' + out.result, { provider: t.provider, txId: t.txId, orderId: out.orderId || null, reason: out.reason || null });
    return adapter.ack(res);
  } catch (e) {
    // Lỗi tạm thời (mất kết nối DB...) → trả 500 để cổng thanh toán gửi lại; xử lý vẫn idempotent
    await alert('webhook_error', `Lỗi xử lý webhook ${t.provider}:${t.txId}: ${e.message}`).catch(() => {});
    return res.status(500).json({ success: false });
  }
}

/* Lõi xử lý (tách riêng để kiểm thử). Trả { result: 'credited'|'duplicate'|'review'|'ignored', ... } */
async function process(t) {
  const txKey = `${t.provider}_${t.txId}`;
  const usedRef = db.collection('bank_tx').doc(txKey);
  const content = String(t.content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = content.match(CODE_RE), orderId = m ? m[0] : null;
  const oref = orderId ? db.collection('orders').doc(orderId) : null;

  return db.runTransaction(async tx => {
    const used = await tx.get(usedRef);
    if (used.exists) return { result: 'duplicate', orderId: used.data().orderId || null };   // webhook gửi lại: không làm gì thêm
    const cfg = await paymentConfig(tx);
    const o = oref ? await tx.get(oref) : null;
    const w = o && o.exists ? await tx.get(db.collection('wallets').doc(o.data().uid)) : null;

    const base = { provider: t.provider, txId: t.txId, bankRef: t.bankRef, amount: t.amount, currency: t.currency, account: t.account,
      content: String(t.content || '').slice(0, 500), when: t.when, at: now() };
    const review = (reason, extra = {}) => {
      tx.set(usedRef, { ...base, orderId, status: 'REVIEW', reason });
      tx.set(db.collection('reconcile').doc(txKey), { ...base, orderId, uid: o && o.exists ? o.data().uid : null, reason, status: 'OPEN', ...extra });
      if (o && o.exists && o.data().status === 'PENDING') tx.update(oref, { status: 'REVIEW', reviewReason: reason, txKey });
      tx.set(db.collection('alerts').doc(), { kind: reason === 'NO_ORDER_CODE' || reason === 'ORDER_NOT_FOUND' ? 'unmatched' : 'anomaly',
        msg: `Giao dịch ${t.amount.toLocaleString('vi-VN')}đ cần đối soát: ${reason}`, txKey, read: false, at: now() });
      return { result: 'review', reason, orderId };
    };

    if (t.direction === 'out') {                                       // tiền ra (hoàn tiền/chi): chỉ ghi nhận để đối soát
      if (orderId) return review('OUTGOING_FOR_ORDER');
      tx.set(usedRef, { ...base, orderId, status: 'IGNORED', reason: 'OUTGOING' });
      return { result: 'ignored', reason: 'OUTGOING' };
    }
    if (t.direction !== 'in') return review('UNKNOWN_DIRECTION');
    // Xác minh tài khoản nhận tiền mới: khoản chuyển thử có nội dung LHTVXM<mã> vào đúng tài khoản vừa cấu hình
    const vm = content.match(/LHTVXM([A-HJ-NP-Z2-9]{6})/);
    if (vm && cfg && !cfg.verified && cfg.verifyCode === vm[1] && String(cfg.accountNumber) === String(t.account)) {
      tx.update(db.collection('config').doc('payment'), { verified: true, enabled: true, verifiedAt: now(), verifyTx: txKey });
      tx.set(usedRef, { ...base, orderId: null, status: 'VERIFY' });
      tx.set(db.collection('alerts').doc(), { kind: 'payment_config', msg: `Đã xác minh tài khoản nhận tiền ${cfg.bankCode} ${cfg.accountNumber}, nạp xu đã mở`, read: false, at: now() });
      return { result: 'verified' };
    }
    if (!cfg || String(cfg.accountNumber) !== String(t.account)) return review('WRONG_ACCOUNT');
    if (t.currency !== 'VND') return review('WRONG_CURRENCY');
    if (!orderId) return review('NO_ORDER_CODE');
    if (!o.exists) return review('ORDER_NOT_FOUND');
    const od = o.data();
    if (od.status === 'PAID') return review('ORDER_ALREADY_PAID');
    if (od.status === 'EXPIRED' || (od.status === 'PENDING' && od.expiresAt.toMillis() < Date.now())) return review('LATE_PAYMENT');
    if (od.status !== 'PENDING') return review('ORDER_' + od.status);
    if (String(od.account) !== String(t.account)) return review('WRONG_ACCOUNT');
    if (t.amount < od.vnd) return review('UNDERPAID', { expected: od.vnd });
    if (t.amount > od.vnd) return review('OVERPAID', { expected: od.vnd });

    // Hợp lệ: cộng xu đúng một lần
    const r = post(tx, { uid: od.uid, wallet: w, delta: od.xu, type: 'TOPUP', ref: `order:${orderId}`, reason: `Nạp ${od.vnd.toLocaleString('vi-VN')}đ`, meta: { vnd: od.vnd, txKey } });
    tx.set(usedRef, { ...base, orderId, status: 'CREDITED', uid: od.uid });
    tx.update(oref, { status: 'PAID', paidAt: now(), txKey, ledgerId: r.entryId });
    tx.set(db.collection('alerts').doc(), { kind: 'topup', msg: `Nạp thành công ${od.vnd.toLocaleString('vi-VN')}đ → ${od.xu.toLocaleString('vi-VN')} xu`, uid: od.uid, orderId, read: false, at: now() });
    return { result: 'credited', orderId, uid: od.uid, xu: od.xu };
  });
}

module.exports = { handle, process };
