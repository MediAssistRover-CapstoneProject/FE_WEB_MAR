import { useEffect, useRef, useState } from 'react';
import { createPatrolJob, patrolApi, patrolDispatchApi } from '../../../features/patrol/patrolApi.js';
import { availablePatrolGroups, endpointAvailable, patrolCheckpointLabel, patrolGroupMembers, patrolTemplateReadiness, patrolTemplateErrors, patrolTemplateInputs } from '../../../features/patrol/patrolModel.js';
import { resumeDispatch } from '../../../features/workflows/dispatchModel.js';
import { Button, Modal } from './PatrolUi.jsx';
import PatrolMapPreview from './PatrolMapPreview.jsx';

const newPoint = () => ({ key: crypto.randomUUID(), targetType: 'endpoint', endpointId: '', endpointGroupId: '' });
const localTime = () => { const date = new Date(Date.now() + 3600000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
function readAttempt(key) {
  try { const value = JSON.parse(sessionStorage.getItem(key)); return value?.draft && value.workflowId && value.body && value.key ? value : null; } catch { return null; }
}

export default function CreatePatrolRoute({ catalog, fixedRoute, templateId, initialRobotId = '', onClose, onCreated, initialCount = 3, storageKey = 'mediassist.patrol.template-run.v1' }) {
  const [attempt, setAttempt] = useState(() => readAttempt(storageKey));
  const [draft, setDraft] = useState(() => readAttempt(storageKey)?.draft || {
    mapId: fixedRoute?.mapId || catalog.maps.find(map => map.status === 'ACTIVE')?.mapId || '',
    robotId: initialRobotId, checkpointCount: initialCount, checkpoints: Array.from({ length: initialCount }, newPoint),
    repeatCount: 1, maxSpeedMps: .25, timing: fixedRoute ? 'ONCE' : 'NOW', startsAt: localTime(),
    intervalSec: 3600, cronExpression: '0 0 8 * * *', timezone: 'Asia/Ho_Chi_Minh', activateAfterSave: false,
  });
  const [errors, setErrors] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [snapshot, setSnapshot] = useState(null), [snapshotError, setSnapshotError] = useState(''), [now, setNow] = useState(Date.now());
  const lock = useRef(false), pending = useRef(attempt);
  const save = value => { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); pending.current = value; setAttempt(value); };
  const frozen = busy || !!attempt;
  const change = patch => { setDraft(previous => ({ ...previous, ...patch })); setErrors([]); setError(''); };
  const changePoint = (key, patch) => change({ checkpoints: draft.checkpoints.map(point => point.key === key ? { ...point, ...patch } : point) });
  const endpoints = catalog.endpoints.filter(point => endpointAvailable(point, draft.mapId));
  const groups = availablePatrolGroups(catalog, draft.mapId);
  const map = catalog.maps.find(item => item.mapId === draft.mapId);
  const robot = catalog.robots.find(item => item.robotId === draft.robotId);
  const configurationErrors = fixedRoute ? fixedRoute.issues : patrolTemplateErrors(draft, catalog);
  const readiness = patrolTemplateReadiness(robot, snapshot, draft.mapId, now);
  const immediate = draft.timing === 'NOW';
  const reasons = [...readiness.reasons, ...(snapshotError ? [snapshotError] : [])];
  useEffect(() => {
    setSnapshot(null); setSnapshotError('');
    if (!draft.robotId || draft.timing !== 'NOW') return undefined;
    const controller = new AbortController(); let timer;
    const load = async () => {
      try { const value = await patrolApi.getRobotSnapshot(draft.robotId, { signal: controller.signal }); if (!controller.signal.aborted) { setSnapshot(value); setSnapshotError(''); setNow(Date.now()); } }
      catch (cause) { if (!controller.signal.aborted) setSnapshotError(cause.message); }
      finally { if (!controller.signal.aborted) timer = setTimeout(load, 8000); }
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [draft.robotId, draft.timing]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const chooseEndpoint = endpoint => {
    if (frozen) return;
    const point = draft.checkpoints.find(item => !item.endpointId && !item.endpointGroupId);
    if (point) changePoint(point.key, { targetType: 'endpoint', endpointId: endpoint.endpointId, endpointGroupId: '' });
  };
  const movePoint = (index, direction) => { const points = [...draft.checkpoints]; [points[index], points[index + direction]] = [points[index + direction], points[index]]; change({ checkpoints: points }); };
  const submit = async event => {
    event.preventDefault();
    if (lock.current) return;
    let current = pending.current;
    if (!current) {
      const validation = [...configurationErrors];
      if (!robot) validation.push('Chọn robot thực hiện tuần tra.');
      if (immediate) validation.push(...reasons);
      else {
        if (!Number.isFinite(Date.parse(draft.startsAt)) || Date.parse(draft.startsAt) <= Date.now()) validation.push('Chọn thời điểm bắt đầu trong tương lai.');
        if (draft.timing === 'INTERVAL' && (!Number.isInteger(Number(draft.intervalSec)) || Number(draft.intervalSec) < 60)) validation.push('Khoảng lặp lịch phải từ 60 giây trở lên.');
        if (draft.timing === 'CRON' && (draft.cronExpression.trim().split(/\s+/).length !== 6 || draft.cronExpression.length > 120)) validation.push('Nhập biểu thức cron 6 trường: giây phút giờ ngày tháng thứ.');
        try { new Intl.DateTimeFormat('vi', { timeZone: draft.timezone }).format(); } catch { validation.push('Múi giờ IANA chưa hợp lệ.'); }
      }
      if (validation.length) { setErrors([...new Set(validation)]); return; }
    }
    lock.current = true; setBusy(true); setError('');
    try {
      if (!current) {
        let workflowId = fixedRoute?.workflow.workflowId || (draft.checkpointCount === initialCount ? templateId : null);
        if (!workflowId) {
          const template = await patrolApi.prepareTemplate(draft.checkpointCount);
          if (!template?.workflowId || template.checkpointCount !== draft.checkpointCount || template.available !== true) throw new Error('Máy chủ chưa trả mẫu tuần tra hợp lệ.');
          workflowId = template.workflowId;
        }
        const key = `PATROL_${crypto.randomUUID()}`;
        const inputs = fixedRoute ? {} : patrolTemplateInputs(draft);
        const workflowName = fixedRoute?.workflow.workflowName || `Tuần tra ${draft.checkpointCount} điểm`;
        const body = immediate
          ? { robotId: draft.robotId, mapId: draft.mapId, navigationSessionId: snapshot.navigationSession.sessionId, inputs, priority: 5 }
          : {
            workflowId, robotId: draft.robotId, scheduleCode: key, scheduleName: `${workflowName} · ${map.mapName}`.slice(0, 160),
            scheduleType: draft.timing, startsAt: new Date(draft.startsAt).toISOString(), timezone: draft.timezone,
            ...(draft.timing === 'INTERVAL' ? { intervalSec: Number(draft.intervalSec) } : {}),
            ...(draft.timing === 'CRON' ? { cronExpression: draft.cronExpression.trim() } : {}),
            inputTemplateJson: inputs, priority: 5, misfirePolicy: 'FIRE_ONCE',
          };
        current = { key, code: key, workflowId, workflowName, kind: immediate ? 'job' : 'schedule', draft: structuredClone(draft), body };
        save(current);
      }
      if (current.kind === 'job') {
        const previous = await patrolApi.findJob(current.workflowId, current.key);
        const result = previous ?? await createPatrolJob(current, save);
        if (!result?.jobId) throw new Error('Chưa nhận được mã nhiệm vụ. Kiểm tra lại cùng lượt gửi.');
        save(null); onCreated({ workflowId: current.workflowId, jobId: result.jobId, message: 'Đã tạo nhiệm vụ tuần tra. Theo dõi hàng đợi để biết khi robot bắt đầu.' });
      } else {
        // Attempts saved by the previous version requested immediate activation.
        const result = await resumeDispatch(current, patrolDispatchApi, save, {
          activate: current.draft.activateAfterSave ?? true, onInvalidCreate: () => save(null),
        });
        const messages = { PAUSED: 'Đã lưu lịch ở trạng thái tạm dừng. Chọn “Kích hoạt lịch” khi muốn bắt đầu.', ACTIVE: 'Lịch tuần tra đã được kích hoạt.', RETIRED: 'Lịch tuần tra đã kết thúc.' };
        save(null); onCreated({ workflowId: current.workflowId, scheduleId: result.scheduleId, message: messages[result.status] });
      }
    } catch (cause) {
      const scheduleId = pending.current?.scheduleId;
      if (current?.kind === 'schedule' && scheduleId && [400, 422].includes(cause.status)) {
        const saved = await patrolApi.getSchedule(scheduleId).catch(() => null);
        if (saved?.scheduleId === scheduleId && saved.status === 'PAUSED') {
          save(null);
          onCreated({ workflowId: current.workflowId, scheduleId, message: `Đã lưu lịch. Máy chủ chưa kích hoạt được lịch. ${cause.message}` });
          return;
        }
      }
      setError(`${cause.message}${pending.current ? ' Dùng “Kiểm tra lượt gửi” để tiếp tục với cùng yêu cầu.' : ''}`);
    }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal title={fixedRoute ? 'Lập lịch tuyến tuần tra' : 'Tạo lượt tuần tra'} subtitle={fixedRoute ? fixedRoute.workflow.workflowName : 'Chọn mẫu 3–11 điểm, cấu hình điểm ghé và giao robot hoặc lập lịch.'} onClose={onClose} busy={busy} wide={!fixedRoute}>
    <form onSubmit={submit} className="pt-create-form"><div className="pt-form-body">
      <div className="pt-form-grid pt-form-grid-three">
        <label className="pt-field">Bản đồ<select required value={draft.mapId} onChange={event => change({ mapId: event.target.value, checkpoints: Array.from({ length: draft.checkpointCount }, newPoint) })} disabled={frozen || !!fixedRoute}><option value="">Chọn bản đồ</option>{catalog.maps.filter(item => item.status === 'ACTIVE').map(item => <option key={item.mapId} value={item.mapId}>{item.mapName}</option>)}</select></label>
        <label className="pt-field">Robot tuần tra<select required value={draft.robotId} onChange={event => change({ robotId: event.target.value })} disabled={frozen}><option value="">Chọn robot</option>{catalog.robots.map(item => <option key={item.robotId} value={item.robotId}>{item.robotName || item.robotCode} · {item.status}</option>)}</select></label>
        {!fixedRoute && <label className="pt-field">Mẫu tuần tra<select value={draft.checkpointCount} disabled={frozen} onChange={event => { const count = Number(event.target.value); change({ checkpointCount: count, checkpoints: Array.from({ length: count }, (_, index) => draft.checkpoints[index] || newPoint()) }); }}>{Array.from({ length: 9 }, (_, index) => index + 3).map(count => <option key={count} value={count}>Tuần tra {count} điểm</option>)}</select></label>}
      </div>
      {!fixedRoute && <><div className="pt-create-map"><PatrolMapPreview map={map} points={draft.checkpoints.map(point => endpoints.find(item => item.endpointId === point.endpointId) || (point.endpointGroupId ? patrolGroupMembers(groups.find(group => group.endpointGroupId === point.endpointGroupId), catalog)[0]?.endpoint : null)).filter(Boolean)} zones={catalog.zones} availableEndpoints={endpoints} onEndpoint={frozen ? undefined : chooseEndpoint}/><p className="pt-muted">Chọn trên bản đồ để điền điểm trống tiếp theo. Với nhóm, đường xem trước đi qua điểm chính; robot thử điểm dự phòng khi cần.</p></div>
      <div className="pt-section-label"><h4>Thứ tự ghé điểm</h4><span>{draft.checkpointCount} điểm mỗi vòng</span></div>
      <ol className="pt-draft-points">{draft.checkpoints.map((point, index) => <li key={point.key}><span className="pt-point-number">{index + 1}</span><div className="pt-point-fields">
        <label className="pt-field">Loại điểm {index + 1}<select disabled={frozen} value={point.targetType} onChange={event => changePoint(point.key, { targetType: event.target.value, endpointId: '', endpointGroupId: '' })}><option value="endpoint">Điểm đến</option><option value="group">Nhóm điểm trong phòng</option></select></label>
        {point.targetType === 'group' ? <label className="pt-field">Nhóm điểm {index + 1}<select required disabled={frozen} value={point.endpointGroupId} onChange={event => changePoint(point.key, { endpointGroupId: event.target.value, endpointId: '' })}><option value="">Chọn nhóm chính → dự phòng</option>{groups.map(group => <option key={group.endpointGroupId} value={group.endpointGroupId}>{patrolCheckpointLabel({ group }, catalog)}</option>)}</select></label> : <label className="pt-field">Điểm đến {index + 1}<select required disabled={frozen} value={point.endpointId} onChange={event => changePoint(point.key, { endpointId: event.target.value, endpointGroupId: '' })}><option value="">Chọn điểm đến</option>{endpoints.map(endpoint => <option key={endpoint.endpointId} value={endpoint.endpointId}>{endpoint.endpointName || endpoint.endpointCode}</option>)}</select></label>}
        {point.targetType === 'group' && !groups.length && <p className="pt-muted pt-field-full">Chưa có nhóm hợp lệ trên bản đồ. Tạo nhóm trong phòng gồm điểm chính và dự phòng tại Bản đồ & điều hướng.</p>}
      </div><div className="pt-point-tools"><button type="button" aria-label={`Đưa điểm ${index + 1} lên`} disabled={frozen || index === 0} onClick={() => movePoint(index, -1)}>↑</button><button type="button" aria-label={`Đưa điểm ${index + 1} xuống`} disabled={frozen || index === draft.checkpoints.length - 1} onClick={() => movePoint(index, 1)}>↓</button></div></li>)}</ol>
      <p className="pt-notice">Mỗi điểm quan sát phát hiện ngã trong 3 giây. Giám sát ngã và khu vực hạn chế liên tục vẫn do robot thực hiện độc lập.</p>
      <div className="pt-form-grid pt-form-grid-three"><label className="pt-field">Chế độ lặp<select value={draft.repeatCount === 0 ? 'continuous' : 'finite'} disabled={frozen} onChange={event => change({ repeatCount: event.target.value === 'continuous' ? 0 : 1 })}><option value="finite">Theo số vòng</option><option value="continuous">Liên tục đến khi dừng</option></select></label>{draft.repeatCount !== 0 && <label className="pt-field">Số vòng<input type="number" min="1" max="1000" required value={draft.repeatCount} disabled={frozen} onChange={event => change({ repeatCount: event.target.value })}/></label>}<label className="pt-field">Vận tốc tối đa (m/s)<input type="number" min="0.05" max="0.35" step="0.01" required value={draft.maxSpeedMps} disabled={frozen} onChange={event => change({ maxSpeedMps: event.target.value })}/></label></div>
      </>}
      <div className="pt-form-grid"><label className="pt-field">Thời điểm thực hiện<select value={draft.timing} disabled={frozen} onChange={event => change({ timing: event.target.value })}>{!fixedRoute && <option value="NOW">Chạy ngay</option>}<option value="ONCE">Lịch một lần</option><option value="INTERVAL">Lịch theo khoảng thời gian</option><option value="CRON">Lịch cron</option></select></label>{!immediate && <label className="pt-field">Bắt đầu (giờ trên máy)<input type="datetime-local" required value={draft.startsAt} disabled={frozen} onChange={event => change({ startsAt: event.target.value })}/></label>}{draft.timing === 'INTERVAL' && <label className="pt-field">Khoảng lặp (giây)<input type="number" min="60" required value={draft.intervalSec} disabled={frozen} onChange={event => change({ intervalSec: event.target.value })}/></label>}{draft.timing === 'CRON' && <label className="pt-field">Cron (6 trường)<input required maxLength={120} value={draft.cronExpression} disabled={frozen} onChange={event => change({ cronExpression: event.target.value })}/></label>}{!immediate && <label className="pt-field">Múi giờ của lịch<input required maxLength={64} value={draft.timezone} disabled={frozen} onChange={event => change({ timezone: event.target.value })}/></label>}</div>
      {immediate && draft.robotId && !attempt && <div className={`pt-readiness ${!reasons.length ? 'is-ready' : ''}`} role="status"><div><strong>{reasons.length ? 'Điều kiện chạy ngay' : 'Robot sẵn sàng nhận lượt'}</strong>{reasons.length ? <ul>{[...new Set(reasons)].map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Máy chủ kiểm tra lại trước khi giao nhiệm vụ.</p>}</div></div>}
      {!immediate && <label className="pt-activation-choice"><input type="checkbox" checked={draft.activateAfterSave ?? true} disabled={frozen} onChange={event => change({ activateAfterSave: event.target.checked })}/> Kích hoạt lịch ngay sau khi lưu</label>}
      {!immediate && <p className="pt-muted">Có thể lập lịch khi robot chưa kết nối hoặc chưa định vị. Đến thời điểm chạy, máy chủ kiểm tra điều kiện thực tế. Lịch giữ bản đồ và thứ tự điểm đã chọn; mỗi nhiệm vụ lưu cấu hình thực thi riêng.</p>}
      {errors.length > 0 && <div className="pt-alert" role="alert"><ul>{errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}{error && <p className="pt-alert" role="alert">{error}</p>}{attempt && <p className="pt-notice">Đang giữ lượt gửi {attempt.key}. Cấu hình được khóa để kiểm tra lại đúng yêu cầu này.</p>}
    </div><footer className="pt-dialog-footer"><Button disabled={busy} onClick={onClose}>Đóng</Button><Button type="submit" tone="primary" icon={immediate ? 'play' : 'clock'} disabled={busy}>{busy ? 'Đang gửi…' : attempt ? 'Kiểm tra lượt gửi' : immediate ? 'Tạo nhiệm vụ tuần tra' : draft.activateAfterSave ? 'Tạo & kích hoạt lịch' : 'Lưu lịch tạm dừng'}</Button></footer></form>
  </Modal>;
}
