# Liên Hoa Tịnh Viện – Bảo mật, ví xu và nạp xu tự động

## 1. Kiến trúc

```
Trình duyệt (GitHub Pages)                         Firebase (asia-southeast1)
 index.html, chua.js, app.js  ── đăng nhập ──▶  Authentication (Gmail, Facebook)
 vi.js  ── đọc số dư của mình ───────────────▶  Firestore (wallets/<uid>, chỉ đọc)
        ── gọi hàm (ID token) ───────────────▶  Cloud Functions ──▶ Firestore (ghi)
 quan-tri.html ── hàm quản trị (claim admin) ─▶  Cloud Functions
 presence.js ── hiện diện ───────────────────▶  Realtime Database (presence/<uid>)
createTopup ── tạo link thanh toán (ký HMAC) ─▶  payOS API ─▶ QR của đơn
Ngân hàng ─▶ payOS ── webhook ký HMAC-SHA256 ─▶  payosWebhook (Cloud Functions, mặc định)
Ngân hàng ─▶ Casso ── webhook V2 ký HMAC-SHA512 ▶  cassoWebhook (dự phòng)
Ngân hàng ─▶ SePay ── webhook ký HMAC-SHA256 ▶  sepayWebhook (dự phòng)
```

Web chỉ hiển thị. Mọi việc đụng tới xu, giá, đơn, quyền đều chạy ở Cloud Functions bằng Admin SDK.
Firestore Rules chặn mọi lệnh ghi từ trình duyệt.

| Module (functions/src) | Việc |
|---|---|
| `auth-service.js` (AuthService) | Xác thực người gọi, kiểm khoá tài khoản, quyền admin/owner bằng custom claims, đòi đăng nhập lại cho thao tác nhạy cảm |
| `wallet-service.js` (WalletService) | Số dư, sổ cái chỉ-thêm, tiêu xu chống trừ hai lần (opId), hoàn xu, điều chỉnh tay |
| `payment-service.js` (PaymentService) | Gói xu phía máy chủ, tạo đơn (mã LHTV + 8 ký tự ngẫu nhiên), hết hạn 30 phút, giới hạn tần suất |
| `providers/payos.js` (PaymentProviderAdapter, mặc định) | Tạo link thanh toán payOS cho từng đơn (orderCode số ngẫu nhiên, bảng `payos_links` trỏ về đơn), kiểm chữ ký phản hồi và webhook (HMAC-SHA256, data sắp key) |
| `providers/casso.js` (PaymentProviderAdapter, dự phòng) | QR VietQR động (img.vietqr.io), xác thực `X-Casso-Signature` (HMAC-SHA512 trên body đã sắp xếp key), chuẩn hoá payload Webhook V2 |
| `providers/sepay.js` (PaymentProviderAdapter, dự phòng) | QR SePay, xác thực HMAC-SHA256. Đổi cổng ở Quản trị › Tài khoản nhận tiền |
| `webhook-handler.js` (WebhookHandler) | Xác thực, ghép đơn, kiểm 7 điều kiện, cộng xu trong 1 transaction, đưa sai lệch vào đối soát |
| `admin-service.js` (AdminService) | Thống kê doanh thu, người dùng, khoá/mở, gói & giá, tài khoản nhận tiền, đối soát, xuất CSV |
| `notification-service.js` (NotificationService) | Chuyển cảnh báo ra ngoài (n8n/Zalo/email) qua URL bí mật, chỉ để báo tin |
| `core.js` → `audit()` (AuditService) | Nhật ký kiểm toán chỉ-thêm (collection `audit`), cảnh báo (`alerts`) |
| `backup.js` | Sao lưu Firestore hằng ngày ra Cloud Storage |

## 2. Dữ liệu (Firestore)

| Collection | Ai đọc | Ai ghi | Nội dung |
|---|---|---|---|
| `wallets/<uid>` | chính chủ | máy chủ | `balance` |
| `users/<uid>` | chính chủ | máy chủ | email, biệt danh, giới tính, khoá |
| `orders/<mã đơn>` | chính chủ | máy chủ | uid, gói, vnd, xu, mã, hạn, trạng thái PENDING/PAID/EXPIRED/CANCELLED/REVIEW |
| `ledger/<id>` | chính chủ | máy chủ | TOPUP, TOPUP_MANUAL, SPEND, REFUND, ADJUST; xu ±, số dư sau, ai làm |
| `bank_tx/<provider_txId>` | máy chủ | máy chủ | dấu “giao dịch ngân hàng đã dùng” (chống cộng trùng) |
| `reconcile/<provider_txId>` | máy chủ | máy chủ | giao dịch cần đối soát + lý do |
| `ops/*` | máy chủ | máy chủ | khoá idempotency cho tiêu xu / điều chỉnh |
| `config/packs`, `config/prices` | mọi người | máy chủ | gói nạp, giá dịch vụ |
| `config/payment`, `config/owner` | máy chủ | máy chủ | tài khoản nhận tiền, UID chủ chùa |
| `audit`, `alerts`, `ratelimits` | máy chủ (alerts: admin) | máy chủ | nhật ký, cảnh báo, giới hạn tần suất |

Xu cũ trong localStorage KHÔNG được chuyển thành số dư thật.

## 3. Luồng nạp xu

1. Khách đăng nhập (Gmail/Facebook) → `hello` tạo hồ sơ + ví 0 xu.
2. Chọn gói → `createTopup(packId)`; máy chủ lấy giá từ `config/packs` (bỏ qua số trình duyệt gửi), tạo đơn `LHTVxxxxxxxx`, hạn 30 phút, trả QR VietQR có đúng tài khoản, số tiền, nội dung.
3. Khách chuyển khoản. payOS gửi webhook → `payosWebhook` (hoặc Casso → `cassoWebhook`, SePay → `sepayWebhook`). Với payOS, đơn được ghép bằng orderCode của link:
   - chữ ký HMAC hợp lệ, lệch giờ ≤ 5 phút (sai → 401, ghi log, cảnh báo nếu lặp lại);
   - tiền VÀO, đúng tài khoản cấu hình, VND;
   - nội dung chứa mã đơn tồn tại, đơn còn PENDING và chưa hết hạn;
   - số tiền đúng bằng giá đơn;
   - mã giao dịch của cổng (Casso/SePay) chưa từng dùng.
4. Đủ điều kiện → trong MỘT transaction: đánh dấu giao dịch đã dùng, đơn → PAID, cộng xu, ghi sổ cái, cảnh báo “nạp thành công”. Web đang mở (mọi thiết bị) thấy số dư đổi ngay, hiện “Nạp xu thành công +N xu”.
5. Sai bất kỳ điều kiện → KHÔNG cộng; vào `reconcile` với lý do; chủ chùa xử lý ở trang Quản trị › Đối soát (cộng xu cho UID cụ thể kèm lý do, hoặc đóng). Mỗi giao dịch chỉ xử lý được một lần.

### Ngoại lệ

| Tình huống | Xử lý |
|---|---|
| Chuyển thiếu / thừa | `UNDERPAID` / `OVERPAID` → đối soát, đơn → REVIEW |
| Sai / thiếu nội dung | `NO_ORDER_CODE` / `ORDER_NOT_FOUND` → đối soát (tiền chưa ghép được) |
| Hai khách nạp cùng lúc | Mỗi đơn mã riêng, transaction riêng; không ảnh hưởng nhau |
| Khách đóng web khi đang trả | Webhook vẫn cộng xu; lần sau mở web thấy số dư |
| Webhook trùng (2, 5, 10 lần) | `bank_tx` đã có → trả 200, không cộng nữa (đã kiểm thử 10 lần song song) |
| Webhook đến chậm | Đơn còn hạn → cộng; quá hạn → `LATE_PAYMENT` đối soát |
| Webhook không đến | Đơn hết hạn sau 30 phút; tiền vẫn ở ngân hàng → đối chiếu sao kê trên Casso, cộng tay ở Đối soát |
| Đăng nhập máy khác | Số dư lưu theo UID trên máy chủ, mọi máy thấy như nhau |
| Hoàn tiền / tranh chấp (tiền ra) | `OUTGOING_FOR_ORDER` → đối soát; chủ chùa trừ xu bằng Điều chỉnh (không âm) |
| Mất kết nối DB giữa chừng | Transaction không ghi gì; trả 500 để cổng thanh toán gửi lại; xử lý idempotent |
| Trả lần hai cho đơn đã PAID | `ORDER_ALREADY_PAID` → đối soát |

## 4. Quyền quản trị

- Quyền = custom claims `admin: true, owner: true` do `scripts/set-owner.js` cấp phía máy chủ, chỉ cho tài khoản Google đã xác minh email. UID lưu ở `config/owner`.
- Mọi hàm `admin*` gọi `requireAdmin`; đổi gói/giá cần đăng nhập trong 15 phút, đổi tài khoản nhận tiền cần đăng nhập trong 5 phút.
- Gọi hàm quản trị không có quyền → ghi `audit` + cảnh báo khi lặp lại ≥5 lần/10 phút.
- Đổi tài khoản nhận tiền → nạp xu tự đóng; chủ chùa chuyển thử khoản nhỏ với nội dung `LHTVXM……` vào tài khoản mới; webhook khớp thì mới mở lại. Không thể đổi bằng ảnh QR.
- Khoá tài khoản: vô hiệu hoá Firebase Auth + thu hồi phiên + chặn mọi hàm.

## 5. Bảo vệ khác

- Không có bí mật trong mã nguồn web. `apiKey` Firebase là định danh công khai (an toàn khi Rules đúng). Khoá payOS / Casso / SePay nằm trong Secret Manager (`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `CASSO_WEBHOOK_SECRET`, `SEPAY_WEBHOOK_SECRET`).
- App Check: điền khoá reCAPTCHA v3 vào `APP_CHECK_SITE_KEY` (auth.js), rồi đặt `ENFORCE_APP_CHECK=true` trong `functions/.env` và triển khai lại.
- Giới hạn tần suất: tạo đơn 10/giờ, tối đa 3 đơn chờ; tiêu xu 30/phút; webhook sai chữ ký cảnh báo.
- XSS: biệt danh chặn `< > & " ' \``; trang quản trị escape mọi dữ liệu; CSV chống công thức Excel (`=`, `+`, `-`, `@`); trang quản trị có Content-Security-Policy.
- Sao lưu: đặt `BACKUP_BUCKET` trong `functions/.env`, cấp quyền `roles/datastore.importExportAdmin` + ghi bucket cho service account của Functions. Khôi phục: `gcloud firestore import gs://<bucket>/firestore/<ngày>`.

## 6. Kiểm thử

`bash scripts/test-backend.sh` (cần Java + firebase-tools). Chạy trên Emulator, không đụng dữ liệu thật. 12 nhóm kiểm thử, kết quả lần chạy gần nhất: 12/12 đạt.

1. A nạp → chỉ ví A tăng; 2. B không nhận; giá trình duyệt gửi bị bỏ qua
3. Đúng tiền sai mã → không cộng, vào đối soát
4. Webhook gửi 10 lần song song → cộng đúng 1 lần, 1 dòng sổ cái
5. Ghi thẳng ví/sổ cái/ví người khác qua Firestore REST → 403
6. Khách gọi hàm quản trị / sửa `config/payment` → bị chặn
7. Token mới (máy khác) → đúng số dư
8. Sai chữ ký / quá hạn / thiếu chữ ký → 401, không cộng
9. 6 lệnh thắp hương đồng thời với 60 xu → chỉ 1 thành công, còn 10 xu; cùng opId 5 lần → trừ 1 lần; hoàn xu 1 lần
10. Thiếu, thừa, trễ hạn, sai tài khoản → không cộng, đúng lý do; đối soát cộng tay cần lý do, không cộng được lần 2

Thêm: đổi gói chỉ áp dụng đơn mới; đổi tài khoản → đóng nạp tới khi xác minh; điều chỉnh tay idempotent; đổi biệt danh 20 xu trong 24 giờ, chặn tên giả nhà chùa và ký tự HTML.

Chữ ký payOS khớp ví dụ trong tài liệu payOS; chữ ký Casso khớp mẫu github.com/CassoHQ/casso-webhook-v2-verify-signature. API payOS được giả lập trong kiểm thử. Chưa kiểm thử với payOS và ngân hàng thật: cần làm sau khi triển khai (mục 7).

## 7. Việc chủ chùa cần làm để chạy thật

1. Firebase Console › nâng gói **Blaze** (trả theo dùng; Cloud Functions bắt buộc Blaze; lưu lượng nhỏ thường nằm trong hạn mức miễn phí). Đặt cảnh báo ngân sách (vd. 50.000đ/tháng).
2. Firebase Console › Build › **Firestore Database** › Create (vùng `asia-southeast1`, chế độ production).
3. Firebase Console › Build › **Realtime Database** › Create (Singapore).
4. **payOS** (my.payos.vn) › Kênh thanh toán (đã liên kết MB) › mở kênh:
   - Lấy **Client ID**, **Api Key**, **Checksum Key** (không gửi qua chat công khai).
   - Ô **Webhook URL**: `https://asia-southeast1-lien-hoa-tinh-vien.cloudfunctions.net/payosWebhook` (điền SAU bước 7, khi hàm đã triển khai, vì payOS gọi thử ngay lúc lưu).
   (Dự phòng: Casso Webhook V2 → `.../cassoWebhook` + `CASSO_WEBHOOK_SECRET`; SePay → `.../sepayWebhook` + `SEPAY_WEBHOOK_SECRET`.)
5. Google Cloud Console › IAM › Service Accounts › tạo khoá JSON cho tài khoản có quyền Firebase Admin + Cloud Functions Admin + Secret Manager Admin + Service Account User.
6. GitHub repo › Settings › Secrets and variables › Actions › thêm:
   - `FIREBASE_SERVICE_ACCOUNT` = nội dung file JSON ở bước 5
   - `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` = 3 khoá ở bước 4
   - (tuỳ chọn) `NOTIFY_WEBHOOK_URL` = URL n8n/Zalo nhận cảnh báo
7. GitHub › Actions › “Firebase backend” › Run workflow, ô `owner_email` = Gmail chủ chùa → triển khai + cấp quyền chủ chùa. Đăng xuất, đăng nhập lại.
8. Trang Quản trị (`/quan-tri.html`) › Tài khoản nhận tiền › chọn **payOS**, ngân hàng `MB`, số tài khoản `98616059699999`, tên `LE DUC ANH` › quét QR 2.000đ hiện ra (link payOS) và chuyển. payOS báo có → nạp xu tự mở.
9. Nạp thử gói nhỏ nhất bằng tài khoản Gmail khác; kiểm tra xu, sổ cái, Dashboard.
