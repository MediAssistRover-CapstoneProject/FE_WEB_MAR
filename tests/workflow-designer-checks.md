# Kết quả xác minh Workflow Designer

- `node --test tests/workflow-designer.test.mjs tests/workflow-step-contracts.test.mjs tests/patrol-workflow.test.mjs tests/api-client.test.mjs tests/backend-contract.test.mjs`: 59 test qua, gồm đủ 11 loại step, output thật, điều kiện trên dây nối, luồng giao nhận 22 step, quyền mở và context hợp nhất từ nhánh.
- `node tests/workflow-step-config.browser.mjs`: qua; chọn verified/confirmed/closed/locked, dựng quyền mở, các trường theo từng action, sửa hàng hóa/speech/context và responsive.
- `node tests/workflow-designer.browser.mjs`: qua trên Chrome headless, API giả lập toàn bộ; có kéo thả thật, nối nhánh đúng/còn lại, chọn map/phòng/endpoint, lưu lỗi từng phần, validate/publish, clone, undo/redo, khôi phục local, bản cũ có vòng lặp, chuyển đổi patrol cục bộ, JSON sai và bố cục di động.
- `npm.cmd run build`: build thành công; cảnh báo chunk lớn và module-level directives từ dependencies hiện có.

Bộ mở rộng `dispatch.test.mjs` và `local-patrol-design.test.mjs` có 11/12 test lỗi. Đã chạy lại hai file này trong bản archive sạch từ `git HEAD` (src, tests và package.json): cùng 11 lỗi. Đây là baseline phần mô phỏng bản đồ/fixtures cũ; không sửa các phần đó trong thay đổi Workflow Designer.

Ảnh browser: `.workstation-build/workflow-designer/desktop.png`, `mobile.png`, `library.png`. Không kiểm thử ghi dữ liệu vào BE thật hoặc chạy robot.
