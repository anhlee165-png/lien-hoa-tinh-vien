# Liên Hoa Tịnh Viện – chùa online

Chánh điện 3D **Liên Hoa Tịnh Viện** (V16 · Cửa chính · Sân chùa · Tranh Phật), chạy bằng Three.js ngay trên trình duyệt.

## Tính năng
- Chánh điện 3D: 10 bức tranh Phật hai bên tường (cắt từ ảnh mẫu), cửa chính nhìn ra sân chùa, đèn lồng lung linh, tượng Phật, bát hương có khói bay.
- Phật tử chibi tự đi lại: đứng dậy, đi xem tranh, ra cửa, lạy Phật rồi về chỗ ngồi; có người vào, người ra theo số người online.
- Bạn đi lại bằng joystick hoặc phím mũi tên / WASD; camera đi theo sau.
- Ra ngoài: đi bộ ra cửa chính, ra sân chùa có đỉnh hương lớn, cổng tam quan, hồ sen.
- Thanh trên: chọn **Chánh điện 1–20**, số người **37/100**, **Ví**, **Công đức**, **chuông** thông báo.
- **Điểm nhìn nhanh**: Toàn cảnh, Góc Phật, Tường trái, Tường phải, Cửa chính.
- Hành động: Chắp tay, Cúi chào, Lạy Phật, Niệm Phật, Thiền, Nghe kinh, Chuỗi hạt (108), Thắp hương, Ra ngoài sân chùa.
- Menu trái: Phòng, Điện, Ví, Đức (cúng dường), Sổ tu tập. Âm lượng + cài đặt.
- Âm thanh chuông, mõ, tiếng kinh tạo bằng Web Audio (không cần file âm thanh).
- Công đức, ví, chuỗi hạt, sổ tu tập được lưu trong trình duyệt.

## Chạy
Cần chạy qua máy chủ web (ví dụ `python3 -m http.server`, rồi mở http://localhost:8000), hoặc bật **GitHub Pages** (Settings → Pages → Deploy from branch `main`, thư mục `/`).

## Cấu trúc
- `index.html`, `style.css`: giao diện (thanh trên, menu, joystick, thanh hành động).
- `app.js`: điều khiển giao diện, âm thanh, công đức.
- `world.js`: thế giới 3D (chánh điện, nhân vật, camera, sân chùa).
- `vendor/`: Three.js 0.160 (giấy phép MIT).
- `assets/`: tranh Phật, cửa chính, biển hiệu cắt từ ảnh mẫu.
