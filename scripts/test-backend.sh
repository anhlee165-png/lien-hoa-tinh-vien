#!/usr/bin/env bash
# Chạy kiểm thử máy chủ trên Firebase Emulator (không đụng dữ liệu thật).
set -e
cd "$(dirname "$0")/.."
printf 'SEPAY_WEBHOOK_SECRET=test-secret-khong-dung-that\nCASSO_WEBHOOK_SECRET=test-secret-khong-dung-that\nNOTIFY_WEBHOOK_URL=\n' > functions/.secret.local
(cd functions && npm ci --no-audit --no-fund >/dev/null 2>&1 || npm i --no-audit --no-fund >/dev/null)
firebase emulators:exec --project demo-lhtv --only auth,firestore,functions "node --test --test-concurrency=1 functions/test/payment.test.js"
