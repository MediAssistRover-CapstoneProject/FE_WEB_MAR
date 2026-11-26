import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { patrolApi } from '../../../features/patrol/patrolApi.js';
import { endpointAvailable, patrolDraftErrors, SENSING_OPTIONS } from '../../../features/patrol/patrolModel.js';
import { Button, Icon, Modal } from './PatrolUi.jsx';
import PatrolMapPreview from './PatrolMapPreview.jsx';

const newPoint = () => ({ key: crypto.randomUUID(), endpointId: '', sensingType: '', zoneId: '' });
const numberValue = value => value === '' ? '' : Number(value);

export default function PublishPatrolRoute({ catalog, onClose, onCreated }) {
  const [type, setType] = useState('fixed');
  const slots = catalog.templates;
  const [count, setCount] = useState(slots[0]?.checkpointCount || 3);
  const slot = slots.find(item => item.checkpointCount === count);
  const existing = slot?.available && catalog.published.find(workflow => workflow.workflowId === slot.workflowId);
  const maps = catalog.maps.filter(map => map.status === 'ACTIVE');
  const [draft, setDraft] = useState(() => ({
    name: '', mapId: maps[0]?.mapId || '',
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
    if (type === 'template' && existing) {
      onCreated({ workflowId: existing.workflowId, message: 'Đã chọn mẫu tuần tra đã phát hành.' });
      return;
    }
    const validation = type === 'fixed' ? patrolDraftErrors(draft, catalog) : [];
    if (validation.length) { setErrors(validation); return; }
    lock.current = true; setBusy(true); setErrors([]);
    try {
      if (type === 'template') {
        const result = await patrolApi.prepareTemplate(count);
        if (!result?.workflowId || result.checkpointCount !== count || result.available !== true) throw new Error('Máy chủ chưa xác nhận mẫu đã phát hành.');
        onCreated({ workflowId: result.workflowId, message: `Đã lưu mẫu tuần tra ${count} điểm.` });
        return;
      }
      const result = await patrolApi.createWorkflow({
        ...draft, name: draft.name.trim(),
        checkpoints: draft.checkpoints.map(({ endpointId, sensingType, zoneId }) => ({
          endpointId, sensingType, zoneId: sensingType === 'PATROL_FALL' ? null : zoneId,
        })),
      });
      if (!result?.workflowId) throw new Error('Máy chủ chưa trả mã tuyến.');
      onCreated({ workflowId: result.workflowId, message: 'Đã lưu và phát hành tuyến tuần tra.' });
    } catch (error) {
      const unknown = !error.status || error.status >= 500;
      setUncertain(unknown);
      setErrors([error.message + (unknown ? ' Đóng hộp thoại để kiểm tra danh sách tuyến đã phát hành trước khi gửi lại.' : '')]);
    } finally { lock.current = false; setBusy(false); }
  }

  const publishLabel = type === 'fixed' ? 'Tạo & phát hành tuyến' : existing ? 'Mở tuyến đã có' : 'Tạo & phát hành mẫu';
  return <Modal title="Tạo tuyến tuần tra" onClose={onClose} busy={busy} wide={type === 'fixed'}>
    <form onSubmit={submit} className="pt-create-form">
      <div className="pt-form-body">
        {slots.length > 0 && <fieldset className="pt-route-kind" disabled={frozen}><legend>Loại tuyến</legend>
          <label><input type="radio" name="route-kind" checked={type === 'fixed'} onChange={() => { setType('fixed'); setErrors([]); }}/> Tuyến cố định</label>
          <label><input type="radio" name="route-kind" checked={type === 'template'} onChange={() => { setType('template'); setErrors([]); }}/> Mẫu theo số điểm</label>
        </fieldset>}
        {catalog.templateError && <p className="pt-notice" role="status">{catalog.templateError}</p>}
        {type === 'template' ? <>
          <label className="pt-field">Số điểm mỗi vòng<select value={count} disabled={frozen} onChange={event => { setCount(Number(event.target.value)); setErrors([]); }}>
            {slots.map(slot => <option key={slot.checkpointCount} value={slot.checkpointCount}>{slot.checkpointCount} điểm</option>)}
          </select></label>
          <p className="pt-muted">{existing ? `Đã có “${existing.workflowName}”. Bạn có thể mở lại mẫu này.` : 'Mẫu lưu số điểm mỗi vòng. Bản đồ, điểm đến và robot được chọn khi chạy hoặc lập lịch.'}</p>
        </> : !maps.length ? <p className="pt-notice">Cần một bản đồ đang hoạt động để tạo tuyến cố định. <Link to="/admin/map">Mở trang Bản đồ</Link></p> : <>
          <div className="pt-form-grid">
            <label className="pt-field">Tên tuyến
              <input autoFocus required maxLength={160} value={draft.name} onChange={event => change({ name: event.target.value })} disabled={frozen}/>
            </label>
            <label className="pt-field">Bản đồ
              <select required value={draft.mapId} disabled={frozen} onChange={event => change({ mapId: event.target.value, checkpoints: [newPoint()] })}>
                <option value="">Chọn bản đồ đang hoạt động</option>
                {maps.map(item => <option key={item.mapId} value={item.mapId}>{item.mapName}</option>)}
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
          {!endpoints.length && <p className="pt-notice">Bản đồ này chưa có điểm đến khả dụng. <Link to="/admin/map">Mở trang Bản đồ để thêm điểm.</Link></p>}
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
        </>}
        {errors.length > 0 && <div className="pt-alert" role="alert"><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
      </div>
      <footer className="pt-dialog-footer">
        <Button disabled={busy} onClick={onClose}>{uncertain ? 'Đóng và tải lại danh sách' : 'Để sau'}</Button>
        <Button type="submit" tone="primary" disabled={frozen || (type === 'fixed' && !endpoints.length)}>{busy ? 'Đang phát hành…' : publishLabel}</Button>
      </footer>
    </form>
  </Modal>;
}
