# Chỉnh giao diện bản đồ trong admin

Mở **Bản đồ → Thư viện bản đồ → Chỉnh giao diện map**, hoặc tab **Chỉnh giao diện** sau khi chọn map đã quét. Đường dẫn: `/admin/map?mapId=<UUID>&stage=presentation`.

Map LiDAR thật được tải làm ảnh nền. Kéo để vẽ phòng/hành lang, bấm từng đỉnh để tạo vùng đa giác, chọn hai điểm để vẽ tường/cửa, bấm để thêm nhãn/ký hiệu. Chọn đối tượng để kéo, sửa từng đỉnh, tên, màu, kích thước chữ, thứ tự lớp hoặc gắn endpoint có thật thuộc map. Có hoàn tác/làm lại, phóng to, vừa khung và công cụ kéo bản đồ. Thanh độ mờ giúp đối chiếu với ảnh thô; **Xem bản đẹp** ẩn nền thô để kiểm tra phần đã vẽ.

**Cửa mở kiểu mặt bằng:** công cụ **Cửa (D)** đặt bản lề ở lần bấm đầu, mép cửa còn lại ở lần bấm thứ hai. Ký hiệu gồm cánh cửa mở 90°, cung tròn hướng mở và nét mảnh đánh dấu khoảng cửa. Trong thuộc tính, **Đổi phía mở** lật hướng mở, **Đổi bên bản lề** chuyển bản lề sang mép còn lại. Kéo điểm ở đầu cánh cửa để chỉnh góc mở; cánh luôn giữ chiều dài bằng chiều rộng cửa. Cửa mới không tự thêm chữ lên ký hiệu; có thể nhập tên nếu cần. Ký hiệu được giữ khi xem trước, lưu/mở lại, xuất bản và xoay map.

Công cụ nằm ngang trên canvas, thuộc tính nằm bên phải; tọa độ và kích thước chính xác nằm trong **Tùy chỉnh nâng cao**. Phòng/hành lang hiển thị nền trong suốt, viền nhạt 1 px (1.25 px khi chọn), giữ độ mảnh khi zoom để không che tường. Cách hiển thị này áp dụng cả bản vẽ đã lưu.

**Căn hướng map:** thanh **Xoay map** cho nhập góc, kéo thanh trượt, xoay từng 1°/90° và **Về 0°**. Bật **Lưới căn** để đối chiếu ngang/dọc. Với bản quét nghiêng, chọn **Căn theo tường**, rồi bấm hai điểm cách xa nhau trên cùng một đoạn tường thẳng; giao diện xoay về trục ngang/dọc gần nhất. Đây là căn theo hai điểm người dùng chọn, chưa tự nhận diện tường từ ảnh.

Ảnh quét, phòng/tường, điểm đích và nét đang vẽ cùng xoay quanh tâm map; tên vẫn nằm ngang để dễ đọc. Phòng/hành lang mới được vẽ thẳng theo màn hình rồi quy đổi về tọa độ local gốc. Zoom/kéo/Vừa khung dùng phạm vi sau xoay để giữ đủ bốn góc. Hoàn tác/làm lại áp dụng cả góc xoay; kéo thanh trượt là một bước hoàn tác.

**Lưu nháp** lưu góc trong dữ liệu trình bày, mở lại giữ đúng góc. **Áp dụng bản đồ** xuất bản cả góc đã căn, kể cả khi chưa vẽ thêm đối tượng; khi đó Xem trước vẫn hiện ảnh quét. Góc mới trong bản nháp không làm đổi snapshot đã xuất bản. Không đổi ảnh PGM/YAML, origin/yaw, độ phân giải hay tọa độ dẫn đường của robot.

Với bản đã áp dụng góc xoay, **Về 0° → Áp dụng bản đồ** đưa bản xuất bản về hướng gốc, kể cả khi không có đối tượng. Bản mới trống ở góc 0° vẫn chưa cần xuất bản. Khi nhập góc, Enter áp dụng giá trị; Ctrl+S lưu cả góc vừa nhập.

Cuộn chuột để zoom tại con trỏ; giữ **Space + kéo** để di chuyển map. Phím tắt: **V** chọn, **H** kéo map, **R** phòng, **G** hành lang, **P** đa giác, **W** tường, **D** cửa, **T** nhãn, **L** ký hiệu. **Ctrl+S** lưu nháp, **Ctrl+Z / Ctrl+Shift+Z** hoàn tác/làm lại, **Delete** xóa đối tượng đang chọn. Phím vẽ không kích hoạt khi đang nhập tên hoặc tọa độ. Có nút nhân bản, ẩn/hiện điểm đích và mở rộng vùng vẽ.

Đây là công cụ vẽ/chỉnh lớp trình bày trên map đã quét, chưa tự nhận diện phòng/tường từ ảnh LiDAR. Không xóa vật cản hoặc thay đổi ảnh PGM/YAML điều hướng. Nếu ẩn map thô, những phần chưa vẽ lại sẽ chưa xuất hiện trong bản đẹp.

**Lưu nháp** lưu dữ liệu vào BE. **Áp dụng bản đồ** tạo snapshot đã xuất bản. Chỉnh/lưu nháp tiếp không thay đổi snapshot đó; **Ngừng xuất bản** chỉ gỡ snapshot, giữ bản nháp. Chưa thay đổi app staff trong phạm vi này.

## API

Tất cả nằm dưới `/api/v1/maps/{mapId}/presentation`:

| Method | Đường dẫn | Quyền / dữ liệu |
|---|---|---|
| GET | `/` | ADMIN; source, revision, draft, published, publishedRevision, publishedAt, sourceChanged |
| PUT | `/` | ADMIN; `{ expectedRevision, sourceAssetHash, document }` |
| POST | `/publish` | ADMIN; `{ expectedRevision }` |
| POST | `/unpublish` | ADMIN; `{ expectedRevision }` |
| GET | `/published` | ADMIN/STAFF; chỉ snapshot đã xuất bản, không có draft; chưa có → 404, map gốc thay đổi → 409 |

`document` có `schemaVersion: 1`, `backgroundColor` dạng `#RRGGBB`, `features` (tối đa 500). Mỗi feature có `id`, `type` (`ROOM`, `CORRIDOR`, `WALL`, `DOOR`, `LABEL`, `LANDMARK`), `label`, `color`, `points: [{x,y}]`, `lineWidthM`, `fontSizeM`, `endpointId` hoặc null.

`DOOR.points` dùng ba điểm local: bản lề, mép cửa khi đóng, đầu cánh khi mở. Hai điểm đầu xác định chiều rộng; điểm thứ ba xác định hướng/góc mở và được chiếu về bán kính bằng chiều rộng cửa khi chỉnh. Cửa cũ chỉ có hai điểm vẫn hiển thị mở 90° (ưu tiên phía nằm trong phạm vi map). Dữ liệu dùng mảng `points` hiện có, không thêm trường hoặc migration backend. Các thao tác cửa không tạo endpoint và không sửa tài sản dẫn đường.

`rotationDegrees` là góc hiển thị theo chiều kim đồng hồ trong SVG, giới hạn −180…180°. Trường thiếu/null ở bản vẽ cũ mặc định 0°. Đây là metadata trình bày, không cộng vào `source.originYawRad`. Lưu trong JSON hiện có, không cần migration bảng. Cần triển khai BE có DTO `rotationDegrees` cùng FE; nếu BE cũ bỏ góc khi lưu, FE báo lỗi và giữ bản chỉnh chưa lưu để thử lại sau khi cập nhật BE.

Điểm của bản vẽ dùng **mét trong lưới local**: gốc góc trái dưới, X sang phải, Y lên trên, trước phép quay/dịch chuyển của map. Source lấy từ YAML/PGM đã xác minh, giữ độ chính xác gốc. Quy đổi sang hệ tọa độ ROS: `world = origin + rotation(originYawRad) * local`. Ảnh SVG dùng `svgY = heightM - localY`. Endpoint giữ nguyên tọa độ thế giới và được chuyển về local khi vẽ.

BE kiểm tra phạm vi, số đỉnh, diện tích, mã trùng và endpoint cùng map/active/accessibile. Khóa ghi theo map và kiểm tra `expectedRevision` để ngăn hai phiên ghi đè nhau. Bản vẽ gắn hash tài sản gốc; map thay đổi hash thì không được áp dụng/đọc snapshot cũ.

## Chạy và kiểm tra

Khởi động BE để Flyway áp dụng `V53__map_presentation.sql` (bảng `MapPresentation`). Cần cấu hình truy cập tài sản map hiện có để lấy được ảnh PNG và metadata. FE dùng `VITE_API_BASE_URL` hoặc proxy như cấu hình hiện tại.

- BE: `mvn -Dmaven.test.skip=false -Dtest=MapPresentationServiceTest,MapPresentationAuthorizationTest test`
- FE model: `node --test tests/map-presentation.test.mjs`
- FE rotation: `node --test tests/map-presentation-view.test.mjs`
- Trình duyệt: chạy Vite, rồi `node tests/map-presentation.browser.mjs` (API fixture, không ghi dữ liệu thật).
- Trình duyệt căn hướng: `node tests/map-rotation.browser.mjs`; mặc định Vite 5175 hoặc biến `MAP_TEST_URL`. Bao phủ căn theo tường, vẽ/kéo sau xoay, lưu/xuất bản, zoom và 390/1024/1600px.
- Cửa: `node --test tests/door-geometry.test.mjs` và `node tests/map-door.browser.mjs` (API giả lập, Vite 5175 hoặc `MAP_TEST_URL`). Kiểm tra cung mở, đổi hướng/bản lề, kéo chỉnh và lưu/mở lại.

Kiểm thử BE bao gồm snapshot/nháp độc lập, revision, hash map cũ, endpoint khác map, hình vượt biên, validation và quyền ADMIN/STAFF. Kiểm thử trình duyệt bao gồm vẽ trên map thô, lưu/mở lại, hoàn tác, xuất bản, zoom và xử lý xung đột.
