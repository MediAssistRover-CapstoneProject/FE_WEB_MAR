import { useRef, useState } from 'react';
import { patrolApi } from '../../../features/patrol/patrolApi.js';
import { HOLD_LABELS, OPEN_PATROL_STATUSES, jobStatus, jobStopPending, patrolHoldSummary, patrolJobCheckpoints } from '../../../features/patrol/patrolModel.js';
import { Button, Empty, Icon, Modal } from './PatrolUi.jsx';
import BrandMark from '../../../components/BrandMark.jsx';

const phaseLabels = {
  MOVE: 'Di chuyển đến điểm',
  EXECUTE_SENSING: 'Quan sát tại điểm',
  WAIT: 'Đang chờ',
  SPEAK: 'Đang giao tiếp',
  ASK_CONFIRM: 'Đang chờ phản hồi',
};

const blockedLabels = {
  NOT_A_PATROL_JOB: 'Nhiệm vụ chưa hỗ trợ tiếp tục tuần tra.',
  NOT_SUSPENDED: 'Nhiệm vụ chưa ở trạng thái tạm dừng.',
  RESUME_DISABLED: 'Chưa được phép tự tiếp tục. Kiểm tra yêu cầu tạm dừng hoặc kết thúc.',
  ACTIVE_SUSPENSION_HOLDS: 'Đang chờ các công việc ưu tiên được giải quyết.',
  ROBOT_NOT_ASSIGNED: 'Nhiệm vụ chưa được giao robot.',
  ROBOT_NOT_IDLE: 'Robot chưa trở về trạng thái nghỉ.',
  VOICE_INTERACTION_ACTIVE: 'Robot đang giao tiếp với bệnh nhân.',
  MEDIA_ASSIST_ACTIVE: 'Robot đang thực hiện cuộc gọi hỗ trợ.',
  INCIDENT_ACTIVE: 'Robot đang xử lý một sự cố hoặc SOS.',
  FOREGROUND_JOB_PENDING: 'Robot còn nhiệm vụ khác chưa kết thúc.',
  HIGHER_PRIORITY_JOB_PENDING: 'Đang chờ nhiệm vụ có mức ưu tiên cao hơn.',
  UNRESOLVED_PI_OPERATION: 'Đang chờ xác nhận thao tác hiện tại của robot.',
  MQTT_ROBOT_NOT_READY: 'Kết nối robot chưa sẵn sàng để tiếp tục.',
  PATROL_MAP_CHANGED: 'Bản đồ đã thay đổi. Cần kiểm tra trước khi tiếp tục.',
  LOCALIZATION_NOT_READY: 'Robot chưa xác nhận định vị trên bản đồ.',
  NAVIGATION_PROFILE_NOT_READY: 'Cấu hình di chuyển chưa sẵn sàng.',
};

function controlState(detail) {
  const job = detail?.job;
  const holds = patrolHoldSummary(detail?.patrol);
  const cancelling = jobStopPending(job);
  const controlRequested = cancelling || Boolean(job?.cancelRequestedAt);
  return {
    suspend: !controlRequested && ['QUEUED', 'ACCEPTED', 'RUNNING'].includes(job?.status),
    resume: !controlRequested && job?.status === 'SUSPENDED' && (holds.manual || !holds.external),
    cancel: !controlRequested && OPEN_PATROL_STATUSES.has(job?.status),
    cancelling,
  };
}

const shortId = id => String(id ?? '').slice(0, 8);
function timeLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa có';
}

export default function PatrolJobMonitor({ detail, catalog = {}, writable = false, onAction }) {
  const job = detail?.job;
  if (!job) return <Empty title="Chọn một lượt tuần tra" icon="robot">Chọn nhiệm vụ để xem robot, tiến độ và lý do tạm dừng.</Empty>;
  const patrol = detail.patrol;
  const robot = catalog.robots?.find(item => item.robotId === job.robotId);
  const point = catalog.endpoints?.find(item => item.endpointId === patrol?.targetEndpointId);
  const status = jobStatus(job);
  const holds = patrolHoldSummary(patrol);
  const controls = controlState(detail);
  const checkpoints = patrolJobCheckpoints(detail, catalog);
  const activeCheckpoint = checkpoints.find(checkpoint => checkpoint.current);
  const endpointLabel = point?.endpointName || point?.endpointCode || (patrol?.targetEndpointId ? `Điểm ${shortId(patrol.targetEndpointId)}` : 'Chưa có dữ liệu');
  const roundLabel = patrol ? patrol.continuous ? `Vòng ${patrol.round} · Liên tục` : `Vòng ${patrol.round} / ${patrol.repeatCount}` : 'Chưa có dữ liệu';
  const phase = controls.cancelling ? 'Chờ dừng an toàn' : !OPEN_PATROL_STATUSES.has(job.status) ? 'Lượt đã kết thúc' : job.status === 'SUSPENDING' ? 'Chờ xác nhận dừng' : job.status === 'SUSPENDED' ? holds.external ? 'Chờ việc ưu tiên kết thúc' : 'Đang tạm dừng' : phaseLabels[patrol?.phase] || (patrol?.phase ? 'Đang thực hiện bước tuần tra' : job.status === 'QUEUED' ? 'Đang chờ robot nhận' : 'Chưa có bước thực thi');
  return <section className="pt-monitor" aria-label="Chi tiết lượt tuần tra">
    <div className="pt-monitor-head">
      <div className="pt-monitor-identity"><span className="pt-monitor-robot"><BrandMark /></span><div><strong>{robot?.robotName || robot?.robotCode || (job.robotId ? `Robot ${shortId(job.robotId)}` : 'Chưa giao robot')}</strong><span className="pt-job-code">{job.jobCode || shortId(job.jobId)}</span></div></div>
      <span className={`pt-badge pt-badge-${status.tone}`}>{status.label}</span>
    </div>
    <dl className="pt-monitor-grid">
      <div className="pt-monitor-cell"><dt>Vòng tuần tra</dt><dd>{roundLabel}</dd></div>
      <div className="pt-monitor-cell"><dt>Điểm đang xử lý</dt><dd>{activeCheckpoint ? `Điểm ${activeCheckpoint.index} · ${activeCheckpoint.label}` : endpointLabel}</dd></div>
      <div className="pt-monitor-cell"><dt>Hoạt động</dt><dd title={patrol?.phase || undefined}>{phase}</dd></div>
      <div className="pt-monitor-cell"><dt>Bắt đầu</dt><dd>{timeLabel(job.startedAt)}</dd></div>
    </dl>
    {!!checkpoints.length && <div className="pt-job-checkpoints"><h4>Điểm ghé của nhiệm vụ</h4><ol>{checkpoints.map(checkpoint => <li key={checkpoint.index} className={checkpoint.current ? 'is-current' : ''}><div><strong>Điểm {checkpoint.index} · {checkpoint.label}</strong><span>{checkpoint.phase}{checkpoint.concreteEndpointId && checkpoint.endpoint_group_id ? ` → ${catalog.endpoints?.find(endpoint => endpoint.endpointId === checkpoint.concreteEndpointId)?.endpointName || 'Điểm đã chọn'}` : ''}</span></div>{checkpoint.technical.length > 0 && <details><summary>Chi tiết kỹ thuật ({checkpoint.technical.length} lượt bước)</summary><ol>{checkpoint.technical.map(step => <li key={step.jobStepId || step.executionSequenceNo}><code>{step.stepCodeSnapshot}</code> · {step.stepTypeSnapshot} · {step.status}{step.errorCode ? ` · ${step.errorCode}` : ''}</li>)}</ol></details>}</li>)}</ol></div>}
    {patrol?.holds?.length > 0 && <div className="pt-monitor-holds"><span className="pt-eyebrow">Lý do tạm dừng</span><div className="pt-hold-list">{patrol.holds.map((hold, index) => <span className="pt-hold-chip" key={`${hold.source}-${hold.sourceId || index}`}><Icon name={hold.source === 'MANUAL' ? 'pause' : 'shield'}/>{HOLD_LABELS[hold.source] || 'Công việc ưu tiên khác'}</span>)}</div></div>}
    {job.status === 'SUSPENDING' && <p className="pt-monitor-note"><Icon name="info"/>Đã yêu cầu tạm dừng. Đang chờ robot xác nhận dừng an toàn.</p>}
    {job.status === 'SUSPENDED' && <div className="pt-monitor-note"><Icon name="info"/><div>{holds.external && <p>Robot đang nhường công việc ưu tiên. Tuần tra tự tiếp tục khi các công việc này kết thúc và robot đủ điều kiện.</p>}{holds.manual && <p>Cần bỏ tạm dừng thủ công bằng nút Tiếp tục.</p>}{patrol?.resumeBlockedReason && <p title={patrol.resumeBlockedReason}>{blockedLabels[patrol.resumeBlockedReason] || 'Robot chưa đủ điều kiện tiếp tục. Hãy kiểm tra trạng thái vận hành.'}</p>}{!holds.manual && !holds.external && <p>{patrol?.resumeRequested ? 'Đã yêu cầu tiếp tục. Máy chủ đang kiểm tra điều kiện của robot.' : 'Có thể yêu cầu tiếp tục lượt tuần tra hiện tại.'}</p>}</div></div>}
    {controls.cancelling && <p className="pt-monitor-note"><Icon name="info"/>{job.stopStatus === 'RECOVERY_REQUIRED' ? 'Chưa xác nhận robot đã dừng. Kiểm tra robot tại trang vận hành trước khi giao lượt mới.' : 'Đã gửi yêu cầu kết thúc. Đang chờ xác nhận an toàn từ robot.'}</p>}
    {job.status === 'RECOVERY_REQUIRED' && <p className="pt-alert pt-alert-error" role="status">Robot cần được kiểm tra tại trang vận hành trước khi tiếp tục nhiệm vụ.</p>}
    {(job.failureReason || job.errorCode) && <p className="pt-alert pt-alert-error" role="status">{job.failureReason || job.errorCode}</p>}
    {!patrol && <p className="pt-monitor-note"><Icon name="info"/>Máy chủ chưa cung cấp trạng thái vòng và tạm dừng cho nhiệm vụ này.</p>}
    <div className="pt-monitor-actions">
      <span className="pt-monitor-meta">{job.endedAt ? `Kết thúc ${timeLabel(job.endedAt)}` : `Tạo ${timeLabel(job.queuedAt)}`}</span>
      {writable && onAction && <div className="pt-action-group">
        {patrol && controls.suspend && <Button icon="pause" onClick={() => onAction('suspend')}>Tạm dừng</Button>}
        {patrol && controls.resume && <Button icon="play" tone="primary" onClick={() => onAction('resume')}>Tiếp tục</Button>}
        {controls.cancel && <Button icon="stop" tone="danger" onClick={() => onAction('cancel')}>Kết thúc lượt</Button>}
      </div>}
    </div>
  </section>;
}

const actionText = {
  suspend: { title: 'Tạm dừng tuần tra', button: 'Yêu cầu tạm dừng', icon: 'pause', description: 'Robot dừng an toàn và giữ tiến độ của lượt hiện tại. Bạn có thể yêu cầu tiếp tục sau.', message: 'Đã gửi yêu cầu tạm dừng. Đang cập nhật trạng thái robot.' },
  resume: { title: 'Tiếp tục tuần tra', button: 'Yêu cầu tiếp tục', icon: 'play', description: 'Bỏ tạm dừng thủ công cho lượt hiện tại. Robot chỉ tiếp tục khi các công việc ưu tiên đã kết thúc và đủ điều kiện vận hành.', message: 'Đã yêu cầu tiếp tục. Máy chủ sẽ kiểm tra các công việc ưu tiên và trạng thái robot.' },
  cancel: { title: 'Kết thúc lượt tuần tra?', button: 'Kết thúc lượt', icon: 'stop', description: 'Lượt tuần tra hiện tại sẽ kết thúc và không tự tiếp tục. Nếu robot đang hoạt động, hệ thống chờ xác nhận dừng an toàn. Muốn tuần tra lại, bạn cần bắt đầu một lượt mới.', message: 'Đã gửi yêu cầu kết thúc. Đang chờ máy chủ xác nhận trạng thái an toàn.' },
};

export function JobAction({ kind, detail, canAct = true, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const copy = actionText[kind];
  if (!copy || !detail?.job) return null;
  const allowed = canAct && controlState(detail)[kind] && (kind === 'cancel' || Boolean(detail.patrol));
  const submit = async event => {
    event.preventDefault();
    if (locked.current || uncertain || !allowed) return;
    const explanation = reason.trim();
    if (!explanation || explanation.length > 1000) { setError('Nhập lý do từ 1 đến 1000 ký tự.'); return; }
    locked.current = true;
    setBusy(true);
    setError('');
    let saved = false;
    try {
      const method = { suspend: patrolApi.suspendJob, resume: patrolApi.resumeJob, cancel: patrolApi.cancelJob }[kind];
      await method(detail.job.jobId, explanation);
      saved = true;
    } catch (failure) {
      setError(failure?.message || 'Chưa xác nhận được kết quả thao tác.');
      setUncertain(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
    if (saved) onSaved(copy.message);
  };
  return <Modal title={copy.title} subtitle={detail.job.jobCode || shortId(detail.job.jobId)} onClose={onClose} busy={busy}>
    <form onSubmit={submit}>
      <div className="pt-form-body"><p className="pt-job-action-copy">{copy.description}</p>
      <label className="pt-field"><span>Lý do <span aria-hidden="true">*</span></span><textarea aria-label="Lý do" autoFocus value={reason} onChange={event => setReason(event.target.value)} disabled={busy || uncertain} maxLength={1000} required rows={3} placeholder="Ghi lý do thao tác để tiện theo dõi"/></label>
      {!allowed && !uncertain && <p className="pt-alert" role="status">Trạng thái nhiệm vụ đã thay đổi. Hãy tải lại trước khi thao tác.</p>}
      {error && <div className="pt-alert pt-alert-error" role="alert"><p>{error}</p>{uncertain && <p>Yêu cầu có thể đã được máy chủ xử lý. Tải lại trạng thái trước khi thao tác tiếp.</p>}</div>}</div>
      <div className="pt-dialog-footer"><Button disabled={busy} onClick={onClose}>Đóng</Button>{uncertain || !allowed ? <Button icon="refresh" tone="primary" onClick={() => onSaved('Đang tải lại trạng thái nhiệm vụ.')} disabled={busy}>Tải lại trạng thái</Button> : <Button type="submit" tone={kind === 'cancel' ? 'danger' : 'primary'} icon={copy.icon} disabled={busy || !reason.trim()}>{busy ? 'Đang gửi yêu cầu…' : copy.button}</Button>}</div>
    </form>
  </Modal>;
}
