/* Liên Hoa Tịnh Viện – lư hương đồng 3D (Three.js).
   Thân đồng ba chân đầu lân, hai quai cuộn, hoa sen nổi quanh bụng, hương cháy và khói bay.
   Dùng hai nơi: vẽ vào cảnh sân (chua.js gọi Urn3D.draw) và cửa sổ xem cận cảnh xoay 360°. */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const V = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- Vật liệu ---------- */
function makeMaterials() {
  // vân đồng: nhiễu nhẹ để bề mặt không bóng phẳng như nhựa
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 110 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  const rough = new THREE.CanvasTexture(c); rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(3, 3);
  return {
    bronze: new THREE.MeshStandardMaterial({ color: 0xc9973f, metalness: .86, roughness: .33, roughnessMap: rough }),
    bronzeDark: new THREE.MeshStandardMaterial({ color: 0x9c7228, metalness: .85, roughness: .42 }),
    bronzeHi: new THREE.MeshStandardMaterial({ color: 0xf3cf70, metalness: .88, roughness: .2 }),
    ash: new THREE.MeshStandardMaterial({ color: 0x8d7f6c, metalness: 0, roughness: 1 }),
    stick: new THREE.MeshStandardMaterial({ color: 0xb21f2a, metalness: 0, roughness: .7 }),
    stickBase: new THREE.MeshStandardMaterial({ color: 0xd8c08a, metalness: 0, roughness: .8 })
  };
}

/* ---------- Mô hình (đơn vị: bán kính bụng = 1) ---------- */
function buildUrn(M) {
  const urn = new THREE.Group();
  // thân: tiện tròn, có thành trong
  const prof = [V(0, .78), V(.42, .78), V(.6, .82), V(.78, .91), V(.92, 1.03), V(.99, 1.18), V(1, 1.3), V(.97, 1.42), V(.9, 1.53),
    V(.8, 1.63), V(.72, 1.7), V(.71, 1.76), V(.75, 1.8), V(.8, 1.84), V(.81, 1.89), V(.8, 1.92), V(.74, 1.92), V(.71, 1.87), V(.68, 1.78), V(.67, 1.7)];
  urn.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), M.bronze));
  // gờ trang trí
  const ring = (r, y, tube, mat = M.bronzeHi) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 96), mat); m.rotation.x = Math.PI / 2; m.position.y = y; urn.add(m); };
  ring(.81, 1.895, .03); ring(.715, 1.71, .02); ring(.94, 1.06, .016, M.bronzeDark); ring(.84, 1.585, .014, M.bronzeDark);
  // băng hoa văn dưới miệng: hạt tròn nổi
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), M.bronzeHi); b.position.set(Math.sin(a) * .79, 1.64, Math.cos(a) * .79); urn.add(b); }
  // tro hương
  const ash = new THREE.Mesh(new THREE.CircleGeometry(.7, 48), M.ash); ash.rotation.x = -Math.PI / 2; ash.position.y = 1.83; urn.add(ash);

  // hoa sen nổi
  const bodyR = y => { for (let i = 1; i < 11; i++) if (prof[i].y >= y) { const a = prof[i - 1], b = prof[i]; return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y); } return 1; };
  function lotus(angle, y, s) {
    const g = new THREE.Group(), r = bodyR(y);
    g.position.set(Math.sin(angle) * r, y, Math.cos(angle) * r);
    g.lookAt(Math.sin(angle) * 3, y + (1.18 - y) * .3, Math.cos(angle) * 3);
    const petal = (rot, h, w, z, mat = M.bronzeHi) => {               // cánh sen nhọn đầu, nổi gờ
      const sh = new THREE.Shape(); sh.moveTo(0, 0);
      sh.quadraticCurveTo(w * 1.5, h * .45, 0, h * 1.6); sh.quadraticCurveTo(-w * 1.5, h * .45, 0, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: .012, bevelEnabled: true, bevelThickness: .02, bevelSize: .014, bevelSegments: 3, curveSegments: 14 });
      const p = new THREE.Mesh(geo, mat); p.scale.setScalar(s); p.position.set(0, -.1 * s, z); p.rotation.z = -rot; g.add(p);
    };
    petal(0, .17, .065, .03);
    [.42, -.42].forEach(r => petal(r, .15, .06, .02));
    [.85, -.85].forEach(r => petal(r, .13, .055, .012));
    [1.3, -1.3].forEach(r => petal(r, .11, .05, .006, M.bronze));
    // lá dưới
    [1.75, -1.75].forEach(r => petal(r, .16, .045, -.002, M.bronze));
    const base = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), M.bronzeHi); base.scale.set(.09 * s, .04 * s, .03 * s); base.position.set(0, -.1 * s, .02); g.add(base);
    urn.add(g);
  }
  [0, .95, -.95, 1.95, -1.95, Math.PI].forEach((a, i) => lotus(a, 1.3, i ? 1.15 : 1.35));

  // quai cuộn hai bên
  function handle(side) {
    const pts = [V3(.93, 1.42, 0), V3(1.04, 1.47, 0), V3(1.08, 1.6, 0), V3(1.04, 1.78, 0), V3(.98, 1.95, 0), V3(1.02, 2.09, 0), V3(1.13, 2.17, 0),
      V3(1.23, 2.12, 0), V3(1.25, 2.02, 0), V3(1.18, 1.96, 0), V3(1.12, 2.0, 0)];
    const low = [V3(1.0, 1.36, 0), V3(1.1, 1.3, 0), V3(1.19, 1.33, 0), V3(1.2, 1.42, 0), V3(1.13, 1.46, 0)];
    const g = new THREE.Group();
    const tube = (p, r) => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 80, r, 12), M.bronze));
    tube(pts, .055); tube(low, .045);
    // gờ sống quai
    tube(pts.map(p => V3(p.x + .01, p.y, .04)), .02); tube(pts.map(p => V3(p.x + .01, p.y, -.04)), .02);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 10), M.bronzeHi); knob.position.copy(pts[pts.length - 1]); g.add(knob);
    // chân quai bám vào miệng lư
    const brace = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(.8, 1.86, 0), V3(.92, 1.88, 0), V3(1.0, 1.93, 0)]), 20, .04, 10), M.bronze); g.add(brace);
    g.scale.x = side; urn.add(g);
  }
  handle(1); handle(-1);

  // ba chân đầu lân
  function leg(angle) {
    const g = new THREE.Group(); g.rotation.y = angle;
    const lp = [V(0, 0), V(.25, 0), V(.26, .05), V(.21, .13), V(.16, .22), V(.15, .34), V(.17, .48), V(.21, .6), V(.22, .72), V(.18, .86), V(0, .92)];
    const legM = new THREE.Mesh(new THREE.LatheGeometry(lp, 32), M.bronze); legM.position.set(0, 0, .74); legM.rotation.x = -.08; g.add(legM);
    // móng chân
    for (const dx of [-.13, 0, .13]) { const toe = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 10), M.bronzeHi); toe.scale.set(1, .75, 1.25); toe.position.set(dx, .06, .74 + .2 - Math.abs(dx) * .35); g.add(toe); }
    // đầu lân: bờm tròn, mặt, mắt, mũi
    const head = new THREE.Group(); head.position.set(0, .7, .93); head.scale.setScalar(1.25);
    const mane = new THREE.Mesh(new THREE.TorusGeometry(.17, .05, 10, 24), M.bronzeDark); head.add(mane);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const k = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), M.bronze); k.scale.z = .6; k.position.set(Math.cos(a) * .21, Math.sin(a) * .21, -.02); head.add(k); }
    const face = new THREE.Mesh(new THREE.SphereGeometry(.16, 18, 14), M.bronze); face.scale.set(1, 1.05, .7); face.position.z = .03; head.add(face);
    for (const dx of [-.06, .06]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.032, 10, 8), M.bronzeHi); e.position.set(dx, .05, .13); head.add(e); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), M.bronzeHi); nose.scale.set(1.3, .8, 1); nose.position.set(0, -.02, .15); head.add(nose);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.05, .014, 6, 16, Math.PI), M.bronzeDark); mouth.position.set(0, -.07, .13); mouth.rotation.z = Math.PI; head.add(mouth);
    g.add(head); urn.add(g);
  }
  [0, Math.PI * 2 / 3, -Math.PI * 2 / 3].forEach(leg);
  return urn;
}

/* ---------- Hương & khói ---------- */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,240,190,1)'); r.addColorStop(.3, 'rgba(255,130,40,.85)'); r.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(.6, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
class Incense {
  constructor(parent, M) {
    this.parent = parent; this.M = M; this.sticks = []; this.puffs = [];
    this.glowMat = new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.smokeMat = smokeTexture();
    this.geo = new THREE.CylinderGeometry(.008, .008, 1, 6); this.geo.translate(0, .5, 0);
    this.baseGeo = new THREE.CylinderGeometry(.011, .011, 1, 6); this.baseGeo.translate(0, .5, 0);
  }
  add(n = 3, spread = .3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread, len = .62 + Math.random() * .35;
      const g = new THREE.Group(); g.position.set(Math.sin(a) * r, 1.83, Math.cos(a) * r);
      g.rotation.set((Math.random() - .5) * .14, 0, (Math.random() - .5) * .14);
      const s = new THREE.Mesh(this.geo, this.M.stick); s.scale.y = len; g.add(s);
      const b = new THREE.Mesh(this.baseGeo, this.M.stickBase); b.scale.y = .1; g.add(b);
      const tip = new THREE.Sprite(this.glowMat); tip.scale.setScalar(.06); tip.position.y = len; g.add(tip);
      this.parent.add(g); this.sticks.push({ g, s, tip, len, born: performance.now() / 1000, life: 240 + Math.random() * 120 });
    }
    while (this.sticks.length > 40) { const o = this.sticks.shift(); this.parent.remove(o.g); }
  }
  update(t, dt) {
    for (const o of this.sticks) {                                 // hương cháy ngắn dần
      const k = Math.min(1, (t - o.born) / o.life), L = o.len * (1 - .7 * k);
      o.s.scale.y = L; o.tip.position.y = L; o.tip.scale.setScalar(.05 + .015 * Math.sin(t * 7 + o.len * 40));
    }
    if (this.sticks.length && Math.random() < dt * Math.min(14, 3 + this.sticks.length * .6)) {
      const o = this.sticks[(Math.random() * this.sticks.length) | 0], p = new THREE.Vector3(); o.tip.getWorldPosition(p);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeMat, transparent: true, depthWrite: false, opacity: 0 }));
      sp.position.copy(p); sp.scale.setScalar(.08); this.parent.add(sp);
      this.puffs.push({ sp, t0: t, vx: (Math.random() - .5) * .05, ph: Math.random() * 6 });
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i], age = t - f.t0, life = 5.5;
      if (age > life) { this.parent.remove(f.sp); f.sp.material.dispose(); this.puffs.splice(i, 1); continue; }
      f.sp.position.y += dt * (.22 + age * .02);
      const wind = this.wind && window.GIO ? GIO(t) * .17 * Math.min(1, age / 1.2) : 0;   // gió thổi khói nghiêng dần
      f.sp.position.x += dt * (f.vx + wind + Math.sin(t * .9 + f.ph) * .04);
      f.sp.scale.setScalar(.08 + age * .09);
      f.sp.material.opacity = Math.min(1, age * 2) * (1 - age / life) * .5;
    }
  }
}

/* ---------- Dựng cảnh ---------- */
function makeStage(renderer, withGround) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const M = makeMaterials(), urn = buildUrn(M); scene.add(urn);
  const sun = new THREE.DirectionalLight(0xffdcaa, 3.4); sun.position.set(4, 5, 3); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffb070, 1.2); rim.position.set(-3, 3, -4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0xc0603a, 1.1));
  if (withGround) {
    const tex = new THREE.TextureLoader().load('assets/ngoai/gach.jpg', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: .9, color: 0xffffff }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
    urn.traverse(o => o.isMesh && (o.castShadow = true));
    scene.background = new THREE.Color(0x1d0e06); scene.fog = new THREE.Fog(0x1d0e06, 6, 12);
  }
  const incense = new Incense(urn, M); incense.add(22, .34); incense.wind = !withGround;
  return { scene, urn, incense };
}

/* ---------- 1. Lư hương trong cảnh sân ---------- */
/* ---------- Chuông đồng (miệng chuông bán kính 1, đáy miệng y = 0) ---------- */
function bellTexture() {                                    // hoa văn chìm trên thân chuông
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#b8b8b8'; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {                              // 4 ô chữ nhật dọc, mỗi ô một bông sen
    const x = i * 128 + 14; g.strokeRect(x, 40, 100, 150);
    const cx = x + 50, cy = 115; g.beginPath();
    for (let k = -2; k <= 2; k++) { g.moveTo(cx, cy + 22); g.quadraticCurveTo(cx + k * 14 + 12, cy - 5, cx + k * 9, cy - 28 + Math.abs(k) * 7); g.quadraticCurveTo(cx + k * 14 - 12, cy - 5, cx, cy + 22); }
    g.stroke(); g.beginPath(); g.moveTo(cx - 30, cy + 26); g.quadraticCurveTo(cx, cy + 40, cx + 30, cy + 26); g.stroke();
  }
  for (let y of [18, 214, 236]) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  const tx = new THREE.CanvasTexture(c); tx.wrapS = THREE.RepeatWrapping; return tx;
}
function makeBellStage(renderer) {
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  const M = makeMaterials();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a7a3c, metalness: .88, roughness: .46, bumpMap: bellTexture(), bumpScale: 5 });
  const swing = new THREE.Group(); swing.position.y = 2.95; scene.add(swing);    // điểm treo
  const bell = new THREE.Group(); bell.position.y = -2.95; swing.add(bell);
  const prof = [V(0, .12), V(.9, .1), V(1.0, .02), V(1.02, 0), V(.98, .06), V(.9, .2), V(.86, .6), V(.84, 1.2), V(.8, 1.62), V(.7, 1.9), V(.45, 2.06), V(0, 2.1)];
  bell.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), bronze));
  const ring = (r, y, tb) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tb, 10, 96), M.bronzeHi); m.rotation.x = Math.PI / 2; m.position.y = y; bell.add(m); };
  ring(.985, .1, .035); ring(.885, .32, .025); ring(.862, .6, .02); ring(.83, 1.42, .02); ring(.76, 1.78, .025);
  // núm gõ (hình hoa sen tròn) ở phía trước và hai bên
  for (const a of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(.17, .19, .06, 32), M.bronzeHi);
    boss.rotation.x = Math.PI / 2; boss.position.set(Math.sin(a) * .89, .45, Math.cos(a) * .89); boss.lookAt(Math.sin(a) * 3, .45, Math.cos(a) * 3); boss.rotateX(Math.PI / 2); bell.add(boss);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), M.bronze); dot.position.set(Math.sin(a) * .95, .45, Math.cos(a) * .95); bell.add(dot);
  }
  // quai treo bồ lao
  const loop = new THREE.Mesh(new THREE.TorusGeometry(.26, .08, 14, 32), M.bronze); loop.position.y = 2.38; bell.add(loop);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(s * .5, 2.02, 0), V3(s * .55, 2.25, 0), V3(s * .38, 2.45, 0), V3(s * .2, 2.42, 0)]), 30, .07, 10), M.bronze); bell.add(arm);
    const curl = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), M.bronzeHi); curl.position.set(s * .2, 2.42, 0); bell.add(curl);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .5, 10), M.bronzeDark); rod.position.y = 2.75; bell.add(rod);
  // chày gỗ treo bằng hai dây
  const logMat = new THREE.MeshStandardMaterial({ color: 0x9b3a1c, roughness: .55, metalness: .05 });
  const logPivot = new THREE.Group(); logPivot.position.set(1.5, 2.78, 0); scene.add(logPivot);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 1.42, 24), logMat); log.rotation.z = Math.PI / 2; log.position.set(.04, -1.98, 0); logPivot.add(log);
  for (const x of [-.55, .5]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(.235, .235, .08, 24), M.bronzeHi); band.rotation.z = Math.PI / 2; band.position.set(x + .04, -1.98, 0); logPivot.add(band); }
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb08850, roughness: .9 });
  for (const x of [-.42, .42]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.85, 6), ropeMat); r.position.set(x, -.95, 0); logPivot.add(r); }
  const sun = new THREE.DirectionalLight(0xffdcaa, 3); sun.position.set(4, 4, 4); scene.add(sun);
  const back = new THREE.DirectionalLight(0xffb070, 1.4); back.position.set(-3, 2, -3); scene.add(back);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a4a2a, 1.0));
  let hitT = -99;
  return { scene, kind: 'bell', hit(t) { hitT = t; },
    update(t) {
      const a = t - hitT;
      // chày lùi ra rồi phóng vào; chuông lắc tắt dần
      logPivot.rotation.z = a < .45 ? -.45 * Math.sin(a / .45 * Math.PI / 2) : a < .62 ? -.45 * (1 - (a - .45) / .17) : .04 * Math.exp(-(a - .62) * 3) * Math.sin((a - .62) * 9);
      swing.rotation.z = a > .62 ? .05 * Math.exp(-(a - .62) / 2.2) * Math.sin((a - .62) * 4.2) : 0;
      swing.rotation.x = a > .62 ? .015 * Math.exp(-(a - .62) / 2) * Math.sin((a - .62) * 3.1) : 0;
    },
    pts: [V3(-1.02, 0, 0), V3(1.02, 0, 0), V3(0, 0, 1.02), V3(0, 2.9, 0)], wRef: [V3(-1.02, 0, 0), V3(1.02, 0, 0)], target: V3(.5, 1.3, 0), lift: 1.3 };
}

/* ---------- Trống da ---------- */
function drumHeadTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const r = g.createRadialGradient(256, 256, 20, 256, 256, 256); r.addColorStop(0, '#f4e3bd'); r.addColorStop(.8, '#e6cd98'); r.addColorStop(1, '#b98a4a');
  g.fillStyle = r; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#94601e'; g.lineWidth = 6;
  for (const rr of [235, 200, 120]) { g.beginPath(); g.arc(256, 256, rr, 0, 7); g.stroke(); }
  for (let i = 0; i < 12; i++) {                                    // hoa sen giữa mặt trống
    g.save(); g.translate(256, 256); g.rotate(i / 12 * Math.PI * 2);
    g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(26, -70, 0, -112); g.quadraticCurveTo(-26, -70, 0, -30); g.stroke();
    g.beginPath(); g.moveTo(0, -125); g.quadraticCurveTo(14, -160, 0, -192); g.quadraticCurveTo(-14, -160, 0, -125); g.stroke(); g.restore();
  }
  g.beginPath(); g.arc(256, 256, 26, 0, 7); g.stroke();
  return new THREE.CanvasTexture(c);
}
function makeDrumStage(renderer) {
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  const M = makeMaterials();
  const drum = new THREE.Group(); drum.rotation.y = .5; scene.add(drum);
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x8e1d18, roughness: .32, metalness: .15 });
  // thân trống phình giữa, trục quay theo z
  const prof = []; for (let i = 0; i <= 20; i++) { const z = -.5 + i / 20; prof.push(V(1 + .16 * Math.cos(z * Math.PI), z)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), lacquer); body.rotation.x = Math.PI / 2; drum.add(body);
  const headMat = new THREE.MeshStandardMaterial({ map: drumHeadTexture(), color: 0xcdb487, roughness: .85 });
  const heads = [];
  for (const s of [1, -1]) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), headMat); h.position.z = s * .5; if (s < 0) h.rotation.y = Math.PI; drum.add(h); heads.push(h);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, .045, 10, 64), M.bronzeHi); rim.position.z = s * .5; drum.add(rim);
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; const st = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), M.bronzeHi); st.position.set(Math.cos(a) * 1.04, Math.sin(a) * 1.04, s * .44); drum.add(st); }
  }
  for (const z of [-.18, .18]) { const b = new THREE.Mesh(new THREE.TorusGeometry(1.15, .03, 8, 64), M.bronzeHi); b.position.z = z; drum.add(b); }
  for (let i = 0; i < 4; i++) {                                      // khoen đồng hai bên
    const a = i / 4 * Math.PI * 2 + Math.PI / 4; const k = new THREE.Mesh(new THREE.TorusGeometry(.09, .025, 8, 16), M.bronzeHi);
    k.position.set(Math.cos(a) * 1.16, Math.sin(a) * 1.16, 0); k.rotation.y = Math.PI / 2; drum.add(k);
  }
  const sun = new THREE.DirectionalLight(0xffdcaa, 2.6); sun.position.set(3, 4, 5); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xfff0dd, 0x6a2a1a, 1.1));
  let hitT = -99;
  return { scene, kind: 'drum', hit(t) { hitT = t; },
    update(t) {
      const a = t - hitT, k = a >= 0 && a < 1.2 ? Math.exp(-a * 4) * Math.sin(a * 60) : 0;
      heads[0].position.z = .5 + .03 * k; drum.position.x = .01 * k; drum.scale.setScalar(1 + .012 * Math.abs(k));
    },
    pts: (() => { const a = []; for (let i = 0; i < 24; i++) { const q = i / 24 * Math.PI * 2; for (const z of [-.5, .5, 0]) a.push(V3(Math.cos(q) * (z ? 1.05 : 1.16), Math.sin(q) * (z ? 1.05 : 1.16), z)); } return a.map(v => v.applyEuler(new THREE.Euler(0, .5, 0))); })(),
    target: V3(0, 0, 0), lift: 0 };
}

/* ---------- 1. Vẽ đồ vật 3D vào cảnh ---------- */
const S = 640;
const canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
let renderer, stage, cam, fitCache = {}, lastT = 0, lastRender = -1, lastSpot = null, failed = false;
const stages = {};
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(S, S, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  renderer.setClearColor(0x000000, 0);
  stage = makeStage(renderer, false);
  stage.kind = 'urn'; stage.update = (t, dt) => stage.incense.update(t, dt);
  stage.pts = [V3(-1.3, 2.05, 0), V3(1.3, 2.05, 0), ...[0, 2.09, -2.09].map(a => V3(Math.sin(a) * .9, 0, Math.cos(a) * .9))];
  stage.wRef = [V3(-1.3, 2.05, 0), V3(1.3, 2.05, 0)]; stage.target = V3(0, 1.75, 0); stage.lift = 1.45;
  stages.urn = stage;
  cam = new THREE.PerspectiveCamera(20, 1, .1, 50);
} catch (e) { failed = true; console.warn('Không tạo được WebGL cho đồ vật 3D', e); }
const getStage = k => stages[k] || (stages[k] = k === 'bell' ? makeBellStage(renderer) : makeDrumStage(renderer));

// đặt máy quay theo góc nhìn của từng ảnh
function setCam(st, elev) {
  const d = 10, a = elev * Math.PI / 180, T = st.target;
  cam.position.set(T.x, T.y + Math.sin(a) * d, T.z + Math.cos(a) * d); cam.lookAt(T); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
}
// vật chiếm bao nhiêu điểm ảnh trong khung render: bề ngang (wRef hoặc toàn bộ) và đáy
function fit(st, elev) {
  const key = st.kind + elev; if (fitCache[key]) return fitCache[key];
  setCam(st, elev);
  const px = v => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * S, (1 - p.y) / 2 * S]; };
  const P = st.pts.map(px), Wp = (st.wRef || st.pts).map(px);
  const x0 = Math.min(...Wp.map(p => p[0])), x1 = Math.max(...Wp.map(p => p[0])), bottom = Math.max(...P.map(p => p[1]));
  return (fitCache[key] = { w: x1 - x0, cx: (x0 + x1) / 2, bottom });
}
// spot = { kind, bb: [x0, y0, x1, y1], elev } — bb: bề ngang và đáy của vật trên ảnh
function draw(ctx, spot, t) {
  if (failed || !renderer) return false;
  const st = getStage(spot.kind || 'urn');
  lastT = t;
  if (t - lastRender > 1 / 30 || spot !== lastSpot) {                // tối đa 30 khung/giây cho nhẹ máy
    st.update(t, t - lastRender > .2 ? .05 : t - lastRender);
    setCam(st, spot.elev);
    renderer.render(st.scene, cam); lastRender = t; lastSpot = spot;
  }
  const f = fit(st, spot.elev), k = (spot.bb[2] - spot.bb[0]) / f.w;
  const dx = (spot.bb[0] + spot.bb[2]) / 2 - f.cx * k, dy = spot.bb[3] - f.bottom * k;
  if (st.kind === 'urn') {                                            // bóng đổ dưới lư
    const w = spot.bb[2] - spot.bb[0], cx = (spot.bb[0] + spot.bb[2]) / 2, by = spot.bb[3];
    const sh = ctx.createRadialGradient(cx, by, 0, cx, by, w * .5);
    sh.addColorStop(0, 'rgba(40,14,6,.45)'); sh.addColorStop(1, 'rgba(40,14,6,0)');
    ctx.save(); ctx.translate(cx, by - w * .02); ctx.scale(1, .16); ctx.translate(-cx, -by);
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, by, w * .5, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.drawImage(canvas, dx, dy, S * k, S * k);
  return true;
}
addEventListener('chua-act', e => { const k = { chuong: 'bell', trong: 'drum' }[e.detail]; if (k && !failed) getStage(k).hit(performance.now() / 1000); });

/* ---------- 2. Xem cận cảnh, kéo để xoay ---------- */
let viewer = null;
function open() {
  if (failed) return;
  if (viewer) { viewer.el.hidden = false; viewer.run(); return; }
  const el = document.createElement('div'); el.id = 'urn-view';
  el.innerHTML = `<div class="uv-box"><div class="uv-head"><b>Lư hương đồng · Sân chùa</b><button class="uv-x" aria-label="Đóng">✕</button></div>
    <canvas></canvas><div class="uv-bar"><span>Kéo để xoay · cuộn để phóng to</span><button class="uv-huong">Thắp 3 nén hương</button></div></div>`;
  document.getElementById('stage').appendChild(el);
  const cv = el.querySelector('canvas'); cv.width = 1000; cv.height = 640;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(1); r.setSize(1000, 640, false); r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const st = makeStage(r, true), c = new THREE.PerspectiveCamera(32, 1000 / 640, .1, 60);
  let yaw = .3, pitch = .22, dist = 6.2, drag = null, raf = 0, last = performance.now();
  const place = () => { c.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, 1.3 + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist); c.lookAt(0, 1.25, 0); };
  cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; yaw = drag[2] - (e.clientX - drag[0]) * .008; pitch = Math.max(-.05, Math.min(1.2, drag[3] + (e.clientY - drag[1]) * .006)); });
  cv.addEventListener('pointerup', () => drag = null);
  cv.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(3.2, Math.min(10, dist * (1 + e.deltaY * .001))); }, { passive: false });
  const close = () => { el.hidden = true; cancelAnimationFrame(raf); };
  el.querySelector('.uv-x').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.querySelector('.uv-huong').addEventListener('click', () => { st.incense.add(3, .25); stage.incense.add(3, .25); dispatchEvent(new CustomEvent('urn-huong')); });
  const run = () => {
    cancelAnimationFrame(raf);
    const loop = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!drag) yaw += dt * .15;
      st.incense.update(now / 1000, dt); place(); r.render(st.scene, c);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  };
  viewer = { el, run }; run();
}

window.Urn3D = { draw, open, plant: (n = 3) => stage && stage.incense.add(n, .25), ok: () => !failed, hit: k => !failed && getStage(k).hit(performance.now() / 1000) };
dispatchEvent(new CustomEvent('urn3d-ready'));
export { makeMaterials, buildUrn, Incense };
