import { useEffect, useRef, useState } from 'react';
import { facilityApi as api, allFacilityPages } from '../../features/facility/facilityApi.js';
import { zonePayload,groupFromApi,groupPayload } from '../../features/facility/facilityContract.js';
import EndpointGroupEditor from './EndpointGroupEditor.jsx';
import WorkspaceTabs from '../../components/WorkspaceTabs.jsx';
import EndpointMapEditor from './EndpointMapEditor.jsx';
import ZoneMapEditor from './ZoneMapEditor.jsx';
import { useNavigate } from 'react-router-dom';
import { dispatchEndpoints, endpointDraftDirty } from '../../features/facility/mapPublishing.js';
import { saveValidatedEndpoint } from '../../features/facility/navigationPoint.js';
import { getSession } from '../../features/auth/session.js';

const zoneDefault={zoneCode:'',zoneName:'',zoneType:'KEEP_OUT',polygonJson:'{"points":[]}',speedLimitMps:'',capacityLimit:'',calibratedAreaM2:'',cameraSourceRef:'',cameraRoiJson:'',active:true,publicVisible:false,description:''};
const endpointDefault={endpointCode:'',endpointName:'',endpointType:'WAYPOINT',xM:'',yM:'',yawRad:0,zoneId:'',roomId:'',active:true,accessible:true,publicVisible:false,description:''};
const emptyCatalog={maps:[],zones:[],endpoints:[],groups:[],members:[],rooms:[]};
const jsonString=value=>value==null?'':JSON.stringify(value,null,2);
const zoneForm=value=>({...value,polygonJson:jsonString(value.polygonJson),cameraRoiJson:jsonString(value.cameraRoiJson)});

export default function FacilityCatalogEditor({stage, initialMapId = '', onMapChange, onMapCopied, onOpenLibrary}) {
  const navigate=useNavigate();
  const canManageZones=getSession()?.account?.role==='ADMIN';
  const [catalog,setCatalog]=useState(emptyCatalog),[mapId,setMapId]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  const [zone,setZone]=useState(zoneDefault),[endpoint,setEndpoint]=useState(endpointDefault),[endpointTab,setEndpointTab]=useState('point');
  const [drawing,setDrawing]=useState(false);
  const [mapCheck,setMapCheck]=useState({mapId:'',loading:false,data:null,error:''}),[checkRevision,setCheckRevision]=useState(0),[copyState,setCopyState]=useState(null);
  const writeLock=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  // Preserve the library selection across scan/editor mounts without refetching.
  const mapSelection=useRef({initialMapId,onMapChange});
  mapSelection.current={initialMapId,onMapChange};
  useEffect(()=>{if(ready)mapSelection.current.onMapChange?.(mapId);},[mapId,ready]);
  useEffect(()=>setDrawing(false),[stage,mapId]);
  useEffect(()=>{setZone({...zoneDefault});setEndpoint({...endpointDefault});},[mapId]);
  useEffect(()=>{
    if(!mapId)return;
    const abort=new AbortController();
    setMapCheck({mapId,loading:true,data:null,error:''});
    api.getMapImageMetadata(mapId,{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(8000)])}).then(data=>{
      if(data?.map_id!==mapId)throw Error('Metadata không thuộc bản đồ đang chọn.');
      if(!abort.signal.aborted)setMapCheck({mapId,loading:false,data,error:''});
    }).catch(error=>{if(!abort.signal.aborted)setMapCheck({mapId,loading:false,data:null,error:error.message});});
    return()=>abort.abort();
  },[mapId,checkRevision]);
  const map=catalog.maps.find(m=>m.mapId===mapId),zones=catalog.zones.filter(z=>z.mapId===mapId),endpoints=catalog.endpoints.filter(e=>e.mapId===mapId),rooms=catalog.rooms.filter(r=>r.floorId===map?.floorId);
  const groups=catalog.groups.filter(g=>g.mapId===mapId).map(g=>groupFromApi(g,catalog.members));
  const localEndpoints=endpoints.map(e=>({id:e.endpointId,name:e.endpointName,enabled:e.active,accessible:e.accessible}));
  const fetchCatalog=async()=>{
    const [maps,zones,endpoints,groups,members,rooms]=await Promise.all([api.listMaps,params=>api.listZones({...params,...(canManageZones?{includeDeleted:true}:{})}),api.listEndpoints,api.listEndpointGroups,api.listEndpointGroupMembers,api.listRooms].map(allFacilityPages));
    return {maps,zones,endpoints,groups,members,rooms};
  };
  useEffect(()=>{let mounted=true;fetchCatalog().then(data=>{if(mounted){setCatalog(data);setMapId(data.maps.find(m=>m.mapId===mapSelection.current.initialMapId)?.mapId||data.maps.find(m=>m.status==='ACTIVE')?.mapId||data.maps[0]?.mapId||'');setReady(true);setStatus('');}}).catch(e=>{if(mounted)setStatus('Không tải được dữ liệu bản đồ: '+e.message);});return()=>{mounted=false;};},[]);
  const reload=async()=>{setBusy(true);setStatus('');try{const data=await fetchCatalog();setCatalog(data);setReady(true);setCheckRevision(v=>v+1);if(!data.maps.some(m=>m.mapId===mapId))setMapId(data.maps.find(m=>m.mapId===mapSelection.current.initialMapId)?.mapId||data.maps.find(m=>m.status==='ACTIVE')?.mapId||data.maps[0]?.mapId||'');setStatus('');}catch(e){setStatus('Không tải được: '+e.message);}finally{setBusy(false);}};
  const write=async (action,successMessage='Đã lưu thay đổi.')=>{
    if(writeLock.current)throw Error('Đang lưu, vui lòng chờ.');writeLock.current=true;setBusy(true);
    try{const result=await action();setStatus(successMessage);window.dispatchEvent(new Event('mediassist-facility-updated'));return result;}
    catch(e){setStatus(`Không lưu được${e.status?' (HTTP '+e.status+')':''}: ${e.message}. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại.`);throw e;}
    finally{writeLock.current=false;setBusy(false);}
  };
  const upsert=(key,id,value)=>setCatalog(c=>({...c,[key]:[...c[key].filter(item=>item[id]!==value[id]),value]}));
  const editZone=id=>{const z=zones.find(z=>z.zoneId===id);setZone(z?zoneForm(z):{...zoneDefault});};
  const savedZone=zones.find(z=>z.zoneId===zone.zoneId);
  const savedZoneForm=savedZone&&zoneForm(savedZone);
  const zoneStateDirty=!!savedZone&&Object.keys(zoneDefault).some(key=>String(zone[key]??'')!==String(savedZoneForm[key]??''));
  const toggleZoneActive=async reason=>{
    if(!canManageZones||!savedZone||busy||writeLock.current||zoneStateDirty||map?.status==='ARCHIVED')return;
    const target=savedZone,active=!target.active,trimmed=reason.trim();
    if(trimmed.length<5||trimmed.length>500){setStatus('Lý do cần từ 5 đến 500 ký tự.');return;}
    await write(async()=>{
      const result=await(active?api.activateZone(target.zoneId,trimmed):api.deactivateZone(target.zoneId,trimmed));
      if(result?.zoneId!==target.zoneId||result.mapId!==target.mapId||result.active!==active)throw Error('Máy chủ chưa xác nhận trạng thái của đúng vùng.');
      if(!mounted.current)return;
      upsert('zones','zoneId',result);
      setZone(current=>current.zoneId===target.zoneId?zoneForm(result):current);
      setDrawing(false);
    },active?'Đã kích hoạt lại vùng '+target.zoneCode+'.':'Đã ngừng hoạt động vùng '+target.zoneCode+'.').catch(()=>{});
  };
  const dirty=map&&endpointDraftDirty(endpoint,map,endpoints,zones,rooms);
  const savedEndpoint=endpoints.find(p=>p.endpointId===endpoint.endpointId);
  const endpointStateDirty=!!dirty&&JSON.stringify(endpoint)!==JSON.stringify(savedEndpoint);
  const toggleEndpointActive=async()=>{
    if(!savedEndpoint||busy||writeLock.current||endpointStateDirty||map?.status==='ARCHIVED')return;
    const point=savedEndpoint,active=!point.active;
    await write(async()=>{
      const result=await(active?api.activateEndpoint(point.endpointId):api.deactivateEndpoint(point.endpointId));
      if(result?.endpointId!==point.endpointId||result.mapId!==point.mapId||result.active!==active)throw Error('Máy chủ chưa xác nhận trạng thái của đúng điểm đích.');
      if(!mounted.current)return;
      upsert('endpoints','endpointId',result);
      setEndpoint(current=>current.endpointId===point.endpointId?{...result}:current);
      setDrawing(false);
    },active?'Đã kích hoạt lại điểm '+point.endpointCode+'.':'Đã ngừng sử dụng điểm '+point.endpointCode+'.').catch(()=>{});
  };
  const usable=dispatchEndpoints(endpoints,mapId);
  const privatePoints=usable.filter(p=>!p.publicVisible);
  const mapVerified=mapCheck.mapId===mapId&&!mapCheck.loading&&!mapCheck.error&&mapCheck.data?.navigation_reload_safe===true;
  const mapUnsafe=mapCheck.mapId===mapId&&mapCheck.data?.navigation_reload_safe===false;
  const copyPending=copyState?.sourceId===mapId;
  const normalize=async()=>{
    if(writeLock.current||!mapUnsafe||dirty||map?.status==='ARCHIVED'||copyPending)return;
    writeLock.current=true;setBusy(true);setStatus('');
    const sourceId=mapId;let created;
    try{
      created=await api.navigationCopy(sourceId);
      if(!mounted.current)return;
      if(!created?.mapId)throw Error('Máy chủ chưa trả mã bản đồ.');
      setCopyState({sourceId,mapId:created.mapId,state:'created'});
      try{
        const data=await fetchCatalog();
        if(!mounted.current)return;
        setCatalog(data);setMapId(created.mapId);
        setZone({...zoneDefault});setEndpoint({...endpointDefault});
        setStatus('Đã mở bản đồ tương thích. Kiểm tra vùng và nhóm điểm trước khi kích hoạt.');
      }catch(error){if(!mounted.current)return;setStatus('Đã tạo bản đồ '+created.mapId+', nhưng chưa tải lại được danh mục: '+error.message+'. Không tạo lại bản sao.');}
      setCheckRevision(v=>v+1);
      window.dispatchEvent(new Event('mediassist-facility-updated'));
      onMapCopied?.(created.mapId);
    }catch(error){
      if(!mounted.current)return;
      const uncertain=!error.status||error.status>=500||error.status===408||error.status===429;
      if(uncertain)setCopyState({sourceId,state:'uncertain'});
      setStatus(uncertain?'Chưa xác nhận được kết quả tạo bản sao. Kiểm tra thư viện bản đồ trước khi gửi yêu cầu khác; không tự động tạo lại.':'Không tạo được bản sao: '+error.message);
    }finally{writeLock.current=false;if(mounted.current)setBusy(false);}
  };
  const activate=()=>write(async()=>{
    if(dirty)throw Error('Lưu hoặc bỏ thay đổi điểm đích trước khi kích hoạt.');
    if(!mapVerified)throw Error('Kiểm tra và xử lý khả năng nạp map dẫn đường trước khi kích hoạt.');
    const result=await api.activateMap(mapId);
    setCatalog(c=>({...c,maps:c.maps.map(m=>m.mapId===result.mapId?result:m.floorId===result.floorId&&m.status==='ACTIVE'?{...m,status:'INACTIVE'}:m)}));
    window.dispatchEvent(new Event('mediassist-facility-updated'));
  }).catch(()=>{});
  const publishPoints=()=>write(async()=>{
    for(const point of privatePoints){
      const result=await saveValidatedEndpoint(api,{...point,publicVisible:true},map,zones,rooms);
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
      <section className="ls-panel" aria-label="Khả năng nạp map dẫn đường">
        <div className="ls-actions"><strong>{mapCheck.mapId!==mapId||mapCheck.loading?'Đang kiểm tra map dẫn đường…':mapVerified?'Map tương thích để nạp dẫn đường':mapUnsafe?'Map cần bản sao tương thích dẫn đường':'Chưa xác minh được khả năng dẫn đường'}</strong><button type="button" className="ls-btn small" disabled={busy||mapCheck.loading} onClick={()=>setCheckRevision(v=>v+1)}>Kiểm tra lại khả năng dẫn đường</button></div>
        {mapCheck.mapId===mapId&&mapCheck.error&&<p className="ls-error" role="alert">Không đọc được metadata: {mapCheck.error}</p>}
        {mapUnsafe&&<><p>Ngưỡng ô trống của map này không phù hợp khi nạp lại. BE có thể tạo một map nháp mới tương thích, giữ nguyên map gốc và sao chép điểm đích. Vùng, nhóm điểm và liên kết phòng không được sao chép; cần thiết lập lại trên bản mới.</p><button type="button" className="ls-btn primary" disabled={busy||dirty||map.status==='ARCHIVED'||!!copyPending} onClick={normalize}>Tạo bản đồ tương thích dẫn đường</button></>}
        {copyPending&&<p role="status">{copyState.state==='created'?'Đã nhận kết quả bản sao '+copyState.mapId+'. Không tạo lại bản sao này.':'Kết quả yêu cầu tạo bản sao chưa rõ. Kiểm tra danh sách map trước khi thao tác tiếp.'} {onOpenLibrary&&<button type="button" className="ls-btn small" disabled={busy} onClick={onOpenLibrary}>Về thư viện kiểm tra</button>}</p>}
        {mapVerified&&<p>Kiểm tra này chỉ xác nhận map có thể nạp lại. Robot vẫn cần phiên dẫn đường, vị trí đã xác minh và cấu hình đã đồng bộ trước khi chạy.</p>}
      </section>
      {stage==='scan'&&<section className="ls-panel"><h3>Bản đồ đã có trên BE</h3><p>Quét thật cần robot, phiên mapping và artifact được BE xác minh. Trang này quản lý danh mục vùng/điểm trên bản đồ đã tồn tại.</p><p>Chuyển sang Vùng hoặc Điểm đích để cấu hình trên đúng mapId.</p><p><strong>Không có nhãn phòng trong dữ liệu quét gốc.</strong> Vùng, phòng và điểm đích là các lớp cấu hình thêm sau khi có hình học.</p></section>}
      {stage==='zone'&&<ZoneMapEditor map={map} zones={zones} endpoints={endpoints} zone={zone} setZone={setZone} drawing={drawing} setDrawing={setDrawing} busy={busy} canManage={canManageZones} hasUnsavedChanges={zoneStateDirty} onToggleActive={toggleZoneActive} onSelect={editZone} onSave={draft=>{
        let payload;
        try{payload=zonePayload(draft,mapId);}catch(error){setStatus(error.message);return;}
        write(async()=>{const result=await(draft.zoneId?api.updateZone(draft.zoneId,payload):api.createZone(payload));upsert('zones','zoneId',result);setZone(zoneForm(result));setDrawing(false);}).catch(()=>{});
      }}/>}
      {stage==='endpoint'&&<><WorkspaceTabs label="Quản lý điểm đích" active={endpointTab} onSelect={setEndpointTab} items={[{id:'point',label:'Điểm đích'},{id:'group',label:'Nhóm điểm đích'}]}/>
        {endpointTab==='group'?<EndpointGroupEditor key={mapId} remote busy={busy||map.status==='ARCHIVED'} groups={groups} endpoints={localEndpoints}
          onSave={g=>write(async()=>{const result=await(g.id?api.updateEndpointGroup(g.id,groupPayload(g,mapId)):api.createEndpointGroup(groupPayload(g,mapId)));upsert('groups','endpointGroupId',result);return groupFromApi(result,catalog.members);})}
          onMember={(g,m,existing)=>write(async()=>{const body={endpointGroupId:g.id,...m};const result=await(existing?api.updateEndpointGroupMember(g.id,m.endpointId,body):api.createEndpointGroupMember(body));setCatalog(c=>({...c,members:[...c.members.filter(row=>!(row.endpointGroupId===g.id&&row.endpointId===m.endpointId)),result]}));})}
          onRemove={(g,m)=>write(async()=>{await api.removeEndpointGroupMember(g.id,m.endpointId);setCatalog(c=>({...c,members:c.members.map(row=>row.endpointGroupId===g.id&&row.endpointId===m.endpointId?{...row,active:false}:row)}));})}/>
        :<EndpointMapEditor map={map} zones={zones} rooms={rooms} endpoints={endpoints} endpoint={endpoint} setEndpoint={setEndpoint} drawing={drawing} setDrawing={setDrawing} busy={busy} hasUnsavedChanges={endpointStateDirty} onToggleActive={toggleEndpointActive} onSave={()=>write(async()=>{const result=await saveValidatedEndpoint(api,endpoint,map,zones,rooms);upsert('endpoints','endpointId',result);setEndpoint({...result});setDrawing(false);}).catch(()=>{})}/>}
        {endpointTab==='group'&&<p className="ls-hint">Nhóm điểm giúp sắp xếp thứ tự và chọn điểm đích khi thiết lập quy trình.</p>}
      </>}
      {stage==='endpoint'&&<section className="ls-panel ep-publish" aria-label="Hoàn tất bản đồ">
        <div><h3>{map.status==='ACTIVE'?'Bản đồ đã kích hoạt':'Đưa bản đồ vào sử dụng'} <span className={'ep-mode '+(map.status==='ACTIVE'?'ep-live':'')}>{({DRAFT:'Nháp',ACTIVE:'Đang hoạt động',INACTIVE:'Không hoạt động',ARCHIVED:'Lưu trữ'})[map.status]||map.status}</span></h3><p>{usable.length} điểm có thể chọn · {usable.filter(p=>p.publicVisible).length} điểm công khai</p>
          <p>Kích hoạt map chưa có nghĩa robot sẵn sàng chạy. Sang Điều phối để kiểm tra kết nối Pi, mở phiên, xác nhận vị trí và đồng bộ cấu hình.</p>
          {map.status!=='ACTIVE'&&map.status!=='ARCHIVED'&&<p>Kích hoạt để sử dụng trong Điều phối. Bản đồ đang hoạt động cùng tầng sẽ được thay thế.</p>}
          {dirty&&<p className="ls-error">Lưu hoặc bỏ thay đổi điểm đích trước khi hoàn tất.</p>}
        </div>
        <div className="ls-actions">
          {map.status!=='ACTIVE'&&<button type="button" className="ls-btn primary" disabled={busy||dirty||!usable.length||map.status==='ARCHIVED'||!mapVerified} onClick={activate}>Kích hoạt bản đồ</button>}
          {privatePoints.length>0&&<button type="button" className="ls-btn" disabled={busy||dirty||map.status==='ARCHIVED'} onClick={publishPoints}>Công khai {privatePoints.length} điểm đích</button>}
          <button type="button" className={'ls-btn '+(map.status==='ACTIVE'?'primary':'')} disabled={busy||dirty||map.status!=='ACTIVE'||!usable.length||!mapVerified} onClick={()=>navigate('/workstations?mapId='+encodeURIComponent(mapId))}>Mở Điều phối →</button>
        </div>
      </section>}
    </>}
  </div>;
}
