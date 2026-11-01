/* Liên Hoa Tịnh Viện – khu sân chùa bên ngoài (bước đầu của "mê cung nhà chùa").
   Mỗi cảnh là một ảnh 1672×941; các lối đi nối cảnh với nhau.
   Joystick: lên = đi tới, xuống = quay lại, trái/phải = rẽ. Bấm mũi tên trên cảnh cũng đi được. */
(() => {
  const W = 1672, H = 941;
  // to: tên cảnh, 'hall' = vào chánh điện, 'act:...' = hành động, 'soon:...' = khu sắp mở
  const ROOMS = {
    'cua':        { name: 'Cửa Chánh điện', go: { up: ['san', 836, 590, 'Ra sân chùa'], down: ['hall', 836, 880, 'Vào Chánh điện'] } },
    'san':        { name: 'Sân chùa', go: { up: ['tam-quan', 852, 430, 'Cổng Tam Quan'], left: ['bo-de', 170, 560, 'Cây Bồ Đề'], right: ['quan-am', 1500, 560, 'Hồ sen Quan Âm'], down: ['mat-tien', 836, 885, 'Quay lại Chánh điện'] } },
    'mat-tien':   { name: 'Mặt tiền Chánh điện', go: { up: ['hall', 836, 430, 'Vào Chánh điện'], left: ['lau-chuong', 150, 420, 'Lầu Chuông'], right: ['lau-trong', 1540, 420, 'Lầu Trống'], down: ['san', 836, 885, 'Ra sân'] } },
    'tam-quan':   { name: 'Cổng Tam Quan', go: { up: ['soon:Đường làng', 836, 560, 'Ra đường làng'], down: ['mat-tien', 836, 885, 'Quay về chùa'] } },
    'bo-de':      { name: 'Gốc Bồ Đề', go: { up: ['lau-chuong', 1370, 420, 'Lầu Chuông'], down: ['san', 836, 885, 'Về sân chùa'] } },
    'quan-am':    { name: 'Hồ sen · Tượng Quan Âm', go: { up: ['lau-trong', 700, 370, 'Lầu Trống'], right: ['act:quanam', 1120, 300, 'Chiêm bái Quan Âm'], down: ['san', 836, 885, 'Về sân chùa'] } },
    'lau-chuong': { name: 'Lầu Chuông', go: { up: ['act:chuong', 836, 560, 'Thỉnh chuông'], right: ['hanh-lang', 1540, 620, 'Hành lang'], down: ['mat-tien', 836, 885, 'Về Chánh điện'] } },
    'lau-trong':  { name: 'Lầu Trống', go: { up: ['act:trong', 845, 470, 'Đánh trống'], down: ['mat-tien', 836, 885, 'Về Chánh điện'] } },
    'hanh-lang':  { name: 'Hành lang', go: { up: ['soon:Vườn Thiền', 836, 470, 'Vườn Thiền'], down: ['lau-chuong', 836, 885, 'Về Lầu Chuông'] } }
  };
  const ARROW = { up: '▲', down: '▼', left: '◀', right: '▶' };

  const stage = document.getElementById('stage');
  const root = document.createElement('div'); root.id = 'ngoai';
  root.innerHTML = `<div class="ng-view"><img class="ng-a" alt=""><img class="ng-b" alt=""></div>
    <div class="ng-hot"></div><div class="ng-me"><div class="tag me">Bạn</div><div class="ng-spr"></div></div>
    <div class="ng-name"></div>`;
  stage.insertBefore(root, document.getElementById('vignette'));
  const view = root.querySelector('.ng-view'), imgA = root.querySelector('.ng-a'), imgB = root.querySelector('.ng-b');
  const hot = root.querySelector('.ng-hot'), meEl = root.querySelector('.ng-me'), spr = root.querySelector('.ng-spr');
  const nameEl = root.querySelector('.ng-name');
  Object.keys(ROOMS).forEach(k => { const i = new Image(); i.src = `assets/ngoai/${k}.jpg`; }); // tải trước

  // Bạn: bộ tư thế nam (ô 193×260, lưới 4×6)
  const CW = 193, CH = 260, S = 1.12;
  spr.style.width = CW * S + 'px'; spr.style.height = CH * S + 'px';
  spr.style.backgroundSize = `${CW * 4 * S}px ${CH * 6 * S}px`;
  const setFrame = f => spr.style.backgroundPosition = `${-(f % 4) * CW * S}px ${-((f / 4) | 0) * CH * S}px`;

  let room = null, on = false, busy = false, input = { x: 0, y: 0 };
  let meX = W / 2, prog = 0, walkT = 0, frame = 4, handlers = {};

  function render() {
    const r = ROOMS[room];
    nameEl.textContent = r.name;
    hot.innerHTML = '';
    Object.entries(r.go).forEach(([d, [to, x, y, label]]) => {
      const b = document.createElement('button'); b.className = 'ng-arrow ' + d;
      b.style.left = x + 'px'; b.style.top = y + 'px';
      b.innerHTML = `<span>${ARROW[d]}</span>${label}`;
      b.addEventListener('click', () => go(d));
      hot.appendChild(b);
    });
  }
  function show(k, instant) {
    room = k; render();
    if (instant) { imgA.src = `assets/ngoai/${k}.jpg`; imgB.classList.remove('on'); return Promise.resolve(); }
    return new Promise(res => {
      imgB.src = `assets/ngoai/${k}.jpg`;
      const done = () => { imgB.classList.add('on'); setTimeout(() => { imgA.src = imgB.src; imgB.classList.remove('on'); view.style.transform = ''; res(); }, 650); };
      imgB.complete ? done() : (imgB.onload = done);
    });
  }
  async function go(d) {
    if (busy || !on) return;
    const g = ROOMS[room].go[d]; if (!g) return;
    const [to] = g;
    if (to.startsWith('act:')) { handlers.action && handlers.action(to.slice(4), meAct); return; }
    if (to.startsWith('soon:')) { handlers.toast && handlers.toast(`${to.slice(5)} đang được xây, sắp mở 🙏`); prog = 0; return; }
    if (to === 'hall') { handlers.exit && handlers.exit(); return; }
    busy = true; hot.classList.add('hide');
    // bước tới: đẩy cảnh lại gần theo hướng đi
    const [, x, y] = g;
    view.style.transformOrigin = `${x}px ${y}px`;
    view.style.transform = d === 'down' ? 'scale(1)' : 'scale(1.18)';
    await new Promise(r => setTimeout(r, 380));
    await show(to); meX = W / 2; prog = 0; frame = d === 'down' ? 0 : 4; setFrame(frame);
    hot.classList.remove('hide'); busy = false;
    handlers.moved && handlers.moved(ROOMS[to].name);
  }
  function meAct(kind) {                 // tư thế khi làm lễ
    const seq = kind === 'lay' ? [16, 17, 18, 19, 18, 16] : [16, 17, 16];
    busy = true; let i = 0;
    const t = setInterval(() => { setFrame(seq[i++]); if (i >= seq.length) { clearInterval(t); busy = false; setFrame(4); } }, 550);
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (on && !busy) {
      const { x, y } = input, mag = Math.hypot(x, y);
      if (mag > .2) {
        walkT += dt;
        const dir = Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
        frame = { down: 0, up: 4, left: 8, right: 12 }[dir] + ((walkT * 8) | 0) % 4;
        if (dir === 'left' || dir === 'right') {
          meX += x * 260 * dt;
          if (meX < 300) ROOMS[room].go.left ? go('left') : (meX = 300);
          else if (meX > W - 300) ROOMS[room].go.right ? go('right') : (meX = W - 300);
        } else {
          prog += (dir === 'up' ? 1 : -1) * dt / 1.1;
          if (prog >= 1) { prog = 0; go('up'); } else if (prog <= -1) { prog = 0; go('down'); }
        }
      } else {
        prog *= Math.exp(-4 * dt); if (Math.abs(prog) < .01) prog = 0;
        if (frame % 4) frame -= frame % 4;
      }
      setFrame(frame);
      const up = ROOMS[room].go.up;
      if (prog > 0 && up) { view.style.transformOrigin = `${up[1]}px ${up[2]}px`; view.style.transform = `scale(${1 + prog * .18})`; }
      else view.style.transform = '';
      meEl.style.transform = `translate(${meX - W / 2}px, ${Math.min(0, -prog * 40)}px) scale(${1 - Math.max(0, prog) * .12})`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.Ngoai = {
    enter(k = 'cua') { on = true; root.classList.add('on'); meX = W / 2; prog = 0; frame = 4; setFrame(4); show(k, true); },
    leave() { on = false; root.classList.remove('on'); },
    drive(x, y) { input = { x, y }; },
    go, on: () => on, pose: k => !busy && meAct(k), room: () => room,
    set(h) { handlers = h; }
  };
})();
