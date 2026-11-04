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
  await assert.rejects(call('adminSetPayment', { provider: 'sepay', bankCode: 'VCB', accountNumber: '999', accountName: 'KE GIAN' }, A.token), /quyền/);
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

test('Dâng hoa: giá máy chủ 150 xu/bông, bấm lặp chỉ trừ 1 lần, không đủ xu bị chặn, hoàn xu đúng 1 lần', async () => {
  const F = await signUp('hoa@vd.vn'); await call('hello', {}, F.token);
  await db.collection('wallets').doc(F.uid).set({ balance: 200 });
  const id = opId();
  const r = await call('spend', { kind: 'flower', opId: id }, F.token); await call('spend', { kind: 'flower', opId: id }, F.token);
  assert.equal(r.cost, 150); assert.equal(await bal(F.uid), 50);
  await assert.rejects(call('spend', { kind: 'flower', opId: opId() }, F.token));
  assert.equal(await bal(F.uid), 50);
  const rf = await call('refundSpend', { opId: id }, F.token); await call('refundSpend', { opId: id }, F.token);
  assert.equal(rf.refunded, 150); assert.equal(await bal(F.uid), 200);
  const L = await db.collection('ledger').where('uid', '==', F.uid).get();
  assert.ok(L.docs.some(d => d.data().reason === 'Dâng hoa' && d.data().xu === -150));
});

test('Bật/tắt thu phí: chỉ quản trị đổi được; tắt thì thắp hương, dâng hoa, cúng dường không trừ xu; bật lại thì trừ', async () => {
  await assert.rejects(call('adminSetCharging', { on: false }, B.token), /quyền|permission|PERMISSION/i);
  assert.deepEqual(await call('adminSetCharging', { on: false }, OWNER.token), { charging: false });
  assert.equal((await call('hello', {}, B.token)).prices.charging, false);
  const before = await bal(B.uid);
  for (const [kind, payload] of [['incense', {}], ['flower', {}], ['offer', { item: 'kinh' }]]) {
    const r = await call('spend', { kind, opId: opId(), payload }, B.token);
    assert.equal(r.cost, 0);
  }
  assert.equal(await bal(B.uid), before);
  assert.ok((await db.collection('audit').where('action', '==', 'set_charging').get()).size >= 1);
  await call('adminSetCharging', { on: true }, OWNER.token);
  if (before >= 50) { const r = await call('spend', { kind: 'incense', opId: opId() }, B.token); assert.equal(r.cost, 50); assert.equal(await bal(B.uid), before - 50); }
  else await assert.rejects(call('spend', { kind: 'incense', opId: opId() }, B.token), /đủ xu/);
});

test('Nhạc trong điện: chỉ quản trị đặt được, chỉ nhận link https; khách ẩn danh không gọi được chức năng ví', async () => {
  await assert.rejects(call('adminSetMusic', { tracks: [{ name: 'X', url: 'https://a.vn/x.mp3' }] }, B.token), /quyền|permission|PERMISSION/i);
  await assert.rejects(call('adminSetMusic', { tracks: [{ name: 'X', url: 'javascript:alert(1)' }] }, OWNER.token), /https/);
  await assert.rejects(call('adminSetMusic', { tracks: [{ name: '<b>', url: 'https://a.vn/x.mp3' }] }, OWNER.token), /không hợp lệ/);
  const r = await call('adminSetMusic', { tracks: [{ name: 'Chú Đại Bi', url: 'https://a.vn/dai-bi.mp3' }, { name: 'Bát Nhã', url: 'https://a.vn/bat-nha.mp3' }] }, OWNER.token);
  assert.equal(r.tracks.length, 2); assert.ok(r.tracks.every(t => /^[a-z0-9]{6,20}$/.test(t.id)));
  const pub = await fetch(`${FS}/config/music`); assert.equal(pub.status, 200);      // ai cũng đọc được danh sách nhạc
  const an = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) })).json();
  await assert.rejects(call('hello', {}, an.idToken), /đăng nhập/i);
  await assert.rejects(call('createTopup', { packId: 'p1' }, an.idToken), /đăng nhập/i);
});

test('Công đức tùy tâm: số tiền tự chọn, tiền về đúng đơn thì ghi sổ, không cộng xu; số tiền sai bị chặn', async () => {
  await assert.rejects(call('createDonation', { vnd: 1000 }, A.token), /Số tiền/);
  await assert.rejects(call('createDonation', { vnd: 1999 }, A.token), /Số tiền/);
  await assert.rejects(call('createDonation', { vnd: 50000 }), /đăng nhập/);
  const before = await bal(A.uid);
  const o = await call('createDonation', { vnd: 50000 }, A.token);
  assert.equal(o.vnd, 50000); assert.equal(o.xu, 0);
  assert.equal(await hook(sepayBody({ amount: 50000, content: `CT ${o.code}` })), 200);
  assert.equal(await bal(A.uid), before);
  const od = (await db.collection('orders').doc(o.orderId).get()).data();
  assert.equal(od.status, 'PAID'); assert.equal(od.kind, 'donate');
  const L = await db.collection('ledger').where('uid', '==', A.uid).where('type', '==', 'DONATE').get();
  assert.equal(L.size, 1); assert.equal(L.docs[0].data().vnd, 50000); assert.equal(L.docs[0].data().xu, 0);
  const o2 = await call('createDonation', { vnd: 20000 }, A.token);
  assert.equal(await hook(sepayBody({ amount: 10000, content: `CT ${o2.code}` })), 200);
  assert.equal((await db.collection('orders').doc(o2.orderId).get()).data().status, 'REVIEW');
});

test('Hòm Công đức: nhận thêm bằng xu, thắp hương/cúng dường dùng đồ trong hòm trước, hết mới trừ xu, hoàn trả lại đồ', async () => {
  const C = await signUp('hom@vd.vn'); await call('hello', {}, C.token);
  await call('adminAdjust', { uid: C.uid, xu: 1000, reason: 'Thử Hòm Công đức', opId: opId() }, OWNER.token);
  await assert.rejects(call('spend', { kind: 'buy', opId: opId(), payload: { item: 'huong', qty: 0 } }, C.token), /Số lượng/);
  await assert.rejects(call('spend', { kind: 'buy', opId: opId(), payload: { item: 'vang', qty: 1 } }, C.token), /không có/);
  let r = await call('spend', { kind: 'buy', opId: opId(), payload: { item: 'huong', qty: 3 } }, C.token);
  assert.equal(r.cost, 150); assert.equal(r.items.huong, 3); assert.equal(await bal(C.uid), 850);
  const hid = opId();
  r = await call('spend', { kind: 'incense', opId: hid }, C.token);
  assert.equal(r.cost, 0); assert.equal(r.used, 'huong'); assert.equal(r.items.huong, 2); assert.equal(await bal(C.uid), 850);
  r = await call('refundSpend', { opId: hid }, C.token); assert.equal(r.returned, 'huong');
  assert.equal(((await db.collection('wallets').doc(C.uid).get()).data().items || {}).huong, 3);
  r = await call('spend', { kind: 'offer', opId: opId(), payload: { item: 'sen' } }, C.token);
  assert.equal(r.cost, 200); assert.equal(await bal(C.uid), 650);                    // chưa có hoa sen trong hòm: trừ xu
  await call('spend', { kind: 'buy', opId: opId(), payload: { item: 'sen', qty: 1 } }, C.token);
  r = await call('spend', { kind: 'offer', opId: opId(), payload: { item: 'sen' } }, C.token);
  assert.equal(r.cost, 0); assert.equal(r.used, 'sen'); assert.equal(await bal(C.uid), 450);
  await assert.rejects(call('spend', { kind: 'buy', opId: opId(), payload: { item: 'kinh', qty: 1 } }, C.token), /đủ xu/);
  const ob = await call('spend', { kind: 'buy', opId: opId(), payload: { item: 'den', qty: 2 } }, OWNER.token);   // chủ chùa: không mất xu, hòm vẫn tăng
  assert.equal(ob.cost, 0); assert.equal(ob.items.den, 2);
  const r2 = await fetch(`${FS}/wallets/${C.uid}?updateMask.fieldPaths=items.huong`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + C.token },
    body: JSON.stringify({ fields: { items: { mapValue: { fields: { huong: { integerValue: '999' } } } } } }) });
  assert.equal(r2.status, 403);                                                      // không tự sửa số trong hòm
});

test('Tâm sự kín: cần đăng nhập, tên lấy từ máy chủ (hoặc Ẩn danh), ai cũng đọc được nhưng không ghi thẳng; nhà chùa trả lời và gỡ được', async () => {
  await assert.rejects(call('storyPost', { text: 'Xin chào mọi người' }), /đăng nhập/);
  await assert.rejects(call('storyPost', { text: 'ab' }, A.token), /ít nhất/);
  const { id } = await call('storyPost', { text: 'Con xin kể một câu chuyện <b>nhỏ</b>', name: 'Giả làm Nhà chùa' }, A.token);
  const s = (await db.collection('stories').doc(id).get()).data();
  assert.notEqual(s.name, 'Giả làm Nhà chùa'); assert.equal(s.admin, false);
  const anon = await call('storyPost', { text: 'Tâm sự giấu tên', anon: true }, B.token);
  assert.equal((await db.collection('stories').doc(anon.id).get()).data().name, 'Ẩn danh');
  await call('storyReply', { id, text: 'Tùy hỷ đạo hữu' }, B.token);
  await call('storyReply', { id, text: 'A Di Đà Phật' }, OWNER.token);
  const reps = await db.collection('stories').doc(id).collection('replies').orderBy('at').get();
  assert.equal(reps.size, 2); assert.equal(reps.docs[1].data().name, 'Nhà chùa'); assert.equal(reps.docs[1].data().admin, true);
  assert.equal((await db.collection('stories').doc(id).get()).data().replies, 2);
  assert.equal((await fetch(`${FS}/stories/${id}`)).status, 200);                        // đọc công khai
  const w = await fetch(`${FS}/stories`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + A.token }, body: JSON.stringify({ fields: { text: { stringValue: 'ghi thẳng' } } }) });
  assert.equal(w.status, 403);
  await assert.rejects(call('adminStoryRemove', { id }, A.token), /quyền/);
  await call('adminStoryRemove', { id: anon.id }, OWNER.token);
  assert.equal((await db.collection('stories').doc(anon.id).get()).exists, false);
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
  const r = await call('adminSetPayment', { provider: 'sepay', bankCode: 'VCB', accountNumber: '1122334455', accountName: 'Chua Lien Hoa' }, OWNER.token);
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

/* ---------- Casso (Webhook V2) ---------- */
const casso = require('../src/providers/casso');
async function cassoHook(data, { secret = SECRET, ts = Date.now(), sig, error = 0 } = {}) {
  const body = { error, data };
  const raw = JSON.stringify(body);
  const h = sig || `t=${ts},v1=${casso.sign(body, String(ts), secret)}`;
  const r = await fetch(`${FN}/cassoWebhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-casso-signature': h }, body: raw });
  return r.status;
}
const cassoTx = o => ({ id: o.id, reference: 'FT' + o.id, description: o.content, amount: o.amount, runningBalance: 1000000, transactionDateTime: '2026-11-02 11:00:00',
  accountNumber: o.acc || '88880000', bankName: 'MBBank', bankAbbreviation: 'MBB', virtualAccountNumber: '', virtualAccountName: '',
  counterAccountName: 'NGUYEN VAN A', counterAccountNumber: '0001', counterAccountBankId: '970415', counterAccountBankName: 'VietinBank' });

test('Casso: chữ ký khớp mẫu chính thức của Casso, sai key thì từ chối', () => {
  const body = { error: 0, data: { id: 0, reference: 'MA_GIAO_DICH_THU_NGHIEM', description: 'giao dich thu nghiem', amount: 599000, runningBalance: 25000000,
    transactionDateTime: '2024-10-03 15:06:37', accountNumber: '88888888', bankName: 'VPBank', bankAbbreviation: 'VPB', virtualAccountNumber: '', virtualAccountName: '',
    counterAccountName: 'NGUYEN VAN A', counterAccountNumber: '8888888888', counterAccountBankId: '970415', counterAccountBankName: 'VietinBank' } };
  const key = 'mgExMrjj4i7a1p8Cs6LmFbpCd8lbw4sSX4LZXPag7TKazeIogtR90tvWYTkwQbvs';   // key mẫu công khai trong tài liệu Casso
  const h = { 'x-casso-signature': 't=1727948258788,v1=ed0a4bd2e826d5cb69988cdb141e6c1a080e21f3b57eb72cd78192220042b9e7dde0868fc667faea8e224900fa7904e7c88dfa098032fb2d6b6996856e8b7ff3' };
  assert.deepEqual(casso.verify(Buffer.from(JSON.stringify(body)), h, key, 1727948258788), { ok: true });
  assert.equal(casso.verify(Buffer.from(JSON.stringify(body)), h, key + 'x', 1727948258788).why, 'BAD_SIGNATURE');
  assert.equal(casso.verify(Buffer.from(JSON.stringify(body)), h, key, 1727948258788 + 3600e3).why, 'STALE_TIMESTAMP');
  const p = casso.parse({ error: 0, data: { ...body.data, amount: -50000 } });
  assert.equal(p.direction, 'out'); assert.equal(p.amount, 50000);
});

test('Casso: xác minh tài khoản, nạp đúng cộng 1 lần, gửi lại 5 lần không cộng thêm, chữ ký giả bị chặn', async () => {
  const r = await call('adminSetPayment', { provider: 'casso', bankCode: 'MB', accountNumber: '88880000', accountName: 'Chua Lien Hoa' }, OWNER.token);
  await assert.rejects(call('createTopup', { packId: 'p2' }, A.token), /chưa mở nạp/);
  assert.equal(await cassoHook(cassoTx({ id: 31001, amount: 2000, content: 'MBVCB.123 ' + r.verifyContent + ' FT123' })), 200);
  assert.equal((await db.collection('config').doc('payment').get()).data().verified, true);
  const o = await call('createTopup', { packId: 'p2' }, A.token);
  assert.match(o.qrUrl, /^https:\/\/img\.vietqr\.io\/image\/MB-88880000-compact2\.png\?amount=48990&addInfo=LHTV/);
  const before = await bal(A.uid);
  assert.equal(await cassoHook(cassoTx({ id: 31002, amount: 48990, content: 'CK ' + o.code.toLowerCase() })), 200);
  for (let i = 0; i < 5; i++) assert.equal(await cassoHook(cassoTx({ id: 31002, amount: 48990, content: 'CK ' + o.code })), 200);
  assert.equal(await bal(A.uid), before + 5099);
  assert.equal((await db.collection('orders').doc(o.code).get()).data().status, 'PAID');
  // chữ ký giả / key sai / không chữ ký
  const o2 = await call('createTopup', { packId: 'p1' }, A.token);
  assert.equal(await cassoHook(cassoTx({ id: 31003, amount: 18990, content: o2.code }), { secret: 'key-gia' }), 401);
  assert.equal(await cassoHook(cassoTx({ id: 31004, amount: 18990, content: o2.code }), { sig: 'bua' }), 401);
  assert.equal(await cassoHook(cassoTx({ id: 31005, amount: 18990, content: o2.code }), { ts: Date.now() - 2 * 3600e3 }), 401);
  assert.equal(await bal(A.uid), before + 5099);
  // tiền ra mang mã đơn → đối soát, không cộng; thiếu tiền → đối soát
  await cassoHook(cassoTx({ id: 31006, amount: -18990, content: o2.code }));
  const o3 = await call('createTopup', { packId: 'p1' }, A.token);
  await cassoHook(cassoTx({ id: 31007, amount: 18000, content: o3.code }));
  assert.equal((await db.collection('reconcile').doc('casso_31006').get()).data().reason, 'OUTGOING_FOR_ORDER');
  assert.equal((await db.collection('reconcile').doc('casso_31007').get()).data().reason, 'UNDERPAID');
  assert.equal(await bal(A.uid), before + 5099);
});

/* ---------- payOS ---------- */
const payos = require('../src/providers/payos');
const http = require('http');
const PAYOS_ACC = '98616059699999';
let payosMock, payosLinks = [], payosFail = false;
test.before(() => new Promise(ok => {
  // payOS giả lập: kiểm khoá API + chữ ký yêu cầu, trả dữ liệu có chữ ký như payOS thật
  payosMock = http.createServer((req, res) => {
    let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
      const b = JSON.parse(raw || '{}');
      const reqSig = crypto.createHmac('sha256', SECRET).update(`amount=${b.amount}&cancelUrl=${b.cancelUrl}&description=${b.description}&orderCode=${b.orderCode}&returnUrl=${b.returnUrl}`).digest('hex');
      if (payosFail || req.headers['x-client-id'] !== 'test-client' || req.headers['x-api-key'] !== 'test-api-key' || b.signature !== reqSig) {
        res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ code: '20', desc: 'Lỗi giả lập' }));
      }
      const data = { bin: '970422', accountNumber: 'V3CAS' + PAYOS_ACC.slice(-6), accountName: 'LE DUC ANH', amount: b.amount, description: b.description, orderCode: b.orderCode,
        currency: 'VND', paymentLinkId: crypto.randomBytes(16).toString('hex'), status: 'PENDING', expiredAt: b.expiredAt, checkoutUrl: 'https://pay.payos.vn/web/' + b.orderCode, qrCode: '000201...' };
      payosLinks.push(data);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: '00', desc: 'success', data, signature: payos.signData(data, SECRET) }));
    });
  }).listen(5098, '127.0.0.1', ok);
}));
test.after(() => payosMock && payosMock.close());

async function payosHook(link, { amount = link.amount, ref = 'FT' + crypto.randomBytes(4).toString('hex'), secret = SECRET, sig, acc = link.accountNumber } = {}) {
  const data = { orderCode: link.orderCode, amount, description: link.description, accountNumber: acc, reference: ref, transactionDateTime: '2026-11-02 11:30:00',
    currency: 'VND', paymentLinkId: link.paymentLinkId, code: '00', desc: 'Thành công', counterAccountBankId: '', counterAccountBankName: '', counterAccountName: null,
    counterAccountNumber: null, virtualAccountName: '', virtualAccountNumber: '' };
  const body = JSON.stringify({ code: '00', desc: 'success', success: true, data, signature: sig || payos.signData(data, secret) });
  const r = await fetch(`${FN}/payosWebhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  return { status: r.status, ref };
}

test('payOS: chữ ký khớp ví dụ chính thức trong tài liệu payOS', () => {
  const data = { orderCode: 123, amount: 3000, description: 'VQRIO123', accountNumber: '12345678', reference: 'TF230204212323', transactionDateTime: '2023-02-04 18:25:00',
    currency: 'VND', paymentLinkId: '124c33293c43417ab7879e14c8d9eb18', code: '00', desc: 'Thành công', counterAccountBankId: '', counterAccountBankName: '',
    counterAccountName: '', counterAccountNumber: '', virtualAccountName: '', virtualAccountNumber: '' };
  const key = '1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675';   // key mẫu công khai trong tài liệu payOS
  const sig = '412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03';
  assert.deepEqual(payos.verify(Buffer.from(JSON.stringify({ code: '00', data, signature: sig })), {}, key), { ok: true });
  assert.equal(payos.verify(Buffer.from(JSON.stringify({ code: '00', data: { ...data, amount: 30000 }, signature: sig })), {}, key).why, 'BAD_SIGNATURE');
});

test('payOS: xác minh tài khoản qua link 2.000đ, nạp đúng cộng 1 lần, gửi lại không cộng thêm, giả chữ ký bị chặn, sai số tiền vào đối soát', async () => {
  const A = await signUp('pa@vd.vn'), B = await signUp('pb@vd.vn');
  await call('hello', {}, A.token); await call('hello', {}, B.token);
  const r = await call('adminSetPayment', { provider: 'payos', bankCode: 'MB', accountNumber: PAYOS_ACC, accountName: 'LE DUC ANH' }, OWNER.token);
  assert.ok(r.verifyLink && /^https:\/\/img\.vietqr\.io\/image\/970422-/.test(r.verifyLink.qrUrl));
  await assert.rejects(call('createTopup', { packId: 'p2' }, A.token), /chưa mở nạp/);
  const vlink = payosLinks[payosLinks.length - 1];
  assert.equal(vlink.amount, 2000);
  assert.equal((await payosHook(vlink, { secret: 'key-gia' })).status, 401);
  assert.equal((await db.collection('config').doc('payment').get()).data().verified, false);
  assert.equal((await payosHook(vlink)).status, 200);
  assert.equal((await db.collection('config').doc('payment').get()).data().verified, true);

  const o = await call('createTopup', { packId: 'p2' }, A.token);
  assert.match(o.checkoutUrl, /^https:\/\/pay\.payos\.vn\//);
  assert.match(o.qrUrl, /amount=48990/);
  assert.equal(o.code.length <= 9, true);
  const link = payosLinks[payosLinks.length - 1];
  const before = await bal(A.uid);
  const first = await payosHook(link);
  assert.equal(first.status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await payosHook(link, { ref: first.ref })).status, 200);
  assert.equal(await bal(A.uid), before + 5099);
  assert.equal((await db.collection('orders').doc(o.orderId).get()).data().status, 'PAID');
  // giao dịch thứ hai vào cùng link (đơn đã trả) → đối soát, không cộng
  const dup = await payosHook(link);
  assert.equal((await db.collection('reconcile').doc(`payos_${link.paymentLinkId}_${dup.ref}`).get()).data().reason, 'ORDER_ALREADY_PAID');
  // giả chữ ký / thiếu chữ ký
  const o2 = await call('createTopup', { packId: 'p1' }, A.token);
  const l2 = payosLinks[payosLinks.length - 1];
  assert.equal((await payosHook(l2, { secret: 'key-gia' })).status, 401);
  assert.equal((await payosHook(l2, { sig: 'abc' })).status, 401);
  // thiếu tiền → đối soát
  const under = await payosHook(l2, { amount: 10000 });
  assert.equal((await db.collection('reconcile').doc(`payos_${l2.paymentLinkId}_${under.ref}`).get()).data().reason, 'UNDERPAID');
  // sai tài khoản nhận → đối soát
  const o3 = await call('createTopup', { packId: 'p1' }, B.token);
  const l3 = payosLinks[payosLinks.length - 1];
  const wrong = await payosHook(l3, { acc: '000111222' });
  assert.equal((await db.collection('reconcile').doc(`payos_${l3.paymentLinkId}_${wrong.ref}`).get()).data().reason, 'WRONG_ACCOUNT');
  assert.equal(await bal(A.uid), before + 5099);
  assert.ok(o2 && o3);
  // payOS lỗi → báo bận, đơn đánh dấu FAILED, không treo
  payosFail = true;
  await assert.rejects(call('createTopup', { packId: 'p1' }, B.token), /bận/);
  payosFail = false;
});
