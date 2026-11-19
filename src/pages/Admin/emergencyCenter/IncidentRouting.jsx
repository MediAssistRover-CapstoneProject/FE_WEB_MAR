import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession } from '../../../features/auth/session.js';
import { getIncidentRouting, retryIncidentRouting, emergencyError } from '../../../features/operations/emergencyApi.js';
import { canRetryIncidentRouting, SOS_ROUTING_REASONS } from '../../../features/operations/emergencyCenter.js';

export default function IncidentRouting({ incident, account, onChange, onSaved }) {
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true);
  const lock = useRef(false), write = useRef(null);
  const eligible = canRetryIncidentRouting(incident, account);
  useEffect(() => () => write.current?.abort(), []);
  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    getIncidentRouting(incident.incidentId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      validate(value, incident.incidentId);
      setResult(value);
    }).catch(cause => { if (!controller.signal.aborted) setError(emergencyError(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [incident.incidentId, incident.rowVersion, eligible, revision]);

  if (!eligible) return null;
  const retry = async () => {
    if (lock.current || !result?.canRetry || loading) return;
    if (getSession()?.account?.accountId !== account.accountId || getSession()?.account?.role !== 'ADMIN') {
      setError('Tài khoản đăng nhập đã thay đổi. Hãy tải lại trang.'); return;
    }
    lock.current = true; setBusy(true); setError('');
    write.current = new AbortController();
    try {
      const value = await retryIncidentRouting(incident.incidentId, result.incident.rowVersion, write.current.signal);
      if (write.current.signal.aborted) return;
      validate(value, incident.incidentId);
      setResult(value); onChange(value.incident);
      if (value.incident.sosResponderAccountId) onSaved('Đã điều phối sự cố cho nhân viên đang trực.');
    } catch (cause) {
      if (!write.current.signal.aborted) {
        setResult(null);
        setError(`${emergencyError(cause)} Bấm “Kiểm tra lại” để lấy trạng thái mới nhất trước khi gửi lại.`);
      }
    } finally { lock.current = false; setBusy(false); }
  };
  return <section className="ec-routing-check" aria-label="Kiểm tra điều phối SOS">
    <strong>Kiểm tra điều phối hiện tại</strong>
    {loading && <p role="status">Đang kiểm tra phòng SOS và nhân viên đã check-in…</p>}
    {result && <>
      <p>Phòng tiếp nhận SOS: <strong>{result.eligibility.roomName || 'Chưa xác định'}</strong></p>
      <p>{SOS_ROUTING_REASONS[result.eligibility.reason] || 'Chưa xác định điều kiện điều phối. Hãy kiểm tra lại cấu hình.'}</p>
      <p>Phân ca cần đúng phòng và còn giờ. Ca chiều 12:00–18:00 sẽ không nhận sự cố từ 18:00.</p>
      <p>Điều phối lại sẽ kiểm tra lần nữa và gửi cảnh báo cho nhân viên phù hợp.</p>
      {!result.canRetry && <p>Sự cố đã thay đổi hoặc đã có người phụ trách. Hãy tải lại chi tiết.</p>}
    </>}
    {error && <p className="ec-inline-warning" role="alert">{error}</p>}
    <div className="ec-routing-actions">
      <button className="ec-button" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Kiểm tra lại</button>
      <button className="ec-button ec-primary" disabled={busy || loading || !!error || !result?.canRetry} onClick={retry}>{busy ? 'Đang điều phối…' : 'Điều phối lại'}</button>
    </div>
    <p><Link to="/admin/facility?tab=rooms">Kiểm tra phòng SOS</Link> · <Link to="/admin/staff-shifts">Kiểm tra ca trực</Link></p>
  </section>;
}

function validate(value, id) {
  if (value?.incident?.incidentId !== id || !Number.isFinite(value.incident.rowVersion)
    || !value.eligibility?.reason || typeof value.canRetry !== 'boolean')
    throw Error('Máy chủ chưa xác nhận kết quả kiểm tra điều phối. Hãy tải lại.');
}
