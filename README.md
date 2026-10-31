# 🏰 ROBOTWAR: QUIZ ARENA (Đại Chiến Trí Tuệ: Người vs Robot)

Game chiến đấu đối kháng Top-Down 2 Phe thời gian thực, tích hợp câu hỏi trắc nghiệm, tạo mã QR quét tham gia bằng điện thoại di động, bản đồ Kingdom Arena tràn màn hình và thiết kế theo phong cách **Claymorphism + Vibrant & Block-based (UI/UX ProMax)**.

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY NHANH

Máy chủ chạy bằng Node.js và Socket.IO:
- **Trang chủ**: [http://localhost:3001](http://localhost:3001)
- **Màn hình Host (Máy chiếu / Màn hình chính)**: [http://localhost:3001/host](http://localhost:3001/host)
- **Màn hình Người chơi (Mobile)**: [http://localhost:3001/join](http://localhost:3001/join)
- **Trang Quản trị Câu hỏi (Admin)**: [http://localhost:3001/admin](http://localhost:3001/admin)

Khởi động thủ công:
```bash
npm install
npm start
```

---

## 🎮 TÍNH NĂNG NỔI BẬT (UI/UX PROMAX)

### 1. Bản Đồ Kingdom Arena (1024 x 682 px)
- Bản đồ đồ họa cartoon fantasy sắc nét tràn toàn màn hình (**Edge-to-Edge**), tự động scale theo mọi kích thước màn hình máy chiếu hoặc laptop.
- Giới hạn tối đa **20 người chơi (10 vs 10)**:
  - **Phe Người (West Bastion)**: 10 chiến binh dàn trận dọc đại lộ phía Tây.
  - **Phe Robot (East Outpost)**: 10 robot dàn trận quanh tiền đồn phía Đông.
- **Lâu Đài Trung Tâm (Castle Beacon)**: Điểm tranh chấp tâm điểm giữa bản đồ. Khi một phe chiếm cứ điểm, Lâu Đài sẽ kích hoạt **Chùm Pháo Quỹ Đạo (Orbital Artillery Beam)** nã thẳng sang căn cứ đối phương, làm rung chuyển màn hình và trừ lượng lớn máu căn cứ.

### 2. Thiết Kế Claymorphism + Vibrant & Block-Based
- Thẻ giao diện và nút bấm dạng khối 3D phồng mềm mại với hiệu ứng viền bóng kép.
- Nút bấm có chân đế dày 5px, khi nhấn chuột / chạm lún sâu 4px vật lý.
- 4 nút đáp án trắc nghiệm trên điện thoại dạng khối kẹo rực rỡ (Crimson Red ▲, Blue ◆, Gold ●, Emerald Green ■).

### 3. Âm Thanh Tổng Hợp Thuần (Web Audio API Synthesizer)
- Tích hợp bộ tạo âm thanh thời gian thực không cần tải bất kỳ tệp MP3 ngoài nào:
  - Âm pop xúc giác khi chạm nút.
  - Nhịp đếm ngược đồng hồ và chuông báo khẩn cấp khi $\le 5$ giây.
  - Tiếng đạn súng trường, đạn laser, tên lửa RPG xé gió và tiếng nổ trầm rung chấn.
  - Chuông thăng hoa khi trả lời đúng và tiếng thịch khi trả lời sai.
  - Hồi còi báo động quân sự khi Lâu Đài bị chiếm đóng.
  - Nhạc kèn đồng vinh danh chiến thắng cùng pháo hoa Confetti.
  - Nút bật/tắt âm thanh (`🔊 / 🔇`) trên cả Host lẫn Mobile, lưu trạng thái vào `localStorage`.

### 4. Nâng Cấp Tương Tác Xúc Giác & Thời Gian Thực
- **Thanh máu Ghost HP đối kháng**: Thanh máu chính rút ngay, vệt máu vàng mờ trễ nhịp 0.38s tạo cảm giác đánh nặng tay.
- **Bảng Battle Feed Ticker**: Góc màn hình Host hiển thị tên người chơi bắn trúng và mức sát thương.
- **Huy hiệu phản xạ trên Mobile**: Tự động đánh giá tốc độ trả lời (`⚡ TIA CHỚP!` dưới 3.5s được thưởng điểm, `🎯 XẠ THỦ CỪ KHÔI!`).
- **Phản hồi rung Haptic**: Rung đa tầng khi bấm, trả lời đúng, sai và chiếm thành.
- **Nút Sao Chép Link 1-chạm**: Kèm thông báo Toast kẹo ngọt nổi lên tức thì.
