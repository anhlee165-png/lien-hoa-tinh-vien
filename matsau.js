/* Mặt sau chánh điện: đứng sau lưng đại chúng, nhìn lên Phật.
   Ảnh nền vẽ sẵn (assets/song/sau.jpg) + Phật tử chibi ngồi quay lưng, đúng những người đang ngồi ở mặt trước
   (cùng chỗ, cùng áo), đặt lại theo phối cảnh của ảnh này. Giữ nguyên giao diện window.Dien3D cũ. */
(() => {
  const W = 1672, H = 941;
  const HZ = 467, K = .34;                     // chân trời & hệ số chiều cao người: h = K·(y − HZ)
  const CX = 736;                              // giữa thảm đỏ
  const BACK_SIT = 21;                         // khung ngồi quay lưng
  const FRONT_HZ = 472.4;                      // chân trời của ảnh mặt trước
  // khoảng cách theo chiều sâu: mặt trước nhìn từ bàn thờ ra, mặt sau nhìn từ cửa vào
  const L = 19.54, C = 4068;                   // hàng đầu (sát bàn thờ) ở y≈735, hàng cuối ở y≈905
  const LAMPS = [[366, 74, 90], [1092, 74, 90], [642, 554, 60], [823, 554, 60], [411, 594, 110], [1063, 594, 110], [734, 32, 120]];
  const URN = [731, 552];
  const VASES = [[568, 568], [897, 568]];      // hai bình sen trên bàn thờ
  const blooms = [];

  let canvas, ctx, label, img, active = false, raf = 0, failed = false, bowT = -99, count = 0;
  const view = { z: 0, x: 0, in: { x: 0, y: 0 }, drag: null, tx: 0, ty: 0 };
  const smoke = [];

  function place(s) {
    if (s.abbot) return { x: CX, y: 712 };                                // thầy ngồi trước hàng đầu, gần Phật nhất
    const d = Math.max(20, s.y - FRONT_HZ), zf = 1000 / d, yb = HZ + C / (L - zf);
    const lat = (s.x - 836) / d, a = Math.abs(lat);
    const off = (yb - HZ) * (a < .55 ? a * .42 / .55 : .42 + (a - .55) * .62);   // giữa thảm (thầy trụ trì) giữ ở giữa
    return { x: CX - Math.sign(lat) * off, y: yb };
  }

  function init() {
    canvas = document.createElement('canvas'); canvas.id = 'dien3d'; canvas.width = W; canvas.height = H;
    canvas.setAttribute('aria-label', 'Nhìn lên điện Phật từ phía sau đại chúng: tượng Phật vàng ngồi tòa sen, thảm đỏ giữa điện, Phật tử ngồi hai bên');
    document.getElementById('scene').after(canvas);
    label = document.createElement('div'); label.id = 'dien3d-tag'; canvas.after(label);
    ctx = canvas.getContext('2d'); if (!ctx) { failed = true; return false; }
    img = new Image(); img.src = 'assets/song/sau.jpg';
    canvas.addEventListener('pointerdown', e => { view.drag = { x: e.clientX, vx: view.x }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect(); view.tx = (e.clientX - r.left) / r.width - .5; view.ty = (e.clientY - r.top) / r.height - .5;
      if (view.drag) view.x = Math.max(-1, Math.min(1, view.drag.vx - (e.clientX - view.drag.x) / r.width * 2));
    });
    const up = () => view.drag = null; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); view.z = Math.max(0, Math.min(1, view.z - e.deltaY * .001)); }, { passive: false });
    return true;
  }

  // áo lam xám của nhân vật hơi lạnh so với ánh nến vàng của ảnh: ủ một lớp ấm (làm một lần cho mỗi bộ hình)
  const warm = new Map();
  function warmed(S) {
    if (S.warm) return S.warm;
    if (warm.has(S.img)) return warm.get(S.img);
    const c = document.createElement('canvas'); c.width = S.img.width; c.height = S.img.height;
    const g = c.getContext('2d'); g.drawImage(S.img, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,170,80,.16)'; g.fillRect(0, 0, c.width, c.height);
    warm.set(S.img, c); return c;
  }
  // khung hình theo hướng nhìn từ cửa vào: đi về phía cửa (xuống ở mặt trước) thì quay mặt ra máy quay; trái/phải đảo chiều
  // mặt trước: 'up' = đi về phía cửa (về phía máy quay mặt sau) → thấy mặt; 'down' = đi vào phía Phật → thấy lưng
  const FR = { up: 0, down: 4, left: 12, right: 8 }, BACK = 4;
  const tags = [];
  function drawPerson(S, p, t, i) {
    if (!S || !S.img) return;
    const { x, y } = place(p), h = K * (y - HZ) * (p.abbot ? 1.4 : 1), s = h / S.stand;
    if (y > H + h * .2) return;                                          // đã ra khỏi cửa
    let f = BACK_SIT, flip = p.flip;
    if (!p.sit) { f = p.walk ? FR[p.dir] + ((p.walkT * 8) | 0) % 4 : BACK; flip = false; }
    const col = f % 4, row = (f / 4) | 0, dw = S.cw * s, dh = S.ch * s;
    const k = t - bowT, b = p.me && k > 0 && k < 6 ? Math.max(0, Math.sin(k / 2 * Math.PI)) : p.bow || 0;   // ai lạy người nấy
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(30,14,6,.30)'; ctx.beginPath(); ctx.ellipse(0, -h * .02, h * .34, h * .07, 0, 0, 7); ctx.fill();
    if (flip) ctx.scale(-1, 1);
    ctx.scale(1, (1 - .34 * b) * (p.sit ? 1 + Math.sin(t * 1.3 + i) * .006 : 1));
    ctx.drawImage(warmed(S), col * S.cw, row * S.ch, S.cw, S.ch, -dw / 2, -dh, dw, dh);
    ctx.restore();
    if (p.name) tags.push({ p, x, y: y - h * (p.sit ? .8 : 1.08) * (1 - .3 * b), h });
    if (p.sit && !p.me && chant.has(p.id)) chant.get(p.id).at = [x, y - h * .9];
  }
  // tên trên đầu: người gần đứng trước; tên chồng lên nhau thì giữ tên người gần hơn (Bạn, thầy, người thật luôn hiện)
  function drawTags() {
    const rank = g => g.p.me ? 3e4 : g.p.abbot ? 2e4 : g.p.real ? 1e4 : g.y;
    tags.sort((a, b) => rank(b) - rank(a));
    const kept = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of tags) {
      const fs = Math.max(10, Math.min(17, g.h * .11)), label = g.p.me ? 'Bạn' : g.p.name;
      ctx.font = `700 ${fs}px system-ui,sans-serif`;
      const w = ctx.measureText(label).width + fs, hh = fs * 1.5, r = [g.x - w / 2, g.y - hh / 2, g.x + w / 2, g.y + hh / 2];
      if (rank(g) < 1e4 && kept.some(k => r[0] < k[2] && r[2] > k[0] && r[1] < k[3] && r[3] > k[1])) continue;
      kept.push(r);
      ctx.fillStyle = g.p.me ? 'rgba(30,110,40,.92)' : g.p.abbot ? 'rgba(150,60,10,.9)' : g.p.real ? 'rgba(20,70,130,.85)' : 'rgba(25,12,5,.62)';
      ctx.beginPath(); ctx.roundRect(r[0], r[1], w, hh, hh / 2); ctx.fill();
      if (g.p.me) { ctx.strokeStyle = '#ffe7b0'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.fillText(label, g.x, g.y + 1);
    }
    tags.length = 0;
  }
  // niệm Phật: thỉnh thoảng một vài người khẽ niệm, câu niệm bay lên rồi tan
  const chant = new Map(), CAU = ['Nam Mô A Di Đà Phật', 'A Di Đà Phật', 'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật', 'Nam Mô Quán Thế Âm Bồ Tát'];
  let nextChant = 1, lastT = 0;
  function drawChant(t, ppl) {
    nextChant -= Math.min(.2, Math.max(0, t - lastT)); lastT = t;
    if (nextChant <= 0) {
      nextChant = .8 + Math.random() * 1.6;
      const c = ppl.filter(p => p.sit && !p.me && !p.abbot && !chant.has(p.id));
      if (c.length) { const p = c[Math.random() * c.length | 0]; chant.set(p.id, { t0: t, txt: CAU[Math.random() < .6 ? 0 : Math.random() * CAU.length | 0], at: null }); }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [id, c] of chant) {
      const k = (t - c.t0) / 3.2; if (k >= 1 || !c.at) { if (k >= 1) chant.delete(id); continue; }
      const a = Math.min(1, k * 4) * (1 - k), [x, y] = c.at;
      ctx.font = 'italic 600 14px system-ui,sans-serif'; ctx.fillStyle = `rgba(255,226,150,${a})`;
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(c.txt, x, y - 26 - k * 46); ctx.shadowBlur = 0;
    }
  }

  function frame(now) {
    raf = active ? requestAnimationFrame(frame) : 0;
    const t = now / 1000;
    view.z = Math.max(0, Math.min(1, view.z + view.in.y * -.016));
    view.x = Math.max(-1, Math.min(1, view.x + view.in.x * .02));
    const z = 1 + view.z * .55, sway = Math.sin(t * .3) * 2;
    const hw = W / 2 / z, hh = H / 2 / z, cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const fx = cl(W / 2 + (CX - W / 2) * view.z + view.x * 300 + view.tx * 14 + sway, hw, W - hw), fy = cl(H / 2 - 60 * view.z + view.ty * 8, hh, H - hh);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#1b0c05'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(z, 0, 0, z, W / 2 - fx * z, H / 2 - fy * z);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, W, H);
    // đèn nến lung linh
    ctx.globalCompositeOperation = 'lighter';
    LAMPS.forEach(([x, y, r], i) => {
      const a = .16 + Math.sin(t * 7 + i * 2.1) * .03 + Math.sin(t * 17 + i) * .02;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,190,90,${a})`); g.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    });
    ctx.globalCompositeOperation = 'source-over';
    // khói hương
    if (Math.random() < .25) smoke.push({ x: URN[0] + (Math.random() - .5) * 10, y: URN[1] - 22, t0: t, life: 4 + Math.random() * 2 });
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i], k = (t - s.t0) / s.life; if (k >= 1) { smoke.splice(i, 1); continue; } if (k < 0) continue;
      const gio = window.GIO ? GIO(t) : 1;
      const x = s.x + Math.sin(t * 1.4 + s.t0 * 3) * 6 * k + k * 18 * gio, y = s.y - k * 120, r = 3 + k * 16;
      ctx.fillStyle = `rgba(235,228,220,${.16 * (1 - k)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    // hoa Phật tử vừa dâng
    blooms.forEach(b => { const k = Math.min(1, (t - b.t0) / .8); if (k < 0) return; const s = 5.5 * k;
      ctx.fillStyle = '#ff8fbd'; ctx.beginPath(); ctx.ellipse(b.x - s * .45, b.y, s * .4, s * .8, -.5, 0, 7); ctx.ellipse(b.x + s * .45, b.y, s * .4, s * .8, .5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffb2d2'; ctx.beginPath(); ctx.ellipse(b.x, b.y - s * .15, s * .38, s * .9, 0, 0, 7); ctx.fill(); });
    // đại chúng ngồi quay lưng (xa vẽ trước)
    const S = window.Nguoi && Nguoi.sheets ? Nguoi.sheets() : null;
    const ppl = window.Nguoi && Nguoi.hallPeople ? Nguoi.hallPeople() : window.Nguoi && Nguoi.seated ? Nguoi.seated().map(p => ({ ...p, sit: true })) : [];
    if (S) ppl.map(p => ({ p, y: place(p).y })).sort((a, b) => a.y - b.y).forEach(({ p }, i) => drawPerson(S[p.sheet], p, t, i));
    drawTags(); drawChant(t, ppl);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function refreshCount() {
    count = window.Nguoi ? Nguoi.count() : 0;
    if (label) label.textContent = `Nhìn lên Phật · ${count} người`;
  }
  addEventListener('chua-count', refreshCount);

  window.Dien3D = {
    show() {
      if (failed) return false;
      if (!canvas && !init()) return false;
      refreshCount(); active = true; canvas.classList.add('on'); label.classList.add('on');
      if (!raf) raf = requestAnimationFrame(frame);
      return true;
    },
    hide() { active = false; if (canvas) { canvas.classList.remove('on'); label.classList.remove('on'); } view.in = { x: 0, y: 0 }; },
    active: () => active,
    drive(x, y) { view.in = { x, y }; },
    bow() { bowT = performance.now() / 1000; },
    incense() { const t = performance.now() / 1000; for (let i = 0; i < 24; i++) smoke.push({ x: URN[0] + (Math.random() - .5) * 30, y: URN[1] - 22, t0: t + i * .08, life: 4 + Math.random() * 2 }); },
    flower() { const v = VASES[blooms.length % 2], t = performance.now() / 1000; blooms.push({ x: v[0] + (Math.random() - .5) * 46, y: v[1] + (Math.random() - .5) * 14, t0: t }); while (blooms.length > 24) blooms.shift(); },
    reset() { Object.assign(view, { z: 0, x: 0 }); },
    look(z, fov, x = 0) { view.z = Math.max(0, Math.min(1, (60 - (fov || 50)) / 34)); view.x = x / 2.4; }
  };
})();
