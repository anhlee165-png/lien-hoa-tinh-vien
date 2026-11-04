/* Chế độ phát live TikTok (TikTok LIVE Studio quay cửa sổ trình duyệt).
   ?live=doc   khung dọc 9:16, máy quay đi theo nhân vật của mình, ẩn nút; góc có mã QR + link chùa; dòng chữ báo sự kiện
   ?live=ngang khung ngang 16:9 toàn cảnh
   &link=...   đổi link hiện trên màn hình (mặc định là địa chỉ web hiện tại)
   Phím: mũi tên/WASD đi lại · 1–8 hành động · H hiện/ẩn bảng điều khiển bên cạnh · Q ẩn/hiện mã QR · Z đổi độ phóng · X mặt trước/mặt sau */
(() => {
  const L = window.LiveHook;
  if (!L || !L.mode) return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const q = new URLSearchParams(location.search);
  const link = (q.get('link') || (location.origin + location.pathname.replace(/index\.html$/, ''))).replace(/\/$/, '');
  const shown = link.replace(/^https?:\/\//, '');

  /* ---- Lớp phủ trên khung hình (nằm trong #viewport nên luôn đúng khung 9:16) ---- */
  const ov = document.createElement('div');
  ov.id = 'live-ov';
  ov.innerHTML = `
    <div class="lv-top"><b>LIÊN HOA TỊNH VIỆN</b><span><i id="lv-room">Chánh điện</i> · 👥 <i id="lv-n">0</i></span></div>
    <div class="lv-qr" id="lv-qr"><div id="lv-qr-img"></div><small>Quét mã vào chùa</small><b>${esc(shown)}</b></div>
    <div class="lv-feed" id="lv-feed" aria-live="polite"></div>
    <div class="lv-hint" id="lv-hint">Phím H: bảng điều khiển · 1–8: hành động · mũi tên: đi lại</div>`;
  $('#viewport').appendChild(ov);
  try {
    const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
    $('#lv-qr-img').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch { $('#lv-qr-img').remove(); }
  setTimeout(() => $('#lv-hint').classList.add('off'), 6000);

  /* ---- Dòng chữ sự kiện: tối đa 4 dòng, mỗi dòng 7 giây ---- */
  const feed = $('#lv-feed');
  let last = '';
  function say(html, cls = '') {
    if (html === last) return; last = html; setTimeout(() => { if (last === html) last = ''; }, 3000);
    const d = document.createElement('div'); d.className = 'lv-item ' + cls; d.innerHTML = html;
    feed.appendChild(d);
    while (feed.children.length > 4) feed.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 600); }, 7000);
  }
  addEventListener('chua-toast', e => say(esc(e.detail), 'sys'));
  addEventListener('chua-chat', e => { const m = e.detail || {}; if (!m.sys && m.text) say(`<b>${esc(m.who)}</b> ${esc(m.text)}`); });
  addEventListener('chua-huong', e => { if (!(e.detail && e.detail.me)) say('🪔 Một đạo hữu vừa dâng hương', 'sys'); });
  let known = null;
  addEventListener('presence', e => {
    const list = e.detail || [], ids = new Set(list.map(p => p.uid));
    if (known) list.forEach(p => { if (!known.has(p.uid)) say(`🙏 <b>${esc(p.name || 'Đạo hữu')}</b> vừa vào chùa`, 'join'); });
    known = ids;
  });

  /* ---- Số người, tên cảnh ---- */
  setInterval(() => {
    const n = document.getElementById('online'); $('#lv-n').textContent = n ? n.textContent : '';
    const r = window.Nguoi && Nguoi.roomName ? Nguoi.roomName() : ''; const h = document.getElementById('hall-name');
    $('#lv-room').textContent = r && r !== 'Chánh điện' ? r : (h ? h.textContent : 'Chánh điện');
  }, 1000);

  /* ---- Khung dọc: khi mở hộp thoại (ví, công đức, đăng nhập…) tạm hiện trọn cảnh để không bị cắt ---- */
  const modal = $('#modal');
  if (L.mode === 'doc' && modal) {
    const sync = () => { L.setModal(!modal.hidden); if (!modal.hidden) { Object.assign(L.cam, { s: 1, x: L.W / 2, y: L.H / 2 }); L.applyCam(); } };
    new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['hidden'] }); sync();
  }

  /* ---- Máy quay đi theo nhân vật (chỉ khung dọc) ---- */
  const ZOOMS = [1, 1.2, 1.45];
  let zi = 1;
  if (L.mode === 'doc') {
    const cam = L.cam;
    (function follow() {
      const me = window.Nguoi && Nguoi.me ? Nguoi.me() : null;
      if (me && Number.isFinite(me.x) && modal && modal.hidden) {
        const tx = me.x, ty = me.y - 90 / ZOOMS[zi], ts = ZOOMS[zi];
        cam.x += (tx - cam.x) * .08; cam.y += (ty - cam.y) * .08; cam.s += (ts - cam.s) * .08;
        L.applyCam();
      }
      requestAnimationFrame(follow);
    })();
  }

  /* ---- Phím tắt ---- */
  const ACTS = ['chaptay', 'cuichao', 'layphat', 'niemphat', 'thien', 'nghekinh', 'chuoihat', 'thaphuong', 'danghoa'];
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = $('#modal'); if (m && !m.hidden) return;
    const k = e.key.toLowerCase();
    if (k === 'h') document.body.classList.toggle('live-noside');
    else if (k === 'q') $('#lv-qr').classList.toggle('off');
    else if (k === 'z') zi = (zi + 1) % ZOOMS.length;
    else if (k === 'x') { const x = $('#xoay'); x && x.click(); }
    else if (/^[1-9]$/.test(k)) { const b = document.querySelector(`#actions [data-act="${ACTS[+k - 1]}"]`); b && b.click(); }
  });

  /* ---- Bảng điều khiển bên cạnh khung (ngoài vùng quay): bấm thay phím ---- */
  const side = document.createElement('aside');
  side.id = 'live-side';
  side.innerHTML = `<h3>Điều khiển live</h3>
    <p>Trong TikTok LIVE Studio chỉ quay <b>${L.mode === 'doc' ? 'khung bên trái' : 'khung phía trên'}</b> (cắt bỏ bảng này).</p>
    <div class="grid">${ACTS.map((a, i) => { const b = document.querySelector(`#actions [data-act="${a}"]`); return `<button data-a="${a}"><kbd>${i + 1}</kbd>${esc(b ? b.textContent.trim() : a)}</button>`; }).join('')}</div>
    <div class="grid2"><button data-k="z">Đổi độ phóng (Z)</button><button data-k="q">Ẩn/hiện QR (Q)</button><button data-k="xoay">Mặt trước / Mặt sau (X)</button><button data-k="ra">Ra ngoài / vào điện</button><button data-k="full">Toàn màn hình</button></div>
    <h3 style="font-size:15px;margin-top:4px">Đi đến</h3><div class="ways" id="lv-ways"></div>
    <p class="note">Đi lại bằng phím mũi tên hoặc W A S D. Ở mặt sau, giữ chuột kéo trái/phải để quay nhìn, lăn chuột để phóng to.</p>`;
  document.body.appendChild(side);
  side.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a) { const x = document.querySelector(`#actions [data-act="${b.dataset.a}"]`); x && x.click(); }
    else if (b.dataset.k === 'z') zi = (zi + 1) % ZOOMS.length;
    else if (b.dataset.k === 'q') $('#lv-qr').classList.toggle('off');
    else if (b.dataset.w) { const x = document.querySelector(`#ways [data-way="${b.dataset.w}"]`); x && x.click(); }
    else if (b.dataset.k === 'xoay') { const x = $('#xoay'); x && x.click(); }
    else if (b.dataset.k === 'ra') { const x = document.querySelector('#actions [data-act="rangoai"]'); x && x.click(); }
    else if (b.dataset.k === 'full') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
    b.blur();
  });
  // các lối đi của cảnh hiện tại (giống bảng "Đi đến" trên màn hình)
  function paintWays() {
    const box = $('#lv-ways'); if (!box) return;
    const ex = window.Nguoi && Nguoi.exits ? Nguoi.exits() : [], A = { left: '◀', right: '▶', up: '▲', down: '▼' };
    box.innerHTML = ex.map((e, i) => `<button data-w="${i}">${A[e.side] || ''} ${esc(e.name)}</button>`).join('') || '<span class="note">Không có lối đi</span>';
  }
  addEventListener('chua-room', () => setTimeout(paintWays, 0)); addEventListener('chua-ready', paintWays); setTimeout(paintWays, 1500);
  dispatchEvent(new Event('resize'));
})();
