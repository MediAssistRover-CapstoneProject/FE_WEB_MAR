# Rà soát dựng workflow và truyền dữ liệu — 05/11/2026

Bổ sung sau khi rà lại runtime: xem [đánh giá tính dùng chung và nguồn tham số của đủ 11 step](workflow-step-generality-audit.md). Báo cáo bổ sung phát hiện các lỗi mà kiểm thử cấu trúc trước chưa bao phủ; không coi các kết quả kiểm tra cũ là bằng chứng mọi WF đều chạy được.

## Kết luận

Nên để người thiết kế chọn hành động nghiệp vụ, điểm A/B và các nhánh cần rẽ; FE tạo tham chiếu, BE kiểm tra và điều phối, Pi thực thi phần cứng. Nối step xác định thứ tự chạy, không có nghĩa mọi trường của step trước được tự sao chép sang step sau. Không suy luận rằng MOVE sau luôn dùng endpoint của MOVE trước, vì điều đó dễ khiến robot quay lại A thay vì giao tới B.

Đã bổ sung thao tác bấm thư viện để thêm và nối bước sau bước đang chọn trên luồng chính. Bước mới được chèn trước kết thúc SUCCEEDED; nhánh lỗi/hết giờ hiện có được giữ. Bước rẽ nhánh cần người thiết kế nối rõ. Kéo thả tiếp tục tạo bước rời. Có thể hoàn tác cả thao tác thêm và nối cùng lúc.

## Endpoint và tham số dùng chung

MOVE truyền UUID ở `endpoint_id`; không gửi tên điểm, phòng hay tự nhập tọa độ. Contract hiện tại vẫn yêu cầu `map_id`, `mode`, `max_speed_mps`. Các MOVE trên cùng bản đồ dùng chung `/inputs/map_id`, nhưng có điểm đích riêng, ví dụ `/inputs/pickup_endpoint_id` và `/inputs/delivery_endpoint_id`.

BE `StepInputScopeValidator` đối chiếu endpoint với danh mục, bản đồ của job và bản đồ hiện tại của robot; MOVE yêu cầu endpoint active/accessibile. Pi dùng danh mục điều hướng đã đồng bộ để tra điểm. Với đích là nhóm endpoint, phải qua RESOLVE_TARGETS → SELECT_TARGET và dùng trực tiếp output `data/endpoint_id`; không lấy tùy tiện một phần tử rồi bỏ qua quyền lựa chọn do BE ghi nhận.

Bộ lọc biến trước đây chỉ phân biệt kiểu dữ liệu và một phần output UUID. Vì vậy UUID `service_request_id` vẫn xuất hiện ở danh sách endpoint. Đã sửa để nhận diện cả khóa input như `pickup_endpoint_id`, `delivery_endpoint_id`, `service_request_id` và path output. Biến có định danh khác loại bị loại khỏi gợi ý và chặn trước khi lưu. Biến chuỗi có tên tùy chỉnh vẫn được giữ tương thích; BE tiếp tục là nơi xác thực giá trị thực.

`service_request_id` là một UUID yêu cầu giao hàng dùng chung, không phải điểm đến. AUTHENTICATE và HANDLE_PAYLOAD hiện tự tạo/dùng cùng biến này. HANDLE_PAYLOAD dùng cùng danh sách items của job; BE đối chiếu với snapshot giao hàng. Quyền mở ngăn phải dùng kết quả AUTHENTICATE đúng mục đích người gửi/người nhận, không tạo verification hay expiry giả.

## Đối chiếu 11 loại step

| Step | Thực thi schema 3 | Cấu hình và nối dữ liệu cần chú ý |
|---|---|---|
| MOVE | Pi | map + endpoint UUID, mode, tốc độ; output reached/endpoint_id. A/B phải chọn riêng. |
| AUTHENTICATE | BE | purpose cố định và service_request_id của DELIVERY; schema 3 yêu cầu QR_CODE nhưng FE đang mặc định STAFF_CONFIRMATION, cần sửa. QR sai còn thời hạn giữ bước chờ. |
| CONTROL_HARDWARE | Pi | action/ngăn; UNLOCK cần grant BE từ đúng bước xác thực. maxAttempts = 1. Lệnh hoàn tất không thay thế kiểm tra khóa/cửa vật lý. |
| HANDLE_PAYLOAD | BE | LOAD/UNLOAD, yêu cầu, ngăn, items đúng snapshot; dùng output confirmed. |
| INTERACT | Pi nếu SPEAK; còn lại BE | prompt/action/data; mẫu xác nhận đóng cửa dùng closed, kiểm tra khóa dùng locked. Không dùng /value cho mọi loại output. |
| DATA_SERVICE | BE | service_key cố định; trường bắt buộc và output khác theo dịch vụ. SELECT_TARGET đọc targets từ RESOLVE_TARGETS; CHECK_TARGET đọc endpoint UUID. |
| EXECUTE_SENSING | Pi | sensing_type, zone/window theo loại; timeout lớn hơn cửa sổ đo. BE schema 3 nhận MAPPING khi đủ điều kiện runtime; thông báo FE chặn loại này với lý do BE không nhận là sai. |
| NOTIFY | BE | loại thông báo, mức độ, người nhận, data và require_ack; output ghi nhận alert, không thay xác nhận giao hàng. |
| WAIT | Pi nếu DURATION; BE nếu EVENT | thời gian chờ hoặc event_type + correlation_key; timeout DURATION lớn hơn duration_sec. |
| CHECK_CONDITION | BE | đọc field có thật từ input/output/vars; true/false thuộc outcome SUCCESS. FAILURE/TIMEOUT là lỗi thực thi của bước kiểm tra. |
| SET_CONTEXT | BE | SET/INCREMENT trên /vars/tên; INCREMENT phải có biến số khởi tạo trước. Không sửa định danh mapping do BE cấp. |

Output chỉ được dùng sau bước thành công và phải tồn tại trên mọi đường chạy tới nơi sử dụng. Output từ một nhánh không tự có khi các nhánh nhập lại. FE đã có kiểm tra phạm vi này; BE chỉ đưa output SUCCEEDED vào runtime context. Sau nhánh lỗi, dùng nhánh xử lý lỗi thay vì giả định có output thành công.

## Lỗi, timeout, mất kết nối và đối chiếu

Khi không vẽ FAILURE/TIMEOUT, `toPayload()` tự sinh transition mặc định tới RECOVERY_REQUIRED. Giao diện nay hiển thị điều này ở mỗi step. Người dựng chỉ cần vẽ nhánh ngoại lệ khi có hành vi nghiệp vụ riêng; không phải kéo hai dây cho mọi step.

BE `WorkflowRuntimeTransitionServiceImpl` chọn nhánh theo kết quả thực và interruption STEP_TIMEOUT. Step server hết hạn được đánh dấu TIMED_OUT. Với Pi, `MqttOperationControlService` ghi yêu cầu ngắt, gửi CANCEL_STEP và kiểm tra bằng chứng dừng; thiếu ACK/kết quả/bằng chứng hoặc hết hạn hủy có thể đưa job vào RECOVERY_REQUIRED. HELLO/journal sau kết nối lại được đối chiếu trong `MqttSessionRegistry`; không phát lại thao tác vật lý một cách mặc định.

Như vậy “tự đối chiếu BE” đã có một phần ở runtime, nhưng không đồng nghĩa tự sửa và tự tiếp tục mọi lỗi. `MqttOperationRecoveryService.reconcile()` có bước đối chiếu do nhân viên thực hiện. Kết quả/ACK tới muộn không tự xóa quyết định recovery. `maxAttempts` không phải cam kết mọi thao tác schema 3 đều tự chạy lại; đặc biệt không tăng retry servo để xử lý timeout.

## Luồng giao nhận nên dựng

Với contract giao nhận hiện có, mỗi chặng gồm MOVE → AUTHENTICATE → kiểm tra verified → UNLOCK → HANDLE_PAYLOAD → kiểm tra confirmed → yêu cầu đóng cửa → kiểm tra closed → LOCK → kiểm tra khóa → kiểm tra locked. Lặp cho bên nhận rồi kết thúc. Bộ dữ liệu dùng chung là map, service_request và items; A/B là hai endpoint riêng; grant của người gửi và người nhận riêng.

Để giảm thêm thao tác thiết kế, nên đóng gói các chặng lặp thành mẫu nghiệp vụ với ánh xạ có thể xem/sửa, thay vì bỏ các bằng chứng xác thực/giao nhận. Mẫu “giao hàng QR một nút” hiện có 10 bước nhưng được đánh dấu `runtimeReady: false`: phần gộp xác nhận hàng/cửa còn cần tích hợp BE/Pi và màn robot; chưa thể xem là luồng hoàn chỉnh đã chạy được.

## Phạm vi kiểm tra

Đã đọc model, catalog/validator FE; BE input resolver, scope/input/output validators, executor policy, orchestrator, runtime transition, timeout/cancel/recovery và navigation selection. Có kiểm thử contract cho 11 loại, graph giao nhận và round trip; bổ sung kiểm thử bộ lọc định danh và thêm/nối nhanh. Browser test dùng API giả lập, không dispatch robot. Đây là kiểm tra mã nguồn và UI với mock, không thay thế kiểm thử robot và BE đang chạy.

Kết quả: 78 kiểm thử model/contract đạt; ba browser script `workflow-quick-build.browser.mjs`, `workflow-step-config.browser.mjs`, `workflow-designer.browser.mjs` đạt; `npm.cmd run build` thành công. Build còn cảnh báo kích thước bundle và directive từ thư viện.
