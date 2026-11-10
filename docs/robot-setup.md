# Thiết lập vận hành robot

Admin mở **Robot → Thiết lập vận hành**, đường dẫn `/admin/robot-setup`. Trang **Trạng thái robot** có liên kết mở nhanh, truyền robot đang xem. Staff không thấy menu hoặc truy cập trang này; tài khoản demo không gọi API thiết lập.

1. Chọn robot và bản đồ đã lưu. Bản đồ phải ACTIVE và có `navigation_reload_safe: true` để mở phiên.
2. Mở phiên 2, 4 hoặc 8 giờ. Trong container Pi, dừng `robot.zsh run` và chạy lệnh navigation được hiển thị. Web chưa tự khởi chạy Pi. Trang dùng lại phiên còn hiệu lực, không tự mở/đóng phiên hoặc khởi tạo khi tải lại.
3. Chọn endpoint đang hoạt động/có thể tiếp cận hoặc kéo vị trí và hướng trên ảnh quét. Xác nhận robot thực tế đang ở đúng vị trí rồi gửi SEED. GLOBAL nằm trong **Định vị nâng cao**. Đây là khai báo vị trí hiện tại, không phải lệnh đi đến endpoint.
4. Chờ trạng thái phiên READY, pose mới đúng map/frame, kết nối/heartbeat mới, profile endpoint/zone đã ACK và robot IDLE/dispatchReady. Checklist tự cập nhật; trạng thái không được bật thủ công. Khi sẵn sàng, hướng dẫn thu gọn thành bản đồ và trạng thái vận hành.

Trang dùng snapshot và `navigation-zones`, cùng ba API POST `navigation-session`, `/initialization`, `/close` hiện có. Không tạo job, MOVE, endpoint hoặc sửa dữ liệu map. Tọa độ đặt trên map dùng origin/yaw gốc. Điểm dự kiến màu cam, vị trí đã được xác minh màu xanh. Khi thay bản đồ hoặc phiên, phải chọn/xác nhận lại vị trí.

Trước thao tác ghi, trang đối chiếu snapshot mới, phiên và hash tài sản; endpoint được đọc lại trước SEED. Robot đang có job/di chuyển bị khóa thay đổi. Khi phản hồi ghi bị mất, ý định được giữ theo tài khoản/máy chủ/robot trong sessionStorage, không tự gửi lại; trang chỉ mở khóa khi đọc được bằng chứng trạng thái đã đổi. Nếu trạng thái không đổi, tiếp tục kiểm tra BE/Pi thay vì giả định thao tác đã thất bại. Đổi trang không tự đóng phiên trên robot.

Profile ACK chỉ xác nhận đã nhận cấu hình. Kiểm thử phần cứng vẫn cần xác minh việc áp dụng vùng cấm, tốc độ, AMCL và Nav2. Staff dùng luồng giao việc hiện có; trang này không thay đổi quyền hoặc API điều phối của staff.

Giao diện giữ nguyên bản đồ và khung thông báo khi đồng bộ lại; kết nối web được hiển thị riêng với kết nối MQTT/heartbeat của robot. Sau phản hồi mở/đóng phiên hoặc khởi tạo, trang giữ thông tin phiên đã được BE xác nhận nhưng khóa thao tác cho đến snapshot mới. Vị trí cuối chỉ được giữ trong cùng robot/map/hash/phiên/revision, hiển thị màu xám và ghi rõ chưa xác minh khi dữ liệu hết hạn. Vị trí này không được dùng để xác nhận sẵn sàng. Pose realtime cập nhật riêng trên bản đồ theo nhịp vẽ của trình duyệt; biểu mẫu chỉ được đánh thức khi trạng thái thay đổi hoặc dữ liệu đến hạn, không render theo vòng 500 ms.

Kiểm tra:

```powershell
node --test tests/robot-setup.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort
# Terminal khác: API được giả lập toàn bộ, không gửi lệnh đến robot thật.
node tests/robot-setup.browser.mjs
npm.cmd run build
```

Ảnh kiểm tra nằm trong `.workstation-build/robot-setup/`.
