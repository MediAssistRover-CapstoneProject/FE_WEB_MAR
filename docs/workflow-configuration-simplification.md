# Đề xuất đơn giản hóa cấu hình workflow

Ngày rà soát: 06/11/2026. Đối chiếu mã FE và BE trong workspace. Đây là đề xuất thiết kế; chưa đổi hành vi ứng dụng, contract BE hay dữ liệu. Các phát hiện runtime bổ sung xem [đánh giá tính dùng chung](workflow-step-generality-audit.md).

## Mục tiêu

Người dựng chọn việc cần làm, nối thứ tự, chọn dữ liệu nghiệp vụ. FE tự tạo khóa, kiểu dữ liệu và tham chiếu; vẫn cho xem/sửa cấu hình nâng cao khi cần. Một dữ liệu chỉ khai báo một lần, mỗi bước cho biết đang dùng dữ liệu nào.

Không lấy việc giảm số trường hiển thị làm bằng chứng workflow chạy được. Cấu hình phải có đủ dữ liệu, nguồn cấp thực, đường đi hợp lệ và điều kiện runtime tương ứng.

## Hiện trạng đã kiểm tra

- Bấm thư viện đã có thể nối bước tiếp trên luồng chính, giữ nhánh lỗi/hết giờ. Đây là nền tốt, không cần thay toàn bộ canvas.
- `ValueBinding` hiển thị bộ chọn Cố định / Biến đầu vào / Kết quả bước trước / Biến ngữ cảnh cho hầu hết trường. MOVE mặc định có 4 bộ chọn nguồn; NOTIFY có 7, chưa tính control bên trong cấu trúc lồng.
- `addStep()` tự tạo map_id, destination_N_endpoint_id, service_request_id, items ở một số loại bước. UI chưa mô tả rõ dữ liệu nào người chạy phải nhập, dữ liệu nào BE cấp; thêm MOVE luôn sinh điểm đích mới dù người dùng có thể muốn quay về điểm cũ.
- Tạo biến tại bước dùng `window.prompt` để hỏi khóa kỹ thuật. Default của biến, lựa chọn và một số danh mục vẫn cần JSON. Nhãn của biến có thể đổi nhưng màn hình ưu tiên khóa/kiểu hơn ý nghĩa nghiệp vụ.
- Inspector hiện đặt nhiều nội dung trước trường cần điền: mô tả, cách hoạt động, thực thi/xử lý sự cố, preset, nhóm tác vụ. Kết quả đầu ra và đường dẫn kỹ thuật cũng xuất hiện trong luồng cấu hình chính.
- Thử trực tiếp model: AUTHENTICATE trong CUSTOM có method=STAFF_CONFIRMATION, `validateDocument()` trả không có lỗi. BE `AuthenticateStepHandler` gọi QR verification; `requireLiveAuthentication()` kiểm tra phương thức QR_CODE và DeliveryRequest. Đây là lỗi tương thích cần xử lý trước khi thêm thao tác tự động.
- API step-types hiện chỉ có mã, tên và executor, chưa có schema trường/default/output/nguồn dữ liệu. Không thể chỉ gọi API này rồi tự tạo đầy đủ form động.

## 1. Chọn cách workflow nhận dữ liệu

Khi tạo workflow, ngoài tên/loại dịch vụ, cần biết nó được gọi từ đâu. Các lựa chọn chỉ hiển thị khi ứng dụng thực sự có luồng tạo job tương ứng:

| Nguồn chạy | Người dùng cần làm | Điều kiện |
|---|---|---|
| Yêu cầu nghiệp vụ | Chọn giao hàng, dẫn đường hoặc hộ tống theo luồng được tích hợp | Dùng đúng snapshot của yêu cầu đó |
| Lịch chạy | Khai báo dữ liệu cố định hoặc input template của lịch | Không giả định có DeliveryRequest để xác thực/handover |
| Luồng gọi khác đã hỗ trợ | Khai báo rõ caller truyền gì | Chỉ cho dùng dữ liệu mà caller đó cấp |

Chọn serviceType=DELIVERY chưa đủ để chứng minh job có yêu cầu giao hàng. Metadata của designer chỉ mô tả ý định; màn gọi workflow và BE vẫn phải kiểm tra điều kiện thật.

Workflow cũ chưa rõ nguồn chạy: giữ nguyên và đánh dấu cần kiểm tra nguồn, không tự gán một nguồn mới.

## 2. Tách cách trình bày dữ liệu thành ba nhóm

| Nhóm UI | Ví dụ | Cách cấu hình |
|---|---|---|
| Người chạy cần cung cấp | Điểm A, điểm B, nội dung cần đọc | Tạo tại trường đang cấu hình; tự sinh khóa và kiểu; người dựng chỉ đặt nhãn |
| Hệ thống lấy từ yêu cầu | Mã yêu cầu giao hàng, hàng hóa, điểm nhận/giao trong DeliveryRequest | Chọn từ danh mục đúng loại yêu cầu, hiển thị nguồn; không nhập UUID/hàng giả |
| Dữ liệu có sau khi chạy bước | Kết quả xác thực, mã cảnh báo, kết quả chọn điểm, biến ngữ cảnh | Chọn bước và kết quả hợp lệ; không tạo lại thành input |

Đây là nhóm trình bày, không phải thêm các root tham chiếu BE mới. Ví dụ dữ liệu yêu cầu vẫn có thể nằm ở `/inputs/service_request_id`; kết quả bước dùng `/outputs/...`, ngữ cảnh dùng `/vars/...` theo resolver hiện có.

Mỗi dữ liệu nên có: nhãn nghiệp vụ, loại/định danh nghiệp vụ, nguồn cấp, bắt buộc hay không, giá trị mặc định nếu hợp lệ, bước đang sử dụng. Khóa kỹ thuật và JSON Schema nằm trong chi tiết nâng cao.

Quy tắc tái sử dụng:

- Dùng chung bản đồ khi phù hợp; mỗi MOVE vẫn chọn rõ điểm đến.
- Thêm MOVE mới cho chọn **Điểm mới / Dùng điểm đã có / Điểm từ yêu cầu / Kết quả bước trước**. Không tự dùng endpoint của MOVE gần nhất.
- Không nối hai UUID chỉ vì cùng là chuỗi: map, endpoint, service request, tài khoản, vùng và quyền phải phân biệt.
- Đổi nhãn không đổi khóa. Đổi khóa có chủ đích phải cập nhật mọi tham chiếu. Khóa chuẩn do BE cấp không được tùy tiện đổi như biến do người dựng tạo.
- Xóa bước không tự xóa dữ liệu dùng chung; hiển thị dữ liệu không còn dùng và cho dọn có chủ đích.
- Đổi nguồn/hành động không âm thầm bỏ cấu hình cũ; báo các trường/mapping bị ảnh hưởng và hỗ trợ hoàn tác.

## 3. Form bước có ba phần

**Cấu hình chính:** tên bước, hành động, các dữ liệu nghiệp vụ cần chọn/nhập. Ưu tiên đưa người dùng vào trường còn thiếu đầu tiên.

**Tùy chọn:** tham số đã có mặc định hợp lệ, chẳng hạn ngôn ngữ, tốc độ, âm lượng, thời gian chờ tối đa. Hiện tóm tắt giá trị đang áp dụng ngay cả khi phần này đóng.

**Nâng cao:** nhóm tác vụ, mã, audit, mapping/params JSON, đường dẫn tùy chỉnh và phần contract cũ. Output thu gọn thành “Dữ liệu bước này cung cấp”; đường dẫn chỉ mở khi cần kiểm tra.

Không đồng nhất “required của BE” với “người dùng phải nhập”. Trường required đã được FE gán hợp lệ vẫn phải gửi đủ khi lưu; trường required còn thiếu hoặc lỗi phải hiện ra, kể cả nếu bình thường thuộc phần thu gọn. Thời gian chờ tối đa của bước chờ người dùng cần dễ thấy trong Tùy chọn, không giấu sâu trong JSON.

Mỗi trường mặc định chỉ hiện một giá trị dễ hiểu, ví dụ `Điểm đến: Điểm A · Chọn khi chạy`, kèm **Đổi nguồn**. Bấm Đổi nguồn mới mở các lựa chọn phù hợp:

- Chọn giá trị cố định.
- Hỏi khi chạy / dùng dữ liệu đã khai báo.
- Lấy từ yêu cầu đang dùng, nếu nguồn chạy hỗ trợ.
- Lấy kết quả bước trước, nếu kiểu và đường chạy đáp ứng.
- Biến ngữ cảnh/đường dẫn tùy chỉnh trong phần nâng cao.

Trường chỉ có một nguồn runtime hợp lệ nên hiện nguồn đó thay vì đưa mọi lựa chọn. Chẳng hạn quyền mở ngăn phải lấy từ xác thực BE; không cung cấp form tự điền verification_id như cấu hình thông thường.

## 4. Cấu hình chính của đủ 11 loại bước

| Loại bước | Người dựng thao tác chính | Phần được xử lý sẵn / mở khi cần |
|---|---|---|
| MOVE | Chọn điểm đến và nguồn của điểm | Bản đồ dùng chung có nguồn rõ ràng; mode/tốc độ hợp lệ ở Tùy chọn; vẫn đổi riêng từng bước được |
| INTERACT | Chọn Nói / Hiển thị / Xác nhận / Nhập; điền nội dung | Preset mã lời nhắc; ngôn ngữ/âm lượng/vai trò/thông tin phụ theo hành động. Không tự tạo mã có ý nghĩa runtime nếu chưa có bên xử lý |
| DATA_SERVICE | Chọn một trong các dịch vụ BE thực hỗ trợ; điền trường dịch vụ đó cần | Bỏ lựa chọn operation khỏi form cơ bản vì handler hiện chọn theo service_key; vẫn bảo toàn trường cũ khi mở lại |
| AUTHENTICATE | Chọn người gửi hoặc người nhận | Với runtime schema 3 hiện tại dùng QR giao hàng và yêu cầu của job; kiểm tra đúng nguồn chạy; không hỏi mã xác minh |
| CONTROL_HARDWARE | Chọn khóa hoặc mở; với mở, chọn bước xác thực cấp quyền | CART_MAIN, cấu trúc authorization từ output thật, maxAttempts=1; thiếu/không rõ bước xác thực thì bắt chọn |
| HANDLE_PAYLOAD | Chọn nhận hàng hoặc giao hàng | service_request_id và items từ snapshot giao hàng; xem danh sách mẫu/nguồn, không chỉnh hàng khác snapshot để giả lập |
| EXECUTE_SENSING | Chọn loại cảm biến; chọn vùng nếu cần | Chỉ hiện trường của loại đã chọn; mapping có phiên/tệp BE cấp, điều kiện feature và timeout riêng |
| NOTIFY | Nội dung, người nhận, mức độ | Dữ liệu và loại thông báo mặc định hợp lệ, điều chỉnh nâng cao. “Yêu cầu xác nhận” giải thích có chờ hay chỉ tạo yêu cầu ACK |
| WAIT | Nhập số giây; hoặc chọn sự kiện thực được hỗ trợ và bước cấp mã liên kết | Timeout phù hợp; không coi tên event tự nhập là sự kiện hệ thống sẽ phát |
| CHECK_CONDITION | Chọn dữ liệu → toán tử → giá trị; chọn nhánh Đúng/Sai | Tự tạo expression và mapping transition; không buộc nhập pointer/mã bước |
| SET_CONTEXT | Chọn/tạo biến nội bộ → Gán/Cộng → giá trị | Tự xác định kiểu khi chắc chắn; kiểm tra đã khởi tạo khi Cộng; không ghi đè biến phiên do BE quản lý |

Các giới hạn runtime không được xóa khỏi validation chỉ vì form rút gọn. MAPPING đang bị FE chặn bằng lý do không đúng với validator schema 3; cần sửa đối chiếu trước khi quảng bá như tính năng dễ dùng. Mẫu giao hàng QR một nút hiện có vẫn ghi runtimeReady=false, không dùng mẫu đó làm bằng chứng chạy hoàn chỉnh.

## 5. Tự nối dữ liệu khi chắc chắn, gợi ý khi chưa chắc

Có thể tự áp dụng nếu nguồn đã có, đúng nghiệp vụ/kiểu/cấu trúc và tồn tại trên mọi đường chạy tới bước dùng:

- Bản đồ dùng chung cho MOVE.
- Dữ liệu chuẩn của yêu cầu hiện tại khi nguồn chạy được xác định.
- Cấu trúc quyền mở ngăn từ bước xác thực đã chọn, đúng purpose và điều kiện grant.
- Timeout gợi ý cho WAIT DURATION theo thời lượng người dùng nhập, nếu timeout chưa được đặt thủ công. Thay đổi phải hiển thị, không ghi đè timeout người dùng đã chỉnh.

Chỉ gợi ý khi có nhiều lựa chọn hợp lệ, chẳng hạn hai bước xác thực hoặc nhiều điểm. Không lấy bước “gần nhất trên màn hình” làm nguồn mặc định.

Trường optional/nullable cần chứng minh có trên nhánh đang đi hoặc có xử lý fallback. Ví dụ SELECT_TARGET trả has_target=false thì không được cho MOVE dùng endpoint_id như luôn tồn tại. Có thể cung cấp thao tác “Thêm nhánh Có điểm / Hết điểm” nhưng phải tạo graph thật và cho xem trước.

## 6. Ví dụ trải nghiệm mong muốn

Workflow tùy biến `Di chuyển → Chờ → Di chuyển → Thông báo`:

1. Bấm Di chuyển: chọn nguồn bản đồ một lần; tại Điểm đến bấm “Hỏi khi chạy”, đặt nhãn “Điểm A”. FE tạo kiểu endpoint và khóa ổn định.
2. Bấm Chờ: nhập 5 giây; timeout gợi ý và xử lý lỗi hiển thị trong tóm tắt.
3. Bấm Di chuyển: chọn “Điểm mới khi chạy”, đặt “Điểm B”; hoặc chọn “Dùng Điểm A” nếu cần quay về. Không phải tự tạo/nhập destination_2_endpoint_id.
4. Bấm Thông báo: điền nội dung, chọn người nhận và mức độ.
5. Xem trước dữ liệu cần cung cấp: Bản đồ (nếu hỏi khi chạy), Điểm A, Điểm B. Không hiện khóa kỹ thuật, quyền, mã yêu cầu hoặc output như trường người chạy phải nhập.

Nếu nguồn chạy là DeliveryRequest, người dựng có thể chọn Điểm nhận / Điểm giao từ yêu cầu thay vì tự khai báo A/B. Đó là một lựa chọn nguồn rõ ràng, không đổi nghĩa MOVE hay hardcode mọi workflow thành giao hàng.

## 7. Giữ đủ cấu hình và tương thích BE

- Giá trị cố định của step vẫn biên dịch vào paramsJson; nguồn động vào inputMappingJson; input do người chạy cấp vào inputSchemaJson/defaultInputsJson; UI metadata vào inputUiJson. Không gửi tên hiển thị thay cho UUID.
- Giá trị mặc định có thể được caller ghi đè theo luồng BE hiện tại; không gọi nó là “cố định/khóa”. Nếu chọn bản đồ cố định dùng chung ở designer, cần biên dịch giá trị cố định vào các step liên quan hoặc có ràng buộc BE thực, không chỉ đặt defaultInputsJson rồi tuyên bố khóa bản đồ.
- Nguồn lấy từ yêu cầu có thể biểu diễn bằng metadata UI nhưng phải được caller/BE đối chiếu thực. Không thêm nhãn “BE cấp” rồi giả định runtime biết cách cấp một biến tùy tên.
- Chuyển form cơ bản/nâng cao không làm mất trường, giá trị false/0, cấu trúc lồng, metadata hoặc tham chiếu hiện có. Cấu hình không biểu diễn được ở form đơn giản phải hiện dấu hiệu “Có cấu hình nâng cao”, không bị ghi lại bằng default.
- Cấu hình cũ chưa hỗ trợ vẫn xem nguyên trạng hoặc tạo bản chuyển đổi rõ ràng. Không tự ghi lại tất cả workflow khi nâng UI.
- Lỗi tại trường đang đóng tự mở đúng phần và đưa tới bước liên quan. Chỉ publish sau khi đủ validation; không xem “chưa có lỗi hình dạng” là runtime đã sẵn sàng.

## 8. Thứ tự triển khai

1. **Đúng contract và nguồn dữ liệu:** QR/phạm vi DeliveryRequest, nguồn snapshot, optional outputs và đường dẫn chưa xác minh, điều kiện mapping. Thêm kiểm tra cho các trường hợp đã tái hiện.
2. **Giảm thao tác tại từng bước:** ba phần form, Đổi nguồn theo nhu cầu, trường nhập/chọn mặc định theo kiểu, tạo biến bằng nhãn ngay tại chỗ; tóm tắt vẫn cho biết giá trị đang áp dụng.
3. **Dữ liệu dùng chung:** danh sách có nguồn và nơi sử dụng; tái sử dụng điểm; khóa dữ liệu BE cấp; cập nhật màn xem trước/màn gọi tương ứng. Không chỉ đổi tên tab “Biến”.
4. **Gợi ý ghép bước:** preset nghiệp vụ tương thích, nối dữ liệu có chứng minh, thêm nhánh kiểm tra theo lựa chọn và xem trước thay đổi. Giữ thao tác ghép step tự do.

Thay đổi UI/phân nhóm phần lớn làm tại FE. Kiểm tra input trước enqueue và bảo đảm nguồn chạy ở mọi caller cần rà/tăng cường BE. Metadata schema chi tiết từ BE là cải tiến sau, API step-types hiện tại chưa đáp ứng.

## Tiêu chí nghiệm thu

- Dựng ví dụ bốn bước trên không nhập mã biến, UUID thô, JSON hay pointer.
- Không bắt chọn bốn nguồn cho một MOVE đơn giản; khi cần vẫn chuyển nguồn của từng trường được.
- Hai điểm độc lập không bị gộp ngầm; quay lại điểm cũ không sinh thêm input không cần thiết.
- Chế độ hỏi khi chạy, cố định, mặc định có thể ghi đè và dữ liệu yêu cầu có hành vi khác nhau, đúng nhãn.
- AUTHENTICATE/HANDLE_PAYLOAD không được báo sẵn sàng khi thiếu luồng DeliveryRequest phù hợp; không nhập/xây quyền xác thực giả.
- Lỗi output optional/nhánh chưa chạy/kiểu sai bị chặn trước publish; không chọn nguồn chỉ vì cùng là UUID.
- Mọi tham số hiện có vẫn truy cập được; round-trip form → payload → mở lại giữ nguyên giá trị/cấu trúc, kể cả cấu hình nâng cao.
- Thử cả cấu hình thiếu và cấu hình hợp lệ cho 11 loại bước, thay đổi hành động/nguồn, undo/redo và các nhánh. Kiểm thử mô hình/fixture không thay cho xác nhận runtime trên môi trường thật.

## Mã đã đối chiếu

FE: `DesignerInspector.jsx`, `DesignerParameterField.jsx`, `ValueBinding.jsx`, `ReferencePicker.jsx`, `StructuredEditors.jsx`, `InputPreview.jsx`; `designerModel.js`, `stepCatalog.js`, `stepContractChecks.js`, `referenceOptions.js`, `designerService.js`, `qrDeliveryDraft.js`.

BE: `RequestJobInputSnapshotFactory.java`, `JobStepInputResolverImpl.java`, `StepInputScopeValidator.java`, `StepExecutionPolicy.java`, `AuthenticateStepHandler.java`, `QrVerificationServiceImpl.java`, `DataServiceStepHandler.java`, `WorkflowResponses.java`, `WorkflowServiceImpl.java`, `ScheduleServiceImpl.java`.
