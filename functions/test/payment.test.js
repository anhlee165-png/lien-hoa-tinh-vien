/* Kiểm thử máy chủ trên Firebase Emulator (auth + firestore + functions).
   Chạy: bash scripts/test-backend.sh */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-lhtv';
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-southeast1`;
const AUTH = 'http://127.0.0.1:9099';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const SECRET = 'test-secret-khong-dung-that';
const ACC = '0123456789';

initializeApp({ projectId: PROJECT });
const db = getFirestore(), auth = getAuth();

async function signUp(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'matkhau123', returnSecureToken: true }) });
  const j = await r.json(); return { uid: j.localId, token: j.idToken, email };
}
async function signIn(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'matkhau123', returnSecureToken: true }) });
  return (await r.json()).idToken;
}
async function call(fn, data, token) {
  const r = await fetch(`${FN}/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ data }) });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.status = j.error.status; throw e; }
  return j.result;
}
let txSeq = 1000;
function sepayBody(o) {
  return { id: o.id || ++txSeq, gateway: 'MBBank', transactionDate: '2026-11-01 20:00:00', accountNumber: o.acc || ACC, code: null,
    content: o.content, transferType: o.type || 'in', transferAmount: o.amount, accumulated: 0, subAccount: null, referenceCode: 'FT' + (o.id || txSeq), description: '' };
}
async function hook(body, { secret = SECRET, ts = Math.floor(Date.now() / 1000), sig } = {}) {
  const raw = JSON.stringify(body);
  const s = sig || 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  const r = await fetch(`${FN}/sepayWebhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sepay-signature': s, 'x-sepay-timestamp': String(ts) }, body: raw });
  return r.status;
}
const bal = async uid => ((await db.collection('wallets').doc(uid).get()).data() || {}).balance;
const opId = () => 'op' + crypto.randomBytes(8).toString('hex');

let A, B, OWNER;
test.before(async () => {
  await db.collection('config').doc('payment').set({ provider: 'sepay', bankCode: 'MBBank', accountNumber: ACC, accountName: 'CHUA LIEN HOA', enabled: true, verified: true });
  A = await signUp('a@vd.vn'); B = await signUp('b@vd.vn'); OWNER = await signUp('chu@vd.vn');
  await auth.setCustomUserClaims(OWNER.uid, { admin: true, owner: true });
  await db.collection('config').doc('owner').set({ uid: OWNER.uid });
  OWNER.token = await signIn('chu@vd.vn');
  for (const u of [A, B, OWNER]) await call('hello', {}, u.token);
});

test('1–2. A nạp đúng: chỉ ví A tăng, B không nhận', async () => {
  const o = await call('createTopup', { packId: 'p1' }, A.token);
  assert.equal(o.vnd, 18990); assert.equal(o.xu, 1680);
  assert.match(o.qrUrl, /acc=0123456789.*amount=18990.*des=LHTV/);
  assert.equal(await hook(sepayBody({ amount: 18990, content: `CT ${o.code} chuyen tien` })), 200);
  assert.equal(await bal(A.uid), 1680);
  assert.equal(await bal(B.uid), 0);
  assert.equal((await db.collection('orders').doc(o.orderId).get()).data().status, 'PAID');
});

test('trình duyệt không chọn được giá: gói lạ bị từ chối, giá lấy từ máy chủ', async () => {
  await assert.rejects(call('createTopup', { packId: 'p1', vnd: 1, xu: 999999 }, B.token).then(o => { assert.equal(o.vnd, 18990); assert.equal(o.xu, 1680); throw new Error('ok'); }), /ok/);
  await assert.rejects(call('createTopup', { packId: 'khong-co' }, B.token), /Gói nạp/);
  await assert.rejects(call('createTopup', { packId: 'p1' }), /đăng nhập/);
});

test('3. Đúng số tiền nhưng sai/thiếu mã đơn → không cộng, vào đối soát', async () => {
  const before = await bal(B.uid);
  await call('createTopup', { packId: 'p2' }, B.token);
  assert.equal(await hook(sepayBody({ id: 5001, amount: 48990, content: 'chuyen tien nap xu' })), 200);
  assert.equal(await hook(sepayBody({ id: 5002, amount: 48990, content: 'LHTVZZZZZZZZ' })), 200);
  assert.equal(await bal(B.uid), before);
  assert.equal((await db.collection('reconcile').doc('sepay_5001').get()).data().reason, 'NO_ORDER_CODE');
  assert.equal((await db.collection('reconcile').doc('sepay_5002').get()).data().reason, 'ORDER_NOT_FOUND');
});

test('4. Webhook gửi lại 10 lần chỉ cộng 1 lần', async () => {
  const o = await call('createTopup', { packId: 'p1' }, B.token), before = await bal(B.uid);
  const body = sepayBody({ id: 6001, amount: 18990, content: o.code });
  const codes = await Promise.all(Array.from({ length: 10 }, () => hook(body)));
  assert.ok(codes.every(c => c === 200));
  assert.equal(await bal(B.uid), before + 1680);
  const n = (await db.collection('ledger').where('ref', '==', `order:${o.orderId}`).get()).size;
  assert.equal(n, 1);
});

test('5. Ghi thẳng vào ví/sổ cái từ trình duyệt bị chặn (Firestore Rules)', async () => {
  const r = await fetch(`${FS}/wallets/${A.uid}?updateMask.fieldPaths=balance`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + A.token },
    body: JSON.stringify({ fields: { balance: { integerValue: '99999999' } } }) });
  assert.equal(r.status, 403);
  const r2 = await fetch(`${FS}/ledger`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + A.token }, body: JSON.stringify({ fields: { uid: { stringValue: A.uid }, xu: { integerValue: '5000' } } }) });
  assert.equal(r2.status, 403);
  const r3 = await fetch(`${FS}/wallets/${B.uid}`, { headers: { authorization: 'Bearer ' + A.token } });
  assert.equal(r3.status, 403);                                           // không đọc được ví người khác
  assert.equal(await bal(A.uid), 1680);
});

test('6. Khách giả quyền admin không sửa được giá, số dư, tài khoản nhận tiền', async () => {
  await assert.rejects(call('adminSetPacks', { packs: [{ id: 'p1', vnd: 2000, xu: 999999 }] }, A.token), /quyền/);
  await assert.rejects(call('adminAdjust', { uid: A.uid, xu: 100000, reason: 'tu cong', opId: opId() }, A.token), /quyền/);
  await assert.rejects(call('adminSetPayment', { bankCode: 'VCB', accountNumber: '999', accountName: 'KE GIAN' }, A.token), /quyền/);
  const r = await fetch(`${FS}/config/payment`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + A.token }, body: JSON.stringify({ fields: { accountNumber: { stringValue: '999' } } }) });
  assert.equal(r.status, 403);
  assert.equal((await db.collection('config').doc('payment').get()).data().accountNumber, ACC);
});

test('7. Đăng nhập máy khác (token mới) vẫn đúng số dư', async () => {
  const t2 = await signIn('a@vd.vn');
  const h = await call('hello', {}, t2);
  assert.equal(h.balance, 1680);
});

test('8. Webhook sai chữ ký / quá hạn / không chữ ký bị từ chối', async () => {
  const o = await call('createTopup', { packId: 'p1' }, A.token), before = await bal(A.uid);
  const body = sepayBody({ id: 7001, amount: 18990, content: o.code });
  assert.equal(await hook(body, { secret: 'sai' }), 401);
  assert.equal(await hook(body, { ts: Math.floor(Date.now() / 1000) - 3600 }), 401);
  assert.equal(await hook(body, { sig: 'khongco' }), 401);
  assert.equal(await bal(A.uid), before);
  assert.equal((await db.collection('orders').doc(o.orderId).get()).data().status, 'PENDING');
});

test('9. Tiêu xu đồng thời không làm số dư âm; bấm nhiều lần cùng thao tác chỉ trừ 1 lần', async () => {
  const C = await signUp('c@vd.vn'); await call('hello', {}, C.token);
  await db.collection('wallets').doc(C.uid).set({ balance: 60 });
  const res = await Promise.allSettled(Array.from({ length: 6 }, () => call('spend', { kind: 'incense', opId: opId() }, C.token)));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await bal(C.uid), 10);
  await db.collection('wallets').doc(C.uid).set({ balance: 200 });
  const same = opId();
  await Promise.all(Array.from({ length: 5 }, () => call('spend', { kind: 'incense', opId: same }, C.token)));
  assert.equal(await bal(C.uid), 150);
  const rf = await call('refundSpend', { opId: same }, C.token); await call('refundSpend', { opId: same }, C.token);
  assert.equal(rf.refunded, 50); assert.equal(await bal(C.uid), 200);
});

test('10. Thiếu/thừa tiền, trả sau khi hết hạn, sai tài khoản → không cộng, vào đối soát; hoàn tất thủ công có ghi log', async () => {
  const D = await signUp('d@vd.vn'); await call('hello', {}, D.token);
  const o1 = await call('createTopup', { packId: 'p1' }, D.token);
  await hook(sepayBody({ id: 8001, amount: 18000, content: o1.code }));
  const o2 = await call('createTopup', { packId: 'p1' }, D.token);
  await hook(sepayBody({ id: 8002, amount: 20000, content: o2.code }));
  const o3 = await call('createTopup', { packId: 'p1' }, D.token);
  await db.collection('orders').doc(o3.orderId).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  await hook(sepayBody({ id: 8003, amount: 18990, content: o3.code }));
  await hook(sepayBody({ id: 8004, amount: 18990, content: o1.code, acc: '999999' }));
  assert.equal(await bal(D.uid), 0);
  const reasons = await Promise.all(['8001', '8002', '8003', '8004'].map(async i => (await db.collection('reconcile').doc('sepay_' + i).get()).data().reason));
  assert.deepEqual(reasons, ['UNDERPAID', 'OVERPAID', 'LATE_PAYMENT', 'WRONG_ACCOUNT']);
  // Chủ chùa đối soát: cộng tay cho đơn trả trễ, có lý do
  await assert.rejects(call('adminResolve', { id: 'sepay_8003', action: 'credit', uid: D.uid, xu: 1680, reason: 'tre' }, OWNER.token), /lý do/);
  await call('adminResolve', { id: 'sepay_8003', action: 'credit', uid: D.uid, xu: 1680, reason: 'Khách trả sau khi đơn hết hạn, đã kiểm tra sao kê' }, OWNER.token);
  await assert.rejects(call('adminResolve', { id: 'sepay_8003', action: 'credit', uid: D.uid, xu: 1680, reason: 'Cộng lại lần hai' }, OWNER.token), /đã được xử lý/);
  assert.equal(await bal(D.uid), 1680);
  const log = await db.collection('audit').where('action', '==', 'resolve_reconcile').get();
  assert.ok(log.size >= 1);
});

test('Chủ chùa: đổi gói chỉ áp dụng đơn mới; đổi tài khoản nhận tiền phải xác minh lại; điều chỉnh xu có lý do', async () => {
  const old = await call('createTopup', { packId: 'p1' }, A.token);
  await call('adminSetPacks', { packs: [{ id: 'p1', vnd: 20000, xu: 1700 }, { id: 'p2', vnd: 48990, xu: 5099 }] }, OWNER.token);
  const neu = await call('createTopup', { packId: 'p1' }, A.token);
  assert.equal(neu.vnd, 20000);
  const before = await bal(A.uid);
  await hook(sepayBody({ id: 9001, amount: 18990, content: old.code }));            // đơn cũ vẫn theo giá cũ
  assert.equal(await bal(A.uid), before + 1680);
  // đổi tài khoản → đóng nạp tới khi xác minh
  const r = await call('adminSetPayment', { bankCode: 'VCB', accountNumber: '1122334455', accountName: 'Chua Lien Hoa' }, OWNER.token);
  await assert.rejects(call('createTopup', { packId: 'p2' }, B.token), /chưa mở nạp/);
  await hook(sepayBody({ id: 9002, amount: 2000, content: 'xac minh ' + r.verifyContent, acc: '1122334455' }));
  const cfg = (await db.collection('config').doc('payment').get()).data();
  assert.equal(cfg.verified, true); assert.equal(cfg.enabled, true);
  const o = await call('createTopup', { packId: 'p2' }, B.token);
  assert.match(o.qrUrl, /acc=1122334455/);
  await assert.rejects(call('adminAdjust', { uid: B.uid, xu: 100, reason: '', opId: opId() }, OWNER.token), /lý do/);
  const id = opId();
  await call('adminAdjust', { uid: B.uid, xu: 100, reason: 'Hỗ trợ khách bị lỗi mạng', opId: id }, OWNER.token);
  await call('adminAdjust', { uid: B.uid, xu: 100, reason: 'Hỗ trợ khách bị lỗi mạng', opId: id }, OWNER.token);
  const adj = await db.collection('ledger').where('ref', '==', `adjust:${id}`).get();
  assert.equal(adj.size, 1);
  const st = await call('adminStats', {}, OWNER.token);
  assert.ok(st.revenue >= 18990 * 3); assert.ok(st.reconcileOpen >= 1);
  const csv = await call('adminExport', { kind: 'orders' }, OWNER.token);
  assert.match(csv, /status/);
});

test('Đổi biệt danh: lần đầu miễn phí, trong 24 giờ mất 20 xu', async () => {
  const E = await signUp('e@vd.vn'); await call('hello', {}, E.token);
  await db.collection('wallets').doc(E.uid).set({ balance: 25 });
  const r1 = await call('spend', { kind: 'rename', opId: opId(), payload: { nick: 'Diệu Liên', sex: 'nu' } }, E.token);
  assert.equal(r1.cost, 0);
  const r2 = await call('spend', { kind: 'rename', opId: opId(), payload: { nick: 'Diệu Hoa', sex: 'nu' } }, E.token);
  assert.equal(r2.cost, 20); assert.equal(await bal(E.uid), 5);
  await assert.rejects(call('spend', { kind: 'rename', opId: opId(), payload: { nick: 'Thầy Giả', sex: 'nam' } }, E.token), /dành riêng/);
  await assert.rejects(call('spend', { kind: 'rename', opId: opId(), payload: { nick: '<img src=x>', sex: 'nam' } }, E.token), /ký tự/);
});
