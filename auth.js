/* Đăng nhập Gmail qua Firebase Authentication.
   window.Auth = { ready(), signIn("google") → {name, email, admin}, signOut() } */
(() => {
  // Quyền quản trị KHÔNG xác định ở đây: máy chủ cấp custom claim (scripts/set-owner.js), web đọc qua Vi.isAdmin().
  const config = {
    apiKey: 'AIzaSyCVrkugcd3NHh2rX37cXYRc4gcIa1CA6LA',
    authDomain: 'lien-hoa-tinh-vien.firebaseapp.com',
    projectId: 'lien-hoa-tinh-vien',
    storageBucket: 'lien-hoa-tinh-vien.firebasestorage.app',
    messagingSenderId: '395579951084',
    appId: '1:395579951084:web:f02d9083670316727c22c9'
  };
  if (!window.firebase) { window.Auth = { ready: () => false }; return; }
  firebase.initializeApp(config);
  // App Check (reCAPTCHA v3): điền khoá site khi đã tạo trong Firebase Console › App Check; máy chủ bật ENFORCE_APP_CHECK sau đó
  const APP_CHECK_SITE_KEY = '';
  if (APP_CHECK_SITE_KEY && firebase.appCheck) try { firebase.appCheck().activate(APP_CHECK_SITE_KEY, true); } catch {}
  const auth = firebase.auth();
  // Chỉ khi chạy thử trên máy (localhost?emu=1): nối tới Firebase Emulator, không đụng dữ liệu thật
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu=1/.test(location.search)) {
    auth.useEmulator('http://127.0.0.1:9099');
    if (firebase.firestore) firebase.firestore().useEmulator('127.0.0.1', 8080);
    if (firebase.functions) firebase.app().functions('asia-southeast1').useEmulator('127.0.0.1', 5001);
    window.__EMU = true;
  }
  auth.languageCode = 'vi';
  const info = u => ({ uid: u.uid, name: u.displayName || (u.email || 'Đạo hữu').split('@')[0], email: u.email || '', photo: u.photoURL || '' });
  const MSG = {
    'auth/operation-not-allowed': 'Cách đăng nhập này chưa được bật trong Firebase',
    'auth/unauthorized-domain': 'Tên miền web chưa được cho phép trong Firebase (Authorized domains)',
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập',
    'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ đăng nhập',
    'auth/account-exists-with-different-credential': 'Email này đã đăng nhập bằng cách khác, hãy dùng Gmail',
    'auth/network-request-failed': 'Mất kết nối mạng'
  };
  let current = null;
  const settled = new Promise(r => auth.onAuthStateChanged(u => { current = u && !u.isAnonymous ? info(u) : null; r(current); dispatchEvent(new CustomEvent('auth-user', { detail: current })); }));
  window.Auth = {
    ready: () => true,
    user: () => current,
    settled: () => settled,
    async signIn(kind) {
      const p = new firebase.auth.GoogleAuthProvider();   // Facebook đã gỡ (chưa cấu hình được)
      p.setCustomParameters({ prompt: 'select_account' });
      try { const r = await auth.signInWithPopup(p); return info(r.user); }
      catch (e) {
        if (e && e.code === 'auth/popup-blocked') { await auth.signInWithRedirect(p); return new Promise(() => {}); }
        throw new Error(MSG[e && e.code] || (e && e.message) || 'Lỗi không rõ');
      }
    },
    signOut: () => auth.signOut(),
    // Khách (không Gmail): đăng nhập ẩn danh để có mã riêng, nhờ đó khách cùng phòng thấy nhau.
    // Tài khoản ẩn danh KHÔNG có ví, không chat, không gọi được chức năng nào của máy chủ (máy chủ và luật đều chặn).
    guest: () => auth.currentUser ? Promise.resolve(true) : auth.signInAnonymously().then(() => true, () => false),
    isGuest: () => !!(auth.currentUser && auth.currentUser.isAnonymous)
  };
})();
