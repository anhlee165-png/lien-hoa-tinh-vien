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
      f.sp.position.x += dt * (f.vx + Math.sin(t * .9 + f.ph) * .04);
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
  const incense = new Incense(urn, M); incense.add(22, .34);
  return { scene, urn, incense };
}

/* ---------- 1. Lư hương trong cảnh sân ---------- */
const S = 640;
const canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
let renderer, stage, cam, fitCache = {}, lastT = 0, lastRender = -1, lastSpot = null, failed = false;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(S, S, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  renderer.setClearColor(0x000000, 0);
  stage = makeStage(renderer, false);
  cam = new THREE.PerspectiveCamera(20, 1, .1, 50);
} catch (e) { failed = true; console.warn('Không tạo được WebGL cho lư hương 3D', e); }

// đặt máy quay theo góc nhìn của từng ảnh; tính lư hương chiếm bao nhiêu điểm ảnh trong khung
function setCam(elev) {
  const d = 10, a = elev * Math.PI / 180;
  cam.position.set(0, 1.45 + Math.sin(a) * d, Math.cos(a) * d); cam.lookAt(0, 1.75, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
}
function fit(elev) {
  if (fitCache[elev]) return fitCache[elev];
  setCam(elev);
  const px = v => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * S, (1 - p.y) / 2 * S]; };
  const L = px(V3(-1.3, 2.05, 0)), Rt = px(V3(1.3, 2.05, 0));
  let bottom = 0; for (const a of [0, 2.09, -2.09]) bottom = Math.max(bottom, px(V3(Math.sin(a) * .9, 0, Math.cos(a) * .9))[1]);
  return (fitCache[elev] = { w: Rt[0] - L[0], cx: (L[0] + Rt[0]) / 2, bottom });
}
// vẽ lư hương vào canvas 2D của cảnh: bb = [x0, y0, x1, y1] khung lư (quai tới quai, đáy chân)
function draw(ctx, spot, t) {
  if (failed || !renderer) return false;
  const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t;
  if (t - lastRender > 1 / 30 || spot !== lastSpot) {                // tối đa 30 khung/giây cho nhẹ máy
    stage.incense.update(t, t - lastRender > .2 ? .05 : t - lastRender);
    setCam(spot.elev); stage.urn.rotation.y = spot.rot || 0;
    renderer.render(stage.scene, cam); lastRender = t; lastSpot = spot;
  }
  const f = fit(spot.elev), k = (spot.bb[2] - spot.bb[0]) / f.w;
  const dx = (spot.bb[0] + spot.bb[2]) / 2 - f.cx * k, dy = spot.bb[3] - f.bottom * k;
  const w = spot.bb[2] - spot.bb[0], cx = (spot.bb[0] + spot.bb[2]) / 2, by = spot.bb[3];
  const sh = ctx.createRadialGradient(cx, by, 0, cx, by, w * .5);
  sh.addColorStop(0, 'rgba(40,14,6,.45)'); sh.addColorStop(1, 'rgba(40,14,6,0)');
  ctx.save(); ctx.translate(cx, by - w * .02); ctx.scale(1, .16); ctx.translate(-cx, -by);
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, by, w * .5, 0, 7); ctx.fill(); ctx.restore();
  ctx.drawImage(canvas, dx, dy, S * k, S * k);
  return true;
}

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

window.Urn3D = { draw, open, plant: (n = 3) => stage && stage.incense.add(n, .25), ok: () => !failed };
dispatchEvent(new CustomEvent('urn3d-ready'));
