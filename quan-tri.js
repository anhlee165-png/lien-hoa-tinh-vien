/* Trang Quản trị: mọi dữ liệu lấy qua Cloud Functions có kiểm quyền (custom claim admin/owner).
   Trang này không tự cấp quyền gì; ai không có claim chỉ thấy lỗi "Không có quyền". */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => (+n || 0).toLocaleString('vi-VN');
  const dt = t => t ? new Date(t).toLocaleString('vi-VN') : '';
  const toast = m => { let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); } el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 4000); };
  const call = (n, d) => Vi.call(n, d);
  const view = $('#view');
  const REASON = { NO_ORDER_CODE: 'Không có mã đơn', ORDER_NOT_FOUND: 'Mã đơn không tồn tại', UNDERPAID: 'Chuyển thiếu', OVERPAID: 'Chuyển thừa', LATE_PAYMENT: 'Trả sau khi hết hạn',
    ORDER_ALREADY_PAID: 'Đơn đã thanh toán (trả lần 2)', WRONG_ACCOUNT: 'Sai tài khoản nhận', WRONG_CURRENCY: 'Sai đơn vị tiền', OUTGOING_FOR_ORDER: 'Tiền ra liên quan đơn (hoàn/tranh chấp)',
    UNKNOWN_DIRECTION: 'Không rõ chiều tiền', ORDER_CANCELLED: 'Đơn đã huỷ', ORDER_REVIEW: 'Đơn đang đối soát' };

  /* ---------- Đăng nhập ---------- */
  $('#in').addEventListener('click', async () => { try { await Auth.signIn('google'); } catch (e) { $('#gate-msg').textContent = e.message; } });
  $('#out').addEventListener('click', () => Auth.signOut());
  addEventListener('vi-change', () => {
    const s = Vi.state(), u = Auth.user && Auth.user();
    $('#who').textContent = u ? u.email : ''; $('#out').hidden = !u;
    const allowed = s.uid && s.admin;
    $('#gate').hidden = !!allowed; $('#app').hidden = !allowed;
    if (s.uid && !s.admin) $('#gate-msg').textContent = 'Tài khoản này không có quyền quản trị.';
    if (allowed && !view.dataset.t) show('tong');
  });

  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); });
  async function show(t) {
    view.dataset.t = t; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    view.innerHTML = '<p class="note">Đang tải…</p>';
    try { await TABS[t](); } catch (e) { view.innerHTML = `<p class="bad">${esc(e.message)}</p>`; }
  }
  const reauthNote = '<p class="note">Thao tác nhạy cảm: nếu báo cần đăng nhập lại, bấm Đăng xuất rồi đăng nhập Gmail lại.</p>';

  const TABS = {
    async tong() {
      const [s, h] = await Promise.all([call('adminStats'), call('hello')]);
      const on = !(h.prices && h.prices.charging === false);
      const days = Object.entries(s.byDay).sort().slice(-30), max = Math.max(1, ...days.map(d => d[1]));
      view.innerHTML = `<div class="sw ${on ? 'on' : 'off'}"><div><b>Thu phí hương, hoa, cúng dường: ${on ? 'ĐANG BẬT' : 'ĐANG TẮT (miễn phí)'}</b>
          <small>${on ? 'Khách cần xu để thắp hương, dâng hoa, cúng dường.' : 'Mọi người thắp hương, dâng hoa, cúng dường miễn phí; mục Công đức hiện nút +20 / +50 / +100 / +200.'} Khách vẫn có thể gửi công đức tùy tâm bằng QR.</small></div>
          <button id="sw-btn">${on ? 'Tắt thu phí' : 'Bật thu phí'}</button></div>
        <div class="cards">
        <div class="card"><small>Tổng tiền nhận (nạp xu + ủng hộ)</small><b>${fmt(s.revenue)} đ</b><small>${fmt(s.paidCount)} đơn</small></div>
        <div class="card"><small>Ủng hộ nhà phát triển</small><b>${fmt(s.donateVnd)} đ</b><small>${fmt(s.donateCount)} lượt</small></div>
        <div class="card"><small>Xu đã cấp</small><b>${fmt(s.xuGranted)}</b></div>
        <div class="card"><small>Xu đã dùng</small><b>${fmt(s.xuSpent)}</b></div>
        <div class="card"><small>Tài khoản</small><b>${fmt(s.users)}</b><small>${fmt(s.active24h)} hoạt động 24 giờ</small></div>
        <div class="card"><small>Đơn chờ thanh toán</small><b>${fmt(s.pending)}</b></div>
        <div class="card"><small>Cần đối soát</small><b class="${s.reconcileOpen ? 'bad' : ''}">${fmt(s.reconcileOpen)}</b></div></div>
        <h2>Doanh thu 30 ngày</h2><div class="bar">${days.map(([d, v]) => `<i style="height:${(v / max * 100).toFixed(1)}%" title="${esc(d)}: ${fmt(v)} đ"></i>`).join('') || '<span class="note">Chưa có</span>'}</div>
        <h2>Ủng hộ nhà phát triển gần đây</h2>${table(['Thời gian', 'Số tiền', 'Người ủng hộ', 'Mã đơn'], (s.donations || []).map(x => [dt(x.at), fmt(x.vnd) + ' đ', `${esc(x.nick || '')}<br><small>${esc(x.email || x.uid)}</small>`, esc(x.orderId)]), true)}
        <h2>Theo tuần</h2>${table(['Tuần bắt đầu', 'Doanh thu'], Object.entries(s.byWeek).sort().reverse().slice(0, 12).map(([k, v]) => [k, fmt(v) + ' đ']))}
        <h2>Theo tháng</h2>${table(['Tháng', 'Doanh thu'], Object.entries(s.byMonth).sort().reverse().map(([k, v]) => [k, fmt(v) + ' đ']))}`;
      $('#sw-btn').addEventListener('click', async e => {
        e.target.disabled = true;
        try { await call('adminSetCharging', { on: !on }); toast(on ? 'Đã tắt thu phí: hương hoa miễn phí' : 'Đã bật thu phí'); show('tong'); }
        catch (err) { e.target.disabled = false; toast(err.message); }
      });
    },
    async nguoi() {
      view.innerHTML = `<form id="f"><input id="q" placeholder="UID, email hoặc biệt danh" size="34" required><button>Tìm</button></form><div id="res"></div>`;
      $('#f').addEventListener('submit', async e => { e.preventDefault();
        const r = await call('adminFindUser', { q: $('#q').value.trim() }).catch(err => (toast(err.message), []));
        $('#res').innerHTML = r.length ? table(['UID', 'Email', 'Biệt danh', 'Đăng nhập', 'Trạng thái', ''], r.map(u => [esc(u.uid), esc(u.email), esc(u.nick || ''), esc(u.provider), u.locked ? '<span class="bad">Đang khoá</span>' : 'Bình thường', `<button data-u="${esc(u.uid)}">Xem</button>`]), true) : '<p class="note">Không tìm thấy.</p>';
      });
      view.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b) user(b.dataset.u); });
    },
    async doisoat() {
      const [open, done] = await Promise.all([call('adminReconcile', { status: 'OPEN' }), call('adminReconcile', { status: 'RESOLVED' })]);
      view.innerHTML = `<p class="note">Giao dịch có tiền về nhưng không cộng xu tự động. Kiểm tra sao kê rồi quyết định: cộng xu cho đúng người (ghi lý do) hoặc đóng.</p>
        <h2>Cần xử lý (${open.length})</h2>${table(['Thời gian', 'Số tiền', 'Nội dung', 'Lý do', 'Đơn / UID', 'Xử lý'], open.map(r => [dt(r.at), fmt(r.amount) + ' đ', esc(r.content), REASON[r.reason] || esc(r.reason), `${esc(r.orderId || '')}<br><small>${esc(r.uid || '')}</small>`,
          `<input data-uid="${esc(r.id)}" placeholder="UID nhận" value="${esc(r.uid || '')}" size="14"><input data-xu="${esc(r.id)}" type="number" min="1" placeholder="Số xu" style="width:90px"><input data-why="${esc(r.id)}" placeholder="Lý do (bắt buộc)" size="18"><button data-credit="${esc(r.id)}">Cộng xu</button><button class="danger" data-dismiss="${esc(r.id)}">Đóng</button>`]), true)}
        <h2>Đã xử lý</h2>${table(['Thời gian', 'Số tiền', 'Lý do', 'Kết quả', 'Ghi chú'], done.map(r => [dt(r.at), fmt(r.amount) + ' đ', REASON[r.reason] || esc(r.reason), r.resolution === 'credit' ? `Cộng ${fmt(r.xu)} xu cho ${esc(r.uid)}` : 'Đã đóng', esc(r.note)]), true)}`;
      view.onclick = async e => {
        const c = e.target.closest('[data-credit]'), d = e.target.closest('[data-dismiss]'); if (!c && !d) return;
        const id = (c || d).dataset.credit || (c || d).dataset.dismiss, v = k => ($(`[data-${k}="${CSS.escape(id)}"]`) || {}).value;
        (c || d).disabled = true;
        try { await call('adminResolve', { id, action: c ? 'credit' : 'dismiss', uid: v('uid'), xu: +v('xu'), reason: v('why') }); toast('Đã xử lý'); show('doisoat'); }
        catch (err) { (c || d).disabled = false; toast(err.message); }
      };
    },
    async goi() {
      const h = await call('hello');
      view.innerHTML = `<h2>Gói nạp xu</h2><p class="note">Thay đổi chỉ áp dụng cho đơn tạo sau thời điểm lưu. Đơn đã tạo giữ nguyên giá.</p>
        <div class="wrap"><table id="pk"><tr><th>Mã gói</th><th>Giá (đ)</th><th>Số xu</th><th>Bật</th></tr>
        ${(await allPacks(h)).map(p => `<tr><td><input value="${esc(p.id)}" size="5"></td><td><input type="number" value="${p.vnd}"></td><td><input type="number" value="${p.xu}"></td><td><input type="checkbox" ${p.on !== false ? 'checked' : ''}></td></tr>`).join('')}</table></div>
        <div class="row"><button id="add">＋ Thêm gói</button><button id="save">Lưu gói</button></div>
        <h2>Giá dịch vụ (xu)</h2><form id="pr">Thắp hương <input id="inc" type="number" value="${h.prices.incense}" style="width:90px"> Dâng hoa (1 bông) <input id="flo" type="number" value="${h.prices.flower ?? 150}" style="width:90px"> Đổi biệt danh (trong 24 giờ) <input id="ren" type="number" value="${h.prices.rename}" style="width:90px"><button>Lưu giá</button></form>${reauthNote}`;
      $('#add').onclick = () => $('#pk').insertAdjacentHTML('beforeend', '<tr><td><input size="5"></td><td><input type="number"></td><td><input type="number"></td><td><input type="checkbox" checked></td></tr>');
      $('#save').onclick = async () => {
        const packs = $$('#pk tr').slice(1).map(tr => { const i = $$('input', tr); return { id: i[0].value.trim(), vnd: +i[1].value, xu: +i[2].value, on: i[3].checked }; }).filter(p => p.id);
        if (!confirm('Lưu bảng giá mới? Đơn mới sẽ dùng giá này.')) return;
        try { await call('adminSetPacks', { packs }); toast('Đã lưu gói'); } catch (e) { toast(e.message); }
      };
      $('#pr').onsubmit = async e => { e.preventDefault(); try { await call('adminSetPrices', { incense: +$('#inc').value, flower: +$('#flo').value, rename: +$('#ren').value }); toast('Đã lưu giá'); } catch (err) { toast(err.message); } };
    },
    async tk() {
      const c = await call('adminGetPayment');
      view.innerHTML = `<h2>Tài khoản nhận tiền hiện tại</h2>${c ? `<div class="card"><p>${({ payos: 'payOS', casso: 'Casso', sepay: 'SePay' })[c.provider] || esc(c.provider)} · ${esc(c.bankCode)} · <b>${esc(c.accountNumber)}</b> · ${esc(c.accountName)}</p>
        <p>${c.verified ? `<span class="ok">Đã xác minh</span> ${dt(c.verifiedAt)}` : `<span class="bad">Chưa xác minh — nạp xu đang tạm đóng</span>`}</p>
        ${c.verified ? '' : c.verifyLink ? `<p>Để xác minh: quét mã dưới đây, chuyển <b>2.000đ</b> qua payOS. Khi payOS báo có, hệ thống tự mở nạp xu.</p><img class="qr" src="${esc(c.verifyLink.qrUrl)}" alt="QR xác minh" width="240"><p>${/^https:\/\/pay\.payos\.vn\//.test(c.verifyLink.checkoutUrl) ? `<a href="${esc(c.verifyLink.checkoutUrl)}" target="_blank" rel="noopener">Mở trang thanh toán payOS</a>` : ''}</p>` : `<p>Để xác minh: chuyển một khoản nhỏ (vd. 2.000đ) vào chính tài khoản này với nội dung <b>${esc(c.verifyContent)}</b>. Khi Casso/SePay báo có, hệ thống tự mở nạp xu.</p>`}</div>` : '<p class="note">Chưa cấu hình.</p>'}
        <h2>Đổi tài khoản nhận tiền</h2><p class="note">Chỉ chủ chùa. Tài khoản phải là tài khoản đã liên kết với cổng thanh toán đã chọn. Sau khi đổi, nạp xu tạm đóng cho tới khi xác minh. Không thể đổi bằng cách tải ảnh QR.</p>
        <form id="f"><select id="pv"><option value="payos">payOS</option><option value="casso">Casso</option><option value="sepay">SePay</option></select><input id="b" placeholder="Mã ngân hàng (vd. MB, VCB, TCB hoặc mã BIN 970422)" required><input id="a" placeholder="Số tài khoản" required><input id="n" placeholder="Tên chủ tài khoản" required><button>Đổi tài khoản</button></form>${reauthNote}`;
      $('#f').onsubmit = async e => { e.preventDefault();
        if (!confirm('Đổi tài khoản nhận tiền? Nạp xu sẽ tạm đóng tới khi xác minh.')) return;
        try { const r = await call('adminSetPayment', { provider: $('#pv').value, bankCode: $('#b').value, accountNumber: $('#a').value, accountName: $('#n').value }); toast(r.verifyLink ? 'Đã lưu, quét QR 2.000đ để xác minh' : 'Đã lưu, chờ xác minh: ' + r.verifyContent); show('tk'); } catch (err) { toast(err.message); } };
    },
    async canh() {
      const a = await call('adminAlerts');
      view.innerHTML = `<div class="row"><button id="rd">Đánh dấu đã đọc</button></div>` + table(['Thời gian', 'Loại', 'Nội dung'], a.map(x => [dt(x.at), esc(x.kind), (x.read ? '' : '🔴 ') + esc(x.msg)]), true);
      $('#rd').onclick = async () => { await call('adminAlertsRead', { ids: a.filter(x => !x.read).map(x => x.id) }); show('canh'); badge(); };
    },
    async log() {
      const a = await call('adminAudit');
      view.innerHTML = table(['Thời gian', 'Người làm', 'Hành động', 'Chi tiết'], a.map(x => { const { id, at, actor, action, ...rest } = x; return [dt(at), esc(actor), esc(action), `<small>${esc(JSON.stringify(rest)).slice(0, 400)}</small>`]; }), true);
    },
    async xuat() {
      const d0 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), d1 = new Date().toISOString().slice(0, 10);
      view.innerHTML = `<form id="f"><select id="k"><option value="orders">Đơn nạp</option><option value="ledger">Sổ cái xu</option><option value="reconcile">Đối soát</option></select>
        từ <input type="date" id="a" value="${d0}"> đến <input type="date" id="b" value="${d1}"><button>Tải CSV (mở bằng Excel)</button></form>`;
      $('#f').onsubmit = async e => { e.preventDefault();
        try { const csv = await call('adminExport', { kind: $('#k').value, from: Date.parse($('#a').value), to: Date.parse($('#b').value) + 864e5 });
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `lhtv-${$('#k').value}-${$('#a').value}.csv`; a.click(); } catch (err) { toast(err.message); } };
    }
  };

  async function allPacks(h) { return h.packs; }
  async function user(uid) {
    const h = await call('adminUserHistory', { uid });
    const u = h.user;
    view.innerHTML = `<p><button id="back">← Tìm người khác</button></p><div class="card"><p><b>${esc(u.nick || u.email)}</b> · ${esc(u.email)} · UID <code>${esc(u.uid)}</code></p>
      <p>Số dư: <b>${fmt(h.balance)} xu</b> · Tạo ${dt(u.createdAt)} · Lần cuối ${dt(u.lastSeen)} · ${u.locked ? '<span class="bad">Đang khoá</span>' : 'Bình thường'}</p></div>
      <h2>Điều chỉnh xu</h2><form id="adj"><input id="x" type="number" placeholder="+/- số xu" required style="width:120px"><input id="why" placeholder="Lý do (bắt buộc)" size="40" required><button>Điều chỉnh</button></form>
      <h2>${u.locked ? 'Mở khoá' : 'Khoá'} tài khoản</h2><form id="lk"><input id="lw" placeholder="Lý do (bắt buộc)" size="40" required><button class="${u.locked ? '' : 'danger'}">${u.locked ? 'Mở khoá' : 'Khoá tài khoản'}</button></form>
      <h2>Sổ cái</h2>${table(['Thời gian', 'Loại', 'Xu', 'Số dư sau', 'Ghi chú', 'Người làm'], h.ledger.map(l => [dt(l.at), esc(l.type), (l.xu > 0 ? '+' : '') + fmt(l.xu), fmt(l.balanceAfter), esc(l.reason), esc(l.by)]), true)}
      <h2>Đơn nạp</h2>${table(['Tạo lúc', 'Mã', 'Tiền', 'Xu', 'Trạng thái'], h.orders.map(o => [dt(o.createdAt), esc(o.id), fmt(o.vnd) + ' đ', fmt(o.xu), esc(o.status)]), true)}`;
    $('#back').onclick = () => show('nguoi');
    $('#adj').onsubmit = async e => { e.preventDefault(); if (!confirm('Điều chỉnh số dư? Thao tác được ghi nhật ký.')) return;
      try { await call('adminAdjust', { uid, xu: +$('#x').value, reason: $('#why').value, opId: Vi.opId() }); toast('Đã điều chỉnh'); user(uid); } catch (err) { toast(err.message); } };
    $('#lk').onsubmit = async e => { e.preventDefault();
      try { await call('adminSetLock', { uid, locked: !u.locked, reason: $('#lw').value }); toast('Đã cập nhật'); user(uid); } catch (err) { toast(err.message); } };
  }
  function table(head, rows, raw) {
    if (!rows.length) return '<p class="note">Chưa có dữ liệu.</p>';
    return `<div class="wrap"><table><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${raw ? c : esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  async function badge() { try { const a = await call('adminAlerts'); const n = a.filter(x => !x.read).length; $('#n-alert').textContent = n ? `(${n})` : ''; } catch {} }
  setInterval(() => { if (!$('#app').hidden) badge(); }, 60e3);
  addEventListener('vi-change', () => { if (!$('#app').hidden) badge(); });
})();
