/* Liên Hoa Tịnh Viện – chùa online */
(() => {
  const W = 1672, H = 941;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $('#stage'), scene = $('#scene'), fx = $('#fx');

  /* ---------- Lưu trạng thái (an toàn khi bị chặn storage) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('lhtv:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('lhtv:' + k, JSON.stringify(v)); } catch {} }
  };
  const state = {
    role: store.get('role', ''),                 // '' chưa vào · 'guest' khách · 'admin' quản trị
    user: store.get('user', null),
    merit: store.get('merit', 0),
    beads: store.get('beads', 0),
    hall: store.get('hall', 1),
    volume: store.get('volume', 70),
    muted: store.get('muted', false),
    ambient: store.get('ambient', true),
    log: store.get('log', []),
    outside: false
  };
  const save = () => ['role', 'user', 'merit', 'beads', 'hall', 'volume', 'muted', 'ambient', 'log'].forEach(k => store.set(k, state[k]));
  const fmt = n => n.toLocaleString('vi-VN');

  /* ---------- Co giãn sân khấu ---------- */
  /* Chế độ phát live TikTok: ?live=doc (khung dọc 9:16, máy quay theo nhân vật) · ?live=ngang (khung ngang) */
  const LIVE = (() => { const v = (new URLSearchParams(location.search).get('live') || '').toLowerCase();
    return !v ? '' : /^(ngang|16:?9|h)$/.test(v) ? 'ngang' : 'doc'; })();
  if (LIVE) document.body.classList.add('live', 'live-' + LIVE);
  const vp = $('#viewport');
  function fit() {
    const r = LIVE ? vp.getBoundingClientRect() : { width: innerWidth, height: innerHeight };
    // live dọc: phủ kín khung (cắt hai bên); bình thường: vừa khít cả cảnh
    const s = LIVE === 'doc' && !fit.modal ? Math.max(r.width / W, r.height / H) : Math.min(r.width / W, r.height / H);
    stage.style.transform = `translate(${-W * s / 2}px, ${-H * s / 2}px) scale(${s})`;
    stage.dataset.scale = s; fit.visW = Math.min(W, r.width / s); fit.visH = Math.min(H, r.height / s);
    if (typeof applyCam === 'function' && window.LiveHook) applyCam();
  }
  addEventListener('resize', fit); fit();

  /* ---------- Camera ---------- */
  const VIEWS = {
    all: { s: 1, x: W / 2, y: H / 2 },
    buddha: { s: 2.3, x: 300, y: 390 },
    left: { s: 1.6, x: 380, y: 420 },
    right: { s: 1.6, x: 1300, y: 420 },
    door: { s: 2.4, x: 838, y: 420 }
  };
  const cam = { ...VIEWS.all };
  function applyCam() {
    cam.s = Math.max(1, Math.min(3.2, cam.s));
    const hw = (fit.visW || W) / 2 / cam.s, hh = (fit.visH || H) / 2 / cam.s;
    cam.x = Math.max(hw, Math.min(W - hw, cam.x));
    cam.y = Math.max(hh, Math.min(H - hh, cam.y));
    scene.style.transform = `translate(${W / 2 - cam.x * cam.s}px, ${H / 2 - cam.y * cam.s}px) scale(${cam.s})`;
  }
  window.LiveHook = { mode: LIVE, cam, applyCam: () => applyCam(), W, H, setModal: on => { if (fit.modal !== on) { fit.modal = on; fit(); } } };
  function setView(name) {
    Object.assign(cam, VIEWS[name]); applyCam();
    $$('#views [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  }
  $$('#views [data-view]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.view === 'mattien') {                 // toàn cảnh mặt trước chánh điện
      window.Nguoi && Nguoi.go('mat-tien', [836, 905], 'up'); chime(660, .15);
      $$('#views [data-view]').forEach(x => x.classList.toggle('on', x === b)); return;
    }
    if (state.outside) goInside();
    setView(b.dataset.view); chime(660, .15);
  }));
  $('#views-toggle').addEventListener('click', () => $('#views').classList.toggle('closed'));

  /* ---------- Trò chuyện trong cùng phòng ----------
     Tin nhắn theo phòng (chánh điện số mấy + đang đứng ở cảnh nào). Hiện chưa có máy chủ:
     tin được lưu trên máy và chuyển giữa các tab cùng trình duyệt; đạo hữu ảo thỉnh thoảng chào hỏi. */
  const chat = { room: 'hall', bc: null, timer: 0 };
  try { chat.bc = new BroadcastChannel('lhtv-chat'); } catch {}
  const chatKey = () => `chat:${state.hall}:${chat.room}`;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function chatPaint() {
    const list = store.get(chatKey(), []), log = $('#chat-log');
    log.innerHTML = list.length ? list.map(m => `<div class="m ${m.me ? 'me' : ''} ${m.sys ? 'sys' : ''}">${m.sys ? '' : `<b>${esc(m.who)}</b>`}${esc(m.text)}</div>`).join('')
      : '<div class="m sys">Chưa có tin nhắn. Hãy chào đại chúng 🙏</div>';
    log.scrollTop = log.scrollHeight;
  }
  function chatAdd(m, broadcast = true) {
    const k = m.key || chatKey(); const list = store.get(k, []); list.push({ who: m.who, text: m.text, me: m.me, sys: m.sys, t: Date.now() });
    store.set(k, list.slice(-60)); if (k === chatKey()) { chatPaint(); dispatchEvent(new CustomEvent('chua-chat', { detail: { who: m.who, text: m.text, sys: !!m.sys } })); }
    if (state.chatHidden && !m.me && !m.sys) { const b = document.getElementById('chat-show'); b && b.classList.add('new'); }
    if (broadcast && chat.bc) chat.bc.postMessage({ key: k, who: m.who, text: m.text });
  }
  if (chat.bc) chat.bc.onmessage = e => chatAdd({ ...e.data, me: false }, false);
  const BOT = ['Chị Ba Xôi Gấc', 'Anh Ba Khó Ngủ', 'Ni Cô Trà Sữa', 'Bà Tám Chánh Niệm', 'Cô Út Hiền Khô', 'Chú Tư Xe Ôm', 'Thích Ngồi Thiền', 'Bé Su Kem'];
  const BOT_SAY = ['A Di Đà Phật 🙏', 'Chúc đạo hữu một ngày an lạc', 'Hôm nay chùa thanh tịnh quá', 'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật',
    'Mọi người cùng niệm Phật nhé', 'Hương trầm thơm quá', 'Tùy hỷ công đức đạo hữu 🙏', 'Nguyện cho tất cả chúng sinh được bình an'];
  const pick = a => a[Math.random() * a.length | 0];
  function botTalk(reply) {
    if (!window.Nguoi || Nguoi.count() < 2) return;
    chatAdd({ who: pick(BOT), text: reply ? pick(['A Di Đà Phật 🙏', 'Chào đạo hữu 🙏', 'Tùy hỷ, tùy hỷ', 'Cảm ơn đạo hữu, chúc an lạc']) : pick(BOT_SAY), me: false }, false);
  }
  (function ambient() { chat.timer = setTimeout(() => { if (Math.random() < .6) botTalk(false); ambient(); }, 35000 + Math.random() * 50000); })();
  $('#chat-form').addEventListener('submit', e => {
    e.preventDefault(); const inp = $('#chat-in'), text = inp.value.trim(); if (!text) return;
    chatAdd({ who: myName(), text, me: true }); inp.value = ''; inp.blur();
    if (Math.random() < .7) setTimeout(() => botTalk(true), 2500 + Math.random() * 4000);
  });
  $('#chat-toggle').addEventListener('click', () => $('#chat').classList.toggle('closed'));
  // ẩn hẳn khung trò chuyện cho ai không muốn thấy; nút 💬 để hiện lại (có chấm đỏ khi có tin mới)
  function paintChatVis() { $('#chat').classList.toggle('gone', !!state.chatHidden); $('#chat-show').classList.toggle('on', !!state.chatHidden); if (!state.chatHidden) $('#chat-show').classList.remove('new'); }
  $('#chat-hide').addEventListener('click', () => { state.chatHidden = true; save(); paintChatVis(); });
  $('#chat-show').addEventListener('click', () => { state.chatHidden = false; save(); paintChatVis(); });
  paintChatVis();
  function chatRoom(room, name) { chat.room = room; $('#chat-room').textContent = name; chatPaint(); }
  chatRoom('hall', 'Chánh điện ' + state.hall);

  /* ---------- Joystick + bàn phím ---------- */
  const joy = $('#joy'), knob = $('#knob');
  let jv = { x: 0, y: 0 }, dragging = false, raf = 0;
  function joyMove(e) {
    const r = joy.getBoundingClientRect(), sc = r.width / 182;
    let dx = (e.clientX - (r.left + r.width / 2)) / sc, dy = (e.clientY - (r.top + r.height / 2)) / sc;
    const d = Math.hypot(dx, dy), max = 56;
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    jv = { x: dx / max, y: dy / max };
  }
  joy.addEventListener('pointerdown', e => {
    dragging = true; joy.setPointerCapture(e.pointerId); knob.classList.remove('back');
    scene.classList.add('drag'); joyMove(e); loop();
  });
  joy.addEventListener('pointermove', e => dragging && joyMove(e));
  const joyEnd = () => { dragging = false; jv = { x: 0, y: 0 }; knob.classList.add('back'); knob.style.transform = ''; scene.classList.remove('drag'); };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  function loop() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!dragging && !keys.size) { scene.classList.remove('drag'); window.Nguoi && Nguoi.drive(0, 0); window.Dien3D && Dien3D.drive(0, 0); return; }
      let x = jv.x, y = jv.y;
      if (keys.has('l')) x -= 1; if (keys.has('r')) x += 1; if (keys.has('u')) y -= 1; if (keys.has('d')) y += 1;
      if (window.Dien3D && Dien3D.active()) {   // mặt sau: tiến lên / lùi lại giữa điện
        Dien3D.drive(x, y);
      } else if (window.Nguoi) {               // joystick điều khiển nhân vật "Bạn" đi khắp chùa
        const m = Math.hypot(x, y); Nguoi.drive(m > 1 ? x / m : x, m > 1 ? y / m : y);
      } else {                                 // dự phòng: di chuyển camera
        cam.s *= 1 - y * 0.012; cam.x += x * 9 / cam.s;
        if (cam.s > 1.05) cam.y += -y * 1.5 / cam.s * (420 - cam.y) / 100;
        applyCam(); $$('#views [data-view]').forEach(b => b.classList.remove('on'));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  const keys = new Set();
  const KEYMAP = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'u', w: 'u', ArrowDown: 'd', s: 'd' };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || !$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    const k = KEYMAP[e.key]; if (!k) return;
    e.preventDefault(); if (!keys.size && !dragging) { scene.classList.add('drag'); keys.add(k); loop(); } else keys.add(k);
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) keys.delete(k); });

  /* ---------- Âm thanh (Web Audio, không cần file) ---------- */
  let ac, master, droneNodes = null, chantTimer = 0;
  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.connect(ac.destination); setGain();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function setGain() { if (master) master.gain.value = state.muted ? 0 : (state.volume / 100) ** 1.6 * 0.9; }
  function chime(freq = 520, len = 3.5, vol = .5) {
    const a = audio(), t = a.currentTime;
    [1, 2.76, 5.4, 8.9].forEach((m, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = freq * m; o.type = 'sine';
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol / (i * 1.8 + 1), t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + len / (i * .7 + 1));
      o.connect(g).connect(master); o.start(t); o.stop(t + len);
    });
  }
  const bell = () => chime(196, 7, .7);        // chuông lớn
  // Trống lớn: tiếng "tùng" trầm, dội (sóng sin tụt cao độ + tiếng da trống)
  function drum(vol = 1) {
    const a = audio(), t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .45);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
    o.connect(g).connect(master); o.start(t); o.stop(t + 1.7);
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'triangle'; o2.frequency.setValueAtTime(190, t); o2.frequency.exponentialRampToValueAtTime(90, t + .2);
    g2.gain.setValueAtTime(vol * .35, t); g2.gain.exponentialRampToValueAtTime(.001, t + .35);
    o2.connect(g2).connect(master); o2.start(t); o2.stop(t + .4);
    const n = a.createBufferSource(), b = a.createBuffer(1, a.sampleRate * .12, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const gn = a.createGain(); gn.gain.value = vol * .5; n.buffer = b; n.connect(lp).connect(gn).connect(master); n.start(t);
  }
  // Chuông đồng lớn: tiếng "boong" ngân dài, có độ rung
  function bigBell(vol = .75) {
    const a = audio(), t = a.currentTime;
    [[1, 1], [2.0, .5], [2.4, .35], [3.0, .25], [4.2, .15], [.5, .4]].forEach(([m, k], i) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 130 * m * (1 + (i % 2 ? .003 : -.002));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * k, t + .008);
      g.gain.exponentialRampToValueAtTime(.0001, t + 9 / (1 + i * .5));
      o.connect(g).connect(master); o.start(t); o.stop(t + 9.5);
    });
  }
  // Đánh theo nhịp: âm thanh và chữ cùng một nhịp
  const striking = {};
  function strike(kind) {
    if (striking[kind]) return false; striking[kind] = true;
    const T = kind === 'trong' ? { gap: 850, n: 3, word: 'Tùng!', snd: drum, x: 848, y: 430 } : { gap: 2400, n: 3, word: 'Boong…', snd: bigBell, x: 832, y: 520 };
    Nguoi.faceUp(T.n * T.gap + 800);
    for (let i = 0; i < T.n; i++) setTimeout(() => { T.snd(); floatText(T.word, T.x + (i - 1) * 70, T.y, true); }, i * T.gap);
    setTimeout(() => striking[kind] = false, T.n * T.gap);
    return true;
  }
  const mo = () => {                            // tiếng mõ
    const a = audio(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(380, t + .08);
    g.gain.setValueAtTime(.8, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
    o.connect(g).connect(master); o.start(t); o.stop(t + .2);
  };
  function drone(on) {
    if (on && !droneNodes) {
      const a = audio(), g = a.createGain(); g.gain.value = 0; g.connect(master);
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.connect(g);
      const os = [110, 165, 220.5, 277].map((f, i) => { const o = a.createOscillator(); o.type = i ? 'sine' : 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
      g.gain.linearRampToValueAtTime(.12, a.currentTime + 2);
      droneNodes = { g, os };
    } else if (!on && droneNodes) {
      const { g, os } = droneNodes, t = ac.currentTime; g.gain.linearRampToValueAtTime(0, t + 1.2);
      os.forEach(o => o.stop(t + 1.3)); droneNodes = null;
    }
  }
  const volEl = $('#vol');
  const paintVol = () => { volEl.style.setProperty('--p', volEl.value + '%'); $('#mute use').setAttribute('href', state.muted || +volEl.value === 0 ? '#i-mute' : '#i-volume'); };
  volEl.value = state.volume; paintVol();
  volEl.addEventListener('input', () => { state.volume = +volEl.value; state.muted = false; setGain(); paintVol(); save(); });
  $('#mute').addEventListener('click', () => { state.muted = !state.muted; audio(); setGain(); paintVol(); save(); });

  /* ---------- Hiệu ứng ---------- */
  function floatText(text, x = 843, y = 560, sm = false) {
    const el = document.createElement('div'); el.className = 'float' + (sm ? ' sm' : '');
    el.textContent = text;
    // đổi toạ độ cảnh -> toạ độ màn hình theo camera hiện tại
    const sx = W / 2 + (x - cam.x) * cam.s, sy = H / 2 + (y - cam.y) * cam.s;
    el.style.left = Math.max(160, Math.min(W - 160, sx)) + 'px';
    el.style.top = Math.max(110, Math.min(760, sy)) + 'px';
    fx.appendChild(el); setTimeout(() => el.remove(), 2700);
  }
  function smoke(src, n = 1, big = 1) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div'); p.className = 'puff';
      p.style.setProperty('--x', (Math.random() * 60 - 30) * big + 'px');
      p.style.setProperty('--y', -(120 + Math.random() * 120) * big + 'px');
      p.style.setProperty('--sc', 2.5 + Math.random() * 2 * big);
      p.style.setProperty('--d', 3 + Math.random() * 2.5 + 's');
      p.style.left = (Math.random() * 24 - 22) + 'px';
      src.appendChild(p); setTimeout(() => p.remove(), 6000);
    }
  }
  let incenseBoost = 0;
  setInterval(() => {
    smoke($('#smoke-yard'), 1, .45);
    smoke($('#smoke-big'), incenseBoost > 0 ? 3 : 1, incenseBoost > 0 ? 1.3 : .8);
    if (incenseBoost > 0) incenseBoost--;
  }, 420);
  function petals(n = 18) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div'); p.className = 'petal';
      p.style.left = Math.random() * W + 'px'; p.style.top = -30 - Math.random() * 200 + 'px';
      p.style.setProperty('--x', Math.random() * 200 - 100 + 'px'); p.style.setProperty('--d', 5 + Math.random() * 4 + 's');
      fx.appendChild(p); setTimeout(() => p.remove(), 9500);
    }
  }
  let toastT;
  function toast(msg, ms = 2400) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    dispatchEvent(new CustomEvent('chua-toast', { detail: msg }));
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
  const status = (msg) => { const s = $('#status'); if (msg) { s.textContent = msg; s.hidden = false; } else s.hidden = true; };

  /* ---------- Công đức / ví ---------- */
  function addMerit(n, why) {
    state.merit += n; logIt(why, n); save();
    floatText(`+${n} công đức`, 843 + (Math.random() * 120 - 60), 520, true);
  }
  function logIt(text, merit = 0) {
    state.log.unshift({ t: Date.now(), text, merit }); state.log = state.log.slice(0, 60); save();
  }
  // Quyền quản trị = custom claim đã ký trong ID token (máy chủ cấp), KHÔNG dựa vào localStorage hay email
  const isAdmin = () => state.role === 'admin' && !!window.Vi && Vi.isAdmin();
  const xu = () => window.Vi ? Vi.balance() : 0;
  const GIA = () => Object.assign({ incense: 50, flower: 150, rename: 20 }, window.Vi && Vi.prices());
  const GIA_HUONG = 50;                                                   // chỉ để hiển thị khi chưa tải giá từ máy chủ
  const xuText = () => isAdmin() ? '∞' : fmt(xu());
  const paintWallet = () => { $('#wallet').textContent = xuText(); };
  paintWallet();
  const needLogin = what => { toast(`Mời đạo hữu đăng nhập Gmail hoặc Facebook để ${what} 🙏`); showLogin(); };
  addEventListener('vi-change', () => {
    paintWallet(); const vb = $('#v-bal'); if (vb) vb.textContent = xuText() + ' xu';
    // vai Quản trị chỉ giữ được khi máy chủ xác nhận claim admin
    if (state.role === 'admin' && window.Vi && Vi.signedIn() && !Vi.isAdmin()) { state.role = 'guest'; save(); window.Nguoi && Nguoi.abbotLeave(); }
    const p = window.Vi && Vi.profile();
    if (p && p.nick && (!state.nick || state.nick.name !== p.nick || state.nick.sex !== p.sex)) { state.nick = { name: p.nick, sex: p.sex, t: p.nickAt || 0 }; store.set(nickKey(), state.nick); applyNick(); }
    if (window.Vi && Vi.signedIn() && Vi.online() && p && !p.nick && state.role && !isAdmin() && !$('#nick-in')) nickModal(true);
    paintRole();
  });

  /* ---------- Hành động ---------- */
  const aura = $('#me-aura');
  let current = null, thienTimer = 0, thienStart = 0;
  function stopContinuous() {
    clearInterval(chantTimer); chantTimer = 0; clearInterval(thienTimer); thienTimer = 0;
    drone(false); window.Nguoi && Nguoi.meditate(false); $('#vignette').classList.remove('on'); aura.classList.remove('on'); status('');
    $$('#actions button').forEach(b => b.classList.remove('on')); current = null;
  }
  const ACTIONS = {
    chaptay() { chime(880, 2, .25); window.Nguoi && Nguoi.bow('ban', .3, 700); aura.classList.add('on'); setTimeout(() => current || aura.classList.remove('on'), 2200); floatText('🙏 A Di Đà Phật'); addMerit(1, 'Chắp tay'); },
    cuichao() { chime(740, 2, .25); window.Nguoi && Nguoi.bow('ban', .8, 1300); floatText('Cúi chào đại chúng'); addMerit(1, 'Cúi chào'); },
    layphat() {
      if (window.Nguoi && Nguoi.abbotHere && Nguoi.abbotHere()) { Nguoi.layPhat(); chime(740, 2, .25); toast('Thầy trụ trì đang ngồi giữa điện, đại chúng ngồi yên chắp tay cúi đầu 🙏'); floatText('🙏 Nam Mô A Di Đà Phật'); return; }
      bell(); window.Nguoi && Nguoi.layPhat(3); window.Dien3D && Dien3D.bow(); aura.classList.add('on'); setTimeout(() => current || aura.classList.remove('on'), 7000);
      floatText('Kính lạy Bổn Sư Thích Ca Mâu Ni Phật'); addMerit(3, 'Lạy Phật'); petals(14);
    },
    niemphat: { toggle: true, start() {
      let i = 0; const words = ['Nam Mô', 'A Di Đà', 'Phật'];
      aura.classList.add('on'); status('Đang niệm Phật · Nam Mô A Di Đà Phật');
      const tick = () => { mo(); window.Nguoi && Nguoi.beat(); floatText(words[i % 3], 843 + (i % 3 - 1) * 90, 545, true); if (i % 3 === 2) addMerit(1, 'Niệm Phật'); i++; };
      tick(); chantTimer = setInterval(tick, 900);
    } },
    thien: { toggle: true, start() {
      $('#vignette').classList.add('on'); aura.classList.add('on'); bell(); thienStart = Date.now(); window.Nguoi && Nguoi.meditate(true);
      const upd = () => { const s = Math.floor((Date.now() - thienStart) / 1000); status(`Đang thiền · ${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} · hít thở nhẹ nhàng`); if (s && s % 60 === 0) addMerit(5, 'Thiền 1 phút'); };
      upd(); thienTimer = setInterval(upd, 1000);
    } },
    nghekinh: { toggle: true, start() {
      drone(true); status('Đang nghe kinh · Kinh A Di Đà');
      const lines = ['Như thị ngã văn', 'Nhất thời Phật tại Xá Vệ quốc', 'Kỳ Thọ Cấp Cô Độc viên', 'Tây phương Cực Lạc thế giới', 'Nam Mô A Di Đà Phật'];
      let i = 0; const tick = () => { floatText(lines[i++ % lines.length], 843, 470, true); if (i % 5 === 0) addMerit(2, 'Nghe kinh'); };
      tick(); chantTimer = setInterval(tick, 3200);
    } },
    chuoihat() {
      state.beads = (state.beads % 108) + 1; mo(); window.Nguoi && Nguoi.bow('ban', .22, 300);
      floatText(`📿 ${state.beads} / 108`, 843, 540, true);
      if (state.beads === 108) { bell(); petals(24); addMerit(10, 'Tròn một chuỗi 108 hạt'); toast('Viên mãn một chuỗi 108 hạt 🙏'); }
      save();
    },
    async thaphuong() {
      if (window.Nguoi && !(window.Dien3D && Dien3D.active())) {
        if (Nguoi.abbotHere && Nguoi.abbotHere()) { toast('Thầy trụ trì đang ngồi giữa điện, xin thắp hương sau khi thầy rời điện 🙏'); return; }
        const ci = Nguoi.canIncense(); if (ci !== true) { if (ci === 'nourn') toast('Hãy đi đến chỗ có lư hương (trong chánh điện, cửa điện, sân hoặc mặt tiền) để thắp hương'); return; }
      }
      if (!window.Vi || !Vi.signedIn()) return needLogin('thắp hương');
      if (thapBusy) return; thapBusy = true;
      let paid;
      try { paid = await Vi.spend('incense'); }
      catch (e) { thapBusy = false; toast(e.message); if (/đủ xu/.test(e.message)) PANELS.wallet(true); return; }
      thapBusy = false;
      if (window.Dien3D && Dien3D.active()) {
        Dien3D.incense(); addMerit(2, 'Thắp hương'); floatText('Nguyện hương thơm lan khắp mười phương', 843, 560, true);
      } else if (window.Nguoi) {
        floatText('Thắp nén tâm hương', 843, 520, true);
        const ok = await Nguoi.incense();
        if (ok === false || ok === 'abbot') { Vi.refund(paid.opId).then(() => toast('Chưa thắp được hương, đã hoàn xu')).catch(() => {}); return; }
      } else { incenseBoost = 18; addMerit(2, 'Thắp hương'); }
      if (paid.cost) toast(`Đã cúng dường ${fmt(paid.cost)} xu thắp hương 🙏`);
      chime(1040, 2.5, .2);
    },
    async danghoa() {
      // mỗi bông hoa cúng dường theo giá máy chủ (mặc định 150 xu); trừ xu ở máy chủ, dâng không thành thì máy chủ hoàn lại
      if (window.Nguoi && !(window.Dien3D && Dien3D.active())) {
        const ok = Nguoi.canFlower();
        if (ok === 'abbot') { toast('Thầy trụ trì đang ngồi giữa điện, xin dâng hoa sau khi thầy rời điện 🙏'); return; }
        if (ok === 'novase') { toast('Hãy vào chánh điện để dâng hoa lên bàn thờ Phật'); return; }
        if (ok !== true) return;
      }
      if (!window.Vi || !Vi.signedIn()) return needLogin('dâng hoa');
      if (thapBusy) return; thapBusy = true;
      let paid;
      try { paid = await Vi.spend('flower'); }
      catch (err) { thapBusy = false; toast(err.message); if (/đủ xu/.test(err.message)) PANELS.wallet(true); return; }
      thapBusy = false;
      if (window.Dien3D && Dien3D.active()) { Dien3D.flower(); floatText('Nguyện hoa tâm thanh tịnh dâng lên chư Phật', 843, 560, true); }
      else if (window.Nguoi) {
        floatText('Dâng hoa cúng Phật', 843, 520, true);
        const r = await Nguoi.flower();
        if (!r) { Vi.refund(paid.opId).then(() => toast('Chưa dâng được hoa, đã hoàn xu')).catch(() => {}); return; }
      }
      addMerit(3, 'Dâng hoa');
      if (paid.cost) toast(`Đã cúng dường ${fmt(paid.cost)} xu dâng hoa 🙏`);
      chime(1180, 2.5, .2);
    },
    rangoai() { state.outside ? goInside() : goOutside(); }
  };
  $$('#actions button').forEach(b => b.addEventListener('click', () => {
    audio();
    const name = b.dataset.act, a = ACTIONS[name];
    if (a.toggle) {
      const was = current === name; stopContinuous();
      if (!was) { current = name; b.classList.add('on'); a.start(); logIt(b.textContent.trim()); }
    } else a();
  }));

  const busyIncense = () => false;
  let thapBusy = false;
  function goOutside() { stopContinuous(); window.Nguoi && Nguoi.go('cua'); }
  function goInside() { window.Nguoi && Nguoi.go('hall'); }
  addEventListener('chua-room', e => {
    const { room, name } = e.detail;
    if (room !== 'hall') window.Dien3D && Dien3D.hide();
    state.outside = room !== 'hall';
    scene.classList.toggle('outside', state.outside);
    $('#exit-label').textContent = state.outside ? 'Vào trong' : 'Ra ngoài';
    if (state.outside) { Object.assign(cam, VIEWS.all); applyCam(); $$('#views [data-view]').forEach(b => b.classList.remove('on')); }
    else setView('all');
    toast(name); logIt('Đến ' + name); chime(660, .3, .15);
    chatRoom(room, room === 'hall' ? 'Chánh điện ' + state.hall : name);
  });
  // lối chưa mở (Đường làng, Vườn Thiền…): báo đang xây, mời góp ý; chỉ hiện bảng một lần mỗi lối, lần sau nhắc ngắn
  const soonSeen = new Set();
  addEventListener('chua-soon', e => {
    const name = e.detail;
    if (soonSeen.has(name) || !modal.hidden) { toast(`${name}: khu vực đang được xây dựng 🙏`); return; }
    soonSeen.add(name);
    openModal('Khu vực đang được xây dựng', `<p><b>${esc(name)}</b> đang được xây dựng.</p>
      <p>Vui lòng góp ý cho nhà chùa để khu vực này sớm hoàn thiện 🙏</p>
      <p class="note">Đạo hữu có thể nhắn góp ý trong khung Trò chuyện.</p>
      <button class="btn" id="soon-ok">Quay lại</button>`, body => $('#soon-ok', body).addEventListener('click', closeModal));
  });
  addEventListener('chua-huong', e => { if (e.detail.me) { addMerit(2, 'Thắp hương'); floatText('Nguyện hương thơm lan khắp mười phương', 843, 560, true); chime(1040, 2.5, .2); } else incenseBoost = 6; });
  addEventListener('chua-act', e => {
    const kind = e.detail;
    if (kind === 'chuong' && strike('chuong')) { setTimeout(() => floatText('Nguyện tiếng chuông này vang khắp pháp giới'), 600); addMerit(2, 'Thỉnh chuông'); }
    if (kind === 'trong' && strike('trong')) addMerit(1, 'Đánh trống');
    if (kind === 'quanam') { chime(880, 3, .3); Nguoi.layPhat(1); floatText('Nam Mô Đại Từ Đại Bi Quán Thế Âm Bồ Tát'); addMerit(3, 'Chiêm bái Quan Âm'); petals(12); }
  });
  addEventListener('chua-count', () => paintHall());

  /* ---------- Chánh điện / số người ---------- */
  // 20 chánh điện, quy tắc như nhau: mỗi Phật tử thật vào thì 2 Phật tử ảo đi ra; đủ chỗ thì báo đầy
  const N_HALLS = 20;
  const cap = () => window.Nguoi && Nguoi.cap ? Nguoi.cap() : 100;
  const hallN = id => window.Nguoi && Nguoi.hallCount ? Nguoi.hallCount(id) : 0;
  const halls = Array.from({ length: N_HALLS }, (_, i) => ({ id: i + 1, get n() { return hallN(i + 1); } }));
  const fullOf = id => window.Nguoi && Nguoi.isFull ? Nguoi.isFull(id) : false;
  function paintHall() {
    const h = halls[state.hall - 1];
    $('#hall-name').textContent = `Chánh điện ${h.id}`; $('#info-hall').textContent = `Chánh điện ${h.id}`;
    $('#online').textContent = h.n; $('#info-online').textContent = h.n; $$('.cap').forEach(e => e.textContent = cap());
  }
  paintHall();
  window.Nguoi && Nguoi.setHall && Nguoi.setHall(state.hall); window.Presence && Presence.set({ hall: state.hall });
  let checkedFull = false;
  addEventListener('presence', () => setTimeout(() => {
    paintHall();
    // vừa vào web mà điện mình chọn đã đủ người thật → báo đầy, mời sang điện khác
    if (!checkedFull && window.Nguoi && Nguoi.realsIn) { checkedFull = true; const old = state.hall; if (Nguoi.realsIn(old) >= cap()) { const alt = emptiest(old); if (alt) { joinHall(alt.id); toast(`Chánh điện ${old} đã đầy, mời đạo hữu sang Chánh điện ${alt.id}`); } } }
  }, 0));
  const hallLabel = h => fullOf(h.id) ? `${cap()}/${cap()} · đầy` : `${h.n}/${cap()}`;
  const emptiest = except => halls.filter(h => h.id !== except && !fullOf(h.id)).sort((a, b) => a.n - b.n)[0];
  const hallMenu = $('#hall-menu'), bellMenu = $('#bell-menu');
  function openHallMenu() {
    window.Presence && Presence.refreshCounts && Presence.refreshCounts();
    hallMenu.innerHTML = halls.map(h => `<button data-h="${h.id}" class="${h.id === state.hall ? 'on' : ''}">Chánh điện ${h.id}<small>${hallLabel(h)}</small></button>`).join('');
    hallMenu.style.left = '622px'; hallMenu.hidden = false; bellMenu.hidden = true;
  }
  $('#hall-btn').addEventListener('click', e => { e.stopPropagation(); hallMenu.hidden ? openHallMenu() : (hallMenu.hidden = true); });
  hallMenu.addEventListener('click', e => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    joinHall(+b.dataset.h); hallMenu.hidden = true;
  });
  function hallFull(id) {
    const alt = emptiest(id);
    openModal(`Chánh điện ${id} đã đầy`, `<p>Chánh điện ${id} đã đủ ${cap()}/${cap()} Phật tử, không còn chỗ ngồi.</p>
      ${alt ? `<p>Mời đạo hữu sang <b>Chánh điện ${alt.id}</b> (đang có ${alt.n}/${cap()} người).</p><button class="btn" id="go-alt">Sang Chánh điện ${alt.id}</button>` : '<p>Tất cả các điện đều đã đầy, mời đạo hữu quay lại sau.</p>'}`,
      body => { const b = $('#go-alt', body); if (b) b.addEventListener('click', () => { closeModal(); joinHall(alt.id); }); });
    toast(`Chánh điện ${id} đã đầy`);
  }
  function joinHall(id) {
    if (fullOf(id)) return hallFull(id);
    state.hall = id; save(); window.Nguoi && Nguoi.setHall && Nguoi.setHall(id); window.Presence && Presence.set({ hall: id }); paintHall(); setView('all'); chime(523, 2.5, .3);
    if (isAdmin() && window.Nguoi) { Nguoi.abbotLeave(); if (Nguoi.room() === 'hall') Nguoi.abbotEnter(); else Nguoi.go('hall'); }
    toast(`Đã vào Chánh điện ${id}`); chatRoom(chat.room, chat.room === 'hall' ? 'Chánh điện ' + id : $('#chat-room').textContent);
  }
  // Thông báo do quản trị đăng
  const getNotes = () => store.get('notes', [{ text: 'Chào mừng đạo hữu đến Liên Hoa Tịnh Viện 🙏', t: Date.now() }]);
  const paintBellDot = () => $('#bell-dot').classList.toggle('off', (getNotes()[0] || {}).t <= store.get('notesSeen', 0));
  paintBellDot();
  $('#bell-btn').addEventListener('click', e => {
    e.stopPropagation(); bell();
    const ns = getNotes();
    bellMenu.innerHTML = (ns.length ? ns.map(n => `<div class="item">${esc(n.text)}<small>${new Date(n.t).toLocaleDateString('vi-VN')}</small></div>`).join('') : '<div class="item">Chưa có thông báo</div>')
      + (isAdmin() ? '<button id="note-new">＋ Đăng thông báo mới</button>' : '');
    const nb = $('#note-new', bellMenu); if (nb) nb.addEventListener('click', ev => { ev.stopPropagation(); bellMenu.hidden = true; adminPanel(); });
    store.set('notesSeen', Date.now());
    bellMenu.style.left = '1340px'; bellMenu.style.minWidth = '320px'; bellMenu.hidden = !bellMenu.hidden; hallMenu.hidden = true;
    paintBellDot();
  });
  document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) { hallMenu.hidden = true; bellMenu.hidden = true; } });

  /* ---------- Modal ---------- */
  const modal = $('#modal');
  function openModal(title, html, bind) {
    $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; modal.hidden = false; bind && bind($('#modal-body'));
  }
  function closeModal() { modal.hidden = true; }
  modal.addEventListener('click', e => { if (nickRequired) return; if (e.target === modal || e.target.closest('.close')) closeModal(); });

  const PANELS = {
    rooms() {
      window.Presence && Presence.refreshCounts && Presence.refreshCounts();
      openModal(N_HALLS + ' chánh điện', `<div class="grid">${halls.map(h => `<button data-h="${h.id}" class="${h.id === state.hall ? 'on' : ''}">Điện ${h.id}<small>${hallLabel(h)} người</small></button>`).join('')}</div>`,
        body => body.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { joinHall(+b.dataset.h); closeModal(); } }));
    },
    hall() { closeModal(); setView('all'); if (state.outside) goInside(); },
    wallet(open) {
      if (isAdmin()) return openModal('Ví xu', '<p>Số dư</p><p class="big">∞ xu</p><p class="note">Tài khoản chủ chùa không mất xu. Doanh thu và đối soát xem ở trang Quản trị.</p><a class="btn nap" href="quan-tri.html" target="_blank" rel="noopener">Mở trang Quản trị</a>');
      if (!window.Vi || !Vi.signedIn()) return openModal('Ví xu', '<p>Ví xu gắn với tài khoản, dùng được trên mọi máy.</p><p class="note">Đạo hữu vẫn tham quan miễn phí. Muốn nạp xu, thắp hương hay cúng dường, mời đăng nhập.</p><button class="btn nap" id="v-login">Đăng nhập Gmail / Facebook</button>',
        body => $('#v-login', body).addEventListener('click', () => { closeModal(); showLogin(); }));
      const packs = Vi.packs();
      openModal('Ví xu', `<p>Số dư</p><p class="big" id="v-bal">${xuText()} xu</p>
        <p class="note">Thắp hương (3 nén) ${GIA().incense} xu · dâng hoa ${GIA().flower} xu một bông. Xu chỉ dùng trong chùa, không đổi lại thành tiền.</p>
        <button class="btn nap" id="nap-btn"${open ? ' hidden' : ''}>＋ Nạp xu</button>
        <div id="packs"${open ? '' : ' hidden'}>${packs.length ? `<p>Chọn gói nạp:</p>
          <div class="grid">${packs.map(p => `<button data-pack="${esc(p.id)}"><b>${fmt(p.xu)} xu</b><small>${fmt(p.vnd)} đ</small></button>`).join('')}</div>` : '<p class="note">Máy chủ nạp xu chưa sẵn sàng, xin quay lại sau.</p>'}</div>
        <div id="pay" hidden></div>`,
        body => {
          let stop = null, timer = null;
          const clean = () => { stop && stop(); clearInterval(timer); };
          new MutationObserver((m, o) => { if (modal.hidden) { clean(); o.disconnect(); } }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
          body.addEventListener('click', async e => {
            if (e.target.closest('#nap-btn')) { $('#nap-btn', body).hidden = true; $('#packs', body).hidden = false; return; }
            const b = e.target.closest('[data-pack]');
            if (b) {
              const pay = $('#pay', body); pay.hidden = false; pay.innerHTML = '<p class="note">Đang tạo đơn nạp…</p>';
              let o; try { o = await Vi.createTopup(b.dataset.pack); } catch (err) { pay.innerHTML = `<p class="note">${esc(err.message)}</p>`; return; }
              $('#packs', body).hidden = true; clean();
              // chỉ hiện mã QR của đơn (mỗi đơn một mã riêng của payOS, đúng số tiền); dòng trạng thái chỉ hiện khi có kết quả
              pay.innerHTML = `<img class="qr" src="${esc(o.qrUrl)}" alt="Mã QR chuyển khoản">
                <p id="o-st"></p><span id="o-left" hidden></span><button class="btn nap" id="o-cancel" hidden>Huỷ đơn</button>`;
              timer = setInterval(() => { const l = o.expiresAt - Date.now(), el = $('#o-left', body); if (el) el.textContent = l > 0 ? `(còn ${Math.floor(l / 60e3)}:${String(Math.floor(l % 60e3 / 1e3)).padStart(2, '0')})` : '(đơn đã hết hạn)'; }, 1000);
              stop = Vi.watchOrder(o.orderId, d => {
                const st = $('#o-st', body); if (!st) return;
                if (d.status === 'PAID') { clean(); st.innerHTML = `<b>Nạp xu thành công +${fmt(d.xu)} xu 🙏</b>`; $('#o-cancel', body).hidden = true; bell(); petals(16); toast(`Nạp xu thành công +${fmt(d.xu)} xu`); logIt(`Nạp ${fmt(d.xu)} xu`); }
                else if (d.status === 'REVIEW') st.textContent = 'Đã nhận giao dịch nhưng cần nhà chùa đối soát (sai số tiền hoặc trễ hạn). Xu sẽ được xử lý sớm.';
                else if (d.status === 'EXPIRED') st.textContent = 'Đơn đã hết hạn. Nếu đã chuyển tiền, nhà chùa sẽ đối soát và xử lý.';
                else if (d.status === 'CANCELLED') st.textContent = 'Đã huỷ đơn.';
              });
              $('#o-cancel', body).addEventListener('click', async () => { try { await Vi.cancelTopup(o.orderId); } catch (err) { toast(err.message); } });
            }
          });
        });
    },
    merit() {
      const of = GIA().offers || { sen: { xu: 200, name: 'Cúng hoa sen' }, den: { xu: 500, name: 'Cúng đèn' }, tambao: { xu: 1000, name: 'Cúng dường Tam Bảo' }, kinh: { xu: 2000, name: 'Ấn tống kinh' } };
      const opts = Object.entries(of).map(([k, o]) => [o.xu, o.name, k]);
      openModal('Công đức', `<p>Công đức tích lũy</p><p class="big" id="m-pt">${fmt(state.merit)}</p>
        <p>Cúng dường bằng xu (đang có ${xuText()} xu):</p>
        <div class="grid">${opts.map(([v, t, k]) => `<button data-v="${v}" data-t="${esc(t)}" data-k="${esc(k)}">${esc(t)}<small>${fmt(v)} xu</small></button>`).join('')}</div>`,
        body => body.addEventListener('click', async e => { const b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
          const v = +b.dataset.v;
          if (!window.Vi || !Vi.signedIn()) { closeModal(); return needLogin('cúng dường'); }
          b.disabled = true;
          try { await Vi.spend('offer', { item: b.dataset.k }); }
          catch (err) { b.disabled = false; toast(err.message); if (/đủ xu/.test(err.message)) PANELS.wallet(true); return; } addMerit(Math.round(v / 100), b.dataset.t); bell(); petals(20);
          $('#m-pt', body).textContent = fmt(state.merit); closeModal(); toast(`Tùy hỷ công đức: ${b.dataset.t} 🙏`); }));
    },
    async book() {
      let xuRows = '';
      if (window.Vi && Vi.signedIn()) {
        try { const L = await Vi.ledger(30); const T = { TOPUP: 'Nạp xu', TOPUP_MANUAL: 'Nạp xu (đối soát)', SPEND: 'Dùng xu', ADJUST: 'Điều chỉnh', REFUND: 'Hoàn xu' };
          xuRows = `<h3>Lịch sử xu</h3><ul>${L.map(x => `<li><span>${T[x.type] || x.type}${x.reason ? ' · ' + esc(x.reason) : ''} <b>${x.xu > 0 ? '+' : ''}${fmt(x.xu)}</b></span><small>${new Date(x.at).toLocaleString('vi-VN')}</small></li>`).join('') || '<li>Chưa có.</li>'}</ul>`; } catch {}
      }
      const items = state.log.length ? state.log.map(l => `<li><span>${l.text}${l.merit ? ` <small>+${l.merit}</small>` : ''}</span><small>${new Date(l.t).toLocaleString('vi-VN')}</small></li>`).join('') : '<li>Chưa có ghi chép. Hãy chắp tay, niệm Phật hay thắp hương.</li>';
      openModal('Sổ tu tập', `<p>Chuỗi hạt: <b>${state.beads}/108</b> · Công đức: <b>${fmt(state.merit)}</b></p>${xuRows}<h3>Tu tập</h3><ul>${items}</ul>`);
    }
  };
  $$('[data-open]').forEach(b => b.addEventListener('click', () => {
    if (b.closest('#nav')) { $$('#nav button').forEach(x => x.classList.toggle('on', x === b)); }
    PANELS[b.dataset.open]();
  }));
  $('#topup') && $('#topup').addEventListener('click', () => PANELS.wallet(true));
  modal.addEventListener('transitionend', () => {});
  const navReset = new MutationObserver(() => { if (modal.hidden) $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.open === 'hall')); });
  navReset.observe(modal, { attributes: true, attributeFilter: ['hidden'] });

  $('#gear').addEventListener('click', () => {
    openModal('Cài đặt', `<label><input type="checkbox" id="s-amb" ${state.ambient ? 'checked' : ''}> Chuông chào khi vào điện</label>
      <p style="opacity:.8;font-size:17px">Điều khiển: joystick hoặc phím mũi tên / WASD đưa nhân vật “Bạn” đi khắp chùa. Đi qua cửa chính, cửa hông hay ra mép cảnh là sang khu kế bên. Đứng yên trên một thảm trống thì Bạn tự ngồi xuống.</p>
      <div class="admin-only"><h3 style="margin:14px 0 6px">Quản trị · Phật tử ảo</h3>
      <p style="margin:0 0 8px">Đang có <b id="a-n">${window.Nguoi ? Nguoi.ao() : 0}</b> / ${window.Nguoi ? Nguoi.maxAo() : 0} Phật tử ảo trong chánh điện. Họ vẫn đứng dậy, đi lại, thắp hương và quỳ lạy như mọi người.</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <button data-ao="-10">− 10</button><button data-ao="-1">− 1</button><button data-ao="1">+ 1</button><button data-ao="10">+ 10</button>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:8px"><button id="a-lay">Mời đại chúng lạy Phật</button><button id="a-full">Đầy chánh điện</button></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:8px"><a class="btn" href="quan-tri.html" target="_blank" rel="noopener" style="text-align:center">Trang Quản trị (doanh thu, đối soát)</a><button id="a-panel">Thông báo</button></div></div>`,
      body => {
        $('#s-amb', body).addEventListener('change', e => { state.ambient = e.target.checked; save(); });
        const upd = n => { $('#a-n', body).textContent = n; paintHall(); };
        $$('[data-ao]', body).forEach(b => b.addEventListener('click', () => upd(Nguoi.setAo(Nguoi.ao() + +b.dataset.ao))));
        $('#a-full', body).addEventListener('click', () => upd(Nguoi.setAo(Nguoi.maxAo())));
        $('#a-panel', body).addEventListener('click', () => adminPanel('notes'));
        $('#a-lay', body).addEventListener('click', () => { closeModal(); bell(); Nguoi.allLay(); floatText('Đại chúng đồng lạy Phật'); });
      });
  });

  /* ---------- Quản trị: thông báo, mã QR, sổ công đức ---------- */
  function adminPanel() {
    if (!isAdmin()) return;
    openModal('Thông báo', `<p class="note">Doanh thu, ví xu, gói nạp, tài khoản nhận tiền và đối soát nằm ở <a href="quan-tri.html" target="_blank" rel="noopener">trang Quản trị</a>.</p>
      <textarea id="note-in" rows="3" maxlength="300" placeholder="Nội dung thông báo cho Phật tử…"></textarea><button id="note-post">Đăng thông báo</button>
      <ul>${getNotes().map((n, i) => `<li><span>${esc(n.text)}</span><button data-del="${i}">Xoá</button></li>`).join('')}</ul>`,
      body => {
        body.addEventListener('click', e => { const del = e.target.closest('[data-del]'); if (del) { const ns = getNotes(); ns.splice(+del.dataset.del, 1); store.set('notes', ns); adminPanel(); } });
        $('#note-post', body).addEventListener('click', () => { const v = $('#note-in', body).value.trim(); if (!v) return;
          const ns = getNotes(); ns.unshift({ text: v, t: Date.now() }); store.set('notes', ns.slice(0, 30)); paintBellDot(); toast('Đã đăng thông báo'); adminPanel(); });
      });
  }

  /* ---------- Đăng nhập: Gmail, Facebook, hoặc vào với tư cách khách ---------- */
  const login = $('#login');
  function showLogin() {
    login.hidden = false;
    const live = window.Auth && Auth.ready();
    $('#login-note').textContent = live ? '' : 'Không kết nối được máy chủ đăng nhập, mời vào với tư cách khách.';
  }
  function setRole(role, user) {
    state.role = role; state.user = user || null; save(); login.hidden = true; paintWallet(); paintRole();
    if (role === 'admin' && window.Nguoi && Nguoi.room() === 'hall') Nguoi.abbotEnter();
    if (role !== 'admin' && window.Nguoi) Nguoi.abbotLeave();
    state.nick = store.get(nickKey(), null); applyNick();
    if (role !== 'admin' && !state.nick) return nickModal(true);
    toast(role === 'admin' ? 'Chào Thầy, đã vào vai Quản trị 🙏' : `Chào ${myName()} 🙏`);
  }
  /* ---------- Biệt danh + giới tính: đặt khi mới vào; đổi mất 20 xu hoặc chờ 24 giờ ---------- */
  const GIA_DOI_TEN = 20, CHO_DOI = 24 * 3600e3;
  const RESERVED = /^(thầy|trụ trì|admin|quản trị|bạn)\b/i;
  const nickKey = () => 'nick:' + (state.user && state.user.email ? state.user.email.toLowerCase() : 'khach');
  let nickRequired = false;
  state.nick = store.get(nickKey(), null);                                   // { name, sex: 'nu'|'nam', t }
  const myName = () => state.nick ? state.nick.name : state.user ? state.user.name : 'Khách';
  function applyNick() {
    if (!state.nick) return;
    window.Nguoi && Nguoi.setMe && Nguoi.setMe({ name: state.nick.name, sheet: state.nick.sex });
    window.Presence && Presence.setMe && Presence.setMe(state.nick.name, state.nick.sex);
    paintRole();
  }
  function nickModal(first) {
    const n = state.nick, wait = n ? n.t + CHO_DOI - Date.now() : 0, server = !!(window.Vi && Vi.signedIn() && Vi.online()), free = first || !n || wait <= 0 || isAdmin() || !server;
    const mins = Math.ceil(wait / 60e3), left = wait > 0 ? (mins >= 60 ? `${mins / 60 | 0} giờ ` : '') + `${mins % 60} phút` : '';
    openModal(first ? 'Đặt biệt danh' : 'Đổi biệt danh', `
      ${first ? '<p>Mời đạo hữu đặt biệt danh và chọn giới tính để vào chùa.</p>' : ''}
      <label class="nick-l">Biệt danh<input id="nick-in" maxlength="20" placeholder="Ví dụ: Diệu Hạnh" value="${n ? esc(n.name) : ''}"></label>
      <p style="margin:10px 0 6px">Giới tính</p>
      <div class="grid sex" style="grid-template-columns:1fr 1fr">
        <button data-sex="nu" class="${n && n.sex === 'nu' ? 'on' : ''}">Nữ</button><button data-sex="nam" class="${n && n.sex === 'nam' ? 'on' : ''}">Nam</button></div>
      <p class="note" id="nick-msg">${free ? (first ? '' : 'Lần đổi này miễn phí.') : `Mỗi lần đổi biệt danh cúng dường ${GIA().rename} xu, hoặc chờ ${left} nữa để đổi miễn phí.`}</p>
      <button class="btn nap" id="nick-ok">${free ? 'Xác nhận' : `Đổi ngay (${GIA().rename} xu)`}</button>`,
      body => {
        let sex = n ? n.sex : null;
        if (first) { nickRequired = true; const x = $('#modal .close'); if (x) x.hidden = true; }
        $$('[data-sex]', body).forEach(b => b.addEventListener('click', () => { sex = b.dataset.sex; $$('[data-sex]', body).forEach(x => x.classList.toggle('on', x === b)); }));
        $('#nick-ok', body).addEventListener('click', async e => {
          if (e.currentTarget.disabled) return;
          const name = $('#nick-in', body).value.trim().replace(/\s+/g, ' '), msg = $('#nick-msg', body);
          if (name.length < 2) { msg.textContent = 'Biệt danh cần ít nhất 2 chữ.'; return; }
          if (RESERVED.test(name) && !isAdmin()) { msg.textContent = 'Biệt danh này dành riêng cho nhà chùa, mời chọn tên khác.'; return; }
          if (!sex) { msg.textContent = 'Mời chọn giới tính Nữ hoặc Nam.'; return; }
          if (n && n.name === name && n.sex === sex) { closeModal(); return; }
          if (server) {
            const btn = $('#nick-ok', body); btn.disabled = true;
            try { await Vi.spend('rename', { nick: name, sex }); }
            catch (err) { btn.disabled = false; msg.textContent = /đủ xu/.test(err.message) ? `${err.message}. Hãy nạp thêm hoặc chờ ${left} nữa để đổi miễn phí.` : err.message; return; }
          }
          state.nick = { name, sex, t: Date.now() }; store.set(nickKey(), state.nick); save(); nickRequired = false;
          const x = $('#modal .close'); if (x) x.hidden = false;
          closeModal(); applyNick(); toast(first ? `Chào ${name} 🙏` : `Đã đổi biệt danh thành ${name}`);
        });
      });
  }
  function paintRole() {
    document.documentElement.classList.toggle('is-admin', isAdmin());
    $('#acct').textContent = isAdmin() ? 'Quản trị' : myName();
  }
  $$('[data-login]', login).forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.login;
    if (k === 'guest') return setRole('guest');
    if (!window.Auth || !Auth.ready()) { toast('Đăng nhập ' + (k === 'google' ? 'Gmail' : 'Facebook') + ' chưa mở, mời vào với tư cách khách'); return; }
    try { const u = await Auth.signIn(k); await Auth.settled(); if (window.Vi) await Vi.hello();
      setRole(window.Vi && Vi.isAdmin() ? 'admin' : 'guest', { name: u.name, email: u.email }); }
    catch (err) { toast('Đăng nhập không thành công: ' + (err && err.message || err)); }
  }));
  $('#acct').addEventListener('click', () => {
    openModal('Tài khoản', `<p>Đang vào chùa với vai <b>${isAdmin() ? 'Quản trị' : 'Khách'}</b>${state.user ? ' · ' + esc(state.user.name) : ''}.</p>
      ${state.nick ? `<p>Biệt danh: <b>${esc(state.nick.name)}</b> · ${state.nick.sex === 'nu' ? 'Nữ' : 'Nam'}</p>` : ''}
      <div class="grid" style="grid-template-columns:1fr 1fr"><button id="nick-ch">${state.nick ? 'Đổi biệt danh' : 'Đặt biệt danh'}</button>${isAdmin() ? '<button id="go-admin">Mở trang quản trị</button>' : ''}${window.__roleSwitch ? __roleSwitch() : ''}<button id="logout">Đăng xuất</button></div>`,
      body => {
        const sw = $('#sw-role', body); if (sw) sw.addEventListener('click', () => { closeModal(); setRole(isAdmin() ? 'guest' : 'admin', state.user); });
        $('#nick-ch', body).addEventListener('click', () => nickModal(!state.nick));
        const ga = $('#go-admin', body); if (ga) ga.addEventListener('click', () => window.open('quan-tri.html', '_blank', 'noopener'));
        $('#logout', body).addEventListener('click', () => { closeModal(); window.Auth && Auth.ready() && Auth.signOut(); state.nick = null; state.role = ''; state.user = null; save(); window.Nguoi && Nguoi.abbotLeave(); paintRole(); paintWallet(); showLogin(); });
      });
  });
  // chỉ tài khoản Gmail quản trị mới giữ được vai Quản trị (bỏ vai quản trị tạm thời cũ)
  // vai Quản trị lưu trong máy chỉ là lựa chọn giao diện; quyền thật kiểm bằng claim (isAdmin) và ở máy chủ
  // quản trị có thể đổi sang vai khách và quay lại
  function roleSwitch() {
    if (!(window.Vi && Vi.isAdmin())) return '';
    return `<button id="sw-role">${isAdmin() ? 'Vào vai Khách' : 'Vào vai Quản trị'}</button>`;
  }
  window.__roleSwitch = roleSwitch;
  paintRole();
  if (!state.role) showLogin();
  else if (!isAdmin() && !state.nick) setTimeout(() => nickModal(true), 300);
  applyNick(); addEventListener('auth-user', applyNick);
  addEventListener('chua-ready', () => { if (isAdmin() && Nguoi.room() === 'hall') Nguoi.abbotEnter(); });
  setTimeout(() => { if (isAdmin() && window.Nguoi && Nguoi.room() === 'hall') Nguoi.abbotEnter(); }, 1500);

  /* ---------- Nhạc niệm Phật: chỉ khi ở trong chánh điện ---------- */
  const music = new Audio('assets/am/niem-phat.mp3'); music.loop = true; music.preload = 'auto';
  let musicOk = false;
  function syncMusic() {
    music.volume = state.muted ? 0 : Math.min(1, (state.volume / 100) ** 1.4 * .8);
    const inHall = !window.Nguoi || Nguoi.room() === 'hall';
    if (musicOk && inHall && !state.muted) music.play().catch(() => {}); else music.pause();
  }
  // Trình duyệt chỉ cho phát tiếng sau một lần chạm/bấm thật (điện thoại cần pointerup/touchend):
  // thử mở khoá ở mọi kiểu tương tác cho tới khi nhạc thực sự chạy.
  const unlock = () => {
    musicOk = true; try { audio(); } catch {}
    syncMusic();
    const inHall = !window.Nguoi || Nguoi.room() === 'hall';
    if (!inHall || state.muted || !music.paused) ['pointerup', 'touchend', 'click', 'keydown'].forEach(ev => removeEventListener(ev, unlock, true));
  };
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(ev => addEventListener(ev, unlock, true));
  volEl.addEventListener('input', syncMusic); $('#mute').addEventListener('click', () => setTimeout(syncMusic, 0));

  /* ---------- Nút xoay: mặt trước (nhìn ra phía Phật tử) / mặt sau (sau lưng Phật tử, nhìn lên Phật) ---------- */
  const xoay = $('#xoay');
  function paintXoay() { const back = window.Dien3D && Dien3D.active(); xoay.classList.toggle('back', !!back); $('#xoay-t').textContent = back ? 'Mặt sau' : 'Mặt trước'; }
  xoay.addEventListener('click', async () => {
    chime(660, .15);
    if (window.Dien3D && Dien3D.active()) { Dien3D.hide(); paintXoay(); return; }
    if (state.outside) { goInside(); await new Promise(r => setTimeout(r, 450)); }
    if (!window.Dien3D || !Dien3D.show()) { toast('Máy này chưa xem được mặt sau'); return; }
    Dien3D.reset(); paintXoay();
  });

  /* ---------- Lối đi: nút chuyển cảnh tới các khu xung quanh ---------- */
  const ARROW = { left: '◀', right: '▶', up: '▲', down: '▼' };
  function paintWays() {
    const box = $('#ways'); if (!window.Nguoi) return;
    const ex = Nguoi.exits();
    box.innerHTML = '<b>Đi đến</b>' + ex.map((e, i) => `<button data-way="${i}"><i>${ARROW[e.side]}</i>${esc(e.name)}</button>`).join('');
    $$('[data-way]', box).forEach(b => b.addEventListener('click', () => { const e = ex[+b.dataset.way]; window.Dien3D && Dien3D.hide(); paintXoay(); Nguoi.go(e.to, e.at, e.face); }));
  }
  addEventListener('chua-room', e => {
    paintWays(); syncMusic(); paintXoay(); window.Presence && Presence.set({ room: e.detail.room });
    if (e.detail.room === 'hall' && isAdmin()) Nguoi.abbotEnter(); else if (e.detail.room !== 'hall' && window.Nguoi) Nguoi.abbotLeave();
  });
  setTimeout(paintWays, 500);

  /* ---------- Chuông chào lần chạm đầu ---------- */
  addEventListener('pointerdown', function first() {
    removeEventListener('pointerdown', first, true);
    audio(); if (state.ambient) setTimeout(bell, 150);
  }, true);

  (function follow() {
    if (window.Nguoi && !state.outside && cam.s > 1.05 && Nguoi.me().standing && Nguoi.room() === 'hall') {
      const m = Nguoi.me(), ty = m.y - 110;
      cam.x += (m.x - cam.x) * .06; cam.y += (ty - cam.y) * .06; applyCam();
    }
    requestAnimationFrame(follow);
  })();
  applyCam();
})();
