#!/usr/bin/env bash
# Chạy kiểm thử máy chủ trên Firebase Emulator (không đụng dữ liệu thật).
set -e
cd "$(dirname "$0")/.."
printf 'SEPAY_WEBHOOK_SECRET=test-secret-khong-dung-that\nCASSO_WEBHOOK_SECRET=test-secret-khong-dung-that\nPAYOS_CLIENT_ID=test-client\nPAYOS_API_KEY=test-api-key\nPAYOS_CHECKSUM_KEY=test-secret-khong-dung-that\nNOTIFY_WEBHOOK_URL=\n' > functions/.secret.local
# payOS giả lập (chạy trong tiến trình kiểm thử) – chỉ dùng cho Emulator
printf 'PAYOS_BASE_URL=http://127.0.0.1:5098\n' > functions/.env.local
(cd functions && npm ci --no-audit --no-fund >/dev/null 2>&1 || npm i --no-audit --no-fund >/dev/null)
firebase emulators:exec --project demo-lhtv --only auth,firestore,functions "node --test --test-concurrency=1 functions/test/payment.test.js"
