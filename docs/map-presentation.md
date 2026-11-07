# Chỉnh giao diện bản đồ trong admin

Mở **Bản đồ → Thư viện bản đồ → Chỉnh giao diện map**, hoặc tab **Chỉnh giao diện** sau khi chọn map đã quét. Đường dẫn: `/admin/map?mapId=<UUID>&stage=presentation`.

Map LiDAR thật được tải làm ảnh nền. Kéo để vẽ phòng/hành lang, bấm từng đỉnh để tạo vùng đa giác, nối các đoạn tường liên tục, đặt cửa trên tường hoặc chọn hai điểm tự do, bấm để thêm nhãn/ký hiệu. Chọn đối tượng để kéo, sửa từng đỉnh, tên, màu, kích thước chữ, thứ tự lớp hoặc gắn endpoint có thật thuộc map. Có hoàn tác/làm lại, phóng to, vừa khung và công cụ kéo bản đồ. Thanh độ mờ giúp đối chiếu với ảnh thô; **Xem bản đẹp** ẩn nền thô để kiểm tra phần đã vẽ.

**Bắt dính khi vẽ:** bật mặc định, có thể tắt bằng ô **Bắt dính**. Đưa chuột gần góc hoặc cạnh của phòng/hành lang/tường đã vẽ để bắt dính; khi căn hàng, giao diện hiện đường gióng và vị trí sẽ đặt. Với cửa, chỉ bản lề/mép cửa là điểm bắt dính, cung mở và đầu cánh minh họa không tạo cạnh để vẽ theo. Khoảng bắt dính tính theo pixel màn hình nên giữ cảm giác thao tác khi zoom; các điểm vẫn được lưu bằng mét local của map gốc. Giữ **Alt** để tạm bỏ bắt dính, giữ **Shift** để khóa đoạn vẽ ngang/dọc theo hướng màn hình hiện tại, kể cả khi map đã xoay. Bắt dính dựa trên các đối tượng đã vẽ, chưa tự tìm tường từ ảnh LiDAR.

**Nối tường liên tục:** chọn **Tường (W)**, bấm điểm đầu rồi bấm lần lượt các góc tiếp theo. Di chuyển chuột để xem trước đoạn sắp vẽ. Mỗi đoạn được thêm ngay vào bản nháp và là một bước hoàn tác riêng; công cụ vẫn giữ điểm cuối để nối tiếp. **Enter** hoặc **Kết thúc tường** kết thúc chuỗi, **Esc** thoát công cụ. Kết thúc/thoát giữ các đoạn đã vẽ; chỉ điểm xem trước chưa đặt được bỏ đi. Tường vẫn chỉ được ghi vào BE khi bấm **Lưu nháp** hoặc **Áp dụng bản đồ**.

**Cửa minh họa trên mặt bằng:** công cụ **Cửa (D)** đặt bản lề ở lần bấm đầu, mép cửa còn lại ở lần bấm thứ hai. Khi lần đầu bấm gần một đoạn tường đã vẽ, bản lề được đặt lên tường và cửa tự xoay theo tường đó; lần bấm thứ hai xác định chiều rộng dọc theo đoạn tường, giới hạn trong hai đầu đoạn. Có thể giữ **Alt** hoặc tắt **Bắt dính** để đặt cửa tự do. Hình xem trước cho biết hướng và chiều rộng trước khi đặt. Ký hiệu gồm cánh cửa, cung mở nét đứt nhạt và nét mảnh đánh dấu khoảng cửa. Trong thuộc tính, **Đổi phía mở** lật hướng minh họa, **Đổi bên bản lề** chuyển bản lề sang mép còn lại. Kéo điểm ở đầu cánh cửa để chỉnh góc minh họa; cánh luôn giữ chiều dài bằng chiều rộng cửa. Cửa mới không tự thêm chữ lên ký hiệu; có thể nhập tên nếu cần. Ký hiệu được giữ khi xem trước, lưu/mở lại, xuất bản và xoay map. Hướng vẽ không phản ánh cửa thật đang mở hay đóng và không thay đổi bản đồ dẫn đường của robot.

Khi khoảng cửa trùng một đoạn tường đã vẽ, nét tường hiển thị được chừa khoảng cửa để ký hiệu dễ đọc. Đây chỉ là cách dựng hình: dữ liệu các đỉnh tường vẫn giữ nguyên, kéo hoặc xóa cửa sẽ cập nhật lại khoảng trống hiển thị; ảnh quét và vật cản điều hướng không bị cắt.

Công cụ nằm ngang trên canvas, thuộc tính nằm bên phải; tọa độ và kích thước chính xác nằm trong **Tùy chỉnh nâng cao**. Phòng/hành lang có nền màu nhạt 9%, viền 1 px giữ độ mảnh khi zoom; phòng đang chọn nhấn nền 18% và viền 1.5 px, tên vẫn rõ. Khi kéo vẽ, vùng xem trước có nền 10% và viền đứt. Phòng mới tự chọn màu khác các phòng gần đó và tên Phòng 01, 02…; bản nhân đôi cũng chọn màu khác. Có thể đổi **Màu phòng / Màu hành lang**, đối chiếu với chấm màu trong danh sách đối tượng. Phòng cũ dùng màu xanh mặc định được gợi ý màu riêng theo mã đối tượng, không đổi do sắp xếp lớp; màu hiển thị được giữ trong trường `color` khi lưu nháp hoặc xuất bản. Ảnh quét và tọa độ dẫn đường không đổi.

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
- FE hỗ trợ vẽ: `node --test tests/map-drawing-assist.test.mjs`
- Trình duyệt: chạy Vite, rồi `node tests/map-presentation.browser.mjs` (API fixture, không ghi dữ liệu thật).
- Trình duyệt căn hướng: `node tests/map-rotation.browser.mjs`; mặc định Vite 5175 hoặc biến `MAP_TEST_URL`. Bao phủ căn theo tường, vẽ/kéo sau xoay, lưu/xuất bản, zoom và 390/1024/1600px.
- Cửa: `node --test tests/door-geometry.test.mjs` và `node tests/map-door.browser.mjs` (API giả lập, Vite 5175 hoặc `MAP_TEST_URL`). Kiểm tra cung mở, đổi hướng/bản lề, kéo chỉnh và lưu/mở lại.
- Vẽ nhanh: `node tests/map-drawing-assist.browser.mjs` (API giả lập, Vite 5175 hoặc `MAP_TEST_URL`). Bao phủ bắt dính đỉnh/cạnh, Alt, Shift sau xoay map, nối tường liên tục, hoàn tác từng đoạn, đặt cửa trên tường chéo, giới hạn chiều rộng, lưu/mở lại/xuất bản, zoom và bố cục điện thoại. Chỉ các API `/presentation` được phép ghi trong kiểm thử.

Kiểm thử BE bao gồm snapshot/nháp độc lập, revision, hash map cũ, endpoint khác map, hình vượt biên, validation và quyền ADMIN/STAFF. Kiểm thử trình duyệt bao gồm vẽ trên map thô, lưu/mở lại, hoàn tác, xuất bản, zoom và xử lý xung đột.
