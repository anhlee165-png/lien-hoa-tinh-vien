/* Phần dùng chung: Firestore, lỗi, giới hạn tần suất, nhật ký kiểm toán, cảnh báo. */
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const crypto = require('crypto');

if (!getApps().length) initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const REGION = 'asia-southeast1';
const now = () => Timestamp.now();
const fail = (code, msg) => { throw new HttpsError(code, msg); };

// Mã ngẫu nhiên không nhầm lẫn (bỏ 0/O/1/I), dùng cho mã tham chiếu chuyển khoản
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(n = 8) {
  const b = crypto.randomBytes(n); let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}

/* Giới hạn tần suất theo cửa sổ thời gian, đếm trong Firestore (an toàn khi chạy nhiều máy). */
async function rateLimit(key, max, windowSec) {
  const ref = db.collection('ratelimits').doc(key.replace(/[/.]/g, '_'));
  const ok = await db.runTransaction(async tx => {
    const s = await tx.get(ref), t = Date.now();
    let d = s.exists ? s.data() : { start: t, n: 0 };
    if (t - d.start > windowSec * 1000) d = { start: t, n: 0 };
    if (d.n >= max) return false;
    tx.set(ref, { start: d.start, n: d.n + 1, exp: Timestamp.fromMillis(d.start + windowSec * 1000 * 2) });
    return true;
  });
  if (!ok) fail('resource-exhausted', 'Thao tác quá nhanh, xin thử lại sau ít phút');
}

/* Nhật ký kiểm toán: chỉ thêm, không sửa. */
function audit(actor, action, data = {}, tx) {
  const ref = db.collection('audit').doc();
  const doc = { actor: actor || 'system', action, ...data, at: now() };
  return tx ? tx.set(ref, doc) : ref.set(doc);
}

/* Cảnh báo cho quản trị (Dashboard đọc). kind: topup | unmatched | webhook_error | admin_denied | payment_config | anomaly */
function alert(kind, msg, data = {}, tx) {
  const ref = db.collection('alerts').doc();
  const doc = { kind, msg, ...data, read: false, at: now() };
  return tx ? tx.set(ref, doc) : ref.set(doc);
}

module.exports = { db, FieldValue, Timestamp, REGION, now, fail, randomCode, rateLimit, audit, alert };
