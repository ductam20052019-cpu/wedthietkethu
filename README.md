# Tâm gửi — Interactive Greeting Letter Studio

Ứng dụng web độc lập để thiết kế và chia sẻ thư chúc mừng với phong bì 3D, hiệu ứng Canvas, nhạc music box và QR.

- **Website:** https://tam-gui-wedthietkethu.web.app
- **Repository:** https://github.com/ductam20052019-cpu/wedthietkethu

## Chạy trên máy

Yêu cầu Node.js 22 trở lên.

```sh
npm ci
npm run dev
```

Mở **http://localhost:3000**. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd`.

## Tính năng

- Landing page, bốn bộ sưu tập và bảng gói dịch vụ.
- Studio responsive: bảng màu, phong bì, dấu sáp, lời chúc nhiều đoạn, chữ ký, font viết tay/serif/hiện đại.
- Live preview, bản nháp lưu trên thiết bị, ảnh kỷ niệm và âm thanh từ URL HTTPS.
- Hiệu ứng tim, hoa, tuyết, confetti, bóng bay, đom đóm; hỗ trợ giảm chuyển động.
- Phong bì mở bằng CSS 3D, chữ xuất hiện dần, Web Audio music box, xem lại và bật/tắt nhạc.
- Link UTF-8 Base64; tự nén gzip cho dữ liệu dài; QR được tạo cục bộ.

## Build và triển khai

```sh
npm run build
firebase login
firebase deploy --only hosting --project tam-gui-wedthietkethu
```

Build tạo `public/`. Project Firebase riêng được xác định trong `.firebaserc`. Website này không dùng mã nguồn, tài nguyên cá nhân hoặc project hosting của ứng dụng 20/10 trước đó.

Tailwind CSS, Lucide, canvas-confetti, QR và font chữ tiếng Việt được đóng gói cục bộ. Khi chỉnh class Tailwind hoặc cập nhật thư viện, chạy `npm run build:assets`.

## Cấu hình shop

Điền URL Zalo/Messenger thật vào `contactUrl` trong `scripts/letter-config.js`, sau đó triển khai lại. Khi chưa có URL, ứng dụng cho sao chép yêu cầu thiết kế nhưng không nhận thanh toán hoặc giả lập đơn đã được xác nhận.

## Kiểm tra

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Có thể đặt biến `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` đến Chrome cài sẵn. Kiểm tra giao diện bao gồm desktop/mobile, tiếng Việt và emoji, QR/link nén, bản nháp, replay, nhạc, typewriter, ảnh lỗi và link sai.

## Lưu ý chia sẻ

Tạo link trên website HTTPS đã triển khai để gửi cho người khác; link localhost chỉ dùng thử trên máy. Nội dung nằm trong URL, ai có link đều có thể đọc. Base64 không phải mã hóa bảo mật. Link ảnh/nhạc phải trỏ trực tiếp đến tệp HTTPS. Nội dung quá dài có thể vượt giới hạn QR; ứng dụng vẫn cho copy link và thông báo cách rút ngắn.

Xem [tài liệu kỹ thuật](LETTER-SERVICE.md) để biết thêm về dữ liệu và hiệu ứng. Giấy phép của thư viện nằm trong `assets/licenses/` và giấy phép font trong `assets/fonts/`.
