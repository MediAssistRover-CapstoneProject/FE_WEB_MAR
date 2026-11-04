# Rà soát cấu hình 11 loại step — 05/11/2026

Đối chiếu FE với `StepInputContractValidator`, `StepExecutionPolicy`, `JobStepResponseService`, các ServerStepHandler, `Schema3StepResultContractValidator` và hai schema output BE/Pi hiện có. Không thay đổi BE hoặc cơ sở dữ liệu.

## Những thiếu sót đã sửa

Trước đây bộ chọn chỉ gợi ý `/outputs/<mã>/value` cho mọi step. `value` chỉ là output của CHECK_CONDITION, không phải output của nhận hàng hoặc xác thực. Các tên `LOAD_A`, `AUTH_SENDER` trong hướng dẫn là bí danh minh họa, trong khi mã step thực tế do FE sinh khác. Giao diện mới chọn bằng tên/thứ tự step rồi chọn đúng trường kết quả; đường dẫn tự sinh theo mã thực tế.

Nguồn dữ liệu có ba nhóm: đầu vào khai báo trong workflow, kết quả của step đã hoàn tất trên mọi đường dẫn tới step hiện tại, và biến ngữ cảnh đã được gán trên mọi đường dẫn. Có đường dẫn tùy chỉnh để giữ các cấu hình nâng cao/cũ. Field output, kiểu dữ liệu và tính khả dụng được kiểm tra trước khi gọi API lưu.

CHECK_CONDITION mới không tự tạo biến đầu vào `confirmed` giả định. Khi nối SUCCESS từ step trước vào một check chưa cấu hình, designer đề xuất trường kết quả thật của step đó. Workflow đang lưu giữ nguyên điều kiện cũ; người dùng chủ động đổi nguồn sang Kết quả bước trước.

| Loại step | Cấu hình đã rà/bổ sung | Output có thể chọn |
|---|---|---|
| MOVE | Map/endpoint, chế độ, tốc độ; lọc danh mục và kiểm tra kiểu | `reached`, `endpoint_id`, pose, khoảng cách, attempts |
| AUTHENTICATE | Purpose cố định; method; biến UUID service_request_id dùng chung | `verified`, `verification_id`, `actor_account_id`, `purpose`, `service_request_id`, `verified_at`, `valid_until` |
| CONTROL_HARDWARE | Chọn AUTHENTICATE cấp quyền; tự tạo đúng object mode/purpose và ba `$ref`; retry phải bằng 1 | `published`, `controller_ack`, `commanded_state`, servo ID/vị trí, authorization_mode; `verified` không thay staff kiểm tra khóa |
| HANDLE_PAYLOAD | LOAD/UNLOAD, request ID, compartment, biến items dùng chung hoặc bảng nhập mã/số lượng; hàng không rỗng/trùng mã/số lượng sai | `confirmed`, items, actor, action, compartment, thời điểm xác nhận |
| INTERACT | Mẫu CLOSE/VERIFY sender/receiver, cấu hình tiếng nói theo trường, metadata actor/role và các trường nghiệp vụ còn thiếu | `completed`, `confirmed`; `closed` cho mẫu đóng cửa, `locked` cho mẫu kiểm tra khóa, `values` khi nhập liệu |
| DATA_SERVICE | Trường bắt buộc/hiển thị theo QUERY, RESOLVE_TARGETS, SELECT_TARGET, CHECK_TARGET, CREATE_FALL_INCIDENT, COMMIT_MAP_ARTIFACT | `data/found`, `data/targets`, `data/has_target`, `data/endpoint_id`, `data/is_valid`, `data/incident_id`, map/artifact IDs theo dịch vụ |
| EXECUTE_SENSING | Loại cảm biến, vùng/cửa sổ AI, mapping session/action/artifact/rate; timeout và retry | `metrics/sensors_ready`, khoảng cách/pin, AI count/intrusion, map/zone, dữ liệu mapping theo action |
| NOTIFY | require_ack, ack_policy, data, người nhận STAFF/ADMIN/UUID; metadata legacy giữ trong schema 2 | `alert_id`, `notification_type`, `persisted`, `requires_ack` |
| WAIT | Tách DURATION/EVENT; event_type, correlation_key, timeout lớn hơn thời gian chờ | `completed`, `wake_reason`, `elapsed_sec`, `event/...` khi chờ sự kiện |
| CHECK_CONDITION | Chọn nguồn → step → field thật; EQ/NE/GT/GTE/LT/LTE/IN/EXISTS; RHS có kiểu, object/array/null; nhánh SUCCESS đúng/còn lại độc lập với FAILURE | `value` |
| SET_CONTEXT | Bảng SET/INCREMENT, tên biến, kiểu/nguồn giá trị; đường dẫn `/vars/...`, không trùng khóa; INCREMENT cần khởi tạo số | `updated/<tên>` và nguồn `/vars/<tên>` cho bước sau |

Mỗi step có mục “Kết quả bước này cung cấp”. Những trường tùy kết quả hoặc có thể null được ghi chú. Output chưa chạy, output của nhánh khác và tên field không thuộc contract không được coi là dữ liệu chắc chắn có.

## Ví dụ giao nhận

Luồng kiểm thử gồm 22 step: MOVE → AUTHENTICATE → CHECK verified → UNLOCK → HANDLE_PAYLOAD → CHECK confirmed → INTERACT CLOSE → CHECK closed → LOCK → INTERACT VERIFY → CHECK locked, lặp lại cho bên nhận. Không dùng input giả để xác nhận hành động đã thực hiện.

Chọn step Kiểm tra điều kiện sau nhận hàng:

1. Nguồn dữ liệu: **Kết quả bước trước**.
2. Bước cung cấp: step **Xử lý hàng** vừa chạy.
3. Trường kết quả: **Đã xác nhận đặt hàng vào · confirmed**.
4. Phép so sánh: EQ; kiểu Đúng/sai; giá trị Đúng.
5. Nối Đúng tới bước tiếp theo; Còn lại tới RECOVERY_REQUIRED.

Trong bước mở servo, chọn **Bước xác thực cấp quyền**; designer giữ purpose cố định theo sender/receiver và lấy verification/account/expiry từ cùng bước đó. Không nhập mã xác thực hoặc thời hạn giả.

## Giới hạn BE đã phát hiện

- Java `StepInputContractValidator.sensing()` gọi khi kiểm tra template không cho giá trị `MAPPING`, trong khi đường kiểm tra Pi có cho. FE hiển thị cấu hình nhưng chặn lưu/publish và nêu lỗi này; tiếp tục dùng màn Quét bản đồ hiện có hoặc đồng bộ BE riêng. Không bỏ qua validator.
- `RESTRICTED_AREA_INTRUSION` thuộc danh sách legacy; Pi schema 3 dùng `RESTRICTED_ZONE`. FE báo khi dùng alias cũ trong schema 3.
- Publish vẫn có thể bị BE từ chối vì rollout/runtime chưa sẵn sàng. Cấu hình đúng không thay thế phản hồi xác thực, xác nhận staff hoặc kết quả phần cứng thật.

## Kiểm thử

```powershell
node --test tests/workflow-designer.test.mjs tests/workflow-step-contracts.test.mjs tests/patrol-workflow.test.mjs tests/api-client.test.mjs tests/backend-contract.test.mjs
node tests/workflow-designer.browser.mjs
node tests/workflow-step-config.browser.mjs
npm.cmd run build
```

Test contract kiểm tra đủ 11 loại, luồng giao nhận hoàn chỉnh, kiểu và phạm vi output, schema hàng, quyền mở, SET/INCREMENT và đối chiếu required output với schema BE cạnh repo FE nếu có. Browser test dùng API giả lập, không điều khiển robot hoặc ghi dữ liệu máy chủ thật.
