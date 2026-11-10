# Robot thật và cấu hình mạng

Quét và quản lý map nằm tại `/admin/map`, điều phối tại `/workstations`. Các chức năng quét/lưu map, tự quét, recovery, zone, endpoint, phiên navigation, khởi tạo vị trí và tuyến MOVE dùng API BE. Chế độ mô phỏng cục bộ được tách riêng tại Workstations.

## Kết nối máy chủ hiện tại

.env.local (không commit):

```dotenv
VITE_API_BASE_URL=https://mediassistrover.duckdns.org
```

Chạy `npm run dev`, đăng nhập bằng tài khoản trên máy chủ rồi mở Bản đồ hoặc Workstations. Khởi động lại Vite nếu chưa nhận thay đổi `.env.local`. Cấu hình API này áp dụng cả REST, SSE và ảnh map. URL camera Pi cấu hình riêng theo kết nối thực tế; cấu hình này không thay URL upload/TTS/CA của worker Pi.

FE chỉ dùng máy chủ được cấu hình qua `VITE_API_BASE_URL`, mặc định là `https://mediassistrover.duckdns.org`. Không còn bộ chọn API Local/Server. Vite cũng chuyển tiếp các request cùng origin tới máy chủ này khi phát triển. Không thêm `/swagger-ui` vào API base URL.

## Deploy

Build với `VITE_API_BASE_URL=https://domain-be` và cấu hình CORS trên BE. Vite proxy chỉ có tác dụng khi phát triển; production cần reverse proxy nếu có request `/api` cùng origin.

Camera 8080 là MJPEG từ Pi, không đi qua BE/MQTT. FE HTTPS cần camera HTTPS qua gateway/VPN có xác thực; không tự động mở camera HTTP qua Internet. Ảnh MQTT vẫn là ảnh chụp chậm, không phải video mượt. Không đưa token BE vào URL camera.

## Cách đồng bộ

public/robot-console/mapping.html và bốn template workflow là bản chụp từ BE; RobotConsole.jsx nhúng trang và chuyển các request /api/v1 qua apiRequest của FE, dùng token/refresh hiện tại. Không truyền token thật qua query string hoặc lưu trong HTML. Chỉ ADMIN thật được gọi bridge. API lỗi và HTTP status được giữ để trang xử lý đúng. Khi đổi màn hình, pagehide dừng gia hạn điều khiển.

Khi BE thay hợp đồng, đồng bộ lại các file này từ src/main/resources/static và chạy build + tests/robot-console.browser.mjs. Không tự tải HTML/script từ máy chủ tùy ý. Đây là giao diện BE được nhúng, chưa chuyển toàn bộ thành component React riêng.

Chi tiết thao tác và giới hạn cần kiểm chứng trên robot: [robot-operations.md](robot-operations.md). Việc kiểm tra trình duyệt dùng API giả lập, không xác nhận AMCL/Nav2/phần cứng và không gửi MOVE thật.
