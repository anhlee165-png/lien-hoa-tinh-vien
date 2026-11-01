/* Đăng nhập Gmail / Facebook qua Firebase Authentication.
   window.Auth = { ready(), signIn('google'|'facebook') → {name, email, admin}, signOut() } */
(() => {
  const ADMIN = ['anhlee165@gmail.com'];                 // tài khoản quản trị (vừa là khách vừa là quản trị)
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
  const auth = firebase.auth();
  auth.languageCode = 'vi';
  const info = u => ({ name: u.displayName || (u.email || 'Đạo hữu').split('@')[0], email: u.email || '', photo: u.photoURL || '',
                      admin: !!u.email && ADMIN.includes(u.email.toLowerCase()) });
  const MSG = {
    'auth/operation-not-allowed': 'Cách đăng nhập này chưa được bật trong Firebase',
    'auth/unauthorized-domain': 'Tên miền web chưa được cho phép trong Firebase (Authorized domains)',
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập',
    'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ đăng nhập',
    'auth/account-exists-with-different-credential': 'Email này đã đăng nhập bằng cách khác, hãy dùng Gmail',
    'auth/network-request-failed': 'Mất kết nối mạng'
  };
  let current = null;
  const settled = new Promise(r => auth.onAuthStateChanged(u => { current = u ? info(u) : null; r(current); dispatchEvent(new CustomEvent('auth-user', { detail: current })); }));
  window.Auth = {
    ready: () => true,
    user: () => current,
    settled: () => settled,
    isAdminEmail: e => !!e && ADMIN.includes(String(e).toLowerCase()),
    async signIn(kind) {
      const p = kind === 'facebook' ? new firebase.auth.FacebookAuthProvider() : new firebase.auth.GoogleAuthProvider();
      if (kind !== 'facebook') p.setCustomParameters({ prompt: 'select_account' });
      try { const r = await auth.signInWithPopup(p); return info(r.user); }
      catch (e) {
        if (e && e.code === 'auth/popup-blocked') { await auth.signInWithRedirect(p); return new Promise(() => {}); }
        throw new Error(MSG[e && e.code] || (e && e.message) || 'Lỗi không rõ');
      }
    },
    signOut: () => auth.signOut()
  };
})();
