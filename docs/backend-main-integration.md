# Tích hợp FE với BE main

Đối chiếu ngày 19/10/2026 với BE `bd5af7a2b0de49e652261dbe24033575422ceb22` và FE sau pull `78ecd90`. Không chỉnh sửa BE.

## Kết nối và phạm vi

- FE giữ mặc định `https://bemar-production.up.railway.app`; có thể đổi bằng `VITE_API_BASE_URL` rồi khởi động lại Vite/build lại.
- Đã đọc OpenAPI Railway và so với BE main: 207 thao tác dành cho người dùng/công khai có cùng đường dẫn, tham số và schema trong snapshot. 37 API Pi/thiết bị được tách riêng, không đưa khóa thiết bị vào trình duyệt.
- Snapshot: `src/features/api/backendContract.json`; bộ gọi API: `backendApi.js`; kiểm tra/chuẩn hóa dữ liệu: `contract.js`.
- Swagger hiện trùng tên các record `Create`, `Update`, `Confirm`. `contractOverrides.js` dùng đúng DTO Java của từng thao tác, gồm nhân viên, ca trực, cài đặt, giao nhận, xác thực giao nhận và tạo phiên quét.
- Không chạy các lệnh điều khiển robot, tạo/xóa dữ liệu hoặc đặt lại mật khẩu trên Railway trong quá trình kiểm tra.

## Các màn hình

- Nhiệm vụ: yêu cầu thông tin, dẫn đường, hộ tống, vận hành, giao nhận; gửi xử lý/hủy theo trạng thái.
- Vận hành trực tiếp: danh sách/chi tiết công việc, phân công, hủy, sự kiện, phục hồi, phiên quét, SSE, xác nhận bước và xác thực giao nhận.
- Robot/Sạc pin: dữ liệu robot thực, bảo trì/cấp khóa/đối soát/cấu hình giám sát theo quyền; yêu cầu sạc đi qua API vận hành, không giả lập thành công.
- Danh mục bệnh viện: thông tin, bài hướng dẫn, tầng, phòng, bản đồ, vùng, điểm đích, nhóm và thành viên. Có lối vào bộ vẽ vùng/đặt điểm trên danh mục BE.
- Quản lý quy trình: CRUD, tác vụ, bước, liên kết, đồ thị, chọn bước bắt đầu, kiểm tra/phát hành/nhân bản/lưu trữ; danh sách đã phát hành và thư viện bước. Trình biên tập `/workflows` vẫn được giữ.
- Ca trực: nhân viên, ca, khung giờ và chuyển trạng thái; Staff xem ca của mình.
- Giám sát: cảnh báo, sự cố, phát hiện, báo cáo và CSV; hội thoại/lệnh giọng nói chỉ hiển thị thao tác BE hỗ trợ.
- Quản trị: nhân viên/tài khoản, mật khẩu, cài đặt, MQTT rollout, retention và audit; các mục Admin không hiển thị thao tác ghi cho Staff.
- Thông tin công khai: các danh mục public không gửi Bearer token.
- Phân trang, lọc, danh mục chọn ID theo tên, biểu mẫu lồng nhau, lỗi từ BE, trạng thái đang lưu và xác nhận thao tác nhạy cảm được dùng chung. Một số cấu hình nâng cao của BE vẫn nhập JSON.

API cũ được đánh dấu deprecated không hiển thị lại. Hai API confirm-pickup/confirm-delivery của luồng giao nhận cũ không được đưa vào UI schema 3 (BE trả 410); thay bằng xác nhận đúng bước đang RUNNING và xác thực giao nhận. `POST /api/v1/pi/**` thuộc tiến trình robot, không phải thao tác FE.

Map Studio và Điều phối cục bộ cùng điều khiển phím mũi tên vừa pull được giữ nguyên; không tuyên bố dữ liệu mô phỏng cục bộ đã triển khai lên robot. Quản lý bản đồ máy chủ là mục riêng.

## 401 trên Railway

Kiểm tra chỉ đọc thực tế: `/` trả 401; `/actuator/health`, `/v3/api-docs`, `/api/v1/public/floors` trả 200. SecurityConfig không cho truy cập ẩn danh vào `/`; đây không phải trang FE.

`POST /api/v1/auth/login` nhận `username`, `password`, `deviceInfo`. FE gửi đúng cấu trúc, bỏ khoảng trắng đầu/cuối username, không cắt mật khẩu, không lặp đăng nhập khi bị từ chối. BE trả “Tên đăng nhập hoặc mật khẩu không đúng” khi không tìm thấy username hoặc kiểm tra mật khẩu thất bại. Không thể sửa dữ liệu tài khoản Railway bằng thay đổi FE.

Khi login trả `mustChangePassword: true`, FE đưa thẳng tới `/change-password`, không gọi `/auth/me` (BE chặn cả API này trước khi đổi mật khẩu). Các đường dẫn quản trị cũng chuyển về trang đổi mật khẩu. Sau khi PUT đổi mật khẩu thành công, xóa phiên cũ và yêu cầu đăng nhập lại vì BE thu hồi token.

`AdminBootstrapService` chỉ tạo admin khi chưa tồn tại username. Đổi `ADMIN_PASSWORD` rồi redeploy **không đặt lại mật khẩu tài khoản đã tồn tại**. Quản trị viên cần kiểm tra đúng database/môi trường và dùng quy trình đặt lại mật khẩu được phép. Không đưa mật khẩu thật vào code hoặc chat.

FE đã bổ sung: refresh single-flight, giữ phương thức/body/idempotency khi thử lại, thử lại tối đa một lần, refresh cả `/auth/me`, hủy phiên nếu refresh hết hiệu lực, giữ phiên khi lỗi kết nối/gia hạn tạm thời, chuyển về login khi phiên hết hạn. Không cho vào dashboard khi `/auth/me` thất bại. Sai mật khẩu khi đổi mật khẩu không tự hủy phiên. Không tự chuyển đăng nhập thất bại sang tài khoản dự phòng.

## Kiểm tra

- `npm run build`.
- `node --test tests/*.test.mjs`: 54 bài đạt tại thời điểm bổ sung tích hợp.
- `tests/backend-workspace.browser.mjs`: tạo yêu cầu, retry giữ idempotency, sửa nhân viên, tạo dữ liệu con, mở các danh mục và phân quyền bằng API giả lập.
- `tests/auth.browser.mjs`: đăng nhập 401/thành công, lỗi tải tài khoản, tài khoản dự phòng không gọi BE.
- `tests/workflow-crud.browser.mjs`: tạo/sửa/xóa quy trình, tác vụ, bước bằng API giả lập.
- `tests/dispatch.browser.mjs`: mô phỏng điều phối và nhiều kích thước màn hình; không ghi BE.
- `tests/map-studio.browser.mjs` cũ đang tìm nút “Bật cảm biến LiDAR” không còn trong FE vừa pull, nên timeout; không sửa hành vi quét mới để ép test cũ qua.

Các kiểm thử trình duyệt dùng `PLAYWRIGHT_MODULE` và `CHROME_EXECUTABLE` nếu Playwright/Chrome không nằm tại mặc định. Dữ liệu kiểm thử không được gửi vào Railway. Chưa kiểm thử đầu-cuối bằng tài khoản hợp lệ và robot vật lý trên Railway.
