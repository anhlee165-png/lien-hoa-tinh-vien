/* WalletService: số dư tập trung và sổ cái xu. Mọi thay đổi số dư đi qua credit()/debit() trong giao dịch nguyên tử.
   Sổ cái chỉ thêm dòng mới, không sửa. Số dư không bao giờ âm. */
const { db, FieldValue, now, fail } = require('./core');

const DEFAULT_PRICES = { charging: true, incense: 50, flower: 150, rename: 20,
  offers: { sen: { xu: 200, name: 'Cúng hoa sen' }, den: { xu: 500, name: 'Cúng đèn' }, tambao: { xu: 1000, name: 'Cúng dường Tam Bảo' }, kinh: { xu: 2000, name: 'Ấn tống kinh' } } };
const RENAME_FREE_AFTER_MS = 24 * 3600e3;

async function prices(tx) {
  const ref = db.collection('config').doc('prices');
  const s = tx ? await tx.get(ref) : await ref.get();
  return Object.assign({}, DEFAULT_PRICES, s.exists ? s.data() : {});
}

// Ghi một dòng sổ cái và đổi số dư, trong transaction tx (đã đọc wallet trước đó).
function post(tx, { uid, wallet, delta, type, ref, reason = '', by = 'system', meta = {} }) {
  const bal = (wallet.exists ? wallet.data().balance : 0) + delta;
  if (bal < 0) fail('failed-precondition', 'Không đủ xu');
  const wref = db.collection('wallets').doc(uid);
  tx.set(wref, { balance: bal, updatedAt: now() }, { merge: true });
  const lref = db.collection('ledger').doc();
  tx.set(lref, { uid, type, xu: delta, balanceAfter: bal, ref: ref || null, reason, by, ...meta, at: now() });
  return { balance: bal, entryId: lref.id };
}

/* Hòm Công đức: khách "nhận thêm" (mua trước bằng xu) Hương và các lễ cúng dường, lưu ở wallets/<uid>.items.
   Khi thắp hương / cúng dường: còn trong hòm thì dùng 1 (không trừ xu), hết thì trừ xu như cũ. */
const ITEM_NAMES = { huong: 'Hương', sen: 'Hoa sen', den: 'Đèn', tambao: 'Cúng dường Tam Bảo', kinh: 'Ấn tống kinh' };
const itemPrice = (pr, k) => k === 'huong' ? pr.incense | 0 : ((pr.offers || {})[k] || {}).xu | 0;

/* Tiêu xu có chống trừ hai lần: opId do web sinh một lần cho mỗi lần bấm; gửi lại cùng opId trả về kết quả cũ. */
async function spend(uid, isOwner, kind, opId, payload = {}) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(opId || '')) fail('invalid-argument', 'Thiếu mã thao tác');
  if (!['incense', 'flower', 'rename', 'offer', 'buy'].includes(kind)) fail('invalid-argument', 'Thao tác không hợp lệ');
  let nick, sex;
  if (kind === 'rename') {
    nick = String(payload.nick || '').trim().replace(/\s+/g, ' ');
    sex = payload.sex;
    if (nick.length < 2 || nick.length > 20) fail('invalid-argument', 'Biệt danh cần từ 2 đến 20 chữ');
    if (/[<>&"'`]/.test(nick)) fail('invalid-argument', 'Biệt danh có ký tự không được dùng');
    if (!isOwner && /^(thầy|trụ trì|admin|quản trị|bạn)\b/i.test(nick)) fail('invalid-argument', 'Biệt danh này dành riêng cho nhà chùa');
    if (!['nu', 'nam'].includes(sex)) fail('invalid-argument', 'Mời chọn giới tính');
  }
  const opRef = db.collection('ops').doc(`${uid}_${opId}`);
  const wref = db.collection('wallets').doc(uid), uref = db.collection('users').doc(uid);
  return db.runTransaction(async tx => {
    const [op, w, u, pr] = await Promise.all([tx.get(opRef), tx.get(wref), tx.get(uref), prices(tx)]);
    if (op.exists) return { ...op.data().result, repeated: true };
    const items = { ...((w.exists && w.data().items) || {}) };
    let cost = 0, label = { incense: 'Thắp hương', flower: 'Dâng hoa', rename: 'Đổi biệt danh' }[kind], item = null, qty = 1;
    if (kind === 'incense' || kind === 'flower' || kind === 'rename') cost = pr[kind] | 0;
    if (kind === 'incense') item = 'huong';
    if (kind === 'offer' || kind === 'buy') {
      item = String(payload.item || '');
      if (!ITEM_NAMES[item] || (kind === 'offer' && item === 'huong')) fail('invalid-argument', 'Lễ cúng dường không có');
      if (kind === 'offer') { const it = (pr.offers || {})[item]; if (!it) fail('invalid-argument', 'Lễ cúng dường không có'); cost = it.xu | 0; label = it.name; }
    }
    if (kind === 'buy') {
      qty = Math.trunc(Number(payload.qty));
      if (!(qty >= 1 && qty <= 100)) fail('invalid-argument', 'Số lượng từ 1 đến 100');
      cost = itemPrice(pr, item) * qty; label = `Nhận thêm ${qty} ${ITEM_NAMES[item]}`;
    }
    if (kind === 'rename') {
      const at = u.exists && u.data().nickAt ? u.data().nickAt.toMillis() : 0;
      if (!u.exists || !u.data().nick || Date.now() - at >= RENAME_FREE_AFTER_MS) cost = 0;   // lần đầu hoặc đã qua 24 giờ: miễn phí
    }
    if (pr.charging === false && kind !== 'rename' && kind !== 'buy') cost = 0;              // quản trị tắt thu phí: hương, hoa, cúng dường miễn phí
    let used = null;
    if (cost > 0 && item && kind !== 'buy' && (items[item] | 0) > 0) { used = item; cost = 0; }  // còn trong Hòm Công đức: dùng 1
    if (isOwner) { cost = 0; used = null; }                                                    // chủ chùa không mất xu
    let result = { balance: w.exists ? w.data().balance : 0, cost };
    if (cost > 0) {
      if (result.balance < cost) fail('failed-precondition', `Không đủ xu (cần ${cost} xu)`);
      const r = post(tx, { uid, wallet: w, delta: -cost, type: 'SPEND', ref: `${kind}:${opId}`, reason: label });
      result = { balance: r.balance, cost, entryId: r.entryId };
    }
    if (kind === 'buy') items[item] = (items[item] | 0) + qty;                               // chủ chùa nhận thêm không mất xu nhưng hòm vẫn tăng
    if (used) { items[used] = (items[used] | 0) - 1; result.used = used; }
    if (kind === 'buy' || used) { tx.set(wref, { items, updatedAt: now() }, { merge: true }); result.items = items; }
    if (kind === 'rename') tx.set(uref, { nick, sex, nickAt: now() }, { merge: true });
    tx.set(opRef, { uid, kind, result, at: now() });
    return result;
  });
}

/* Hoàn xu cho một lần tiêu (vd. thắp hương / dâng hoa thất bại phía web). Chỉ hoàn đúng 1 lần, trong 10 phút. */
async function refund(uid, opId) {
  const opRef = db.collection('ops').doc(`${uid}_${opId}`), rRef = db.collection('ops').doc(`${uid}_${opId}_refund`);
  const wref = db.collection('wallets').doc(uid);
  return db.runTransaction(async tx => {
    const [op, r, w] = await Promise.all([tx.get(opRef), tx.get(rRef), tx.get(wref)]);
    if (!op.exists || !['incense', 'flower'].includes(op.data().kind)) fail('not-found', 'Không tìm thấy thao tác');
    const kind = op.data().kind, label = kind === 'flower' ? 'dâng hoa' : 'thắp hương';
    if (r.exists) return r.data().result;
    const cost = op.data().result.cost | 0;
    if (Date.now() - op.data().at.toMillis() > 10 * 60e3) fail('failed-precondition', 'Đã quá hạn hoàn xu');
    let result = { balance: w.data().balance, refunded: 0 };
    const used = op.data().result.used;
    if (used) { const items = { ...(w.data().items || {}) }; items[used] = (items[used] | 0) + 1; tx.set(wref, { items, updatedAt: now() }, { merge: true }); result = { ...result, returned: used }; }
    if (cost > 0) { const p = post(tx, { uid, wallet: w, delta: cost, type: 'REFUND', ref: `${kind}:${opId}`, reason: 'Hoàn xu ' + label }); result = { balance: p.balance, refunded: cost }; }
    tx.set(rRef, { uid, kind: 'refund', result, at: now() });
    return result;
  });
}

/* Quản trị điều chỉnh số dư: có lý do, mã thao tác duy nhất, ghi sổ + kiểm toán. */
async function adjust(adminUid, uid, xu, reason, opId) {
  xu = Math.trunc(Number(xu));
  if (!xu || Math.abs(xu) > 10_000_000) fail('invalid-argument', 'Số xu không hợp lệ');
  if (!reason || String(reason).trim().length < 5) fail('invalid-argument', 'Cần ghi lý do (ít nhất 5 chữ)');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(opId || '')) fail('invalid-argument', 'Thiếu mã thao tác');
  const opRef = db.collection('ops').doc(`adj_${opId}`), wref = db.collection('wallets').doc(uid);
  return db.runTransaction(async tx => {
    const [op, w, u] = await Promise.all([tx.get(opRef), tx.get(wref), tx.get(db.collection('users').doc(uid))]);
    if (op.exists) return { ...op.data().result, repeated: true };
    if (!u.exists) fail('not-found', 'Không có người dùng này');
    const before = w.exists ? w.data().balance : 0;
    const r = post(tx, { uid, wallet: w, delta: xu, type: 'ADJUST', ref: `adjust:${opId}`, reason: String(reason).slice(0, 300), by: adminUid });
    tx.set(opRef, { uid, kind: 'adjust', result: r, at: now() });
    tx.set(db.collection('audit').doc(), { actor: adminUid, action: 'adjust_balance', uid, xu, reason: String(reason).slice(0, 300), before, after: r.balance, opId, at: now() });
    return r;
  });
}

module.exports = { prices, post, spend, refund, adjust, DEFAULT_PRICES, ITEM_NAMES };
