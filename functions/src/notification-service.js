/* NotificationService: chuyển cảnh báo cho quản trị ra ngoài (n8n, Zalo bot, email…) qua một URL bí mật.
   Chỉ để báo tin; không bao giờ là nơi quyết định cộng xu. Bỏ qua nếu chưa cấu hình. */
async function forward(a, url) {
  if (!a || !url || !/^https:\/\//.test(url)) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: a.kind, msg: a.msg, at: a.at && a.at.toMillis ? a.at.toMillis() : Date.now() }), signal: AbortSignal.timeout(5000) });
  } catch { /* cảnh báo vẫn nằm trong Dashboard */ }
}
module.exports = { forward };
