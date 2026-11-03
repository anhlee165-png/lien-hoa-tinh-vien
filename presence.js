/* Phật tử thật đang có mặt (đăng nhập Gmail / Facebook).
   Có Firebase Realtime Database thì dùng nó (mọi máy thấy nhau); chưa có thì dùng BroadcastChannel (các tab cùng máy).
   window.Presence = { set({hall, room}), others(), countIn(hall), refreshCounts(), mode(), me() }; mỗi lần đổi phát sự kiện 'presence'.
   Chống quá tải (20 điện × 100 người = 2.000 người): mỗi máy chỉ nghe danh sách người trong ĐIỆN CỦA MÌNH
   (presence/h{số điện}), không nghe cả chùa. Số người các điện khác chỉ đọc một lần khi mở danh sách điện
   (đọc nông: chỉ lấy mã người, không lấy dữ liệu). Không có nhịp "còn sống" mỗi phút: rời trang hay mất mạng
   thì máy chủ tự xoá nhờ onDisconnect, nên lượng tin gửi đi không tăng theo bình phương số người. */
(() => {
  const DB = 'https://lien-hoa-tinh-vien-default-rtdb.asia-southeast1.firebasedatabase.app';
  const sheetOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h & 1) ? 'nu' : 'nam'; };
  let mine = { hall: 1, room: 'hall' }, nick = null, who = null, mode = 'local', all = {}, ref = null, db = null, sub = null, counts = {};
  const emit = () => dispatchEvent(new CustomEvent('presence', { detail: Presence.others() }));

  /* ---- cùng máy: BroadcastChannel, nhịp 4 giây, quá 12 giây coi như đã ra ---- */
  let bc = null; try { bc = new BroadcastChannel('lhtv-presence'); } catch {}
  const seen = {};
  if (bc) bc.onmessage = e => {
    const m = e.data || {};
    if (m.bye) { delete seen[m.uid]; } else if (m.uid) seen[m.uid] = Object.assign(m, { t: Date.now() });
    if (mode === 'local') { all = seen; emit(); }
  };
  const ping = () => { if (bc && who && mode === 'local') bc.postMessage(Object.assign({ uid: who.uid, name: who.name, sheet: who.sheet }, mine)); };
  setInterval(() => {
    ping(); const now = Date.now(); let ch = false;
    for (const k in seen) if (now - seen[k].t > 12000) { delete seen[k]; ch = true; }
    if (ch && mode === 'local') { all = seen; emit(); }
  }, 4000);
  addEventListener('pagehide', () => { if (bc && who) bc.postMessage({ uid: who.uid, bye: true }); if (ref) ref.remove(); });

  /* ---- mọi máy: Firebase Realtime Database ---- */
  async function tryFirebase() {
    if (!window.firebase || !firebase.database) return;
    try {
      const r = await fetch(DB + '/presence/h1.json?shallow=true', { cache: 'no-store' });
      if (!r.ok) return;                                                   // chưa tạo cơ sở dữ liệu → dùng cục bộ
    } catch { return; }
    db = firebase.app().database(DB);
    listen(); Presence._write = write; write(); refreshCounts();
  }
  // chỉ nghe điện của mình; đổi điện thì bỏ nghe điện cũ
  function listen() {
    if (!db) return;
    if (sub) sub.off();
    const hall = mine.hall;
    sub = db.ref('presence/h' + hall);
    sub.on('value', s => {
      const v = s.val() || {}; all = {};
      for (const k in v) if (v[k]) all[k] = Object.assign({ uid: k, hall }, v[k]);
      counts[hall] = Object.keys(all).length;
      mode = 'firebase'; emit();
    }, () => { mode = 'local'; all = seen; emit(); });
  }
  function write() {
    if (!db) return;
    const u = firebase.auth().currentUser;
    if (ref) { ref.onDisconnect().cancel(); ref.remove(); ref = null; }
    if (!u || !who) return;
    ref = db.ref(`presence/h${mine.hall}/${u.uid}`); ref.onDisconnect().remove();
    ref.set({ name: who.name.slice(0, 40), sheet: who.sheet, room: mine.room, t: firebase.database.ServerValue.TIMESTAMP })
      .then(() => { if (mine.abbot && ref) return ref.child('abbot').set(true); }).catch(() => {});
  }
  // số người thật ở từng điện: đọc nông 20 điện một lượt, tối đa 1 lần mỗi 30 giây
  let lastCounts = 0;
  async function refreshCounts() {
    if (!db || Date.now() - lastCounts < 30e3) return; lastCounts = Date.now();
    await Promise.all(Array.from({ length: 20 }, async (_, i) => {
      const h = i + 1; if (h === mine.hall) return;
      try { const r = await fetch(`${DB}/presence/h${h}.json?shallow=true`, { cache: 'no-store' }); if (r.ok) counts[h] = Object.keys((await r.json()) || {}).length; } catch {}
    }));
    emit();
  }

  function identify(u) {
    const fu = window.firebase && firebase.apps && firebase.apps.length && firebase.auth().currentUser;
    who = u ? { uid: fu ? fu.uid : 'e:' + (u.email || u.name), name: u.name || 'Đạo hữu' } : null;
    if (who) { who.sheet = nick ? nick.sheet : sheetOf(who.uid); if (nick) who.name = nick.name; }
    if (!who && bc) bc.postMessage({ uid: 'x', bye: true });
    Presence._write && Presence._write(); ping();
  }

  window.Presence = {
    set(o) {
      const moved = o.hall && o.hall !== mine.hall; Object.assign(mine, o);
      if (moved && db) { write(); listen(); } else if (ref) ref.update({ room: mine.room }).catch(() => {});
      ping();
    },
    // số Phật tử thật đang ở một điện (điện của mình: đếm trực tiếp; điện khác: số đọc gần nhất)
    countIn: h => mode === 'firebase' ? (h === mine.hall ? Object.keys(all).length : counts[h] || 0) : Object.values(all).filter(p => (p.hall | 0) === h).length,
    refreshCounts,
    others: () => Object.values(all).filter(p => !who || p.uid !== who.uid),
    // biệt danh và giới tính do Phật tử tự đặt
    setMe(name, sheet) { nick = { name, sheet }; if (who) { who.name = name; who.sheet = sheet; } Presence._write && Presence._write(); ping(); },
    // quản trị đang ở vai Trụ trì: báo cho mọi máy, để thầy chỉ hiện ở đúng điện quản trị đang ngồi
    // (máy chủ chỉ nhận cờ này từ tài khoản có claim admin)
    setAbbot(on) {
      on = !!on; if (!!mine.abbot === on) return; mine.abbot = on;
      if (ref) ref.child('abbot').set(on || null).catch(() => {});
      ping();
    },
    me: () => who, mode: () => mode
  };
  addEventListener('auth-user', e => identify(e.detail));
  if (window.Auth && Auth.user && Auth.user()) identify(Auth.user());
  tryFirebase();
})();
