import { useEffect, useRef, useState } from 'react';
import { jobPath, post, request } from '../../../features/robotOperations/api.js';
import { mappingRecoveryPlan } from '../../../features/robotOperations/mappingOperations.js';
import { ErrorNotice, Field } from './Shared.jsx';

export default function MappingRecoveryPanel({ jobId, required, busy: parentBusy, stop, onRecovered }) {
  const [loading, setLoading] = useState(false), [evidence, setEvidence] = useState(null), [error, setError] = useState(null), [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false), [note, setNote] = useState('Đóng nhiệm vụ quét bị gián đoạn sau khi kiểm tra bằng chứng dừng do BE xác nhận.');
  const pending = useRef(null), epoch = useRef(0), lock = useRef(false);
  useEffect(() => { ++epoch.current; pending.current = null; setEvidence(null); setConfirmed(false); setLoading(false); setError(null); setMessage(''); return () => { ++epoch.current; }; }, [jobId]);
  const inspect = async () => {
    if (lock.current || pending.current) return;
    lock.current = true; setLoading(true); setError(null); setConfirmed(false); setMessage(''); const generation = epoch.current;
    try {
      const mapping = await request(`${jobPath(jobId)}/mapping-recovery`);
      const operation = mapping.selectedUnsentStop || mapping.selectedRejectedMappingAction ? null : await request(`${jobPath(jobId)}/operations/recovery`);
      if (generation === epoch.current) { setEvidence({ mapping, operation }); pending.current = null; }
    } catch (e) { if (generation === epoch.current) setError(e); }
    finally { lock.current = false; if (generation === epoch.current) setLoading(false); }
  };
  let reason = '', plan;
  try { if (evidence) plan = mappingRecoveryPlan(jobId, evidence.mapping, evidence.operation, note); } catch (e) { reason = e.message; }
  const recover = async () => {
    if (lock.current || !confirmed || !plan) return;
    lock.current = true; setLoading(true); setError(null); const generation = epoch.current;
    try {
      await stop();
      if (generation !== epoch.current) return;
      // Keep the exact body and key if HTTP fails after BE may have committed.
      pending.current ||= { ...plan, key: crypto.randomUUID() };
      const value = pending.current;
      const result = await post(value.path, value.body, { retry: false, headers: { 'Idempotency-Key': value.key } });
      if (generation !== epoch.current) return;
      pending.current = null; setConfirmed(false); setEvidence(null);
      setMessage(`BE đã đối soát: ${result.status || 'đã kết thúc'}. Chờ Pi kết nối HELLO mới và robot sẵn sàng trước khi tạo nhiệm vụ.`);
      onRecovered();
    } catch (e) { if (generation === epoch.current) setError(e); }
    finally { lock.current = false; if (generation === epoch.current) setLoading(false); }
  };
  if (!jobId) return null;
  return <details className="ro-card ro-recovery" open={required || undefined}>
    <summary>Phục hồi phiên quét {required && <span className="ro-badge">Cần xử lý</span>}</summary>
    <p>Đọc bằng chứng từ BE trước khi đóng nhiệm vụ bị gián đoạn. Chức năng này không thay thế việc dừng robot và không đánh dấu quét thành công.</p>
    <div className="ro-actions"><button type="button" disabled={loading || parentBusy || !!pending.current} onClick={inspect}>Kiểm tra bằng chứng phục hồi</button></div>
    {pending.current && <p className="ro-help">Chưa rõ kết quả đối soát. Giữ nguyên mã yêu cầu và nội dung khi gửi lại; không tạo yêu cầu phục hồi mới.</p>}
    {loading && <p role="status">Đang đối chiếu với máy chủ…</p>}
    {reason && <p className="ro-help" role="status">{reason}</p>}
    {plan && <><p className="ro-status">BE đã cung cấp bằng chứng đủ điều kiện để gửi yêu cầu đóng nhiệm vụ.</p><Field label="Ghi chú phục hồi"><textarea maxLength={2000} value={note} disabled={loading || !!pending.current} onChange={e => setNote(e.target.value)} /></Field><label className="ro-check"><input type="checkbox" checked={confirmed} disabled={loading} onChange={e => setConfirmed(e.target.checked)} />Tôi đã kiểm tra robot đứng yên và xem bằng chứng dừng bên dưới.</label><div className="ro-actions"><button type="button" disabled={loading || parentBusy || !confirmed} onClick={recover}>{pending.current ? 'Gửi lại cùng yêu cầu đối soát' : 'Đối soát và đóng nhiệm vụ'}</button></div></>}
    {evidence && <details className="ro-details"><summary>Bằng chứng kỹ thuật từ BE</summary><pre>{JSON.stringify(evidence, null, 2)}</pre></details>}
    <ErrorNotice error={error} />{message && <p role="status">{message}</p>}
  </details>;
}
