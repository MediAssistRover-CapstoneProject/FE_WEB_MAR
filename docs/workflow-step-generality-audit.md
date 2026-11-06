# Đánh giá tính dùng chung và nguồn tham số của 11 step

Ngày rà soát: 05/11/2026. Phạm vi: mã FE hiện tại và mã BE cùng workspace, ưu tiên schema 3. Lần này chỉ rà soát và cập nhật tài liệu; không sửa hành vi ứng dụng hay dữ liệu hệ thống.

## Kết luận

Chưa thể đánh giá trang Quy trình là bộ cấu hình dùng được cho mọi workflow. Tên các trường đầu vào của 11 step có đối ứng trong validator BE, nhưng điều đó chưa bảo đảm cấu hình được phép chạy trong mọi nghiệp vụ, mọi nguồn dữ liệu hay mọi màn tạo job.

Sáu step có chức năng dùng chung: MOVE, INTERACT, NOTIFY, WAIT, CHECK_CONDITION, SET_CONTEXT, trong các giới hạn nêu dưới đây. DATA_SERVICE, EXECUTE_SENSING và CONTROL_HARDWARE chỉ dùng các dịch vụ/phần cứng đã tích hợp. AUTHENTICATE và HANDLE_PAYLOAD hiện gắn với giao hàng, không phải cơ chế xác thực/xử lý hàng tổng quát cho mọi WF.

Vấn đề chính cần sửa là kiểm tra sự tương thích và chứng minh nguồn dữ liệu, không phải đổi tất cả biến thành pickup/delivery.

## Tham số BE và biến WF là hai khái niệm khác nhau

| Loại | Quy tắc đúng | Ví dụ |
|---|---|---|
| Trường đầu vào step | Tên, kiểu và tập giá trị phải do contract BE quy định; không tự thêm | MOVE nhận map_id, endpoint_id, mode, max_speed_mps |
| Biến đầu vào WF | BE cho phép khai báo động trong inputSchemaJson; phải có bên thực sự cấp giá trị khi tạo job | destination_1_endpoint_id do người tạo job chọn |
| Dữ liệu BE cấp | Lấy từ snapshot/bản ghi BE; không yêu cầu người dùng tạo UUID giả hoặc kết quả giả | service_request_id, items của DeliveryRequest, grant xác thực |
| Kết quả bước trước | Chọn trường thật của đúng hành động và bảo đảm có trên đường chạy | SELECT_TARGET.data.endpoint_id chỉ có khi has_target=true |
| Biến ngữ cảnh | SET_CONTEXT gán trước, hoặc runtime BE cấp theo chức năng cụ thể | /vars/counter; mapping_session_id/artifact_id do BE cấp |

`destination_1_endpoint_id` không cần là field hardcode của Java: nó hợp lệ nếu được khai báo trong WF và có trong inputs của job. Nó không được coi là biến BE tự sinh. `RequestJobInputSnapshotFactory` hiện cấp tên chuẩn theo loại yêu cầu, không tự suy ra destination_1 là pickup hay destination_2 là delivery. Không có lớp ánh xạ chung đó thì có thể thiếu dữ liệu dù thiết kế lưu được.

Nguồn đối chiếu: `WorkflowStepContractValidator.references()`, `RequestJobInputSnapshotFactory.forRequest()/merged()`, `JobStepInputResolverImpl.resolveNode()`.

## Đối chiếu đủ 11 loại

| Step | Các trường BE nhận | Khả năng dùng chung và giới hạn |
|---|---|---|
| MOVE | map_id, endpoint_id, mode, max_speed_mps | Dùng chung. mode chỉ NORMAL/ESCORT/PATROL; tốc độ >0 và ≤0.8. BE đối chiếu endpoint/bản đồ/job/robot. Tên biến điểm đích do từng WF định nghĩa; không gắn cứng nhận/giao. |
| INTERACT | action, prompt_key, data; actor, required_role, compartment_id, patient_reference, endpoint_id, question, items, message, incident_id, detection_event_id theo hành động | Dùng chung có giới hạn. SPEAK chạy Pi, chỉ nhận action/prompt_key/data với text, language_code vi/en, speed_wpm, volume. DISPLAY/CONFIRM/CAPTURE_INPUT chạy BE và chờ UI. actor=PATIENT/USER/DEVICE được validator nhận nhưng không tự cung cấp một kênh phản hồi từ các đối tượng đó. |
| DATA_SERVICE | service_key, operation, question, language_code, map_id, endpoint_id, endpoint_group_id, targets, index, detection_event_id, mapping_session_id, artifact_id, floor_id, map_name, tùy service | Chỉ 6 service_key đã tích hợp. Không phải bộ gọi API hay CRUD tùy ý. operation hiện được nhận nhưng handler không đọc để quyết định hành động. SELECT_TARGET phải dùng snapshot RESOLVE_TARGETS đã ghi nhận. CREATE_FALL_INCIDENT cần sự kiện SUSPECTED_FALL đã được staff xem/xác nhận. COMMIT_MAP_ARTIFACT cần phiên/tệp mapping thực và tính năng mapping sẵn sàng. |
| AUTHENTICATE | purpose, method, service_request_id | Chưa tổng quát. purpose chỉ DELIVERY_SENDER/DELIVERY_RECEIVER; runtime scope yêu cầu job DELIVERY. Schema 3 giao hàng yêu cầu QR_CODE, trong khi FE mặc định STAFF_CONFIRMATION. |
| CONTROL_HARDWARE | action, compartment_id, authorization; service_request_id chỉ là metadata BE | Chỉ LOCK_COMPARTMENT/UNLOCK_COMPARTMENT và CART_MAIN. Không phải bộ cấu hình mọi servo/thiết bị. UNLOCK thường cần grant BE từ xác thực giao hàng; luồng commissioning là ngoại lệ riêng. maxAttempts=1; không lặp lệnh để chữa timeout. |
| HANDLE_PAYLOAD | action, service_request_id, compartment_id, items | Chưa tổng quát. Schema 3 chỉ LOAD/UNLOAD; yêu cầu DELIVERY của chính job; items phải khớp snapshot BE. Danh sách nhập khác snapshot không thay đổi được hàng của chuyến. |
| EXECUTE_SENSING | sensing_type; zone_id/window_sec cho AI; action/mapping_session_id/artifact_id/preview_rate_hz cho mapping | Chỉ cảm biến/chức năng đã hỗ trợ: ROBOT_HEALTH, SIDE_CLEARANCE, CROWD_DENSITY, RESTRICTED_ZONE, MAPPING ở schema 3. Alias RESTRICTED_AREA_INTRUSION thuộc cũ. FE đang chặn MAPPING bằng lý do BE không nhận, nhưng lý do này sai với đường gọi validator schema 3 hiện tại. |
| NOTIFY | notification_type, severity, data, require_ack, ack_policy, recipients, message ở schema 3 | Dùng chung để tạo Alert. severity INFO/WARNING/CRITICAL, ack_policy ANY/ALL; người nhận STAFF/ADMIN hoặc UUID tài khoản. require_ack=true không làm step tự chờ: cần WAIT EVENT ALERT_ACKNOWLEDGED, correlation_key lấy từ alert_id. |
| WAIT | wait_type; duration_sec hoặc event_type/correlation_key/incident_id | Dùng chung. DURATION chạy Pi, timeout lớn hơn duration. EVENT chạy BE; cần nguồn phát sự kiện đúng type/key và quyền. Gõ một tên event không làm hệ thống tự sinh event đó. |
| CHECK_CONDITION | expression gồm path, operator, value | Dùng chung. Toán tử EQ/NE/GT/GTE/LT/LTE/IN/EXISTS. Kết quả false vẫn là step thành công; WF quyết định nhánh. Đường dẫn phải có nguồn dữ liệu xác định; không suy diễn mọi output có /value. |
| SET_CONTEXT | operations gồm path, operation, value | Dùng chung cho /vars/tên. SET hoặc INCREMENT; INCREMENT cần số đã khởi tạo. Không ghi mapping_session_id/artifact_id do BE cấp. Gán một UUID vào vars không tạo được bản ghi hay quyền BE tương ứng. |

Các field cùng tồn tại trong catalog không có nghĩa được gửi chung cho mọi hành động. Ví dụ SPEAK chỉ được dùng các trường nói; COMMIT_MAP_ARTIFACT không nhận toàn bộ trường của các DATA_SERVICE khác.

## Các phát hiện cần xử lý

### P1 — Xác thực mặc định không chạy được theo runtime schema 3

`stepCatalog.js` mặc định method=STAFF_CONFIRMATION và vẫn cho chọn phương thức này. FE validate một WF CUSTOM chỉ chứa AUTHENTICATE không báo lỗi.

`AuthenticateStepHandler.execute()` luôn gọi `qrVerificationService.ensureForStep()`. `QrVerificationServiceImpl.requireLiveAuthentication()` từ chối method khác QR_CODE; `delivery()` yêu cầu DeliveryRequest. API STAFF_CONFIRMATION trong `AuthVerificationServiceImpl.create()` cũng từ chối schema 3 DELIVERY.

Hệ quả: chọn được/lưu cấu trúc được không chứng minh step chạy được. Cần giới hạn theo schema/nghiệp vụ; không tự thêm purpose xác thực mới khi BE chưa có.

### P1 — Chưa kiểm tra đủ tương thích step với loại WF/nguồn job

FE validate vẫn cho AUTHENTICATE và HANDLE_PAYLOAD trong WF CUSTOM. BE runtime scope chỉ cho hai loại này với DELIVERY của chính job. Chạy theo schedule không có DeliveryRequest cũng không đáp ứng được điều kiện đó.

CONTROL_HARDWARE UNLOCK phụ thuộc grant và CART_MAIN. Không thể dùng nhãn chung “Điều khiển phần cứng” để suy ra đã hỗ trợ mọi phần cứng/nghiệp vụ.

### P1 — Biến đã khai báo chưa bảo đảm job thực sự có dữ liệu

FE tự tạo destination_N_endpoint_id, service_request_id và items trong một số trường hợp. BE cho phép biến động, nhưng không có cơ chế chung biến tên bất kỳ thành dữ liệu của từng ServiceRequest. Delivery snapshot chỉ tự cấp các tên chuẩn pickup_endpoint_id/delivery_endpoint_id và metadata liên quan; Navigation/Escort có tên riêng.

Trong các điểm đọc getInputSchemaJson hiện tìm thấy, BE kiểm tra cấu trúc khai báo và references; chưa thấy bước dùng toàn bộ JSON Schema để kiểm tra inputs của job trước khi enqueue. Thiếu/sai dữ liệu có thể chỉ lộ khi resolve/validate step được chọn.

Cần chỉ rõ mỗi biến lấy từ người tạo job, default cấu hình, dữ liệu BE hay output. Input có thể tùy tên nhưng không thể tùy nguồn ngầm định.

### P1 — Đường dẫn output tự nhập có thể vượt quá contract thực

`stepOutputs.lookupOutput()` cho phép mọi đường dẫn con của object/array đánh dấu open và trả kind=unknown. `validateDocument()` bỏ kiểm tra kiểu output khi kind=unknown.

Đã tái hiện MOVE.endpoint_id trỏ tới `/outputs/<SELECT_TARGET>/data/does_not_exist_in_contract` mà FE không báo lỗi. Trường đó không được handler SELECT_TARGET tạo ra. BE resolveNode sẽ không tìm thấy giá trị nếu chạy tới step. Đây là lỗ hổng trực tiếp so với yêu cầu không dùng tham số/kết quả tự bịa.

Nên chỉ cho đường dẫn mở khi contract thực cho phép và có khai báo cấu trúc; không trình bày đường dẫn không xác minh như đã hợp lệ.

### P1 — Output đúng tên vẫn có thể không tồn tại

SELECT_TARGET khi hết điểm trả has_target=false và không có endpoint_id. FE ghi optional trong catalog nhưng vẫn cho MOVE dùng data/endpoint_id mà không yêu cầu nhánh kiểm tra has_target.

Đã tái hiện RESOLVE_TARGETS → SELECT_TARGET → MOVE với ánh xạ đó, FE không báo lỗi. Cần kiểm tra tồn tại/rẽ nhánh trước khi dùng trường tùy kết quả; “step nguồn thành công” chưa đủ.

### P2 — DATA_SERVICE.operation không điều khiển chức năng

FE có QUERY/CREATE/UPDATE; validator BE chấp nhận các giá trị đó, nhưng `DataServiceStepHandler` switch theo service_key và không đọc operation. Đã tái hiện QUERY_HOSPITAL_INFORMATION + operation=UPDATE được FE chấp nhận. Nó vẫn tra cứu thông tin, không cập nhật dữ liệu.

Nên bỏ/ẩn lựa chọn không có tác dụng hoặc giải thích rõ; chỉ bổ sung khả năng CRUD nếu BE thực sự triển khai.

### P2 — Nhãn actor và tham số mở chưa đồng nghĩa có kênh runtime

INTERACT cho PATIENT/USER/DEVICE nhưng `JobStepResponseService.respond()` kiểm tra phiên STAFF/ADMIN và quyền truy cập job; ADMIN mới là ràng buộc role được xét trực tiếp. Chọn actor=PATIENT không biến API thành API bệnh nhân. DISPLAY/CAPTURE_INPUT vẫn cần UI đọc/chuyển dữ liệu đúng cấu trúc.

`data`, `prompt_key`, `notification_type`, `event_type` có phần cho phép chuỗi/object mở là thiết kế của BE, không phải danh mục chức năng tự sinh. Phải biết bên nào hiển thị/xử lý/phát sự kiện. Với CREATE_FALL_INCIDENT, staff review còn đọc detection_event_id trong INTERACT.data; chỉ đặt field cùng tên ở cấp ngoài không thay thế được điều đó.

### P2 — Đính chính MAPPING

Trong `StepInputContractValidator.validate()`, EXECUTE_SENSING gọi sensing(..., modern). Với schema 3, modern=true nên nhánh enum có MAPPING được sử dụng, kể cả validateTemplate/validateResolved. Không thể kết luận “template BE không nhận MAPPING” từ tên tham số pi trong hàm sensing.

FE `stepContractChecks.js` hiện chặn vô điều kiện MAPPING với thông báo đó. Test hiện có cũng khẳng định thông báo cũ nên vẫn pass. Đây là lỗi đánh giá trong tài liệu trước và là chặn sai ở FE theo mã BE hiện tại; lần rà soát này sửa tài liệu, chưa sửa chức năng.

MAPPING vẫn có điều kiện thực: tính năng enabled, timeout theo cấu hình BE, maxAttempts=1, có STOP definition, phiên/artefact do BE cấp. MappingLifecycleService.prepareSelection() cấp `/vars/mapping_session_id` và `/vars/artifact_id`; không yêu cầu người dựng tạo UUID. FE hardcode START tối thiểu 55 giây cũng chưa phản ánh mọi cấu hình startTimeoutSec của BE.

### P2 — Nguồn dữ liệu giao hàng còn lệch ở màn tạo yêu cầu

`DeliveryRequests.Create` yêu cầu expectedSenderAccountId và expectedReceiverAccountId. Override FE cho POST /api/v1/delivery-requests hiện không khai báo hai trường này, dù BE snapshot/QR cần chúng. Đây là rủi ro tích hợp của luồng cấp dữ liệu cho WF, cần đối chiếu màn tạo yêu cầu/API; không được giả định chỉ chọn hai endpoint là đã có đầy đủ dữ liệu xác thực.

### Giới hạn cấu hình thực thi chung

timeoutSec được runtime sử dụng. CONTROL_HARDWARE cấm tự retry. Không thấy đường điều phối schema 3 hiện tại dùng maxAttempts/retryCodesJson/retryDelaySec để tự thử lại mọi loại step; UI không nên hứa retry chung. maxVisits không làm editor tự hỗ trợ vòng lặp: FE vẫn chặn graph có cycle. NOTIFY require_ack chỉ tạo yêu cầu ACK; phải nối WAIT/EVENT nếu cần chờ.

## Hướng cấu hình nên dùng

1. BE là nguồn chuẩn cho schema từng step/hành động, giá trị enum, kiểu output và điều kiện runtime. FE hiện hardcode catalog, nên cần contract test đối chiếu thực hoặc API metadata đủ chi tiết.
2. Giữ MOVE trung lập: endpoint_id lấy từ biến của WF, không gắn mặc định nhận/giao. Mỗi biến có nguồn cấp rõ ràng; input của người dùng và dữ liệu BE cấp phải được phân biệt trên UI.
3. Chỉ hiển thị action/step tương thích với loại WF và runtime đang hỗ trợ. AUTHENTICATE/HANDLE_PAYLOAD phải thể hiện rõ phạm vi giao hàng hiện có.
4. Publish phải kiểm tra cả cấu trúc, tương thích nghiệp vụ, nguồn cấp dữ liệu và trường optional/nullable; tạo job kiểm tra inputs trước khi enqueue.
5. Giữ đường dẫn nâng cao nhưng không coi giá trị chưa có trong contract/nguồn cấp là đã xác minh. ID xác thực, quyền, kết quả và định danh phiên mapping phải lấy từ BE thật.

## Cách đã xác minh và giới hạn

Đã đọc catalog, structured editors, reference picker, input preview, validateDocument và mapping FE; BE template/resolved/scope validators, snapshot factory, executor policy, từng server handler, phản hồi staff, QR, selection, event và mapping lifecycle.

Đã chạy lại 78 kiểm thử model/contract hiện có: tất cả pass. Đồng thời chạy script tái hiện riêng cho các trường hợp FE chấp nhận sai/thiếu kiểm tra nêu trên; kết quả này cho thấy bộ test cũ chưa bao phủ tính dùng chung và nguồn cấp dữ liệu. Không sửa test cũ để biến lỗi thành hợp lệ.

Chưa gọi API BE thật, chưa dispatch robot, chưa kiểm tra DB production hay cấu hình rollout/mapping của môi trường chạy. Các kết luận runtime dựa vào đường thực thi trong mã nguồn, không khẳng định hệ thống thật đã chạy thành công/thất bại các ca đó.

## Các nguồn mã chính

- FE: `src/features/workflows/designer/stepCatalog.js`, `stepOutputs.js`, `stepContractChecks.js`, `designerModel.js`; `src/pages/Workflows/designer/StructuredEditors.jsx`, `InputPreview.jsx`; `src/features/api/contractOverrides.js`.
- BE: `validation/StepInputContractValidator.java`, `StepInputScopeValidator.java`, `WorkflowStepContractValidator.java`, `StepExecutionPolicy.java`, `Schema3StepResultContractValidator.java`, `WorkflowExecutionReadiness.java`.
- BE runtime: `service/impl/JobStepInputResolverImpl.java`, `RequestJobInputSnapshotFactory.java`, `JobExecutionServiceImpl.java`, `QrVerificationServiceImpl.java`, `AuthVerificationServiceImpl.java`, từng `*StepHandler.java`, `service/JobStepResponseService.java`, `WorkflowEventServiceImpl.java`, `NavigationTargetService.java`, `StaffIncidentReviewPolicy.java`, `mapping/MappingLifecycleService.java`.
