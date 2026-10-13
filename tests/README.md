# Kiểm tra FE

Các bài kiểm tra dùng bản đồ LiDAR mô phỏng và trình duyệt cô lập. Mọi API ghi đều được giả lập; không dùng tài khoản thật hoặc gửi lệnh đến robot.

## Kiểm tra logic

```powershell
node --test tests/map-studio.test.mjs tests/map-feature-drag.test.mjs tests/facility-contract.test.mjs tests/dispatch.test.mjs tests/zone-traffic.test.mjs
```

## Kiểm tra giao diện

Yêu cầu Chrome, Playwright và FE đang chạy tại cổng 5173. Đặt `PLAYWRIGHT_MODULE` trỏ đến module Playwright và `CHROME_EXECUTABLE` trỏ đến Chrome đã cài, sau đó chạy:

```powershell
node tests/map-studio.browser.mjs
node tests/map-feature-drag.browser.mjs
node tests/facility-catalog.browser.mjs
node tests/dispatch.browser.mjs
node tests/zone-traffic.browser.mjs
```

Ảnh kiểm tra được lưu trong `.workstation-build/`, thư mục này đã được Git bỏ qua.
