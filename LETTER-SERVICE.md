# Tâm gửi — Dịch vụ thư điện tử

> Tài liệu này mô tả phiên bản thư tĩnh cũ. Hệ thống đơn hàng và quản trị mới dùng máy chủ Node; xem [ORDER-SYSTEM.md](ORDER-SYSTEM.md). Firebase Hosting tĩnh không phục vụ API mới.

Ứng dụng SPA độc lập ở `index.html`. Dự án này chỉ chứa dịch vụ thiết kế thư; dự án 20/10 trước đó được giữ riêng ở thư mục cũ.

## Chạy và đóng gói

```sh
npm install
npm run build:assets
npm run dev
```

Mở http://localhost:3000. Trên PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`.

`npm run build:hosting` tạo thư mục `public` cho Firebase project riêng `tam-gui-wedthietkethu`. Link tạo tại localhost chỉ dùng để thử trên thiết bị đang chạy; dùng https://tam-gui-wedthietkethu.web.app để tạo link gửi cho người khác.

## Tính năng

- Trang giới thiệu, lọc bốn bộ sưu tập, dùng mẫu và xem thử, hai gói dịch vụ.
- Studio responsive, tab trên mobile, cập nhật trực tiếp và tự lưu bản nháp vào localStorage.
- Bốn bảng màu, ba kiểu phong bì, màu sáp, ba font tiếng Việt, năm hiệu ứng Canvas, ba tốc độ chữ.
- Music box bằng Web Audio; hỗ trợ URL HTTPS trực tiếp đến ảnh và tệp nhạc. Link YouTube/Spotify không phải link âm thanh trực tiếp. Ảnh hoặc nhạc không tải được có thông báo.
- Mở phong bì 3D, confetti, lá thư có nhiều đoạn, chữ ký, nút hiện ngay nội dung, phát/tắt nhạc và xem lại.
- Tạo link và QR ngay trên trình duyệt; sao chép và mở thử trong tab mới.
- Font, Tailwind, Lucide, canvas-confetti và QR được đóng gói cục bộ. Không cần CDN lúc chạy.

## Cấu hình nhận đơn VIP

Sửa `scripts/letter-config.js`, đặt `contactUrl` thành URL Zalo hoặc Messenger thật của shop. Khi chưa cấu hình, modal vẫn cho soạn và sao chép yêu cầu, nhưng ghi rõ chưa có kênh nhận đơn trực tuyến. Không có thông tin ngân hàng, giao dịch hoặc xác nhận thanh toán giả. Báo giá VIP cần được shop trao đổi riêng; ứng dụng tĩnh không có backend quản lý đơn hay xác thực thanh toán.

## Dữ liệu và giới hạn

Link ngắn dùng đúng định dạng UTF-8 Base64:

```js
btoa(unescape(encodeURIComponent(JSON.stringify(data))))
JSON.parse(decodeURIComponent(escape(atob(encoded))))
```

Base64 chỉ là biểu diễn dữ liệu, không phải nén hoặc mã hóa bảo mật. Với dữ liệu dài và trình duyệt có CompressionStream, ứng dụng nén JSON bằng gzip, mã hóa Base64 và thêm tiền tố `gz.`. Trình đọc nhận cả hai định dạng. URLSearchParams bảo toàn ký tự `+`, `/`, `=`. Dữ liệu sau giải nén được giới hạn kích thước và kiểm tra trường/giá trị; nội dung thư được đưa vào DOM bằng textContent.

Nội dung nằm hoàn toàn trong URL. Bất kỳ ai có link đều đọc được; ảnh/nhạc dùng dịch vụ bên ngoài sẽ được tải từ URL do người gửi cung cấp. Không dùng link này cho nội dung bí mật. Thư quá dài hoặc URL ảnh/nhạc quá dài có thể vượt dung lượng QR; ứng dụng báo rõ và vẫn cho copy link. Nên dùng lời chúc ngắn và link media gọn để QR dễ quét.

Canvas dùng requestAnimationFrame, thời gian delta, giới hạn mật độ hạt và DPR, ResizeObserver; dừng khi tab ẩn hoặc khung ra ngoài màn hình. Chế độ giảm chuyển động tắt hiệu ứng liên tục và hiện chữ ngay. Tốc độ thực tế phụ thuộc thiết bị; không đảm bảo tuyệt đối 60fps trên mọi máy.

## Kiểm tra

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Hoặc đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` đến Chrome cài sẵn. Bộ kiểm tra ở `tests/letter.browser.test.mjs` kiểm tra desktop/mobile, tiếng Việt và emoji, nội dung HTML an toàn, QR, link nén, replay, bản nháp và link sai. Ảnh kiểm tra lưu vào `test-results/`.
