/* AdminService: người dùng, doanh thu, gói xu, tài khoản nhận tiền, đối soát, xuất báo cáo.
   Mọi hàm ở đây được index.js gọi SAU khi requireAdmin() đã kiểm quyền bằng custom claims. */
const { getAuth } = require('firebase-admin/auth');
const { AggregateField } = require('firebase-admin/firestore');
const { db, now, fail, audit, alert, randomCode, Timestamp } = require('./core');
const { post } = require('./wallet-service');
const { packs: getPacks, paymentConfig, payosLink, DEFAULT_PACKS } = require('./payment-service');

const day = 86400e3;
const ms = t => (t && t.toMillis ? t.toMillis() : null);

async function stats() {
  const orders = db.collection('orders'), ledger = db.collection('ledger'), users = db.collection('users');
  const since = Timestamp.fromMillis(Date.now() - 400 * day);
  const [paidAgg, topAgg, spendAgg, nUsers, nActive, nPending, nReview, recent] = await Promise.all([
    orders.where('status', '==', 'PAID').aggregate({ vnd: AggregateField.sum('vnd'), n: AggregateField.count() }).get(),
    ledger.where('type', 'in', ['TOPUP', 'TOPUP_MANUAL']).aggregate({ xu: AggregateField.sum('xu') }).get(),
    ledger.where('type', '==', 'SPEND').aggregate({ xu: AggregateField.sum('xu') }).get(),
    users.count().get(),
    users.where('lastSeen', '>', Timestamp.fromMillis(Date.now() - day)).count().get(),
    orders.where('status', '==', 'PENDING').count().get(),
    db.collection('reconcile').where('status', '==', 'OPEN').count().get(),
    orders.where('status', '==', 'PAID').where('paidAt', '>', since).orderBy('paidAt', 'desc').limit(5000).get()
  ]);
  // Doanh thu theo ngày / tuần / tháng (giờ Việt Nam)
  const vn = t => new Date(t + 7 * 3600e3);
  const byDay = {}, byWeek = {}, byMonth = {};
  let donateVnd = 0, donateCount = 0; const donations = [];
  recent.docs.forEach(d => {
    const o = d.data(), t = vn(ms(o.paidAt)), k = t.toISOString().slice(0, 10);
    if (o.kind === 'donate') { donateVnd += o.vnd; donateCount++; if (donations.length < 50) donations.push({ uid: o.uid, vnd: o.vnd, at: ms(o.paidAt), orderId: d.id }); }
    const wk = new Date(t); wk.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
    byDay[k] = (byDay[k] || 0) + o.vnd;
    byWeek[wk.toISOString().slice(0, 10)] = (byWeek[wk.toISOString().slice(0, 10)] || 0) + o.vnd;
    byMonth[k.slice(0, 7)] = (byMonth[k.slice(0, 7)] || 0) + o.vnd;
  });
  return {
    revenue: paidAgg.data().vnd || 0, paidCount: paidAgg.data().n || 0,
    xuGranted: topAgg.data().xu || 0, xuSpent: -(spendAgg.data().xu || 0),
    users: nUsers.data().count, active24h: nActive.data().count,
    pending: nPending.data().count, reconcileOpen: nReview.data().count,
    byDay, byWeek, byMonth, donateVnd, donateCount,
    donations: await Promise.all(donations.map(async x => { const u = (await users.doc(x.uid).get()).data() || {}; return { ...x, nick: u.nick || '', email: u.email || '' }; }))
  };
}

async function findUser(q) {
  q = String(q || '').trim(); if (!q) fail('invalid-argument', 'Nhập UID, email hoặc biệt danh');
  const out = new Map();
  const add = d => d.exists && out.set(d.id, { uid: d.id, ...pub(d.data()) });
  add(await db.collection('users').doc(q).get());
  for (const f of ['email', 'nick']) (await db.collection('users').where(f, '==', f === 'email' ? q.toLowerCase() : q).limit(20).get()).docs.forEach(add);
  return [...out.values()];
}
const pub = u => ({ email: u.email, name: u.name, nick: u.nick, sex: u.sex, provider: u.provider, locked: !!u.locked, createdAt: ms(u.createdAt), lastSeen: ms(u.lastSeen) });

async function userHistory(uid) {
  const [u, w, l, o] = await Promise.all([
    db.collection('users').doc(uid).get(), db.collection('wallets').doc(uid).get(),
    db.collection('ledger').where('uid', '==', uid).orderBy('at', 'desc').limit(200).get(),
    db.collection('orders').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(100).get()
  ]);
  if (!u.exists) fail('not-found', 'Không có người dùng này');
  return { user: { uid, ...pub(u.data()) }, balance: w.exists ? w.data().balance : 0,
    ledger: l.docs.map(d => ({ id: d.id, ...d.data(), at: ms(d.data().at) })),
    orders: o.docs.map(d => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt), expiresAt: ms(d.data().expiresAt), paidAt: ms(d.data().paidAt) })) };
}

async function setLock(actor, uid, locked, reason) {
  if (!reason || String(reason).trim().length < 5) fail('invalid-argument', 'Cần ghi lý do');
  const ref = db.collection('users').doc(uid), s = await ref.get();
  if (!s.exists) fail('not-found', 'Không có người dùng này');
  const o = await db.collection('config').doc('owner').get();
  if (o.exists && o.data().uid === uid) fail('failed-precondition', 'Không thể khoá tài khoản chủ chùa');
  await ref.update({ locked: !!locked, lockReason: String(reason).slice(0, 300), lockAt: now() });
  await getAuth().updateUser(uid, { disabled: !!locked });
  if (locked) await getAuth().revokeRefreshTokens(uid);
  await audit(actor, locked ? 'lock_user' : 'unlock_user', { uid, reason: String(reason).slice(0, 300) });
  return { locked: !!locked };
}

function checkPacks(p) {
  if (!Array.isArray(p) || !p.length || p.length > 12) fail('invalid-argument', 'Danh sách gói không hợp lệ');
  const ids = new Set();
  return p.map(x => {
    const id = String(x.id || ''), vnd = Math.trunc(+x.vnd), xu = Math.trunc(+x.xu);
    if (!/^[a-z0-9]{1,12}$/.test(id) || ids.has(id)) fail('invalid-argument', 'Mã gói không hợp lệ');
    if (!(vnd >= 2000 && vnd <= 50_000_000) || !(xu >= 1 && xu <= 10_000_000)) fail('invalid-argument', `Giá hoặc số xu của gói ${id} không hợp lệ`);
    ids.add(id); return { id, vnd, xu, on: x.on !== false };
  });
}
async function setPacks(actor, p) {
  const packs = checkPacks(p), before = await getPacks();
  await db.collection('config').doc('packs').set({ packs, updatedAt: now(), updatedBy: actor });
  await audit(actor, 'set_packs', { before, after: packs });
  return { packs };                                                            // đơn đã tạo giữ giá cũ (lưu trong đơn)
}
async function setPrices(actor, p) {
  const ref = db.collection('config').doc('prices'), before = (await ref.get()).data() || null;
  const incense = Math.trunc(+p.incense), rename = Math.trunc(+p.rename);
  const flower = p.flower == null ? (before && before.flower != null ? before.flower : 150) : Math.trunc(+p.flower);
  const okv = v => v >= 0 && v <= 100000;
  if (!(okv(incense) && okv(rename) && okv(flower))) fail('invalid-argument', 'Giá không hợp lệ');
  await ref.set({ incense, flower, rename, updatedAt: now(), updatedBy: actor }, { merge: true });
  await audit(actor, 'set_prices', { before, after: { incense, flower, rename } });
  return { incense, flower, rename };
}

/* Bật/tắt thu phí: tắt thì thắp hương, dâng hoa, cúng dường đều miễn phí (máy chủ không trừ xu). Ghi kiểm toán. */
async function setCharging(actor, on) {
  if (typeof on !== 'boolean') fail('invalid-argument', 'Thiếu trạng thái bật/tắt');
  const ref = db.collection('config').doc('prices'), before = (await ref.get()).data() || {};
  await ref.set({ charging: on, updatedAt: now(), updatedBy: actor }, { merge: true });
  await audit(actor, 'set_charging', { before: before.charging !== false, after: on });
  return { charging: on };
}

/* Đổi tài khoản nhận tiền: chỉ chủ chùa, đã đăng nhập lại gần đây (kiểm ở index.js).
   Sau khi đổi, nạp xu TẠM ĐÓNG cho tới khi xác minh: chủ chùa chuyển một khoản nhỏ vào tài khoản mới
   với nội dung LHTVXM<mã>; webhook từ cổng thanh toán khớp mã + tài khoản thì mới mở lại. */
async function setPaymentConfig(actor, c, payosKeys) {
  const bankCode = String(c.bankCode || '').trim(), accountNumber = String(c.accountNumber || '').replace(/\s/g, ''), accountName = String(c.accountName || '').trim().toUpperCase();
  if (!/^[A-Za-z0-9]{2,20}$/.test(bankCode) || !/^[0-9A-Za-z]{4,25}$/.test(accountNumber) || accountName.length < 3 || accountName.length > 60) fail('invalid-argument', 'Thông tin tài khoản không hợp lệ');
  const provider = String(c.provider || 'payos');
  if (!['payos', 'casso', 'sepay'].includes(provider)) fail('invalid-argument', 'Cổng thanh toán không hợp lệ');
  const before = await paymentConfig(), verifyCode = randomCode(6);
  const after = { provider, bankCode, accountNumber, accountName, enabled: false, verified: false, verifyCode, updatedAt: now(), updatedBy: actor };
  // payOS chỉ báo tiền vào cho link do payOS tạo → khoản xác minh cũng đi qua một link 2.000đ
  if (provider === 'payos') {
    let link;
    try { link = await payosLink(payosKeys, { amount: 2000, description: 'XM' + verifyCode, expiresAtMs: Date.now() + 864e5, target: { kind: 'verify', verifyCode, cfgAccount: accountNumber } }); }
    catch (e) { fail('failed-precondition', 'Không tạo được link payOS (kiểm tra Client ID / API Key / Checksum Key): ' + String(e.message).slice(0, 120)); }
    after.verifyLink = { checkoutUrl: link.checkoutUrl, qrUrl: require('./providers/payos').qrFromLink(link, 2000), accountNumber: link.accountNumber, description: link.description };
  }
  await db.collection('config').doc('payment').set(after);
  const hide = o => { if (!o) return null; const { verifyCode, ...rest } = o; return rest; };
  await audit(actor, 'set_payment_config', { before: hide(before), after: hide(after) });
  await alert('payment_config', `Tài khoản nhận tiền vừa đổi sang ${bankCode} ${accountNumber} (${accountName}), đang chờ xác minh`);
  return { verifyContent: 'LHTVXM' + verifyCode, verifyLink: after.verifyLink || null, provider, bankCode, accountNumber, accountName };
}

async function getPaymentConfig() {
  const c = await paymentConfig();
  return c ? { provider: c.provider, bankCode: c.bankCode, accountNumber: c.accountNumber, accountName: c.accountName, enabled: c.enabled !== false, verified: !!c.verified,
    verifyContent: c.verified ? null : 'LHTVXM' + c.verifyCode, verifyLink: c.verified ? null : c.verifyLink || null, verifiedAt: ms(c.verifiedAt), updatedAt: ms(c.updatedAt) } : null;
}

async function listReconcile(status = 'OPEN') {
  const q = await db.collection('reconcile').where('status', '==', status).orderBy('at', 'desc').limit(200).get();
  return q.docs.map(d => ({ id: d.id, ...d.data(), at: ms(d.data().at) }));
}

/* Xử lý một giao dịch cần đối soát: 'credit' cộng xu cho UID do quản trị xác định (có lý do), 'dismiss' đóng không cộng. */
async function resolveReconcile(actor, id, action, { uid, xu, reason } = {}) {
  if (!reason || String(reason).trim().length < 5) fail('invalid-argument', 'Cần ghi lý do');
  const ref = db.collection('reconcile').doc(String(id));
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) fail('not-found', 'Không có giao dịch này');
    if (s.data().status !== 'OPEN') fail('failed-precondition', 'Giao dịch đã được xử lý');
    const res = { status: 'RESOLVED', resolution: action, resolvedBy: actor, resolvedAt: now(), note: String(reason).slice(0, 300) };
    if (action === 'credit') {
      xu = Math.trunc(+xu);
      if (!uid || !(xu > 0 && xu <= 10_000_000)) fail('invalid-argument', 'Cần UID và số xu hợp lệ');
      const u = await tx.get(db.collection('users').doc(uid)), w = await tx.get(db.collection('wallets').doc(uid));
      if (!u.exists) fail('not-found', 'Không có người dùng này');
      const r = post(tx, { uid, wallet: w, delta: xu, type: 'TOPUP_MANUAL', ref: `reconcile:${id}`, reason: String(reason).slice(0, 300), by: actor, meta: { vnd: s.data().amount } });
      Object.assign(res, { uid, xu, ledgerId: r.entryId });
    } else if (action !== 'dismiss') fail('invalid-argument', 'Thao tác không hợp lệ');
    tx.update(ref, res);
    tx.set(db.collection('audit').doc(), { actor, action: 'resolve_reconcile', id, resolution: action, uid: uid || null, xu: xu || 0, reason: String(reason).slice(0, 300), at: now() });
    return res;
  });
}

async function listAlerts() {
  const q = await db.collection('alerts').orderBy('at', 'desc').limit(100).get();
  return q.docs.map(d => ({ id: d.id, ...d.data(), at: ms(d.data().at) }));
}
async function markAlertsRead(ids) {
  const b = db.batch(); (ids || []).slice(0, 200).forEach(id => b.update(db.collection('alerts').doc(String(id)), { read: true }));
  await b.commit(); return { ok: true };
}
async function listAudit() {
  const q = await db.collection('audit').orderBy('at', 'desc').limit(200).get();
  return q.docs.map(d => ({ id: d.id, ...d.data(), at: ms(d.data().at) }));
}

/* Xuất CSV (mở được bằng Excel): orders | ledger | reconcile trong khoảng thời gian. */
async function exportCsv(kind, from, to) {
  const col = { orders: ['orders', 'createdAt'], ledger: ['ledger', 'at'], reconcile: ['reconcile', 'at'] }[kind];
  if (!col) fail('invalid-argument', 'Loại báo cáo không hợp lệ');
  const f = Timestamp.fromMillis(+from || 0), t = Timestamp.fromMillis(+to || Date.now());
  const q = await db.collection(col[0]).where(col[1], '>=', f).where(col[1], '<=', t).orderBy(col[1]).limit(20000).get();
  const rows = q.docs.map(d => ({ id: d.id, ...d.data() }));
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = v => { if (v && v.toMillis) v = new Date(v.toMillis()).toISOString(); else if (v && typeof v === 'object') v = JSON.stringify(v);
    v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return '﻿' + [keys.join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\n');
}

module.exports = { stats, findUser, userHistory, setLock, setPacks, setPrices, setCharging, setPaymentConfig, getPaymentConfig, listReconcile, resolveReconcile,
  listAlerts, markAlertsRead, listAudit, exportCsv, DEFAULT_PACKS };
