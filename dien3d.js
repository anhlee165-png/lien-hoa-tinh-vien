/* Liên Hoa Tịnh Viện – góc nhìn thẳng lên điện Phật, dựng 3D bằng Three.js.
   Bố cục theo ảnh điện Phật: tượng Phật vàng ngồi tòa sen, vầng hào quang, hai hàng cột, đèn sen hai bên, bậc cấp.
   Màu theo bản hiện có: cột sơn son, viền vàng, tường kem, nền đá bóng, thảm đỏ, đèn lồng ấm.
   Phật tử (cùng bộ hình với chánh điện) ngồi trên thảm, nhìn từ phía sau. */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { makeMaterials, buildUrn, Incense } from './urn3d.js';

const W = 1672, H = 941;
const V = (x, y) => new THREE.Vector2(x, y);
const PI = Math.PI;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function ctex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8; return t;
}

/* ---------- Họa tiết ---------- */
const GOLD = '#e8b54a', GOLD_HI = '#ffe39a', GOLD_D = '#a8701c', RED = '#a9161b', RED_D = '#6a0c0f';

function lotusMotif(g, x, y, s, col = GOLD) {                  // bông sen nét mảnh
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.2 / s; g.lineJoin = 'round';
  for (const [a, h, w] of [[0, .95, .2], [.5, .78, .2], [-.5, .78, .2], [1.05, .58, .17], [-1.05, .58, .17]]) {
    g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w * 1.4, -h * .5, 0, -h); g.quadraticCurveTo(-w * 1.4, -h * .5, 0, 0); g.stroke(); g.restore();
  }
  g.beginPath(); g.moveTo(-.6, .08); g.quadraticCurveTo(0, .28, .6, .08); g.stroke();
  g.beginPath(); g.arc(0, -.12, .07, 0, PI * 2); g.fill(); g.restore();
}
function cloud(g, x, y, s) {                                     // vân mây cuộn
  g.save(); g.translate(x, y); const lw = g.lineWidth; g.scale(s, s); g.lineWidth = lw / s; g.beginPath();
  g.arc(0, 0, .5, PI * .9, PI * 2.2); g.arc(.75, .1, .3, PI, PI * 2.4); g.arc(-.7, .15, .28, PI * 1.6, PI * .6, true); g.stroke(); g.restore();
}

const tex = {
  marble: () => ctex(1024, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#efdcbd'); gr.addColorStop(1, '#e3c9a2'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(); g.fillStyle = `rgba(${150 + v * 80 | 0},${110 + v * 70 | 0},${70 + v * 50 | 0},.05)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 2 + rnd() * 6); }
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {                               // vân đá
      g.strokeStyle = `rgba(150,105,60,${.06 + rnd() * .1})`; g.lineWidth = .6 + rnd() * 2.2;
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { const nx = x + (rnd() - .3) * 220, ny = y + (rnd() - .5) * 160; g.quadraticCurveTo((x + nx) / 2 + (rnd() - .5) * 90, (y + ny) / 2 + (rnd() - .5) * 90, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    g.strokeStyle = 'rgba(140,95,55,.5)'; g.lineWidth = 3;           // mạch ghép đá
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); }
  }, { repeat: [4, 5.5] }),

  carpet: () => ctex(256, 2048, (g, w, h) => {
    g.fillStyle = '#a3141a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d0d12'; g.fillRect(0, 0, 30, h); g.fillRect(w - 30, 0, 30, h);
    g.fillStyle = GOLD; [[30, 7], [w - 37, 7], [44, 3], [w - 47, 3]].forEach(([x, ww]) => g.fillRect(x, 0, ww, h));
    for (let y = 0; y < h; y += 30) { g.fillRect(10, y + 8, 10, 10); g.fillRect(w - 20, y + 8, 10, 10); }
    for (let y = 128; y < h; y += 256) {
      g.strokeStyle = GOLD; g.lineWidth = 4; g.beginPath(); g.ellipse(w / 2, y, 60, 84, 0, 0, PI * 2); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.ellipse(w / 2, y, 50, 72, 0, 0, PI * 2); g.stroke();
      lotusMotif(g, w / 2, y + 26, 52);
      g.fillStyle = 'rgba(232,181,74,.7)'; for (const d of [-1, 1]) { g.beginPath(); g.arc(w / 2, y + d * 128, 6, 0, PI * 2); g.fill(); }
    }
  }),

  wall: () => ctex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f3e2c4'); gr.addColorStop(1, '#e8d0a8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(160,120,70,${rnd() * .05})`; g.fillRect(rnd() * w, rnd() * h, 3, 3); }
  }, { repeat: [6, 1] }),

  wainscot: () => ctex(1024, 256, (g, w, h) => {
    g.fillStyle = '#5a2010'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 256) {
      g.fillStyle = '#7a2c14'; g.fillRect(x + 18, 30, 220, h - 60);
      g.strokeStyle = GOLD; g.lineWidth = 4; g.strokeRect(x + 26, 38, 204, h - 76);
      g.lineWidth = 3; cloud(g, x + 128, h / 2, 44);
    }
    g.fillStyle = GOLD; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 8, w, 8);
  }, { repeat: [5, 1] }),

  column: () => ctex(512, 2048, (g, w, h) => {
    g.fillStyle = '#b01b1e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(90,0,0,${rnd() * .06})`; g.fillRect(rnd() * w, rnd() * h, 2, 8); }
    const band = (y0, y1) => {
      g.fillStyle = GOLD_D; g.fillRect(0, y0, w, y1 - y0); g.fillStyle = GOLD; g.fillRect(0, y0, w, 10); g.fillRect(0, y1 - 10, w, 10);
      g.strokeStyle = GOLD; g.lineWidth = 3; for (let x = 0; x < w; x += 64) cloud(g, x + 32, (y0 + y1) / 2 + 8, 20);
    };
    band(30, 130); band(1760, 1860);
    g.strokeStyle = 'rgba(232,181,74,.85)'; g.lineWidth = 5;             // dây vân vàng quấn cột
    for (let k = 0; k < 2; k++) { g.beginPath(); for (let x = -w; x <= w * 2; x += 4) { const y = 300 + (x + k * w / 2) * .9; x === -w ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
  }),

  beam: () => ctex(1024, 128, (g, w, h) => {
    g.fillStyle = RED; g.fillRect(0, 0, w, h); g.fillStyle = GOLD; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.strokeStyle = GOLD; g.lineWidth = 3;
    for (let x = 0; x < w; x += 128) { g.strokeRect(x + 10, 22, 108, h - 44); lotusMotif(g, x + 64, h / 2 + 18, 26); }
  }, { repeat: [4, 1] }),

  ceiling: () => ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#3d1408'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = i * 256, y = j * 256;
      g.fillStyle = '#6e2410'; g.fillRect(x + 16, y + 16, 224, 224);
      g.strokeStyle = GOLD; g.lineWidth = 6; g.strokeRect(x + 22, y + 22, 212, 212);
      g.fillStyle = '#8d2d14'; g.beginPath(); g.arc(x + 128, y + 128, 70, 0, PI * 2); g.fill();
      g.lineWidth = 3; g.beginPath(); g.arc(x + 128, y + 128, 70, 0, PI * 2); g.stroke();
      for (let k = 0; k < 8; k++) { g.save(); g.translate(x + 128, y + 128); g.rotate(k * PI / 4); lotusMotif(g, 0, -10, 46); g.restore(); }
    }
  }, { repeat: [8, 10] }),

  carved: () => ctex(2048, 1024, (g, w, h) => {                       // vách gỗ chạm vàng phía sau tượng
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4a160b'); gr.addColorStop(1, '#6a1d0d'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cell = 128;
    for (let x = 0; x < w; x += cell) for (let y = 0; y < h; y += cell) {
      g.strokeStyle = GOLD_D; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, cell - 16, cell - 16);
      g.strokeStyle = GOLD; g.lineWidth = 3; g.beginPath(); g.arc(x + cell / 2, y + cell / 2, 34, 0, PI * 2); g.stroke();
      for (let k = 0; k < 4; k++) { g.save(); g.translate(x + cell / 2, y + cell / 2); g.rotate(k * PI / 2 + PI / 4); g.strokeStyle = GOLD; g.lineWidth = 2.5; cloud(g, 0, -46, 14); g.restore(); }
      lotusMotif(g, x + cell / 2, y + cell / 2 + 10, 24, GOLD_HI);
    }
    g.fillStyle = 'rgba(255,190,90,.06)'; g.fillRect(0, 0, w, h);
  }, { repeat: [2, 1] }),

  pedestal: () => ctex(1024, 256, (g, w, h) => {
    g.fillStyle = RED; g.fillRect(0, 0, w, h);
    g.fillStyle = GOLD; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    g.strokeStyle = GOLD; g.lineWidth = 4;
    for (let x = 0; x < w; x += 128) { g.strokeRect(x + 10, 40, 108, h - 80); lotusMotif(g, x + 64, h / 2 + 22, 38); }
  }),

  tableFront: () => ctex(1024, 256, (g, w, h) => {
    g.fillStyle = '#8f1418'; g.fillRect(0, 0, w, h);
    g.strokeStyle = GOLD; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
    for (let x = 0; x < 4; x++) { const cx = 128 + x * 256; g.strokeRect(cx - 100, 50, 200, h - 100); lotusMotif(g, cx, h / 2 + 26, 54); for (const d of [-1, 1]) cloud(g, cx + d * 66, h / 2 - 10, 18); }
  }),

  halo: () => ctex(1024, 1024, (g, w, h) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(255,240,190,.95)'); gr.addColorStop(.55, 'rgba(255,214,120,.55)'); gr.addColorStop(.8, 'rgba(232,170,60,.35)'); gr.addColorStop(1, 'rgba(232,170,60,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, PI * 2); g.fill();
    g.strokeStyle = 'rgba(176,112,24,.9)'; g.lineWidth = 6;
    for (const r of [.5, .62, .8, .9]) { g.beginPath(); g.arc(c, c, c * r, 0, PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(176,112,24,.85)';
    for (let k = 0; k < 64; k++) { const a = k / 64 * PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * c * .71, c + Math.sin(a) * c * .71, 9, 0, PI * 2); g.fill(); }
    for (let k = 0; k < 36; k++) { g.save(); g.translate(c, c); g.rotate(k / 36 * PI * 2); lotusMotif(g, 0, -c * .84, 40, 'rgba(176,112,24,.9)'); g.restore(); }
    g.strokeStyle = 'rgba(255,240,190,.5)'; g.lineWidth = 2;
    for (let k = 0; k < 120; k++) { const a = k / 120 * PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * .2, c + Math.sin(a) * c * .2); g.lineTo(c + Math.cos(a) * c * .5, c + Math.sin(a) * c * .5); g.stroke(); }
  }),

  glow: () => ctex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,236,180,1)'); gr.addColorStop(.25, 'rgba(255,190,90,.55)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }),

  flame: () => ctex(128, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * .66, 2, w / 2, h * .6, h * .45); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(.3, 'rgba(255,214,110,.95)'); gr.addColorStop(.7, 'rgba(255,140,40,.4)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2, h * .05); g.quadraticCurveTo(w * .95, h * .6, w / 2, h * .95); g.quadraticCurveTo(w * .05, h * .6, w / 2, h * .05); g.fill();
  }),

  shaft: () => ctex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,230,170,.0)'); gr.addColorStop(.25, 'rgba(255,230,170,.5)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const s = g.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(.5, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = s; g.fillRect(0, 0, w, h);
  }),

  label: (text) => ctex(512, 128, (g, w, h) => {
    g.fillStyle = '#f6e7c4'; g.fillRect(0, 0, w, h); g.strokeStyle = GOLD_D; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#4a1d08'; g.font = 'bold 44px "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  }),

  tag: (text) => ctex(256, 96, (g, w, h) => {
    g.fillStyle = '#1f7a3a'; g.beginPath(); g.roundRect(20, 14, w - 40, h - 28, 30); g.fill();
    g.strokeStyle = '#bff0c8'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  })
};

/* ---------- Vật liệu ---------- */
function materials() {
  return {
    gold: new THREE.MeshStandardMaterial({ color: 0xe5b04a, metalness: .85, roughness: .3 }),
    goldHi: new THREE.MeshStandardMaterial({ color: 0xffd57a, metalness: .9, roughness: .22 }),
    buddha: new THREE.MeshStandardMaterial({ color: 0xf2c057, metalness: .78, roughness: .3, emissive: 0x4a2a00, emissiveIntensity: .55 }),
    buddhaHair: new THREE.MeshStandardMaterial({ color: 0xd49a38, metalness: .8, roughness: .42, emissive: 0x2a1600, emissiveIntensity: .4 }),
    lacquer: new THREE.MeshPhysicalMaterial({ color: 0xa3161a, roughness: .38, metalness: .05, clearcoat: .7, clearcoatRoughness: .25 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a2010, roughness: .5, metalness: .05 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd9c19c, roughness: .35, metalness: 0 }),
    lantern: new THREE.MeshStandardMaterial({ color: 0xe8902a, emissive: 0xff8a1a, emissiveIntensity: .8, roughness: .6 }),
    candle: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc070, emissiveIntensity: .35, roughness: .6 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x8a5230, roughness: .85 }),
    lotusPink: new THREE.MeshStandardMaterial({ color: 0xf3a1b8, roughness: .6, emissive: 0x401020, emissiveIntensity: .2 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: .7 })
  };
}

/* cánh sen bầu: hình giọt nước, đầu nhọn */
function petalGeo(w, h, d) {
  const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = y > 0 ? 1 - Math.pow(y, 1.6) * .82 : 1 - Math.pow(-y, 2) * .25;
    p.setXYZ(i, p.getX(i) * w * k, (y + 1) * h / 2, p.getZ(i) * d * k);
  }
  g.computeVertexNormals(); return g;
}
function lotusRing(mat, n, r, y, w, h, d, tilt, phase = 0) {
  const grp = new THREE.Group(), geo = petalGeo(w, h, d);
  for (let i = 0; i < n; i++) {
    const a = (i + phase) / n * PI * 2, m = new THREE.Mesh(geo, mat);
    const piv = new THREE.Group(); piv.rotation.y = a; piv.position.y = y;
    m.position.z = r; m.rotation.x = tilt; piv.add(m); grp.add(piv);
  }
  return grp;
}

/* ---------- Tượng Phật: tách từ ảnh điện, dựng nổi khối theo bản đồ chiều sâu ---------- */
function buildStatue(height) {
  const g = new THREE.Group(), w = height * 760 / 670;
  const t = new THREE.TextureLoader().load('assets/dien/phat.webp'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(w, height, 190, 168);
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .45, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.position.y = height / 2; g.add(mesh);
  const img = new Image(); img.src = 'assets/dien/phat-sau.png';
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), v = 1 - uv.getY(i);
      const px = Math.min(c.width - 1, u * (c.width - 1) | 0), py = Math.min(c.height - 1, v * (c.height - 1) | 0);
      const dv = d[(py * c.width + px) * 4] / 255;
      pos.setZ(i, Math.pow(dv, 1.2) * height * .3);
    }
    pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  };
  return g;
}

/* ---------- Đèn sen ---------- */
function lotusLamp(M, flameMat, glowMat, height) {
  const L = new THREE.Group();
  const prof = [V(0, 0), V(.34, 0), V(.34, .06), V(.24, .12), V(.2, .2), V(.1, .26), V(.07, .32), V(.07, height * .45), V(.11, height * .47), V(.07, height * .5),
    V(.06, height * .78), V(.12, height * .8), V(.06, height * .83), V(.08, height * .9), V(.16, height * .92), V(0, height * .93)];
  L.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 32), M.gold));
  const top = height * .9;
  L.add(lotusRing(M.goldHi, 10, .13, top, .09, .26, .05, .55));
  L.add(lotusRing(M.gold, 10, .09, top + .02, .07, .22, .04, .3, .5));
  const cand = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .12, 12), M.candle); cand.position.y = top + .1; L.add(cand);
  const fl = new THREE.Sprite(flameMat); fl.scale.set(.09, .18, 1); fl.position.y = top + .24; L.add(fl);
  const gl = new THREE.Sprite(glowMat); gl.scale.setScalar(.9); gl.position.y = top + .22; L.add(gl);
  L.userData.flame = fl; L.userData.glow = gl;
  return L;
}
function lantern(M, glowMat) {
  const L = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry([V(0, -.42), V(.22, -.38), V(.36, -.2), V(.4, 0), V(.36, .2), V(.22, .38), V(0, .42)], 32), M.lantern); L.add(body);
  for (const y of [-.4, .4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .06, 24), M.gold); c.position.y = y; L.add(c); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const rib = new THREE.Mesh(new THREE.TorusGeometry(.4, .008, 4, 24, PI), M.gold); rib.rotation.set(0, a, PI / 2); L.add(rib); }
  const tas = new THREE.Mesh(new THREE.CylinderGeometry(.03, .06, .3, 8), new THREE.MeshStandardMaterial({ color: 0xc21d1d, roughness: .8 })); tas.position.y = -.6; L.add(tas);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 2, 6), M.gold); cord.position.y = 1.4; L.add(cord);
  const gl = new THREE.Sprite(glowMat); gl.scale.setScalar(2.2); L.add(gl);
  return L;
}
function vase(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry([V(0, 0), V(.07, 0), V(.1, .06), V(.07, .16), V(.05, .2), V(.07, .24), V(0, .24)], 20), M.gold));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * PI * 2, s = new THREE.Group(); s.position.y = .24; s.rotation.set(Math.cos(a) * .35, 0, Math.sin(a) * .35); g.add(s);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .3, 5), M.leaf); st.position.y = .15; s.add(st);
    const f = lotusRing(M.lotusPink, 6, .02, .3, .03, .08, .018, .45); s.add(f);
  }
  return g;
}

/* ---------- Dựng cảnh ---------- */
function buildHall(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a0d06);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const M = materials();
  const flameMat = new THREE.SpriteMaterial({ map: tex.flame(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glowMat = new THREE.SpriteMaterial({ map: tex.glow(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 });
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // nền đá, thảm đỏ, tường, trần
  const floor = add(new THREE.PlaneGeometry(16, 22), new THREE.MeshStandardMaterial({ map: tex.marble(), roughness: .16, metalness: 0, envMapIntensity: 1.2 }), 0, 0, 0);
  floor.rotation.x = -PI / 2;
  const carpet = add(new THREE.PlaneGeometry(2.3, 14.6), new THREE.MeshStandardMaterial({ map: tex.carpet(), roughness: .9 }), 0, .006, 2.9);
  carpet.rotation.x = -PI / 2; carpet.material.map.wrapT = THREE.RepeatWrapping; carpet.material.map.repeat.set(1, 3.6);
  const wallM = new THREE.MeshStandardMaterial({ map: tex.wall(), roughness: .9 });
  const wainM = new THREE.MeshStandardMaterial({ map: tex.wainscot(), roughness: .5 });
  for (const s of [-1, 1]) {
    const w = add(new THREE.PlaneGeometry(22, 7.6), wallM, s * 8, 3.8, 0); w.rotation.y = -s * PI / 2;
    const ws = add(new THREE.BoxGeometry(.08, 1.05, 22), wainM, s * 7.96, .52, 0);
    ws.material = new THREE.MeshStandardMaterial({ map: (() => { const t = tex.wainscot(); t.repeat.set(9, 1); return t; })(), roughness: .5 });
    add(new THREE.BoxGeometry(.12, .07, 22), M.gold, s * 7.93, 1.07, 0);
    add(new THREE.BoxGeometry(.12, .1, 22), M.gold, s * 7.93, 6.1, 0);
  }
  const ceil = add(new THREE.PlaneGeometry(16, 22), new THREE.MeshStandardMaterial({ map: tex.ceiling(), roughness: .6 }), 0, 7.6, 0); ceil.rotation.x = PI / 2;

  // vách chạm vàng phía sau + khám thờ
  add(new THREE.PlaneGeometry(16, 7.6), new THREE.MeshStandardMaterial({ map: tex.carved(), color: 0x9a6a50, roughness: .5, metalness: .2 }), 0, 3.8, -10);
  const arch = new THREE.Shape(); arch.moveTo(-3.3, 0); arch.lineTo(-3.3, 4.6); arch.quadraticCurveTo(-3.3, 7, 0, 7.15); arch.quadraticCurveTo(3.3, 7, 3.3, 4.6); arch.lineTo(3.3, 0); arch.lineTo(-3.3, 0);
  const hole = new THREE.Path(); hole.moveTo(-2.95, 0); hole.lineTo(-2.95, 4.55); hole.quadraticCurveTo(-2.95, 6.7, 0, 6.8); hole.quadraticCurveTo(2.95, 6.7, 2.95, 4.55); hole.lineTo(2.95, 0); hole.lineTo(-2.95, 0); arch.holes.push(hole);
  const archM = add(new THREE.ExtrudeGeometry(arch, { depth: .18, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2 }), M.gold, 0, .02, -9.95);
  const niche = add(new THREE.PlaneGeometry(5.9, 6.8), new THREE.MeshStandardMaterial({ color: 0x7a1c10, roughness: .5, metalness: .1, map: (() => { const t = tex.carved(); t.repeat.set(1, 1); return t; })() }), 0, 3.4, -9.98);
  niche.material.color.set(0xb07050);
  // hai khám nhỏ hai bên
  const smallArch = new THREE.ExtrudeGeometry(arch, { depth: .12, bevelEnabled: false }); smallArch.scale(.36, .36, 1);
  for (const s of [-1, 1]) {
    add(smallArch, M.gold, s * 5.6, .9, -9.95);
    const t = add(new THREE.BoxGeometry(1.6, .9, .6), M.lacquer, s * 5.6, .45, -9.6);
    add(new THREE.BoxGeometry(1.7, .05, .7), M.gold, s * 5.6, .92, -9.6);
  }

  // bậc cấp + bệ thờ
  const stepM = new THREE.MeshStandardMaterial({ color: 0x5c2312, roughness: .32, metalness: .05 });
  [[11.4, .22, 5.2, -7.6], [10.6, .44, 4.7, -7.85], [10, .66, 4.2, -8.1]].forEach(([w, h, d, z]) => {
    add(new THREE.BoxGeometry(w, h, d), stepM, 0, h / 2, z);
    add(new THREE.BoxGeometry(w + .02, .035, .04), M.gold, 0, h, z + d / 2);
  });
  // tòa sen + bệ
  const throne = new THREE.Group(); throne.position.set(0, .66, -8.2); throne.scale.setScalar(1.45); scene.add(throne);
  const pedProf = [V(0, 0), V(1.75, 0), V(1.75, .14), V(1.55, .2), V(1.38, .3), V(1.32, .62), V(1.45, .72), V(1.6, .8), V(1.6, .9), V(0, .9)];
  const pt = tex.pedestal(); pt.wrapS = THREE.RepeatWrapping; pt.repeat.set(3, 1);
  throne.add(new THREE.Mesh(new THREE.LatheGeometry(pedProf, 64), new THREE.MeshStandardMaterial({ map: pt, metalness: .4, roughness: .4 })));
  add(new THREE.CylinderGeometry(1.5, 1.55, .1, 48), M.gold, 0, .95, 0, throne);
  const buddha = buildStatue(4.7); buddha.position.set(0, .66 + 1.45 * 1.0, -8.6); scene.add(buddha);
  // hào quang
  const haloT = tex.halo();
  const halo = add(new THREE.CircleGeometry(1.15, 64), new THREE.MeshBasicMaterial({ map: haloT, transparent: true, depthWrite: false, toneMapped: false }), 0, 5.9, -9.4);
  const body = add(new THREE.CircleGeometry(2.85, 64), new THREE.MeshBasicMaterial({ map: haloT, transparent: true, depthWrite: false, opacity: .7, toneMapped: false }), 0, 4.7, -9.7);
  body.scale.set(.95, 1.12, 1);
  const bigGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .35 }));
  bigGlow.scale.set(8, 8, 1); bigGlow.position.set(0, 4.3, -9.4); scene.add(bigGlow);
  // ánh sáng rọi xuống tượng
  const shaftM = new THREE.MeshBasicMaterial({ map: tex.shaft(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .2, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) { const s = add(new THREE.PlaneGeometry(2.4 - i * .5, 8), shaftM, (i - 1) * .9, 4.4, -6.8 + i * .3); s.rotation.set(-.45, 0, (i - 1) * .1); }

  // bàn thờ phía trước
  const table = new THREE.Group(); table.position.set(0, .66, -6.25); scene.add(table);
  const tf = tex.tableFront();
  const tm = [M.lacquer, M.lacquer, M.lacquer, M.lacquer, new THREE.MeshStandardMaterial({ map: tf, roughness: .4, metalness: .2 }), M.lacquer];
  add(new THREE.BoxGeometry(4.4, .92, 1.0), tm, 0, .46, 0, table);
  add(new THREE.BoxGeometry(4.6, .07, 1.12), M.gold, 0, .95, 0, table);
  const UM = makeMaterials(), urn = buildUrn(UM); urn.scale.setScalar(.27); urn.position.set(0, .985, 0); table.add(urn);
  const incense = new Incense(urn, UM); incense.add(9, .34);
  for (const s of [-1, 1]) {
    const cs = new THREE.Group(); cs.position.set(s * 1.6, .985, 0); table.add(cs);
    cs.add(new THREE.Mesh(new THREE.LatheGeometry([V(0, 0), V(.12, 0), V(.06, .05), V(.035, .4), V(.09, .44), V(0, .45)], 20), M.gold));
    const c = add(new THREE.CylinderGeometry(.04, .04, .22, 12), M.candle, 0, .56, 0, cs);
    const f = new THREE.Sprite(flameMat); f.scale.set(.08, .16, 1); f.position.y = .74; cs.add(f);
    const v = vase(M); v.position.set(s * .9, .985, .05); v.scale.setScalar(1.3); table.add(v);
    const fr = new THREE.Group(); fr.position.set(s * .5, .985, .25); table.add(fr);
    fr.add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .1, .06, 20), M.gold));
    for (let i = 0; i < 5; i++) { const o = add(new THREE.SphereGeometry(.06, 12, 10), new THREE.MeshStandardMaterial({ color: [0xf2a23a, 0xe0c040, 0xd9652a][i % 3], roughness: .5 }), Math.cos(i * 1.3) * .07, .08 + (i > 3 ? .08 : 0), Math.sin(i * 1.3) * .07, fr); }
  }

  // cột sơn son
  const colT = tex.column();
  const colM = new THREE.MeshPhysicalMaterial({ map: colT, roughness: .35, clearcoat: .6, clearcoatRoughness: .3 });
  const baseG = new THREE.LatheGeometry([V(0, 0), V(.52, 0), V(.52, .12), V(.44, .2), V(.4, .32), V(.36, .4), V(0, .4)], 32);
  const capG = new THREE.LatheGeometry([V(0, 0), V(.34, 0), V(.42, .12), V(.46, .2), V(.36, .3), V(0, .3)], 32);
  const beamT = tex.beam();
  const beamM = new THREE.MeshStandardMaterial({ map: beamT, roughness: .45 });
  for (const z of [7.4, 3.2, -1, -5]) {
    for (const x of [-3.5, 3.5]) {
      add(new THREE.CylinderGeometry(.3, .32, 7.2, 32), colM, x, 3.6, z);
      add(baseG, M.gold, x, 0, z); add(capG, M.gold, x, 6.9, z);
    }
    const bm = add(new THREE.BoxGeometry(16, .42, .34), beamM, 0, 7.3, z);
    for (const x of [-3.5, 3.5]) { const br = add(new THREE.BoxGeometry(.9, .2, .3), M.gold, x, 7.0, z); }
  }
  for (const x of [-3.5, 3.5]) add(new THREE.BoxGeometry(.32, .38, 22), beamM, x, 7.3, 0);

  // đèn lồng
  const lights = [];
  for (const [x, y, z, big] of [[0, 5.5, 5.2, 1], [0, 5.6, 1, 1], [0, 5.9, -3.2, 1.25], [-5.6, 5.8, 3, .8], [5.6, 5.8, 3, .8], [-5.6, 5.8, -1.5, .8], [5.6, 5.8, -1.5, .8]]) {
    const l = lantern(M, glowMat); l.position.set(x, y, z); l.scale.setScalar(big); scene.add(l);
  }
  for (const [x, y, z, i] of [[0, 5, 3, 14], [0, 5.2, -3.2, 16], [-4.5, 4.5, -2, 8], [4.5, 4.5, -2, 8]]) {
    const p = new THREE.PointLight(0xffb060, i, 14, 1.6); p.position.set(x, y, z); scene.add(p); lights.push(p);
  }

  // đèn sen đứng hai bên
  const lamps = [];
  for (const [x, z, h] of [[-4.6, -4.9, 2.3], [4.6, -4.9, 2.3], [-6.6, -2.4, 1.8], [6.6, -2.4, 1.8], [-2.2, -6.7, 1.3], [2.2, -6.7, 1.3]]) {
    const L = lotusLamp(M, flameMat, glowMat, h); L.position.set(x, z < -6 ? .66 : 0, z); scene.add(L); lamps.push(L);
  }

  // tranh Phật trên tường (lấy từ tranh trong chánh điện)
  const loader = new THREE.TextureLoader();
  const names = { t: ['Phật A Di Đà', 'Quán Thế Âm Bồ Tát', 'Địa Tạng Bồ Tát', 'Văn Thù Bồ Tát', 'Đức Phật Đản Sanh'], p: ['Phổ Hiền Bồ Tát', 'Phật Dược Sư', 'Phật Thành Đạo', 'Phật Thuyết Pháp', 'Phật Nhập Niết Bàn'] };
  for (const [side, s] of [['t', -1], ['p', 1]]) {
    names[side].forEach((nm, i) => {
      const g = new THREE.Group(); g.position.set(s * 7.9, 3.35, [5.3, 1.1, -3.05, -7.1, 9.2][i]); g.rotation.y = -s * PI / 2; scene.add(g);
      const t = loader.load(`assets/dien/tranh-${side}${i + 1}.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      add(new THREE.BoxGeometry(1.86, 2.62, .08), M.goldHi, 0, 0, .0, g);
      const pic = add(new THREE.PlaneGeometry(1.62, 2.36), new THREE.MeshStandardMaterial({ map: t, roughness: .55, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .25 }), 0, 0, .045, g);
      const lb = add(new THREE.PlaneGeometry(1.3, .32), new THREE.MeshStandardMaterial({ map: tex.label(nm), roughness: .7 }), 0, -1.65, .02, g);
      const lamp = add(new THREE.CylinderGeometry(.04, .06, .5, 10), M.gold, 0, 1.5, .25, g); lamp.rotation.x = PI / 2.6;
      const gl = new THREE.Sprite(glowMat); gl.scale.setScalar(1.2); gl.position.set(0, 1.42, .45); g.add(gl);
    });
  }

  // phật tử ngồi trên bồ đoàn, nhìn từ phía sau
  const people = new THREE.Group(); scene.add(people);
  const cushG = new THREE.CylinderGeometry(.3, .33, .1, 24);
  const sprites = { nu: loader.load('assets/song/nu.png'), nam: loader.load('assets/song/nam.png') };
  const mats = {};
  for (const k of ['nu', 'nam']) {
    const t = sprites[k]; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 4, 1 / 6); t.offset.set(1 / 4, 0); t.magFilter = THREE.LinearFilter;
    mats[k] = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: .25 });
    const tu = t.clone(); tu.repeat.set(1 / 4, 1 / 6); tu.offset.set(0, 4 / 6); tu.needsUpdate = true;     // đứng quay lưng (cho “Bạn”)
    mats[k + 'Up'] = new THREE.SpriteMaterial({ map: tu, transparent: true, alphaTest: .25 });
  }
  const seats = [];
  for (let r = 0; r < 9; r++) {
    const z = -3.7 + r * 1.05;
    const xs = [1.55, 2.45, 4.45, 5.35, 6.25];
    xs.forEach((x, ci) => [-1, 1].forEach(s => {
      if ((z > -1.5 && z < -.5 || z > 2.7 && z < 3.7) && ci >= 1 && ci <= 2) return;   // chừa chỗ cột
      seats.push({ x: s * x, z, order: r * 10 + ci * 2 + (s > 0 ? 1 : 0) });
    }));
  }
  seats.sort((a, b) => a.order - b.order);
  const crowd = seats.map((st, i) => {
    add(cushG, M.cushion, st.x, .05, st.z, people);
    const sp = new THREE.Sprite(mats[i % 3 === 1 ? 'nam' : 'nu']); sp.center.set(.5, .06); sp.scale.set(.5, .77, 1); sp.position.set(st.x, .09, st.z);
    sp.visible = false; people.add(sp); return { sp, bow: 0, ph: rnd() * 6 };
  });
  // “Bạn” trên thảm đỏ trước bàn thờ
  add(cushG, M.cushion, 0, .05, -4.1, people);
  const me = new THREE.Sprite(mats.nuUp); me.center.set(.5, .03); me.scale.set(.5, .77, 1); me.position.set(0, .07, -4.1); people.add(me);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.tag('Bạn'), transparent: true, depthTest: false })); tag.scale.set(.5, .19, 1); tag.position.set(0, 1.25, -4.1); people.add(tag);

  // ánh sáng chung
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x7a3418, .9));
  const key = new THREE.SpotLight(0xffe2b0, 70, 20, .45, .7, 1.4); key.position.set(0, 7.2, -1.8); key.target = buddha; scene.add(key);
  const fill = new THREE.DirectionalLight(0xffd8a0, 1.1); fill.position.set(2, 5, 8); scene.add(fill);

  return { scene, buddha, halo, body, bigGlow, lamps, lights, incense, crowd, me, M };
}

/* ---------- Điều khiển ---------- */
let renderer, hall, camera, canvas, label, active = false, failed = false, raf = 0, last = 0, lastDraw = 0;
const view = { x: 0, z: 7, yaw: 0, pitch: 0, fov: 50, tx: 0, ty: 0, in: { x: 0, y: 0 }, drag: null };
let bowT = -99, count = 0;

function init() {
  canvas = document.createElement('canvas'); canvas.id = 'dien3d'; canvas.width = W; canvas.height = H;
  canvas.setAttribute('aria-label', 'Nhìn thẳng lên điện Phật: tượng Phật vàng ngồi tòa sen, hào quang, đèn sen hai bên, đại chúng ngồi phía trước');
  document.getElementById('scene').after(canvas);
  label = document.createElement('div'); label.id = 'dien3d-tag'; canvas.after(label);
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { failed = true; return false; }
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9; renderer.outputColorSpace = THREE.SRGBColorSpace;
  hall = buildHall(renderer);
  camera = new THREE.PerspectiveCamera(view.fov, W / H, .1, 60);
  canvas.addEventListener('pointerdown', e => { view.drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(); view.tx = (e.clientX - r.left) / r.width - .5; view.ty = (e.clientY - r.top) / r.height - .5;
    if (view.drag) { view.yaw = Math.max(-.6, Math.min(.6, view.drag.yaw + (e.clientX - view.drag.x) / r.width * 1.6)); view.pitch = Math.max(-.25, Math.min(.3, view.drag.pitch + (e.clientY - view.drag.y) / r.height * .9)); }
  });
  const up = () => view.drag = null; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.fov = Math.max(26, Math.min(60, view.fov + e.deltaY * .02)); }, { passive: false });
  return true;
}

function frame(now) {
  raf = active ? requestAnimationFrame(frame) : 0;
  if (now - lastDraw < 30) return;                                  // ~30 hình/giây là đủ êm
  const t = now / 1000, dt = Math.min(.1, (now - (last || now)) / 1000); last = now; lastDraw = now;
  // đi lên / lùi lại theo joystick
  view.z = Math.max(-.8, Math.min(9.4, view.z + view.in.y * dt * 2.6));
  view.x = Math.max(-2.4, Math.min(2.4, view.x + view.in.x * dt * 2));
  const sway = Math.sin(t * .3) * .05;
  camera.position.set(view.x + view.tx * .35 + sway, 1.75 - view.ty * .2 + Math.sin(t * .45) * .02, view.z);
  const look = new THREE.Vector3(view.x * .4 + Math.sin(view.yaw) * 10, 3.0 - view.pitch * 8 - view.ty * .3, view.z - Math.cos(view.yaw) * 10);
  look.x += view.tx * .6; camera.lookAt(look);
  if (Math.abs(camera.fov - view.fov) > .01) { camera.fov += (view.fov - camera.fov) * .2; camera.updateProjectionMatrix(); }
  // lửa nến, đèn, hào quang
  hall.lamps.forEach((L, i) => { const f = 1 + Math.sin(t * 9 + i * 2) * .08 + Math.sin(t * 23 + i) * .05; L.userData.flame.scale.set(.09 * f, .18 * f, 1); L.userData.glow.material.opacity = .5; });
  hall.lights.forEach((p, i) => { p.userData.i0 ??= p.intensity; p.intensity = p.userData.i0 * (1 + Math.sin(t * 5 + i * 1.7) * .06); });
  hall.halo.rotation.z = t * .05; hall.body.rotation.z = -t * .02;
  hall.bigGlow.material.opacity = .3 + Math.sin(t * .8) * .05;
  hall.incense.update(t, dt);
  // đại chúng: đủ số người đang có, khẽ thở; khi lạy thì cúi rạp
  const n = Math.min(hall.crowd.length, Math.max(0, count - 1));
  hall.crowd.forEach((c, i) => {
    c.sp.visible = i < n; if (!c.sp.visible) return;
    const k = t - bowT - (i % 7) * .08, b = k > 0 && k < 6 ? Math.max(0, Math.sin(k / 2 * PI)) : 0;
    c.sp.scale.set(.5, .77 * (1 - .38 * b) * (1 + Math.sin(t * 1.3 + c.ph) * .008), 1);
  });
  const kb = t - bowT, bm = kb > 0 && kb < 6 ? Math.max(0, Math.sin(kb / 2 * PI)) : 0;
  hall.me.scale.set(.5, .77 * (1 - .38 * bm), 1);
  renderer.render(hall.scene, camera);
}

function refreshCount() {
  count = window.Nguoi ? Nguoi.count() : 50;
  if (label) label.textContent = `Nhìn lên Phật · ${count} người`;
}
addEventListener('chua-count', refreshCount);

window.Dien3D = {
  show() {
    if (failed) return false;
    if (!renderer && !init()) return false;
    refreshCount(); active = true; canvas.classList.add('on'); label.classList.add('on');
    if (!raf) raf = requestAnimationFrame(frame);
    return true;
  },
  hide() { active = false; if (canvas) { canvas.classList.remove('on'); label.classList.remove('on'); } view.in = { x: 0, y: 0 }; },
  active: () => active,
  drive(x, y) { view.in = { x, y }; },
  bow() { bowT = performance.now() / 1000; },
  incense() { if (hall) hall.incense.add(3, .3); },
  reset() { Object.assign(view, { x: 0, z: 7, yaw: 0, pitch: 0, fov: 50 }); },
  look(z, fov, x = 0) { Object.assign(view, { z, fov, x }); }
};
