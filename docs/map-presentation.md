# Chỉnh giao diện bản đồ trong admin

Mở **Bản đồ → Thư viện bản đồ → Chỉnh giao diện map**, hoặc tab **Chỉnh giao diện** sau khi chọn map đã quét. Đường dẫn: `/admin/map?mapId=<UUID>&stage=presentation`.

Map LiDAR thật được tải làm ảnh nền. Kéo để vẽ phòng/hành lang, bấm từng đỉnh để tạo vùng đa giác, chọn hai điểm để vẽ tường/cửa, bấm để thêm nhãn/ký hiệu. Chọn đối tượng để kéo, sửa từng đỉnh, tên, màu, kích thước chữ, thứ tự lớp hoặc gắn endpoint có thật thuộc map. Có hoàn tác/làm lại, phóng to, vừa khung và công cụ kéo bản đồ. Thanh độ mờ giúp đối chiếu với ảnh thô; **Xem bản đẹp** ẩn nền thô để kiểm tra phần đã vẽ.

Công cụ nằm ngang trên canvas, thuộc tính nằm bên phải; tọa độ và kích thước chính xác nằm trong **Tùy chỉnh nâng cao**. Phòng/hành lang hiển thị nền trong suốt, viền nhạt 1 px (1.25 px khi chọn), giữ độ mảnh khi zoom để không che tường. Cách hiển thị này áp dụng cả bản vẽ đã lưu.

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

Điểm của bản vẽ dùng **mét trong lưới local**: gốc góc trái dưới, X sang phải, Y lên trên, trước phép quay/dịch chuyển của map. Source lấy từ YAML/PGM đã xác minh, giữ độ chính xác gốc. Quy đổi sang hệ tọa độ ROS: `world = origin + rotation(originYawRad) * local`. Ảnh SVG dùng `svgY = heightM - localY`. Endpoint giữ nguyên tọa độ thế giới và được chuyển về local khi vẽ.

BE kiểm tra phạm vi, số đỉnh, diện tích, mã trùng và endpoint cùng map/active/accessibile. Khóa ghi theo map và kiểm tra `expectedRevision` để ngăn hai phiên ghi đè nhau. Bản vẽ gắn hash tài sản gốc; map thay đổi hash thì không được áp dụng/đọc snapshot cũ.

## Chạy và kiểm tra

Khởi động BE để Flyway áp dụng `V53__map_presentation.sql` (bảng `MapPresentation`). Cần cấu hình truy cập tài sản map hiện có để lấy được ảnh PNG và metadata. FE dùng `VITE_API_BASE_URL` hoặc proxy như cấu hình hiện tại.

- BE: `mvn -Dmaven.test.skip=false -Dtest=MapPresentationServiceTest,MapPresentationAuthorizationTest test`
- FE model: `node --test tests/map-presentation.test.mjs`
- Trình duyệt: chạy Vite, rồi `node tests/map-presentation.browser.mjs` (API fixture, không ghi dữ liệu thật).

Kiểm thử BE bao gồm snapshot/nháp độc lập, revision, hash map cũ, endpoint khác map, hình vượt biên, validation và quyền ADMIN/STAFF. Kiểm thử trình duyệt bao gồm vẽ trên map thô, lưu/mở lại, hoàn tác, xuất bản, zoom và xử lý xung đột.
