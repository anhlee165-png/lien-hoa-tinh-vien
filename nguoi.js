/* Liên Hoa Tịnh Viện – làm người trong ảnh cử động.
   Mỗi người được cắt ra từ ảnh gốc (giữ nguyên nét vẽ), vẽ lại trên nền đã xoá người,
   rồi cho thở, cúi chào, lạy, niệm Phật bằng biến dạng nửa thân trên quanh hông. */
(() => {
  const DATA = {"monk": {"type": "f", "x": 178, "y": 693, "w": 107, "h": 129, "hip": 775, "name": null}, "p1": {"type": "f", "x": 257, "y": 612, "w": 115, "h": 155, "hip": 711, "name": "Minh Tâm", "tag": [317, 601]}, "p2": {"type": "f", "x": 419, "y": 612, "w": 126, "h": 156, "hip": 711, "name": "Quang Huy", "tag": [491, 602]}, "p3": {"type": "f", "x": 617, "y": 620, "w": 115, "h": 148, "hip": 714, "name": "Liên Hoa", "tag": [680, 609]}, "ban": {"type": "f", "x": 789, "y": 622, "w": 107, "h": 151, "hip": 745, "name": "Bạn", "tag": [842, 609]}, "p5": {"type": "f", "x": 959, "y": 622, "w": 114, "h": 145, "hip": 714, "name": "An Nhiên", "tag": [1020, 609]}, "p6": {"type": "f", "x": 1133, "y": 621, "w": 124, "h": 147, "hip": 715, "name": "Từ Hạnh", "tag": [1189, 609]}, "p7": {"type": "f", "x": 1292, "y": 618, "w": 112, "h": 151, "hip": 714, "name": "Nhật Minh", "tag": [1351, 607]}, "bA": {"type": "b", "x": 239, "y": 574, "w": 70, "h": 110, "hip": 653, "name": null}, "bB": {"type": "b", "x": 339, "y": 560, "w": 94, "h": 125, "hip": 650, "name": null}, "bD": {"type": "b", "x": 509, "y": 563, "w": 73, "h": 123, "hip": 651, "name": null}, "bE": {"type": "b", "x": 580, "y": 575, "w": 66, "h": 98, "hip": 645, "name": null}, "bF": {"type": "b", "x": 688, "y": 560, "w": 82, "h": 130, "hip": 653, "name": null}, "bG": {"type": "b", "x": 932, "y": 576, "w": 78, "h": 113, "hip": 657, "name": null}, "bH": {"type": "b", "x": 1034, "y": 575, "w": 87, "h": 111, "hip": 654, "name": null}, "bI": {"type": "b", "x": 1199, "y": 622, "w": 56, "h": 67, "hip": 670, "name": null}, "bJ": {"type": "b", "x": 1257, "y": 553, "w": 77, "h": 132, "hip": 648, "name": null}, "bK": {"type": "b", "x": 1364, "y": 582, "w": 70, "h": 125, "hip": 672, "name": null}};
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const people = Object.entries(DATA).map(([key, d], i) => ({ key, ...d, ph: i * 1.7 % 6.28, bow: 0, bowT: 0, until: 0, img: null }));
  const byKey = Object.fromEntries(people.map(p => [p.key, p]));
  // vẽ người ở xa trước, gần sau
  const order = [...people].sort((a, b) => (a.type === b.type ? a.y + a.h - (b.y + b.h) : a.type === 'b' ? -1 : 1));
  const tags = {};
  const scene = document.getElementById('scene');
  people.filter(p => p.name).forEach(p => {
    const el = document.createElement('div'); el.className = 'tag' + (p.key === 'ban' ? ' me' : '');
    el.textContent = p.name; el.style.left = p.tag[0] + 'px'; el.style.top = p.tag[1] + 'px';
    scene.appendChild(el); tags[p.key] = el;
  });
  let plate, fg, ready = false;
  Promise.all([load('assets/song/nen.jpg'), load('assets/song/truoc.png'), ...people.map(p => load(`assets/song/${p.key}.png`).then(i => p.img = i))])
    .then(([a, b]) => { plate = a; fg = b; ready = true; document.documentElement.classList.add('song-ready'); });

  function drawPerson(p, t) {
    if (!p.img) return;
    const U = p.hip - p.y, L = p.h - U;
    const headH = Math.round(U * .5), torsoH = U - headH;            // đầu giữ nguyên, thân co lại khi cúi
    const breathe = Math.sin(t * 1.25 + p.ph) * 0.008;
    const drop = U * p.bow * .16;                                      // đầu hạ xuống bao nhiêu px
    const tsy = Math.max(.2, (torsoH - drop) / torsoH) + breathe;
    const hs = 1 + p.bow * (p.type === 'f' ? .035 : -.02);             // gần lại / xa ra khi cúi
    const sway = Math.sin(t * .45 + p.ph) * 0.006;
    const cx = p.x + p.w / 2;
    if (L > 0) ctx.drawImage(p.img, 0, U, p.w, L, p.x, p.hip, p.w, L);
    ctx.save();
    ctx.translate(cx, p.hip + 1); ctx.rotate(sway);
    ctx.save(); ctx.scale(1, tsy);                                     // thân
    ctx.drawImage(p.img, 0, headH, p.w, torsoH + 1, -p.w / 2, -(torsoH + 1), p.w, torsoH + 1);
    ctx.restore();
    const neck = -torsoH * tsy;                                        // đầu + vai, cứng, nối trên thân
    ctx.translate(0, neck + 1); ctx.scale(hs, hs);
    ctx.drawImage(p.img, 0, 0, p.w, headH + 1, -p.w / 2, -(headH + 1), p.w, headH + 1);
    ctx.restore();
    const el = tags[p.key];
    if (el) el.style.transform = `translate(-50%, -50%) translateY(${(torsoH - torsoH * tsy).toFixed(1)}px)`;
  }
  let last = performance.now(), nextRandom = 2;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
    if (ready) {
      for (const p of people) {
        if (p.until && now > p.until) { p.bowT = 0; p.until = 0; }
        p.bow += (p.bowT - p.bow) * (1 - Math.exp(-(p.bowT > p.bow ? 5 : 3.5) * dt));
      }
      nextRandom -= dt;
      if (nextRandom <= 0) {             // thỉnh thoảng có người cúi đầu
        nextRandom = 1.5 + Math.random() * 3.5;
        const p = people[(Math.random() * people.length) | 0];
        if (p.key !== 'ban' && !p.bowT) bow(p.key, .45 + Math.random() * .35, 1100 + Math.random() * 900);
      }
      ctx.drawImage(plate, 0, 0);
      for (const p of order) drawPerson(p, t);
      if (fg) ctx.drawImage(fg, 690, 712);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function bow(key, depth = .6, ms = 1200) { const p = byKey[key]; if (!p) return; p.bowT = depth; p.until = performance.now() + ms; }
  function bowAll(depth = 1, ms = 1400, includeMe = true) {
    people.forEach(p => { if (!includeMe && p.key === 'ban') return; setTimeout(() => bow(p.key, depth * (p.type === 'b' ? .8 : 1), ms), p.key === 'ban' ? 0 : 150 + Math.random() * 650); });
  }
  function beat() {                       // gõ mõ: Bạn và vài người gật nhẹ
    bow('ban', .28, 380);
    for (let i = 0; i < 4; i++) { const p = people[(Math.random() * people.length) | 0]; bow(p.key, .25, 380); }
  }
  async function layPhat(times = 3) {
    for (let i = 0; i < times; i++) { bowAll(1.55, 1500); await new Promise(r => setTimeout(r, 2300)); }
  }
  window.Nguoi = { bow, bowAll, beat, layPhat };
})();
