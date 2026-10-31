import FacilityGeometryPreview from './FacilityGeometryPreview.jsx';
import { ENDPOINT_CATEGORIES } from '../../features/facility/facilityContract.js';
import './endpointMapEditor.css';

function Field({ label, children, ...props }) {
  return <label className="ls-field"><span>{label}</span>{children || <input aria-label={label} {...props}/>}</label>;
}

export default function EndpointMapEditor({ map, zones, rooms, endpoints, endpoint, setEndpoint, drawing, setDrawing, busy, onSave }) {
  const locked = busy || map.status === 'ARCHIVED';
  const selected = endpoints.find(p => p.endpointId === endpoint.endpointId);
  const placed = endpoint.xM !== '' && endpoint.yM !== '';
  const degrees = endpoint.yawRad === '' ? '' : Number((Number(endpoint.yawRad) * 180 / Math.PI).toFixed(4));
  const set = (key, value) => setEndpoint(e => ({ ...e, [key]: value }));
  const setAngle = value => set('yawRad', value === '' ? '' : Number(value) * Math.PI / 180);
  const reset = () => { setEndpoint(selected ? { ...selected } : { endpointCode:'', endpointName:'', endpointType:'WAYPOINT', xM:'', yM:'', yawRad:0, zoneId:'', roomId:'', active:true, accessible:true, publicVisible:false, description:'' }); setDrawing(false); };
  const create = () => { setEndpoint({ endpointCode:'', endpointName:'', endpointType:'WAYPOINT', xM:'', yM:'', yawRad:0, zoneId:'', roomId:'', active:true, accessible:true, publicVisible:false, description:'' }); setDrawing(true); };
  return <div className="ep-editor" data-map-id={map.mapId}>
    <section className="ls-panel ep-map-panel">
      <div className="ep-panel-heading"><div><h3>{map.mapName}</h3><p>v{map.versionNo} · {map.widthM} × {map.heightM} m · {Number(map.resolutionMPerPixel)*100} cm/ô</p></div><span className={'ep-mode '+(drawing?'placing':'')}>{drawing?'Đang đặt điểm':'Xem bản đồ'}</span></div>
      <div className="ep-map-actions"><button type="button" className={'ls-btn '+(drawing?'primary':'')} disabled={locked} onClick={()=>setDrawing(d=>!d)}>{drawing?'Hủy đặt điểm':selected?'Đặt lại vị trí / hướng':'Đặt điểm trên map'}</button><span>{drawing?'Giữ chuột trên sàn → kéo theo hướng đến → thả':'Bản đồ cố định · Bấm điểm đã lưu để chỉnh sửa'}</span></div>
      <FacilityGeometryPreview map={map} zones={zones} endpoints={endpoints} endpointEdit={endpoint} drawing={drawing&&!locked} allowDraftMove={!locked} onEndpoint={p=>{setEndpoint({...p});setDrawing(false);}} onPoint={p=>setEndpoint(e=>({...e,...p}))} onPlacementEnd={()=>setDrawing(false)}/>
      <div className="ep-legend"><span><i className="saved"/>Điểm đã lưu</span><span><i className="draft"/>Điểm đang chỉnh</span><span>→ Hướng robot khi đến điểm</span><span>{endpoints.length} điểm trên map</span></div>
    </section>
    <aside className="ls-panel ep-properties">
      <div className="ep-panel-heading"><div><h3>{selected?'Chỉnh điểm đích':'Tạo điểm đích'}</h3><p>{selected?endpoint.endpointCode:'Chọn vị trí trên map để bắt đầu'}</p></div><button type="button" className="ls-btn" disabled={locked} onClick={create}>+ Điểm mới</button></div>
      <Field label="Điểm đã lưu"><select aria-label="Điểm đã lưu" disabled={locked} value={endpoint.endpointId||''} onChange={e=>{const p=endpoints.find(p=>p.endpointId===e.target.value);if(p){setEndpoint({...p});setDrawing(false);}else create();}}><option value="">Điểm mới</option>{endpoints.map(p=><option key={p.endpointId} value={p.endpointId}>{p.endpointCode} — {p.endpointName}{!p.active||!p.accessible?' · Chưa khả dụng':''}</option>)}</select></Field>
      <form onSubmit={e=>{e.preventDefault();onSave();}}>
        <fieldset disabled={locked}>
          <div className="ep-step"><b>1</b><strong>Thông tin điểm</strong></div>
          <Field label="Mã điểm" required maxLength={64} placeholder="VD: PHONG_101" value={endpoint.endpointCode} onChange={e=>set('endpointCode',e.target.value)}/>
          <Field label="Tên điểm" required maxLength={160} placeholder="VD: Trước cửa phòng 101" value={endpoint.endpointName} onChange={e=>set('endpointName',e.target.value)}/>
          <div className="ep-step"><b>2</b><strong>Vị trí và hướng đến</strong></div>
          <div className={'ep-position '+(placed?'ready':'')}><span>{placed?'● Đã chọn vị trí':'○ Chưa chọn vị trí'}</span><small>{placed?selected?'Bấm “Đặt lại vị trí / hướng” hoặc nhập tọa độ.':'Kéo trực tiếp điểm cam để đổi vị trí trước khi lưu.':'Bấm “Đặt điểm trên map”, hoặc nhập X/Y.'}</small></div>
          <div className="ep-coordinate-fields">{[['xM','X (m)'],['yM','Y (m)']].map(([key,label])=><Field key={key} label={label} required type="number" step="any" value={endpoint[key]} onChange={e=>set(key,e.target.value)}/>)}</div>
          <div className="ep-heading-editor"><div className="ep-compass" aria-hidden="true"><span className="north">90°</span><span className="east">0°</span><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="#dce5f0" strokeDasharray="3 4"/><path d="M50 12V88M12 50H88" stroke="#e2e8f0"/><g transform={`translate(50 50) rotate(${-Number(degrees||0)})`}><circle r="7" fill="#f59e0b"/><path d="M5 0H29M22 -7L30 0L22 7" fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></g></svg></div><Field label="Hướng đến (độ)" type="number" min={-180} max={180} step="any" required value={degrees} onChange={e=>setAngle(e.target.value)}/></div>
          <input className="ep-angle-slider" aria-label="Xoay hướng đến" type="range" min="-180" max="180" step="1" value={degrees||0} onChange={e=>setAngle(e.target.value)}/>
          <div className="ep-angle-presets">{[-180,-90,0,90,180].map(angle=><button type="button" key={angle} className={'ls-btn '+(Number(degrees)===angle?'active':'')} onClick={()=>setAngle(angle)}>{angle}°</button>)}</div>
          <details className="ep-options"><summary>Cài đặt điểm và liên kết</summary>
            <Field label="Chức năng điểm"><select aria-label="Chức năng điểm" value={endpoint.endpointType} onChange={e=>set('endpointType',e.target.value)}>{Object.entries(ENDPOINT_CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
            <Field label="Vùng liên kết"><select aria-label="Vùng liên kết" value={endpoint.zoneId||''} onChange={e=>set('zoneId',e.target.value)}><option value="">Không liên kết</option>{zones.map(z=><option key={z.zoneId} value={z.zoneId}>{z.zoneName}</option>)}</select></Field>
            <Field label="Phòng liên kết"><select aria-label="Phòng liên kết" value={endpoint.roomId||''} onChange={e=>set('roomId',e.target.value)}><option value="">Không liên kết</option>{rooms.map(r=><option key={r.roomId} value={r.roomId}>{r.roomName}</option>)}</select></Field>
            <Field label="Mô tả" value={endpoint.description||''} onChange={e=>set('description',e.target.value)}/>
            {[['active','Điểm hoạt động'],['accessible','Có thể tiếp cận'],['publicVisible','Hiển thị công khai']].map(([key,label])=><label className="ep-check" key={key}><input type="checkbox" checked={!!endpoint[key]} onChange={e=>set(key,e.target.checked)}/>{label}</label>)}
          </details>
          <div className="ep-save-bar"><button type="submit" className="ls-btn primary">{busy?'Đang lưu…':selected?'Lưu thay đổi':'Lưu điểm đích'}</button><button type="button" className="ls-btn" onClick={reset}>Bỏ thay đổi</button></div>
        </fieldset>
      </form>
    </aside>
  </div>;
}
