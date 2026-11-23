import { useRef, useState } from 'react';
import { patrolApi } from '../../../features/patrol/patrolApi.js';
import { patrolDraftErrors, SENSING_OPTIONS } from '../../../features/patrol/patrolModel.js';
import { Button, Icon, Modal } from './PatrolUi.jsx';
import PatrolMapPreview from './PatrolMapPreview.jsx';

const newPoint = () => ({ key: crypto.randomUUID(), endpointId: '', sensingType: '', zoneId: '' });
export default function CreatePatrolRoute({ catalog, onClose, onCreated }) {
  const [draft, setDraft] = useState({ name: '', mapId: catalog.maps.find(map => map.status === 'ACTIVE')?.mapId || '', checkpoints: [newPoint()], repeatCount: 3, maxSpeedMps: .25, moveTimeoutSec: 60, sensingWindowSec: 12 });
  const [errors, setErrors] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const change = patch => { setDraft(previous => ({ ...previous, ...patch })); setErrors([]); };
  const changePoint = (key, patch) => change({ checkpoints: draft.checkpoints.map(point => point.key === key ? { ...point, ...patch } : point) });
  const movePoint = (index, direction) => { const points = [...draft.checkpoints]; [points[index], points[index + direction]] = [points[index + direction], points[index]]; change({ checkpoints: points }); };
  const endpoints = catalog.endpoints.filter(point => point.mapId === draft.mapId && point.active === true && point.accessible === true && Number.isFinite(point.yawRad));
  const zones = catalog.zones.filter(zone => zone.mapId === draft.mapId && zone.active === true);
  const map = catalog.maps.find(item => item.mapId === draft.mapId);
  const chooseEndpoint = endpoint => {
    if (busy || uncertain || draft.checkpoints.some(point => point.endpointId === endpoint.endpointId)) return;
    const empty = draft.checkpoints.find(point => !point.endpointId);
    if (empty) changePoint(empty.key, { endpointId: endpoint.endpointId });
    else if (draft.checkpoints.length < 5) change({ checkpoints: [...draft.checkpoints, { ...newPoint(), endpointId: endpoint.endpointId }] });
  };
  const submit = async event => {
    event.preventDefault();
    if (lock.current || uncertain) return;
    const validation = patrolDraftErrors(draft, catalog);
    if (validation.length) { setErrors(validation); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const body = { ...draft, name: draft.name.trim(), checkpoints: draft.checkpoints.map(({ endpointId, sensingType, zoneId }) => ({ endpointId, sensingType, zoneId: sensingType === 'PATROL_FALL' ? null : zoneId })) };
      const result = await patrolApi.createWorkflow(body);
      if (!result?.workflowId) throw new Error('Chưa nhận được mã tuyến. Hãy tải lại danh sách để kiểm tra trước khi tạo lại.');
      onCreated(result.workflowId);
    } catch (cause) {
      const unknown = !cause.status || cause.status >= 500;
      setUncertain(unknown);
      setError(cause.message + (unknown ? ' Yêu cầu có thể đã được xử lý. Đóng hộp thoại để tải lại danh sách trước khi tạo tuyến khác.' : ''));
    } finally { lock.current = false; setBusy(false); }
  };
  return <Modal title="Tạo tuyến tuần tra" subtitle="Chọn bản đồ, sắp xếp các điểm và hoạt động tại mỗi điểm." onClose={onClose} busy={busy} wide>
    <form onSubmit={submit} className="pt-create-form">
      <div className="pt-form-body"><div className="pt-form-grid"><label className="pt-field">Tên tuyến<input autoFocus required maxLength={160} placeholder="Ví dụ: Tuần tra hành lang tầng 1" value={draft.name} onChange={event => change({ name: event.target.value })} disabled={busy}/></label><label className="pt-field">Bản đồ<select required value={draft.mapId} onChange={event => change({ mapId: event.target.value, checkpoints: [newPoint()] })} disabled={busy}><option value="">Chọn bản đồ đang hoạt động</option>{catalog.maps.filter(map => map.status === 'ACTIVE').map(map => <option key={map.mapId} value={map.mapId}>{map.mapName} · v{map.versionNo}</option>)}</select></label></div>
      <div className="pt-create-map"><PatrolMapPreview map={map} points={draft.checkpoints.map(point => endpoints.find(item => item.endpointId === point.endpointId)).filter(Boolean)} zones={zones} availableEndpoints={endpoints} onEndpoint={busy || uncertain ? undefined : chooseEndpoint}/><p className="pt-muted">Chọn điểm trên bản đồ hoặc từ danh sách bên dưới. Robot ghé theo thứ tự bạn sắp xếp.</p></div>
      <div className="pt-section-label"><h4>Thứ tự các điểm</h4><span>{draft.checkpoints.length}/5 điểm</span></div><p className="pt-muted">Robot ghé lần lượt các điểm. Khi lặp, robot quay từ điểm cuối về điểm đầu.</p>
      <ol className="pt-draft-points">{draft.checkpoints.map((point, index) => <li key={point.key}><span className="pt-point-number">{index + 1}</span><div className="pt-point-fields"><label className="pt-field">Điểm đến {index + 1}<select required value={point.endpointId} disabled={busy} onChange={event => changePoint(point.key, { endpointId: event.target.value })}><option value="">Chọn điểm đến</option>{endpoints.map(endpoint => <option key={endpoint.endpointId} value={endpoint.endpointId}>{endpoint.endpointName || endpoint.endpointCode}</option>)}</select></label><label className="pt-field">Hoạt động tại điểm {index + 1}<select required value={point.sensingType} disabled={busy} onChange={event => changePoint(point.key, { sensingType: event.target.value, zoneId: '' })}><option value="">Chọn hoạt động kiểm tra</option>{SENSING_OPTIONS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>{point.sensingType && point.sensingType !== 'PATROL_FALL' && <label className="pt-field pt-field-full">Vùng kiểm tra {index + 1}<select required value={point.zoneId} disabled={busy} onChange={event => changePoint(point.key, { zoneId: event.target.value })}><option value="">Chọn vùng đã cấu hình</option>{zones.filter(zone => point.sensingType !== 'RESTRICTED_ZONE' || zone.zoneType === 'KEEP_OUT').map(zone => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}</option>)}</select></label>}{point.sensingType === 'PATROL_FALL' && <p className="pt-muted pt-field-full">Phát hiện té ngã cần robot hỗ trợ tính năng này. Hệ thống sẽ kiểm tra trước khi giao nhiệm vụ.</p>}</div><div className="pt-point-tools"><button type="button" aria-label={`Đưa điểm ${index + 1} lên`} disabled={busy || index === 0} onClick={() => movePoint(index, -1)}>↑</button><button type="button" aria-label={`Đưa điểm ${index + 1} xuống`} disabled={busy || index === draft.checkpoints.length - 1} onClick={() => movePoint(index, 1)}>↓</button><button type="button" aria-label={`Xóa điểm ${index + 1}`} disabled={busy || draft.checkpoints.length === 1} onClick={() => change({ checkpoints: draft.checkpoints.filter(item => item.key !== point.key) })}><Icon name="close"/></button></div></li>)}</ol>
      <Button icon="plus" disabled={busy || draft.checkpoints.length >= 5 || !endpoints.length} onClick={() => change({ checkpoints: [...draft.checkpoints, newPoint()] })}>Thêm điểm đến</Button>{!endpoints.length && <p className="pt-notice">Bản đồ này chưa có điểm đến đang hoạt động và cho phép di chuyển. Hãy thiết lập điểm trong Bản đồ & điều hướng.</p>}
      <div className="pt-section-label"><h4>Cách thực hiện</h4></div><div className="pt-form-grid pt-form-grid-three"><label className="pt-field">Chế độ lặp<select value={draft.repeatCount === 0 ? 'continuous' : 'finite'} disabled={busy} onChange={event => change({ repeatCount: event.target.value === 'continuous' ? 0 : 3 })}><option value="finite">Theo số vòng</option><option value="continuous">Liên tục đến khi dừng</option></select></label>{draft.repeatCount !== 0 && <label className="pt-field">Số vòng<input type="number" min="1" max="1000" required value={draft.repeatCount} disabled={busy} onChange={event => change({ repeatCount: event.target.value === '' ? '' : Number(event.target.value) })}/></label>}<label className="pt-field">Vận tốc tối đa (m/s)<input type="number" min="0.05" max="0.6" step="0.05" required value={draft.maxSpeedMps} disabled={busy} onChange={event => change({ maxSpeedMps: event.target.value === '' ? '' : Number(event.target.value) })}/></label><label className="pt-field">Thời gian kiểm tra (giây)<input type="number" min="3" max="30" required value={draft.sensingWindowSec} disabled={busy} onChange={event => change({ sensingWindowSec: event.target.value === '' ? '' : Number(event.target.value) })}/></label></div>
      {errors.length > 0 && <div className="pt-alert" role="alert"><strong>Kiểm tra lại cấu hình tuyến</strong><ul>{errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}{error && <p className="pt-alert" role="alert">{error}</p>}</div>
      <footer className="pt-dialog-footer"><p>Tuyến được kiểm tra và phát hành sau khi tạo.</p><Button disabled={busy} onClick={onClose}>{uncertain ? 'Đóng & tải danh sách' : 'Để sau'}</Button><button className="pt-btn pt-btn-primary" type="submit" disabled={busy || uncertain}>{busy ? 'Đang kiểm tra…' : 'Tạo & phát hành tuyến'}</button></footer>
    </form>
  </Modal>;
}
