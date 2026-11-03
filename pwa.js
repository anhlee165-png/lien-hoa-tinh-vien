/* Ứng dụng PWA (không bắt buộc): đăng ký Service Worker, giữ lời mời cài của trình duyệt để CHỈ dùng khi đạo hữu
   bấm nút "Tải App", báo khi có bản cập nhật. Không tự bật hộp thoại, không chuyển trang, không khoá chức năng nào.
   window.PWA = { standalone(), installed(), canPrompt(), prompt(), platform() } */
(() => {
  let deferred = null, installed = false;
  const ua = navigator.userAgent || '';
  const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;

  // trình duyệt và thiết bị → chọn đúng lời hướng dẫn
  function platform() {
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    const browser = /EdgiOS|EdgA|Edg\//.test(ua) ? 'edge' : /CriOS/.test(ua) ? 'chrome' : /FxiOS|Firefox/.test(ua) ? 'firefox'
      : /SamsungBrowser/.test(ua) ? 'samsung' : /OPR|Opera|OPiOS/.test(ua) ? 'opera' : /FBAN|FBAV|Instagram|Zalo|TikTok|musical_ly|Line\//i.test(ua) ? 'inapp'
      : /Chrome/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other';
    return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser };
  }

  // Chrome/Edge/Samsung: giữ lời mời lại (preventDefault = không hiện thanh mời tự động), chỉ dùng khi bấm nút
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; dispatchEvent(new CustomEvent('pwa-change')); });
  addEventListener('appinstalled', () => { installed = true; deferred = null; dispatchEvent(new CustomEvent('pwa-change')); });

  async function prompt() {
    if (!deferred) return 'unavailable';
    const e = deferred; deferred = null;
    try { await e.prompt(); const c = await e.userChoice; if (c && c.outcome === 'accepted') installed = true; dispatchEvent(new CustomEvent('pwa-change')); return c ? c.outcome : 'dismissed'; }
    catch { return 'unavailable'; }
  }

  /* ---- cập nhật: bản Service Worker mới chờ sẵn, đạo hữu bấm "Cập nhật" mới tải lại ---- */
  let reloading = false, asked = false;
  function offerUpdate(reg) {
    if (!reg.waiting || document.getElementById('pwa-update')) return;
    const bar = document.createElement('div'); bar.id = 'pwa-update';
    bar.innerHTML = '<span>Đã có bản cập nhật</span><button type="button" data-u="go">Cập nhật</button><button type="button" data-u="later" aria-label="Để sau">✕</button>';
    bar.addEventListener('click', ev => {
      const k = ev.target.dataset && ev.target.dataset.u; if (!k) return;
      if (k === 'go' && reg.waiting) { asked = true; reg.waiting.postMessage('skip-waiting'); }
      bar.remove();
    });
    document.body.appendChild(bar);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (asked && !reloading) { reloading = true; location.reload(); } });
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing; if (!w) return;
          w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(reg); });
        });
        // dò bản mới mỗi giờ (nhẹ: chỉ tải lại sw.js)
        setInterval(() => reg.update().catch(() => {}), 36e5);
      }).catch(() => {});
    });
  }

  if (standalone()) document.documentElement.classList.add('is-app');
  window.PWA = { standalone, installed: () => installed || standalone(), canPrompt: () => !!deferred, prompt, platform };
})();
