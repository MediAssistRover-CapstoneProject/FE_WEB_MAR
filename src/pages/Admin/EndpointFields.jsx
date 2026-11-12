import { ENDPOINT_CATEGORIES } from '../../features/facility/facilityContract.js';
import './endpointMapEditor.css';
import './endpointFields.css';

function Field({ label, children, ...props }) {
  return <label className="ls-field"><span>{label}</span>{children || <input aria-label={label} {...props} />}</label>;
}

// The Map and room editors share the same fields. Only the room association is
// fixed when editing a destination from a particular room.
export default function EndpointFields({ endpoint, setEndpoint, mapId = endpoint.mapId, zones, rooms, fixedRoom }) {
  const selected = !!endpoint.endpointId;
  const placed = endpoint.xM !== '' && endpoint.yM !== '';
  const degrees = endpoint.yawRad === '' ? '' : Number((Number(endpoint.yawRad) * 180 / Math.PI).toFixed(4));
  const set = (key, value) => setEndpoint(current => ({ ...current, [key]: value }));
  const setAngle = value => set('yawRad', value === '' ? '' : Number(value) * Math.PI / 180);
  const availableZones = zones.filter(zone => zone.mapId === mapId && (zone.active || zone.zoneId === endpoint.zoneId));
  return <div className="ep-fields">
    <div className="ep-step"><b>1</b><strong>Thông tin điểm</strong></div>
    <Field label="Mã điểm" required maxLength={64} placeholder="VD: PHONG_101" value={endpoint.endpointCode} onChange={event => set('endpointCode', event.target.value)} />
    <Field label="Tên điểm" required maxLength={160} placeholder="VD: Trước cửa phòng 101" value={endpoint.endpointName} onChange={event => set('endpointName', event.target.value)} />
    <div className="ep-step"><b>2</b><strong>Vị trí và hướng đến</strong></div>
    <div className={`ep-position${placed ? ' ready' : ''}`}><span>{placed ? '● Đã chọn vị trí' : '○ Chưa chọn vị trí'}</span><small>{placed ? selected ? 'Kéo điểm để đổi vị trí; bấm “Đặt lại vị trí / hướng” để đặt cả hướng.' : 'Kéo trực tiếp điểm cam để đổi vị trí trước khi lưu.' : 'Bấm “Đặt điểm trên map”, hoặc nhập X/Y.'}</small></div>
    <div className="ep-coordinate-fields">{[['xM', 'X (m)'], ['yM', 'Y (m)']].map(([key, label]) => <Field key={key} label={label} required type="number" step="any" value={endpoint[key]} onChange={event => set(key, event.target.value)} />)}</div>
    <div className="ep-heading-editor"><div className="ep-compass" aria-hidden="true"><span className="north">90°</span><span className="east">0°</span><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="#dce5f0" strokeDasharray="3 4" /><path d="M50 12V88M12 50H88" stroke="#e2e8f0" /><g transform={`translate(50 50) rotate(${-Number(degrees || 0)})`}><circle r="7" fill="#f59e0b" /><path d="M5 0H29M22 -7L30 0L22 7" fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g></svg></div><Field label="Hướng đến (độ)" type="number" min={-180} max={180} step="any" required value={degrees} onChange={event => setAngle(event.target.value)} /></div>
    <input className="ep-angle-slider" aria-label="Xoay hướng đến" type="range" min="-180" max="180" step="1" value={degrees || 0} onChange={event => setAngle(event.target.value)} />
    <div className="ep-angle-presets">{[-180, -90, 0, 90, 180].map(angle => <button type="button" key={angle} className={`ls-btn ep-shared-button${Number(degrees) === angle ? ' active' : ''}`} onClick={() => setAngle(angle)}>{angle}°</button>)}</div>
    <p className="ls-hint">Khi lưu, máy chủ kiểm tra tâm điểm nằm trên ô trống. Bộ điều hướng vẫn kiểm tra kích thước robot và đường đi. Hướng này cũng dùng làm gợi ý định vị; hướng dừng cuối phụ thuộc chế độ điều hướng trên Pi.</p>
    <details className="ep-options"><summary>Cài đặt điểm và liên kết</summary>
      <Field label="Chức năng điểm"><select aria-label="Chức năng điểm" value={endpoint.endpointType} onChange={event => set('endpointType', event.target.value)}>{Object.entries(ENDPOINT_CATEGORIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></Field>
      <Field label="Vùng liên kết"><select aria-label="Vùng liên kết" value={endpoint.zoneId || ''} onChange={event => set('zoneId', event.target.value)}><option value="">Không liên kết</option>{availableZones.map(zone => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}{!zone.active ? ' · Ngừng hoạt động' : ''}</option>)}</select></Field>
      <Field label="Phòng liên kết"><select aria-label="Phòng liên kết" value={fixedRoom?.roomId || endpoint.roomId || ''} disabled={!!fixedRoom} onChange={event => set('roomId', event.target.value)}>{fixedRoom ? <option value={fixedRoom.roomId}>{fixedRoom.roomName}</option> : <><option value="">Không liên kết</option>{rooms.map(room => <option key={room.roomId} value={room.roomId}>{room.roomName}</option>)}</>}</select></Field>
      <Field label="Mô tả" value={endpoint.description || ''} onChange={event => set('description', event.target.value)} />
      {[...(!selected ? [['active', 'Điểm hoạt động']] : []), ['accessible', 'Có thể tiếp cận'], ['publicVisible', 'Hiển thị công khai']].map(([key, label]) => <label className="ep-check" key={key}><input type="checkbox" checked={!!endpoint[key]} onChange={event => set(key, event.target.checked)} />{label}</label>)}
    </details>
  </div>;
}

export function EndpointLifecycle({ point, locked, busy, hasUnsavedChanges, onToggleActive }) {
  return <section className="ep-lifecycle" aria-label="Trạng thái điểm đích">
    <div className="ep-lifecycle-heading"><strong>Trạng thái sử dụng</strong><span className={`ep-state ${point.active ? 'active' : 'inactive'}`} role="status">{point.active ? 'Đang hoạt động' : 'Ngừng sử dụng'}</span></div>
    <p>{point.active ? 'Ngừng sử dụng để loại điểm khỏi danh sách điều phối mới. Thao tác này không hủy nhiệm vụ đang chạy.' : 'Điểm vẫn được lưu trên bản đồ để tra cứu. Kích hoạt lại khi cần sử dụng cho điều phối.'}</p>
    <button type="button" className={`ls-btn ep-shared-button ${point.active ? 'danger' : 'primary'}`} disabled={locked || hasUnsavedChanges || !onToggleActive} onClick={onToggleActive}>{busy ? 'Đang cập nhật…' : point.active ? 'Ngừng sử dụng điểm' : 'Kích hoạt lại điểm'}</button>
    {hasUnsavedChanges && <small role="status">Lưu hoặc bỏ thay đổi trước khi đổi trạng thái điểm.</small>}
  </section>;
}
