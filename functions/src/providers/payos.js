/* PaymentProviderAdapter cho payOS (https://payos.vn/docs).
   - Mỗi đơn nạp tạo một "link thanh toán" qua API payOS (POST /v2/payment-requests), ký HMAC-SHA256 bằng Checksum Key.
     payOS trả về số tài khoản / nội dung / mã QR của đơn; tiền vào thẳng tài khoản ngân hàng đã liên kết payOS.
   - Webhook: body { code, desc, success, data, signature }, signature = HMAC-SHA256(checksumKey, data sắp key A→Z dạng k=v&k=v).
     Không có dấu thời gian → chống gửi lại nhờ khoá giao dịch bank_tx (mỗi giao dịch chỉ xử lý một lần).
   Thuật toán ký theo SDK chính thức @payos/node (utils/create-signature.js). */
const crypto = require('crypto');

const name = 'payos';
const BASE = () => process.env.PAYOS_BASE_URL || 'https://api-merchant.payos.vn';
const SITE = 'https://lienhoatinhvien.com/';

const hmac = (key, s) => crypto.createHmac('sha256', key).update(s).digest('hex');

// Giống convertObjToQueryStr của SDK: key sắp A→Z, null/undefined → "", mảng → JSON (từng phần tử sắp key)
function queryStr(obj) {
  const sortObj = o => Object.keys(o).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {});
  return Object.keys(obj).sort().filter(k => obj[k] !== undefined).map(k => {
    let v = obj[k];
    if (v && Array.isArray(v)) v = JSON.stringify(v.map(x => (x && typeof x === 'object' ? sortObj(x) : x)));
    if ([null, undefined, 'undefined', 'null'].includes(v)) v = '';
    return `${k}=${v}`;
  }).join('&');
}
const signData = (data, key) => hmac(key, queryStr(data));
const same = (a, b) => typeof a === 'string' && a.length === b.length && /^[0-9a-f]+$/i.test(a) && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

/* Tạo link thanh toán. keys = { clientId, apiKey, checksumKey }.
   description: tối đa 9 ký tự để chạy với mọi loại tài khoản payOS. */
async function createLink(keys, { orderCode, amount, description, expiredAt }) {
  if (!keys || !keys.clientId || !keys.apiKey || !keys.checksumKey) throw new Error('PAYOS_NOT_CONFIGURED');
  const returnUrl = SITE + '?nap=xong', cancelUrl = SITE + '?nap=huy';
  const signature = hmac(keys.checksumKey, `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`);
  const r = await fetch(BASE() + '/v2/payment-requests', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-client-id': keys.clientId, 'x-api-key': keys.apiKey },
    body: JSON.stringify({ orderCode, amount, description, returnUrl, cancelUrl, expiredAt, signature }),
    signal: AbortSignal.timeout(10000)
  });
  const j = await r.json().catch(() => ({}));
  if (j.code !== '00' || !j.data) throw new Error(`PAYOS_${j.code || r.status}: ${j.desc || ''}`);
  // Kiểm chữ ký phản hồi để chắc chắn dữ liệu (số tài khoản, số tiền) đúng là của payOS
  if (!same(String(j.signature || ''), signData(j.data, keys.checksumKey))) throw new Error('PAYOS_BAD_RESPONSE_SIGNATURE');
  const d = j.data;
  if (Number(d.amount) !== amount || Number(d.orderCode) !== orderCode) throw new Error('PAYOS_MISMATCH');
  return { bin: String(d.bin), accountNumber: String(d.accountNumber), accountName: String(d.accountName || ''), description: String(d.description),
    paymentLinkId: String(d.paymentLinkId), checkoutUrl: String(d.checkoutUrl), qrCode: String(d.qrCode || '') };
}

// QR hiển thị: VietQR dựng từ đúng số tài khoản + số tiền + nội dung payOS trả về (cùng thông tin với mã QR của payOS)
function qrFromLink(link, amount) {
  const q = new URLSearchParams({ amount: String(amount), addInfo: link.description });
  if (link.accountName) q.set('accountName', link.accountName);
  return `https://img.vietqr.io/image/${encodeURIComponent(link.bin)}-${encodeURIComponent(link.accountNumber)}-compact2.png?` + q.toString();
}
const qrUrl = () => '';   // payOS: QR lấy từ link thanh toán (qrFromLink), không tự dựng

function verify(rawBody, headers, secret) {
  if (!secret) return { ok: false, why: 'NO_SECRET' };
  let b; try { b = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody)); } catch { return { ok: false, why: 'BAD_JSON' }; }
  if (!b || !b.data || typeof b.data !== 'object' || !b.signature) return { ok: false, why: 'MISSING_SIGNATURE' };
  if (!same(String(b.signature), signData(b.data, secret))) return { ok: false, why: 'BAD_SIGNATURE' };
  return { ok: true };
}

// Chuẩn hoá webhook payOS → giao dịch chung. payOS chỉ báo các khoản tiền VÀO đã thanh toán cho link.
function parse(body) {
  const d = body && body.data;
  if (!d || typeof d !== 'object' || d.orderCode == null) return null;
  return {
    provider: name,
    txId: `${d.paymentLinkId || d.orderCode}_${d.reference || ''}`,   // một link có thể nhận nhiều giao dịch → ghép mã tham chiếu
    bankRef: String(d.reference || ''),
    gateway: 'payOS',
    account: String(d.accountNumber || ''),
    direction: String(d.code) === '00' ? 'in' : 'unknown',
    amount: Number(d.amount),
    currency: String(d.currency || 'VND'),
    content: String(d.description || ''),
    when: String(d.transactionDateTime || ''),
    payosOrderCode: String(d.orderCode),
    paymentLinkId: String(d.paymentLinkId || '')
  };
}

const ack = res => res.status(200).json({ success: true });

module.exports = { name, qrUrl, qrFromLink, createLink, verify, parse, ack, signData, queryStr };
