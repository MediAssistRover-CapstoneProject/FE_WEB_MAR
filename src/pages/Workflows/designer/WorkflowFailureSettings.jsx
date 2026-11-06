import { failurePolicy } from '../../../features/workflows/workflowFailurePolicy.js';
import { Field } from './DesignerControls.jsx';

export default function WorkflowFailureSettings({ document, change }) {
  const policy = failurePolicy(document.workflow);
  const update = patch => change(d => ({ ...d, workflow: { ...d.workflow, inputUiJson: { ...d.workflow.inputUiJson, failureHandling: { ...policy, ...patch } } } }));
  return <section className="wfd-variables" aria-label="Khi workflow có lỗi">
    <h3>Khi có lỗi</h3>
    <label className="wfd-check"><input type="checkbox" checked={policy.enabled === true} onChange={e => update({ enabled: e.target.checked })} />Dừng luồng và báo Staff / Admin</label>
    {policy.enabled ? <>
      <p className="wfd-muted">Staff phụ trách tiếp nhận lỗi. Không có Staff phụ trách thì báo Admin ngay. Chỉ cần nối luồng thành công; lỗi luôn dừng để chờ xử lý.</p>
      <Field label="Thời hạn tiếp nhận lỗi (giây)" help="Chưa có người tiếp nhận sau thời hạn này: chuyển Admin."><input type="number" min="30" max="3600" value={policy.acknowledgeTimeoutSec} onChange={e => update({ acknowledgeTimeoutSec: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>
      <Field label="Thời hạn xử lý sau khi tiếp nhận (giây)" help="Staff quá hạn xử lý: chuyển Admin. Admin quá hạn: gửi cảnh báo nhắc, job tiếp tục dừng."><input type="number" min="60" max="86400" value={policy.resolutionTimeoutSec} onChange={e => update({ resolutionTimeoutSec: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>
      <label className="wfd-check"><input type="checkbox" checked={policy.notifyAdminImmediately === true} onChange={e => update({ notifyAdminImmediately: e.target.checked })} />Báo Admin ngay khi có lỗi</label>
      <p className="wfd-muted">Tiếp nhận cảnh báo không cho job chạy lại. Kết thúc thất bại/hủy qua đối soát sau khi xác minh điều kiện dừng và tình trạng hàng.</p>
    </> : <p className="wfd-muted">Workflow này chưa bật thông báo và chuyển cấp lỗi tự động. Các nhánh và điều kiện dừng hiện có vẫn được giữ.</p>}
  </section>;
}
