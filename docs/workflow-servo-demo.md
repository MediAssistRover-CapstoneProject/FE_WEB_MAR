# Quy trình A → servo → B

Trong **Tự động hóa → Thiết kế quy trình**, bản nháp `WF_MOVE_A_SERVO_5S_MOVE_B` được thêm một lần cho mỗi tài khoản/máy chủ, không ghi đè các bản nháp có sẵn. Nếu người dùng xóa bản nháp này, lần tải sau không tự tạo lại.

Luồng thành công gồm đúng năm bước:

1. `MOVE_A`: đi tới Điểm A.
2. `OPEN_SERVO`: `UNLOCK_COMPARTMENT`, ngăn `CART_MAIN`.
3. `WAIT_5_SECONDS`: `DURATION`, 5 giây.
4. `CLOSE_SERVO`: `LOCK_COMPARTMENT`, ngăn `CART_MAIN`.
5. `MOVE_B`: đi tới Điểm B rồi hoàn tất.

Không có AUTHENTICATE, CHECK_CONDITION hoặc bước chờ người dùng xác nhận. Mỗi bước vẫn dừng luồng khi lỗi/hết giờ. Servo không tự thử lại.

Bản đồ, Điểm A và Điểm B là đầu vào khi điều phối; mẫu không tự đoán các điểm trong database. MOVE dùng tốc độ mặc định 0,08 m/s của trình thiết kế.

Mẫu dùng ngoại lệ commissioning hiện có của BE: schema 3 và giá trị cố định `defaultInputsJson.hardware_test_mode=COMMISSIONING_ONLY`. FE nhận diện đúng điều kiện này khi kiểm tra bước mở servo; workflow thường vẫn cần quyền xác thực. Không thay đổi cấu hình BE/Pi. Để publish/chạy, BE phải cho phép commissioning unlock và hỗ trợ các bước qua MQTT.

Mẫu được tạo dưới dạng bản nháp trên thiết bị. Lưu lên máy chủ, Kiểm tra và Publish trong trình thiết kế trước khi chọn ở trang Điều phối. Tạo mẫu hoặc lưu đồ thị không gửi lệnh tới robot.

```powershell
node --test tests/workflow-servo-demo.test.mjs tests/workflow-step-contracts.test.mjs
# Vite cổng 5189, API trong browser test đều giả lập:
node tests/workflow-servo-demo.browser.mjs
```
