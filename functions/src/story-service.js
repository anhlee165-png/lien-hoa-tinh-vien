/* Tâm sự kín: khách đăng tâm sự / câu chuyện; người khác và nhà chùa trả lời bên dưới (khung chat con của từng tâm sự).
   Chỉ ghi qua máy chủ: cần đăng nhập, giới hạn độ dài và tần suất; tên hiển thị lấy từ hồ sơ máy chủ (hoặc "Ẩn danh"),
   không tin tên do trình duyệt gửi. Trình duyệt chỉ được đọc (Firestore Rules). */
const { db, now, fail, rateLimit, audit, FieldValue } = require('./core');

const clean = (s, min, max) => {
  const t = String(s || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\n{4,}/g, '\n\n\n').trim();
  if (t.length < min) fail('invalid-argument', `Nội dung cần ít nhất ${min} chữ`);
  if (t.length > max) fail('invalid-argument', `Nội dung tối đa ${max} chữ`);
  return t;
};
async function author(uid, isAdmin, anon) {
  if (isAdmin) return { name: 'Nhà chùa', admin: true };
  if (anon) return { name: 'Ẩn danh', admin: false };
  const u = (await db.collection('users').doc(uid).get()).data() || {};
  return { name: u.nick || 'Phật tử', admin: false };
}

async function post(uid, isAdmin, { text, anon }) {
  await rateLimit('story_' + uid, 5, 3600);
  text = clean(text, 5, 2000);
  const a = await author(uid, isAdmin, !!anon), ref = db.collection('stories').doc();
  await ref.set({ uid, name: a.name, admin: a.admin, text, replies: 0, at: now(), lastAt: now() });
  return { id: ref.id };
}

async function reply(uid, isAdmin, { id, text, anon }) {
  await rateLimit('reply_' + uid, 30, 3600);
  text = clean(text, 1, 1000);
  const sref = db.collection('stories').doc(String(id || ''));
  const a = await author(uid, isAdmin, !!anon);
  return db.runTransaction(async tx => {
    const s = await tx.get(sref);
    if (!s.exists) fail('not-found', 'Tâm sự này không còn');
    const r = sref.collection('replies').doc();
    tx.set(r, { uid, name: a.name, admin: a.admin, text, at: now() });
    tx.update(sref, { replies: FieldValue.increment(1), lastAt: now() });
    return { id: r.id };
  });
}

// Nhà chùa gỡ một tâm sự (kèm các trả lời) hoặc một trả lời không phù hợp
async function remove(actor, { id, rid }) {
  const sref = db.collection('stories').doc(String(id || ''));
  if (rid) {
    const r = sref.collection('replies').doc(String(rid));
    const s = await r.get(); if (!s.exists) fail('not-found', 'Không còn');
    await r.delete(); await sref.update({ replies: FieldValue.increment(-1) }).catch(() => {});
  } else {
    const s = await sref.get(); if (!s.exists) fail('not-found', 'Không còn');
    await db.recursiveDelete(sref);
  }
  await audit(actor, 'story_remove', { id: String(id || ''), rid: rid ? String(rid) : null });
  return { ok: true };
}

module.exports = { post, reply, remove };
