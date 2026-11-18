# Trung tâm khẩn cấp: SOS và AI nghi té ngã

Trang `/admin/emergency-center` sử dụng API backend, không tự tạo sự kiện phát hiện.
Hai nguồn dùng chung danh sách, bộ lọc, lịch sử, bằng chứng và tiến trình:

- `SOS`: người dùng bấm nút SOS; Admin giữ chế độ giám sát, Staff được phân công xử lý.
- `AI_SUSPECTED_FALL`: robot báo nghi té ngã; Admin hoặc Staff được phân công xác minh.

`SUSPECTED_FALL` là mã sự kiện phát hiện; các bản ghi cũ dùng mã này vẫn được
nhận diện khi hiển thị. Bộ lọc lịch sử gửi mã loại sự cố hiện tại `AI_SUSPECTED_FALL`.

## API theo nghiệp vụ

| Nghiệp vụ | API |
| --- | --- |
| Danh sách đang diễn ra / lịch sử | `GET /api/v1/emergency-incidents` với `status`, `type`, `severity`, `mapId`, `from`, `to`, `page`, `size` |
| Chi tiết | `GET /api/v1/emergency-incidents/{id}` |
| Tiếp nhận | `POST /api/v1/emergency-incidents/{id}/acknowledge` |
| Bắt đầu xử lý SOS bấm nút | `POST /api/v1/emergency-incidents/{id}/start` |
| Xác nhận cần hỗ trợ sau khi xem camera té ngã | `POST /api/v1/emergency-incidents/{id}/confirm` |
| Xử lý xong | `POST /api/v1/emergency-incidents/{id}/resolve`, body `{ resolutionNote }` |
| Đóng hồ sơ | `POST /api/v1/emergency-incidents/{id}/close` |
| Báo động nhầm | `POST /api/v1/emergency-incidents/{id}/false-alarm`, body `{ resolutionNote }` |
| Vị trí té ngã trước xác nhận | `GET /api/v1/emergency-incidents/{id}/location` |
| Đường đi bộ hỗ trợ khi `IN_PROGRESS` | `GET /api/v1/emergency-incidents/{id}/response-route` |

Frontend đọc lại chi tiết trước khi gửi thao tác, kiểm tra ID, loại sự cố,
robot, người phụ trách, trạng thái và phiên bản bản ghi. Chỉ hiển thị thành công
khi phản hồi đúng ID và trạng thái đích. Ghi chú kết quả hoặc lý do báo nhầm là bắt buộc.

## Camera theo sự cố

Chỉ mở khi người dùng bấm nút. Kiểm tra `GET /api/v1/media/configuration`, tìm
phiên bằng `GET /api/v1/media-sessions`, tái sử dụng đúng robot và sự cố.
Nếu cần tạo mới, gửi `POST /api/v1/media-sessions` với
`{ robotId, incidentId, mode }`.

- Té ngã dùng `MONITOR`, không bật camera hoặc micro của máy người xem.
- SOS bấm nút dùng `ASSIST`; micro chỉ bật khi người dùng bấm nút trao đổi.
- Phiên `RINGING` gọi `POST /api/v1/media-sessions/{id}/accept`.
- Tham gia bằng `POST /api/v1/media-sessions/{id}/join-token`, kết nối LiveKit
  với credentials trả về; chỉ nhận video từ identity của đúng robot.
- Đọc trạng thái mỗi 3 giây qua `GET /api/v1/media-sessions/{id}`.
- Ngắt / rời giao diện kết thúc phiên đang sở hữu bằng
  `POST /api/v1/media-sessions/{id}/end`, body `{ reason: "INCIDENT_VIEW_CLOSED" }`.

Nút xác nhận té ngã yêu cầu phiên `MONITOR` của đúng sự cố, tài khoản, robot,
trạng thái `ACTIVE`, chưa hết hạn và video có khung hình mới. Hình đứng trên
5 giây, mất kết nối, mất trạng thái phiên hoặc đổi người phụ trách sẽ khóa xác nhận.
Trước `/confirm`, frontend đọc lại trạng thái phiên; backend vẫn quyết định điều
kiện xác minh cuối cùng. Mất camera không tự đóng hoặc tự đánh dấu báo động nhầm.

## Vị trí và bằng chứng

API vị trí/đường trả đơn vị `cm`; frontend đổi sang mét trước khi vẽ.
Chỉ dùng dữ liệu khi map ID và hash khớp bản đồ đang hiển thị. Dấu đỏ là vị trí
người; dấu xanh vuông là vị trí robot lúc phát hiện. Khi chỉ có vị trí robot,
hiển thị rõ chưa xác định được vị trí người. Đường hiển thị là đường đi bộ hỗ trợ,
không phải lệnh điều khiển robot.

Ảnh/video được lấy từ `sourceEvidenceRef` và `resolutionEvidence` của sự cố;
không lấy ngẫu nhiên từ thư viện media và không coi camera trực tiếp là clip lịch sử.
API sự cố hiện chưa trả các trường detection kind / confidence / thuật toán,
nên giao diện dùng mô tả backend và không tự suy đoán các thông số này.
API tạo detector hiện không nhận bằng chứng media; việc tự lưu clip cần tích hợp
ở detector/backend riêng.

## Kiểm thử

```powershell
node --test tests/emergency-center.test.mjs tests/emergency-api.test.mjs tests/incident-camera.test.mjs tests/robot-camera.test.mjs tests/api-client.test.mjs tests/backend-contract.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5199 --strictPort
# Terminal khác
$env:TEST_BASE_URL = 'http://127.0.0.1:5199'
$env:CHROME_EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/emergency-center.browser.mjs
node tests/emergency-fall.browser.mjs
npm run build
```

Các browser test chặn API và giả lập LiveKit trong trình duyệt cô lập, không
gửi thao tác tới database hoặc robot thật. Bao phủ vòng đời SOS và té ngã,
camera đứng hình, preflight khi mất phiên, quyền người phụ trách, lịch sử gửi đúng
mã loại sự cố, vị trí người/robot, ghi chú bắt buộc và bố cục 390/1024/1440px.
Ảnh kiểm tra nằm trong `.workstation-build/emergency-center/` và
`.workstation-build/emergency-fall/`.

Kiểm thử này chưa xác minh camera Pi, detector, MQTT, điều phối nhân viên hoặc
LiveKit thật. Để chạy thực tế, Pi phải báo sự kiện qua `/api/v1/pi/fall-events`
hoặc API checkpoint tuần tra, cùng phiên thiết bị và cấu hình media hợp lệ.
