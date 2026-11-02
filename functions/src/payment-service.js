/* PaymentService: tạo đơn nạp xu. Giá và số xu lấy từ máy chủ (config/packs), không tin số liệu trình duyệt gửi. */
const { db, now, fail, randomCode, rateLimit, Timestamp } = require('./core');
const sepay = require('./providers/sepay');
const casso = require('./providers/casso');
const payos = require('./providers/payos');
const crypto = require('crypto');

const PROVIDERS = { sepay, casso, payos };
const ORDER_TTL_MS = 30 * 60e3;                                              // đơn hết hạn sau 30 phút
const CODE_PREFIX = 'LHTV';
const CODE_RE = /LHTV[A-HJ-NP-Z2-9]{8}/;
const DEFAULT_PACKS = [
  { id: 'p1', vnd: 18990, xu: 1680, on: true },
  { id: 'p2', vnd: 48990, xu: 5099, on: true },
  { id: 'p3', vnd: 99000, xu: 10900, on: true },
  { id: 'p4', vnd: 199000, xu: 21900, on: true }
];

async function packs() {
  const s = await db.collection('config').doc('packs').get();
  return s.exists && Array.isArray(s.data().packs) ? s.data().packs : DEFAULT_PACKS;
}
async function paymentConfig(tx) {
  const ref = db.collection('config').doc('payment');
  const s = tx ? await tx.get(ref) : await ref.get();
  return s.exists ? s.data() : null;
}
const provider = cfg => PROVIDERS[(cfg && cfg.provider) || 'sepay'];

/* payOS: mỗi link cần orderCode là số nguyên duy nhất → bảng payos_links/{orderCode} trỏ về đơn (hoặc lần xác minh tài khoản) */
async function payosLink(keys, { amount, description, expiresAtMs, target }) {
  for (let i = 0; i < 5; i++) {
    const orderCode = crypto.randomInt(1e9, 2 ** 47);
    const ref = db.collection('payos_links').doc(String(orderCode));
    try { await ref.create({ ...target, amount, at: now() }); } catch (e) { if (e.code === 6) continue; throw e; }
    try {
      const link = await payos.createLink(keys, { orderCode, amount, description, expiredAt: Math.floor(expiresAtMs / 1000) });
      await ref.update({ accountNumber: link.accountNumber, paymentLinkId: link.paymentLinkId });
      return { orderCode, ...link };
    } catch (e) { await ref.delete().catch(() => {}); throw e; }
  }
  throw new Error('PAYOS_NO_ORDER_CODE');
}

async function createTopup(uid, packId, payosKeys) {
  const cfg = await paymentConfig();
  if (!cfg || !cfg.accountNumber || !cfg.bankCode || cfg.enabled === false) fail('failed-precondition', 'Nhà chùa chưa mở nạp xu, xin quay lại sau');
  const pack = (await packs()).find(p => p.id === packId && p.on !== false);
  if (!pack) fail('invalid-argument', 'Gói nạp không còn mở');
  await rateLimit('topup_' + uid, 10, 3600);                                  // tối đa 10 đơn mỗi giờ
  const pending = await db.collection('orders').where('uid', '==', uid).where('status', '==', 'PENDING').limit(5).get();
  const live = pending.docs.filter(d => d.data().expiresAt.toMillis() > Date.now());
  if (live.length >= 3) fail('resource-exhausted', 'Đạo hữu đang có 3 đơn chờ thanh toán, xin hoàn tất hoặc huỷ bớt');
  // Mã tham chiếu ngẫu nhiên, không dựa vào biệt danh; tạo bằng create() nên không bao giờ trùng
  for (let i = 0; i < 5; i++) {
    const code = CODE_PREFIX + randomCode(8), ref = db.collection('orders').doc(code);
    const order = { uid, packId: pack.id, vnd: pack.vnd, xu: pack.xu, currency: 'VND', code, provider: provider(cfg).name,
      account: cfg.accountNumber, status: 'PENDING', createdAt: now(), expiresAt: Timestamp.fromMillis(Date.now() + ORDER_TTL_MS) };
    try { await ref.create(order); } catch (e) { if (e.code === 6) continue; throw e; }
    if (order.provider === 'payos') {
      let link;
      try { link = await payosLink(payosKeys, { amount: pack.vnd, description: code.slice(4), expiresAtMs: order.expiresAt.toMillis(), target: { kind: 'order', orderId: code, cfgAccount: cfg.accountNumber } }); }
      catch (e) {
        await ref.update({ status: 'FAILED', failReason: String(e.message).slice(0, 200) });
        require('firebase-functions').logger.error('payOS tạo link lỗi', { err: e.message });
        fail('unavailable', 'Cổng thanh toán đang bận, xin thử lại sau ít phút');
      }
      await ref.update({ payos: { orderCode: link.orderCode, paymentLinkId: link.paymentLinkId, accountNumber: link.accountNumber, description: link.description } });
      return { orderId: code, code: link.description, vnd: pack.vnd, xu: pack.xu, expiresAt: order.expiresAt.toMillis(), qrUrl: payos.qrFromLink(link, pack.vnd), checkoutUrl: link.checkoutUrl,
        bank: { code: cfg.bankCode, account: link.accountNumber, holder: link.accountName || cfg.accountName || '' } };
    }
    return { orderId: code, code, vnd: pack.vnd, xu: pack.xu, expiresAt: order.expiresAt.toMillis(),
      qrUrl: provider(cfg).qrUrl(cfg, pack.vnd, code), bank: { code: cfg.bankCode, account: cfg.accountNumber, holder: cfg.accountName || '' } };
  }
  fail('internal', 'Không tạo được mã đơn, xin thử lại');
}

async function cancelTopup(uid, orderId) {
  const ref = db.collection('orders').doc(String(orderId));
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().uid !== uid) fail('not-found', 'Không có đơn này');
    if (s.data().status !== 'PENDING') return { status: s.data().status };
    tx.update(ref, { status: 'CANCELLED', cancelledAt: now() });
    return { status: 'CANCELLED' };
  });
}

// Đơn quá hạn → EXPIRED (tiền về sau đó sẽ vào hàng đối soát, không tự cộng)
async function expireOrders() {
  const q = await db.collection('orders').where('status', '==', 'PENDING').where('expiresAt', '<', now()).limit(300).get();
  const b = db.batch(); q.docs.forEach(d => b.update(d.ref, { status: 'EXPIRED' }));
  if (!q.empty) await b.commit();
  return q.size;
}

module.exports = { payosLink, PROVIDERS, DEFAULT_PACKS, CODE_RE, packs, paymentConfig, provider, createTopup, cancelTopup, expireOrders };
