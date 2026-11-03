/* AuthService: xác thực người gọi, quyền quản trị bằng Custom Claims (không tin email/localStorage). */
const { db, fail, now, audit, alert, rateLimit } = require('./core');

// Người gọi phải đăng nhập (Firebase ID token đã được Cloud Functions xác minh).
async function requireUser(req) {
  if (!req.auth || !req.auth.uid) fail('unauthenticated', 'Mời đạo hữu đăng nhập Gmail hoặc Facebook');
  const uid = req.auth.uid;
  const u = await db.collection('users').doc(uid).get();
  if (u.exists && u.data().locked) fail('permission-denied', 'Tài khoản đang bị tạm khoá, xin liên hệ nhà chùa');
  return { uid, token: req.auth.token || {} };
}

// Quản trị = custom claim admin:true do script phía máy chủ cấp; chủ sở hữu = claim owner:true VÀ khớp config/owner.uid.
async function requireAdmin(req, { owner = false, recentLoginSec = 0 } = {}) {
  const uid = req.auth && req.auth.uid, t = (req.auth && req.auth.token) || {};
  let ok = !!uid && t.admin === true;
  if (ok && owner) {
    const o = await db.collection('config').doc('owner').get();
    ok = t.owner === true && o.exists && o.data().uid === uid;
  }
  if (!ok) {
    await audit(uid || 'anonymous', 'admin_denied', { fn: req.rawRequest && req.rawRequest.path || '' });
    try { await rateLimit('admin_denied_' + (uid || 'anon'), 5, 600); }
    catch { await alert('admin_denied', `Nhiều lần gọi chức năng quản trị không có quyền (${uid || 'chưa đăng nhập'})`, { uid: uid || null }); }
    fail('permission-denied', 'Không có quyền quản trị');
  }
  if (recentLoginSec && (Date.now() / 1000 - (t.auth_time || 0)) > recentLoginSec)
    fail('unauthenticated', 'Vì an toàn, xin đăng nhập lại rồi thực hiện thao tác này');
  return { uid, token: t };
}

const isOwnerToken = t => t && t.owner === true && t.admin === true;

// Tạo hồ sơ + ví 0 xu khi người dùng đăng nhập lần đầu (gọi từ web sau khi đăng nhập).
async function ensureProfile(uid, token) {
  const uref = db.collection('users').doc(uid), wref = db.collection('wallets').doc(uid);
  return db.runTransaction(async tx => {
    const [u, w] = await Promise.all([tx.get(uref), tx.get(wref)]);
    const prov = (token.firebase && token.firebase.sign_in_provider) || '';
    if (!u.exists) tx.set(uref, { email: String(token.email || '').toLowerCase(), name: token.name || '', provider: prov, nick: null, sex: null, nickAt: null, locked: false, createdAt: now(), lastSeen: now() });
    else tx.update(uref, { lastSeen: now() });
    if (!w.exists) tx.set(wref, { balance: 0, updatedAt: now() });
    const ud = u.exists ? u.data() : { nick: null, sex: null, nickAt: null };
    return { nick: ud.nick, sex: ud.sex, nickAt: ud.nickAt ? ud.nickAt.toMillis() : null, balance: w.exists ? w.data().balance : 0, items: (w.exists && w.data().items) || {} };
  });
}

module.exports = { requireUser, requireAdmin, isOwnerToken, ensureProfile };
