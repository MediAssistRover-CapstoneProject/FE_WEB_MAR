import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { facilityApi, allFacilityPages } from '../../features/facility/facilityApi.js';
import { apiRequest } from '../../features/api/client.js';
import { dispatchMaps, dispatchEndpoints } from '../../features/facility/mapPublishing.js';
import FacilityGeometryPreview from '../Admin/FacilityGeometryPreview.jsx';
import RobotConsole from '../Admin/robotOperations/RobotConsole.jsx';
import { isOperator } from '../../features/robotOperations/model.js';
import { getSession } from '../../features/auth/session.js';

export default function ServerDispatch() {
  const navigate=useNavigate(),[params]=useSearchParams();
  const [catalog,setCatalog]=useState({maps:[],endpoints:[],zones:[],robots:[]});
  const [mapId,setMapId]=useState(params.get('mapId')||''),[endpointId,setEndpointId]=useState(''),[robotId,setRobotId]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[consoleScope,setConsoleScope]=useState(null);
  const operator=isOperator(getSession());
  useEffect(()=>{let active=true;setLoading(true);setError('');
    Promise.all([allFacilityPages(facilityApi.listMaps),allFacilityPages(facilityApi.listEndpoints),allFacilityPages(facilityApi.listZones),allFacilityPages(p=>apiRequest('/api/v1/robots?'+new URLSearchParams(p)))]).then(([maps,endpoints,zones,robots])=>{
      if(!active)return;const available=dispatchMaps(maps);setCatalog({maps,endpoints,zones,robots});setMapId(id=>maps.some(m=>m.mapId===id)?id:available[0]?.mapId||'');
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[revision]);
  useEffect(()=>{const reload=()=>setRevision(v=>v+1);window.addEventListener('mediassist-facility-updated',reload);window.addEventListener('focus',reload);return()=>{window.removeEventListener('mediassist-facility-updated',reload);window.removeEventListener('focus',reload);};},[]);
  const map=catalog.maps.find(m=>m.mapId===mapId),points=dispatchEndpoints(catalog.endpoints,mapId);
  const selected=points.find(p=>p.endpointId===endpointId);
  return <section className="ls-studio server-dispatch" style={{display:'grid',gap:16,marginTop:16}} aria-label="Điều phối từ bản đồ máy chủ">
    <section className="ls-panel"><div className="ls-actions"><strong>Điều phối trên bản đồ đang hoạt động</strong><button className="ls-btn" disabled={loading||!!consoleScope} onClick={()=>setRevision(v=>v+1)}>Tải lại map và điểm đích</button></div><p>Chọn map đã kích hoạt, điểm đích và robot. Mở phiên định vị rồi gửi yêu cầu di chuyển khi robot sẵn sàng.</p>
      {loading&&<p role="status">Đang tải dữ liệu BE…</p>}{error&&<p className="ls-error" role="alert">Không tải được danh mục: {error}</p>}
      {!loading&&!error&&!catalog.maps.length&&<p role="status">Chưa có bản đồ đang hoạt động. Mở Bản đồ → Điểm đích → Hoàn tất & kích hoạt bản đồ.</p>}
      <div className="ep-coordinate-fields"><label className="ls-field">Bản đồ trong database<select aria-label="Bản đồ trong database" value={mapId} disabled={loading||!!consoleScope} onChange={e=>{setMapId(e.target.value);setEndpointId('');}}><option value="">Chọn bản đồ</option>{catalog.maps.map(m=><option key={m.mapId} value={m.mapId}>{m.mapName} · v{m.versionNo} · {({DRAFT:'Nháp',ACTIVE:'Đang hoạt động',INACTIVE:'Không hoạt động',ARCHIVED:'Lưu trữ'})[m.status]||m.status}</option>)}</select></label>
      <label className="ls-field">Điểm đích<select aria-label="Điểm đích điều phối" value={selected?endpointId:''} disabled={loading||!!consoleScope} onChange={e=>setEndpointId(e.target.value)}><option value="">Chọn điểm đích</option>{points.map(p=><option key={p.endpointId} value={p.endpointId}>{p.endpointCode} — {p.endpointName}</option>)}</select></label></div>
      <label className="ls-field">Robot<select aria-label="Robot điều phối" value={robotId} disabled={loading||!!consoleScope} onChange={e=>setRobotId(e.target.value)}><option value="">Chọn robot</option>{catalog.robots.map(r=><option key={r.robotId} value={r.robotId}>{r.robotName||r.robotCode||r.robotId} · {r.status}</option>)}</select></label>
      {!operator&&<p className="ls-error">Đăng nhập ADMIN thật để gửi yêu cầu điều phối robot.</p>}
      <div className="ls-actions"><button className="ls-btn" onClick={()=>navigate('/admin/map'+(mapId?'?mapId='+encodeURIComponent(mapId):''))}>Mở Bản đồ</button><button className="ls-btn primary" disabled={!operator||!map||!selected||!robotId||map.status!=='ACTIVE'||!!consoleScope} onClick={()=>setConsoleScope({mapId,robotId,endpointId})}>Mở điều phối robot</button></div>
      {map&&!points.length&&<p>Map này chưa có điểm đang hoạt động và có thể tiếp cận. Kiểm tra cấu hình điểm đích trong Bản đồ.</p>}
    </section>
    {map&&map.status!=='ACTIVE'&&<p className="ls-error">Bản đồ này chưa hoạt động. Bạn vẫn xem được map và điểm đích; mở Bản đồ để kích hoạt trước khi điều phối.</p>}
    {map&&!consoleScope&&<section className="ls-panel"><h3>{map.mapName} · {points.length} điểm khả dụng</h3><FacilityGeometryPreview key={mapId} map={map} zones={catalog.zones.filter(z=>z.mapId===mapId)} endpoints={points} endpointEdit={selected} onEndpoint={p=>setEndpointId(p.endpointId)}/></section>}
    {consoleScope&&<RobotConsole navigationOnly {...consoleScope}/>}
  </section>;
}
