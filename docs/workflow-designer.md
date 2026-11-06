# Workflow Designer (ADMIN)

Trang `/workflow` thay thế giao diện tác vụ/danh sách step cũ. `/workflows` vẫn chuyển hướng tới trang này. Không có thay đổi BE, migration hoặc màn staff.

## Thiết kế

Phần cấu hình 11 loại step và output đã được rà theo BE; xem [báo cáo cấu hình](workflow-step-configuration-audit.md). Bộ chọn điều kiện có nguồn Đầu vào / Kết quả bước trước / Biến ngữ cảnh. Chọn tên step và field thật (`verified`, `confirmed`, `closed`, `locked`...), không cần tự gõ mã step hoặc dùng bí danh trong ví dụ.

Kéo hành động từ thư viện (hoặc bấm để thêm), nối Bắt đầu → các step → Kết thúc. Chọn một step để sửa tham số; chọn dây nối để cấu hình outcome, điều kiện, thứ tự và nhánh mặc định. Nút Thông tin & biến mở tên, loại dịch vụ và biến đầu vào. Có hoàn tác/làm lại và lưu vị trí canvas.

Mỗi outcome SUCCESS/FAILURE/TIMEOUT có đúng một nhánh mặc định, sau những nhánh điều kiện. Khi không cấu hình FAILURE/TIMEOUT, bộ chuyển đổi thêm kết thúc RECOVERY_REQUIRED. CHECK_CONDITION luôn thực thi như một step; kết quả boolean `/outputs/<stepCode>/value` quyết định nhánh SUCCESS có điều kiện và SUCCESS mặc định, độc lập với lỗi thực thi.

### Chỉ nối luồng thành công

Có thêm [chính sách xử lý lỗi dùng chung](workflow-failure-handling.md): dừng luồng, thông báo Staff/Admin, chuyển cấp theo thời hạn và kết thúc qua đối soát. Cần BE mới cùng migration V45; workflow cũ phải bật chính sách có chủ đích.

Mặc định mỗi step chỉ hiện cổng thành công; ngay trong ô có tóm tắt **Lỗi / hết giờ: báo lỗi và dừng**. Không cần tạo nút kết thúc hay kéo dây lỗi/hết giờ. BE vẫn nhận đủ transition tự động tới RECOVERY_REQUIRED, ghi nhận lỗi tại JobStep và dừng luồng chính. Trạng thái này có thể cần nhân viên xử lý hoặc chờ xác nhận robot dừng an toàn; không hứa robot đã dừng ngay hoặc Job đã đóng hoàn toàn.

Khi mở lại, các transition tự động được giữ dưới dạng chính sách của step thay vì biến thành dây/nút lỗi. `inputUiJson.designer.automaticErrorRoutes` đánh dấu các transition này; bản designer v1 cũ nhận diện bằng route mặc định tới RECOVERY_REQUIRED không có trong `terminalRoutes`. Chỉ thu gọn route đúng hình dạng tự động, không đổi graph thực thi. Workflow nhập ngoài thiếu metadata và các route đã được chỉnh sửa vẫn giữ nguyên.

Các nhánh lỗi tùy chỉnh có sẵn luôn hiện để không che logic. Nút **Nhánh lỗi nâng cao** mở thêm cổng để cấu hình riêng khi cần, không thay đổi dữ liệu chỉ bởi bật/tắt. Đúng/Sai của bước kiểm tra điều kiện vẫn là nhánh nghiệp vụ cần chọn rõ, không phải lỗi thực thi.

Mẫu giao hàng QR cũng chỉ vẽ happy path. Bước chờ nút đóng cửa giữ một dây `confirmed=true` đi tiếp; phản hồi hoàn tất không hợp lệ được compiler tự thêm fallback dừng ngay tại bước, không hiện cổng “Phản hồi sai” trừ khi mở nâng cao hoặc đã có nhánh tùy chỉnh. Lưu và mở lại vẫn giữ guard thực thi này.

MOVE mới tự khai báo `map_id` và một biến endpoint riêng. Form xem trước dùng danh mục máy chủ, chỉ chọn điểm active/accessibility trên map ACTIVE. Chế độ phòng → endpoint vẫn trả về endpoint UUID; phòng không có điểm được báo rõ. Đổi map xóa các điểm/phòng đã chọn theo map cũ. Xem trước không tạo Job và không gửi lệnh robot.

Step Xác thực và Xử lý hàng mới tự tạo hoặc dùng lại biến bắt buộc `service_request_id` (chuỗi UUID), rồi liên kết vào Yêu cầu dịch vụ. Dropdown này không gợi ý biến bản đồ/endpoint. Với step cũ, chọn nguồn Biến đầu vào rồi bấm **+ Dùng biến service_request_id** để bổ sung và liên kết mà không tạo lại step. Nếu khóa biến đã có kiểu không phù hợp, giao diện yêu cầu sửa kiểu thay vì ghi đè cấu hình.

Biến đầu vào nằm trong `inputSchemaJson`/`defaultInputsJson`. `inputUiJson.fields` là object theo khóa biến, chứa `kind`, `label`, `description`; biến endpoint có `mapVariable` và `selection: endpoint | room-endpoint`; biến lựa chọn có `options`. Màn staff tương lai cần đọc metadata này từ chi tiết workflow đã publish và gửi giá trị UUID của endpoint, không gửi room UUID.

`inputUiJson.designer` chứa version, vị trí theo stepCode, viewport và metadata nút bắt đầu/kết thúc; không nằm trong params thực thi. Tham số dùng `$ref` tới `/inputs/<key>` hoặc kết quả bước trước. Chỉ gợi ý/chấp nhận output đảm bảo đã thành công trên mọi đường chạy đến bước hiện tại. Các discriminator executor như INTERACT.action và WAIT.wait_type giữ cố định.

## Lưu và vòng đời

- Bản chưa hoàn chỉnh tự lưu sau 650 ms vào localStorage, với namespace theo BE và tài khoản; không lưu token. Có nút lưu thủ công, thông báo quota/lỗi và giữ nguyên dữ liệu hỏng để không ghi đè.
- Bản hợp lệ tạo bằng POST `/api/v1/admin/workflows/graph`. Khi sửa, PUT metadata trước rồi PUT graph. Hai request là hai giao dịch riêng của BE. Nếu thất bại, giữ bản thiết kế cục bộ và hủy trạng thái đồng bộ; không publish cho đến khi lưu/validate lại thành công.
- Kiểm tra lưu lên BE rồi POST validate. Publish chỉ bật khi đúng bản đang mở đã đồng bộ và VALIDATED. Lỗi readiness/rollout từ BE được hiển thị; không tự thay phiên bản contract hay bỏ qua guard.
- PUBLISHED/ARCHIVED chỉ xem; tạo phiên bản mới qua clone. Ngừng sử dụng gọi archive, không xóa lịch sử.
- **Xóa quy trình** có ở thư viện và màn chi tiết, kể cả khi có bản thiết kế cục bộ và ở các trạng thái DRAFT/VALIDATED/PUBLISHED/ARCHIVED. Sau hộp xác nhận, FE gọi `DELETE /api/v1/admin/workflows/{id}/force` (ADMIN). BE xóa workflow, lịch chạy và lịch sử nhiệm vụ không còn hoạt động; gỡ liên kết workflow khỏi NavigationRequest, giữ ServiceRequest/NavigationRequest nguồn. BE chặn nếu còn Job QUEUED/ACCEPTED/RUNNING. Lỗi từ BE giữ nguyên bản thiết kế và hiển thị trong hộp xác nhận. Thành công dọn mọi bản thiết kế trên thiết bị của workflow đó, đóng editor và bỏ `workflowId` khỏi URL để không tự khôi phục workflow đã xóa. **Xóa bản thiết bị** chỉ dọn localStorage, không gọi API.
- Workflow cũ có vòng lặp, step disabled hoặc contract chưa hỗ trợ được xem nguyên trạng. Tuyến tuần tra cục bộ vẫn giữ trong storage cũ; Tạo bản chuyển đổi tạo một bản mới dùng biến bản đồ/endpoint, không sửa bản gốc hoặc gửi ID cục bộ lên BE.

Workflow mới dùng schema 3/graph 3; workflow máy chủ cũ giữ phiên bản contract và task grouping. BE tiếp tục là nguồn xác thực cuối cùng cho contract và khả năng publish.

## Kiểm thử

```powershell
node --test tests/workflow-designer.test.mjs tests/workflow-step-contracts.test.mjs tests/patrol-workflow.test.mjs tests/api-client.test.mjs tests/backend-contract.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5186 --strictPort
# Terminal khác; mặc định dùng Chrome đã cài trên Windows:
node tests/workflow-designer.browser.mjs
node tests/workflow-step-config.browser.mjs
node tests/workflow-delete.browser.mjs
node --test tests/workflow-happy-path.test.mjs
node tests/workflow-happy-path.browser.mjs
npm.cmd run build
```

Browser test chặn toàn bộ API bằng fixtures và không cho request ngoài máy cục bộ đi qua. Có thể đặt `WORKFLOW_TEST_URL` và `CHROME_EXECUTABLE`. Ảnh kiểm tra nằm tại `.workstation-build/workflow-designer/`.
