/* Liên Hoa Tịnh Viện – thế giới 3D của chánh điện */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const HALL = { x: 9, zFront: -14, zBack: 14, h: 7.2 };
const SEAT_Y = 0.14;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

const NAMES = ['Minh Tâm', 'Quang Huy', 'Liên Hoa', 'An Nhiên', 'Từ Hạnh', 'Nhật Minh', 'Diệu Âm', 'Thanh Tịnh', 'Bảo Ngọc', 'Phúc An',
  'Hạnh Đức', 'Tuệ Minh', 'Như Ý', 'Thiện Tâm', 'Huệ Chi', 'Minh Đức', 'Gia Bảo', 'Khánh Linh', 'Đức Trí', 'Ngọc Lan', 'Tâm An',
  'Quảng Đức', 'Diệu Hiền', 'Bích Ngọc', 'Vĩnh An', 'Thảo Nguyên', 'Minh Khang', 'Hoàng Anh', 'Thu Hà', 'Kim Liên', 'Phương Thảo',
  'Hải Đăng', 'Trí Dũng', 'Mai Anh', 'Thiện Mỹ', 'Diệu Liên', 'Nguyên Khang', 'Bảo Châu', 'Tịnh Tâm', 'Hồng Ân', 'Quang Minh',
  'Ngọc Hân', 'Đăng Khoa', 'Thanh Hà', 'Phước Lộc', 'Hữu Tâm', 'Như Nguyện', 'Minh Châu', 'Tuệ Lâm', 'Huyền Trang', 'Thiện Duyên',
  'Trúc Lâm', 'Diệu Thiện', 'An Lạc', 'Vạn Hạnh', 'Pháp Hỷ'];

/* ---------------- texture helpers ---------------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const loader = new THREE.TextureLoader();
function imgTex(url) { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

const floorTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d9c6a6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${150 + Math.random() * 60},${120 + Math.random() * 50},${90 + Math.random() * 40},.07)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 14, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(120,90,60,.35)'; g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); }
}, [9, 14]);
const carpetTex = () => canvasTex(256, 1024, (g, w, h) => {
  g.fillStyle = '#b3141b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d9a640'; g.fillRect(10, 0, 10, h); g.fillRect(w - 20, 0, 10, h);
  g.fillStyle = '#7d0a0f'; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
  g.strokeStyle = 'rgba(233,180,80,.55)'; g.lineWidth = 3;
  for (let y = 40; y < h; y += 80) {
    g.beginPath(); g.moveTo(w / 2, y - 28); g.lineTo(w / 2 + 50, y); g.lineTo(w / 2, y + 28); g.lineTo(w / 2 - 50, y); g.closePath(); g.stroke();
    g.beginPath(); g.arc(w / 2, y, 9, 0, 7); g.stroke();
    g.beginPath(); g.arc(46, y + 40, 6, 0, 7); g.arc(w - 46, y + 40, 6, 0, 7); g.stroke();
  }
}, [1, 6]);
const wallTex = () => canvasTex(256, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d9b58a'); gr.addColorStop(.5, '#f0d9b5'); gr.addColorStop(1, '#e8cba4');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(160,110,60,${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
}, [6, 1]);
const woodTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5a1a10'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(${30 + Math.random() * 40},8,4,${Math.random() * .35})`; g.fillRect(0, y, w, 2); }
  g.strokeStyle = 'rgba(214,160,70,.65)'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
  g.strokeStyle = 'rgba(214,160,70,.35)'; g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
}, [10, 1]);
const ceilTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a120b'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b8862e'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  g.strokeStyle = 'rgba(214,160,70,.5)'; g.lineWidth = 2; g.strokeRect(24, 24, w - 48, h - 48);
  g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.stroke();
}, [6, 9]);
const labelTex = (text) => canvasTex(512, 200, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fbeccb'); gr.addColorStop(1, '#e9d2a2');
  g.fillStyle = '#b8862e'; g.fillRect(0, 0, w, h); g.fillStyle = gr; g.fillRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#4a2a10'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 54px "Roboto Condensed", Arial Narrow, sans-serif';
  const words = text.split(' '); let lines = [text];
  if (g.measureText(text).width > w - 40) { const m = Math.ceil(words.length / 2); lines = [words.slice(0, m).join(' '), words.slice(m).join(' ')]; }
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 62));
});
function nameTex(text, me) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = '600 34px "Roboto Condensed", Arial Narrow, sans-serif';
  const tw = Math.min(236, g.measureText(text).width + 34);
  g.fillStyle = me ? 'rgba(40,120,40,.92)' : 'rgba(30,20,20,.68)';
  g.strokeStyle = me ? '#b8ff8a' : 'rgba(255,255,255,.2)'; g.lineWidth = 3;
  const x = (256 - tw) / 2; g.beginPath(); g.roundRect(x, 8, tw, 48, 24); g.fill(); g.stroke();
  g.fillStyle = me ? '#f4ffd8' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const softTex = canvasTex(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

/* ---------------- materials ---------------- */
const M = {
  gold: new THREE.MeshStandardMaterial({ color: 0xe0a842, metalness: .9, roughness: .28, emissive: 0x2a1600 }),
  buddhaGold: new THREE.MeshStandardMaterial({ color: 0xf0b850, metalness: .75, roughness: .32, emissive: 0x4a2a05 }),
  buddhaHair: new THREE.MeshStandardMaterial({ color: 0x24304a, roughness: .5 }),
  red: new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: .45, metalness: .1 }),
  darkwood: new THREE.MeshStandardMaterial({ color: 0x4a1409, roughness: .6 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xf7d6bf, roughness: .65 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: .55 }),
  eye: new THREE.MeshBasicMaterial({ color: 0x1a1210 }),
  blush: new THREE.MeshBasicMaterial({ color: 0xf2a0a0, transparent: true, opacity: .55 }),
  cushion: new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: .8 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3f8a32, roughness: .7 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xe8eef8, roughness: .3 }),
  potBlue: new THREE.MeshStandardMaterial({ color: 0x2b4f9a, roughness: .3 }),
  lotus: new THREE.MeshStandardMaterial({ color: 0xf58fb4, roughness: .55, emissive: 0x2a0410 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffd27a }),
  lantern: new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff8a20, emissiveIntensity: 1.2, roughness: .4 }),
  redLantern: new THREE.MeshStandardMaterial({ color: 0xe0281e, emissive: 0xc01810, emissiveIntensity: .9, roughness: .4 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xbfb8ab, roughness: .9 }),
  shadow: new THREE.MeshBasicMaterial({ map: softTex, color: 0x000000, transparent: true, opacity: .35, depthWrite: false })
};
const robeMats = ['#8d8ba8', '#9593af', '#8586a2', '#9a98b2', '#908fa6'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .85, envMapIntensity: .25 }));
const monkMat = new THREE.MeshStandardMaterial({ color: 0xd98a2b, roughness: .75 });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

/* ---------------- person (chibi phật tử) ---------------- */
const G = {
  head: new THREE.SphereGeometry(.34, 22, 16),
  hair: new THREE.SphereGeometry(.36, 22, 14, 0, Math.PI * 2, 0, Math.PI * .62),
  bun: new THREE.SphereGeometry(.12, 14, 10),
  eye: new THREE.SphereGeometry(.045, 8, 6),
  blush: new THREE.CircleGeometry(.05, 12),
  torso: new THREE.CylinderGeometry(.2, .36, .62, 18),
  lap: new THREE.SphereGeometry(.42, 16, 10),
  leg: new THREE.CylinderGeometry(.11, .13, .5, 10),
  arm: new THREE.CapsuleGeometry(.085, .3, 4, 8),
  hand: new THREE.SphereGeometry(.08, 10, 8),
  shadow: new THREE.CircleGeometry(.55, 20)
};
class Person {
  constructor(name, opts = {}) {
    this.name = name; this.me = !!opts.me; this.monk = !!opts.monk;
    const robe = this.monk ? monkMat : pick(robeMats);
    const root = this.root = new THREE.Group();
    const sh = mesh(G.shadow, M.shadow, 0, .015, 0); sh.rotation.x = -Math.PI / 2; root.add(sh);
    const pivot = this.pivot = new THREE.Group(); root.add(pivot);         // nghiêng người khi cúi
    const upper = this.upper = new THREE.Group(); pivot.add(upper);
    this.lap = mesh(G.lap, robe, 0, .16, .04); this.lap.scale.set(1, .38, .78); pivot.add(this.lap);
    this.legL = mesh(G.leg, robe, -.12, .25, 0); this.legR = mesh(G.leg, robe, .12, .25, 0); root.add(this.legL, this.legR);
    upper.add(mesh(G.torso, robe, 0, .31, 0));
    const head = this.head = new THREE.Group(); head.position.y = .9; upper.add(head);
    head.add(mesh(G.head, M.skin));
    if (!this.monk) {
      const h = mesh(G.hair, M.hair, 0, .02, -.03); h.rotation.x = -.5; head.add(h);
      if (Math.random() < .55) head.add(mesh(G.bun, M.hair, 0, .3, -.18));
    }
    [-1, 1].forEach(s => {
      head.add(mesh(G.eye, M.eye, s * .12, -.02, .3));
      const b = mesh(G.blush, M.blush, s * .19, -.1, .29); b.rotation.y = s * .45; head.add(b);
    });
    this.arms = [-1, 1].map(s => { const a = mesh(G.arm, robe, s * .2, .5, .14); a.rotation.set(-1.1, 0, s * .55); upper.add(a); return a; });
    this.hands = mesh(G.hand, M.skin, 0, .62, .3); this.hands.scale.set(1, 1.6, .8); upper.add(this.hands);
    root.scale.setScalar(opts.scale || 1);
    // tên
    const tag = this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex(name, this.me), depthTest: false, transparent: true }));
    tag.scale.set(1.2, .3, 1); tag.position.y = 1.85; tag.renderOrder = 10; root.add(tag);
    tag.visible = this.me;
    this.sit = 1; this.sitT = 1; this.bow = 0; this.bowT = 0; this.walkPhase = 0; this.speed = 0; this.heading = 0;
  }
  update(dt) {
    this.sit = damp(this.sit, this.sitT, 6, dt); this.bow = damp(this.bow, this.bowT, 5, dt);
    const s = this.sit, walk = Math.min(1, this.speed / 1.2);
    this.walkPhase += dt * this.speed * 6;
    const lift = (1 - s) * .27 + SEAT_Y * s;
    this.pivot.position.y = lift;
    this.upper.position.y = 0;
    this.lap.visible = s > .5; this.legL.visible = this.legR.visible = s < .5;
    const sw = Math.sin(this.walkPhase) * .5 * walk;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.pivot.position.y += Math.abs(Math.cos(this.walkPhase)) * .04 * walk;
    // cúi: bow 0..1 (cúi chào), >1 (lạy sát đất)
    const b = this.bow;
    this.pivot.rotation.x = Math.min(b, 1) * .65 + Math.max(0, b - 1) * .55;
    this.pivot.position.z = Math.max(0, b - 1) * .25;
    this.root.rotation.y = this.heading;
  }
}

/* ---------------- world ---------------- */
export function createWorld(canvas, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .55;
  const INDOOR = new THREE.Color(0x2a0805);
  const SKY = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5aa2e6'); gr.addColorStop(.6, '#a9d2f2'); gr.addColorStop(1, '#e8f3fb'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.background = INDOOR;
  scene.fog = new THREE.Fog(0x3a160c, 30, 70);
  const camera = new THREE.PerspectiveCamera(52, 1, .1, 200);

  /* ánh sáng */
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x5a2a18, .85));
  scene.add(new THREE.AmbientLight(0xffd9a8, .35));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.1); sun.position.set(2, 10, -20); scene.add(sun);
  const warm = (x, y, z, i, d = 18) => { const l = new THREE.PointLight(0xffb45a, i, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  const flick = [warm(0, 5.4, -4, 26, 22), warm(0, 4.6, 9, 18), warm(-6, 4.5, 2, 10), warm(6, 4.5, 2, 10), warm(0, 3.5, -11, 10)];

  /* sàn, thảm, trần */
  const floor = mesh(new THREE.PlaneGeometry(HALL.x * 2, HALL.zBack - HALL.zFront), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: .32, metalness: .05 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const carpet = mesh(new THREE.PlaneGeometry(2.3, 23), new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: .9 }), 0, .012, -2.5);
  carpet.rotation.x = -Math.PI / 2; scene.add(carpet);
  const ceil = mesh(new THREE.PlaneGeometry(HALL.x * 2, HALL.zBack - HALL.zFront), new THREE.MeshStandardMaterial({ map: ceilTex(), roughness: .7 }), 0, HALL.h, 0);
  ceil.rotation.x = Math.PI / 2; scene.add(ceil);
  for (let z = -12; z <= 12; z += 4) scene.add(mesh(new THREE.BoxGeometry(HALL.x * 2, .45, .35), M.red, 0, HALL.h - .22, z));
  [-3.2, 3.2].forEach(x => scene.add(mesh(new THREE.BoxGeometry(.4, .5, HALL.zBack - HALL.zFront), M.red, x, HALL.h - .25, 0)));

  /* tường hai bên + tranh Phật */
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: .85 });
  const wainMat = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: .55 });
  const PAINT = {
    left: [['a-di-da', 'Phật A Di Đà', .62], ['quan-am', 'Quán Thế Âm Bồ Tát', .62], ['dia-tang', 'Địa Tạng Bồ Tát', .62], ['van-thu', 'Văn Thù Bồ Tát', .62], ['dan-sinh', 'Đức Phật Đản Sinh', .62]],
    right: [['niet-ban', 'Phật Nhập Niết Bàn', .8], ['thuyet-phap', 'Phật Thuyết Pháp', .7], ['thanh-dao', 'Phật Thành Đạo', .62], ['duoc-su', 'Phật Dược Sư', .62], ['pho-hien', 'Phổ Hiền Bồ Tát', .62]]
  };
  const paintZ = [8.6, 4.3, 0, -4.3, -8.6];
  const frameMat = M.gold;
  const POIS = [];
  [-1, 1].forEach(side => {
    const x = side * HALL.x;
    const wall = mesh(new THREE.PlaneGeometry(HALL.zBack - HALL.zFront, HALL.h), wallMat, x, HALL.h / 2, 0);
    wall.rotation.y = -side * Math.PI / 2; scene.add(wall);
    scene.add(mesh(new THREE.BoxGeometry(.2, 1.15, HALL.zBack - HALL.zFront), wainMat, x - side * .1, .575, 0));
    scene.add(mesh(new THREE.BoxGeometry(.28, .12, HALL.zBack - HALL.zFront), M.gold, x - side * .12, 1.18, 0));
    scene.add(mesh(new THREE.BoxGeometry(.3, .9, HALL.zBack - HALL.zFront), wainMat, x - side * .15, HALL.h - .9, 0));
    (side < 0 ? PAINT.left : PAINT.right).forEach(([file, title, r], i) => {
      const z = paintZ[i], h = 2.7, w = h * r, g = new THREE.Group();
      g.position.set(x - side * .12, 3.45, z); g.rotation.y = -side * Math.PI / 2;
      g.add(mesh(new THREE.BoxGeometry(w + .26, h + .26, .1), frameMat, 0, 0, -.02));
      g.add(mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: imgTex(`assets/tranh/${file}.jpg`), roughness: .55, emissive: 0xffffff, emissiveIntensity: .12, emissiveMap: imgTex(`assets/tranh/${file}.jpg`) }), 0, 0, .04));
      const lb = mesh(new THREE.PlaneGeometry(1.5, .58), new THREE.MeshStandardMaterial({ map: labelTex(title), roughness: .6 }), 0, -1.86, .03); g.add(lb);
      // đèn rọi tranh
      g.add(mesh(new THREE.BoxGeometry(.5, .08, .08), M.gold, 0, h / 2 + .32, .25));
      g.add(mesh(new THREE.CylinderGeometry(.03, .03, .35, 6), M.gold, 0, h / 2 + .2, .12));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffd38a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.4, .6, 1); glow.position.set(0, h / 2 + .2, .35); g.add(glow);
      scene.add(g);
      POIS.push({ x: x - side * 1.5, z, face: side < 0 ? -Math.PI / 2 : Math.PI / 2, title });
      // chậu cây giữa các tranh
      if (i < 4) plant(x - side * .55, z - 2.15);
    });
    // bàn nhỏ + bình hoa gần góc
    plant(x - side * 1.4, 12.6, 1.3);
  });
  function plant(x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    g.add(mesh(new THREE.CylinderGeometry(.22, .16, .4, 14), M.pot, 0, .2, 0));
    g.add(mesh(new THREE.CylinderGeometry(.225, .225, .1, 14), M.potBlue, 0, .28, 0));
    for (let i = 0; i < 6; i++) { const l = mesh(new THREE.SphereGeometry(rand(.16, .24), 10, 8), M.leaf, rand(-.18, .18), rand(.5, .85), rand(-.18, .18)); l.scale.y = .7; g.add(l); }
    scene.add(g);
  }

  /* tường trước: cửa chính + biển */
  const front = new THREE.Group(); front.position.z = HALL.zFront; scene.add(front);
  const fWall = mesh(new THREE.BoxGeometry(HALL.x * 2, HALL.h, .4), M.red, 0, HALL.h / 2, -.2); front.add(fWall);
  const doorW = 11.2, doorH = doorW / (1164 / 484);
  front.add(mesh(new THREE.PlaneGeometry(doorW, doorH), new THREE.MeshBasicMaterial({ map: imgTex('assets/cua-chinh.jpg') }), 0, doorH / 2, .02));
  front.add(mesh(new THREE.BoxGeometry(doorW + .4, .25, .2), M.gold, 0, doorH + .12, .08));
  const signW = 6.2; front.add(mesh(new THREE.PlaneGeometry(signW, signW / (812 / 146)), new THREE.MeshStandardMaterial({ map: imgTex('assets/bien.jpg'), emissive: 0xffffff, emissiveIntensity: .25, emissiveMap: imgTex('assets/bien.jpg') }), 0, doorH + 1.05, .05));
  [-1, 1].forEach(s => {
    const px = s * 6.4;
    front.add(mesh(new THREE.CylinderGeometry(.42, .46, HALL.h, 20), M.red, px, HALL.h / 2, .7));
    front.add(mesh(new THREE.CylinderGeometry(.52, .52, .5, 20), M.gold, px, .25, .7));
    front.add(mesh(new THREE.CylinderGeometry(.5, .5, .2, 20), M.gold, px, 5.1, .7));
  });
  // cột dọc hai bên
  [-1, 1].forEach(s => [-11.4, 10.9].forEach(z => {
    scene.add(mesh(new THREE.CylinderGeometry(.34, .36, HALL.h, 18), M.red, s * 8.5, HALL.h / 2, z));
    scene.add(mesh(new THREE.CylinderGeometry(.42, .42, .4, 18), M.gold, s * 8.5, .2, z));
  }));

  /* tường sau + bàn thờ Phật */
  const back = mesh(new THREE.BoxGeometry(HALL.x * 2, HALL.h, .4), M.red, 0, HALL.h / 2, HALL.zBack + .2); scene.add(back);
  const altar = new THREE.Group(); altar.position.set(0, 0, 12.2); scene.add(altar);
  altar.add(mesh(new THREE.BoxGeometry(7, .5, 2.6), M.darkwood, 0, .25, .4));
  altar.add(mesh(new THREE.BoxGeometry(7.1, .08, 2.7), M.gold, 0, .52, .4));
  altar.add(mesh(new THREE.BoxGeometry(3.4, 1.1, 1.4), M.darkwood, 0, 1.05, .9));
  // phông thờ
  altar.add(mesh(new THREE.BoxGeometry(6.4, 5.6, .2), M.gold, 0, 3.6, 1.55));
  const backdrop2 = mesh(new THREE.PlaneGeometry(6, 5.2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * .38, 10, w / 2, h * .45, w * .7); gr.addColorStop(0, '#ffe6a0'); gr.addColorStop(.35, '#d8822a'); gr.addColorStop(1, '#6a0d0a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,220,140,.35)'; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, h * .38); g.lineTo(w / 2 + Math.cos(a) * w, h * .38 + Math.sin(a) * w); g.stroke(); }
  }), emissive: 0xffffff, emissiveIntensity: .15, roughness: .8 }), 0, 3.6, 1.44);
  backdrop2.rotation.y = Math.PI; altar.add(backdrop2);
  const buddha = new THREE.Group(); buddha.position.set(0, 1.6, .6); buddha.rotation.y = Math.PI; altar.add(buddha);
  const BG = M.buddhaGold;
  buddha.add(mesh(new THREE.CylinderGeometry(1.25, 1.35, .45, 8), M.gold, 0, .22, 0));
  for (let r = 0; r < 2; r++) for (let i = 0; i < 16; i++) {
    const a = (i + r * .5) / 16 * Math.PI * 2, p = mesh(new THREE.SphereGeometry(.34, 12, 10), r ? M.lotus : M.gold, Math.cos(a) * (1.25 - r * .2), .55 + r * .12, Math.sin(a) * (1.05 - r * .2));
    p.scale.set(.55, .5, 1); p.lookAt(0, .5 + r * .12, 0); p.rotateX(-.6); buddha.add(p);
  }
  const legs = mesh(new THREE.SphereGeometry(1, 28, 16), BG, 0, 1.0, .1); legs.scale.set(1.15, .38, .72); buddha.add(legs);
  buddha.add(mesh(new THREE.CylinderGeometry(.5, .66, 1.25, 24), BG, 0, 1.75, 0));
  const shoulders = mesh(new THREE.SphereGeometry(.62, 24, 14), BG, 0, 2.3, 0); shoulders.scale.set(1.12, .52, .72); buddha.add(shoulders);
  buddha.add(mesh(new THREE.CylinderGeometry(.16, .2, .25, 14), BG, 0, 2.55, 0));
  [-1, 1].forEach(s => { const arm = mesh(new THREE.CapsuleGeometry(.17, .75, 6, 10), BG, s * .62, 1.75, .14); arm.rotation.set(-.35, 0, s * .28); buddha.add(arm); });
  const hands = mesh(new THREE.SphereGeometry(.26, 16, 12), BG, 0, 1.28, .42); hands.scale.set(1.3, .45, .9); buddha.add(hands);
  const headB = new THREE.Group(); headB.position.set(0, 3, 0); buddha.add(headB);
  headB.add(mesh(new THREE.SphereGeometry(.44, 28, 20), BG));
  const hairB = mesh(new THREE.SphereGeometry(.455, 28, 20, 0, Math.PI * 2, 0, Math.PI * .5), M.buddhaHair, 0, .05, -.03); hairB.rotation.x = -.35; headB.add(hairB);
  headB.add(mesh(new THREE.SphereGeometry(.2, 16, 12), M.buddhaHair, 0, .48, -.05));
  [-1, 1].forEach(s => {
    const ear = mesh(new THREE.SphereGeometry(.1, 10, 8), BG, s * .43, -.12, 0); ear.scale.set(.5, 2.1, .8); headB.add(ear);
    const eye = mesh(new THREE.BoxGeometry(.12, .018, .02), M.buddhaHair, s * .15, 0, .41); eye.rotation.z = s * -.12; headB.add(eye);
  });
  headB.add(mesh(new THREE.SphereGeometry(.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc0201a }), 0, .14, .43));
  headB.add(mesh(new THREE.BoxGeometry(.1, .02, .02), new THREE.MeshBasicMaterial({ color: 0x8a3a20 }), 0, -.2, .42));
  const aureole = mesh(new THREE.TorusGeometry(.78, .05, 10, 48), M.gold, 0, 3, -.3); buddha.add(aureole);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffcf6a, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(3.6, 3.6, 1); halo.position.set(0, 3, -.4); buddha.add(halo);
  const bodyGlow = new THREE.Sprite(halo.material.clone()); bodyGlow.material.opacity = .3; bodyGlow.scale.set(4.6, 5.4, 1); bodyGlow.position.set(0, 1.9, -.6); buddha.add(bodyGlow);
  const altarLight = new THREE.PointLight(0xffd08a, 8, 9, 1.6); altarLight.position.set(0, 4, 9.5); scene.add(altarLight);
  // bát hương + đèn sen
  const bowl = new THREE.Group(); bowl.position.set(0, 0, 9.4); scene.add(bowl);
  bowl.add(mesh(new THREE.BoxGeometry(3.6, .55, 1.1), M.darkwood, 0, .27, 0));
  bowl.add(mesh(new THREE.CylinderGeometry(.62, .45, .38, 28), M.gold, 0, .74, 0));
  bowl.add(mesh(new THREE.CylinderGeometry(.56, .56, .02, 28), new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 1 }), 0, .93, 0));
  for (let i = 0; i < 7; i++) bowl.add(mesh(new THREE.CylinderGeometry(.012, .012, .7, 4), new THREE.MeshBasicMaterial({ color: 0xc0201a }), (i - 3) * .07, 1.2, rand(-.1, .1)));
  const lamps = [];
  [-2.4, 2.4].forEach(x => {
    const l = new THREE.Group(); l.position.set(x, 0, 8.6); scene.add(l);
    l.add(mesh(new THREE.CylinderGeometry(.08, .22, .9, 12), M.gold, 0, .45, 0));
    for (let i = 0; i < 8; i++) { const p = mesh(new THREE.SphereGeometry(.2, 10, 8), M.lantern, Math.cos(i * .785) * .22, 1.05, Math.sin(i * .785) * .22); p.scale.set(.6, 1.2, .6); p.rotation.z = Math.cos(i * .785) * .5; p.rotation.x = -Math.sin(i * .785) * .5; l.add(p); }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffc860, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    gl.scale.set(1.8, 1.8, 1); gl.position.y = 1.1; l.add(gl); lamps.push(gl);
  });
  // hoa sen góc
  [[-7.6, 11.5], [7.6, 11.5]].forEach(([x, z]) => { for (let i = 0; i < 9; i++) { const f = mesh(new THREE.SphereGeometry(.18, 10, 8), M.lotus, x + rand(-.6, .6), rand(.4, .9), z + rand(-.6, .6)); f.scale.y = 1.3; scene.add(f); } });

  /* đèn chùm + đèn lồng */
  const glows = [];
  function lantern(x, y, z, s = 1, mat = M.lantern) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(.01, .01, HALL.h - y, 4), M.gold, 0, (HALL.h - y) / 2 / s, 0));
    const body = mesh(new THREE.SphereGeometry(.4, 18, 14), mat); body.scale.y = 1.15; g.add(body);
    g.add(mesh(new THREE.CylinderGeometry(.25, .25, .1, 14), M.gold, 0, .47, 0));
    g.add(mesh(new THREE.CylinderGeometry(.25, .25, .1, 14), M.gold, 0, -.47, 0));
    g.add(mesh(new THREE.CylinderGeometry(.03, .06, .4, 6), mat, 0, -.72, 0));
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: mat === M.lantern ? 0xffc060 : 0xff6040, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }));
    gl.scale.set(2.4, 2.4, 1); g.add(gl); glows.push(gl); return g;
  }
  lantern(0, 6.1, -6.5, 1.6); lantern(-2.6, 5, -10.5, .9); lantern(2.6, 5, -10.5, .9);
  lantern(0, 5.8, 4, 1.3); [-6.5, 6.5].forEach(x => [-6, 2, 8].forEach(z => lantern(x, 5.4, z, .7)));

  /* sân chùa phía ngoài cửa */
  const yard = new THREE.Group(); scene.add(yard);
  const yFloor = mesh(new THREE.PlaneGeometry(50, 34), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#cfc6b6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(90,80,70,.4)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); g.beginPath(); g.moveTo(i * w / 4 + (i % 2) * 20, 0); g.lineTo(i * w / 4 + (i % 2) * 20, h); g.stroke(); } }, [10, 7]), roughness: .95 }), 0, 0, HALL.zFront - 17);
  yFloor.rotation.x = -Math.PI / 2; yard.add(yFloor);
  // cổng tam quan
  const gate = new THREE.Group(); gate.position.set(0, 0, HALL.zFront - 27); yard.add(gate);
  const wallW = new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: .85 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x3d4552, roughness: .6 });
  const archM = new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: .9 });
  [[0, 6.2, 5.2, 1], [-5.6, 4, 3.6, .8], [5.6, 4, 3.6, .8]].forEach(([x, w, h, s]) => {
    gate.add(mesh(new THREE.BoxGeometry(w, h, 2), wallW, x, h / 2, 0));
    gate.add(mesh(new THREE.BoxGeometry(w * .1, h, 2.05), M.red, x - w / 2 + w * .05, h / 2, 0));
    gate.add(mesh(new THREE.BoxGeometry(w * .1, h, 2.05), M.red, x + w / 2 - w * .05, h / 2, 0));
    const arch = mesh(new THREE.PlaneGeometry(w * .42, h * .62), archM, x, h * .31, 1.03); gate.add(arch);
    const roof = mesh(new THREE.BoxGeometry(w + 1.2, .45, 3), roofM, x, h + .22, 0); gate.add(roof);
    [-1, 1].forEach(d => { const c = mesh(new THREE.ConeGeometry(.25, .9 * s, 6), roofM, x + d * (w / 2 + .6), h + .55, 1.3); c.rotation.z = -d * .6; gate.add(c); const c2 = c.clone(); c2.position.z = -1.3; gate.add(c2); });
  });
  gate.add(mesh(new THREE.BoxGeometry(4, 2.2, 1.6), wallW, 0, 6.5, 0));
  gate.add(mesh(new THREE.BoxGeometry(5.4, .4, 2.6), roofM, 0, 7.8, 0));
  [-1, 1].forEach(d => { const c = mesh(new THREE.ConeGeometry(.25, .9, 6), roofM, d * 3, 8.1, 1.1); c.rotation.z = -d * .6; gate.add(c); });
  gate.add(mesh(new THREE.PlaneGeometry(2.6, .7), new THREE.MeshStandardMaterial({ map: labelTex('Liên Hoa Tịnh Viện') }), 0, 6.5, .81));
  // hồ sen hai bên
  [-1, 1].forEach(d => {
    const pond = mesh(new THREE.PlaneGeometry(9, 12), new THREE.MeshStandardMaterial({ color: 0x3f7f78, roughness: .2, metalness: .1 }), d * 13, .03, HALL.zFront - 16);
    pond.rotation.x = -Math.PI / 2; yard.add(pond);
    for (let i = 0; i < 14; i++) { const pad = mesh(new THREE.CircleGeometry(rand(.3, .55), 12), M.leaf, d * 13 + rand(-4, 4), .05, HALL.zFront - 16 + rand(-5.5, 5.5)); pad.rotation.x = -Math.PI / 2; yard.add(pad); }
  });
  const urn = new THREE.Group(); urn.position.set(0, 0, HALL.zFront - 9); yard.add(urn);
  urn.add(mesh(new THREE.CylinderGeometry(1.4, 1.6, .4, 24), M.stone, 0, .2, 0));
  const pot = mesh(new THREE.SphereGeometry(1.1, 28, 18), M.gold, 0, 1.4, 0); pot.scale.y = .8; urn.add(pot);
  urn.add(mesh(new THREE.CylinderGeometry(1.15, .95, .35, 28), M.gold, 0, 2.15, 0));
  [-1, 1].forEach(s => { const h = mesh(new THREE.TorusGeometry(.35, .08, 8, 16), M.gold, s * 1.15, 2.1, 0); h.rotation.y = Math.PI / 2; urn.add(h); });
  [[-6, -6], [6, -6], [-6, -14], [6, -14]].forEach(([x, dz]) => {
    const l = new THREE.Group(); l.position.set(x, 0, HALL.zFront + dz); yard.add(l);
    l.add(mesh(new THREE.BoxGeometry(.6, .3, .6), M.stone, 0, .15, 0)); l.add(mesh(new THREE.CylinderGeometry(.14, .18, 1.2, 8), M.stone, 0, .9, 0));
    l.add(mesh(new THREE.BoxGeometry(.6, .5, .6), M.stone, 0, 1.75, 0)); l.add(mesh(new THREE.ConeGeometry(.55, .45, 4), M.stone, 0, 2.2, 0));
  });
  [[-10, -8], [10, -10], [-12, -18], [12, -20]].forEach(([x, dz]) => {
    const t = new THREE.Group(); t.position.set(x, 0, HALL.zFront + dz); yard.add(t);
    t.add(mesh(new THREE.CylinderGeometry(.3, .5, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }), 0, 1.8, 0));
    for (let i = 0; i < 9; i++) { const l = mesh(new THREE.SphereGeometry(rand(1, 1.6), 12, 10), M.leaf, rand(-1.5, 1.5), rand(3.6, 5.4), rand(-1.5, 1.5)); yard.add(l); l.position.add(t.position); }
  });
  for (let i = 0; i < 26; i++) { const f = mesh(new THREE.SphereGeometry(.22, 10, 8), M.lotus, (13 + rand(-4, 4)) * (i % 2 ? 1 : -1), .3, HALL.zFront - 16 + rand(-5.5, 5.5)); f.scale.y = 1.3; yard.add(f); }
  const yardLight = new THREE.DirectionalLight(0xfff6e0, 1.6); yardLight.position.set(-5, 14, HALL.zFront - 5); yardLight.target.position.set(0, 0, HALL.zFront - 15); yard.add(yardLight, yardLight.target);

  /* khói hương */
  const smokeMat = new THREE.SpriteMaterial({ map: softTex, color: 0xffffff, transparent: true, opacity: .4, depthWrite: false });
  const puffs = [];
  function puff(x, y, z, big = 1) {
    const s = new THREE.Sprite(smokeMat.clone()); s.position.set(x + rand(-.05, .05), y, z + rand(-.05, .05));
    s.userData = { life: 0, max: rand(3, 5), vx: rand(-.08, .08), vz: rand(-.05, .05), big };
    scene.add(s); puffs.push(s);
  }
  let incenseBoost = 0;

  /* gộp các vật tĩnh theo vật liệu để giảm số lần vẽ */
  function mergeStatic() {
    scene.updateMatrixWorld(true);
    const groups = new Map(), victims = [];
    scene.traverse(o => {
      if (!o.isMesh || o.userData.dynamic) return;
      let a = o.parent; while (a && a !== scene) { if (a.userData.dynamic) return; a = a.parent; }
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      ['uv1', 'uv2', 'color'].forEach(k => g.deleteAttribute(k));
      if (!g.attributes.uv) return;
      g.applyMatrix4(o.matrixWorld);
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material).push(g); victims.push(o);
    });
    victims.forEach(o => o.parent.remove(o));
    for (const [mat, list] of groups) { const merged = mergeGeometries(list, false); if (merged) scene.add(new THREE.Mesh(merged, mat)); }
  }

  /* ghế ngồi + phật tử */
  const SEATS = [];
  [-1, 1].forEach(s => [1.9, 3.15, 4.4, 5.65].forEach(ax => [-8.2, -5.9, -3.6, -1.3, 1, 3.3].forEach(z => SEATS.push({ x: s * ax, z: z + (ax > 4 ? .3 : 0), taken: null }))));
  const cushionGeo = new THREE.CylinderGeometry(.42, .46, .14, 20);
  SEATS.forEach(s => { const c = mesh(cushionGeo, M.cushion, s.x, .07, s.z); scene.add(c); });
  const mySeat = { x: 0, z: 5.4 }; scene.add(mesh(cushionGeo, M.cushion, mySeat.x, .07, mySeat.z));

  mergeStatic();
  const people = [];
  const me = new Person('Bạn', { me: true }); me.root.position.set(mySeat.x, 0, mySeat.z); scene.add(me.root);
  me.heading = 0; me.sit = me.sitT = 1;
  let nameIdx = 0;
  function spawn(atDoor) {
    const free = SEATS.filter(s => !s.taken);
    const isMonk = people.length === 5;
    const p = new Person(isMonk ? 'Chú tiểu' : NAMES[nameIdx++ % NAMES.length], { monk: isMonk, scale: isMonk ? .86 : rand(.94, 1.04), showTag: people.length < 7 });
    p.ai = { state: 'sit', t: rand(4, 30), target: null, seat: null };
    if (atDoor || !free.length) {
      p.root.position.set(rand(-1, 1), 0, HALL.zFront + .8); p.sit = p.sitT = 0; p.heading = 0;
      if (free.length) { const s = pick(free); s.taken = p; p.ai.seat = s; p.ai.state = 'walk'; p.ai.target = s; }
      else { p.ai.state = 'wander'; p.ai.t = 0; }
    } else {
      const s = free[(Math.random() * free.length) | 0]; s.taken = p; p.ai.seat = s;
      p.root.position.set(s.x, 0, s.z); p.heading = 0;
    }
    scene.add(p.root); people.push(p); return p;
  }
  function despawn() {
    const p = people.filter(p => !p.leaving && p.ai.state === 'sit').pop() || people.find(p => !p.leaving); if (!p) return;
    p.leaving = true; if (p.ai.seat) { p.ai.seat.taken = null; p.ai.seat = null; }
    p.sitT = 0; p.ai.state = 'walk'; p.ai.target = { x: rand(-.8, .8), z: HALL.zFront + .6, exit: true };
  }
  function setCount(n) {
    const want = clamp(n - 1, 0, 60);
    const cur = people.filter(p => !p.leaving).length;
    for (let i = cur; i < want; i++) spawn(started);
    for (let i = want; i < cur; i++) despawn();
  }
  let started = false;

  /* AI */
  function chooseNext(p) {
    const r = Math.random();
    if (p.ai.seat) { p.ai.seat.taken = null; p.ai.seat = null; }
    if (r < .35) { const poi = pick(POIS); p.ai.target = { x: poi.x + rand(-.4, .4), z: poi.z + rand(-.6, .6), face: poi.face, poi: true }; }
    else if (r < .5) p.ai.target = { x: rand(-.6, .6), z: 7.6 + rand(-.3, .3), face: 0, poi: true, bow: true };
    else if (r < .6) p.ai.target = { x: rand(-1.2, 1.2), z: HALL.zFront + 1.4, face: Math.PI, poi: true };
    else { const free = SEATS.filter(s => !s.taken); const s = pick(free); if (!s) return; s.taken = p; p.ai.seat = s; p.ai.target = s; }
    p.ai.state = 'walk'; p.sitT = 0;
  }
  function stepAI(p, dt) {
    const ai = p.ai;
    if (ai.state === 'sit') {
      ai.t -= dt;
      if (ai.bowT) { ai.bowT -= dt; if (ai.bowT <= 0) p.bowT = 0; }
      else if (Math.random() < dt * .03) { p.bowT = 1; ai.bowT = 1.4; }
      const walking = people.filter(q => q.ai.state === 'walk' || q.ai.state === 'look').length;
      if (ai.t <= 0) { if (walking < 7) chooseNext(p); else ai.t = rand(5, 15); }
    } else if (ai.state === 'walk') {
      if (p.sit > .3) { p.speed = 0; return; }       // đang đứng dậy
      const tx = ai.target.x, tz = ai.target.z, pos = p.root.position;
      let dx = tx - pos.x, dz = tz - pos.z; const d = Math.hypot(dx, dz);
      if (d < .08) {
        p.speed = 0; pos.x = tx; pos.z = tz;
        if (ai.target.exit) { scene.remove(p.root); people.splice(people.indexOf(p), 1); return; }
        if (ai.target.poi) { ai.state = 'look'; ai.t = rand(4, 9); ai.face = ai.target.face; if (ai.target.bow) { ai.bowAt = ai.t - 1; } return; }
        ai.state = 'sit'; p.sitT = 1; ai.t = rand(12, 40); ai.face = 0; return;
      }
      // lách người khác
      let ax = dx / d, az = dz / d;
      for (const q of people) { if (q === p) continue; const ox = pos.x - q.root.position.x, oz = pos.z - q.root.position.z, od = Math.hypot(ox, oz); if (od < .7 && od > 0.001 && d > .6) { ax += ox / od * (.7 - od) * 2.2; az += oz / od * (.7 - od) * 2.2; } }
      const al = Math.hypot(ax, az); ax /= al; az /= al;
      p.speed = damp(p.speed, 1.15, 4, dt);
      const step = Math.min(d, p.speed * dt);
      pos.x = clamp(pos.x + ax * step, -HALL.x + .6, HALL.x - .6); pos.z += az * step;
      p.heading = angleLerp(p.heading, Math.atan2(ax, az), Math.min(1, dt * 8));
    } else if (ai.state === 'look') {
      p.heading = angleLerp(p.heading, ai.face, Math.min(1, dt * 5));
      ai.t -= dt;
      if (ai.bowAt != null && ai.t < ai.bowAt) { p.bowT = 1; if (ai.t < ai.bowAt - 1.6) { p.bowT = 0; ai.bowAt = null; } }
      if (ai.t <= 0) { p.bowT = 0; const free = SEATS.filter(s => !s.taken); const s = pick(free); if (s) { s.taken = p; ai.seat = s; ai.target = s; ai.state = 'walk'; } else ai.t = 5; }
    }
    if (ai.state === 'sit' && p.sit > .5) p.heading = angleLerp(p.heading, 0, Math.min(1, dt * 4));
  }

  /* camera */
  const VIEWS = {
    all: { pos: [0, 4.4, 10.9], look: [0, 1.4, -6] },
    buddha: { pos: [0, 3.3, 5.2], look: [0, 3.5, 13] },
    left: { pos: [2.6, 3.2, 1.5], look: [-9, 3.2, -1] },
    right: { pos: [-2.6, 3.2, 1.5], look: [9, 3.2, -1] },
    door: { pos: [0, 3, -4], look: [0, 2.4, -14] },
    yard: { pos: [0, 4, -15.5], look: [0, 2, -40] }
  };
  const cam = { mode: 'preset', view: 'all', pos: new THREE.Vector3(...VIEWS.all.pos), look: new THREE.Vector3(...VIEWS.all.look) };
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  const tmpLook = new THREE.Vector3().copy(cam.look);
  function setView(name) { cam.mode = 'preset'; cam.view = name; hooks.onView && hooks.onView(name); }

  /* player */
  const input = { x: 0, y: 0 };
  const player = { busy: 0, outside: false, auto: null };
  function setInput(x, y) { input.x = x; input.y = y; }
  function walkTo(x, z, then) { player.auto = { x, z, then }; me.sitT = 0; cam.mode = 'follow'; hooks.onView && hooks.onView(null); }
  function stepPlayer(dt) {
    const pos = me.root.position;
    let mx = 0, mz = 0;
    if (Math.hypot(input.x, input.y) > .08) {
      player.auto = null;
      // di chuyển theo hướng camera
      const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      mx = f.x * -input.y + r.x * input.x; mz = f.z * -input.y + r.z * input.x;
      if (cam.mode !== 'follow') { cam.mode = 'follow'; hooks.onView && hooks.onView(null); }
      me.sitT = 0; me.bowT = 0; hooks.onMove && hooks.onMove();
    } else if (player.auto) {
      const dx = player.auto.x - pos.x, dz = player.auto.z - pos.z, d = Math.hypot(dx, dz);
      if (d < .1) { const t = player.auto.then; player.auto = null; me.speed = 0; t && t(); }
      else { mx = dx / d; mz = dz / d; }
    }
    const ml = Math.hypot(mx, mz);
    if (ml > .01 && me.sit < .35) {
      const sp = 2.2 * Math.min(1, ml);
      me.speed = damp(me.speed, sp, 6, dt);
      let nx = pos.x + mx / ml * me.speed * dt, nz = pos.z + mz / ml * me.speed * dt;
      // va chạm với người khác
      for (const q of people) { const ox = nx - q.root.position.x, oz = nz - q.root.position.z, od = Math.hypot(ox, oz); if (od < .55 && od > .001) { nx = q.root.position.x + ox / od * .55; nz = q.root.position.z + oz / od * .55; } }
      if (player.outside) { nx = clamp(nx, -20, 20); nz = clamp(nz, HALL.zFront - 30, HALL.zFront - 2.5); }
      else { nx = clamp(nx, -HALL.x + .6, HALL.x - .6); nz = clamp(nz, HALL.zFront + .9, 8.4); }
      pos.x = nx; pos.z = nz;
      me.heading = angleLerp(me.heading, Math.atan2(mx, mz), Math.min(1, dt * 10));
    } else me.speed = damp(me.speed, 0, 8, dt);
  }
  function stepCamera(dt) {
    let tp, tl;
    if (cam.mode === 'preset') { const v = VIEWS[cam.view]; tp = new THREE.Vector3(...v.pos); tl = new THREE.Vector3(...v.look); }
    else if (cam.mode === 'front') {
      const p = me.root.position; tp = new THREE.Vector3(p.x + Math.sin(me.heading) * 3.6, 2.4, p.z + Math.cos(me.heading) * 3.6); tl = new THREE.Vector3(p.x, 1.1, p.z);
    } else {
      const p = me.root.position, off = new THREE.Vector3().subVectors(cam.pos, p); off.y = 0;
      if (off.lengthSq() < .01) off.set(0, 0, 1);
      off.normalize().multiplyScalar(5.6);
      tp = new THREE.Vector3(p.x + off.x, 3.4, p.z + off.z);
      if (!player.outside) { tp.x = clamp(tp.x, -HALL.x + .4, HALL.x - .4); tp.z = clamp(tp.z, HALL.zFront + .5, HALL.zBack - .6); }
      else tp.z = Math.min(tp.z, HALL.zFront - .7);
      tl = new THREE.Vector3(p.x, 1.3, p.z).addScaledVector(off, -.6);
    }
    const k = cam.mode === 'follow' ? 4 : 2.6;
    cam.pos.lerp(tp, 1 - Math.exp(-k * dt)); tmpLook.lerp(tl, 1 - Math.exp(-k * dt));
    camera.position.copy(cam.pos); camera.lookAt(tmpLook);
  }

  /* hành động của Bạn */
  const ACT = {
    sit() { player.auto = null; me.sitT = 1; me.bowT = 0; if (!player.outside) me.heading = me.heading; },
    async chaptay() { me.bowT = 0; },
    async cuichao() { me.bowT = 1; await wait(1300); me.bowT = 0; },
    async layphat() {
      me.sitT = 1; me.heading = 0;
      for (let i = 0; i < 3; i++) { me.bowT = 2; await wait(1200); me.bowT = 0; await wait(700); }
    },
    async thaphuong() {
      incenseBoost = 6;
    }
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function action(name) {
    if (['chaptay', 'niemphat', 'thien', 'nghekinh', 'chuoihat', 'layphat'].includes(name)) {
      me.sitT = 1; player.auto = null;
      if (!player.outside) me.heading = angleLerp(me.heading, 0, 1);
      if (cam.mode === 'follow') { cam.mode = 'front'; }
    }
    if (ACT[name]) return ACT[name]();
  }
  function goOutside(cb) {
    cam.mode = 'follow';
    walkTo(clamp(me.root.position.x, -1, 1), HALL.zFront + 1, () => {
      hooks.onFade && hooks.onFade(() => {
        player.outside = true; scene.background = SKY; scene.fog.color.set(0xcfe3f2); me.root.position.set(0, 0, HALL.zFront - 5.5); me.heading = Math.PI;
        cam.pos.set(0, 3.4, HALL.zFront - .7); tmpLook.set(0, 1.5, HALL.zFront - 10); cam.mode = 'follow';
        cb && cb();
      });
    });
  }
  function goInside(cb) {
    hooks.onFade && hooks.onFade(() => {
      player.outside = false; scene.background = INDOOR; scene.fog.color.set(0x3a160c); me.root.position.set(0, 0, HALL.zFront + 1.5); me.heading = 0; me.sitT = 0;
      cam.pos.set(0, 3.4, HALL.zFront + 7); tmpLook.set(0, 1.3, HALL.zFront); cam.mode = 'follow';
      walkTo(mySeat.x, mySeat.z, () => { me.sitT = 1; me.heading = 0; setView('all'); });
      cb && cb();
    });
  }
  function goToSeat() { if (player.outside) return goInside(); walkTo(mySeat.x, mySeat.z, () => { me.sitT = 1; me.heading = 0; setView('all'); }); }

  /* chiếu toạ độ ra màn hình */
  const v3 = new THREE.Vector3();
  function project(x, y, z) {
    v3.set(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height, visible: v3.z < 1 };
  }
  const headPos = () => { const p = me.root.position; return project(p.x, p.y + (me.sit > .5 ? 1.75 : 2.05), p.z); };

  /* vòng lặp */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 68 : 52; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  const clock = new THREE.Clock(); let smokeT = 0, time = 0;
  function frame() {
    const dt = Math.min(.05, clock.getDelta()); time += dt;
    stepPlayer(dt); me.update(dt);
    for (const p of [...people]) { stepAI(p, dt); p.update(dt); }
    stepCamera(dt);
    // tên: hiện khi gần camera
    for (const p of people) { const d = p.root.position.distanceTo(camera.position); p.tag.visible = !!((p.ai.state !== "sit" && d < 14) || (p.tag.userData.always && d < 18)); }
    // đèn lung linh
    flick.forEach((l, i) => { l.intensity = l.userData.base ?? (l.userData.base = l.intensity); l.intensity = l.userData.base * (0.9 + Math.sin(time * 3 + i * 1.7) * .05 + Math.sin(time * 7.3 + i) * .04); });
    glows.forEach((g, i) => g.material.opacity = .6 + Math.sin(time * 2.4 + i) * .12);
    lamps.forEach((g, i) => g.material.opacity = .7 + Math.sin(time * 3.1 + i * 2) * .15);
    // khói
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = incenseBoost > 0 ? .07 : .22;
      puff(rand(-.2, .2), 1.55, 9.4); puff(0, 2.4, HALL.zFront - 9, 2);
      if (incenseBoost > 0) puff(rand(-.3, .3), 1.55, 9.4, 1.6);
    }
    incenseBoost = Math.max(0, incenseBoost - dt);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const s = puffs[i], u = s.userData; u.life += dt; const t = u.life / u.max;
      s.position.y += dt * .55 * u.big; s.position.x += u.vx * dt + Math.sin(time * 2 + i) * .002; s.position.z += u.vz * dt;
      const sc = (.25 + t * 1.3) * u.big; s.scale.set(sc, sc, 1); s.material.opacity = Math.sin(Math.PI * Math.min(1, t)) * .35;
      if (t >= 1) { scene.remove(s); s.material.dispose(); puffs.splice(i, 1); }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function start(count) {
    for (let i = 0; i < Math.min(count - 1, 60); i++) { const p = spawn(false); if (i < 6) p.tag.userData.always = true; p.ai.t = rand(2, 40); }
    started = true; requestAnimationFrame(frame);
  }
  function resetHall(count) {
    people.splice(0).forEach(p => scene.remove(p.root)); SEATS.forEach(s => s.taken = null); nameIdx = (Math.random() * 20) | 0;
    started = false; for (let i = 0; i < Math.min(count - 1, 60); i++) { const p = spawn(false); if (i < 6) p.tag.userData.always = true; p.ai.t = rand(2, 40); } started = true;
    if (player.outside) { player.outside = false; scene.background = INDOOR; scene.fog.color.set(0x3a160c); } me.root.position.set(mySeat.x, 0, mySeat.z); me.sitT = 1; me.heading = 0; player.auto = null; setView('all');
  }

  return {
    start, setInput, setView, action, goOutside, goInside, goToSeat, setCount, resetHall, headPos,
    debug: () => ({ cam: camera.position.toArray().map(v => +v.toFixed(2)), look: tmpLook.toArray().map(v => +v.toFixed(2)), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, x: me.root.position.x, z: me.root.position.z, h: me.heading, sit: me.sit, mode: cam.mode, walking: people.filter(p => p.ai.state !== 'sit').length, tags: people.filter(p => p.tag.visible).length, sprites: (() => { let n = 0; scene.traverseVisible(o => { if (o.isSprite && o.material.map && o.material.map.image && o.material.map.image.width === 256 && o.material.map.image.height === 64) n++; }); return n; })() }),
    get outside() { return player.outside; }, get count() { return people.length + 1; }
  };
}
