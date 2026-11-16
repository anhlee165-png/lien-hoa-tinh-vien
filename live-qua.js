/* Quà TikTok LIVE THẬT → nhà chùa thắp hương / dâng hoa thay người tặng, hiện tên và đọc lời cảm ơn tiếng Việt.
   Chỉ chạy ở chế độ live (?live=doc | ?live=ngang), sau live.js.
   Nguồn tin: ws://localhost:21213 — TikFinity (bật WebSocket API) hoặc scripts/tiktok-cau-noi (chỉ chạy một trong hai).
     &tt=ws://…  đổi địa chỉ cầu nối · &tt=0 tắt hẳn
   Chỉ quà thật mới hiện tên người tặng.
   Hiệu ứng không khí: chuông chùa điểm mỗi 15 phút, cánh hoa rơi nhẹ. */
(() => {
  const F = window.LiveFeed;
  if (!F || !window.LiveHook || !LiveHook.mode) return;
  const { say, esc, side, ov } = F;
  const Fx = () => window.ChuaFx || {};
  const q = new URLSearchParams(location.search);
  const WS_URL = q.get('tt') === '0' ? '' : (q.get('tt') || 'ws://localhost:21213');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('lq:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('lq:' + k, JSON.stringify(v)); } catch {} }
  };
  const opt = Object.assign({ tts: true, voice: '', rate: 1, follow: true, bell: true, petals: true }, store.get('opt', {}));
  const saveOpt = () => store.set('opt', opt);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ---- Trên khung hình: bảng cảm ơn + lời mời tặng quà ---- */
  const ban = document.createElement('div'); ban.id = 'lv-gift'; ov.appendChild(ban);

  /* ---- Tên quà tiếng Việt (quà hay gặp), tên người đọc cho dễ nghe ---- */
  const VI = { 'rose': 'hoa hồng', 'rosa': 'hoa hồng', 'finger heart': 'trái tim', 'heart me': 'trái tim', 'hand hearts': 'trái tim', 'heart': 'trái tim',
    'tiktok': 'quà TikTok', 'perfume': 'nước hoa', 'doughnut': 'bánh donut', 'ice cream cone': 'cây kem', 'sunglasses': 'kính râm', 'love you': 'lời yêu thương',
    'cap': 'chiếc mũ', 'corgi': 'chú chó corgi', 'lion': 'sư tử', 'universe': 'vũ trụ', 'galaxy': 'thiên hà', 'lotus': 'hoa sen', 'flower': 'bông hoa',
    'gg': 'GG', 'confetti': 'pháo giấy', 'hat and mustache': 'mũ và ria', 'money gun': 'súng tiền', 'swan': 'thiên nga', 'train': 'đoàn tàu', 'rocket': 'tên lửa' };
  const viGift = n => VI[String(n).trim().toLowerCase()] || String(n || 'quà').slice(0, 30);
  const isFlower = n => /rose|rosa|hoa|flower|bông|tulip|lotus|sen\b|bouquet|blossom/i.test(n);
  const spoken = s => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[_.\-~|*#@]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);

  /* ---- Giọng đọc tiếng Việt (giọng sẵn có của trình duyệt / Windows) ---- */
  const synth = window.speechSynthesis;
  let voices = [];
  const viVoices = () => voices.filter(v => /^vi/i.test(v.lang));
  const pickVoice = () => { const vi = viVoices(); return vi.find(v => v.name === opt.voice) || vi.find(v => /natural|online/i.test(v.name)) || vi[0] || null; };
  function speak(text) {
    return new Promise(res => {
      if (!opt.tts || !synth || !text) return res();
      const u = new SpeechSynthesisUtterance(text), v = pickVoice();
      if (v) u.voice = v; u.lang = 'vi-VN'; u.rate = opt.rate;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = u.onerror = fin; setTimeout(fin, 16000);
      synth.speak(u);
    });
  }

  /* ---- Hàng chờ quà: lần lượt từng người, quà dồn của cùng người thì gộp ---- */
  const queue = []; let running = false, walking = 0;
  function addGift(g) {
    const last = queue[queue.length - 1];
    if (last && last.name === g.name && last.gift === g.gift) { last.count += g.count; last.diamonds += g.diamonds; return; }
    if (queue.length >= 30) queue.shift();
    queue.push(g); pump();
  }
  async function pump() {
    if (running) return; running = true;
    while (queue.length) { const g = queue.shift(); try { await play(g); } catch (e) { console.warn('[quà]', e); } }
    running = false;
  }
  async function play(g) {
    const fx = Fx(), kind = isFlower(g.giftRaw) || isFlower(g.gift) ? 'hoa' : 'huong', big = g.diamonds >= 99;
    const t0 = Date.now();
    const what = `${g.count > 1 ? g.count + ' × ' : ''}${g.gift}`;
    ban.innerHTML = `<b>${esc(g.name)}</b><span>đã tặng ${esc(what)}</span>
      <small>${kind === 'hoa' ? 'Nhà chùa xin dâng hoa cúng Phật thay đạo hữu 🪷' : 'Nhà chùa xin thắp hương cầu an cho đạo hữu 🪔'}</small>`;
    ban.className = 'on' + (big ? ' big' : '');
    say(`🎁 <b>${esc(g.name)}</b> tặng ${esc(what)}`, 'gift');
    fx.audio && fx.audio();
    (kind === 'hoa' ? fx.hoa : fx.huong) && (kind === 'hoa' ? fx.hoa : fx.huong)(1);
    fx.smoke && fx.smoke(18);
    if (big) { setTimeout(() => fx.bell && fx.bell(), 400); fx.petals && fx.petals(36); fx.floatText && fx.floatText('Đại chúng tùy hỷ công đức 🙏'); }
    else fx.petals && fx.petals(10);
    // một Phật tử trong chánh điện đứng dậy làm thay, thẻ tên mang tên người tặng (tối đa 3 người cùng lúc)
    let walk = Promise.resolve(false);
    if (walking < 3 && window.Nguoi && Nguoi.proxyOffer) {
      walking++; walk = Nguoi.proxyOffer(kind, g.name).catch(() => false).finally(() => walking--);
    }
    const thank = kind === 'hoa' ? 'Nhà chùa xin dâng hoa cúng Phật, hồi hướng phước lành cho đạo hữu.' : 'Nhà chùa xin thắp nén hương cầu an cho đạo hữu và gia đình.';
    await wait(900);
    await speak(`Nam mô A Di Đà Phật. Cảm ơn ${g.spoken} đã tặng ${g.count > 1 ? g.count + ' ' : ''}${g.gift}. ${thank}`);
    await wait(Math.max(1500, (big ? 9000 : 7000) - (Date.now() - t0)));       // bảng cảm ơn hiện ít nhất 7–9 giây
    ban.className = '';
    if (!queue.length) await Promise.race([walk, wait(12000)]);
    else await wait(500);
  }

  /* ---- Tin từ cầu nối (dạng TikFinity / tiktok-live-connector) ---- */
  let lastFollow = 0;
  function onMsg(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const ev = m.event || m.type, d = m.data || {}, u = d.user || {};
    const nick = d.nickname || u.nickname || d.uniqueId || u.uniqueId || 'Đạo hữu';
    const sp = spoken(nick) || spoken(d.uniqueId || u.uniqueId) || 'đạo hữu';
    if (ev === 'gift') {
      const gd = d.giftDetails || {};
      const gt = d.giftType ?? gd.giftType;
      if (gt === 1 && !d.repeatEnd) return;                            // quà bấm liên tục: chờ hết chuỗi mới cảm ơn một lần
      const raw = d.giftName || gd.giftName || (d.extendedGiftInfo || {}).name || 'quà';
      const count = Math.max(1, +d.repeatCount || 1);
      const dia = (+(d.diamondCount ?? gd.diamondCount) || 0) * count;
      addGift({ name: String(nick).slice(0, 32), spoken: sp, giftRaw: raw, gift: viGift(raw), count, diamonds: dia });
    } else if ((ev === 'follow' || (ev === 'social' && /follow/i.test(d.displayType || ''))) && opt.follow) {
      const now = Date.now(); if (now - lastFollow < 8000) return; lastFollow = now;
      say(`➕ <b>${esc(String(nick).slice(0, 32))}</b> vừa theo dõi kênh chùa`, 'join');
      if (!running && !queue.length) { Fx().chime && Fx().chime(880, 2, .2); speak(`Cảm ơn ${sp} đã theo dõi kênh chùa.`); }
    }
  }

  /* ---- Bảng điều khiển (ngoài vùng quay) ---- */
  const box = document.createElement('section'); box.id = 'lq';
  box.innerHTML = `<h3>Quà TikTok LIVE</h3>
    <p>Cầu nối: <b id="lq-st">…</b><br><small class="note">${esc(WS_URL || 'đã tắt')} · mở TikFinity (bật WebSocket API) hoặc chạy <code>scripts/tiktok-cau-noi</code></small></p>
    <p class="warn" id="lq-voice" hidden></p>
    <div class="grid2">
      <button data-q="unlock">🔊 Bật tiếng + giọng đọc</button>
      <button data-q="bell">🔔 Thỉnh chuông ngay</button>
    </div>
    <div class="lq-opts">
      <label><input type="checkbox" data-o="tts"> Đọc lời cảm ơn</label>
      <label>Giọng <select id="lq-vsel"></select></label>
      <label>Tốc độ <input type="range" id="lq-rate" min=".7" max="1.4" step=".05"></label>
      <label><input type="checkbox" data-o="follow"> Cảm ơn người theo dõi</label>
      <label><input type="checkbox" data-o="bell"> Chuông chùa điểm mỗi 15 phút</label>
      <label><input type="checkbox" data-o="petals"> Cánh hoa rơi nhẹ</label>
    </div>
    <p class="note">Chỉ quà thật mới hiện tên người tặng.</p>`;
  side.appendChild(box);
  const $b = s => box.querySelector(s);
  box.querySelectorAll('[data-o]').forEach(i => { i.checked = !!opt[i.dataset.o]; i.addEventListener('change', () => { opt[i.dataset.o] = i.checked; saveOpt(); }); });
  const rate = $b('#lq-rate'); rate.value = opt.rate; rate.addEventListener('input', () => { opt.rate = +rate.value; saveOpt(); });
  const vsel = $b('#lq-vsel'); vsel.addEventListener('change', () => { opt.voice = vsel.value; saveOpt(); speak('Nam mô A Di Đà Phật'); });
  function paintVoices() {
    voices = synth ? synth.getVoices() : [];
    const vi = viVoices(), cur = pickVoice();
    vsel.innerHTML = vi.length ? vi.map(v => `<option${cur && v.name === cur.name ? ' selected' : ''}>${esc(v.name)}</option>`).join('') : '<option value="">(không có giọng Việt)</option>';
    const w = $b('#lq-voice');
    w.hidden = !!vi.length || !synth;
    w.textContent = 'Máy chưa có giọng đọc tiếng Việt. Mở trang bằng Microsoft Edge (có giọng HoaiMy / NamMinh) hoặc cài giọng Tiếng Việt trong Windows › Cài đặt › Thời gian và ngôn ngữ › Giọng nói.';
  }
  if (synth) { paintVoices(); synth.addEventListener ? synth.addEventListener('voiceschanged', paintVoices) : (synth.onvoiceschanged = paintVoices); }
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-q]'); if (!b) return;
    const k = b.dataset.q, fx = Fx(); b.blur();
    if (k === 'unlock') { fx.audio && fx.audio(); fx.chime && fx.chime(1046, 2, .2); speak('Đã bật giọng đọc. Nam mô A Di Đà Phật.'); }
    else if (k === 'bell') ringHour(true);
  });

  /* ---- Nối cầu nối, tự nối lại ---- */
  let tries = 0;
  const setSt = (t, ok) => { const s = $b('#lq-st'); s.textContent = t; s.className = ok ? 'ok' : ''; };
  function connect() {
    if (!WS_URL) return setSt('đã tắt (&tt=0)');
    setSt('đang nối…');
    let ws; try { ws = new WebSocket(WS_URL); } catch { return retry(); }
    ws.onopen = () => { tries = 0; setSt('đã nối ✔ — quà thật sẽ hiện lên', true); };
    ws.onmessage = e => onMsg(e.data);
    ws.onclose = () => { setSt('chưa nối — đang chờ TikFinity / cầu nối'); retry(); };
  }
  function retry() { setTimeout(connect, Math.min(30000, 3000 * ++tries)); }
  connect();

  /* ---- Không khí chùa: chuông điểm giờ, cánh hoa, lời mời ---- */
  let lastSlot = -1;
  function ringHour(force) {
    const d = new Date(), fx = Fx();
    if (!force) { const slot = d.getHours() * 4 + (d.getMinutes() / 15 | 0); if (d.getMinutes() % 15 || slot === lastSlot) return; lastSlot = slot; }
    fx.audio && fx.audio(); fx.strike && fx.strike('chuong');
    const hh = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    setTimeout(() => fx.floatText && fx.floatText(`Chuông chùa điểm ${hh}`), 700);
    say(`🔔 Chuông chùa điểm ${hh}`, 'sys');
  }
  setInterval(() => { if (opt.bell) ringHour(false); }, 20000);
  (function drift() { setTimeout(() => { if (opt.petals && !document.hidden) { const fx = Fx(); fx.petals && fx.petals(6); } drift(); }, 70000 + Math.random() * 50000); })();
})();
