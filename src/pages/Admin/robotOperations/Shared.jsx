import { cloneElement, useEffect, useId, useState } from 'react';
import { loadCatalog } from '../../../features/robotOperations/api.js';
import { friendlyError, jobLabels } from '../../../features/robotOperations/model.js';
import './robotOperations.css';

export function useCatalog(type, operator) {
  const [catalog, setCatalog] = useState({ robots: [], floors: [], workflows: [] });
  const [loading, setLoading] = useState(false), [error, setError] = useState(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!operator) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    loadCatalog(type, controller.signal).then(value => { if (!controller.signal.aborted) setCatalog(value); })
      .catch(e => { if (!controller.signal.aborted) setError(e); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, operator, revision]);
  return { catalog, loading, error, reload: () => setRevision(v => v + 1) };
}
export function Field({ label, children }) { const id = useId(); return <label className="ro-field" htmlFor={id}><span>{label}</span>{cloneElement(children, { id, 'aria-label': label })}</label>; }
export function Picker({ label, value, onChange, items, idKey, nameKey, disabled, empty }) {
  return <Field label={label}><select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} required>
    <option value="">{items.length ? `Chọn ${label.toLowerCase()}` : empty}</option>
    {items.map(item => <option value={item[idKey]} key={item[idKey]}>{item[nameKey] || item.robotCode || 'Chưa đặt tên'}{item.versionNo ? ` · v${item.versionNo}` : ''}</option>)}
  </select></Field>;
}
export function ErrorNotice({ error }) {
  if (!error) return null;
  return <div className="ro-error" role="alert"><p>{friendlyError(error)}</p><details><summary>Chi tiết lỗi</summary><p>{error.message}</p></details></div>;
}
export function JobStatus({ detail, session, saving, error, title = 'Trạng thái nhiệm vụ' }) {
  const job = detail?.job;
  let label = job ? jobLabels[job.status] || 'Đang cập nhật' : 'Chưa có nhiệm vụ';
  if (saving && job?.status !== 'SUCCEEDED' && !['FAILED', 'CANCELLED', 'RECOVERY_REQUIRED'].includes(job?.status)) label = 'Đang lưu và kết thúc';
  else if (session?.state === 'MAPPING' && job?.status === 'RUNNING') label = 'Đang quét bản đồ';
  return <section className="ro-card" aria-label={title}>
    <h3>{title}</h3><p className={'ro-status ' + (job?.status === 'SUCCEEDED' ? 'ro-success' : '')} role="status">{label}</p>
    {job?.status === 'RECOVERY_REQUIRED' && <p className="ro-error">Robot cần được kiểm tra và xác nhận dừng. Mở Vận hành trực tiếp để xem bằng chứng và khôi phục; không tạo thêm nhiệm vụ cho robot này.</p>}
    {job && ['FAILED', 'TIMED_OUT', 'CANCELLED'].includes(job.status) && <p>Nhiệm vụ chưa hoàn tất thành công. Kiểm tra chi tiết trước khi thử lại.</p>}
    {error && <ErrorNotice error={error} />}
    {detail?.steps?.length > 0 && <ol className="ro-steps">{detail.steps.map((step, index) => <li key={step.jobStepId || index}><span>{detail.tasks?.find(t => t.jobTaskId === step.jobTaskId)?.taskNameSnapshot || `Bước ${index + 1}`}</span><small>{jobLabels[step.status] || ({ PENDING: 'Chờ thực hiện', SKIPPED: 'Đã bỏ qua' })[step.status] || 'Đang cập nhật'}</small></li>)}</ol>}
    {job && <details className="ro-details"><summary>Chi tiết kỹ thuật</summary><dl><dt>Mã nhiệm vụ</dt><dd>{job.jobCode || job.jobId}</dd><dt>Trạng thái BE</dt><dd>{job.status}</dd>{session && <><dt>Phiên quét</dt><dd>{session.mapping_session_id}</dd><dt>Trạng thái phiên</dt><dd>{session.state}</dd></>}{job.failureReason && <><dt>Lý do</dt><dd>{job.failureReason}</dd></>}</dl><pre>{JSON.stringify({ result: job.resultJson, steps: detail.steps?.map(s => ({ step: s.stepCodeSnapshot, status: s.status, result: s.resultJson, error: s.errorDetailsJson })) }, null, 2)}</pre></details>}
  </section>;
}
