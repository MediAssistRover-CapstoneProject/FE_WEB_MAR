# Bản nháp nhận hàng A → giao hàng B bằng QR

Phạm vi: chỉ chỉnh FE và bản thiết kế workflow. Không sửa BE, Pi hoặc triển khai màn robot.

Nút **Mẫu giao hàng QR** trong trình thiết kế thay đồ thị của bản đang mở, giữ mã/ID/tên workflow và có thể hoàn tác. Bản đã publish phải tạo phiên bản mới trước.

## Luồng gồm 10 bước

1. MOVE đến endpoint A.
2. AUTHENTICATE `DELIVERY_SENDER`, phương thức `QR_CODE`.
3. CONTROL_HARDWARE `UNLOCK_COMPARTMENT`, dùng quyền của bước QR tại A.
4. INTERACT `CONFIRM`, `REQUEST_CLOSE_SENDER`: chờ nút **Đã bỏ hàng — Đóng cửa**.
5. CONTROL_HARDWARE `LOCK_COMPARTMENT`.
6. MOVE đến endpoint B.
7. AUTHENTICATE `DELIVERY_RECEIVER`, phương thức `QR_CODE`.
8. CONTROL_HARDWARE `UNLOCK_COMPARTMENT`, dùng quyền của bước QR tại B.
9. INTERACT `CONFIRM`, `REQUEST_CLOSE_RECEIVER`: chờ nút **Đã lấy hàng — Đóng cửa**.
10. CONTROL_HARDWARE `LOCK_COMPARTMENT`, sau đó kết thúc thành công.

QR sai bị API từ chối và bước tiếp tục chờ quét lại khi mã còn hiệu lực. Chỉ QR hợp lệ mới hoàn tất AUTHENTICATE, vì vậy bước QR có một dây đi tiếp tới UNLOCK, không có dây SUCCESS “không hợp lệ” xuống hỗ trợ. Mẫu đặt thời gian xác thực 120 giây theo TTL mặc định của BE; QR thực tế có thể hết hạn sớm hơn tùy cấu hình BE. BE hiện chưa giới hạn số lượt quét sai, và `maxAttempts` không đếm số lần staff quét QR.

Ở nút yêu cầu đóng, chưa bấm thì bước tiếp tục chờ. Chỉ phản hồi hoàn tất `confirmed = true` mới đi đóng servo. Phản hồi hoàn tất không hợp lệ tự dừng tại bước; không hiện thêm cổng/dây “Phản hồi sai” trong chế độ mặc định. Khi gửi API, điều kiện dùng `/result/confirmed`; canvas hiển thị `/outputs/<stepCode>/confirmed`. Compiler tự thêm SUCCESS mặc định → RECOVERY_REQUIRED ở ưu tiên 2; nhánh confirmed=true ở ưu tiên 1. Không bỏ guard để làm sơ đồ gọn.

Mẫu phiên bản 3 chỉ có 10 step, Bắt đầu, một kết thúc thành công và 11 dây happy path. FAILURE/TIMEOUT của 10 bước và phản hồi nút bất thường của 2 bước chờ được compiler thêm vào payload, không tạo dây hay nút lỗi trên canvas. Các fallback giữ trạng thái RECOVERY_REQUIRED để không bỏ qua trường hợp ngăn hàng có thể đang mở. Không tự lặp lệnh servo. Metadata `automaticErrorRoutes` giúp mở lại vẫn gọn; payload BE vẫn có 32 transition với cùng điều kiện dừng.

Nút Nhánh lỗi nâng cao vẫn mở cổng để cấu hình riêng. Những nhánh tùy chỉnh đã lưu không bị tự xóa. Với bản mẫu v1/v2 còn dây lỗi, áp dụng lại mẫu để dựng phiên bản mới; thao tác này có hộp xác nhận trong ứng dụng và có thể hoàn tác.

Biến đầu vào bắt buộc: `map_id`, `pickup_endpoint_id`, `delivery_endpoint_id`, `service_request_id`. Endpoint thuộc bản đồ đã chọn; MOVE không nhận UUID phòng.

## Giới hạn chạy thực tế

Đây là bản thiết kế, không phải cam kết đã tích hợp luồng robot. Metadata `inputUiJson.deliveryDraft.runtimeReady: false` giữ cảnh báo và chặn publish trong FE, kể cả khi BE đã kiểm tra cấu trúc thành công.

BE hiện có quy trình DELIVERY riêng gồm xác nhận hàng, xác nhận cửa và kiểm tra khóa. Pi hiện cũng cần tích hợp quyền mở ngăn phù hợp. Vì vậy thay graph không tự tạo nút trên màn robot hoặc thay đổi cơ chế ghi nhận bàn giao của BE. Nút yêu cầu đóng không khẳng định cửa/khóa đã đóng vật lý.

## Kiểm tra

```powershell
node --test tests/workflow-qr-delivery-draft.test.mjs tests/workflow-transition-adapter.test.mjs tests/workflow-designer.test.mjs tests/workflow-step-contracts.test.mjs
node tests/workflow-qr-delivery.browser.mjs
npm run build
```

Browser test dùng API giả lập, xác nhận thay đúng workflow, giữ 10 bước qua lưu/tải lại, đúng tham chiếu điều kiện và không gửi publish/nhiệm vụ/lệnh robot.
