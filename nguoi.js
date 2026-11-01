/* Liên Hoa Tịnh Viện – Phật tử trong ảnh đứng dậy, đi lại, lạy Phật.
   Nền: chánh điện trống (nen.jpg) · đại chúng phía sau (dong.png) · 8 người hàng đầu cắt từ ảnh gốc
   · bộ tư thế nam/nữ (nam.png, nu.png: 4 cột × 6 hàng) · tiền cảnh bàn, đèn sen, hoa (truoc.png).
   Người ngồi dùng đúng ảnh cắt (giữ nguyên nét vẽ); khi đứng dậy chuyển sang bộ tư thế. */
(() => {
const AG = {"monk": {"x": 198, "y": 693, "w": 75, "h": 106, "foot": [235, 802], "sheet": "su", "name": null, "tag": null}, "w1": {"x": 266, "y": 644, "w": 114, "h": 147, "foot": [323, 794], "sheet": "nu", "name": "Minh Tâm", "tag": [319, 632]}, "m1": {"x": 432, "y": 644, "w": 110, "h": 146, "foot": [487, 792], "sheet": "nam", "name": "Quang Huy", "tag": [494, 632]}, "w2": {"x": 628, "y": 645, "w": 99, "h": 130, "foot": [677, 782], "sheet": "nu", "name": "Liên Hoa", "tag": [687, 632]}, "ban": {"x": 797, "y": 648, "w": 97, "h": 129, "foot": [845, 778], "sheet": "nam", "name": "Bạn", "tag": [844, 635]}, "w3": {"x": 976, "y": 646, "w": 96, "h": 129, "foot": [1024, 788], "sheet": "nu", "name": "An Nhiên", "tag": [1026, 632]}, "w4": {"x": 1146, "y": 648, "w": 95, "h": 127, "foot": [1193, 792], "sheet": "nu", "name": "Từ Hạnh", "tag": [1191, 632]}, "m2": {"x": 1295, "y": 644, "w": 116, "h": 148, "foot": [1353, 792], "sheet": "nam", "name": "Nhật Minh", "tag": [1353, 632]}};
const SHEETS = {"nu": {"cw": 161, "ch": 246, "h": [240, 237, 236, 236, 237, 236, 235, 233, 231, 231, 230, 231, 230, 231, 231, 230, 242, 228, 207, 122, 211, 225, 185, 208]}, "nam": {"cw": 193, "ch": 260, "h": [256, 256, 244, 244, 249, 256, 256, 248, 256, 246, 248, 247, 247, 248, 254, 256, 249, 254, 220, 139, 247, 248, 209, 216]}};
const CROWD = [171, 519], FG_Y = 660;
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Kích thước người theo chiều sâu: chiều cao người ngồi tại chân y (đo trên ảnh)
  const hSeat = y => 40 + 0.4565 * (Math.max(548, y) - 560);
  // Khung hình trong bộ tư thế
  const F = { down: 0, up: 4, left: 8, right: 12, stand: 16, standBow: 17, sit: 18, prostrate: 19 };

  /* ---------- Vùng đi được (toạ độ chân) ---------- */
  const carpetX = y => { const t = (y - 548) / (790 - 548); return [806 + (732 - 806) * t, 884 + (958 - 884) * t]; };
  function walkable(x, y) {
    if (y >= 556 && y <= 806) { const [l, r] = carpetX(y); if (x >= l - 6 && x <= r + 6) return true; }  // thảm đỏ giữa lối
    if (y >= 796 && y <= 828 && x >= 110 && x <= 1570) return true;                                        // lối trước hàng đầu
    if (x >= 60 && x <= 292 && y >= 712 && y <= 900) return true;                                          // góc trái
    if (x >= 1384 && x <= 1612 && y >= 712 && y <= 900) return true;                                       // góc phải
    return false;
  }

  /* ---------- Nhân vật ---------- */
  const people = Object.entries(AG).map(([key, d], i) => ({
    key, ...d, seat: [...d.foot], fx: d.foot[0], fy: d.foot[1],
    mode: 'seat', frame: F.sit, dir: 'down', walkT: 0, mix: 0, // mix: 0 = ảnh cắt gốc, 1 = bộ tư thế
    ph: i * 1.7 % 6.28, bow: 0, bowT: 0, until: 0, busy: false, img: null
  }));
  const byKey = Object.fromEntries(people.map(p => [p.key, p]));
  const me = byKey.ban;
  const sheets = {};

  const scene = document.getElementById('scene');
  const aura = document.getElementById('me-aura');
  const tags = {};
  people.filter(p => p.name).forEach(p => {
    const el = document.createElement('div'); el.className = 'tag' + (p === me ? ' me' : '');
    el.textContent = p.name; scene.appendChild(el); tags[p.key] = el;
  });

  let plate, crowd, fg, ready = false;
  Promise.all([
    load('assets/song/nen.jpg'), load('assets/song/dong.png'), load('assets/song/truoc.png'),
    load('assets/song/nu.png').then(i => sheets.nu = i), load('assets/song/nam.png').then(i => sheets.nam = i),
    ...people.map(p => load(`assets/song/${p.key}.png`).then(i => p.img = i))
  ]).then(([a, b, c]) => { plate = a; crowd = b; fg = c; ready = !!plate; document.documentElement.classList.add('song-ready'); });

  /* ---------- Vẽ ---------- */
  function spriteScale(p) { const S = SHEETS[p.sheet]; return 1.15 * hSeat(p.fy) / S.h[F.stand]; }
  function drawSprite(p, frame, alpha = 1) {
    const S = SHEETS[p.sheet], img = sheets[p.sheet]; if (!img) return 0;
    const s = spriteScale(p), col = frame % 4, row = (frame / 4) | 0;
    const dw = S.cw * s, dh = S.ch * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, col * S.cw, row * S.ch, S.cw, S.ch, p.fx - dw / 2, p.fy - dh + 1, dw, dh);
    ctx.globalAlpha = 1;
    return S.h[frame] * s;                                 // chiều cao thật của hình
  }
  function drawSeated(p, t) {                              // ảnh cắt gốc + thở, cúi chào
    const hip = p.y + p.h * .55, U = hip - p.y, L = p.h - U;
    const headH = Math.round(U * .5), torsoH = U - headH;
    const breathe = Math.sin(t * 1.25 + p.ph) * 0.008;
    const drop = U * p.bow * .16;
    const tsy = Math.max(.2, (torsoH - drop) / torsoH) + breathe;
    const hs = 1 + p.bow * .035, sway = Math.sin(t * .45 + p.ph) * 0.006, cx = p.x + p.w / 2;
    ctx.globalAlpha = 1 - p.mix;
    ctx.drawImage(p.img, 0, U, p.w, L, p.x, hip, p.w, L);
    ctx.save(); ctx.translate(cx, hip + 1); ctx.rotate(sway);
    ctx.save(); ctx.scale(1, tsy); ctx.drawImage(p.img, 0, headH, p.w, torsoH + 1, -p.w / 2, -(torsoH + 1), p.w, torsoH + 1); ctx.restore();
    ctx.translate(0, -torsoH * tsy + 1); ctx.scale(hs, hs);
    ctx.drawImage(p.img, 0, 0, p.w, headH + 1, -p.w / 2, -(headH + 1), p.w, headH + 1);
    ctx.restore(); ctx.globalAlpha = 1;
    return p.h + drop * -1;
  }
  function draw(p, t) {
    let top;
    if (p.mix < 1 && p.img) { const h = drawSeated(p, t); top = p.fy - h * (1 - p.bow * .12); }
    if (p.mix > 0 && SHEETS[p.sheet]) {
      let f = p.frame;
      if (p.mode === 'walk') f = F[p.dir] + ((p.walkT * 8) | 0) % 4;
      const h = drawSprite(p, f, p.mix);
      if (p.mix >= .5) top = p.fy - h;
    }
    const el = tags[p.key];
    if (el && top != null) { el.style.left = p.fx.toFixed(1) + 'px'; el.style.top = (top - 12).toFixed(1) + 'px'; }
  }

  /* ---------- Chuyển động ---------- */
  const fade = (p, to, ms) => new Promise(res => { p.fadeTo = to; p.fadeSpeed = 1000 / ms; p.fadeDone = res; });
  async function standUp(p) {
    if (p.mode !== 'seat' || !SHEETS[p.sheet]) return false;
    p.mode = 'pose'; p.bowT = 0; p.bow = 0; p.frame = F.sit;
    await fade(p, 1, 280); await sleep(160);
    p.frame = F.stand; await sleep(380);
    return true;
  }
  async function sitDown(p) {
    p.mode = 'pose'; p.fx = p.seat[0]; p.fy = p.seat[1];
    p.frame = F.stand; await sleep(250); p.frame = F.sit; await sleep(250);
    await fade(p, 0, 320); p.mode = 'seat';
  }
  function dirOf(dx, dy) { return Math.abs(dx) > Math.abs(dy) * .8 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }
  function walkTo(p, x, y) {                     // người khác đi theo điểm mốc
    return new Promise(res => { p.mode = 'walk'; p.target = [x, y]; p.arrive = res; });
  }
  function stepAgent(p, dt) {
    if (p.fadeTo != null) {
      p.mix += Math.sign(p.fadeTo - p.mix) * p.fadeSpeed * dt;
      if ((p.fadeTo === 1 && p.mix >= 1) || (p.fadeTo === 0 && p.mix <= 0)) { p.mix = p.fadeTo; p.fadeTo = null; p.fadeDone(); }
    }
    if (p.mode === 'walk' && p.target) {
      const [tx, ty] = p.target, dx = tx - p.fx, dy = ty - p.fy, d = Math.hypot(dx, dy);
      const v = .9 * hSeat(p.fy) * dt;
      p.dir = dirOf(dx, dy); p.walkT += dt;
      if (d <= v) { p.fx = tx; p.fy = ty; p.target = null; p.mode = 'pose'; p.frame = F.stand; p.arrive(); }
      else { p.fx += dx / d * v; p.fy += dy / d * v; }
    }
  }

  /* Những chuyến đi của Phật tử */
  const LANE = 812;
  const ROUTES = {
    async door(p) {                               // ra cửa ngắm sân rồi về
      const side = p.seat[0] < 845 ? 768 : 922;
      await walkTo(p, p.seat[0], LANE); await walkTo(p, side, LANE);
      await walkTo(p, side < 845 ? 800 : 890, 690); await walkTo(p, 845 + rnd(-14, 14), 572);
      p.frame = F.up; await sleep(rnd(2600, 4200));
      p.frame = F.standBow; await sleep(900);
      await walkTo(p, side < 845 ? 800 : 890, 690); await walkTo(p, side, LANE); await walkTo(p, p.seat[0], LANE);
      await walkTo(p, p.seat[0], p.seat[1]);
    },
    async tranh(p) {                              // ra góc chiêm bái tranh Phật
      const left = p.seat[0] < 845 ? Math.random() < .75 : Math.random() < .25;
      const gx = left ? rnd(110, 200) : rnd(1460, 1560), gy = rnd(740, 790);
      await walkTo(p, p.seat[0], LANE); await walkTo(p, left ? 250 : 1430, LANE); await walkTo(p, gx, gy);
      p.frame = F.up; await sleep(rnd(2200, 3600));
      p.frame = F.stand; await sleep(500); p.frame = F.standBow; await sleep(1100); p.frame = F.stand; await sleep(300);
      await walkTo(p, left ? 250 : 1430, LANE); await walkTo(p, p.seat[0], LANE); await walkTo(p, p.seat[0], p.seat[1]);
    },
    async lay(p) {                                // đứng dậy lạy Phật ba lạy tại chỗ
      for (let i = 0; i < 3; i++) await prostrate(p);
    }
  };
  async function prostrate(p) {
    p.mode = 'pose';
    p.frame = F.stand; await sleep(450); p.frame = F.standBow; await sleep(500);
    p.frame = F.sit; await sleep(380); p.frame = F.prostrate; await sleep(1100);
    p.frame = F.sit; await sleep(380); p.frame = F.stand; await sleep(350);
  }
  async function outing(p, kind) {
    if (p.busy || p.mode !== 'seat') return; p.busy = true;
    try { if (await standUp(p)) { await ROUTES[kind](p); await sitDown(p); } }
    finally { p.busy = false; }
  }
  const walkers = () => people.filter(p => p.busy && p !== me).length;

  /* ---------- Bạn: điều khiển bằng joystick ---------- */
  let input = { x: 0, y: 0 }, meIdle = 0, meBusy = false, doorFired = false;
  function drive(x, y) { input = { x, y }; }
  async function stepMe(dt) {
    const mag = Math.hypot(input.x, input.y);
    if (mag > .15 && !meBusy) {
      meIdle = 0;
      if (me.mode === 'seat') { meBusy = true; me.busy = true; await standUp(me); meBusy = false; return; }
      if (me.mode === 'pose') me.mode = 'walk';
      if (me.mode !== 'walk' || me.target) return;
      const v = .95 * hSeat(me.fy) * Math.min(1, mag) * dt;
      // trục dọc chậm hơn theo chiều sâu cho cảm giác đúng phối cảnh
      const nx = me.fx + input.x / mag * v, ny = me.fy + input.y / mag * v * .85;
      if (walkable(nx, ny)) { me.fx = nx; me.fy = ny; }
      else if (walkable(nx, me.fy)) me.fx = nx;
      else if (walkable(me.fx, ny)) me.fy = ny;
      me.dir = dirOf(input.x, input.y * .85); me.walkT += dt;
      if (me.fy < 566 && !doorFired) { doorFired = true; dispatchEvent(new CustomEvent('ban-ra-cua')); }
      if (me.fy > 600) doorFired = false;
    } else if (me.mode === 'walk' && !me.target) {
      me.mode = 'pose'; me.frame = me.dir === 'up' ? F.up : F.stand;
    } else if (me.mode === 'pose' && !meBusy) {
      meIdle += dt;
      // đứng yên gần chỗ ngồi của mình thì tự ngồi xuống
      if (meIdle > 1.2 && Math.hypot(me.fx - me.seat[0], me.fy - me.seat[1]) < 30) {
        meBusy = true; await sitDown(me); me.busy = false; meBusy = false;
      }
    }
  }

  /* ---------- Vòng lặp ---------- */
  let last = performance.now(), nextBow = 2, nextTrip = 4;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
    if (ready) {
      for (const p of people) {
        if (p.until && now > p.until) { p.bowT = 0; p.until = 0; }
        p.bow += (p.bowT - p.bow) * (1 - Math.exp(-(p.bowT > p.bow ? 5 : 3.5) * dt));
        stepAgent(p, dt);
      }
      stepMe(dt);
      nextBow -= dt;
      if (nextBow <= 0) {                // thỉnh thoảng có người cúi đầu
        nextBow = rnd(1.5, 5);
        const p = people[(Math.random() * people.length) | 0];
        if (p !== me && p.mode === 'seat' && !p.bowT) bow(p.key, rnd(.45, .8), rnd(1100, 2000));
      }
      nextTrip -= dt;
      if (nextTrip <= 0) {               // có người đứng dậy đi lại
        nextTrip = rnd(5, 11);
        const free = people.filter(p => p !== me && !p.busy && p.mode === 'seat' && SHEETS[p.sheet]);
        if (free.length && walkers() < 2) {
          const p = free[(Math.random() * free.length) | 0], r = Math.random();
          outing(p, r < .4 ? 'door' : r < .8 ? 'tranh' : 'lay');
        }
      }
      ctx.drawImage(plate, 0, 0);
      if (crowd) ctx.drawImage(crowd, CROWD[0], CROWD[1]);
      [...people].sort((a, b) => a.fy - b.fy).forEach(p => draw(p, t));
      if (fg) ctx.drawImage(fg, 0, FG_Y);
      if (aura) { aura.style.left = me.fx + 'px'; aura.style.top = (me.fy - (me.mix > .5 ? 1.15 : .95) * hSeat(me.fy) * .55) + 'px'; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Hành động gọi từ app.js ---------- */
  function bow(key, depth = .6, ms = 1200) {
    const p = byKey[key]; if (!p) return;
    if (p.mode === 'seat') { p.bowT = depth; p.until = performance.now() + ms; return; }
    if (p === me && p.mode === 'pose' && !meBusy) {             // đang đứng: cúi chào bằng tư thế
      meBusy = true; p.frame = F.standBow; setTimeout(() => { p.frame = F.stand; meBusy = false; }, Math.max(500, ms));
    }
  }
  function bowAll(depth = 1, ms = 1400) {
    people.forEach(p => setTimeout(() => bow(p.key, depth, ms), p === me ? 0 : rnd(150, 800)));
  }
  function beat() { bow('ban', .28, 380); for (let i = 0; i < 4; i++) bow(people[(Math.random() * people.length) | 0].key, .25, 380); }
  async function layPhat(times = 3) {
    if (me.mode !== 'seat' && !meBusy) {                         // Bạn đang đứng thì lạy bằng tư thế lạy thật
      meBusy = true;
      people.filter(p => p.mode === 'seat').forEach(p => setTimeout(() => bow(p.key, 1.55, 1500), rnd(150, 800)));
      for (let i = 0; i < times; i++) await prostrate(me);
      me.frame = F.stand; meBusy = false; return;
    }
    for (let i = 0; i < times; i++) { bowAll(1.55, 1500); await sleep(2300); }
  }
  function place(x, y, dir = 'down') {                            // đặt Bạn ở chỗ khác (vd. từ sân vào)
    if (me.mode === 'seat') { me.mix = 1; }
    me.mode = 'pose'; me.busy = true; me.fx = x; me.fy = y; me.dir = dir; me.frame = F.stand;
  }
  window.Nguoi = { bow, bowAll, beat, layPhat, drive, place, me: () => ({ x: me.fx, y: me.fy, standing: me.mode !== 'seat' }), outing: (k, kind) => byKey[k] && outing(byKey[k], kind) };
})();
