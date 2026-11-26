import { useRef, useState } from 'react';
import { patrolApi } from '../../../features/patrol/patrolApi.js';
import { endpointAvailable, patrolDraftErrors, SENSING_OPTIONS } from '../../../features/patrol/patrolModel.js';
import { Button, Icon, Modal } from './PatrolUi.jsx';
import PatrolMapPreview from './PatrolMapPreview.jsx';

const newPoint = () => ({ key: crypto.randomUUID(), endpointId: '', sensingType: '', zoneId: '' });
const numberValue = value => value === '' ? '' : Number(value);

export default function PublishPatrolRoute({ catalog, onClose, onCreated }) {
  const [draft, setDraft] = useState(() => ({
    name: '', mapId: catalog.maps.find(map => map.status === 'ACTIVE')?.mapId || '',
    checkpoints: [newPoint()], repeatCount: 3, maxSpeedMps: .25, moveTimeoutSec: 60, sensingWindowSec: 12,
  }));
  const [errors, setErrors] = useState([]), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const frozen = busy || uncertain;
  const endpoints = catalog.endpoints.filter(point => endpointAvailable(point, draft.mapId));
  const zones = catalog.zones.filter(zone => zone.mapId === draft.mapId && zone.active);
  const map = catalog.maps.find(item => item.mapId === draft.mapId);
  const points = draft.checkpoints.map(point => endpoints.find(item => item.endpointId === point.endpointId)).filter(Boolean);
  const minWindow = draft.checkpoints.some(point => point.sensingType === 'PATROL_FALL') ? 3 : 1;

  function change(patch) {
    setDraft(previous => ({ ...previous, ...patch }));
    setErrors([]);
  }
  function changePoint(key, patch) {
    change({ checkpoints: draft.checkpoints.map(point => point.key === key ? { ...point, ...patch } : point) });
  }
  function movePoint(index, offset) {
    const checkpoints = [...draft.checkpoints];
    [checkpoints[index], checkpoints[index + offset]] = [checkpoints[index + offset], checkpoints[index]];
    change({ checkpoints });
  }
  function chooseEndpoint(endpoint) {
    if (frozen) return;
    const empty = draft.checkpoints.find(point => !point.endpointId);
    if (empty) changePoint(empty.key, { endpointId: endpoint.endpointId });
    else if (draft.checkpoints.length < 5) change({ checkpoints: [...draft.checkpoints, { ...newPoint(), endpointId: endpoint.endpointId }] });
  }

  async function submit(event) {
    event.preventDefault();
    if (lock.current || frozen) return;
    const validation = patrolDraftErrors(draft, catalog);
    if (validation.length) { setErrors(validation); return; }
    lock.current = true; setBusy(true); setErrors([]);
    try {
      const result = await patrolApi.createWorkflow({
        ...draft, name: draft.name.trim(),
        checkpoints: draft.checkpoints.map(({ endpointId, sensingType, zoneId }) => ({
          endpointId, sensingType, zoneId: sensingType === 'PATROL_FALL' ? null : zoneId,
        })),
      });
      if (!result?.workflowId) throw new Error('Máy chủ chưa trả mã tuyến.');
      onCreated(result.workflowId);
    } catch (error) {
      const unknown = !error.status || error.status >= 500;
      setUncertain(unknown);
      setErrors([error.message + (unknown ? ' Đóng hộp thoại để kiểm tra danh sách tuyến đã phát hành trước khi gửi lại.' : '')]);
    } finally { lock.current = false; setBusy(false); }
  }

  return <Modal title="Tạo tuyến tuần tra" subtitle="Chọn bản đồ, thứ tự ghé và hoạt động tại mỗi điểm." onClose={onClose} busy={busy} wide>
    <form onSubmit={submit} className="pt-create-form">
      <div className="pt-form-body">
        <div className="pt-form-grid">
          <label className="pt-field">Tên tuyến
            <input autoFocus required maxLength={160} value={draft.name} onChange={event => change({ name: event.target.value })} disabled={frozen}/>
          </label>
          <label className="pt-field">Bản đồ
            <select required value={draft.mapId} disabled={frozen} onChange={event => change({ mapId: event.target.value, checkpoints: [newPoint()] })}>
              <option value="">Chọn bản đồ đang hoạt động</option>
              {catalog.maps.filter(item => item.status === 'ACTIVE').map(item => <option key={item.mapId} value={item.mapId}>{item.mapName}</option>)}
            </select>
          </label>
        </div>
        <div className="pt-create-map">
          <PatrolMapPreview map={map} points={points} zones={zones} availableEndpoints={endpoints} onEndpoint={frozen ? undefined : chooseEndpoint}/>
          <p className="pt-muted">Chọn điểm trên bản đồ hoặc trong danh sách bên dưới.</p>
        </div>
        <div className="pt-section-label"><h4>Thứ tự các điểm</h4><span>{draft.checkpoints.length}/5 điểm</span></div>
        <ol className="pt-draft-points">{draft.checkpoints.map((point, index) => <li key={point.key}>
          <span className="pt-point-number">{index + 1}</span>
          <div className="pt-point-fields">
            <label className="pt-field">Điểm đến {index + 1}
              <select required disabled={frozen} value={point.endpointId} onChange={event => changePoint(point.key, { endpointId: event.target.value })}>
                <option value="">Chọn điểm đến</option>
                {endpoints.map(item => <option key={item.endpointId} value={item.endpointId}>{item.endpointName || item.endpointCode}</option>)}
              </select>
            </label>
            <label className="pt-field">Hoạt động tại điểm {index + 1}
              <select required disabled={frozen} value={point.sensingType} onChange={event => changePoint(point.key, { sensingType: event.target.value, zoneId: '' })}>
                <option value="">Chọn hoạt động kiểm tra</option>
                {SENSING_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            {point.sensingType && point.sensingType !== 'PATROL_FALL' && <label className="pt-field pt-field-full">Vùng kiểm tra {index + 1}
              <select required disabled={frozen} value={point.zoneId} onChange={event => changePoint(point.key, { zoneId: event.target.value })}>
                <option value="">Chọn vùng đã cấu hình</option>
                {zones.filter(zone => point.sensingType !== 'RESTRICTED_ZONE' || zone.zoneType === 'KEEP_OUT')
                  .map(zone => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}</option>)}
              </select>
            </label>}
          </div>
          <div className="pt-point-tools">
            <button type="button" aria-label={`Đưa điểm ${index + 1} lên`} disabled={frozen || index === 0} onClick={() => movePoint(index, -1)}>↑</button>
            <button type="button" aria-label={`Đưa điểm ${index + 1} xuống`} disabled={frozen || index + 1 === draft.checkpoints.length} onClick={() => movePoint(index, 1)}>↓</button>
            <button type="button" aria-label={`Xóa điểm ${index + 1}`} disabled={frozen || draft.checkpoints.length === 1}
              onClick={() => change({ checkpoints: draft.checkpoints.filter(item => item.key !== point.key) })}><Icon name="close"/></button>
          </div>
        </li>)}</ol>
        <Button icon="plus" disabled={frozen || draft.checkpoints.length >= 5 || !endpoints.length}
          onClick={() => change({ checkpoints: [...draft.checkpoints, newPoint()] })}>Thêm điểm đến</Button>
        {!endpoints.length && <p className="pt-notice">Bản đồ này chưa có điểm đến khả dụng. Bạn có thể thêm điểm trong Bản đồ &amp; điều hướng.</p>}
        <div className="pt-form-grid pt-form-grid-three">
          <label className="pt-field">Chế độ lặp
            <select value={draft.repeatCount === 0 ? 'continuous' : 'finite'} disabled={frozen} onChange={event => change({ repeatCount: event.target.value === 'continuous' ? 0 : 3 })}>
              <option value="finite">Theo số vòng</option><option value="continuous">Liên tục đến khi dừng</option>
            </select>
          </label>
          {draft.repeatCount !== 0 && <label className="pt-field">Số vòng
            <input type="number" min="1" max="1000" required disabled={frozen} value={draft.repeatCount} onChange={event => change({ repeatCount: numberValue(event.target.value) })}/>
          </label>}
          <label className="pt-field">Vận tốc tối đa (m/s)
            <input type="number" min="0.05" max="0.60" step="0.01" required disabled={frozen} value={draft.maxSpeedMps} onChange={event => change({ maxSpeedMps: numberValue(event.target.value) })}/>
          </label>
          <label className="pt-field">Thời gian quan sát (giây)
            <input type="number" min={minWindow} max="30" required disabled={frozen} value={draft.sensingWindowSec} onChange={event => change({ sensingWindowSec: numberValue(event.target.value) })}/>
          </label>
        </div>
        {errors.length > 0 && <div className="pt-alert" role="alert"><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
      </div>
      <footer className="pt-dialog-footer">
        <Button disabled={busy} onClick={onClose}>{uncertain ? 'Đóng và tải lại danh sách' : 'Để sau'}</Button>
        <Button type="submit" tone="primary" disabled={frozen}>{busy ? 'Đang phát hành…' : 'Tạo & phát hành tuyến'}</Button>
      </footer>
    </form>
  </Modal>;
}
