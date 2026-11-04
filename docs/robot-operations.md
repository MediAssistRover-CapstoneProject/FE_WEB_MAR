# Vận hành robot từ FE

FE dùng API của `BE_MAR/src/main/resources/static/mapping.html`. Không cần dán token vào console: các yêu cầu được chuyển qua phiên đăng nhập ADMIN và cơ chế gia hạn token của FE.

## Các bước

1. Mở `/admin/map?stage=scan` trong mục Bản đồ. Chọn robot, tầng và workflow MAPPING đã phát hành. Nút chuẩn bị workflow chỉ tạo/kiểm tra/phát hành mẫu khi người vận hành bấm. Link quét cũ tại Workstations được chuyển sang trang này.
2. Quét thủ công hoặc tự động. Hai chế độ không cùng giữ quyền điều khiển. Lưu map kết thúc quét; FE chỉ chuyển sang map đã lưu khi job và bước commit thành công.
3. Trong `/admin/map`, chọn map đã lưu, kiểm tra khả năng nạp dẫn đường. Với map không tương thích, tạo bản sao DRAFT; bản gốc được giữ nguyên. BE sao chép endpoint, cần kiểm tra lại zone, nhóm điểm và liên kết phòng trên bản sao.
4. Vẽ zone và đặt endpoint. Trước khi lưu/công khai endpoint, FE yêu cầu BE xác nhận điểm thuộc ô trống. Điều này chưa đảm bảo có đường đi hoặc đủ khoảng trống cho kích thước robot. Điểm ngừng sử dụng chỉ được giữ trong màn quản lý Điểm đích để tra cứu/kích hoạt lại; bản đồ điều phối và các danh sách chọn chỉ dùng điểm đang hoạt động, có thể tiếp cận và thuộc đúng map.
5. Kích hoạt map rồi mở `/workstations`. Chọn robot/map, mở phiên và chạy lệnh được hiển thị trong terminal Pi. Mở phiên trên FE chưa tự khởi chạy Nav2 trên Pi.
6. Chọn vị trí thực tế làm SEED hoặc dùng GLOBAL. Chờ đúng map/hash, kết nối mới và trạng thái READY. Chọn một endpoint hoặc tạo tuyến có thứ tự, tối đa 20 điểm; điểm đầu luôn được tiếp cận từ vị trí robot thực tế.
7. Theo dõi request/job, tiến trình MOVE và đường đi Nav2. Hủy là yêu cầu gửi đến BE; đợi phản hồi kết thúc trước khi đóng phiên và đổi robot/map.

## Các API chính

| Chức năng | API |
|---|---|
| Tạo nhiệm vụ quét | `POST /api/v1/mapping-jobs` |
| Trạng thái, preview, điều khiển quét | `/api/v1/jobs/{id}/mapping-session`, `/mapping-preview.png`, `/mapping-control` |
| Quét tự động | `POST /api/v1/jobs/{id}/mapping-autonomy` |
| Phục hồi quét | `GET/POST /api/v1/jobs/{id}/mapping-recovery`, đối soát operation khi BE yêu cầu |
| Lưu map | `POST /api/v1/jobs/{id}/events`, sự kiện `MAPPING_SAVE_REQUESTED` |
| Ảnh/metadata map đã lưu | `GET /api/v1/maps/{id}/image.png`, `/image-metadata` |
| Bản sao tương thích | `POST /api/v1/maps/{id}/navigation-copy` |
| Kiểm tra endpoint | `POST /api/v1/maps/{id}/validate-navigation-point` |
| Zone/endpoint | `/api/v1/zones`, `/api/v1/endpoints` |
| Phiên/khởi tạo/đóng phiên | `/api/v1/robots/{id}/navigation-session`, `/initialization`, `/close` |
| Trạng thái trực tiếp | `GET /api/v1/robots/{id}/snapshot`, `/stream` |
| Xác nhận profile endpoint/zone | `GET /api/v1/robots/{id}/navigation-zones` |
| MOVE một điểm | `POST /api/v1/navigation-requests`, rồi `/api/v1/service-requests/{id}/submit` |
| Tuyến nhiều điểm | `POST /api/v1/navigation-routes`, `submit: true` |
| Khôi phục request sau lỗi mạng | `GET /api/v1/service-requests/by-idempotency-key?key=...` |

Request MOVE/tuyến dùng lại Idempotency-Key khi kết quả gửi chưa rõ; việc đọc lại trạng thái không tự tạo lệnh chạy mới. Bằng chứng dừng/phục hồi phải do BE/Pi xác nhận, FE không tự đổi trạng thái vật lý.

## Giới hạn cần kiểm chứng trên robot

- Profile ACK là xác nhận đã nhận cấu hình, chưa chứng minh robot thực thi vùng cấm/giới hạn tốc độ. Mã Pi trong workspace cần được đối chiếu với bản đã triển khai và kiểm thử thực thi zone.
- `NO_STOP` hiện là dữ liệu danh mục, chưa được đưa vào navigation profile của BE.
- Hướng cuối endpoint phụ thuộc cấu hình Nav2/Pi thực tế. SEED là khai báo vị trí thực tế để định vị, không phải lệnh di chuyển tới điểm đó.
- Các browser test trong `tests/` giả lập API; không phải kiểm thử phần cứng và không ghi dữ liệu vào BE thật.
