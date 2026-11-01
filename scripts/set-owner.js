/* Cấp quyền CHỦ CHÙA (custom claims admin+owner) cho đúng một tài khoản Gmail đã xác minh.
   Chạy phía máy chủ với service account (GitHub Actions "Cấp quyền chủ chùa" hoặc máy quản trị):
     GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/set-owner.js anhlee165@gmail.com
   Quyền KHÔNG dựa vào email trong JavaScript của web; web chỉ đọc claim đã ký trong ID token. */
const { initializeApp } = require('../functions/node_modules/firebase-admin/app');
const { getAuth } = require('../functions/node_modules/firebase-admin/auth');
const { getFirestore, Timestamp } = require('../functions/node_modules/firebase-admin/firestore');

(async () => {
  const email = (process.argv[2] || '').toLowerCase();
  if (!email) { console.error('Thiếu email'); process.exit(1); }
  initializeApp({ projectId: process.env.FIREBASE_PROJECT || 'lien-hoa-tinh-vien' });
  const auth = getAuth(), db = getFirestore();
  const u = await auth.getUserByEmail(email);
  const google = (u.providerData || []).some(p => p.providerId === 'google.com');
  if (!u.emailVerified || !google) { console.error('Tài khoản phải đăng nhập bằng Google và email đã xác minh'); process.exit(1); }
  const old = await db.collection('config').doc('owner').get();
  if (old.exists && old.data().uid !== u.uid) {                                  // chỉ một chủ: gỡ quyền chủ cũ
    await auth.setCustomUserClaims(old.data().uid, {});
    await auth.revokeRefreshTokens(old.data().uid);
  }
  await auth.setCustomUserClaims(u.uid, { admin: true, owner: true });
  await db.collection('config').doc('owner').set({ uid: u.uid, email, setAt: Timestamp.now() });
  await db.collection('audit').add({ actor: 'script', action: 'set_owner', uid: u.uid, email, before: old.exists ? old.data().uid : null, at: Timestamp.now() });
  console.log('Đã cấp quyền chủ chùa cho', email, u.uid, '— đăng xuất và đăng nhập lại để có hiệu lực');
})().catch(e => { console.error(e.message); process.exit(1); });
