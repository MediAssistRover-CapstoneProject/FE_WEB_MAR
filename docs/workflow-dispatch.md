# Điều phối quy trình

Trang `/admin/workflow-dispatch`, menu **Tự động hóa → Điều phối quy trình**, dành cho ADMIN.

- Chọn một phiên bản quy trình từ danh mục đã phát hành. Đọc chi tiết qua API published dành cho người vận hành, không dùng bản thiết kế trong localStorage.
- Biểu mẫu lấy từ `inputSchemaJson`, `inputUiJson.fields` và `defaultInputsJson`. Bản đồ phải ACTIVE; điểm đích phải active/accessible và thuộc bản đồ đã chọn. Đổi bản đồ xóa điểm đích phụ thuộc. Giá trị false/0 được giữ nguyên.
- Xem lại thông tin trước khi gửi. Chỉ thao tác xác nhận mới tạo lượt chạy.
- Dùng API hiện có: tạo schedule ONCE, `startsAt` là thời điểm xác nhận, `misfirePolicy=FIRE_ONCE`, sau đó activate. Không thêm API tạo job giả và không dùng API test robot.
- `robotId` trong schedule là robot **ưu tiên** theo contract BE hiện tại. BE có thể chọn robot khác hoặc để job chờ phân robot; giao diện hiển thị robot thực tế của job. Đây không phải cam kết ghim robot.
- Giữ mã schedule và snapshot đầu vào trong sessionStorage theo API/account trước khi gửi. Sau lỗi mạng hoặc tải lại trang, tiếp tục cùng mã; kiểm tra schedule đã tồn tại và trạng thái trước khi tạo/activate. Không tự gửi lại khi mount. Mã schedule unique phía BE ngăn tạo trùng.
- Cập nhật danh sách nhiệm vụ mỗi 5 giây, tìm job theo scheduleId, giữ dữ liệu gần nhất khi đọc lỗi. Bảng chi tiết dùng lại `JobDetail` của Vận hành trực tiếp, hỗ trợ SSE, xác nhận bước, yêu cầu hủy và xử lý sự cố ngay trên trang. Có liên kết sang trang vận hành đầy đủ với `jobId`.

## Phạm vi thực thi

Trang gọi workflow đã phát hành bằng đầu vào thực tế; không tự bổ sung hồ sơ giao hàng, hàng hóa, danh tính người gửi/nhận, phiên điều hướng hay quyền mở ngăn. Workflow cần các dữ liệu đó vẫn phải đáp ứng kiểm tra của BE/Pi. Bản mẫu QR có `deliveryDraft.runtimeReady=false` bị chặn. Không coi kiểm thử FE là bằng chứng robot vật lý đã thực hiện giao hàng.

## Kiểm tra

```powershell
node --test tests/workflow-dispatch.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5189 --strictPort
# Terminal khác:
node tests/workflow-dispatch.browser.mjs
npm run build
```

Browser test giả lập toàn bộ API. Ảnh desktop/mobile nằm trong `.workstation-build/workflow-dispatch/` (Git bỏ qua).
