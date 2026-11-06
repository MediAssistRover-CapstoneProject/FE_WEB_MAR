import { effectiveParams, hasAutomaticCloseStop } from '../../../features/workflows/designer/designerModel.js';
import { failurePolicy } from '../../../features/workflows/workflowFailurePolicy.js';

export default function StepRuntimeSummary({ document, node }) {
  const params = effectiveParams(node);
  const pi = ['MOVE', 'CONTROL_HARDWARE', 'EXECUTE_SENSING'].includes(node.data.stepType)
    || node.data.stepType === 'INTERACT' && params.action === 'SPEAK'
    || node.data.stepType === 'WAIT' && params.wait_type === 'DURATION';
  const implicit = ['FAILURE', 'TIMEOUT'].filter(outcome => !document.edges.some(e => e.source === node.id && e.data?.outcome === outcome));
  const handling = failurePolicy(document.workflow).enabled;
  return <section className="wfd-step-behaviour" aria-label="Thực thi và xử lý sự cố">
    <strong>{document.workflow.schemaVersion === 3 ? `Thực thi: ${pi ? 'Pi / robot' : 'BE'}` : 'Thực thi theo contract schema 2'}</strong>
    <p>{handling ? 'Lỗi / hết giờ: dừng luồng và chờ Staff / Admin xử lý theo cấu hình workflow. Không cần nối dây cho phần này.' : implicit.length ? `${implicit.map(o => o === 'FAILURE' ? 'Lỗi' : 'Hết giờ').join(' / ')}: tự ghi nhận lỗi tại bước và dừng luồng, không chạy bước tiếp theo. Không cần nối dây cho phần này.` : 'Lỗi và hết giờ đang dùng nhánh tùy chỉnh đã nối.'}</p>
    {!handling && implicit.length === 1 && <p>{implicit[0] === 'FAILURE' ? 'Hết giờ' : 'Lỗi'}: đang dùng nhánh tùy chỉnh đã nối.</p>}
    {handling && implicit.length < 2 && <p>Chính sách chờ xử lý lỗi được ưu tiên trước nhánh lỗi tùy chỉnh đã nối.</p>}
    {hasAutomaticCloseStop(document, node.id) && <p>Phản hồi nút không hợp lệ: tự dừng tại bước, không phát lệnh đóng servo. Chưa bấm nút thì tiếp tục chờ.</p>}
    <small>BE lưu lỗi trong lịch sử bước. Xử lý tự động dùng RECOVERY_REQUIRED; với lệnh robot chưa rõ kết quả, BE chờ đối chiếu/dừng an toàn và có thể cần nhân viên xử lý.</small>
  </section>;
}
