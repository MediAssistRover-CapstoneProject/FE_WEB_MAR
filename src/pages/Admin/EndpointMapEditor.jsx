import FacilityGeometryPreview from './FacilityGeometryPreview.jsx';
import EndpointFields, { EndpointLifecycle } from './EndpointFields.jsx';
import './endpointMapEditor.css';

function Field({ label, children, ...props }) {
  return <label className="ls-field"><span>{label}</span>{children || <input aria-label={label} {...props}/>}</label>;
}

export default function EndpointMapEditor({ map, zones, rooms, endpoints, endpoint, setEndpoint, drawing, setDrawing, busy, onSave, hasUnsavedChanges=false, onToggleActive }) {
  const locked = busy || map.status === 'ARCHIVED';
  const selected = endpoints.find(p => p.endpointId === endpoint.endpointId);
  const reset = () => { setEndpoint(selected ? { ...selected } : { endpointCode:'', endpointName:'', endpointType:'WAYPOINT', xM:'', yM:'', yawRad:0, zoneId:'', roomId:'', active:true, accessible:true, publicVisible:false, description:'' }); setDrawing(false); };
  const create = () => { setEndpoint({ endpointCode:'', endpointName:'', endpointType:'WAYPOINT', xM:'', yM:'', yawRad:0, zoneId:'', roomId:'', active:true, accessible:true, publicVisible:false, description:'' }); setDrawing(true); };
  return <div className="ep-editor" data-map-id={map.mapId}>
    <section className="ls-panel ep-map-panel">
      <div className="ep-panel-heading"><div><h3>{map.mapName}</h3><p>v{map.versionNo} · {map.widthM} × {map.heightM} m · {Number(map.resolutionMPerPixel)*100} cm/ô</p></div><span className={'ep-mode '+(drawing?'placing':'')}>{drawing?'Đang đặt điểm':'Xem bản đồ'}</span></div>
      <div className="ep-map-actions"><button type="button" className={'ls-btn '+(drawing?'primary':'')} disabled={locked} onClick={()=>setDrawing(d=>!d)}>{drawing?'Hủy đặt điểm':selected?'Đặt lại vị trí / hướng':'Đặt điểm trên map'}</button><span>{drawing?'Giữ chuột trên sàn → kéo theo hướng đến → thả':'Bản đồ cố định · Kéo điểm để đổi vị trí, sau đó lưu thay đổi'}</span></div>
      <FacilityGeometryPreview map={map} zones={zones} endpoints={endpoints} endpointEdit={endpoint} showInactiveEndpoints drawing={drawing&&!locked} allowDraftMove={!locked} onEndpoint={p=>{if(busy)return;setEndpoint({...p});setDrawing(false);}} onPoint={p=>setEndpoint(e=>({...e,...p}))} onPlacementEnd={()=>setDrawing(false)}/>
      <div className="ep-legend"><span><i className="saved"/>Điểm đang hoạt động</span><span><i className="inactive"/>Điểm ngừng sử dụng</span><span><i className="draft"/>Điểm đang chỉnh</span><span>→ Hướng tham chiếu của điểm</span><span>{endpoints.length} điểm trên map</span></div>
    </section>
    <aside className="ls-panel ep-properties">
      <div className="ep-panel-heading"><div><h3>{selected?'Chỉnh điểm đích':'Tạo điểm đích'}</h3><p>{selected?endpoint.endpointCode:'Chọn vị trí trên map để bắt đầu'}</p></div><button type="button" className="ls-btn" disabled={locked} onClick={create}>+ Điểm mới</button></div>
      <Field label="Điểm đã lưu"><select aria-label="Điểm đã lưu" disabled={locked} value={endpoint.endpointId||''} onChange={e=>{const p=endpoints.find(p=>p.endpointId===e.target.value);if(p){setEndpoint({...p});setDrawing(false);}else create();}}><option value="">Điểm mới</option>{endpoints.map(p=><option key={p.endpointId} value={p.endpointId}>{p.endpointCode} — {p.endpointName}{!p.active?' · Ngừng sử dụng':!p.accessible?' · Không thể tiếp cận':''}</option>)}</select></Field>
      {selected&&<EndpointLifecycle point={selected} locked={locked} busy={busy} hasUnsavedChanges={hasUnsavedChanges} onToggleActive={onToggleActive}/>}
      <form onSubmit={e=>{e.preventDefault();onSave();}}>
        <fieldset disabled={locked}>
          <EndpointFields endpoint={endpoint} setEndpoint={setEndpoint} mapId={map.mapId} zones={zones} rooms={rooms}/>
          <div className="ep-save-bar"><button type="submit" className="ls-btn primary">{busy?'Đang lưu…':selected?'Lưu thay đổi':'Lưu điểm đích'}</button><button type="button" className="ls-btn" onClick={reset}>Bỏ thay đổi</button></div>
        </fieldset>
      </form>
    </aside>
  </div>;
}
