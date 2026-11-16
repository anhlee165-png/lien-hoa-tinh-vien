// Cầu nối TikTok LIVE → web chùa (chạy trên máy tính đang phát live).
// Nghe quà / theo dõi THẬT trong phiên live của kênh, rồi phát lại cho trang ?live=… qua ws://localhost:21213
// (cùng cổng và cùng dạng tin với TikFinity, nên dùng TikFinity hay cầu nối này đều được — chỉ chạy MỘT trong hai).
//   Cách chạy:  npm install   rồi   node index.js ten_kenh_tiktok      (Windows: bấm đúp chay.bat)
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const user = (process.argv[2] || process.env.TIKTOK_USER || '').replace(/^@/, '').trim();
const PORT = +(process.env.PORT || 21213);
if (!user) { console.error('Thiếu tên kênh. Ví dụ: node index.js lienhoatinhvien'); process.exit(1); }

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
const send = (event, data) => { const s = JSON.stringify({ event, data }); wss.clients.forEach(c => c.readyState === 1 && c.send(s)); };
wss.on('connection', () => console.log('· Web chùa đã nối vào cầu nối'));
console.log(`Cầu nối chạy ở ws://localhost:${PORT} — mở trang chùa ?live=doc (hoặc ?live=ngang)`);

const who = d => ({ uniqueId: d.user?.uniqueId || '', nickname: d.user?.nickname || d.user?.uniqueId || '' });
let wait = 5000;
async function start() {
  const conn = new TikTokLiveConnection(user, { enableExtendedGiftInfo: true });
  conn.on(WebcastEvent.GIFT, d => {
    const g = d.giftDetails || {}, ex = d.extendedGiftInfo || {};
    const data = Object.assign(who(d), {
      giftId: d.giftId, giftName: g.giftName || ex.name || 'quà', giftType: g.giftType,
      diamondCount: g.diamondCount ?? ex.diamond_count ?? 0, repeatCount: d.repeatCount || 1, repeatEnd: !!d.repeatEnd
    });
    if (!(data.giftType === 1 && !data.repeatEnd)) console.log(`🎁 ${data.nickname}: ${data.repeatCount} × ${data.giftName}`);
    send('gift', data);
  });
  conn.on(WebcastEvent.FOLLOW, d => { console.log(`➕ ${who(d).nickname} theo dõi`); send('follow', who(d)); });
  conn.on(ControlEvent.DISCONNECTED, () => { console.log('Mất kết nối TikTok, thử lại sau 10 giây…'); setTimeout(start, 10000); });
  try { const s = await conn.connect(); wait = 5000; console.log(`✔ Đã vào phòng live của @${user} (room ${s.roomId})`); }
  catch (e) { console.log(`Chưa vào được live của @${user} (${e.message || e}). Thử lại sau ${wait / 1000} giây…`); setTimeout(start, wait); wait = Math.min(wait * 2, 60000); }
}
start();
