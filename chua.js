/* Liên Hoa Tịnh Viện – thế giới chùa: chánh điện + 11 cảnh bên ngoài.
   Mọi Phật tử đều là nhân vật (bộ tư thế nam/nữ 4×6): ngồi, đứng dậy, đi lại, lạy, thắp hương.
   Thảm ngồi luôn có sẵn; chỗ trống là thảm sạch. "Bạn" đi bằng joystick/phím 4 hướng khắp chùa;
   đi ra mép cảnh hoặc qua cửa thì sang cảnh kế bên. */
(() => {
  const W = 1672, H = 941;
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = { get(k, d) { try { const v = localStorage.getItem('lhtv:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                  set(k, v) { try { localStorage.setItem('lhtv:' + k, JSON.stringify(v)); } catch {} } };

  /* ---------- Bộ tư thế ---------- */
  const SHEETS = {
    nu: { cw: 161, ch: 246, stand: 242, img: null },
    nam: { cw: 193, ch: 260, stand: 249, img: null }
  };
  // 0-3 đi xuống (về phía màn hình) · 4-7 đi lên · 8-11 sang trái · 12-15 sang phải
  // 16 đứng chắp tay · 17 đứng cúi · 18 ngồi chắp tay · 19 lạy sát đất · 22 ngồi cúi đầu · 23 ngồi thiền
  const F = { down: 0, up: 4, left: 8, right: 12, stand: 16, standBow: 17, sit: 18, prostrate: 19, sitBow: 22, zen: 23 };

  /* ---------- Hình học ---------- */
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

  /* ---------- Các cảnh ----------
     hz, k: chiều cao người đứng tại chân y = k·(y − hz)
     floor: vùng đi được · block: vật cản · exits: [vùng, cảnh tới, chỗ xuất hiện [x,y], hướng nhìn]
     urn: lư hương {stand: chỗ đứng, face, plant: miệng lư} */
  const ROOMS = {
    hall: { name: 'Chánh điện', img: 'assets/song/nen.jpg', fg: 'assets/song/truoc.png', fgY: 660, hz: 472.4, k: .525,
      floor: [[798, 556], [892, 556], [1430, 648], [1672, 712], [1672, 900], [1388, 900], [1388, 818], [292, 818], [292, 900], [0, 900], [0, 712], [250, 648]],
      block: [[180, 730, 290, 812]],                                         // chỗ thầy ngồi
      exits: [[[790, 540, 900, 563], 'cua', [836, 900], 'up'], [[0, 690, 14, 900], 'cua-hong', [836, 900], 'up'], [[1658, 690, 1672, 900], 'lau-trong', [836, 900], 'up']],
      urn: { stand: [845, 806], face: 'down', plant: [843, 800], len: 58 } },
    'cua': { urn3d: { bb: [755, 423, 917, 606], elev: 12 }, name: 'Cửa Chánh điện', img: 'assets/ngoai/cua.jpg', hz: 470, k: .6,
      floor: [[222, 941], [1450, 941], [1450, 742], [1085, 522], [600, 522], [222, 742]],
      block: [[238, 560, 425, 835], [1245, 560, 1440, 835], [735, 534, 935, 620]],
      exits: [[[560, 500, 1110, 532], 'san', [836, 905], 'up'], [[222, 932, 1450, 941], 'hall', [845, 575], 'down']],
      urn: { stand: [836, 640], face: 'up', plant: [836, 462], len: 26 } },
    'cua-hong': { urn3d: { bb: [754, 422, 918, 606], elev: 12 }, name: 'Thềm Chánh điện', img: 'assets/ngoai/cua-hong.jpg', hz: 470, k: .6,
      floor: [[222, 941], [1450, 941], [1450, 742], [1085, 522], [600, 522], [222, 742]],
      block: [[238, 560, 425, 835], [1245, 560, 1440, 835], [735, 534, 935, 620]],
      exits: [[[560, 500, 1110, 532], 'san', [836, 905], 'up'], [[222, 932, 1450, 941], 'hall', [60, 790], 'right']],
      urn: { stand: [836, 640], face: 'up', plant: [836, 462], len: 26 } },
    'san': { urn3d: { bb: [682, 511, 988, 847], elev: 8 }, name: 'Sân chùa', img: 'assets/ngoai/san.jpg', hz: 470, k: .6,
      floor: [[0, 941], [1672, 941], [1672, 822], [1112, 560], [1042, 500], [628, 500], [558, 560], [0, 822]],
      block: [[690, 545, 985, 850]],
      exits: [[[600, 490, 1070, 510], 'san-gan', [560, 905], 'up'], [[0, 924, 1672, 941], 'mat-tien', [836, 905], 'up'],
              [[0, 800, 12, 941], 'bo-de', [1590, 880], 'left'], [[1660, 800, 1672, 941], 'quan-am', [90, 880], 'right']],
      urn: { stand: [836, 905], face: 'up', plant: [836, 588], len: 50 } },
    'san-gan': { urn3d: { bb: [677, 584, 1071, 940], elev: 6 }, name: 'Sân trước Tam Quan', img: 'assets/ngoai/san-gan.jpg', hz: 470, k: .6,
      floor: [[0, 941], [1672, 941], [1672, 782], [1122, 560], [1000, 528], [700, 528], [560, 560], [0, 782]],
      block: [[660, 560, 1080, 941]],
      exits: [[[680, 515, 1020, 538], 'tam-quan', [836, 905], 'up'], [[0, 930, 650, 941], 'mat-tien', [836, 905], 'up'], [[1090, 930, 1672, 941], 'mat-tien', [836, 905], 'up'],
              [[0, 760, 12, 941], 'bo-de', [1590, 880], 'left'], [[1660, 760, 1672, 941], 'quan-am', [90, 880], 'right']] },
    'tam-quan': { name: 'Cổng Tam Quan', img: 'assets/ngoai/tam-quan.jpg', hz: 520, k: .62,
      floor: [[300, 941], [1380, 941], [1380, 702], [1230, 672], [440, 672], [300, 702]],
      exits: [[[300, 930, 1380, 941], 'mat-tien', [836, 905], 'up'], [[720, 660, 960, 680], 'soon:Đường làng', null]] },
    'mat-tien': { urn3d: { bb: [699, 518, 970, 829], elev: 8 }, name: 'Mặt tiền Chánh điện', img: 'assets/ngoai/mat-tien.jpg', hz: 480, k: .6,
      floor: [[332, 941], [1338, 941], [1338, 642], [1098, 626], [1090, 522], [580, 522], [572, 626], [332, 642]],
      block: [[690, 600, 985, 838]],
      exits: [[[640, 505, 1030, 530], 'hall', [845, 575], 'down'], [[332, 930, 1338, 941], 'san', [836, 905], 'up'],
              [[332, 640, 345, 941], 'lau-chuong', [1590, 880], 'left'], [[1325, 640, 1338, 941], 'lau-trong', [836, 905], 'up']],
      urn: { stand: [836, 905], face: 'up', plant: [836, 600], len: 46 } },
    'bo-de': { name: 'Gốc Bồ Đề', img: 'assets/ngoai/bo-de.jpg', hz: 520, k: .62,
      floor: [[0, 941], [1672, 941], [1672, 780], [1562, 742], [1452, 562], [1382, 540], [1332, 562], [1332, 742], [0, 742]],
      exits: [[[1330, 530, 1460, 552], 'lau-chuong', [836, 905], 'up'], [[0, 930, 1672, 941], 'san', [836, 905], 'up'], [[1660, 760, 1672, 941], 'san', [90, 880], 'right']] },
    'quan-am': { name: 'Hồ sen · Tượng Quan Âm', img: 'assets/ngoai/quan-am.jpg', hz: 500, k: .62,
      floor: [[0, 941], [1672, 941], [1672, 746], [1012, 746], [982, 602], [748, 602], [720, 746], [0, 746]],
      exits: [[[748, 596, 982, 612], 'lau-trong', [836, 905], 'up'], [[0, 930, 1672, 941], 'san', [836, 905], 'up'], [[0, 746, 12, 941], 'san', [1590, 880], 'left']],
      act: [[750, 600, 990, 640], 'quanam'] },
    'lau-chuong': { name: 'Lầu Chuông', img: 'assets/ngoai/lau-chuong.jpg', hz: 560, k: .66,
      floor: [[0, 941], [1672, 941], [1672, 802], [1052, 802], [1042, 722], [648, 722], [640, 802], [0, 802]],
      exits: [[[0, 802, 12, 941], 'bo-de', [1590, 880], 'left'], [[1660, 802, 1672, 941], 'hanh-lang', [500, 905], 'up'], [[0, 930, 1672, 941], 'mat-tien', [836, 905], 'up']],
      act: [[648, 718, 1042, 740], 'chuong'] },
    'lau-trong': { name: 'Lầu Trống', img: 'assets/ngoai/lau-trong.jpg', hz: 480, k: .6,
      floor: [[222, 941], [1450, 941], [1450, 846], [1322, 752], [1322, 652], [362, 652], [362, 752], [222, 846]],
      exits: [[[222, 930, 1450, 941], 'hall', [1610, 790], 'left']],
      act: [[700, 648, 990, 670], 'trong'] },
    'hanh-lang': { name: 'Hành lang', img: 'assets/ngoai/hanh-lang.jpg', hz: 470, k: .6,
      floor: [[150, 941], [1262, 941], [1202, 802], [962, 602], [890, 572], [730, 572], [600, 642], [150, 832]],
      exits: [[[700, 560, 900, 582], 'soon:Vườn Thiền', null], [[150, 930, 1262, 941], 'lau-chuong', [1590, 880], 'left']] }
  };

  /* ---------- Chỗ ngồi trong chánh điện ---------- */
  const hallH = y => ROOMS.hall.k * (y - ROOMS.hall.hz);            // chiều cao người đứng
  const carpetX = y => { const t = (y - 548) / (790 - 548); return [806 + (732 - 806) * t, 884 + (958 - 884) * t]; };
  const NAMES = { '323,794': ['Minh Tâm', 'nu'], '487,792': ['Quang Huy', 'nam'], '677,782': ['Liên Hoa', 'nu'],
                  '1024,788': ['An Nhiên', 'nu'], '1193,792': ['Từ Hạnh', 'nu'], '1353,792': ['Nhật Minh', 'nam'] };
  const SEATS = [];
  [[323, 794], [487, 792], [677, 782], [1024, 788], [1193, 792], [1353, 792]].forEach(([x, y]) => SEATS.push({ x, y, front: true }));
  SEATS.push({ x: 845, y: 778, mine: true });                            // chỗ của Bạn trên thảm đỏ
  for (const y of [702, 657, 624, 600, 583, 570]) {
    const h = hallH(y), gap = .66 * h, [cl, cr] = carpetX(y);
    const l0 = 268 + (556 - 268) * (702 - y) / (702 - 570);              // mép tường trái của khối ghế
    const lEnd = cl - .32 * h, rStart = cr + .32 * h, rEnd = 1672 - l0 + 20;
    const nL = Math.max(1, Math.floor((lEnd - l0) / gap) + 1), nR = Math.max(1, Math.floor((rEnd - rStart) / gap) + 1);
    for (let i = 0; i < nL; i++) SEATS.push({ x: lEnd - i * (lEnd - l0) / Math.max(1, nL - 1), y });
    for (let i = 0; i < nR; i++) SEATS.push({ x: rStart + i * (rEnd - rStart) / Math.max(1, nR - 1), y });
  }
  const MAX_AO = SEATS.length - 1;

  /* ---------- Nhân vật ---------- */
  let uid = 0;
  function makePerson(o) {
    return Object.assign({ id: ++uid, sheet: Math.random() < .55 ? 'nu' : 'nam', fx: 0, fy: 0, room: 'hall', mode: 'seat', frame: F.sit,
      dir: 'down', walkT: 0, busy: false, seat: null, flip: Math.random() < .5, holding: false, target: null, name: null }, o);
  }
  const people = [];
  const me = makePerson({ sheet: 'nam', name: 'Bạn', me: true, flip: false });
  function seatPerson(p, s) { p.seat = s; s.owner = p; p.fx = s.x; p.fy = s.y; p.mode = 'seat'; p.frame = F.sit; p.room = 'hall'; }
  seatPerson(me, SEATS.find(s => s.mine)); people.push(me);

  let aoCount = Math.min(MAX_AO, store.get('ao', MAX_AO - 4));
  function syncVirtual() {
    const npcs = people.filter(p => !p.me && p.room === 'hall');
    while (npcs.length < aoCount) {
      const free = SEATS.filter(s => !s.owner && !s.mine);
      if (!free.length) break;
      const s = free.find(s => s.front) || pick(free);
      const key = s.x + ',' + s.y, nm = NAMES[key];
      const p = makePerson(nm ? { name: nm[0], sheet: nm[1], flip: false } : {});
      seatPerson(p, s); people.push(p); npcs.push(p);
    }
    while (npcs.length > aoCount) {                                         // bớt người ở hàng sau trước
      const p = npcs.filter(p => !p.busy && p.mode === 'seat').sort((a, b) => a.fy - b.fy)[0]; if (!p) break;
      p.seat.owner = null; people.splice(people.indexOf(p), 1); npcs.splice(npcs.indexOf(p), 1);
      if (tags[p.id]) { tags[p.id].remove(); delete tags[p.id]; }
    }
    dispatchEvent(new CustomEvent('chua-count', { detail: count() }));
  }
  const count = () => people.filter(p => p.room === 'hall' && !p.me).length + 1;

  /* ---------- Thẻ tên ---------- */
  const scene = document.getElementById('scene');
  const aura = document.getElementById('me-aura');
  const tags = {};
  function tagFor(p) {
    if (!p.name) return null;
    if (!tags[p.id]) { const el = document.createElement('div'); el.className = 'tag' + (p.me ? ' me' : ''); el.textContent = p.name; scene.appendChild(el); tags[p.id] = el; }
    return tags[p.id];
  }

  /* ---------- Tải ảnh ---------- */
  const imgs = {}; let monk = null, ready = false;
  Promise.all([
    load('assets/song/nu.png').then(i => SHEETS.nu.img = i), load('assets/song/nam.png').then(i => SHEETS.nam.img = i),
    load('assets/song/monk.png').then(i => monk = i), load(ROOMS.hall.img).then(i => imgs.hall = i), load(ROOMS.hall.fg).then(i => imgs.hallFg = i)
  ]).then(() => { ready = true; document.documentElement.classList.add('song-ready'); syncVirtual();
    Object.keys(ROOMS).forEach(k => k !== 'hall' && load(ROOMS[k].img).then(i => imgs[k] = i)); });

  /* ---------- Vẽ ---------- */
  let room = 'hall';
  const R = () => ROOMS[room];
  const hAt = (y, rm = R()) => Math.max(26, rm.k * (y - rm.hz));
  function drawCushion(x, y, h) {
    const rx = .36 * h, ry = .095 * h;
    ctx.save(); ctx.translate(x, y - ry * .55);
    ctx.fillStyle = 'rgba(40,20,10,.28)'; ctx.beginPath(); ctx.ellipse(0, ry * .5, rx * 1.06, ry * 1.1, 0, 0, 7); ctx.fill();
    const g = ctx.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, '#9a6236'); g.addColorStop(.55, '#74431f'); g.addColorStop(1, '#4e2b12');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,150,.22)'; ctx.lineWidth = Math.max(1, h * .008); ctx.beginPath(); ctx.ellipse(0, -ry * .15, rx * .78, ry * .62, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  function drawPerson(p) {
    const S = SHEETS[p.sheet]; if (!S.img) return;
    const rm = ROOMS[p.room], h = hAt(p.fy, rm), s = h / S.stand;
    let f = p.frame;
    if (p.mode === 'walk') f = F[p.dir] + ((p.walkT * 8) | 0) % 4;
    const col = f % 4, row = (f / 4) | 0, dw = S.cw * s, dh = S.ch * s;
    const flip = p.flip && p.mode !== 'walk' && f >= 16;
    ctx.save(); ctx.translate(p.fx, p.fy + 1);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(S.img, col * S.cw, row * S.ch, S.cw, S.ch, -dw / 2, -dh, dw, dh);
    ctx.restore();
    if (p.holding) drawHeldSticks(p, h);
    const el = tagFor(p);
    if (el) { const top = p.fy - h * (f === F.prostrate ? .45 : f >= 18 ? .9 : 1.02); el.style.left = p.fx.toFixed(1) + 'px'; el.style.top = (top - 10).toFixed(1) + 'px'; }
  }
  // Hương: que đỏ, đầu đỏ lửa, khói mỏng
  const sticks = [], flying = [];
  function stick(x, y, len, t, a = 1) {
    ctx.strokeStyle = `rgba(178,34,40,${a})`; ctx.lineWidth = Math.max(1.4, len * .045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - len); ctx.stroke();
    const r = Math.max(2, len * .07), g = ctx.createRadialGradient(x, y - len, 0, x, y - len, r * 2.6);
    g.addColorStop(0, `rgba(255,236,170,${a})`); g.addColorStop(.35, `rgba(255,120,40,${.9 * a})`); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - len, r * 2.6, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) {                                           // khói
      const k = ((t * .35 + i * .25) % 1), sy = y - len - k * len * 1.6, sx = x + Math.sin(t * 1.3 + i * 2 + x) * len * .12 * k;
      ctx.fillStyle = `rgba(235,235,235,${.16 * (1 - k) * a})`; ctx.beginPath(); ctx.arc(sx, sy, len * (.05 + k * .12), 0, 7); ctx.fill();
    }
  }
  function drawHeldSticks(p, h) {
    const t = performance.now() / 1000, len = h * .2, hy = p.fy - h * (p.dir === 'up' && p.frame < 16 ? .56 : .5);
    for (const dx of [-.025, 0, .025]) stick(p.fx + dx * h, hy, len, t);
  }

  /* ---------- Chuyển động ---------- */
  function walkable(x, y, rm = R()) {
    if (!inPoly(x, y, rm.floor)) return false;
    for (const b of rm.block || []) if (inRect(x, y, b)) return false;
    return true;
  }
  const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) * .8 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  function walkTo(p, x, y) { return new Promise(res => { p.mode = 'walk'; p.target = [x, y]; p.arrive = res; }); }
  async function walkPath(p, pts) { for (const [x, y] of pts) { if (p.room !== room && p.room === 'gone') return; await walkTo(p, x, y); } }
  function stepWalker(p, dt) {
    if (p.mode !== 'walk' || !p.target) return;
    const [tx, ty] = p.target, dx = tx - p.fx, dy = ty - p.fy, d = Math.hypot(dx, dy);
    const v = .78 * hAt(p.fy, ROOMS[p.room]) * dt;
    p.dir = dirOf(dx, dy); p.walkT += dt;
    if (d <= v) { p.fx = tx; p.fy = ty; p.target = null; p.mode = 'pose'; p.frame = F.stand; const a = p.arrive; p.arrive = null; a && a(); }
    else { p.fx += dx / d * v; p.fy += dy / d * v; }
  }
  async function standUp(p) {
    if (p.mode !== 'seat') return;
    p.mode = 'pose'; p.frame = F.sit; await sleep(200); p.frame = F.stand; await sleep(300);
  }
  async function sitAt(p, s) {
    if (s.owner && s.owner !== p) return false;
    if (p.seat && p.seat !== s && p.seat.owner === p) p.seat.owner = null;
    s.owner = p; p.seat = s;
    if (Math.hypot(p.fx - s.x, p.fy - s.y) > 3) await walkTo(p, s.x, s.y);
    p.frame = F.stand; await sleep(180); p.frame = F.sit; p.mode = 'seat';
    return true;
  }
  async function prostrate(p, n = 3) {
    const seated = p.mode === 'seat';
    for (let i = 0; i < n; i++) {
      if (seated) { p.frame = F.sit; await sleep(450); p.frame = F.sitBow; await sleep(450); p.frame = F.prostrate; await sleep(1100); p.frame = F.sit; await sleep(400); }
      else { p.mode = 'pose'; p.frame = F.stand; await sleep(400); p.frame = F.standBow; await sleep(450); p.frame = F.sit; await sleep(350); p.frame = F.prostrate; await sleep(1100); p.frame = F.sit; await sleep(350); p.frame = F.stand; await sleep(300); }
    }
  }
  function bowOnce(p, ms = 900) {
    if (p.busy) return;
    if (p.mode === 'seat') { p.frame = F.sitBow; setTimeout(() => p.mode === 'seat' && p.frame === F.sitBow && (p.frame = F.sit), ms); }
    else if (p.mode === 'pose') { p.frame = F.standBow; setTimeout(() => p.mode === 'pose' && p.frame === F.standBow && (p.frame = F.stand), ms); }
  }
  // Thắp hương: đến trước lư hương, cầm hương vái ba vái, cắm vào lư
  async function incense(p) {
    const u = ROOMS[p.room].urn; if (!u) return false;
    if (p.mode === 'seat') await standUp(p);
    const [sx, sy] = u.stand;
    if (p.room === 'hall' && Math.abs(p.fx - sx) > 40) await walkTo(p, p.fx, Math.max(p.fy, 800));  // ra lối trước bàn
    await walkTo(p, sx + (p.me ? 0 : rnd(-30, 30)), sy);
    p.mode = 'pose'; p.dir = u.face; p.frame = u.face === 'up' ? F.up : F.stand;
    p.holding = true; await sleep(700);
    for (let i = 0; i < 3; i++) { if (u.face !== 'up') { p.frame = F.standBow; await sleep(600); p.frame = F.stand; } await sleep(500); }
    p.holding = false;
    const h = hAt(p.fy, ROOMS[p.room]);
    const from = [p.fx, p.fy - h * .5], to = [u.plant[0] + rnd(-u.len * .5, u.len * .5), u.plant[1]];
    flying.push({ room: p.room, from, to, len: u.len, t0: performance.now() });
    if (u.face !== 'up') p.frame = F.standBow;
    await sleep(650); p.frame = u.face === 'up' ? F.up : F.stand;
    if (ROOMS[p.room].urn3d && window.Urn3D && Urn3D.ok()) Urn3D.plant(3);
    else for (const dx of [-.12, 0, .12]) sticks.push({ room: p.room, x: to[0] + dx * u.len, y: to[1] + Math.abs(dx) * 4, len: u.len * rnd(.9, 1.05), t0: performance.now() });
    while (sticks.length > 60) sticks.shift();
    dispatchEvent(new CustomEvent('chua-huong', { detail: { me: !!p.me } }));
    await sleep(500);
    return true;
  }

  /* ---------- Phật tử tự sinh hoạt ---------- */
  const hallSpots = () => ({
    door: [[836 + rnd(-20, 20), 572]],
    left: [[rnd(70, 230), rnd(735, 800)]], right: [[rnd(1450, 1600), rnd(735, 800)]],
    wander: [[rnd(300, 1380), rnd(700, 810)]]
  });
  async function outing(p, kind) {
    if (p.busy || p.mode !== 'seat' || p.room !== 'hall') return; p.busy = true;
    try {
      if (kind === 'lay') { await prostrate(p, 3); return; }
      await standUp(p);
      const lane = [p.fx, Math.min(812, Math.max(p.fy + 14, 806))];
      if (kind === 'huong') { await walkTo(p, ...lane); await incense(p); }
      else {
        const sp = hallSpots()[kind] || hallSpots().wander;
        const via = kind === 'door' ? [lane, [p.fx < 845 ? 770 : 920, 806], [845 + rnd(-30, 30), 680]] : kind === 'wander' ? [] : [lane];
        for (const pt of [...via, ...sp]) await walkTo(p, ...pt);
        p.frame = kind === 'door' || kind === 'left' || kind === 'right' ? F.up : F.stand;
        if (kind === 'left' || kind === 'right') { p.mode = 'pose'; p.frame = F.up; }
        await sleep(rnd(2200, 4200));
        p.frame = F.standBow; await sleep(800); p.frame = F.stand;
        for (const pt of via.reverse()) await walkTo(p, ...pt);
      }
      if (p.fy < 800 && Math.abs(p.fy - p.seat.y) > 20) await walkTo(p, p.fx, Math.max(p.seat.y + 14, Math.min(812, p.fy)));
      await walkTo(p, p.seat.x, Math.min(812, p.seat.y + 16));
      await sitAt(p, p.seat);
    } finally { p.busy = false; }
  }
  // người đi dạo ngoài sân
  async function stroll(p) {
    const rm = ROOMS[p.room];
    while (p.room !== 'gone') {
      let x, y, n = 0;
      do { x = rnd(0, W); y = rnd(rm.hz + 60, 935); n++; } while (!walkable(x, y, rm) && n < 60);
      if (n < 60) await walkTo(p, x, y);
      p.mode = 'pose'; p.frame = Math.random() < .5 ? F.up : F.stand;
      if (rm.urn && Math.random() < .25) await incense(p);
      await sleep(rnd(1500, 4000));
    }
  }

  /* ---------- Bạn ---------- */
  let input = { x: 0, y: 0 }, meIdle = 0, meBusy = false, switching = false;
  async function stepMe(dt) {
    if (switching) return;
    const mag = Math.hypot(input.x, input.y);
    if (mag > .15 && !meBusy) {
      meIdle = 0;
      if (me.mode === 'seat') { meBusy = true; if (me.seat) { me.seat.owner = null; } await standUp(me); me.mode = 'pose'; meBusy = false; return; }
      if (me.target) return;
      me.mode = 'walk';
      const h = hAt(me.fy), v = .9 * h * Math.min(1, mag) * dt;
      const nx = me.fx + input.x / mag * v, ny = me.fy + input.y / mag * v * .8;
      // ra khỏi cảnh?
      for (const [r, to, at, face] of R().exits) {
        if (inRect(nx, ny, r)) {
          if (to.startsWith('soon:')) { if (!me.soonShown) { me.soonShown = true; dispatchEvent(new CustomEvent('chua-soon', { detail: to.slice(5) })); setTimeout(() => me.soonShown = false, 4000); } break; }
          return go(to, at, face);
        }
      }
      if (walkable(nx, ny)) { me.fx = nx; me.fy = ny; }
      else if (walkable(nx, me.fy) && Math.abs(input.x) > .3) me.fx = nx;
      else if (walkable(me.fx, ny)) me.fy = ny;
      else {                                                                // vướng vật cản: tự lách sang bên
        const b = (R().block || []).find(b => inRect(nx, ny, b));
        if (b) { const sx = me.fx < (b[0] + b[2]) / 2 ? -1 : 1, x2 = me.fx + sx * v * 1.2; if (walkable(x2, me.fy)) me.fx = x2; }
        else {                                                              // chạm mép: trượt theo mép về phía giữa
          const x2 = me.fx + Math.sign(836 - me.fx) * v; if (walkable(x2, ny)) { me.fx = x2; me.fy = ny; } else if (walkable(x2, me.fy)) me.fx = x2;
        }
      }
      me.dir = dirOf(input.x, input.y * .8); me.walkT += dt;
      const a = R().act;
      if (a && inRect(me.fx, me.fy, a[0]) && !me.actDone) { me.actDone = true; dispatchEvent(new CustomEvent('chua-act', { detail: a[1] })); setTimeout(() => me.actDone = false, 5000); }
    } else if (me.mode === 'walk' && !me.target) {
      me.mode = 'pose'; me.frame = me.dir === 'up' ? F.up : F.stand;
    } else if (me.mode === 'pose' && !meBusy && room === 'hall') {
      meIdle += dt;                                                         // đứng yên trên một thảm trống thì ngồi xuống
      if (meIdle > 1.1) {
        const s = SEATS.find(s => (!s.owner || s.owner === me) && Math.hypot(s.x - me.fx, s.y - me.fy) < .2 * hallH(s.y));
        if (s) { meBusy = true; me.busy = true; await sitAt(me, s); me.busy = false; meBusy = false; }
        meIdle = 0;
      }
    }
  }
  const strollers = [];
  async function go(to, at, face = 'up') {
    if (switching || !ROOMS[to]) return;
    switching = true;
    if (me.seat && me.seat.owner === me) me.seat.owner = null;
    fadeT = 1;                                                              // chuyển cảnh mờ dần
    await sleep(260);
    strollers.splice(0).forEach(p => { p.room = 'gone'; const i = people.indexOf(p); i >= 0 && people.splice(i, 1); });
    room = to; me.room = to; me.mode = 'pose'; me.target = null;
    [me.fx, me.fy] = at || [836, 900]; me.dir = face; me.frame = face === 'up' ? F.up : F.stand;
    if (!walkable(me.fx, me.fy)) { const c = R().floor; me.fx = 836; me.fy = 900; if (!walkable(me.fx, me.fy)) [me.fx, me.fy] = c[0]; }
    if (to !== 'hall') {                                                    // vài Phật tử đang dạo ngoài sân
      const n = (Math.random() * 3) | 0;
      for (let i = 0; i < n; i++) {
        let x, y, k = 0; const rm = R();
        do { x = rnd(0, W); y = rnd(rm.hz + 80, 900); k++; } while (!walkable(x, y, rm) && k < 80);
        if (k >= 80) continue;
        const p = makePerson({ room: to, fx: x, fy: y, mode: 'pose', frame: F.stand }); people.push(p); strollers.push(p); stroll(p);
      }
    }
    Object.values(tags).forEach(el => el.style.display = 'none');
    dispatchEvent(new CustomEvent('chua-room', { detail: { room: to, name: R().name } }));
    switching = false;
  }

  /* ---------- Vòng lặp ---------- */
  let last = performance.now(), nextBow = 2, nextTrip = 3, fadeT = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
    if (ready) {
      for (const p of people) if (p.room === room || p.room === 'hall') stepWalker(p, dt);
      stepMe(dt);
      if (room === 'hall' || true) {
        nextBow -= dt;
        if (nextBow <= 0) { nextBow = rnd(.8, 2.6); const p = pick(people); if (p && !p.me && p.room === 'hall') bowOnce(p, rnd(700, 1400)); }
        nextTrip -= dt;
        if (nextTrip <= 0) {
          nextTrip = rnd(3, 7);
          const busy = people.filter(p => p.busy && !p.me && p.room === 'hall').length;
          const free = people.filter(p => !p.me && !p.busy && p.mode === 'seat' && p.room === 'hall');
          if (free.length && busy < 4) { const r = Math.random(); outing(pick(free), r < .22 ? 'door' : r < .44 ? 'huong' : r < .62 ? 'lay' : r < .74 ? 'left' : r < .86 ? 'right' : 'wander'); }
        }
      }
      // vẽ
      const bg = room === 'hall' ? imgs.hall : imgs[room];
      if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#2a1408'; ctx.fillRect(0, 0, W, H); }
      const vis = people.filter(p => p.room === room);
      const items = vis.map(p => ({ y: p.fy, draw: () => drawPerson(p) }));
      if (room === 'hall') {
        SEATS.forEach(s => items.push({ y: s.y - .5, draw: () => drawCushion(s.x, s.y, hallH(s.y)) }));
        if (monk) items.push({ y: 802, draw: () => { const b = 1 + Math.sin(t * 1.2) * .006; ctx.drawImage(monk, 198, 693 + 106 * (1 - b), 75, 106 * b); } });
      }
      const u3 = R().urn3d;
      if (u3 && window.Urn3D && Urn3D.ok()) items.push({ y: u3.bb[3], draw: () => Urn3D.draw(ctx, u3, t) });
      items.sort((a, b) => a.y - b.y).forEach(i => i.draw());
      if (room === 'hall' && imgs.hallFg) ctx.drawImage(imgs.hallFg, 0, ROOMS.hall.fgY);
      sticks.forEach(s => { if (s.room !== room) return; const age = (now - s.t0) / 1000, a = age > 80 ? Math.max(0, 1 - (age - 80) / 10) : 1; if (a > 0) stick(s.x, s.y, s.len * (1 - Math.min(.5, age / 200)), t, a); });
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i], k = (now - f.t0) / 600; if (k >= 1) { flying.splice(i, 1); continue; }
        if (f.room !== room) continue;
        const x = f.from[0] + (f.to[0] - f.from[0]) * k, y = f.from[1] + (f.to[1] - f.from[1]) * k - Math.sin(k * Math.PI) * 30;
        stick(x, y, f.len, t);
      }
      people.forEach(p => { const el = tags[p.id]; if (el) el.style.display = p.room === room ? '' : 'none'; });
      if (aura) { aura.style.display = room === 'hall' ? '' : 'none'; aura.style.left = me.fx + 'px'; aura.style.top = (me.fy - hAt(me.fy) * .5) + 'px'; }
      if (fadeT > 0) { ctx.fillStyle = `rgba(20,10,4,${Math.min(1, fadeT)})`; ctx.fillRect(0, 0, W, H); fadeT -= dt * 2.2; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  cv.addEventListener('click', e => {
    const u3 = R().urn3d; if (!u3 || !window.Urn3D) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    if (inRect(x, y, u3.bb)) Urn3D.open();
  });
  cv.addEventListener('mousemove', e => {
    const u3 = R().urn3d; if (!u3) { cv.style.cursor = ''; return; }
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    cv.style.cursor = inRect(x, y, u3.bb) ? 'pointer' : '';
  });

  /* ---------- Giao tiếp với app.js ---------- */
  const hallNpcs = () => people.filter(p => !p.me && p.room === 'hall');
  window.Nguoi = {
    drive(x, y) { input = { x, y }; },
    me: () => ({ x: me.fx, y: me.fy, standing: me.mode !== 'seat', room }),
    room: () => room, roomName: () => R().name,
    go: (to, at, face) => go(to, at || (to === 'hall' ? [845, 600] : [836, 900]), face || (to === 'hall' ? 'down' : 'up')),
    bow(key, depth, ms) { if (key === 'ban') { if (!meBusy) bowOnce(me, ms || 900); } },
    bowAll(depth, ms) { hallNpcs().forEach(p => setTimeout(() => bowOnce(p, ms || 1200), rnd(100, 700))); if (!meBusy) bowOnce(me, ms || 1200); },
    beat() { bowOnce(me, 380); for (let i = 0; i < 4; i++) { const p = pick(hallNpcs()); p && bowOnce(p, 380); } },
    async layPhat(times = 3) {
      if (room === 'hall') hallNpcs().filter(p => !p.busy && p.mode === 'seat').forEach(p => { p.busy = true; setTimeout(() => prostrate(p, times).then(() => p.busy = false), rnd(100, 700)); });
      strollers.forEach(p => p.mode !== 'walk' && prostrate(p, 1));
      if (meBusy) return; meBusy = true; me.busy = true; await prostrate(me, times); me.busy = false; meBusy = false;
    },
    async incense() {
      if (meBusy) return false;
      if (!R().urn) return false;
      meBusy = true; me.busy = true;
      if (me.seat && me.seat.owner === me) me.seat.owner = null;
      try { return await incense(me); } finally { me.busy = false; meBusy = false; }
    },
    meditate(on) { if (me.mode === 'seat') me.frame = on ? F.zen : F.sit; },
    count, maxAo: () => MAX_AO, ao: () => aoCount,
    setAo(n) { aoCount = Math.max(0, Math.min(MAX_AO, n | 0)); store.set('ao', aoCount); syncVirtual(); return aoCount; },
    allLay() { hallNpcs().filter(p => !p.busy && p.mode === 'seat').forEach(p => { p.busy = true; setTimeout(() => prostrate(p, 3).then(() => p.busy = false), rnd(100, 900)); }); },
    outing: (i, kind) => { const p = hallNpcs()[i]; p && outing(p, kind); }
  };
})();
