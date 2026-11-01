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
    xu: store.get('xu', 0),
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
  const save = () => ['role', 'user', 'xu', 'merit', 'beads', 'hall', 'volume', 'muted', 'ambient', 'log'].forEach(k => store.set(k, state[k]));
  const fmt = n => n.toLocaleString('vi-VN');

  /* ---------- Co giãn sân khấu ---------- */
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(${-W * s / 2}px, ${-H * s / 2}px) scale(${s})`;
    stage.dataset.scale = s;
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
    const hw = W / 2 / cam.s, hh = H / 2 / cam.s;
    cam.x = Math.max(hw, Math.min(W - hw, cam.x));
    cam.y = Math.max(hh, Math.min(H - hh, cam.y));
    scene.style.transform = `translate(${W / 2 - cam.x * cam.s}px, ${H / 2 - cam.y * cam.s}px) scale(${cam.s})`;
  }
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
    store.set(k, list.slice(-60)); if (k === chatKey()) chatPaint();
    if (broadcast && chat.bc) chat.bc.postMessage({ key: k, who: m.who, text: m.text });
  }
  if (chat.bc) chat.bc.onmessage = e => chatAdd({ ...e.data, me: false }, false);
  const BOT = ['Minh Tâm', 'Quang Huy', 'Liên Hoa', 'An Nhiên', 'Từ Hạnh', 'Nhật Minh', 'Diệu Âm', 'Thiện Tâm'];
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
    chatAdd({ who: 'Bạn', text, me: true }); inp.value = ''; inp.blur();
    if (Math.random() < .7) setTimeout(() => botTalk(true), 2500 + Math.random() * 4000);
  });
  $('#chat-toggle').addEventListener('click', () => $('#chat').classList.toggle('closed'));
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
    for (let i = 0; i < T.n; i++) setTimeout(() => { T.snd(); floatText(T.word, T.x + (i - 1) * 70, T.y, true); Nguoi.bow('ban', 0, Math.min(700, T.gap - 150)); }, i * T.gap);
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
  const isAdmin = () => state.role === 'admin';
  const xuText = () => isAdmin() ? '∞' : fmt(state.xu);
  const paintWallet = () => { $('#wallet').textContent = xuText(); };
  paintWallet();

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
    thaphuong() {
      if (window.Dien3D && Dien3D.active()) {
        Dien3D.incense(); addMerit(2, 'Thắp hương'); floatText('Nguyện hương thơm lan khắp mười phương', 843, 560, true);
      } else if (window.Nguoi) {
        Nguoi.incense().then(ok => { if (ok === false && !busyIncense()) toast('Hãy đi đến chỗ có lư hương (trong chánh điện, cửa điện, sân hoặc mặt tiền) để thắp hương'); });
        floatText('Thắp nén tâm hương', 843, 520, true);
      } else { incenseBoost = 18; addMerit(2, 'Thắp hương'); }
      chime(1040, 2.5, .2);
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
    if (room === 'lau-trong' || room === 'lau-chuong') setTimeout(() => strike(room === 'lau-trong' ? 'trong' : 'chuong'), 700);   // đến nơi thì nghe trống/chuông
  });
  addEventListener('chua-soon', e => toast(`${e.detail} đang được xây, sắp mở 🙏`));
  addEventListener('chua-huong', e => { if (e.detail.me) { addMerit(2, 'Thắp hương'); floatText('Nguyện hương thơm lan khắp mười phương', 843, 560, true); chime(1040, 2.5, .2); } else incenseBoost = 6; });
  addEventListener('chua-act', e => {
    const kind = e.detail;
    if (kind === 'chuong' && strike('chuong')) { setTimeout(() => floatText('Nguyện tiếng chuông này vang khắp pháp giới'), 600); addMerit(2, 'Thỉnh chuông'); }
    if (kind === 'trong' && strike('trong')) addMerit(1, 'Đánh trống');
    if (kind === 'quanam') { chime(880, 3, .3); Nguoi.layPhat(1); floatText('Nam Mô Đại Từ Đại Bi Quán Thế Âm Bồ Tát'); addMerit(3, 'Chiêm bái Quan Âm'); petals(12); }
  });
  addEventListener('chua-count', () => paintHall());

  /* ---------- Chánh điện / số người ---------- */
  const halls = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, n: i === 0 ? 37 : 8 + ((i * 37) % 85) }));
  function paintHall() {
    const h = halls[state.hall - 1];
    if (window.Nguoi && Nguoi.count) h.n = Nguoi.count();
    $('#hall-name').textContent = `Chánh điện ${h.id}`; $('#info-hall').textContent = `Chánh điện ${h.id}`;
    $('#online').textContent = h.n; $('#info-online').textContent = h.n;
  }
  paintHall();
  setInterval(() => {
    halls.forEach(h => { if (window.Nguoi && h.id === state.hall) return; h.n = Math.max(3, Math.min(100, h.n + Math.round(Math.random() * 2 - 1))); });
    paintHall();
  }, 7000);
  const hallMenu = $('#hall-menu'), bellMenu = $('#bell-menu');
  function openHallMenu() {
    hallMenu.innerHTML = halls.map(h => `<button data-h="${h.id}" class="${h.id === state.hall ? 'on' : ''}">Chánh điện ${h.id}<small>${h.n}/100</small></button>`).join('');
    hallMenu.style.left = '622px'; hallMenu.hidden = false; bellMenu.hidden = true;
  }
  $('#hall-btn').addEventListener('click', e => { e.stopPropagation(); hallMenu.hidden ? openHallMenu() : (hallMenu.hidden = true); });
  hallMenu.addEventListener('click', e => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    joinHall(+b.dataset.h); hallMenu.hidden = true;
  });
  function joinHall(id) {
    state.hall = id; save(); paintHall(); setView('all'); chime(523, 2.5, .3);
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
    const nb = $('#note-new', bellMenu); if (nb) nb.addEventListener('click', ev => { ev.stopPropagation(); bellMenu.hidden = true; adminPanel('notes'); });
    store.set('notesSeen', Date.now());
    bellMenu.style.left = '1340px'; bellMenu.style.minWidth = '320px'; bellMenu.hidden = !bellMenu.hidden; hallMenu.hidden = true;
    paintBellDot();
  });
  document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) { hallMenu.hidden = true; bellMenu.hidden = true; } });
  $('#niem-room').addEventListener('click', () => {
    const b = $('[data-act="niemphat"]'); if (current !== 'niemphat') b.click();
    Object.assign(cam, VIEWS.buddha); applyCam(); toast('Vào Phòng niệm Phật');
  });

  /* ---------- Modal ---------- */
  const modal = $('#modal');
  function openModal(title, html, bind) {
    $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; modal.hidden = false; bind && bind($('#modal-body'));
  }
  function closeModal() { modal.hidden = true; }
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.close')) closeModal(); });

  const PANELS = {
    rooms() {
      openModal('20 chánh điện', `<div class="grid">${halls.map(h => `<button data-h="${h.id}" class="${h.id === state.hall ? 'on' : ''}">Điện ${h.id}<small>${h.n}/100 người</small></button>`).join('')}</div>`,
        body => body.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { joinHall(+b.dataset.h); closeModal(); } }));
    },
    hall() { closeModal(); setView('all'); if (state.outside) goInside(); },
    wallet() {
      // Nạp xu: giá tiền (đồng) → số xu nhận được. Khách quét QR của chùa, quản trị xác nhận rồi xu mới vào ví.
      const PACKS = [[18990, 1680], [48990, 5099], [99000, 10900], [199000, 21900]];
      const qr = store.get('qr', null);
      openModal('Ví xu', `<p>Số dư</p><p class="big">${xuText()} xu</p>
        ${isAdmin() ? '<p class="note">Tài khoản quản trị có xu vô hạn.</p>' : `<p>Chọn gói nạp:</p>
        <div class="grid">${PACKS.map(([d, x]) => `<button data-x="${x}" data-d="${d}"><b>${fmt(x)} xu</b><small>${fmt(d)} đ</small></button>`).join('')}</div>
        <div id="pay" hidden></div>`}`,
        body => body.addEventListener('click', e => {
          const b = e.target.closest('[data-x]');
          if (b) {
            const x = +b.dataset.x, d = +b.dataset.d, code = 'LHTV' + Date.now().toString(36).toUpperCase().slice(-6);
            const pay = $('#pay', body); pay.hidden = false;
            pay.innerHTML = qr ? `<p>Quét mã để chuyển <b>${fmt(d)} đ</b>, nội dung: <b>${code}</b></p><img class="qr" src="${qr}" alt="Mã QR thanh toán của chùa">
              <button id="paid" data-x="${x}" data-d="${d}" data-c="${code}">Tôi đã chuyển khoản</button>`
              : '<p class="note">Chùa chưa cài mã QR thanh toán. Vui lòng quay lại sau.</p>';
            return;
          }
          const pd = e.target.closest('#paid'); if (!pd) return;
          const L = store.get('ledger', []);
          L.unshift({ id: pd.dataset.c, who: state.user ? state.user.name : 'Khách', xu: +pd.dataset.x, d: +pd.dataset.d, kind: 'nap', status: 'cho', t: Date.now() });
          store.set('ledger', L.slice(0, 500)); closeModal();
          toast('Đã gửi yêu cầu nạp xu. Xu sẽ vào ví khi chùa xác nhận 🙏'); logIt(`Yêu cầu nạp ${fmt(+pd.dataset.x)} xu`);
        }));
    },
    merit() {
      const opts = [[200, 'Cúng hoa sen'], [500, 'Cúng đèn'], [1000, 'Cúng dường Tam Bảo'], [2000, 'Ấn tống kinh']];
      openModal('Công đức', `<p>Công đức tích lũy</p><p class="big" id="m-pt">${fmt(state.merit)}</p>
        <p>Cúng dường bằng xu (đang có ${xuText()} xu):</p>
        <div class="grid">${opts.map(([v, t]) => `<button data-v="${v}" data-t="${t}">${t}<small>${fmt(v)} xu</small></button>`).join('')}</div>`,
        body => body.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return;
          const v = +b.dataset.v; if (!isAdmin() && state.xu < v) { toast('Không đủ xu, hãy nạp thêm'); PANELS.wallet(); return; }
          if (!isAdmin()) state.xu -= v;
          const L = store.get('ledger', []); L.unshift({ who: state.user ? state.user.name : 'Khách', xu: v, kind: 'cung', what: b.dataset.t, status: 'ok', t: Date.now() }); store.set('ledger', L.slice(0, 500));
          save(); paintWallet(); addMerit(Math.round(v / 100), b.dataset.t); bell(); petals(20);
          $('#m-pt', body).textContent = fmt(state.merit); closeModal(); toast(`Tùy hỷ công đức: ${b.dataset.t} 🙏`); }));
    },
    book() {
      const items = state.log.length ? state.log.map(l => `<li><span>${l.text}${l.merit ? ` <small>+${l.merit}</small>` : ''}</span><small>${new Date(l.t).toLocaleString('vi-VN')}</small></li>`).join('') : '<li>Chưa có ghi chép. Hãy chắp tay, niệm Phật hay thắp hương.</li>';
      openModal('Sổ tu tập', `<p>Chuỗi hạt: <b>${state.beads}/108</b> · Công đức: <b>${fmt(state.merit)}</b></p><ul>${items}</ul>`);
    }
  };
  $$('[data-open]').forEach(b => b.addEventListener('click', () => {
    if (b.closest('#nav')) { $$('#nav button').forEach(x => x.classList.toggle('on', x === b)); }
    PANELS[b.dataset.open]();
  }));
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
      <button id="a-panel" style="margin-top:8px;width:100%">Sổ công đức · Mã QR · Thông báo</button></div>`,
      body => {
        $('#s-amb', body).addEventListener('change', e => { state.ambient = e.target.checked; save(); });
        const upd = n => { $('#a-n', body).textContent = n; paintHall(); };
        $$('[data-ao]', body).forEach(b => b.addEventListener('click', () => upd(Nguoi.setAo(Nguoi.ao() + +b.dataset.ao))));
        $('#a-full', body).addEventListener('click', () => upd(Nguoi.setAo(Nguoi.maxAo())));
        $('#a-panel', body).addEventListener('click', () => adminPanel('so'));
        $('#a-lay', body).addEventListener('click', () => { closeModal(); bell(); Nguoi.allLay(); floatText('Đại chúng đồng lạy Phật'); });
      });
  });

  /* ---------- Quản trị: thông báo, mã QR, sổ công đức ---------- */
  function adminPanel(tab = 'so') {
    if (!isAdmin()) return;
    const L = store.get('ledger', []);
    const nap = L.filter(x => x.kind === 'nap'), cung = L.filter(x => x.kind === 'cung');
    const tong = nap.filter(x => x.status === 'ok').reduce((a, x) => a + x.d, 0);
    const cho = nap.filter(x => x.status === 'cho');
    const qr = store.get('qr', null);
    const tabs = { so: 'Sổ công đức', qr: 'Mã QR', notes: 'Thông báo' };
    openModal('Quản trị', `<div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('')}</div>
      ${tab === 'so' ? `<p>Đã nhận: <b class="big-inline">${fmt(tong)} đ</b> · ${nap.filter(x => x.status === 'ok').length} lượt nạp · ${cung.length} lượt cúng dường (${fmt(cung.reduce((a, x) => a + x.xu, 0))} xu)</p>
        <h3>Chờ xác nhận (${cho.length})</h3>
        <ul>${cho.length ? cho.map(x => `<li><span>${esc(x.who)} · ${fmt(x.d)} đ → ${fmt(x.xu)} xu · <b>${x.id}</b></span><span><button data-ok="${x.id}">Đã nhận tiền</button> <button data-no="${x.id}">Từ chối</button></span></li>`).join('') : '<li>Không có yêu cầu nào.</li>'}</ul>
        <h3>Lịch sử</h3>
        <ul>${L.filter(x => x.status !== 'cho').slice(0, 40).map(x => `<li><span>${esc(x.who)} · ${x.kind === 'nap' ? `nạp ${fmt(x.d)} đ (${x.status === 'ok' ? 'đã nhận' : 'từ chối'})` : `${esc(x.what)} ${fmt(x.xu)} xu`}</span><small>${new Date(x.t).toLocaleString('vi-VN')}</small></li>`).join('') || '<li>Chưa có.</li>'}</ul>`
      : tab === 'qr' ? `<p>Mã QR chuyển khoản hiện ra khi Phật tử nạp xu.</p>
        ${qr ? `<img class="qr" src="${qr}" alt="Mã QR hiện tại">` : '<p class="note">Chưa có mã QR.</p>'}
        <label class="file">${qr ? 'Đổi mã QR' : 'Thêm mã QR'}<input type="file" id="qr-in" accept="image/*" hidden></label>
        ${qr ? '<button id="qr-del">Xoá mã QR</button>' : ''}`
      : `<textarea id="note-in" rows="3" maxlength="300" placeholder="Nội dung thông báo cho Phật tử…"></textarea><button id="note-post">Đăng thông báo</button>
        <ul>${getNotes().map((n, i) => `<li><span>${esc(n.text)}</span><button data-del="${i}">Xoá</button></li>`).join('')}</ul>`}`,
      body => {
        $$('[data-tab]', body).forEach(b => b.addEventListener('click', () => adminPanel(b.dataset.tab)));
        body.addEventListener('click', e => {
          const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'), del = e.target.closest('[data-del]');
          if (ok || no) {
            const L2 = store.get('ledger', []), x = L2.find(x => x.id === (ok || no).dataset[ok ? 'ok' : 'no']);
            if (x) { x.status = ok ? 'ok' : 'tu-choi'; store.set('ledger', L2); if (ok) { toast(`Đã cộng ${fmt(x.xu)} xu cho ${x.who}`); if (!isAdmin()) {} } }
            adminPanel('so');
          }
          if (del) { const ns = getNotes(); ns.splice(+del.dataset.del, 1); store.set('notes', ns); adminPanel('notes'); }
        });
        const qi = $('#qr-in', body);
        if (qi) qi.addEventListener('change', () => { const f = qi.files[0]; if (!f) return; const r = new FileReader();
          r.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 600 / Math.max(img.width, img.height));
            c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            store.set('qr', c.toDataURL('image/jpeg', .9)); toast('Đã lưu mã QR'); adminPanel('qr'); }; img.src = r.result; }; r.readAsDataURL(f); });
        const qd = $('#qr-del', body); if (qd) qd.addEventListener('click', () => { store.set('qr', null); adminPanel('qr'); });
        const np = $('#note-post', body);
        if (np) np.addEventListener('click', () => { const v = $('#note-in', body).value.trim(); if (!v) return;
          const ns = getNotes(); ns.unshift({ text: v, t: Date.now() }); store.set('notes', ns.slice(0, 30)); paintBellDot(); toast('Đã đăng thông báo'); adminPanel('notes'); });
      });
  }

  /* ---------- Đăng nhập: Gmail, Facebook, hoặc vào với tư cách khách ---------- */
  const login = $('#login');
  function showLogin() {
    login.hidden = false;
    const live = window.Auth && Auth.ready();
    $('#login-note').textContent = live ? '' : 'Đăng nhập Gmail / Facebook sẽ mở khi chùa hoàn tất cài đặt máy chủ.';
    $('[data-login="admin-tam"]').hidden = !!live;
  }
  function setRole(role, user) {
    state.role = role; state.user = user || null; save(); login.hidden = true; paintWallet(); paintRole();
    if (role === 'admin' && window.Nguoi && Nguoi.room() === 'hall') Nguoi.abbotEnter();
    if (role !== 'admin' && window.Nguoi) Nguoi.abbotLeave();
    toast(role === 'admin' ? 'Chào Thầy, đã vào vai Quản trị 🙏' : `Chào ${user ? user.name : 'đạo hữu'} 🙏`);
  }
  function paintRole() {
    document.documentElement.classList.toggle('is-admin', isAdmin());
    $('#acct').textContent = state.user ? state.user.name : (isAdmin() ? 'Quản trị' : 'Khách');
  }
  $$('[data-login]', login).forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.login;
    if (k === 'guest') return setRole('guest');
    if (k === 'admin-tam') return setRole('admin', { name: 'Quản trị' });
    if (!window.Auth || !Auth.ready()) { toast('Đăng nhập ' + (k === 'google' ? 'Gmail' : 'Facebook') + ' chưa mở, mời vào với tư cách khách'); return; }
    try { const u = await Auth.signIn(k); setRole(u.admin ? 'admin' : 'guest', { name: u.name, email: u.email }); }
    catch (err) { toast('Đăng nhập không thành công: ' + (err && err.message || err)); }
  }));
  $('#acct').addEventListener('click', () => {
    openModal('Tài khoản', `<p>Đang vào chùa với vai <b>${isAdmin() ? 'Quản trị' : 'Khách'}</b>${state.user ? ' · ' + esc(state.user.name) : ''}.</p>
      <div class="grid" style="grid-template-columns:1fr 1fr">${isAdmin() ? '<button id="go-admin">Mở trang quản trị</button>' : ''}<button id="logout">Đăng xuất</button></div>`,
      body => {
        const ga = $('#go-admin', body); if (ga) ga.addEventListener('click', () => adminPanel('so'));
        $('#logout', body).addEventListener('click', () => { closeModal(); window.Auth && Auth.ready() && Auth.signOut(); state.role = ''; state.user = null; save(); window.Nguoi && Nguoi.abbotLeave(); paintRole(); paintWallet(); showLogin(); });
      });
  });
  paintRole();
  if (!state.role) showLogin();
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
  addEventListener('pointerdown', () => { musicOk = true; syncMusic(); }, { once: true, capture: true });
  volEl.addEventListener('input', syncMusic); $('#mute').addEventListener('click', () => setTimeout(syncMusic, 0));

  /* ---------- Nút xoay: mặt trước (nhìn ra phía Phật tử) / mặt sau (sau lưng Phật tử, nhìn lên Phật) ---------- */
  const xoay = $('#xoay');
  function paintXoay() { const back = window.Dien3D && Dien3D.active(); xoay.classList.toggle('back', !!back); $('#xoay-t').textContent = back ? 'Mặt sau' : 'Mặt trước'; }
  xoay.addEventListener('click', async () => {
    chime(660, .15);
    if (window.Dien3D && Dien3D.active()) { Dien3D.hide(); paintXoay(); return; }
    if (state.outside) { goInside(); await new Promise(r => setTimeout(r, 450)); }
    if (!window.Dien3D || !Dien3D.show()) { toast('Máy này chưa hỗ trợ đồ họa 3D'); return; }
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
    paintWays(); syncMusic(); paintXoay();
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
