/* Ví xu phía web: CHỈ hiển thị và gọi máy chủ. Số dư đọc từ Firestore (wallets/<uid>), mọi thay đổi qua Cloud Functions.
   Sửa localStorage hay DevTools không đổi được số dư thật.
   window.Vi = { ready, signedIn, balance, claims, profile, hello, spend, refund, createTopup, cancelTopup, watchOrder, ledger, call } */
(() => {
  const REGION = 'asia-southeast1';
  const ok = !!(window.firebase && firebase.apps && firebase.apps.length && firebase.firestore && firebase.functions);
  let uid = null, balance = 0, claims = {}, profile = null, unsub = null, online = false, cfg = { prices: { incense: 50, flower: 150, rename: 20 }, packs: [] };
  const fire = (n, d) => dispatchEvent(new CustomEvent(n, { detail: d }));
  const fns = ok ? firebase.app().functions(REGION) : null;
  const db = ok ? firebase.firestore() : null;

  async function call(name, data = {}) {
    if (!fns) throw new Error('Máy chủ chưa sẵn sàng');
    try { return (await fns.httpsCallable(name, { timeout: 20000 })(data)).data; }
    catch (e) { const m = (e && e.message) || 'Lỗi máy chủ'; const err = new Error(/internal|INTERNAL|Failed to fetch|not-found/i.test(e.code || '') && !/[à-ỹ]/i.test(m) ? 'Máy chủ đang bận, xin thử lại sau' : m); err.code = e.code; throw err; }
  }
  const opId = () => 'op' + Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join('');

  async function hello() {
    if (!uid) return null;
    try {
      const r = await call('hello');
      online = true; profile = { nick: r.nick, sex: r.sex, nickAt: r.nickAt };
      cfg = { prices: r.prices || cfg.prices, packs: r.packs || [] };
      balance = r.balance; fire('vi-change', Vi.state());
      return r;
    } catch (e) { online = false; fire('vi-change', Vi.state()); return null; }
  }

  async function onUser(u) {
    if (unsub) { unsub(); unsub = null; }
    uid = u ? u.uid : null; balance = 0; claims = {}; profile = null; online = false;
    if (u) {
      try { claims = (await u.getIdTokenResult()).claims || {}; } catch {}
      unsub = db.collection('wallets').doc(u.uid).onSnapshot(s => { if (s.exists) { balance = s.data().balance | 0; fire('vi-change', Vi.state()); } }, () => {});
      await hello();
    }
    fire('vi-change', Vi.state());
  }
  if (ok) firebase.auth().onAuthStateChanged(onUser);

  window.Vi = {
    ready: () => ok,
    online: () => online,
    signedIn: () => !!uid,
    uid: () => uid,
    isAdmin: () => claims.admin === true,
    isOwner: () => claims.owner === true && claims.admin === true,
    balance: () => balance,
    profile: () => profile,
    prices: () => cfg.prices,
    packs: () => cfg.packs,
    state: () => ({ uid, balance, admin: claims.admin === true, owner: claims.owner === true, online, profile }),
    hello, call, opId,
    // Tiêu xu: máy chủ kiểm đủ xu rồi mới trừ; cùng opId gửi lại nhiều lần chỉ trừ một lần
    async spend(kind, payload = {}, id = opId()) { const r = await call('spend', { kind, opId: id, payload }); if (kind === 'rename') profile = { nick: payload.nick, sex: payload.sex, nickAt: Date.now() }; return { ...r, opId: id }; },
    refund: id => call('refundSpend', { opId: id }),
    createTopup: packId => call('createTopup', { packId }),
    cancelTopup: orderId => call('cancelTopup', { orderId }),
    watchOrder(orderId, cb) { return db.collection('orders').doc(orderId).onSnapshot(s => s.exists && cb(s.data()), () => {}); },
    async ledger(n = 50) {
      if (!uid) return [];
      const q = await db.collection('ledger').where('uid', '==', uid).orderBy('at', 'desc').limit(n).get();
      return q.docs.map(d => ({ id: d.id, ...d.data(), at: d.data().at && d.data().at.toMillis() }));
    }
  };
})();
