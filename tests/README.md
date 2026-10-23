# Kiểm tra FE

## Tuần tra dùng bản đồ cục bộ (22/10/2026)

Quy trình tuần tra lấy điểm từ cùng snapshot đã lưu của Bản đồ/Điều phối.
Không gửi mã điểm cục bộ sang API workflow; bản sửa tuần tra lưu trong
`mediassist.local-patrol-workflows.v1`. Không xóa các bản nháp tuần tra cũ.
Màn Tuần tra chỉ đọc quy trình loại PATROL, không chọn robot hay tạo lịch thật.

```powershell
node --test tests/local-patrol-design.test.mjs tests/patrol.test.mjs tests/patrol-workflow.test.mjs tests/dispatch.test.mjs tests/map-studio.test.mjs tests/map-setup.test.mjs tests/facility-contract.test.mjs
npm run build
```

Fixture thủ công: chạy Vite trên cổng **5175**, mở
`http://127.0.0.1:5175/tests/patrol-workflow.fixture.html`.
Fixture chặn mạng, có bản đồ EP1/EP2 và quy trình máy chủ dùng điểm khác.
Mở quy trình tuần tra → chọn lại bản đồ cục bộ và EP1/EP2 trong từng MOVE → lưu
→ xem trong Tuần tra → chạy/tạm dừng/đặt lại → tải lại → sửa → xóa bản nháp cục bộ.
Xác nhận bản đồ LiDAR xuất hiện cả khi chưa chọn tuyến, dropdown không có quy trình
phát loa và Bản đồ không còn hai tab chọn nguồn. Kiểm tra thêm màn hình 390px.
Không dùng fixture này trên origin của người dùng (5173).

Lượt này: 59 kiểm tra logic đạt; build đạt. Chưa chạy lại kiểm tra trực quan vì
công cụ trình duyệt bị tắt trong cài đặt. Các browser script quét robot thật bên
dưới thuộc giao diện trước, cần cập nhật entry point nếu dùng lại.

## Quét thật và phát thông báo (API giả lập trong kiểm thử)

```powershell
node --test tests/robot-operations.test.mjs tests/api-client.test.mjs tests/facility-contract.test.mjs tests/map-studio.test.mjs tests/dispatch.test.mjs
```

Chạy Vite ở cổng 5175, đặt `PLAYWRIGHT_MODULE` và `CHROME_EXECUTABLE` như hướng dẫn dưới, rồi chạy:

```powershell
$env:TEST_BASE_URL = 'http://127.0.0.1:5175'
node tests/robot-operations.browser.mjs
```

Bài kiểm tra chặn toàn bộ `/api/v1/**`; mọi thao tác tạo nhiệm vụ, di chuyển, lưu và phát loa chỉ đi đến fixture. Bao phủ phiên chưa mở (404), ảnh thiếu (204), ACK Pi, nhả nút/mất focus/mất kết nối, khôi phục, lưu lại với cùng sự kiện, tải lại trang, TTS chờ/sẵn sàng/lỗi/hủy, quyền ADMIN và bố cục 390px. Ảnh kết quả nằm trong `.workstation-build/robot-operations/`.

Kiểm tra này không chứng minh robot vật lý đã di chuyển, camera Pi hoạt động hoặc artifact đã upload thành công. Những phần đó cần Pi kết nối với BE, workflow schema 3 đã publish, MQTT/mapping bật, tầng hoạt động và cấu hình upload/TTS hợp lệ.

Các bài kiểm tra dùng bản đồ LiDAR mô phỏng và trình duyệt cô lập. Mọi API ghi đều được giả lập; không dùng tài khoản thật hoặc gửi lệnh đến robot.

## Kiểm tra logic

```powershell
node --test tests/map-setup.test.mjs tests/map-studio.test.mjs tests/map-feature-drag.test.mjs tests/facility-contract.test.mjs tests/dispatch.test.mjs tests/zone-traffic.test.mjs
```

## Kiểm tra giao diện

Yêu cầu Chrome, Playwright và FE đang chạy tại cổng 5173. Đặt `PLAYWRIGHT_MODULE` trỏ đến module Playwright và `CHROME_EXECUTABLE` trỏ đến Chrome đã cài, sau đó chạy:

```powershell
node tests/map-studio.browser.mjs
node tests/map-feature-drag.browser.mjs
node tests/endpoint-group-delete.browser.mjs
node tests/facility-catalog.browser.mjs
node tests/dispatch.browser.mjs
node tests/zone-traffic.browser.mjs
```

Ảnh kiểm tra được lưu trong `.workstation-build/`, thư mục này đã được Git bỏ qua.
