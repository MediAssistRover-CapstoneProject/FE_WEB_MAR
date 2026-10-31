import { cloneElement, useEffect, useRef, useState } from 'react';
import { facilityApi as api, allFacilityPages } from '../../features/facility/facilityApi.js';
import { ZONE_CATEGORIES,zonePayload,endpointPayload,groupFromApi,groupPayload } from '../../features/facility/facilityContract.js';
import EndpointGroupEditor from './EndpointGroupEditor.jsx';
import WorkspaceTabs from '../../components/WorkspaceTabs.jsx';
import EndpointMapEditor from './EndpointMapEditor.jsx';
import FacilityGeometryPreview, { polygonPoints } from './FacilityGeometryPreview.jsx';
import { useNavigate } from 'react-router-dom';
import { dispatchEndpoints, endpointDraftDirty } from '../../features/facility/mapPublishing.js';

const zoneDefault={zoneCode:'',zoneName:'',zoneType:'KEEP_OUT',polygonJson:'{"points":[]}',speedLimitMps:'',capacityLimit:'',calibratedAreaM2:'',cameraSourceRef:'',cameraRoiJson:'',active:true,publicVisible:false,description:''};
const endpointDefault={endpointCode:'',endpointName:'',endpointType:'WAYPOINT',xM:'',yM:'',yawRad:0,zoneId:'',roomId:'',active:true,accessible:true,publicVisible:false,description:''};
const emptyCatalog={maps:[],zones:[],endpoints:[],groups:[],members:[],rooms:[]};
const jsonString=value=>value==null?'':JSON.stringify(value,null,2);
function Field({label,children,...props}){return <label className="ls-field">{label}{children?cloneElement(children,{'aria-label':label}):<input {...props} aria-label={label}/>}</label>;}
function Check({label,...props}){return <label className="ls-field"><span><input type="checkbox" {...props}/> {label}</span></label>;}

export default function FacilityCatalogEditor({stage, initialMapId = '', onMapChange}) {
  const navigate=useNavigate();
  const [catalog,setCatalog]=useState(emptyCatalog),[mapId,setMapId]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  const [zone,setZone]=useState(zoneDefault),[endpoint,setEndpoint]=useState(endpointDefault),[endpointTab,setEndpointTab]=useState('point');
  const [drawing,setDrawing]=useState(false);
  const writeLock=useRef(false);
  // Preserve the library selection across scan/editor mounts without refetching.
  const mapSelection=useRef({initialMapId,onMapChange});
  mapSelection.current={initialMapId,onMapChange};
  useEffect(()=>{if(ready)mapSelection.current.onMapChange?.(mapId);},[mapId,ready]);
  useEffect(()=>setDrawing(false),[stage,mapId]);
  const map=catalog.maps.find(m=>m.mapId===mapId),zones=catalog.zones.filter(z=>z.mapId===mapId),endpoints=catalog.endpoints.filter(e=>e.mapId===mapId),rooms=catalog.rooms.filter(r=>r.floorId===map?.floorId);
  const groups=catalog.groups.filter(g=>g.mapId===mapId).map(g=>groupFromApi(g,catalog.members));
  const localEndpoints=endpoints.map(e=>({id:e.endpointId,name:e.endpointName,enabled:e.active,accessible:e.accessible}));
  const fetchCatalog=async()=>{
    const [maps,zones,endpoints,groups,members,rooms]=await Promise.all([api.listMaps,api.listZones,api.listEndpoints,api.listEndpointGroups,api.listEndpointGroupMembers,api.listRooms].map(allFacilityPages));
    return {maps,zones,endpoints,groups,members,rooms};
  };
  useEffect(()=>{let mounted=true;fetchCatalog().then(data=>{if(mounted){setCatalog(data);setMapId(data.maps.find(m=>m.mapId===mapSelection.current.initialMapId)?.mapId||data.maps.find(m=>m.status==='ACTIVE')?.mapId||data.maps[0]?.mapId||'');setReady(true);setStatus('');}}).catch(e=>{if(mounted)setStatus('Không tải được dữ liệu bản đồ: '+e.message);});return()=>{mounted=false;};},[]);
  const reload=async()=>{setBusy(true);setStatus('');try{const data=await fetchCatalog();setCatalog(data);setReady(true);if(!data.maps.some(m=>m.mapId===mapId))setMapId(data.maps.find(m=>m.mapId===mapSelection.current.initialMapId)?.mapId||data.maps.find(m=>m.status==='ACTIVE')?.mapId||data.maps[0]?.mapId||'');setStatus('');}catch(e){setStatus('Không tải được: '+e.message);}finally{setBusy(false);}};
  const write=async action=>{
    if(writeLock.current)throw Error('Đang lưu, vui lòng chờ.');writeLock.current=true;setBusy(true);
    try{const result=await action();setStatus('Đã lưu thay đổi.');return result;}
    catch(e){setStatus(`Không lưu được${e.status?' (HTTP '+e.status+')':''}: ${e.message}. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại.`);throw e;}
    finally{writeLock.current=false;setBusy(false);}
  };
  const upsert=(key,id,value)=>setCatalog(c=>({...c,[key]:[...c[key].filter(item=>item[id]!==value[id]),value]}));
  const editZone=id=>{const z=zones.find(z=>z.zoneId===id);setZone(z?{...z,polygonJson:jsonString(z.polygonJson),cameraRoiJson:jsonString(z.cameraRoiJson)}:{...zoneDefault});};
  const setZ=(key,value)=>setZone(z=>({...z,[key]:value}));
  const dirty=map&&endpointDraftDirty(endpoint,map,endpoints,zones,rooms);
  const usable=dispatchEndpoints(endpoints,mapId);
  const privatePoints=usable.filter(p=>!p.publicVisible);
  const activate=()=>write(async()=>{
    if(dirty)throw Error('Lưu hoặc bỏ thay đổi điểm đích trước khi kích hoạt.');
    const result=await api.activateMap(mapId);
    setCatalog(c=>({...c,maps:c.maps.map(m=>m.mapId===result.mapId?result:m.floorId===result.floorId&&m.status==='ACTIVE'?{...m,status:'INACTIVE'}:m)}));
    window.dispatchEvent(new Event('mediassist-facility-updated'));
  }).catch(()=>{});
  const publishPoints=()=>write(async()=>{
    for(const point of privatePoints){
      const result=await api.updateEndpoint(point.endpointId,{...endpointPayload(point,map,zones,rooms),publicVisible:true});
      upsert('endpoints','endpointId',result);
      if(endpoint.endpointId===result.endpointId)setEndpoint({...result});
    }
    window.dispatchEvent(new Event('mediassist-facility-updated'));
  }).catch(()=>{});
  return <div className="facility-catalog">
    {!ready&&!status&&<p className="ls-hint" role="status">Đang tải bản đồ…</p>}
    {status&&<div className="ls-notice facility-feedback" role="status"><span>{status}</span>{status.startsWith('Không')&&<button type="button" className="ls-btn small" disabled={busy} onClick={reload}>Tải lại dữ liệu</button>}</div>}
    {ready&&!map&&<div className="ls-empty"><strong>Chưa có bản đồ để chỉnh sửa</strong><p>Quay lại thư viện để chọn bản đồ hoặc tạo bản đồ mới.</p></div>}
    {map&&<>
      {stage!=='endpoint'&&<div className="facility-map-context" data-map-id={mapId}><strong>{map.mapName}</strong><span>v{map.versionNo} · {map.widthM} × {map.heightM} m · {Number(map.resolutionMPerPixel)*100} cm/ô</span></div>}
      {stage==='scan'&&<section className="ls-panel"><h3>Bản đồ đã có trên BE</h3><p>Quét thật cần robot, phiên mapping và artifact được BE xác minh. Trang này quản lý danh mục vùng/điểm trên bản đồ đã tồn tại.</p><p>Chuyển sang Vùng hoặc Điểm đích để cấu hình trên đúng mapId.</p><p><strong>Không có nhãn phòng trong dữ liệu quét gốc.</strong> Vùng, phòng và điểm đích là các lớp cấu hình thêm sau khi có hình học.</p></section>}
      {stage==='zone'&&<div className="ls-layout" style={{marginTop:16}}><section className="ls-panel"><h3>Vùng trên bản đồ · {zones.length}</h3><FacilityGeometryPreview map={map} zones={zones} endpoints={endpoints} zoneEdit={zone} drawing={drawing&&!busy} onZone={id=>{editZone(id);setDrawing(false);}} onPoint={p=>setZ('polygonJson',JSON.stringify({points:[...polygonPoints(zone.polygonJson),[p.xM,p.yM]]},null,2))}/><div className="ls-actions"><button className="ls-btn" disabled={busy} onClick={()=>setDrawing(d=>!d)}>{drawing?'Dừng vẽ vùng':'Vẽ thêm đỉnh vùng'}</button><button className="ls-btn" disabled={busy||!polygonPoints(zone.polygonJson).length} onClick={()=>setZ('polygonJson',JSON.stringify({points:polygonPoints(zone.polygonJson).slice(0,-1)},null,2))}>Bỏ đỉnh cuối</button><button className="ls-btn" disabled={busy} onClick={()=>setZ('polygonJson','{"points":[] }')}>Vẽ lại đa giác</button></div><p>Loại vùng BE chỉ gồm KEEP_OUT, SPEED và NO_STOP. Robot có thể đi qua NO_STOP nhưng không được đặt điểm đích hoặc dừng trong vùng.</p><div className="ls-item-list">{zones.map(z=><button type="button" className="ls-item" key={z.zoneId} disabled={busy} onClick={()=>editZone(z.zoneId)}><span><strong>{z.zoneName}</strong><small>{ZONE_CATEGORIES[z.zoneType]} · {z.zoneCode} · {z.active?'Bật':'Tắt'}</small></span></button>)}</div><button className="ls-btn" disabled={busy} onClick={()=>editZone('')}>+ Vùng BE mới</button><p>Đa giác dùng tọa độ mét trong khung bản đồ BE. Không bị giới hạn bởi tường; không thay đổi dữ liệu quét.</p></section>
        <section className="ls-panel"><h3>{zone.zoneId?'Chỉnh vùng BE':'Tạo vùng BE'}</h3><form onSubmit={e=>{e.preventDefault();write(async()=>{const payload=zonePayload(zone,mapId);const result=await(zone.zoneId?api.updateZone(zone.zoneId,payload):api.createZone(payload));upsert('zones','zoneId',result);setZone({...result,polygonJson:jsonString(result.polygonJson),cameraRoiJson:jsonString(result.cameraRoiJson)});}).catch(()=>{});}}><fieldset disabled={busy||map.status==='ARCHIVED'} style={{border:0,padding:0,minWidth:0}}>
          <Field label="Mã vùng BE" required maxLength={64} value={zone.zoneCode} onChange={e=>setZ('zoneCode',e.target.value)}/><Field label="Tên vùng BE" required maxLength={160} value={zone.zoneName} onChange={e=>setZ('zoneName',e.target.value)}/>
          <Field label="Chức năng vùng BE"><select value={zone.zoneType} onChange={e=>setZ('zoneType',e.target.value)}>{Object.entries(ZONE_CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
          <details><summary>Tọa độ đa giác nâng cao</summary><Field label="Đa giác BE (mét)"><textarea rows={6} required value={zone.polygonJson} onChange={e=>setZ('polygonJson',e.target.value)}/></Field><p>Dạng: {JSON.stringify({points:[[0,0],[2,0],[2,2],[0,2]]})}</p></details>
          {[['speedLimitMps','Giới hạn tốc độ (m/s)'],['capacityLimit','Sức chứa (người)'],['calibratedAreaM2','Diện tích hiệu chuẩn (m²)']].map(([key,label])=><Field key={key} label={label} type="number" min={key==='capacityLimit'?0:0.000001} step={key==='capacityLimit'?1:'any'} value={zone[key]??''} onChange={e=>setZ(key,e.target.value)}/>)}
          <Field label="Nguồn camera" maxLength={255} value={zone.cameraSourceRef||''} onChange={e=>setZ('cameraSourceRef',e.target.value)}/><Field label="ROI camera (JSON tùy chọn)"><textarea rows={3} value={zone.cameraRoiJson||''} onChange={e=>setZ('cameraRoiJson',e.target.value)}/></Field>
          <Field label="Mô tả vùng BE" value={zone.description||''} onChange={e=>setZ('description',e.target.value)}/><Check label="Vùng hoạt động" checked={zone.active} onChange={e=>setZ('active',e.target.checked)}/><Check label="Hiển thị công khai vùng" checked={zone.publicVisible} onChange={e=>setZ('publicVisible',e.target.checked)}/><button className="ls-btn primary" type="submit">Lưu vùng lên BE</button>
        </fieldset></form></section></div>}
      {stage==='endpoint'&&<><WorkspaceTabs label="Quản lý điểm đích" active={endpointTab} onSelect={setEndpointTab} items={[{id:'point',label:'Điểm đích'},{id:'group',label:'Nhóm điểm đích'}]}/>
        {endpointTab==='group'?<EndpointGroupEditor key={mapId} remote busy={busy||map.status==='ARCHIVED'} groups={groups} endpoints={localEndpoints}
          onSave={g=>write(async()=>{const result=await(g.id?api.updateEndpointGroup(g.id,groupPayload(g,mapId)):api.createEndpointGroup(groupPayload(g,mapId)));upsert('groups','endpointGroupId',result);return groupFromApi(result,catalog.members);})}
          onMember={(g,m,existing)=>write(async()=>{const body={endpointGroupId:g.id,...m};const result=await(existing?api.updateEndpointGroupMember(g.id,m.endpointId,body):api.createEndpointGroupMember(body));setCatalog(c=>({...c,members:[...c.members.filter(row=>!(row.endpointGroupId===g.id&&row.endpointId===m.endpointId)),result]}));})}
          onRemove={(g,m)=>write(async()=>{await api.removeEndpointGroupMember(g.id,m.endpointId);setCatalog(c=>({...c,members:c.members.map(row=>row.endpointGroupId===g.id&&row.endpointId===m.endpointId?{...row,active:false}:row)}));})}/>
        :<EndpointMapEditor map={map} zones={zones} rooms={rooms} endpoints={endpoints} endpoint={endpoint} setEndpoint={setEndpoint} drawing={drawing} setDrawing={setDrawing} busy={busy} onSave={()=>write(async()=>{const payload=endpointPayload(endpoint,map,zones,rooms);const result=await(endpoint.endpointId?api.updateEndpoint(endpoint.endpointId,payload):api.createEndpoint(payload));upsert('endpoints','endpointId',result);setEndpoint({...result});setDrawing(false);}).catch(()=>{})}/>}
        {endpointTab==='group'&&<p className="ls-hint">Nhóm điểm giúp sắp xếp thứ tự và chọn điểm đích khi thiết lập quy trình.</p>}
      </>}
      {stage==='endpoint'&&<section className="ls-panel ep-publish" aria-label="Hoàn tất bản đồ">
        <div><h3>{map.status==='ACTIVE'?'Bản đồ sẵn sàng điều phối':'Đưa bản đồ vào sử dụng'} <span className={'ep-mode '+(map.status==='ACTIVE'?'ep-live':'')}>{({DRAFT:'Nháp',ACTIVE:'Đang hoạt động',INACTIVE:'Không hoạt động',ARCHIVED:'Lưu trữ'})[map.status]||map.status}</span></h3><p>{usable.length} điểm có thể điều phối · {usable.filter(p=>p.publicVisible).length} điểm công khai</p>
          {map.status!=='ACTIVE'&&map.status!=='ARCHIVED'&&<p>Kích hoạt để sử dụng trong Điều phối. Bản đồ đang hoạt động cùng tầng sẽ được thay thế.</p>}
          {dirty&&<p className="ls-error">Lưu hoặc bỏ thay đổi điểm đích trước khi hoàn tất.</p>}
        </div>
        <div className="ls-actions">
          {map.status!=='ACTIVE'&&<button type="button" className="ls-btn primary" disabled={busy||dirty||!usable.length||map.status==='ARCHIVED'} onClick={activate}>Kích hoạt bản đồ</button>}
          {privatePoints.length>0&&<button type="button" className="ls-btn" disabled={busy||dirty||map.status==='ARCHIVED'} onClick={publishPoints}>Công khai {privatePoints.length} điểm đích</button>}
          <button type="button" className={'ls-btn '+(map.status==='ACTIVE'?'primary':'')} disabled={busy||dirty||map.status!=='ACTIVE'||!usable.length} onClick={()=>navigate('/workstations?mapId='+encodeURIComponent(mapId))}>Mở Điều phối →</button>
        </div>
      </section>}
    </>}
  </div>;
}
