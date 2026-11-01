/* Phật tử thật đang có mặt (đăng nhập Gmail / Facebook).
   Có Firebase Realtime Database thì dùng nó (mọi máy thấy nhau); chưa có thì dùng BroadcastChannel (các tab cùng máy).
   window.Presence = { set({hall, room}), others(), mode(), me() }; mỗi lần đổi phát sự kiện 'presence'. */
(() => {
  const DB = 'https://lien-hoa-tinh-vien-default-rtdb.asia-southeast1.firebasedatabase.app';
  const sheetOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h & 1) ? 'nu' : 'nam'; };
  let mine = { hall: 1, room: 'hall' }, nick = null, who = null, mode = 'local', all = {}, ref = null;
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
      const r = await fetch(DB + '/presence.json?shallow=true', { cache: 'no-store' });
      if (!r.ok) return;                                                   // chưa tạo cơ sở dữ liệu → dùng cục bộ
    } catch { return; }
    const db = firebase.app().database(DB);
    db.ref('presence').on('value', s => {
      const v = s.val() || {}, now = Date.now(); all = {};
      for (const k in v) if (v[k] && now - (v[k].t || 0) < 5 * 60e3) all[k] = Object.assign({ uid: k }, v[k]);
      mode = 'firebase'; emit();
    }, () => { mode = 'local'; all = seen; emit(); });
    const write = () => {
      const u = firebase.auth().currentUser;
      if (ref) { ref.remove(); ref = null; }
      if (!u || !who) return;
      ref = db.ref('presence/' + u.uid); ref.onDisconnect().remove();
      ref.set({ name: who.name.slice(0, 40), sheet: who.sheet, hall: mine.hall, room: mine.room, t: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    };
    Presence._write = write; write();
    setInterval(() => ref && ref.update({ t: firebase.database.ServerValue.TIMESTAMP }).catch(() => {}), 60e3);
  }

  function identify(u) {
    const fu = window.firebase && firebase.apps && firebase.apps.length && firebase.auth().currentUser;
    who = u ? { uid: fu ? fu.uid : 'e:' + (u.email || u.name), name: u.name || 'Đạo hữu' } : null;
    if (who) { who.sheet = nick ? nick.sheet : sheetOf(who.uid); if (nick) who.name = nick.name; }
    if (!who && bc) bc.postMessage({ uid: 'x', bye: true });
    Presence._write && Presence._write(); ping();
  }

  window.Presence = {
    set(o) { Object.assign(mine, o); if (ref) ref.update({ hall: mine.hall, room: mine.room }).catch(() => {}); ping(); },
    others: () => Object.values(all).filter(p => !who || p.uid !== who.uid),
    // biệt danh và giới tính do Phật tử tự đặt
    setMe(name, sheet) { nick = { name, sheet }; if (who) { who.name = name; who.sheet = sheet; } Presence._write && Presence._write(); ping(); },
    me: () => who, mode: () => mode
  };
  addEventListener('auth-user', e => identify(e.detail));
  if (window.Auth && Auth.user && Auth.user()) identify(Auth.user());
  tryFirebase();
})();
