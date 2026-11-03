/* Service Worker của Liên Hoa Tịnh Viện (PWA).
   Chỉ làm 2 việc: (1) cho trình duyệt nhận đây là ứng dụng cài được, (2) khi mất mạng thì mở trang "Mất kết nối".
   KHÔNG lưu đệm ảnh chùa, âm thanh, mã nguồn hay bất cứ dữ liệu tài khoản / xu / thanh toán nào:
   mọi yêu cầu khác đi thẳng ra mạng như website bình thường, nên app và web luôn dùng chung dữ liệu máy chủ. */
const VERSION = 'lhtv-2026-11-03-1';
const SHELL = ['/offline.html', '/assets/app/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
  // không skipWaiting ở đây: bản mới chờ tới khi đạo hữu bấm "Cập nhật" (không làm gián đoạn người đang trong điện)
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });

// chỉ xử lý việc mở trang (navigate) trên chính tên miền; trang quản trị không đụng tới
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.mode !== 'navigate' || r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/ad_min165') || url.pathname.startsWith('/__/')) return;
  e.respondWith(fetch(r).catch(async () => (await caches.match('/offline.html')) || Response.error()));
});
