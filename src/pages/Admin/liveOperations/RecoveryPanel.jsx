import { useEffect, useRef, useState } from 'react';
import { callBackend } from '../../../features/api/backendApi.js';
import { prepareBody } from '../../../features/api/contract.js';
import { assertJobAction, recoveryIdentity, recoveryPlan } from '../../../features/operations/liveOperations.js';
import RecordDetails from '../backend/RecordDetails.jsx';

const evidenceLabels = {
  PI_STOP_CONFIRMED: 'Robot đã gửi bằng chứng dừng',
  STAFF_INSPECTED_STOP: 'Đã kiểm tra và đối soát dừng tại robot',
  COMMAND_NOT_ACCEPTED: 'Lệnh bị từ chối trước khi robot tiếp nhận',
};

export default function RecoveryPanel({ detail, refreshTick, onDetail, getLatestDetail, onSaved, role, disabled }) {
  const { job } = detail;
  const [evidence, setEvidence] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0), [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!job.beOrchestrated) return;
    const controller = new AbortController();
    callBackend('GET /api/v1/jobs/{jobId}/operations/recovery', { path: { jobId: job.jobId } }, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setEvidence(value); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Không tải được bằng chứng phục hồi.'); });
    return () => controller.abort();
  }, [job.jobId, job.beOrchestrated, refreshTick, retry]);
  const plan = recoveryPlan(detail, evidence), physical = evidence?.physicalUncertainty;
  return <section className="lo-recovery">
    <h4>Xác minh và kết thúc phục hồi</h4>
    <p>Kiểm tra robot và bằng chứng thực tế trước khi kết thúc công việc. Đối soát không tự chạy lại nhiệm vụ.</p>
    {job.beOrchestrated && !evidence && !error ? <p role="status">Đang tải bằng chứng phục hồi…</p> : <>
      {error && <div className="lo-notice lo-notice-error" role="alert"><p>{error} Tạm khóa đối soát.</p></div>}
      {physical && <dl className="lo-recovery-facts">
        <div><dt>Lệnh chưa xác nhận dừng</dt><dd>{physical.stopUnconfirmed === true ? 'Có · cần kiểm tra' : physical.stopUnconfirmed === false ? 'Không ghi nhận' : 'Chưa có dữ liệu'}</dd></div>
        <div><dt>Tín hiệu kết nối robot</dt><dd>{physical.heartbeatFresh === true ? 'Còn hiệu lực' : physical.heartbeatFresh === false ? 'Chưa có tín hiệu mới' : 'Chưa có dữ liệu'}</dd></div>
        <div><dt>Trạng thái robot báo về</dt><dd>{physical.robotReportsIdle === true ? 'Robot báo rảnh' : physical.robotReportsIdle === false ? 'Chưa báo trạng thái rảnh' : 'Chưa có dữ liệu'}</dd></div>
      </dl>}
      {!error && (plan.blocked.length ? <div className="lo-recovery-checklist" role="status"><strong>Chưa đủ điều kiện đối soát trên trang này</strong><ul>{plan.blocked.map(reason => <li key={reason}>{reason}</li>)}</ul></div> : <p className="lo-muted">{plan.kind === 'operation' ? `Đã xác định lệnh của bước ${plan.stepCode || 'hiện tại'}. Máy chủ sẽ kiểm tra lại bằng chứng và nhật ký robot khi gửi.` : 'Không có lệnh robot cần đối soát riêng được ghi nhận. Có thể xác minh và kết thúc công việc; máy chủ kiểm tra điều kiện lần cuối.'}</p>)}
      {evidence && <details><summary>Bằng chứng lệnh và trạng thái robot</summary><RecordDetails value={evidence} /></details>}
      <div className="lo-recovery-actions"><button className="lo-button lo-primary" disabled={disabled || !!error || plan.blocked.length > 0} onClick={() => setSnapshot({ detail, plan })}>{plan.kind === 'operation' ? 'Đối soát lệnh robot' : 'Đối soát công việc'}</button>{job.beOrchestrated && <button className="lo-button" onClick={() => setRetry(value => value + 1)}>Tải lại bằng chứng</button>}</div>
    </>}
    {snapshot && <RecoveryDialog snapshot={snapshot} role={role} onClose={() => setSnapshot(null)} onDetail={onDetail} getLatestDetail={getLatestDetail} onEvidence={setEvidence} onSaved={() => { setSnapshot(null); onSaved('Đã đối soát và kết thúc công việc. Robot cần được máy chủ xác nhận sẵn sàng trước lần điều phối tiếp theo.'); }} />}
  </section>;
}

function RecoveryDialog({ snapshot, role, onClose, onDetail, getLatestDetail, onEvidence, onSaved }) {
  const ref = useRef(null), lock = useRef(false), requestIdentity = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [evidenceType, setEvidenceType] = useState(''), [outcome, setOutcome] = useState(''), [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false);
  const { plan, detail } = snapshot;
  useEffect(() => { ref.current?.showModal(); }, []);
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    if (!confirmed) { setError('Cần kiểm tra thực tế và xác nhận trước khi đối soát.'); return; }
    lock.current = true; setBusy(true);
    try {
      const received = await callBackend('GET /api/v1/jobs/{id}', { path: { id: detail.job.jobId } });
      const fresh = onDetail(received) || received;
      assertJobAction(plan.key, detail, fresh, role);
      const evidence = fresh.job.beOrchestrated ? await callBackend('GET /api/v1/jobs/{jobId}/operations/recovery', { path: { jobId: detail.job.jobId } }) : null;
      onEvidence(evidence);
      const latest = getLatestDetail?.() || fresh;
      assertJobAction(plan.key, detail, latest, role);
      const next = recoveryPlan(latest, evidence);
      if (next.blocked.length || recoveryIdentity(next) !== recoveryIdentity(plan) || (next.kind === 'operation' && !next.evidenceTypes.includes(evidenceType))) throw Error('Trạng thái lệnh, phiên kết nối hoặc bằng chứng đã thay đổi. Đóng biểu mẫu, kiểm tra điều kiện mới rồi mở lại.');
      const body = prepareBody(plan.key, { outcome, note, ...(plan.kind === 'operation' ? { commandId: plan.commandId, operationKey: plan.operationKey, transportSessionId: plan.transportSessionId, evidence: evidenceType, confirmedStopped: confirmed } : {}) });
      const signature = JSON.stringify(body);
      if (requestIdentity.current?.signature !== signature) requestIdentity.current = { signature, key: crypto.randomUUID() };
      await callBackend(plan.key, { path: plan.path, body, idempotencyKey: requestIdentity.current.key });
      onSaved();
    } catch (cause) { setError(cause.message || 'Không thực hiện được đối soát.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <dialog ref={ref} className="be-dialog be-workspace lo-recovery-dialog" aria-label="Xác minh phục hồi" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <header className="be-heading"><div><h2>Xác minh phục hồi</h2><p>{detail.job.jobCode} · Chỉ kết thúc công việc sau khi kiểm tra thực tế.</p></div><button disabled={busy} type="button" aria-label="Đóng biểu mẫu" onClick={onClose}>Đóng</button></header>
    <form onSubmit={submit}><fieldset disabled={busy} className="be-form-body lo-recovery-form">
      <p>Máy chủ sẽ kiểm tra lại trạng thái công việc và bằng chứng. Thao tác này không chạy lại robot.</p>
      {plan.kind === 'operation' && <><p><strong>Bước đối soát: {plan.stepCode}</strong></p><details><summary>Mã lệnh được lấy từ máy chủ</summary><dl className="lo-readable-facts"><div><dt>Lệnh</dt><dd>{plan.commandId}</dd></div><div><dt>Mã thao tác</dt><dd>{plan.operationKey}</dd></div><div><dt>Phiên kết nối</dt><dd>{plan.transportSessionId}</dd></div></dl></details><label>Bằng chứng<select aria-label="Bằng chứng phục hồi" value={evidenceType} onChange={event => setEvidenceType(event.target.value)} required><option value="">Chọn bằng chứng đã kiểm tra</option>{plan.evidenceTypes.map(type => <option key={type} value={type}>{evidenceLabels[type]}</option>)}</select></label></>}
      <label>Kết quả xử lý<select aria-label="Kết quả xử lý" value={outcome} onChange={event => setOutcome(event.target.value)} required><option value="">Chọn kết quả kết thúc</option><option value="RESUME_AS_FAILED">Kết thúc với trạng thái thất bại</option><option value="CONFIRM_CANCELLED">Xác nhận đã hủy</option></select></label>
      <label>Ghi chú kiểm tra<textarea aria-label="Ghi chú kiểm tra" value={note} maxLength={2000} required onChange={event => setNote(event.target.value)} /></label>
      <label className="lo-recovery-ack"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{evidenceType === 'COMMAND_NOT_ACCEPTED' ? 'Tôi đã kiểm tra bằng chứng lệnh bị từ chối trước khi robot tiếp nhận và robot không thực hiện lệnh này' : 'Tôi đã kiểm tra thực tế robot và xác nhận đủ điều kiện kết thúc công việc'}</label>
    </fieldset>{error && <p role="alert" className="be-error">{error}</p>}<footer className="be-form-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Đang kiểm tra và gửi…' : 'Xác nhận đối soát'}</button></footer></form>
  </dialog>;
}
