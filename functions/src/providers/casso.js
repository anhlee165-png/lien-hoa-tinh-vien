/* PaymentProviderAdapter cho Casso – Webhook V2 (https://developer.casso.vn).
   - Casso đọc biến động số dư của tài khoản ngân hàng đã liên kết và gọi webhook khi có giao dịch.
   - QR: Casso không tạo QR, dùng VietQR động (img.vietqr.io) với số tiền + nội dung = mã đơn.
   - Chữ ký: header X-Casso-Signature = "t=<timestamp ms>,v1=<hex>".
     Chuỗi ký = t + "." + JSON.stringify(body đã sắp xếp key A→Z, đệ quy); HMAC-SHA512 với "Key bảo mật"
     của tích hợp Webhook V2; so sánh hằng thời gian.
     (Theo mẫu chính thức: github.com/CassoHQ/casso-webhook-v2-verify-signature) */
const crypto = require('crypto');

const name = 'casso';
const MAX_SKEW_MS = 30 * 60 * 1000;   // nới hơn SePay vì Casso có thể gửi lại; gửi lại vẫn an toàn nhờ chống trùng bank_tx

function qrUrl({ bankCode, accountNumber, accountName }, amount, content) {
  const q = new URLSearchParams({ amount: String(amount), addInfo: content });
  if (accountName) q.set('accountName', accountName);
  return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-compact2.png?` + q.toString();
}

// Sắp xếp key giống hàm sortObjDataByKey trong mẫu của Casso (null giữ nguyên)
function sortKeys(v) {
  if (v === null || typeof v !== 'object') return v;
  const o = {};
  Object.keys(v).sort().forEach(k => { o[k] = sortKeys(v[k]); });
  return o;
}

function sign(body, ts, secret) {
  return crypto.createHmac('sha512', secret).update(ts + '.' + JSON.stringify(sortKeys(body))).digest('hex');
}

function verify(rawBody, headers, secret, nowMs = Date.now()) {
  if (!secret) return { ok: false, why: 'NO_SECRET' };
  const m = String(headers['x-casso-signature'] || '').match(/^\s*t=(\d+),\s*v1=([a-fA-F0-9]+)\s*$/);
  if (!m) return { ok: false, why: 'MISSING_SIGNATURE' };
  const ts = Number(m[1]), got = m[2].toLowerCase();
  if (!Number.isFinite(ts) || Math.abs(nowMs - ts) > MAX_SKEW_MS) return { ok: false, why: 'STALE_TIMESTAMP' };
  let body;
  try { body = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody)); } catch { return { ok: false, why: 'BAD_JSON' }; }
  const want = sign(body, m[1], secret);
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(want, 'hex'))) return { ok: false, why: 'BAD_SIGNATURE' };
  return { ok: true };
}

// Chuẩn hoá payload Casso V2 { error, data: {...} } → giao dịch chung. Tiền vào: amount > 0, tiền ra: amount < 0.
function parse(body) {
  const d = body && body.data;
  if (!body || Number(body.error) !== 0 || !d || typeof d !== 'object' || d.id == null) return null;
  const amt = Number(d.amount);
  return {
    provider: name,
    txId: String(d.id),                                       // mã giao dịch phía Casso (duy nhất)
    bankRef: String(d.reference || ''),                       // mã tham chiếu ngân hàng
    gateway: String(d.bankAbbreviation || d.bankName || ''),
    account: String(d.accountNumber || ''),
    direction: amt > 0 ? 'in' : amt < 0 ? 'out' : 'unknown',
    amount: Math.abs(amt),
    currency: 'VND',                                          // tài khoản liên kết Casso là tài khoản VND
    content: String(d.description || ''),
    when: String(d.transactionDateTime || '')
  };
}

// Casso chỉ cần HTTP 200
const ack = res => res.status(200).json({ success: true });

module.exports = { name, qrUrl, verify, parse, ack, sign, sortKeys };
