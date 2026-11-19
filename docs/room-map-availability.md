# Trạng thái phòng theo bản đồ hoạt động

Danh sách phòng mặc định chọn **Đang hoạt động**. Chọn **Không hoạt động** hoặc
**Tất cả trạng thái** để tra cứu các phòng khác.

Thẻ **Phòng đang hoạt động**, badge **Danh sách phòng** và dòng tổng bên phải cùng
đếm phòng đang hoạt động, kể cả khi mở tab Hồ sơ bệnh viện/Danh sách tầng.
Với BE cũ chưa có `operational`, FE tải map và endpoint
để tính đúng số phòng hoạt động thay vì đếm cờ bật/tắt riêng của phòng.

Phòng hoạt động khi được bật, tầng còn hoạt động, và có ít nhất một endpoint được
bật trên map `ACTIVE` cùng tầng. Phòng có điểm trên nhiều map vẫn hoạt động nếu
còn một map phù hợp. Map DRAFT/INACTIVE/ARCHIVED và phòng chưa có điểm không đáp
ứng điều kiện này. Phòng đã được quản trị viên tắt vẫn giữ nguyên thiết lập đó.

Kích hoạt map khác trên cùng tầng khiến trạng thái được tính lại ngay ở backend.
Không cần sửa/xóa hàng loạt phòng hoặc khôi phục cờ bật/tắt khi chuyển về map cũ.
API phòng bổ sung `operational` cho trạng thái thực tế; `active` tiếp tục lưu thiết
lập bật/tắt riêng. API danh sách mặc định và danh sách công khai chỉ trả các phòng
đủ điều kiện. Admin dùng `includeDeleted=true` để quản lý toàn bộ danh mục.

FE tính trạng thái từ toàn bộ phòng/endpoint/map đã tải, đồng thời kiểm tra map
khi trở lại tab và mỗi 15 giây khi trang đang hiển thị. Khi phát hiện đổi map, FE
tải lại danh mục. Tự cập nhật được tạm dừng trong lúc có thay đổi chưa lưu.

Kiểm thử:

```powershell
node --test tests/room-availability.test.mjs tests/room-editing.test.mjs tests/room-defaults.test.mjs
node tests/room-map-availability.browser.mjs
node tests/room-editing.browser.mjs
$env:TEST_URL='http://localhost:5173'; node tests/room-sos.browser.mjs
# Trong BE_MAR, dùng H2 và fixture độc lập:
mvn "-Dmaven.test.skip=false" "-Dtest=RoomMapAvailabilityTest,FacilityMapperEndpointTest" test
```

Cần cập nhật cả FE và BE để các client và API công khai có cùng quy tắc lọc.

## Các ô chọn phòng vận hành

`operationalRooms.js` là nguồn dùng chung cho `callBackend/readCatalog` GET rooms,
`facilityApi.listRooms` mặc định và cấu hình hệ thống. Bộ đọc tải đủ mọi trang;
BE cũ chưa có `operational` được lọc lại theo map/endpoint/tầng. Lỗi tải danh mục
không được thay bằng danh sách phòng chưa xác minh. Form phân ca tải lại phòng
trước khi lưu; lịch trực tải lại danh mục cùng chu kỳ tự đồng bộ.

Phân ca, nhóm phòng trong preview/điều phối workflow, điểm giao hàng mobile chỉ
cho chọn phòng có endpoint trên map ACTIVE phù hợp. BE kiểm tra cùng điều kiện
khi tạo/sửa/bắt đầu ca, check-in, xác định người nhận đang trực, tạo yêu cầu
dẫn đường/giao hàng và chọn phòng tiếp nhận SOS. Lịch sử giữ thông tin phòng cũ
để tra cứu; danh mục quản trị/Map Studio dùng chế độ quản lý đầy đủ để sửa liên
kết và chuẩn bị map mới.

Kiểm tra bổ sung:

```powershell
node --test tests/operational-rooms.test.mjs
$env:TEST_BASE_URL='http://localhost:5173'; $env:CHROME_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/staff-shifts.browser.mjs
# FE_APP_MAR
npm.cmd run typecheck
node --test tests/room-availability.test.cjs
```
