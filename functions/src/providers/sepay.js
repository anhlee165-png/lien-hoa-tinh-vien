/* PaymentProviderAdapter cho SePay (https://developer.sepay.vn).
   - QR: VietQR do SePay sinh, gắn số tài khoản nhận, số tiền và nội dung = mã đơn.
   - Webhook: xác thực HMAC-SHA256 (header X-SePay-Signature = "sha256=<hex>", X-SePay-Timestamp),
     chuỗi ký = "<timestamp>.<raw body>", lệch giờ tối đa 5 phút, so sánh hằng thời gian. */
const crypto = require('crypto');

const name = 'sepay';

function qrUrl({ bankCode, accountNumber }, amount, content) {
  const q = new URLSearchParams({ acc: accountNumber, bank: bankCode, amount: String(amount), des: content, template: 'compact' });
  return 'https://qr.sepay.vn/img?' + q.toString();
}

function verify(rawBody, headers, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret) return { ok: false, why: 'NO_SECRET' };
  const sig = String(headers['x-sepay-signature'] || ''), ts = Number(headers['x-sepay-timestamp'] || 0);
  if (!sig.startsWith('sha256=') || !ts) return { ok: false, why: 'MISSING_SIGNATURE' };
  if (Math.abs(nowSec - ts) > 300) return { ok: false, why: 'STALE_TIMESTAMP' };
  const want = crypto.createHmac('sha256', secret).update(`${ts}.`).update(rawBody).digest('hex');
  const got = sig.slice(7);
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(want, 'hex'))) return { ok: false, why: 'BAD_SIGNATURE' };
  return { ok: true };
}

// Chuẩn hoá payload SePay → giao dịch chung. Trả null nếu thiếu trường bắt buộc.
function parse(body) {
  if (!body || body.id == null) return null;
  return {
    provider: name,
    txId: String(body.id),                                   // mã giao dịch phía SePay (duy nhất)
    bankRef: String(body.referenceCode || ''),               // mã tham chiếu ngân hàng
    gateway: String(body.gateway || ''),
    account: String(body.accountNumber || ''),
    direction: body.transferType === 'in' ? 'in' : body.transferType === 'out' ? 'out' : 'unknown',
    amount: Number(body.transferAmount),
    currency: 'VND',                                         // SePay chỉ xử lý VND
    content: String(body.content || '') + ' ' + String(body.code || ''),
    when: String(body.transactionDate || '')
  };
}

// SePay coi phản hồi 200/201 kèm {"success": true} là đã nhận, không gửi lại.
const ack = res => res.status(200).json({ success: true });

module.exports = { name, qrUrl, verify, parse, ack };
