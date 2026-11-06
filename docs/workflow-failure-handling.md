# Dừng luồng, thông báo và chuyển cấp khi workflow lỗi

Triển khai mã BE/FE ngày 06/11/2026. Chưa triển khai lên môi trường đang chạy hay tạo lỗi/điều khiển robot thật trong quá trình kiểm thử.

## Hành vi

- Workflow mới/mẫu giao hàng QR mới bật chính sách xử lý lỗi mặc định. Workflow cũ thiếu metadata giữ hành vi cũ; bật ở **Thông tin & biến → Khi có lỗi** trên bản nháp hoặc phiên bản clone.
- Khi bật, step FAILED/TIMED_OUT dừng luồng ở RECOVERY_REQUIRED trước khi xét nhánh lỗi tùy chỉnh. Giới hạn thời gian workflow cũng chuyển sang chờ xử lý, kể cả đường dừng lệnh Pi. Guard phản hồi nút không hợp lệ vẫn dừng tại step. Không thêm dây lỗi lên canvas.
- QR bị từ chối nhưng bước còn chờ, hoặc chưa bấm nút khi thời hạn còn hiệu lực, không tự tạo hồ sơ lỗi.
- BE ghi một WorkflowFailureCase duy nhất cho mỗi Job. Scheduler chạy mỗi 5 giây, tạo cảnh báo WEB WORKFLOW_FAILURE cho Staff phụ trách. Không có Staff đủ điều kiện thì chuyển Admin ngay. Có tùy chọn báo Admin ngay; khi đó cả Staff được phân công và Admin nhận cảnh báo, Admin tiếp nhận hồ sơ.
- Mặc định 120 giây chưa tiếp nhận thì chuyển Admin. Sau khi tiếp nhận, quá 600 giây chưa kết thúc thì chuyển Admin. Người dựng có thể thay thời hạn; BE giới hạn lần lượt 30–3600 và 60–86400 giây.
- Staff có thể tiếp nhận hoặc ghi lý do “Không xử lý được · Chuyển Admin”. Chuyển cấp bỏ người tiếp nhận cũ để Admin nhận việc. Job vẫn dừng; không có hành vi chạy lại hay bỏ qua bước.
- Admin không phản hồi/xử lý đúng hạn: tạo một cảnh báo nhắc, đánh dấu quá hạn, giữ job chờ xử lý. Không tự ép FAILED/CANCELLED hoặc giải phóng robot chỉ vì hết giờ.
- Tiếp nhận qua API Alerts cũ cũng được scheduler nhận diện; xác nhận đã thấy cảnh báo không hoàn tất step hay chạy tiếp job.
- Thiếu tài khoản nhận phù hợp: vẫn lưu hồ sơ và thử gửi lại ở lượt sau. Lỗi tạo/gửi thông báo nằm trong giao dịch độc lập, không rollback quyết định dừng robot/job.
- Hồ sơ và cảnh báo tự đóng sau khi Job thực sự chuyển trạng thái kết thúc qua cơ chế đối soát hiện có. Alert không được resolve/close thủ công trong lúc job chưa kết thúc. Ghi chú đối soát được giữ trong hồ sơ; hàng còn trên robot cần được mô tả khi bàn giao thủ công.

## Cấu hình

`inputUiJson.failureHandling` được BE kiểm tra và sử dụng như chính sách thực thi, không chỉ là nhãn UI:

```json
{
  "version": 1,
  "enabled": true,
  "acknowledgeTimeoutSec": 120,
  "resolutionTimeoutSec": 600,
  "notifyAdminImmediately": false
}
```

Policy của case được chụp bằng các cột thời hạn khi mở. Không mở lại đồng hồ khi gửi trùng cùng một thao tác tiếp nhận. Các định nghĩa đã có Job vẫn tuân thủ ràng buộc bất biến của BE.

## API và quyền

- `GET /api/v1/jobs/{jobId}/failure-handling`: trạng thái policy/case, người tiếp nhận, thời hạn, cảnh báo và quyền thao tác hiện tại.
- `POST /api/v1/jobs/{jobId}/failure-handling/acknowledge`: tiếp nhận hồ sơ, không nhận body và không điều khiển robot.
- `POST /api/v1/jobs/{jobId}/failure-handling/escalate`: body `{ "note": "Lý do cần Admin hỗ trợ" }`, 1–2000 ký tự; thao tác lặp không tạo thêm cảnh báo Admin.

Tất cả yêu cầu phiên Staff/Admin hiện hành và phạm vi Job. Staff được phân công hoặc người đang xử lý mới thao tác hồ sơ; sau chuyển cấp chỉ Admin tiếp nhận. Một người tiếp nhận tại một thời điểm; mọi mutation/scheduler cùng khóa hàng Job trước khi đọc/ghi case. Unique job_id và operation key cảnh báo bảo vệ gửi trùng nhiều tiến trình.

Đóng job dùng các API reconcile hiện có, gồm đối soát lệnh MQTT nếu còn lệnh chưa giải quyết. Các yêu cầu HELLO, heartbeat, nhật ký thao tác và bằng chứng dừng vẫn giữ nguyên. API xử lý lỗi mới không có đường “resume”, “force success” hay “force close”.

## Giao diện

- Cấu hình dùng chung trong designer, không yêu cầu thêm NOTIFY/WAIT vào từng nhánh lỗi.
- Màn Cảnh báo mở đúng Job qua `jobId` trong URL; các nút thao tác chung trên cảnh báo lỗi được thay bằng lối vào xử lý tại Job.
- Vận hành trực tiếp có khung **Xử lý lỗi công việc** với Tiếp nhận, ghi lý do/Chuyển Admin và lối vào đối soát. Nếu API lỗi hoặc dữ liệu cũ, khoá mutation; BE kiểm tra quyền và trạng thái lại khi nhận request.
- API adapter riêng `workflowFailureApi.js` dùng chung bearer/refresh/error handling. Ba API mới chưa nằm trong snapshot OpenAPI `backendContract.json`; cần tái tạo snapshot khi đồng bộ contract toàn bộ sau triển khai BE.

## Triển khai và kiểm chứng

1. Triển khai BE kèm Flyway **V45__workflow_failure_handling.sql**. Scheduler chịu cờ `app.operations.scheduler-enabled`; chu kỳ cấu hình bằng `app.workflow.failure-handling-delay-ms` (mặc định 5000).
2. Triển khai FE cùng phiên bản BE. Bản BE cũ không có API/worker này; chỉ lưu metadata ở FE không tự tạo khả năng thông báo/chuyển cấp.
3. Bật policy và lưu/kiểm tra workflow muốn áp dụng. Với bản PUBLISHED/ARCHIVED tạo phiên bản mới theo vòng đời hiện có.
4. Kiểm tra trên môi trường thử với tài khoản Staff/Admin và dữ liệu thử; xác nhận Alert WEB, chuyển cấp, quyền/phạm vi và bằng chứng dừng thật trước khi sử dụng vận hành.

Đã kiểm thử service/state machine và orchestration bằng JUnit/Mockito, model FE bằng Node, giao diện bằng Playwright với toàn bộ API giả lập. Kiểm thử bao phủ gửi trùng, đồng hồ tiếp nhận/xử lý, thiếu người nhận, tiếp nhận qua Alerts, chuyển Admin, quá hạn Admin không tự thả robot, giữ guard QR và đối soát riêng. Docker daemon trên máy không hoạt động, nên chưa chạy migration/candidate SQL với MySQL thật; cần kiểm chứng bước này trên DB thử. Không khởi động BE bằng cấu hình DB/MQTT hiện tại để tránh chạm môi trường vận hành.

```powershell
# BE: pom hiện giữ mặc định skip test; bật rõ cho kiểm thử tính năng.
mvn "-Dmaven.test.skip=false" "-Dtest=WorkflowFailureHandlingServiceTest,WorkflowFailurePolicyTest,WorkflowFailureStopTest,WorkflowFailureAlertGuardTest" test
# FE: Vite 5186, browser tests chỉ dùng fixture.
node --test tests/workflow-failure-policy.test.mjs
node tests/workflow-failure-handling.browser.mjs
npm.cmd run build
```
