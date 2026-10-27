# Robot thật và cấu hình mạng

Map Studio có hai chế độ: Robot thật (mặc định) và Mô phỏng. Robot thật dùng bản mapping.html đối chiếu từ BE runtime ngày 2026-10-27, gồm quét/lưu map, tự quét, recovery, endpoint, phiên navigation, khởi tạo AMCL, đường Nav2, workflow MOVE và phát loa. Không lấy vị trí hoặc đường đi từ dữ liệu mô phỏng.

## Chạy trên laptop đang chạy BE

.env.local (không commit):

```dotenv
VITE_API_BASE_URL=
VITE_DEV_PROXY_TARGET=http://127.0.0.1:8080
VITE_ROBOT_CAMERA_URL=http://10.3.90.50:8080/stream?topic=/ascamera/camera_publisher/rgb0/image&type=mjpeg&width=640&height=480&quality=60
```

Chạy `npm run dev`, đăng nhập ADMIN thật, mở Map Studio → Robot thật. Khởi động lại Vite sau khi đổi .env.local. BE proxy dùng loopback vì FE và BE chạy trên cùng laptop; không cần thay IP BE mỗi lần đổi Wi-Fi. Pi camera cần cập nhật theo IP hiện tại. Cấu hình này không đổi URL upload/TTS/CA của worker Pi.

## Deploy

VITE_DEV_PROXY_TARGET chỉ có tác dụng với Vite dev. Production phải reverse proxy /api tới BE, hoặc build với VITE_API_BASE_URL=https://domain-be và cấu hình CORS trên BE. Không dùng localhost làm địa chỉ BE cho người dùng từ máy khác.

Camera 8080 là MJPEG từ Pi, không đi qua BE/MQTT. FE HTTPS cần camera HTTPS qua gateway/VPN có xác thực; không tự động mở camera HTTP qua Internet. Ảnh MQTT vẫn là ảnh chụp chậm, không phải video mượt. Không đưa token BE vào URL camera.

## Cách đồng bộ

public/robot-console/mapping.html và bốn template workflow là bản chụp từ BE; RobotConsole.jsx nhúng trang và chuyển các request /api/v1 qua apiRequest của FE, dùng token/refresh hiện tại. Không truyền token thật qua query string hoặc lưu trong HTML. Chỉ ADMIN thật được gọi bridge. API lỗi và HTTP status được giữ để trang xử lý đúng. Khi đổi màn hình, pagehide dừng gia hạn điều khiển.

Khi BE thay hợp đồng, đồng bộ lại các file này từ src/main/resources/static và chạy build + tests/robot-console.browser.mjs. Không tự tải HTML/script từ máy chủ tùy ý. Đây là giao diện BE được nhúng, chưa chuyển toàn bộ thành component React riêng.

Các mục mô phỏng/RobotControlScreens khác chưa được xác nhận là điều khiển thật. Dùng Map Studio → Robot thật cho luồng robot. Việc kiểm tra trình duyệt dùng API giả lập, không xác nhận AMCL/Nav2/phần cứng và không gửi MOVE thật.
