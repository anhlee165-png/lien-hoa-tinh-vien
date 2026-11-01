# Liên Hoa Tịnh Viện – chùa online

Trang web tĩnh mô phỏng **Chánh điện Liên Hoa Tịnh Viện** (V16 · Cửa chính · Sân chùa · Tranh Phật).

## Tính năng
- **Ảnh gốc sống động**: giữ nguyên đồ họa ảnh mẫu; 18 phật tử được tách khỏi ảnh và cử động tại chỗ (thở, đung đưa, thỉnh thoảng cúi đầu). Bấm Lạy Phật thì cả chánh điện lạy theo Bạn, Niệm Phật thì mọi người gật theo tiếng mõ.
- Chánh điện với tranh Phật hai bên tường, cửa chính nhìn ra sân chùa, đèn lồng lung linh, khói hương bay.
- Thanh trên: chọn **Chánh điện 1–20**, số người **37/100**, **Ví**, **Công đức**, **chuông** thông báo.
- **Điểm nhìn nhanh**: Toàn cảnh, Góc Phật, Tường trái, Tường phải, Cửa chính.
- **Joystick** (hoặc phím mũi tên / WASD) để đi lại, tiến vào, lùi ra.
- Hành động: Chắp tay, Cúi chào, Lạy Phật, Niệm Phật, Thiền, Nghe kinh, Chuỗi hạt (108), Thắp hương, Ra ngoài sân chùa.
- Menu trái: Phòng, Điện, Ví, Đức (cúng dường), Sổ tu tập. Âm lượng + cài đặt.
- Âm thanh chuông, mõ, tiếng kinh tạo bằng Web Audio (không cần file âm thanh).
- Công đức, ví, chuỗi hạt, sổ tu tập được lưu trong trình duyệt.

## Chạy
Mở `index.html`, hoặc bật **GitHub Pages** (Settings → Pages → Deploy from branch `main`, thư mục `/`).

## Cách làm người cử động
`nguoi.js` vẽ lên canvas: nền `assets/song/nen.jpg` (ảnh đã xoá người), từng người `assets/song/*.png` (cắt từ ảnh gốc), rồi lớp bàn thờ phía trước `assets/song/truoc.png`. Khi cúi, đầu giữ nguyên nét vẽ và hạ xuống, phần thân co lại quanh hông.
