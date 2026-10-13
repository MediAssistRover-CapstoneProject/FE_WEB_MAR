# Map Studio: ranh giới OTTO / BE / mô phỏng FE

Đối chiếu ngày 14/10/2026 với tài liệu `MediAssistRover_Tai_lieu_226_API_FE_BE.docx` (các DTO FacilityRequests/FacilityResponses, enum và mục giới hạn), code BE local commit `2f4e5cf`, và tài liệu OTTO:

- [Endpoints, groups, ownership, templates](https://docs.ottomotors.com/en/127044-117650-concepts--endpoints.html)
- [Zones](https://docs.ottomotors.com/en/30495-30717-zones.html)
- [Exclusion](https://docs.ottomotors.com/en/30495-30731-exclusion-zone.html), [speed limit](https://docs.ottomotors.com/en/30495-30741-speed-limit-zone.html), [preferred direction](https://docs.ottomotors.com/en/30495-30738-preferred-direction-zone.html)
- [Single robot](https://docs.ottomotors.com/en/30495-30740-traffic-control--single-robot-zone.html), [occupancy monitoring](https://docs.ottomotors.com/en/30495-30737-occupancy-monitoring-zone.html)

## Giao diện

Map Studio chỉ có ba bước Quét / Vùng / Điểm đích, cùng `WorkspaceTabs` với Quy trình / Điều phối / Công việc. Đã bỏ hai nút chọn nguồn theo yêu cầu: không còn “Mô phỏng cục bộ” / “Danh mục BE”. Bản quét mẫu và cấu hình vẫn lưu trong trình duyệt; thông báo trạng thái lưu nói rõ điều này, không giả đồng bộ lên BE.

- **Vùng:** chọn và kéo cả đa giác, hoặc kéo từng chấm đỉnh; tọa độ trong form cập nhật ngay. Kéo cả vùng giữ nguyên hình dạng, chặn toàn bộ vùng tại biên bản đồ. Có thể tiếp tục nhập tọa độ thủ công.
- **Điểm đích:** chọn và kéo trực tiếp, không cần nút đặt lại vị trí. Panel chỉ giữ tên, loại, mô tả, bật/tắt, vùng chứa, nhóm, tọa độ và hướng đến. Đã bỏ UI mẫu/tác vụ, tài nguyên bận, chờ/thoát; không tự chèn tác vụ vào điểm mới. Metadata cũ được giữ để không phá dữ liệu đã lưu.
- **Nhóm điểm đích:** tab ngay dưới tiêu đề bước 3, ngang hàng tab Điểm đích. Tạo nhóm rồi thêm thành viên; lưu bản đồ để nhóm xuất hiện trong Điều phối.
- Tọa độ kéo tính từ ma trận SVG nên đúng khi phóng to, di chuyển khung nhìn và đổi kích thước màn hình. Esc/pointer cancel hủy lượt kéo; nút Lưu xác nhận chỉnh sửa. Đổi tab khi chưa lưu có cảnh báo.

`FacilityCatalogEditor` và adapter API vẫn được giữ độc lập để không xóa code đã có, nhưng **không còn được gắn vào Map Studio**. Kiểm thử component dùng trang riêng do Playwright phục vụ, không có route/menu tương ứng trong sản phẩm. Không chuyển ngầm bản đồ trình duyệt thành bản đồ robot thật.

## Zone không phải chỉ là tên phòng

OTTO mô tả vùng là đa giác kín từ ba đỉnh, không bị hạn chế bởi tường/vật cản. Bỏ điều kiện cũ buộc vùng phải giao vùng sàn quan sát được. Điểm đích mô phỏng vẫn phải nằm trên sàn đi được và đủ khoảng cách thân robot.

BE `ZoneType`: WAITING, CORRIDOR, RESTRICTED, SERVICE, OTHER. Các loại này là phân loại chức năng, **không tự ánh xạ** thành EXCLUSION hoặc PREFERRED_DIRECTION. ZoneRequest hỗ trợ polygonJson, speedLimitMps, capacityLimit, calibratedAreaM2, cameraSourceRef, cameraRoiJson, active, publicVisible, description. FE cho vẽ đa giác trên khung mét và chỉnh JSON nâng cao; không giả vẽ tường khi chưa có occupancy artifact.

Danh mục tham khảo gồm đủ 18 loại vùng OTTO và AREA để gắn nhãn. Menu tạo vùng chỉ cho chọn 8 loại có hành vi thực thi trong demo: AREA, EXCLUSION, SPEED_LIMIT, PREFERRED_DIRECTION, ASSUMED_COST (chế độ vật cản), SINGLE_ROBOT, OCCUPANCY_MONITORING, NO_REPLAN. Các loại còn lại nằm trong mục thu gọn “Các loại vùng cần kết nối robot”, giải thích giới hạn thay vì cho tạo vùng không có tác dụng.

- PREFERRED_DIRECTION: chi phí 1 chặn hướng tương ứng trên mọi cạnh và đoạn nối endpoint, kể cả thành phần ngược hướng của đoạn chéo. Đây là cách thực thi bảo thủ của demo; không phải bộ tính chi phí đầy đủ của OTTO.
- ASSUMED_COST: chỉ hỗ trợ vật cản chi phí 1; không bỏ qua tường, không giả định free space hay bật chi phí trung gian chưa được OTTO hỗ trợ chính thức.
- SINGLE_ROBOT: Điều phối có tình huống MAR-02 ảo giữ vùng. MAR-01 chờ ngoài biên cộng bán kính thân 0,4 m; chỉ đi tiếp khi MAR-02 giải phóng vùng. MAR-02 là kịch bản giữ/rời tài nguyên, không phải robot thứ hai được lập đường độc lập. Chưa có FIFO đội robot hay safety field đã kiểm định.
- OCCUPANCY_MONITORING: số robot hiện diện và nhật ký vào/ra dựa trên giao thân robot với vùng. Không đếm người, không tự giới hạn sức chứa và không phát sự kiện lên API.
- NO_REPLAN: tình huống vật cản giữ tuyến, chờ đến thời hạn 1–120 giây. Nếu vật cản chưa rời thì dừng, không báo hoàn tất công việc. Chưa có các chu kỳ local/global/burst replan của robot thật.
- SPEED_LIMIT vẫn dùng mô hình giảm tốc bảo thủ theo vị trí tâm robot, chưa mô hình hóa safety field. Junction cần Graph Planner lanes; các loại cảm biến/định vị nâng cao không được giả kích hoạt trong LiDAR mẫu.

Tài liệu đối chiếu bổ sung: [danh mục 18 loại vùng](https://docs.ottomotors.com/en/30495-30726-configurable-zones-types.html), [thực hành vùng một robot](https://docs.ottomotors.com/en/30495-30718-traffic-control--single-robot-zone-best-practices.html), [Assumed Cost](https://docs.ottomotors.com/en/30495-30727-assumed-cost-zone.html), [No Replan](https://docs.ottomotors.com/en/30495-30736-no-replan-zone.html).

## Endpoint và nhóm

Endpoint là đích chức năng có vị trí + hướng. EndpointRequest BE dùng mét/radian, enum ROOM_STOP, PICKUP, DROPOFF, WAITING, CHECKPOINT, MANUAL_CHARGE; có zoneId, roomId, accessible và trạng thái. Mẫu, tác vụ chờ/thoát, ownership trong editor cục bộ **không được gửi giả** vào DTO này.

Nhóm thể hiện các điểm thay thế được cho một công việc, không phải tuyến đi qua tất cả điểm và không phải joint ownership. Mỗi điểm có thể vào nhiều nhóm; các thành viên không bắt buộc giống hệt bước thao tác hay docking offset.

Các API của component danh mục độc lập (không nằm trong màn hình Map Studio hiện tại):

- GET/POST `/api/v1/zones`, PUT `/api/v1/zones/{id}`.
- GET/POST `/api/v1/endpoints`, PUT `/api/v1/endpoints/{id}`.
- GET/POST `/api/v1/endpoint-groups`, PUT `/api/v1/endpoint-groups/{id}`.
- GET/POST `/api/v1/endpoint-group-members`, PUT/DELETE `/api/v1/endpoint-group-members/{groupId}/{endpointId}`.
- GET `/api/v1/maps`, `/api/v1/rooms` và tất cả các trang của các danh mục trên.

Ghi nhóm và ghi thành viên là thao tác độc lập; không tuyên bố một giao dịch nguyên tử. BE yêu cầu thứ tự nguyên dương, không trùng (kể cả thành viên tắt); DELETE member trả 204 và chỉ tắt thành viên. UI cập nhật sau response thành công, giữ dữ liệu cũ nếu lỗi 409/422/403/mạng, không tự retry POST do lỗi mạng. Map ARCHIVED khóa ghi trong editor.

PRIORITY xếp theo sequenceNo. NEAREST_REACHABLE trong `NavigationTargetService` thực tế xếp khoảng cách thẳng từ pose robot mới trong 2 giây; điều hướng mới xác nhận khả năng tiếp cận. allowFallback ở BE cần MOVE thất bại PATH_UNAVAILABLE và bằng chứng dừng vật lý đã commit. FE không tự gửi MOVE thay robot.

Nhóm mô phỏng cũng dùng policy/thứ tự và cờ fallback, lọc thành viên tắt/không tiếp cận/đang bận. BE ownership không được suy ra từ cờ bận mô phỏng. Nhóm cũ lưu bằng tên được chuyển thành thực thể mà vẫn giữ ID tên cũ cho binding đã lưu.

Mô phỏng bổ sung FURTHEST (xa trước) và BALANCED (ít lượt hoàn tất trước, hòa theo thứ tự thành viên). Bộ đếm dùng chung theo endpoint trong phiên trang, chỉ tăng khi phục vụ tại điểm hoàn tất, không tăng khi kiểm tra tuyến hay tạm dừng. Thứ tự cho nhiều nhóm trong một tuyến tính cả các lượt dự kiến trước đó; nếu dừng giữa chừng thì chỉ các lượt thực sự xong mới được ghi nhận. Tải lại trang hoặc nạp snapshot bản đồ mới khởi tạo lại bộ đếm. Bộ chuyển đổi API từ chối hai policy này; component danh mục BE độc lập vẫn chỉ cho PRIORITY/NEAREST_REACHABLE.

Điều phối hiển thị nhóm → điểm được chọn, chính sách và lý do bỏ qua ứng viên không có đường. allowFallback chỉ giải quyết ứng viên trước animation; chưa phải live failover theo cảm biến. Cách demo nằm trong mục “Cách thử nhóm trong Điều phối” của tab Nhóm điểm đích.

## Phần chưa nối

Không khẳng định đã tích hợp toàn bộ 226 API. Scan thật, mapping artifact, triển khai robot, workflow graph execution/SELECT_TARGET runtime vẫn do BE/thiết bị thực hiện; màn hình này không gửi lệnh thiết bị. Nhóm BE không ghép với bản đồ mô phỏng Dispatch. Bỏ công tắc nguồn không có nghĩa là đã chuyển editor sang dùng API thật.

## Xác minh

- Build FE và test model/DTO.
- Browser test component danh mục độc lập: tải đủ trang, đúng map, tạo/sửa nhóm, thành viên, 409 không làm mất dữ liệu, 204 tắt thành viên, payload Zone/Endpoint đúng mét/radian.
- Browser test editor cục bộ và Dispatch: lưu nhóm, snapshot, pause/resume, tốc độ 1/2/3/5, nhiều kích thước màn hình.
- `map-feature-drag.browser.mjs`: kéo vùng/đỉnh/điểm, cập nhật tọa độ, zoom/pan, hủy kéo, kiểm tra vị trí, giữ metadata cũ, tab nhóm dễ tìm và lưu/tải lại.
- `zone-traffic.test.mjs`: danh mục vùng, chặn chiều ngược/đoạn nối, Assumed Cost, chờ một robot, occupancy không chặn giao thông, vật cản hết hạn, cân bằng nhóm và giới hạn DTO BE.
- `zone-traffic.browser.mjs`: chạy/tạm dừng/tiếp tục tình huống MAR-02, đếm lượt hoàn tất và chọn điểm kế tiếp, timeout không tăng bộ đếm, catalog và các kích thước màn hình.
- Mọi ghi API trong browser test đều được mock. Local BE không phản hồi trong lần kiểm tra này; chưa xác nhận E2E với DB/robot thật. Không sửa hay push BE.
