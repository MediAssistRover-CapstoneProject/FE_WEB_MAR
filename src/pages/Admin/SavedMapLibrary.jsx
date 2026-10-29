import { useEffect, useState } from 'react';
import { facilityApi, allFacilityPages } from '../../features/facility/facilityApi.js';
import FacilityGeometryPreview from './FacilityGeometryPreview.jsx';
const labels={DRAFT:'Nháp',ACTIVE:'Đang hoạt động',INACTIVE:'Không hoạt động',ARCHIVED:'Lưu trữ'};
export default function SavedMapLibrary({onOpen}){
  const [maps,setMaps]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);setError('');allFacilityPages(facilityApi.listMaps).then(rows=>{if(active){setMaps(rows);setSelected(id=>rows.some(m=>m.mapId===id)?id:rows[0]?.mapId||'');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[revision]);
  const map=maps.find(m=>m.mapId===selected);
  return <div className="facility-catalog"><section className="ls-panel"><div className="ls-actions"><h3>Map đã quét trong database · {maps.length}</h3><button className="ls-btn" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Tải lại danh sách map</button></div><p>Toàn bộ bản đồ đã lưu, gồm bản nháp, đang hoạt động, không hoạt động và lưu trữ.</p>{loading&&<p role="status">Đang tải danh sách map…</p>}{error&&<p className="ls-error" role="alert">Không tải được map: {error}</p>}{!loading&&!error&&!maps.length&&<p>Database chưa có bản đồ.</p>}
    <div className="ls-item-list" style={{maxHeight:320}}>{maps.map(m=><button className={'ls-item '+(m.mapId===selected?'selected':'')} key={m.mapId} onClick={()=>setSelected(m.mapId)}><span><strong>{m.mapName} · v{m.versionNo}</strong><small>{labels[m.status]||m.status} · {m.widthM} × {m.heightM} m</small></span></button>)}</div></section>
    {map&&<section className="ls-panel"><h3>{map.mapName} · {labels[map.status]||map.status}</h3><div className="ls-actions"><button className="ls-btn" onClick={()=>onOpen(map.mapId,'zone')}>Mở vùng</button><button className="ls-btn primary" onClick={()=>onOpen(map.mapId,'endpoint')}>Mở điểm đích & trạng thái</button></div><FacilityGeometryPreview key={map.mapId} map={map} zones={[]} endpoints={[]}/></section>}
  </div>;
}
