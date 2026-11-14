# Kiểm tra FE

## Lời nói workflow

Tab `/admin/voice-scripts?tab=workflow-speech` tải danh sách phân trang trước,
chỉ tải graph khi chọn workflow. Danh sách gồm các workflow hiện có; workflow
không có bước SPEAK hiển thị hướng dẫn thêm bước. Request đọc được hủy khi đổi
lựa chọn/rời tab và giới hạn chờ 20 giây.

```powershell
node --test tests/workflow-speech.test.mjs
$env:WORKFLOW_TEST_URL='http://localhost:5173'
node tests/workflow-speech.browser.mjs
node tests/workflow-speech-loading.browser.mjs
```

Browser tests giả lập API; kiểm tra 201 workflow không tải trước graph, hủy
request, xử lý lỗi, tải lại, timeout và luồng sửa/lưu/phát hành lời nói.

## Workflow Designer kéo thả

Trang `/workflow` đã thay trình tạo workflow cũ. Xem [hướng dẫn và contract đầu vào](../docs/workflow-designer.md).

Đã gỡ trang/menu Danh mục quy trình để dùng thư viện trong Thiết kế quy trình.
`/admin/workflow-catalog` và `?screen=Workflow%20Management` chuyển Admin về `/workflow`;
Staff được chuyển về Vận hành trực tiếp. Kiểm tra menu desktop/mobile và các liên kết cũ bằng `tests/sidebar.browser.mjs`.

```powershell
node --test tests/workflow-designer.test.mjs tests/workflow-step-contracts.test.mjs tests/patrol-workflow.test.mjs tests/api-client.test.mjs tests/backend-contract.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5186 --strictPort
# Terminal khác:
node tests/workflow-designer.browser.mjs
node tests/workflow-step-config.browser.mjs
```

Browser test dùng `@playwright/test`, Chrome cài sẵn và API giả lập; không gọi BE thật.
Đặt `CHROME_EXECUTABLE` hoặc `WORKFLOW_TEST_URL` nếu cần. File `workflow-crud.browser.mjs`
chuyển sang chạy bộ test mới. Các fixture minh họa editor cũ bên dưới là tài liệu lịch sử.

## Trang vận hành trực tiếp (03/11/2026)

Trang `/admin/live-operations` dùng UI riêng: nhóm Đang hoạt động / Cần xử lý /
Lịch sử; danh sách có tên quy trình, robot, điểm đến; tìm kiếm và lọc theo trạng thái,
robot, quy trình, ngày. Chi tiết đưa lỗi và yêu cầu xác nhận lên trước tiến trình.
Nhật ký tải trực tiếp và phân trang; phục hồi có bảng bằng chứng riêng.
Các thao tác phụ thuộc trạng thái, quyền tài khoản và bước hiện tại.
SSE đồng bộ cả danh sách và chi tiết; REST tự làm mới mỗi 15 giây, giữ dữ liệu
gần nhất khi lỗi và không ghi đè phiên bản SSE mới bằng phản hồi REST cũ.

```powershell
node --test tests/live-operations.test.mjs tests/backend-contract.test.mjs tests/backend-presentation.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort
# Chạy ở terminal khác với PLAYWRIGHT_MODULE và CHROME_EXECUTABLE đã cấu hình:
node tests/live-operations.browser.mjs
node tests/live-operations-reliability.browser.mjs
npm run build
```

Browser test giả lập toàn bộ API; không gửi lệnh đến robot thật. Bao phủ xác nhận
bước, robot đang rảnh, hủy đang chờ xử lý, công việc đã kết thúc, phục hồi, nhật ký
lỗi/phân trang, đổi lựa chọn khi phản hồi chậm, đồng bộ SSE, dữ liệu REST cũ,
quyền STAFF và bố cục 390/1024/1440px. Ảnh nằm trong `.workstation-build/live-operations/`.

Trang Nhiệm vụ đã được gỡ khỏi menu và giao diện quản trị. Các URL cũ
`/admin/missions` và `/admin?screen=Missions` chuyển sang Vận hành trực tiếp.
API yêu cầu dịch vụ/giao nhận vẫn được giữ cho các luồng robot và Workstations;
việc gỡ trang không xóa dữ liệu yêu cầu hoặc công việc trên máy chủ.

Reliability test kiểm tra phản hồi REST chậm sau SSE, phiên bản từng bước,
giữ chi tiết khi công việc kết thúc, chỉ báo dữ liệu cũ khi lỗi đọc,
kiểm tra lại bước trước khi gửi xác nhận và robot thay đổi khả dụng trong lúc mở biểu mẫu.

## Quét tại Bản đồ và điều phối robot

`/admin/map?stage=scan` dùng giao diện React cho các API quét của `mapping.html`:
tạo mapping-job, theo dõi mapping-session/snapshot, ảnh map/camera, mapping-control
và sự kiện lưu map. Chọn robot, tầng, quy trình đã phát hành và tên map trong
“Thiết lập phiên quét”. Giữ nút để di chuyển; nhả, rời trang, đổi mục hoặc mất
kết nối thì ngừng gia hạn và gửi lệnh dừng. Tay cầm hoặc tự quét đang giữ quyền
điều khiển sẽ khóa nút di chuyển. Hiển thị phản hồi vật cản từ Pi; camera dùng
phiên media của robot và có ảnh MQTT dự phòng khi dịch vụ camera không khả dụng.

Workstations chỉ giữ Bản đồ máy chủ, Phát thông báo và Mô phỏng cục bộ; không nhúng
giao diện quét map. Link cũ `/workstations?mode=mapping` chuyển đến trang quét trong
Bản đồ. `/workstations?mode=speech` dùng API chuẩn bị TTS và speech-jobs. Mục Bản đồ máy chủ giữ luồng
mở navigation-session, xác nhận vị trí, MOVE, theo dõi và hủy yêu cầu đã có.
Các thao tác thật yêu cầu ADMIN, Pi kết nối và cấu hình BE/robot phù hợp.

```powershell
node --test tests/robot-operations.test.mjs tests/api-client.test.mjs
node tests/workstation-control.browser.mjs
node tests/navigation-dispatch.browser.mjs
npm run build
```

Browser tests dùng Vite cổng 5175, `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE` như
hướng dẫn bên dưới. API được giả lập toàn bộ, không gửi lệnh đến robot thật.
Ảnh giao diện: `.workstation-build/workstation-control/`.

## Bản đồ chọn từ database (31/10/2026)

Trang `/admin/map` mở thư viện map database trước. Vùng và Điểm đích dùng
map đã chọn, giữ lựa chọn khi đổi tab hoặc quay lại từ Quét. Bản nháp mô phỏng
trong localStorage không còn được đọc hoặc ghi bởi trang Bản đồ. Đã gỡ luồng
xem bản đồ mô phỏng, điều khiển/quét giả và xuất bản nháp mô phỏng khỏi trang này.
Danh sách map nằm trong khung mở/đóng, tự thu gọn sau khi chọn và giữ map đang
dùng khi quay lại thư viện. Trang chỉnh sửa dùng trực tiếp map đã chọn, không có
dropdown chọn map thứ hai hoặc thông báo tải danh mục BE. Nút “← Thư viện bản đồ”
cho phép đổi map; khu vực kích hoạt/công khai nằm dưới form và bản đồ.
Phần xem trước có chiều cao giới hạn trên desktop/mobile.
“Quét map mới” mở trực tiếp thiết lập robot/tầng/tên map/quy trình ngay trên
trang Quét (`/admin/map?stage=scan`), cùng trạng thái, camera, điều khiển và lưu map.
Form mặc định thu gọn, có nút Hiện/Ẩn chi tiết và tóm tắt lựa chọn; giữ dữ liệu
khi đóng/mở và tự thu gọn sau khi tạo phiên. Cài đặt hệ thống
giữ cấu hình vận hành, MQTT và lưu trữ; nguồn camera dự phòng đã được gỡ.
Khung map cao 700px trên desktop, 280px trên mobile; giữ tỉ lệ ảnh,
có phóng to/thu nhỏ, vừa khung và toàn màn hình cho cả ảnh đang quét và ảnh đã lưu.

Chạy Vite tại cổng 5175 và đặt `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE` theo
hướng dẫn bên dưới:

```powershell
node tests/map-database-flow.browser.mjs
node tests/map-delete.browser.mjs
```

Kiểm tra bản nháp cũ, trình duyệt chưa quét, đổi map/tab, URL `mapId`, database
trống/lỗi và màn hình 390px. Toàn bộ API được giả lập; không ghi vào BE thật.
Ảnh kết quả tại `.workstation-build/map-database-flow/`.

Thư viện có nút “Xóa bản đồ” cho ADMIN (không áp dụng tài khoản demo).
Ngay trong khung danh sách map, “Chọn để xóa” mở checkbox từng bản đồ,
“Chọn tất cả”, số lượng đã chọn và nút “Xóa đã chọn”. Chọn để xóa không đổi
bản đồ đang xem và không thu gọn danh sách; “Hủy chọn” xóa các dấu chọn.
Hộp xác nhận tải `GET /api/v1/maps/{id}/deletion-impact` để hiện số endpoint,
phòng/vùng sẽ xóa, phòng dùng chung được giữ và các ràng buộc. Không gửi yêu cầu
xóa nếu kiểm tra chưa xong, bị lỗi hoặc còn ràng buộc; có nút kiểm tra lại.
Sau khi nhập lý do 5–500 ký tự, UI gọi `DELETE /api/v1/maps/{id}/force` với
`{ reason }` và header `X-Confirm-Hard-Delete: true`. API xóa cứng map cùng endpoint,
phòng riêng của map, vùng, nhóm điểm, bản vẽ và dữ liệu quét trong database.
Phòng dùng chung với map khác được giữ lại. Tham chiếu từ job/yêu cầu/ca trực hoặc
phiên điều hướng đang mở sẽ chặn cả giao dịch. FE chỉ bỏ map khỏi danh sách khi
API xác nhận đúng `resourceId`, `resourceType: MAP` và `deleted.Map = 1`, chọn map
còn lại và bỏ liên kết quay về map vừa xóa. Phản hồi `ARCHIVED` không được coi là
đã xóa. Kiểm tra client bằng `node --test tests/map-deletion-api.test.mjs`.
Xóa nhiều map gửi lần lượt từng API với cùng lý do. Nếu chỉ một phần thành công,
FE bỏ các map đã xóa, giữ các map bị lỗi trong hộp xác nhận để thử lại riêng.
Test xóa bao phủ hủy/Escape, lý do không hợp lệ, lỗi máy chủ, khóa thao tác khi
đang gửi, tải lại, xóa map cuối, chọn nhiều/chọn tất cả, lỗi một phần/thử lại,
dọn lựa chọn đã mất trên máy chủ và giao diện 390/1024/1440px. API được giả lập hoàn toàn;
ảnh tại `.workstation-build/map-delete/`.

## Tuần tra dùng bản đồ cục bộ (22/10/2026)

Quy trình tuần tra lấy điểm từ cùng snapshot đã lưu của Bản đồ/Điều phối.
Không gửi mã điểm cục bộ sang API workflow; bản sửa tuần tra lưu trong
`mediassist.local-patrol-workflows.v1`. Không xóa các bản nháp tuần tra cũ.
Màn Tuần tra chỉ đọc quy trình loại PATROL, không chọn robot hay tạo lịch thật.

```powershell
node --test tests/local-patrol-design.test.mjs tests/patrol.test.mjs tests/patrol-workflow.test.mjs tests/dispatch.test.mjs tests/map-studio.test.mjs tests/map-setup.test.mjs tests/facility-contract.test.mjs
npm run build
```

Fixture thủ công: chạy Vite trên cổng **5175**, mở
`http://127.0.0.1:5175/tests/patrol-workflow.fixture.html`.
Fixture chặn mạng, có bản đồ EP1/EP2 và quy trình máy chủ dùng điểm khác.
Mở quy trình tuần tra → chọn lại bản đồ cục bộ và EP1/EP2 trong từng MOVE → lưu
→ xem trong Tuần tra → chạy/tạm dừng/đặt lại → tải lại → sửa → xóa bản nháp cục bộ.
Xác nhận bản đồ LiDAR xuất hiện cả khi chưa chọn tuyến, dropdown không có quy trình
phát loa và Bản đồ không còn hai tab chọn nguồn. Kiểm tra thêm màn hình 390px.
Không dùng fixture này trên origin của người dùng (5173).

Lượt này: 59 kiểm tra logic đạt; build đạt. Chưa chạy lại kiểm tra trực quan vì
công cụ trình duyệt bị tắt trong cài đặt. Các browser script quét robot thật bên
dưới thuộc giao diện trước, cần cập nhật entry point nếu dùng lại.

## Quét thật và phát thông báo (API giả lập trong kiểm thử)

```powershell
node --test tests/robot-operations.test.mjs tests/api-client.test.mjs tests/facility-contract.test.mjs tests/map-studio.test.mjs tests/dispatch.test.mjs
```

Chạy Vite ở cổng 5175, đặt `PLAYWRIGHT_MODULE` và `CHROME_EXECUTABLE` như hướng dẫn dưới, rồi chạy:

```powershell
$env:TEST_BASE_URL = 'http://127.0.0.1:5175'
node tests/robot-operations.browser.mjs
```

Bài kiểm tra chặn toàn bộ `/api/v1/**`; mọi thao tác tạo nhiệm vụ, di chuyển, lưu và phát loa chỉ đi đến fixture. Bao phủ phiên chưa mở (404), ảnh thiếu (204), ACK Pi, nhả nút/mất focus/mất kết nối, khôi phục, lưu lại với cùng sự kiện, tải lại trang, TTS chờ/sẵn sàng/lỗi/hủy, quyền ADMIN và bố cục 390px. Ảnh kết quả nằm trong `.workstation-build/robot-operations/`.

Kiểm tra này không chứng minh robot vật lý đã di chuyển, camera Pi hoạt động hoặc artifact đã upload thành công. Những phần đó cần Pi kết nối với BE, workflow schema 3 đã publish, MQTT/mapping bật, tầng hoạt động và cấu hình upload/TTS hợp lệ.

Các bài kiểm tra dùng bản đồ LiDAR mô phỏng và trình duyệt cô lập. Mọi API ghi đều được giả lập; không dùng tài khoản thật hoặc gửi lệnh đến robot.

## Kiểm tra logic

Trung tâm khẩn cấp dùng API thật ở runtime, không có dữ liệu mẫu trong trang.
Admin xem trang “Giám sát SOS”, không có nút tiếp nhận/xử lý/đóng/báo động nhầm.
Các thao tác xử lý trên FE dành cho staff; BE và cách phân staff nhận SOS chưa thay đổi.
Kiểm thử độc lập (API giả lập, không thay đổi sự cố trong database):

```powershell
node --test tests/emergency-center.test.mjs
# Vite cổng 5175; đặt PLAYWRIGHT_MODULE và CHROME_EXECUTABLE như các bộ browser khác.
node tests/emergency-center.browser.mjs
```

Bao phủ vòng đời sự cố, quyền người phụ trách, ghi chú bắt buộc, thay đổi trạng thái
trước khi xác nhận, phân trang/lọc trên máy chủ, giữ nội dung khi cập nhật nền hoặc
mất kết nối, báo động nhầm và bố cục 1440/1024/390px.
Ảnh kiểm tra ở `.workstation-build/emergency-center/`.

Vận hành trực tiếp: `node --test tests/live-operations.test.mjs`.
Chạy Vite tại cổng 5175, đặt `PLAYWRIGHT_MODULE` và `CHROME_EXECUTABLE`, rồi chạy:

```powershell
node tests/live-operations.browser.mjs
node tests/live-operations-reliability.browser.mjs
node tests/live-operations-interventions.browser.mjs
node tests/live-operations-design.browser.mjs
```

The design check uses fully mocked APIs on an isolated Vite origin (default
`http://127.0.0.1:5198`, override with `TEST_BASE_URL`). It checks the always-visible
overview, opening the correct detail group from a metric, map/mission placement,
connection loss and layouts at 390/1024/1536px without sending API mutations.
On desktop, the current mission ends level with the map; the job queue spans
the full monitor width beneath both columns, including when no mission is active.
It also checks that a 20-step mission scrolls internally, including wheel input
at both ends, while the page, mission header and action remain still.
Screenshots: `.workstation-build/live-operations-design/`.

Các API đều được giả lập. Bộ interventions kiểm tra hủy trong lúc xác nhận,
bằng chứng/phiên kết nối đổi trước khi đối soát, phục hồi chưa có lệnh MQTT,
chuyển về tiến trình sau phục hồi, giữ đúng công việc ở trang lịch sử thứ hai,
cập nhật chi tiết khi danh sách lỗi và giao diện 390px.

```powershell
node --test tests/map-setup.test.mjs tests/map-studio.test.mjs tests/map-feature-drag.test.mjs tests/facility-contract.test.mjs tests/dispatch.test.mjs tests/zone-traffic.test.mjs
```

## Kiểm tra giao diện

Giám sát (Cảnh báo, Lịch sử giám sát, Phân tích và Nhật ký kiểm toán):

```powershell
node --test tests/monitoring-model.test.mjs
# Vite chạy riêng ở cổng 5198; mọi API và dữ liệu ghi đều được giả lập.
$env:TEST_BASE_URL = 'http://127.0.0.1:5198'
node tests/monitoring-workspace.browser.mjs
```

Bao phủ thứ tự xử lý cảnh báo, quyền/người nhận/thời hạn, trạng thái thay đổi
trước khi gửi, giữ dữ liệu khi tải lại lỗi, bộ lọc ngày mặc định theo giờ Việt Nam,
CSV dùng bộ lọc đã áp dụng, tra cứu cả Admin/Staff trong nhật ký, sự kiện phát hiện,
bằng chứng và bố cục 390/1024/1440px. Ảnh ở `.workstation-build/monitoring-workspace/`.
URL `/admin/history-replay` được giữ để tương thích; tên hiển thị là Lịch sử giám sát.
Không mô phỏng phát lại hành trình hoặc tự tạo dữ liệu giám sát.

Yêu cầu Chrome, Playwright và FE đang chạy tại cổng 5173. Đặt `PLAYWRIGHT_MODULE` trỏ đến module Playwright và `CHROME_EXECUTABLE` trỏ đến Chrome đã cài, sau đó chạy:

```powershell
node tests/map-database-flow.browser.mjs
node tests/facility-catalog.browser.mjs
node tests/dispatch.browser.mjs
```

Ảnh kiểm tra được lưu trong `.workstation-build/`, thư mục này đã được Git bỏ qua.

## Điều phối chỉ sửa FE (31/10/2026)

Chọn bản đồ + robot một lần; mở phiên để lấy ID và lệnh Pi luôn hiển thị,
có nút sao chép. Chọn endpoint đã lưu làm vị trí khởi tạo (danh sách hoặc
bấm trên bản đồ), xác nhận để gửi `SEED` với X/Y/yaw qua API hiện có.
Điểm đến chỉ chọn ở bước cuối; MOVE vẫn đợi phiên READY và pose mới đúng map.
Không sửa endpoint để khởi tạo, không sửa mã BE. Ảnh PNG thiếu header hash do
CORS được kiểm tra lại metadata trước/sau; header sai hoặc hình học đổi vẫn bị chặn.

Chạy Vite cổng 5175 rồi đặt `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE` như trên:

```powershell
node tests/navigation-dispatch.browser.mjs
```

Toàn bộ API được giả lập, không chạy robot thật. Bao phủ mở phiên khi Pi chưa
kết nối, sao chép ID/lệnh, endpoint đổi tọa độ, xác minh, MOVE + submit,
hủy, đóng phiên và kích thước 1440/1024/390px. Ảnh: `.workstation-build/navigation-dispatch/`.
