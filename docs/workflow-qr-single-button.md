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

QR chỉ đi tiếp khi `verified = true`. Nút yêu cầu đóng chỉ đi tiếp khi `confirmed = true`. Điều kiện đặt trên dây nối, không cần các node CHECK_CONDITION riêng. Khi gửi API, kết quả của chính bước nguồn dùng `/result/verified` hoặc `/result/confirmed`; canvas hiển thị tham chiếu `/outputs/<stepCode>/<field>`.

Mọi bước có dây FAILURE và TIMEOUT về RECOVERY_REQUIRED. Kết quả xác nhận âm tính cũng về đó. Không tự lặp lệnh servo.

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
