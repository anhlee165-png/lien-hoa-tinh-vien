/* Liên Hoa Tịnh Viện – máy chủ (Firebase Cloud Functions, vùng asia-southeast1).
   Web (GitHub Pages) chỉ hiển thị; mọi thay đổi xu / đơn / quyền đều đi qua các hàm ở đây. */
const { onCall, onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const { REGION, rateLimit } = require('./core');
const authSvc = require('./auth-service');
const wallet = require('./wallet-service');
const pay = require('./payment-service');
const webhook = require('./webhook-handler');
const admin = require('./admin-service');
const notify = require('./notification-service');
const backup = require('./backup');
const story = require('./story-service');

const SEPAY_WEBHOOK_SECRET = defineSecret('SEPAY_WEBHOOK_SECRET');
const PAYOS_CLIENT_ID = defineSecret('PAYOS_CLIENT_ID');            // payOS › Kênh thanh toán › Client ID / Api Key / Checksum Key
const PAYOS_API_KEY = defineSecret('PAYOS_API_KEY');
const PAYOS_CHECKSUM_KEY = defineSecret('PAYOS_CHECKSUM_KEY');
const PAYOS = [PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY];
const payosKeys = () => ({ clientId: PAYOS_CLIENT_ID.value(), apiKey: PAYOS_API_KEY.value(), checksumKey: PAYOS_CHECKSUM_KEY.value() });
const CASSO_WEBHOOK_SECRET = defineSecret('CASSO_WEBHOOK_SECRET');   // "Key bảo mật" của tích hợp Webhook V2 trên Casso
const NOTIFY_WEBHOOK_URL = defineSecret('NOTIFY_WEBHOOK_URL');
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';   // bật trong functions/.env khi web đã gắn App Check
const BACKUP_BUCKET = defineString('BACKUP_BUCKET', { default: '' });

const { HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
// Lỗi không lường trước: ghi log đầy đủ ở máy chủ, trả về thông báo chung (không lộ chi tiết nội bộ)
const guard = fn => async req => {
  try { return await fn(req); }
  catch (e) { if (e instanceof HttpsError) throw e; logger.error('Lỗi không lường trước', { err: e && e.stack }); throw new HttpsError('internal', 'Máy chủ gặp lỗi, xin thử lại sau'); }
};
const call = (fn, extra = {}) => onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 10, ...extra }, guard(fn));
const adminCall = (fn, opts = {}) => call(async req => { const a = await authSvc.requireAdmin(req, opts); return fn(req.data || {}, a.uid); });

/* ---------- Người dùng ---------- */
exports.hello = call(async req => {                                   // gọi sau khi đăng nhập: tạo hồ sơ + ví
  const { uid, token } = await authSvc.requireUser(req);
  await rateLimit('hello_' + uid, 30, 600);
  const p = await authSvc.ensureProfile(uid, token);
  return { ...p, admin: token.admin === true, owner: authSvc.isOwnerToken(token), prices: await wallet.prices(), packs: (await pay.packs()).filter(x => x.on !== false) };
});

exports.spend = call(async req => {                                   // thắp hương / đổi biệt danh
  const { uid, token } = await authSvc.requireUser(req);
  await rateLimit('spend_' + uid, 30, 60);
  const d = req.data || {};
  return wallet.spend(uid, authSvc.isOwnerToken(token), d.kind, d.opId, d.payload);
});

exports.refundSpend = call(async req => {
  const { uid } = await authSvc.requireUser(req);
  await rateLimit('refund_' + uid, 10, 600);
  return wallet.refund(uid, (req.data || {}).opId);
});

exports.createTopup = call(async req => {
  const { uid } = await authSvc.requireUser(req);
  return pay.createTopup(uid, String((req.data || {}).packId || ''), payosKeys());
}, { secrets: PAYOS });

exports.createDonation = call(async req => {                         // công đức tùy tâm: chuyển khoản bao nhiêu tùy ý, không đổi ra xu
  const { uid } = await authSvc.requireUser(req);
  return pay.createDonation(uid, (req.data || {}).vnd, payosKeys());
}, { secrets: PAYOS });

/* ---------- Tâm sự kín ---------- */
exports.storyPost = call(async req => { const { uid, token } = await authSvc.requireUser(req); return story.post(uid, token.admin === true, req.data || {}); });
exports.storyReply = call(async req => { const { uid, token } = await authSvc.requireUser(req); return story.reply(uid, token.admin === true, req.data || {}); });
exports.adminStoryRemove = adminCall((d, by) => story.remove(by, d));

exports.cancelTopup = call(async req => {
  const { uid } = await authSvc.requireUser(req);
  return pay.cancelTopup(uid, (req.data || {}).orderId);
});

/* ---------- Webhook thanh toán (HTTPS) ---------- */
exports.sepayWebhook = onRequest({ region: REGION, secrets: [SEPAY_WEBHOOK_SECRET], maxInstances: 5, cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  return webhook.handle(pay.PROVIDERS.sepay, req, res, SEPAY_WEBHOOK_SECRET.value());
});

exports.payosWebhook = onRequest({ region: REGION, secrets: [PAYOS_CHECKSUM_KEY], maxInstances: 5, cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  return webhook.handle(pay.PROVIDERS.payos, req, res, PAYOS_CHECKSUM_KEY.value());
});

exports.cassoWebhook = onRequest({ region: REGION, secrets: [CASSO_WEBHOOK_SECRET], maxInstances: 5, cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  return webhook.handle(pay.PROVIDERS.casso, req, res, CASSO_WEBHOOK_SECRET.value());
});

/* ---------- Quản trị ---------- */
exports.adminStats = adminCall(() => admin.stats());
exports.adminFindUser = adminCall(d => admin.findUser(d.q));
exports.adminUserHistory = adminCall(d => admin.userHistory(String(d.uid || '')));
exports.adminSetLock = adminCall((d, by) => admin.setLock(by, String(d.uid || ''), !!d.locked, d.reason));
exports.adminAdjust = adminCall((d, by) => wallet.adjust(by, String(d.uid || ''), d.xu, d.reason, d.opId));
exports.adminSetPacks = adminCall((d, by) => admin.setPacks(by, d.packs), { owner: true, recentLoginSec: 900 });
exports.adminSetPrices = adminCall((d, by) => admin.setPrices(by, d), { owner: true, recentLoginSec: 900 });
exports.adminSetCharging = adminCall((d, by) => admin.setCharging(by, d.on));
exports.adminSetMusic = adminCall((d, by) => admin.setMusic(by, d.tracks));
exports.adminGetPayment = adminCall(() => admin.getPaymentConfig());
exports.adminSetPayment = call(async req => { const a = await authSvc.requireAdmin(req, { owner: true, recentLoginSec: 300 }); return admin.setPaymentConfig(a.uid, req.data || {}, payosKeys()); }, { secrets: PAYOS });
exports.adminReconcile = adminCall(d => admin.listReconcile(d.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN'));
exports.adminResolve = adminCall((d, by) => admin.resolveReconcile(by, d.id, d.action, d));
exports.adminAlerts = adminCall(() => admin.listAlerts());
exports.adminAlertsRead = adminCall(d => admin.markAlertsRead(d.ids));
exports.adminAudit = adminCall(() => admin.listAudit());
exports.adminExport = adminCall(d => admin.exportCsv(d.kind, d.from, d.to));

/* ---------- Việc định kỳ ---------- */
exports.expireOrders = onSchedule({ region: REGION, schedule: 'every 10 minutes' }, async () => { await pay.expireOrders(); });
exports.dailyBackup = onSchedule({ region: REGION, schedule: 'every day 03:00', timeZone: 'Asia/Ho_Chi_Minh' }, async () => backup.run(BACKUP_BUCKET.value()));

/* ---------- Cảnh báo ra ngoài (tuỳ chọn: n8n / Zalo / email qua webhook) – chỉ thông báo, không quyết định cộng xu ---------- */
exports.forwardAlert = onDocumentCreated({ region: REGION, document: 'alerts/{id}', secrets: [NOTIFY_WEBHOOK_URL] }, ev => notify.forward(ev.data && ev.data.data(), NOTIFY_WEBHOOK_URL.value()));

