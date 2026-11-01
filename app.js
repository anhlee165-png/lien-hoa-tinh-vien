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
    wallet: store.get('wallet', 1250000),
    merit: store.get('merit', 0),
    beads: store.get('beads', 0),
    hall: store.get('hall', 1),
    volume: store.get('volume', 70),
    muted: store.get('muted', false),
    ambient: store.get('ambient', true),
    log: store.get('log', []),
    outside: false
  };
  const save = () => ['wallet', 'merit', 'beads', 'hall', 'volume', 'muted', 'ambient', 'log'].forEach(k => store.set(k, state[k]));
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
    if (state.outside) goInside();
    setView(b.dataset.view); chime(660, .15);
  }));
  $('#views-toggle').addEventListener('click', () => $('#views').classList.toggle('closed'));

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
      if (!dragging && !keys.size) { scene.classList.remove('drag'); return; }
      let x = jv.x, y = jv.y;
      if (keys.has('l')) x -= 1; if (keys.has('r')) x += 1; if (keys.has('u')) y -= 1; if (keys.has('d')) y += 1;
      cam.s *= 1 - y * 0.012;                 // lên = tiến vào, xuống = lùi ra
      cam.x += x * 9 / cam.s;
      if (cam.s > 1.05) cam.y += -y * 1.5 / cam.s * (420 - cam.y) / 100;
      applyCam();
      $$('#views [data-view]').forEach(b => b.classList.remove('on'));
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
  const paintWallet = () => { $('#wallet').textContent = fmt(state.wallet); };
  paintWallet();

  /* ---------- Hành động ---------- */
  const aura = $('#me-aura');
  let current = null, thienTimer = 0, thienStart = 0;
  function stopContinuous() {
    clearInterval(chantTimer); chantTimer = 0; clearInterval(thienTimer); thienTimer = 0;
    drone(false); $('#vignette').classList.remove('on'); aura.classList.remove('on'); status('');
    $$('#actions button').forEach(b => b.classList.remove('on')); current = null;
  }
  const ACTIONS = {
    chaptay() { chime(880, 2, .25); aura.classList.add('on'); setTimeout(() => current || aura.classList.remove('on'), 2200); floatText('🙏 A Di Đà Phật'); addMerit(1, 'Chắp tay'); },
    cuichao() { chime(740, 2, .25); floatText('Cúi chào đại chúng'); addMerit(1, 'Cúi chào'); },
    layphat() {
      bell(); aura.classList.add('on'); setTimeout(() => current || aura.classList.remove('on'), 4000);
      floatText('Kính lạy Bổn Sư Thích Ca Mâu Ni Phật'); addMerit(3, 'Lạy Phật'); petals(14);
    },
    niemphat: { toggle: true, start() {
      let i = 0; const words = ['Nam Mô', 'A Di Đà', 'Phật'];
      aura.classList.add('on'); status('Đang niệm Phật · Nam Mô A Di Đà Phật');
      const tick = () => { mo(); floatText(words[i % 3], 843 + (i % 3 - 1) * 90, 545, true); if (i % 3 === 2) addMerit(1, 'Niệm Phật'); i++; };
      tick(); chantTimer = setInterval(tick, 900);
    } },
    thien: { toggle: true, start() {
      $('#vignette').classList.add('on'); aura.classList.add('on'); bell(); thienStart = Date.now();
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
      state.beads = (state.beads % 108) + 1; mo();
      floatText(`📿 ${state.beads} / 108`, 843, 540, true);
      if (state.beads === 108) { bell(); petals(24); addMerit(10, 'Tròn một chuỗi 108 hạt'); toast('Viên mãn một chuỗi 108 hạt 🙏'); }
      save();
    },
    thaphuong() {
      incenseBoost = 18; chime(1040, 2.5, .2); floatText('Thắp nén tâm hương', 843, 690, true); addMerit(2, 'Thắp hương');
      if (!state.outside) { Object.assign(cam, { s: 1.6, x: 843, y: 640 }); applyCam(); $$('#views [data-view]').forEach(b => b.classList.remove('on')); }
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

  function goOutside() {
    stopContinuous(); state.outside = true;
    Object.assign(cam, { s: 3.2, x: 838, y: 430 }); applyCam();
    $$('#views [data-view]').forEach(b => b.classList.remove('on'));
    $('#exit-label').textContent = 'Vào trong';
    setTimeout(() => toast('Bạn đang ở sân chùa · đỉnh hương & cổng tam quan'), 900);
    logIt('Ra sân chùa');
  }
  function goInside() {
    state.outside = false; $('#exit-label').textContent = 'Ra ngoài'; setView('all'); toast('Trở lại chánh điện');
  }

  /* ---------- Chánh điện / số người ---------- */
  const halls = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, n: i === 0 ? 37 : 8 + ((i * 37) % 85) }));
  function paintHall() {
    const h = halls[state.hall - 1];
    $('#hall-name').textContent = `Chánh điện ${h.id}`; $('#info-hall').textContent = `Chánh điện ${h.id}`;
    $('#online').textContent = h.n; $('#info-online').textContent = h.n;
  }
  paintHall();
  setInterval(() => {
    halls.forEach(h => { h.n = Math.max(3, Math.min(100, h.n + Math.round(Math.random() * 2 - 1))); });
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
    toast(`Đã vào Chánh điện ${id}`);
  }
  const notes = [
    ['Lễ cầu an tối nay lúc 19:30', 'Chánh điện 1'],
    ['Khóa tu niệm Phật một ngày – Chủ nhật', 'Phòng niệm Phật'],
    ['Thầy giảng Kinh A Di Đà lúc 20:00', 'Nghe kinh'],
  ];
  $('#bell-btn').addEventListener('click', e => {
    e.stopPropagation(); bell();
    bellMenu.innerHTML = notes.map(([t, s]) => `<div class="item">${t}<small>${s}</small></div>`).join('');
    bellMenu.style.left = '1340px'; bellMenu.style.minWidth = '320px'; bellMenu.hidden = !bellMenu.hidden; hallMenu.hidden = true;
    $('#bell-dot').classList.add('off');
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
      openModal('Ví công đức', `<p>Số dư</p><p class="big">${fmt(state.wallet)} đ</p>
        <p>Nạp thêm (mô phỏng):</p>
        <div class="grid">${[50000, 100000, 200000, 500000].map(v => `<button data-v="${v}">+${fmt(v)}</button>`).join('')}</div>`,
        body => body.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return;
          state.wallet += +b.dataset.v; save(); paintWallet(); chime(988, 1.5, .25); $('.big', body).textContent = fmt(state.wallet) + ' đ'; }));
    },
    merit() {
      const opts = [[20000, 'Cúng hoa sen'], [50000, 'Cúng đèn'], [100000, 'Cúng dường Tam Bảo'], [200000, 'Ấn tống kinh']];
      openModal('Công đức', `<p>Công đức tích lũy</p><p class="big" id="m-pt">${fmt(state.merit)}</p>
        <p>Cúng dường từ ví (${fmt(state.wallet)} đ):</p>
        <div class="grid">${opts.map(([v, t]) => `<button data-v="${v}" data-t="${t}">${t}<small>${fmt(v)} đ</small></button>`).join('')}</div>`,
        body => body.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return;
          const v = +b.dataset.v; if (state.wallet < v) { toast('Ví không đủ, hãy nạp thêm'); return; }
          state.wallet -= v; paintWallet(); addMerit(Math.round(v / 10000), b.dataset.t); bell(); petals(20);
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
  $('#topup').addEventListener('click', e => { e.stopPropagation(); PANELS.wallet(); });
  $('#merit-btn').addEventListener('click', () => PANELS.merit());
  $('#gear').addEventListener('click', () => {
    openModal('Cài đặt', `<label><input type="checkbox" id="s-amb" ${state.ambient ? 'checked' : ''}> Chuông chào khi vào điện</label>
      <label><input type="checkbox" id="s-views" ${$('#views').classList.contains('closed') ? '' : 'checked'}> Hiện bảng Điểm nhìn nhanh</label>
      <p style="opacity:.8;font-size:17px">Điều khiển: joystick hoặc phím mũi tên / WASD (lên = tiến vào, xuống = lùi ra).</p>`,
      body => {
        $('#s-amb', body).addEventListener('change', e => { state.ambient = e.target.checked; save(); });
        $('#s-views', body).addEventListener('change', e => $('#views').classList.toggle('closed', !e.target.checked));
      });
  });

  /* ---------- Chuông chào lần chạm đầu ---------- */
  addEventListener('pointerdown', function first() {
    removeEventListener('pointerdown', first, true);
    audio(); if (state.ambient) setTimeout(bell, 150);
  }, true);

  applyCam();
})();
