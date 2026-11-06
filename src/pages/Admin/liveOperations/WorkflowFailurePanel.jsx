import { useEffect, useRef, useState } from 'react';
import { workflowFailureApi } from '../../../features/operations/workflowFailureApi.js';

const stamp = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
export default function WorkflowFailurePanel({ job, refreshTick, disabled, onOpenRecovery, onSaved }) {
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState('');
  const generation = useRef(0), lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (lock.current) return;
    const token = ++generation.current, controller = new AbortController();
    workflowFailureApi.get(job.jobId, controller.signal).then(value => {
      if (!controller.signal.aborted && token === generation.current) { setSnapshot(value); setError(''); }
    }).catch(cause => {
      if (!controller.signal.aborted && token === generation.current) setError(cause.status === 404 ? 'BE chưa cung cấp xử lý lỗi tự động cho công việc này. Các điều kiện đối soát hiện có vẫn áp dụng.' : cause.message);
    });
    return () => controller.abort();
  }, [job.jobId, job.status, refreshTick]);
  async function act(action) {
    if (lock.current || disabled || error) return;
    if (action === 'escalate' && !note.trim()) { setError('Nhập lý do cần Admin hỗ trợ.'); return; }
    lock.current = true; ++generation.current; setBusy(true); setError('');
    try {
      const value = action === 'acknowledge' ? await workflowFailureApi.acknowledge(job.jobId) : await workflowFailureApi.escalate(job.jobId, note.trim());
      if (mounted.current) { setSnapshot(value); setNote(''); onSaved?.(action === 'acknowledge' ? 'Đã tiếp nhận xử lý lỗi. Job tiếp tục dừng.' : 'Đã chuyển lỗi lên Admin. Job tiếp tục dừng.'); }
    } catch (cause) { if (mounted.current) setError(cause.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  if (!snapshot?.enabled && !error) return null;
  const f = snapshot?.failure;
  if (!f && job.status !== 'RECOVERY_REQUIRED' && !error) return null;
  return <section className="lo-recovery lo-failure-handling" aria-label="Tiếp nhận và chuyển cấp lỗi">
    <h4>Xử lý lỗi công việc</h4>
    {error && <div role="alert" className="lo-notice lo-notice-error"><p>{error}</p><button className="lo-text-button" type="button" onClick={() => { setError(''); onSaved?.('Đang tải lại xử lý lỗi.'); }}>Tải lại</button></div>}
    {!f ? <p role="status">Máy chủ đang ghi nhận hồ sơ lỗi và gửi thông báo. Job tiếp tục dừng.</p> : <>
      <p><strong>{f.stepName || f.stepCode || 'Workflow'} · {f.errorCode}</strong></p>
      <p>{f.status === 'RESOLVED' ? 'Hồ sơ đã kết thúc sau khi công việc được đối soát.' : f.escalatedAt ? 'Đã chuyển Admin hỗ trợ.' : 'Đang chờ Staff phụ trách xử lý.'} {f.handlerName && `Người tiếp nhận: ${f.handlerName}.`}</p>
      {f.deliveryPending && <p role="status">Chưa gửi được cảnh báo đến tài khoản phù hợp. BE sẽ tiếp tục thử; job không được chạy tiếp.</p>}
      {f.overdueAt && f.status !== 'RESOLVED' && <p role="status">Đã quá hạn phản hồi/xử lý của Admin. Đã yêu cầu cảnh báo nhắc; job tiếp tục dừng để chờ kiểm tra.</p>}
      <dl className="lo-recovery-facts"><div><dt>{f.handlerAccountId ? 'Hạn xử lý' : 'Hạn tiếp nhận'}</dt><dd>{stamp(f.handlerAccountId ? f.resolutionDeadline : f.acknowledgeDeadline)}</dd></div><div><dt>Chuyển Admin</dt><dd>{stamp(f.escalatedAt)}</dd></div></dl>
      {f.note && <p>Ghi chú: {f.note}</p>}
      {f.canEscalate && <label className="lo-failure-note">Lý do cần Admin hỗ trợ<textarea aria-label="Lý do chuyển Admin" maxLength={2000} disabled={busy || disabled} value={note} onChange={e => { setNote(e.target.value); if (error === 'Nhập lý do cần Admin hỗ trợ.') setError(''); }} /></label>}
      <div className="lo-recovery-actions">
        {f.canAcknowledge && !f.handlerAccountId && <button className="lo-button lo-primary" disabled={busy || disabled || !!error} onClick={() => act('acknowledge')}>Tiếp nhận xử lý lỗi</button>}
        {f.canEscalate && <button className="lo-button" disabled={busy || disabled || !!error || !note.trim()} onClick={() => act('escalate')}>Không xử lý được · Chuyển Admin</button>}
        {job.status === 'RECOVERY_REQUIRED' && onOpenRecovery && <button className="lo-button" disabled={busy || disabled} onClick={onOpenRecovery}>Kiểm tra để kết thúc job</button>}
      </div>
      <p className="lo-muted">Tiếp nhận cảnh báo không chạy lại robot. Kết thúc thất bại/hủy cần đối soát bằng chứng dừng và kiểm tra hàng/ngăn chứa.</p>
    </>}
  </section>;
}
