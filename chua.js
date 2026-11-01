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
    nam: { cw: 256, ch: 256, stand: 241, img: null },
    tt: { cw: 256, ch: 256, stand: 241, img: null }                       // trụ trì: cà sa đỏ, đầu cạo
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
      block: [],
      exits: [[[790, 540, 900, 563], 'cua', [836, 900], 'up'],                              // cửa chính
              [[0, 640, 150, 735], 'lau-chuong', [836, 905], 'up'], [[1522, 640, 1672, 735], 'lau-trong', [836, 905], 'up']],   // cửa trái ra Lầu Chuông, cửa phải ra Lầu Trống
      urn: { stand: [845, 806], face: 'down', plant: [843, 800], len: 58 } },
    'cua': { lu: { src: 'assets/ngoai/lu-cua.png', at: [755, 423, 164, 184] }, name: 'Cửa Chánh điện', img: 'assets/ngoai/cua.jpg', hz: 470, k: .6,
      floor: [[222, 941], [1450, 941], [1450, 742], [1085, 522], [600, 522], [222, 742]],
      block: [[425, 560, 515, 640], [1157, 560, 1250, 640], [600, 505, 645, 552], [1030, 505, 1070, 552], [675, 490, 700, 515], [975, 490, 1000, 515], [238, 560, 425, 835], [1245, 560, 1440, 835], [762, 566, 910, 616]],
      exits: [[[560, 500, 1110, 532], 'san', [836, 905], 'up'], [[222, 932, 1450, 941], 'hall', [845, 575], 'down']],
      urn: { stand: [836, 640], face: 'up', plant: [836, 462], len: 26 } },
    'cua-hong': { lu: { src: 'assets/ngoai/lu-cua.png', at: [755, 423, 164, 184] }, name: 'Thềm Chánh điện', img: 'assets/ngoai/cua-hong.jpg', hz: 470, k: .6,
      floor: [[222, 941], [1450, 941], [1450, 742], [1085, 522], [600, 522], [222, 742]],
      block: [[425, 560, 515, 640], [1157, 560, 1250, 640], [600, 505, 645, 552], [1030, 505, 1070, 552], [675, 490, 700, 515], [975, 490, 1000, 515], [238, 560, 425, 835], [1245, 560, 1440, 835], [762, 566, 910, 616]],
      exits: [[[560, 500, 1110, 532], 'san', [836, 905], 'up'], [[222, 932, 1450, 941], 'hall', [60, 790], 'right']],
      urn: { stand: [836, 640], face: 'up', plant: [836, 462], len: 26 } },
    'san': { lu: { src: 'assets/ngoai/lu-san.png', at: [682, 512, 307, 337] }, name: 'Sân chùa', img: 'assets/ngoai/san.jpg', hz: 470, k: .6,
      floor: [[0, 941], [1672, 941], [1672, 822], [1112, 560], [1042, 500], [628, 500], [558, 560], [0, 822]],
      block: [[185, 620, 330, 765], [1365, 620, 1510, 765], [350, 600, 462, 670], [1210, 600, 1330, 670], [490, 540, 550, 605], [1125, 540, 1190, 605], [702, 782, 968, 852]],
      exits: [[[600, 490, 1070, 510], 'san-gan', [560, 905], 'up'], [[0, 924, 1672, 941], 'mat-tien', [836, 905], 'up'],
              [[0, 800, 12, 941], 'bo-de', [1590, 880], 'left'], [[1660, 800, 1672, 941], 'quan-am', [90, 880], 'right']],
      urn: { stand: [836, 905], face: 'up', plant: [836, 588], len: 50 } },
    'san-gan': { lu: { src: 'assets/ngoai/lu-san-gan.png', at: [677, 584, 395, 357] }, name: 'Sân trước Tam Quan', img: 'assets/ngoai/san-gan.jpg', hz: 470, k: .6,
      floor: [[0, 941], [1672, 941], [1672, 782], [1122, 560], [1000, 528], [700, 528], [560, 560], [0, 782]],
      block: [[205, 600, 335, 785], [1410, 600, 1555, 790], [345, 600, 470, 690], [1295, 600, 1395, 690], [495, 560, 565, 645], [1215, 560, 1290, 650], [1128, 540, 1178, 600], [692, 862, 1058, 941]],
      exits: [[[680, 515, 1020, 538], 'tam-quan', [836, 905], 'up'], [[0, 930, 650, 941], 'mat-tien', [836, 905], 'up'], [[1090, 930, 1672, 941], 'mat-tien', [836, 905], 'up'],
              [[0, 760, 12, 941], 'bo-de', [1590, 880], 'left'], [[1660, 760, 1672, 941], 'quan-am', [90, 880], 'right']],
      urn: { stand: [874, 905], face: 'up', plant: [874, 676], len: 62 } },
    'tam-quan': { name: 'Cổng Tam Quan', img: 'assets/ngoai/tam-quan.jpg', hz: 520, k: .62,
      floor: [[300, 941], [1380, 941], [1380, 702], [1230, 672], [440, 672], [300, 702]],
      exits: [[[300, 930, 1380, 941], 'mat-tien', [836, 905], 'up'], [[720, 660, 960, 680], 'soon:Đường làng', null]] },
    'mat-tien': { lu: { src: 'assets/ngoai/lu-mat-tien.png', at: [699, 529, 272, 301] }, name: 'Mặt tiền Chánh điện', img: 'assets/ngoai/mat-tien.jpg', hz: 480, k: .6,
      floor: [[332, 941], [1338, 941], [1338, 642], [1098, 626], [1090, 522], [580, 522], [572, 626], [332, 642]],
      block: [[716, 766, 954, 836]],
      exits: [[[640, 505, 1030, 530], 'hall', [845, 575], 'down'], [[332, 930, 1338, 941], 'san', [836, 905], 'up'],
              [[332, 640, 345, 941], 'lau-chuong', [1590, 880], 'left'], [[1325, 640, 1338, 941], 'lau-trong', [836, 905], 'up']],
      urn: { stand: [836, 905], face: 'up', plant: [836, 600], len: 46 } },
    'bo-de': { name: 'Gốc Bồ Đề', img: 'assets/ngoai/bo-de.jpg', hz: 520, k: .62,
      floor: [[0, 941], [1672, 941], [1672, 780], [1562, 742], [1452, 562], [1382, 540], [1332, 562], [1332, 742], [0, 742]],
      block: [[60, 700, 185, 780], [1530, 700, 1660, 785]],
      exits: [[[1330, 530, 1460, 552], 'lau-chuong', [836, 905], 'up'], [[0, 930, 1672, 941], 'san', [836, 905], 'up'], [[1660, 760, 1672, 941], 'san', [90, 880], 'right']] },
    'quan-am': { name: 'Hồ sen · Tượng Quan Âm', img: 'assets/ngoai/quan-am.jpg', hz: 500, k: .62,
      floor: [[0, 941], [1672, 941], [1672, 746], [1012, 746], [982, 602], [748, 602], [720, 746], [0, 746]],
      exits: [[[748, 596, 982, 612], 'lau-trong', [836, 905], 'up'], [[0, 930, 1672, 941], 'san', [836, 905], 'up'], [[0, 746, 12, 941], 'san', [1590, 880], 'left']],
      act: [[1050, 746, 1250, 800], 'quanam'], shrine: { stand: [1110, 772] } },
    'lau-chuong': { tap: [[737, 415, 927, 679], 'chuong'], name: 'Lầu Chuông', img: 'assets/ngoai/lau-chuong.jpg', hz: 560, k: .66,
      floor: [[0, 941], [1672, 941], [1672, 802], [1052, 802], [1042, 722], [648, 722], [640, 802], [0, 802]],
      block: [[115, 780, 280, 845], [1415, 780, 1585, 845], [420, 795, 640, 840], [1045, 795, 1265, 830]],
      exits: [[[0, 802, 12, 941], 'bo-de', [1590, 880], 'left'], [[1660, 802, 1672, 941], 'hanh-lang', [500, 905], 'up'], [[0, 930, 1672, 941], 'hall', [200, 745], 'right']],
      act: [[648, 718, 1042, 740], 'chuong'] },
    'lau-trong': { tap: [[760, 361, 935, 519], 'trong'], name: 'Lầu Trống', img: 'assets/ngoai/lau-trong.jpg', hz: 480, k: .6,
      floor: [[222, 941], [1450, 941], [1450, 846], [1322, 752], [1322, 652], [362, 652], [362, 752], [222, 846]],
      exits: [[[222, 930, 1450, 941], 'hall', [1470, 745], 'left']],
      act: [[700, 648, 990, 670], 'trong'] },
    'hanh-lang': { name: 'Hành lang', img: 'assets/ngoai/hanh-lang.jpg', hz: 470, k: .6,
      floor: [[150, 941], [1262, 941], [1202, 802], [962, 602], [890, 572], [730, 572], [600, 642], [150, 832]],
      exits: [[[700, 560, 900, 582], 'soon:Vườn Thiền', null], [[150, 930, 1262, 941], 'lau-chuong', [1590, 880], 'left']] }
  };

  Object.entries(ROOMS).forEach(([k, v]) => v.key = k);
  /* ---------- Chỗ ngồi trong chánh điện ---------- */
  const hallH = y => ROOMS.hall.k * (y - ROOMS.hall.hz);            // chiều cao người đứng
  const carpetX = y => { const t = (y - 548) / (790 - 548); return [806 + (732 - 806) * t, 884 + (958 - 884) * t]; };
  const NAMES = { '323,794': ['Minh Tâm', 'nu'], '487,792': ['Quang Huy', 'nam'], '677,782': ['Liên Hoa', 'nu'],
                  '1024,788': ['An Nhiên', 'nu'], '1193,792': ['Từ Hạnh', 'nu'], '1353,792': ['Nhật Minh', 'nam'] };
  const SEATS = [];
  [[323, 794], [487, 792], [677, 782], [1024, 788], [1193, 792], [1353, 792]].forEach(([x, y]) => SEATS.push({ x, y, front: true }));
  SEATS.push({ x: 845, y: 778, abbotSeat: true });                       // chỗ chính giữa trên thảm đỏ: chỉ thầy trụ trì được ngồi
  for (const y of [702, 657, 624, 600, 583, 570]) {
    const h = hallH(y), gap = .66 * h, [cl, cr] = carpetX(y);
    const l0 = 268 + (556 - 268) * (702 - y) / (702 - 570);              // mép tường trái của khối ghế
    const lEnd = cl - .32 * h, rStart = cr + .32 * h, rEnd = 1672 - l0 + 20;
    const nL = Math.max(1, Math.floor((lEnd - l0) / gap) + 1), nR = Math.max(1, Math.floor((rEnd - rStart) / gap) + 1);
    for (let i = 0; i < nL; i++) SEATS.push({ x: lEnd - i * (lEnd - l0) / Math.max(1, nL - 1), y });
    for (let i = 0; i < nR; i++) SEATS.push({ x: rStart + i * (rEnd - rStart) / Math.max(1, nR - 1), y });
  }
  SEATS.find(s => s.y === 702).mine = true;                              // chỗ của Bạn: hàng sau, sát thảm đỏ
  const MAX_AO = SEATS.length - 2;

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
    const npcs = people.filter(p => !p.me && !p.abbot && p.room === 'hall');
    while (npcs.length < aoCount) {
      const free = SEATS.filter(s => !s.owner && !s.mine && !s.abbotSeat);
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
    load('assets/song/nu.png').then(i => SHEETS.nu.img = i), load('assets/song/nam.png').then(i => SHEETS.nam.img = i), load('assets/song/tru-tri.png').then(i => SHEETS.tt.img = i),
    load('assets/song/monk.png').then(i => monk = i), load(ROOMS.hall.img).then(i => imgs.hall = i), load(ROOMS.hall.fg).then(i => imgs.hallFg = i)
  ]).then(() => { ready = true; document.documentElement.classList.add('song-ready'); syncVirtual();
    Object.keys(ROOMS).forEach(k => { if (k !== 'hall') load(ROOMS[k].img).then(i => imgs[k] = i); if (ROOMS[k].lu) load(ROOMS[k].lu.src).then(i => imgs['lu-' + k] = i); }); });
  Object.keys(ROOMS).forEach(loadDepth);

  /* ---------- Vẽ ---------- */
  /* ---------- Nền có chiều sâu (bản đồ độ sâu + WebGL) ----------
     Mỗi điểm ảnh dịch đi off·(độ sâu − focus): gần dịch nhiều, xa dịch ít → cảm giác nhìn bằng mắt thật.
     Người, thảm, lư hương dịch theo độ sâu tại chân để luôn đứng đúng chỗ trên nền. */
  const depth = {};                                                       // room → {img, data}
  function loadDepth(k) {
    return load(`assets/sau/${k}.png`).then(i => {
      if (!i) return; const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const g = c.getContext('2d'); g.drawImage(i, 0, 0); depth[k] = { img: i, w: i.width, h: i.height, data: g.getImageData(0, 0, i.width, i.height).data, tex: null };
    });
  }
  const dAt = (k, x, y) => { const d = depth[k]; if (!d) return 0; const ix = Math.max(0, Math.min(d.w - 1, x * d.w / W | 0)), iy = Math.max(0, Math.min(d.h - 1, y * d.h / H | 0)); return d.data[(iy * d.w + ix) * 4] / 255; };
  const PX = (() => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const gl = c.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `precision highp float;varying vec2 v;uniform sampler2D img,dep;uniform vec2 off;uniform float focus,t;
      void main(){
        float w=texture2D(dep,v).g, g=.65+.35*sin(t*.37)+.15*sin(t*1.13);   // kênh G: cây lá, đung đưa theo gió (gió từng đợt)
        vec2 s=w*g*vec2(.0019*sin(t*1.25+v.y*7.+v.x*3.)+.00055*sin(t*3.3+v.x*41.+v.y*29.),.0006*sin(t*1.6+v.x*13.)+.0003*sin(t*3.9+v.y*37.));
        vec2 b=v-s,q=b;for(int i=0;i<5;i++){float d=texture2D(dep,q).r;q=b-off*(d-focus);}
      gl_FragColor=texture2D(img,clamp(q,vec2(.001),vec2(.999)));}`));
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    gl.uniform1i(U('img'), 0); gl.uniform1i(U('dep'), 1);
    const texOf = (im) => { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); return tx; };
    const cache = new Map();
    return { canvas: c, draw(im, dk, ox, oy, focus, t = 0) {
      if (!cache.has(im)) cache.set(im, texOf(im));
      if (!dk.tex) dk.tex = texOf(dk.img);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cache.get(im));
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dk.tex);
      gl.uniform2f(U('off'), ox / W, oy / H); gl.uniform1f(U('focus'), focus); gl.uniform1f(U('t'), t);
      gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return c;
    } };
  })();
  const cam3 = { x: 0, y: 0 }, FOCUS = .35;
  let pointer = { x: .5, y: .5 };
  addEventListener('pointermove', e => { pointer = { x: e.clientX / innerWidth, y: e.clientY / innerHeight }; });
  const shiftAt = (x, y) => { const d = dAt(room, x, y) - FOCUS; return [cam3.x * d, cam3.y * d]; };

  let room = 'hall';
  const R = () => ROOMS[room];
  // Ngoài sân: giảm bớt độ thu nhỏ theo xa gần để người ở xa không bé quá (gần như cũ ở sát màn hình)
  const hWalk = (y, rm = R()) => Math.max(26, rm.k * (y - rm.hz));          // tốc độ đi theo phối cảnh thật
  const hAt = (y, rm = R()) => {
    const d = Math.max(4, y - rm.hz); if (rm === ROOMS.hall) return Math.max(26, rm.k * d);
    const d0 = 900 - rm.hz; return Math.max(40, rm.k * d0 * Math.pow(d / d0, .55));
  };
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
    const rm = ROOMS[p.room], h = hAt(p.fy, rm) * (p.big || 1), s = h / S.stand;
    let f = p.frame;
    if (p.mode === 'walk') f = F[p.dir] + ((p.walkT * 8) | 0) % 4;
    if (p.faceUntil > performance.now() && !(p.me && p.mode === 'walk')) f = F.up;                        // đang hướng về trống/chuông
    const col = f % 4, row = (f / 4) | 0, dw = S.cw * s, dh = S.ch * s;
    const flip = p.flip && p.mode !== 'walk' && f >= 16;
    ctx.save(); ctx.translate(p.fx, p.fy + 1);
    if (flip) ctx.scale(-1, 1);
    if (p.squash) ctx.scale(1, p.squash);
    ctx.drawImage(S.img, col * S.cw, row * S.ch, S.cw, S.ch, -dw / 2, -dh, dw, dh);
    ctx.restore();
    if (p.holding) drawHeldSticks(p, h);
    const el = tagFor(p);
    if (el) { const top = p.fy - h * (f === F.prostrate ? .45 : f >= 18 ? .9 : 1.02); const [dx, dy] = shiftAt(p.fx, p.fy); el.style.left = (p.fx + dx).toFixed(1) + 'px'; el.style.top = (top - 10 + dy).toFixed(1) + 'px'; }
  }
  // Gió: mạnh yếu từng đợt (dùng chung cho lá cây trong nền và khói hương)
  window.GIO = t => .65 + .35 * Math.sin(t * .37) + .15 * Math.sin(t * 1.13);
  /* Khói hương động: bốc lên từ đầu các nén hương đang cháy trong lư, gió thổi nghiêng (thay khói vẽ tĩnh) */
  const puffs = [];
  let puffRoom = null;
  function smoke(rm, t, dt) {
    if (puffRoom !== rm) { puffs.length = 0; puffRoom = rm; }
    const R0 = ROOMS[rm], src = [];
    if (R0.lu) { const [x, y, w, h] = R0.lu.at; src.push([x + w / 2, y + h * .05, w * .13, h / 300]); }
    sticks.forEach(s => { if (s.room === rm) src.push([s.x, s.y - s.len, 3, s.len / 60]); });
    if (!src.length) return;
    const rate = 14 + Math.min(20, src.length);
    for (let n = Math.random() < (rate * dt) % 1 ? 1 : 0, k = Math.floor(rate * dt) + n; k > 0; k--) {
      const s = src[Math.random() * src.length | 0];
      puffs.push({ x: s[0] + (Math.random() - .5) * 2 * s[2], y: s[1], sc: s[3], t0: t, ph: Math.random() * 6, life: 4 + Math.random() * 2.5 });
    }
    const wind = rm === 'hall' ? 0 : GIO(t);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = puffs.length - 1; i >= 0; i--) {
      const f = puffs[i], age = t - f.t0; if (age > f.life) { puffs.splice(i, 1); continue; }
      const k = age / f.life, sc = f.sc;
      const x = f.x + Math.sin(age * 1.4 + f.ph) * 6 * sc * k + wind * 34 * sc * age * age * .5,
            y = f.y - (26 + age * 6) * sc * age,
            r = (4 + age * 8) * sc,
            a = Math.min(1, age * 2.5) * (1 - k) * .38;
      const [dx, dy] = shiftAt(f.x, f.y + 60);
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, `rgba(235,232,228,${a})`); g.addColorStop(1, 'rgba(235,232,228,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  // Hương: que đỏ, đầu đỏ lửa, khói mỏng
  const sticks = [], flying = [];
  function stick(x, y, len, t, a = 1, puff = false) {
    ctx.strokeStyle = `rgba(178,34,40,${a})`; ctx.lineWidth = Math.max(1.4, len * .045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - len); ctx.stroke();
    const r = Math.max(2, len * .07), g = ctx.createRadialGradient(x, y - len, 0, x, y - len, r * 2.6);
    g.addColorStop(0, `rgba(255,236,170,${a})`); g.addColorStop(.35, `rgba(255,120,40,${.9 * a})`); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - len, r * 2.6, 0, 7); ctx.fill();
    if (puff) for (let i = 0; i < 4; i++) {                                 // khói (hương cầm tay)
      const k = ((t * .35 + i * .25) % 1), sy = y - len - k * len * 1.6, sx = x + Math.sin(t * 1.3 + i * 2 + x) * len * .12 * k + (room === 'hall' ? 0 : GIO(t) * k * k * len * .9);
      ctx.fillStyle = `rgba(235,235,235,${.16 * (1 - k) * a})`; ctx.beginPath(); ctx.arc(sx, sy, len * (.05 + k * .12), 0, 7); ctx.fill();
    }
  }
  function drawHeldSticks(p, h) {
    const t = performance.now() / 1000, len = h * .2, hy = p.fy - h * (p.dir === 'up' && p.frame < 16 ? .56 : .5);
    for (const dx of [-.025, 0, .025]) stick(p.fx + dx * h, hy, len, t, 1, true);
  }

  /* ---------- Chuyển động ---------- */
  const chanAt = (k, x, y) => { const d = depth[k]; if (!d) return 0; const ix = Math.max(0, Math.min(d.w - 1, x * d.w / W | 0)), iy = Math.max(0, Math.min(d.h - 1, y * d.h / H | 0)); return d.data[(iy * d.w + ix) * 4 + 2]; };
  function walkable(x, y, rm = R()) {
    if (!inPoly(x, y, rm.floor)) return false;
    if (rm.key && rm.key !== 'hall' && chanAt(rm.key, x, y) > 128) return false;   // chân lư, đèn đá, chậu cây… (vật cố định)
    const m = rm.key === 'hall' ? 0 : .1 * hAt(y, rm);                     // bề ngang thân người: không lấn vào vật cản
    for (const b of rm.block || []) if (x >= b[0] - m && x <= b[2] + m && y >= b[1] && y <= b[3]) return false;
    if (rm.key === 'hall' && abbot && x > 740 && x < 950 && y > 735) return false;   // không đi che trước mặt thầy trụ trì
    return true;
  }
  const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) * .8 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  function walkTo(p, x, y) { return new Promise(res => { p.mode = 'walk'; p.target = [x, y]; p.arrive = res; }); }
  async function walkPath(p, pts) { for (const [x, y] of pts) { if (p.room !== room && p.room === 'gone') return; await walkTo(p, x, y); } }
  function stepWalker(p, dt) {
    if (p.mode !== 'walk' || !p.target) return;
    if (p.faceUntil > performance.now()) return;                          // dừng lại, quay mặt về trống/chuông
    const [tx, ty] = p.target, dx = tx - p.fx, dy = ty - p.fy, d = Math.hypot(dx, dy);
    const v = .78 * hWalk(p.fy, ROOMS[p.room]) * dt;
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
  // Lạy hướng vào tượng (quay lưng về phía người xem): đứng → quỳ → cúi rạp → quỳ → đứng
  const BACK_SIT = 21;
  async function prostrateUp(p, n = 3) {
    const sh = ROOMS[p.room].shrine;
    if (sh) { if (p.mode === 'seat') await standUp(p); await walkTo(p, sh.stand[0], sh.stand[1]); }
    p.mode = 'pose'; p.dir = 'up'; p.frame = BACK_SIT; await sleep(500);              // quỳ xuống trước tượng
    for (let i = 0; i < n; i++) {
      p.squash = .84; await sleep(160); p.squash = .66; await sleep(1000); p.squash = .84; await sleep(160); p.squash = 0; await sleep(550);
    }
    p.squash = 0;
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
    for (const dx of [-.12, 0, .12]) sticks.push({ room: p.room, x: to[0] + dx * u.len, y: to[1] + Math.abs(dx) * 4, len: u.len * rnd(.9, 1.05), t0: performance.now() });
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
      const h = hWalk(me.fy), v = .9 * h * Math.min(1, mag) * dt;
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
        const s = SEATS.find(s => !s.abbotSeat && (!s.owner || s.owner === me) && Math.hypot(s.x - me.fx, s.y - me.fy) < .2 * hallH(s.y));
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
          const free = people.filter(p => !p.me && !p.abbot && !p.busy && p.mode === 'seat' && p.room === 'hall');
          if (free.length && busy < 4 && !abbot) { const r = Math.random(); outing(pick(free), r < .22 ? 'door' : r < .44 ? 'huong' : r < .62 ? 'lay' : r < .74 ? 'left' : r < .86 ? 'right' : 'wander'); }
        }
      }
      // vẽ
      const bg = room === 'hall' ? imgs.hall : imgs[room];
      // máy quay khẽ theo Bạn + con trỏ + nhịp thở → nền dịch theo chiều sâu
      const tx = -(me.fx - 836) / 836 * 22 - (pointer.x - .5) * 16 + Math.sin(t * .31) * 4;
      const ty = -(me.fy - 760) / 300 * 6 - (pointer.y - .5) * 8 + Math.cos(t * .23) * 2.5;
      cam3.x += (tx - cam3.x) * Math.min(1, dt * 2.5); cam3.y += (ty - cam3.y) * Math.min(1, dt * 2.5);
      const dk = depth[room];
      if (bg && PX && dk) ctx.drawImage(PX.draw(bg, dk, cam3.x, cam3.y, FOCUS, t), 0, 0);
      else if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#2a1408'; ctx.fillRect(0, 0, W, H); }
      const vis = people.filter(p => p.room === room);
      const at = (x, y, fn) => () => { const [dx, dy] = shiftAt(x, y); ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); };
      const items = vis.map(p => ({ y: p.fy, draw: at(p.fx, p.fy, () => drawPerson(p)) }));
      if (room === 'hall') {
        SEATS.forEach(s => items.push({ y: s.y - .5, draw: at(s.x, s.y, () => drawCushion(s.x, s.y, hallH(s.y))) }));
      }
      const lu = R().lu;                                                  // lư hương vẽ: tách lớp để người đi sau lư bị lư che
      if (lu && imgs['lu-' + room]) { const [x, y, w, h] = lu.at; items.push({ y: y + h - 6, draw: at(x + w / 2, y + h - 6, () => ctx.drawImage(imgs['lu-' + room], x, y, w, h)) }); }
      items.sort((a, b) => a.y - b.y).forEach(i => i.draw());
      smoke(room, t, dt);
      if (room === 'hall' && imgs.hallFg) { const [dx, dy] = shiftAt(843, 870); ctx.drawImage(imgs.hallFg, dx, ROOMS.hall.fgY + dy); }
      sticks.forEach(s => { if (s.room !== room) return; const age = (now - s.t0) / 1000, a = age > 80 ? Math.max(0, 1 - (age - 80) / 10) : 1; if (a > 0) { const [dx, dy] = shiftAt(s.x, s.y + 40); stick(s.x + dx, s.y + dy, s.len * (1 - Math.min(.5, age / 200)), t, a); } });
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

  const toStage = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const scn = document.getElementById('scene') || cv;           // #cv không nhận chuột (pointer-events:none)
  scn.addEventListener('click', e => {
    const tp = R().tap; if (!tp) return;
    const [x, y] = toStage(e); if (!inRect(x, y, tp[0]) || meBusy) return;
    const a = R().act;                                                      // ở xa thì đi lại gần trước rồi mới đánh
    if (a && !inRect(me.fx, me.fy, [a[0][0] - 40, a[0][1] - 40, a[0][2] + 40, a[0][3] + 60])) {
      meBusy = true; me.actDone = true; const r0 = room;
      if (me.mode === 'seat') me.mode = 'pose';
      walkTo(me, Math.max(a[0][0] + 20, Math.min(a[0][2] - 20, me.fx)), (a[0][1] + a[0][3]) / 2).then(() => {
        meBusy = false; me.mode = 'pose'; me.dir = 'up'; me.frame = F.up; setTimeout(() => me.actDone = false, 5000);
        if (room === r0) dispatchEvent(new CustomEvent('chua-act', { detail: tp[1] }));
      });
      return;
    }
    dispatchEvent(new CustomEvent('chua-act', { detail: tp[1] }));
  });
  scn.addEventListener('mousemove', e => { const tp = R().tap; if (!tp) { scn.style.cursor = ''; return; } const [x, y] = toStage(e); scn.style.cursor = inRect(x, y, tp[0]) ? 'pointer' : ''; });

  /* ---------- Trụ trì: chỉ xuất hiện khi quản trị vào điện, đi từ sân vào ngồi chỗ của thầy ---------- */
  let abbot = null;
  const ABBOT_SEAT = SEATS.find(s => s.abbotSeat);
  async function abbotEnter() {
    if (abbot) return;
    abbot = makePerson({ sheet: 'tt', name: 'Thầy Trụ trì', flip: false, room: 'hall', fx: 836, fy: 562, mode: 'pose', frame: F.down, busy: true, abbot: true, big: 1.4 });
    people.push(abbot); ABBOT_SEAT.owner = abbot;
    // ai đang đứng trên lối giữa thì về chỗ, để thầy đi thẳng theo thảm đỏ vào ngồi chính giữa
    if (me.room === 'hall' && me.mode !== 'seat' && me.fx > 740 && me.fx < 950 && me.fy > 735 && !meBusy) { meBusy = true; await walkTo(me, 640, 720); me.mode = 'pose'; meBusy = false; }
    await walkTo(abbot, 840, 680); await walkTo(abbot, ABBOT_SEAT.x, ABBOT_SEAT.y);
    abbot.dir = 'down'; abbot.frame = F.stand; await sleep(250); abbot.frame = F.standBow; await sleep(700);
    abbot.frame = F.stand; await sleep(250); abbot.frame = F.sit; abbot.mode = 'seat'; abbot.busy = false;
    dispatchEvent(new CustomEvent('chua-count', { detail: count() }));
  }
  function abbotLeave() {
    if (!abbot) return; ABBOT_SEAT.owner = null; const i = people.indexOf(abbot); if (i >= 0) people.splice(i, 1);
    if (tags[abbot.id]) { tags[abbot.id].remove(); delete tags[abbot.id]; } abbot = null;
  }

  /* ---------- Giao tiếp với app.js ---------- */
  const hallNpcs = () => people.filter(p => !p.me && !p.abbot && p.room === 'hall');
  window.Nguoi = {
    drive(x, y) { input = { x, y }; },
    me: () => ({ x: me.fx, y: me.fy, standing: me.mode !== 'seat', room }),
    room: () => room, roomName: () => R().name,
    exits: () => { const seen = new Set(); return (R().exits || []).filter(e => !e[1].startsWith('soon:') && !seen.has(e[1]) && seen.add(e[1]))
      .map(([r, to, at, face]) => ({ to, at, face, name: ROOMS[to].name, side: r[2] <= 160 ? 'left' : r[0] >= W - 160 ? 'right' : r[1] > H - 40 ? 'down' : 'up' })); },
    abbotEnter, abbotLeave,
    // mọi người trong cảnh dừng lại, quay mặt vào trống / chuông
    faceUp(ms = 3000) { const until = performance.now() + ms; people.filter(p => p.room === room && !p.abbot).forEach(p => { p.faceUntil = until; if (p.mode !== 'walk' && !p.busy) p.frame = F.up; }); me.dir = 'up'; },
    go: (to, at, face) => go(to, at || (to === 'hall' ? [845, 600] : [836, 900]), face || (to === 'hall' ? 'down' : 'up')),
    bow(key, depth, ms) { if (key === 'ban') { if (!meBusy) bowOnce(me, ms || 900); } },
    bowAll(depth, ms) { hallNpcs().forEach(p => setTimeout(() => bowOnce(p, ms || 1200), rnd(100, 700))); if (!meBusy) bowOnce(me, ms || 1200); },
    beat() { bowOnce(me, 380); for (let i = 0; i < 4; i++) { const p = pick(hallNpcs()); p && bowOnce(p, 380); } },
    abbotHere: () => !!abbot && room === 'hall',
    async layPhat(times = 3) {
      if (abbot && room === 'hall') {                                       // thầy đang ngồi: chỉ ngồi chắp tay cúi đầu, không lạy rạp
        hallNpcs().filter(p => !p.busy && p.mode === 'seat').forEach(p => setTimeout(() => bowOnce(p, 1200), rnd(100, 700)));
        if (me.mode === 'seat') bowOnce(me, 1200); return 'abbot';
      }
      if (room === 'hall') hallNpcs().filter(p => !p.busy && p.mode === 'seat').forEach(p => { p.busy = true; setTimeout(() => prostrate(p, times).then(() => p.busy = false), rnd(100, 700)); });
      strollers.forEach(p => p.mode !== 'walk' && prostrate(p, 1));
      if (meBusy) return; meBusy = true; me.busy = true;
      try { if (R().shrine) await prostrateUp(me, times); else await prostrate(me, times); } finally { me.busy = false; meBusy = false; }
    },
    async incense() {
      if (meBusy) return false;
      if (abbot && room === 'hall') return 'abbot';
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
