/* Sao lưu Firestore hằng ngày vào Cloud Storage (gs://BACKUP_BUCKET/firestore/<ngày>).
   Khôi phục: gcloud firestore import gs://BACKUP_BUCKET/firestore/<ngày>  (xem docs/van-hanh.md). */
const { v1 } = require('@google-cloud/firestore');
const { alert } = require('./core');

async function run(bucket) {
  if (!bucket) return;
  const client = new v1.FirestoreAdminClient();
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const name = client.databasePath(project, '(default)');
  const day = new Date().toISOString().slice(0, 10);
  try {
    await client.exportDocuments({ name, outputUriPrefix: `gs://${bucket}/firestore/${day}`, collectionIds: [] });
  } catch (e) {
    await alert('webhook_error', `Sao lưu Firestore ngày ${day} lỗi: ${e.message}`);
    throw e;
  }
}
module.exports = { run };
