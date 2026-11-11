# Cài đặt hệ thống

`/admin/system-settings` dùng giao diện riêng cho Admin, thay cho biểu mẫu CRUD tổng quát. Các liên kết `?tab=settings`, `mqtt`, `retention` vẫn hoạt động. Liên kết cũ `?tab=robot-camera` hiển thị Vận hành chung. Staff và tài khoản demo không gọi API cài đặt.

Ba mục Vận hành chung, Chẩn đoán MQTT và Lưu trữ dữ liệu nằm trên hàng tab ngang phía trên nội dung, cùng kiểu tab có gạch chân của các trang quản trị khác.

- **Vận hành chung:** ngưỡng heartbeat (10–3600 giây) và phòng nhận SOS đang hoạt động. Backend dùng nhân viên đang trực tại phòng để phân công. Khi chưa có override, trang báo rõ và chỉ tạo khóa được backend sử dụng sau khi người dùng lưu. Giữ nguyên category, description và publicSetting khi cập nhật; không đưa metadata vào biểu mẫu. Khóa khác nằm trong phần thu gọn, chỉ đọc. Giọng nói có liên kết sang trang chuyên biệt.
- **Chẩn đoán MQTT:** trạng thái broker, phát lệnh, robot và heartbeat. Hàng đợi, chẩn đoán và điều khiển nằm trong phần nâng cao. PUT gửi mode, dispatchHalted, expectedRevision lấy từ lần đọc gần nhất và note bắt buộc. Chỉ chuyển tiếp từng bước; lỗi 409 tải lại trạng thái, không gửi lại thao tác tự động. Tạm ngừng phát lệnh không phải dừng khẩn cấp robot.
- **Lưu trữ:** GET chính sách có hiệu lực; điều chỉnh thời hạn/cách xử lý thông qua SystemSetting. AlertRecipient dùng chung `retention.alert_days` và `retention.alert_mode` với Alert. POST xem trước gửi `?dryRun=true`, không có body. Thực hiện thật cần kết quả xem trước, máy chủ cho phép thực thi và xác nhận trong giao diện. Lưu cấu hình hoặc tải lại làm mất hiệu lực kết quả xem trước.

Đã bỏ mục URL camera dự phòng, liên kết cấu hình và cơ chế đọc URL cũ trong localStorage. Camera robot tiếp tục dùng luồng trực tiếp qua máy chủ; trang quét vẫn có ảnh preview do BE cung cấp.

Endpoint được đối chiếu với `SystemSettingController`, `MqttRolloutController`, `MqttRolloutService`, `AdminRetentionController`, `RuntimeSettingServiceImpl` và `RetentionServiceImpl` trong BE_MAR. List settings/rooms/robots đọc đủ các trang với size 100; endpoint singleton/policies không nhận page/size. Giá trị cấu hình gửi đúng `{ settingValue: { value: ... }, dataType, category, description, publicSetting }`.

Kiểm tra (API giả lập, không thay đổi máy chủ hay robot thật):

```powershell
node --test tests/system-settings.test.mjs tests/backend-contract.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort
# Terminal khác
node tests/system-settings.browser.mjs
npm.cmd run build
```

Kiểm tra trình duyệt bao gồm payload ghi, giới hạn nhập, tạo cấu hình SOS, xung đột MQTT, khóa chính sách dùng chung, xem trước/thực thi, gỡ nguồn camera dự phòng, lỗi tải và bố cục 1500/1100/768/390px. Ảnh tại `.workstation-build/system-settings/`. CSS dùng tiền tố `sys-` để không trùng trang Lịch trực (`ss-`).
