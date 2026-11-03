/* Trò chuyện chung theo phòng qua Firebase Realtime Database: mọi máy trong cùng một điện, cùng một cảnh
   thấy cùng một khung chat (chat/h{điện}/{cảnh}). Ai cũng đọc được; muốn gửi phải đăng nhập Gmail.
   Luật máy chủ (database.rules.json) kiểm: đúng người gửi, độ dài, giờ máy chủ, mỗi người 1,5 giây mới gửi được 1 tin;
   cờ "nhà chùa" chỉ tài khoản có claim admin mới gắn được; chỉ quản trị gỡ được tin của người khác.
   window.ChatNet = { on(), watch(hall, room, cb), send(hall, room, {name, text, admin}), remove(hall, room, id), uid() } */
(() => {
  const DB = 'https://lien-hoa-tinh-vien-default-rtdb.asia-southeast1.firebasedatabase.app';
  const KEEP = 60, DAY = 864e5;
  let db = null, sub = null, on = false;
  const path = (hall, room) => `chat/h${hall | 0}/${String(room).replace(/[^a-z-]/g, '').slice(0, 20) || 'hall'}`;

  async function start() {
    if (!window.firebase || !firebase.database || !firebase.apps.length) return;
    try { const r = await fetch(DB + '/chat/h1/hall.json?shallow=true', { cache: 'no-store' }); if (!r.ok) return; } catch { return; }
    db = firebase.app().database(DB); on = true;
    dispatchEvent(new CustomEvent('chatnet-ready'));
  }

  window.ChatNet = {
    on: () => on,
    uid: () => { const u = window.firebase && firebase.apps.length && firebase.auth().currentUser; return u ? u.uid : null; },
    // nghe đúng một phòng; đổi phòng thì bỏ nghe phòng cũ. cb(list) với list = [{id, uid, name, text, t, admin}]
    watch(hall, room, cb) {
      if (!db) return;
      if (sub) sub.off();
      const ref = db.ref(path(hall, room));
      sub = ref.orderByChild('t').limitToLast(KEEP);
      sub.on('value', s => { const out = []; s.forEach(c => { out.push(Object.assign({ id: c.key }, c.val())); }); cb(out); }, () => cb(null));
      // dọn tin quá 1 ngày (luật cho phép bất kỳ ai đã đăng nhập xoá tin cũ), mỗi lần vào phòng tối đa 20 tin
      if (ChatNet.uid()) ref.orderByChild('t').endAt(Date.now() - DAY).limitToFirst(20).once('value', s => s.forEach(c => { c.ref.remove().catch(() => {}); }));
    },
    async send(hall, room, m) {
      const u = ChatNet.uid(); if (!db || !u) throw new Error('login');
      const ref = db.ref(path(hall, room)).push(), TS = firebase.database.ServerValue.TIMESTAMP;
      const msg = { uid: u, name: String(m.name || 'Đạo hữu').slice(0, 40), text: String(m.text).slice(0, 300), t: TS };
      if (m.admin) msg.admin = true;
      await db.ref().update({ [`${path(hall, room)}/${ref.key}`]: msg, [`chatLast/${u}`]: TS });
    },
    remove: (hall, room, id) => db ? db.ref(`${path(hall, room)}/${id}`).remove() : Promise.reject(new Error('offline'))
  };
  start();
})();
