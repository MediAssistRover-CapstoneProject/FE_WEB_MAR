import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { facilityApi, allFacilityPages } from '../../features/facility/facilityApi.js';
import { apiRequest, API_BASE_URL } from '../../features/api/client.js';
import { dispatchMaps, dispatchEndpoints } from '../../features/facility/mapPublishing.js';
import FacilityGeometryPreview from '../Admin/FacilityGeometryPreview.jsx';
import RobotConsole from '../Admin/robotOperations/RobotConsole.jsx';
import { isOperator } from '../../features/robotOperations/model.js';
import { getSession } from '../../features/auth/session.js';
import { navigationPendingScopes, navigationScopeBlock, navigationStorageKey } from '../../features/robotOperations/navigationScope.js';

export default function ServerDispatch() {
  const navigate=useNavigate(),[params]=useSearchParams();
  const [catalog,setCatalog]=useState({maps:[],endpoints:[],zones:[],robots:[]});
  const [mapId,setMapId]=useState(params.get('mapId')||''),[robotId,setRobotId]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[consoleScope,setConsoleScope]=useState(null);
  const [consoleState,setConsoleState]=useState(null),[now,setNow]=useState(Date.now);
  const [opening,setOpening]=useState(false),[openError,setOpenError]=useState(''),[sessionConflict,setSessionConflict]=useState(null);
  const openLock=useRef(false),openRequest=useRef(null);
  const operator=isOperator(getSession());
  useEffect(()=>{let active=true;setLoading(true);setError('');
    Promise.all([allFacilityPages(facilityApi.listMaps),allFacilityPages(facilityApi.listEndpoints),allFacilityPages(facilityApi.listZones),allFacilityPages(p=>apiRequest('/api/v1/robots?'+new URLSearchParams(p)))]).then(([maps,endpoints,zones,robots])=>{
      if(!active)return;const available=dispatchMaps(maps);setCatalog({maps,endpoints,zones,robots});setMapId(id=>maps.some(m=>m.mapId===id)?id:available[0]?.mapId||'');
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[revision]);
  useEffect(()=>{const reload=()=>setRevision(v=>v+1);window.addEventListener('mediassist-facility-updated',reload);window.addEventListener('focus',reload);return()=>{window.removeEventListener('mediassist-facility-updated',reload);window.removeEventListener('focus',reload);};},[]);
  useEffect(()=>{if(!consoleScope)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[consoleScope]);
  useEffect(()=>()=>openRequest.current?.abort(),[]);
  const map=catalog.maps.find(m=>m.mapId===mapId),points=dispatchEndpoints(catalog.endpoints,mapId);
  const storedScopes=navigationPendingScopes(sessionStorage,navigationStorageKey(API_BASE_URL,getSession()?.account));
  const scopeBlock=navigationScopeBlock(consoleScope,consoleState,Math.max(now,Date.now()));
  const changeScope=()=>{if(navigationScopeBlock(consoleScope,consoleState))return;setConsoleScope(null);setConsoleState(null);setRevision(v=>v+1);};
  const openConsole=async(scope)=>{
    if(openLock.current||consoleScope||!isOperator(getSession()))return;
    openLock.current=true;setOpening(true);setOpenError('');setSessionConflict(null);
    const controller=new AbortController();openRequest.current=controller;
    try{
      const value=await apiRequest('/api/v1/robots/'+encodeURIComponent(scope.robotId)+'/snapshot',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
      if(controller.signal.aborted)return;
      if(value.robot?.robotId!==scope.robotId)throw Error('Máy chủ trả trạng thái của robot khác.');
      const session=value.navigationSession;
      if(session?.mapId&&session.mapId!==scope.mapId&&['WAITING_FOR_PI','LOCALIZING','READY'].includes(session.state)&&Date.parse(session.expiresAt)>Date.now()){
        setSessionConflict({mapId:session.mapId,robotId:scope.robotId});
        setOpenError('Robot đang có phiên trên bản đồ khác. Mở lại phiên đó để theo dõi hoặc đóng phiên trước khi đổi bản đồ.');return;
      }
      setMapId(scope.mapId);setRobotId(scope.robotId);setConsoleState(null);setNow(Date.now());setConsoleScope({mapId:scope.mapId,robotId:scope.robotId});
    }catch(error){if(!controller.signal.aborted)setOpenError('Chưa kiểm tra được phiên robot: '+error.message);}
    finally{openLock.current=false;if(!controller.signal.aborted)setOpening(false);}
  };
  return <section className="ls-studio server-dispatch" style={{display:'grid',gap:16,marginTop:16}} aria-label="Điều phối từ bản đồ máy chủ">
    <section className="ls-panel"><div className="ls-actions"><strong>Thiết lập bản đồ và robot</strong><button className="ls-btn" disabled={loading||!!consoleScope} onClick={()=>setRevision(v=>v+1)}>Tải lại danh sách</button></div><p>Chọn bản đồ và robot. Mở phiên, sao chép lệnh chạy Pi rồi chọn vị trí khởi tạo ở bước tiếp theo.</p>
      {loading&&<p role="status">Đang tải dữ liệu BE…</p>}{error&&<p className="ls-error" role="alert">Không tải được danh mục: {error}</p>}
      {!loading&&!error&&!catalog.maps.length&&<p role="status">Chưa có bản đồ đang hoạt động. Mở Bản đồ → Điểm đích → Hoàn tất & kích hoạt bản đồ.</p>}
      <div className="ep-coordinate-fields"><label className="ls-field">Bản đồ trong database<select aria-label="Bản đồ trong database" value={mapId} disabled={loading||opening||!!consoleScope} onChange={e=>{setMapId(e.target.value);setOpenError('');setSessionConflict(null);}}><option value="">Chọn bản đồ</option>{catalog.maps.map(m=><option key={m.mapId} value={m.mapId}>{m.mapName} · v{m.versionNo} · {({DRAFT:'Nháp',ACTIVE:'Đang hoạt động',INACTIVE:'Không hoạt động',ARCHIVED:'Lưu trữ'})[m.status]||m.status}</option>)}</select></label>
      <label className="ls-field">Robot<select aria-label="Robot điều phối" value={robotId} disabled={loading||opening||!!consoleScope} onChange={e=>{setRobotId(e.target.value);setOpenError('');setSessionConflict(null);}}><option value="">Chọn robot</option>{catalog.robots.map(r=><option key={r.robotId} value={r.robotId}>{r.robotName||r.robotCode||r.robotId} · {r.status}</option>)}</select></label></div>
      {!operator&&<p className="ls-error">Đăng nhập ADMIN thật để gửi yêu cầu điều phối robot.</p>}
      <div className="ls-actions"><button className="ls-btn" disabled={opening||!!consoleScope&&!!scopeBlock} title={consoleScope?scopeBlock:undefined} onClick={()=>navigate('/admin/map'+(mapId?'?mapId='+encodeURIComponent(mapId):''))}>Mở Bản đồ</button>{consoleScope?<button className="ls-btn" disabled={!!scopeBlock} title={scopeBlock||'Trở về lựa chọn robot và bản đồ'} onClick={changeScope}>Đổi robot hoặc bản đồ</button>:<button className="ls-btn primary" disabled={loading||opening||!operator||!map||!robotId||map.status!=='ACTIVE'} onClick={()=>openConsole({mapId,robotId})}>{opening?'Đang kiểm tra phiên…':'Mở điều phối robot'}</button>}</div>
      {openError&&<p className="ls-error" role="alert">{openError}</p>}
      {sessionConflict&&!consoleScope&&<button className="ls-btn" disabled={opening||loading||!catalog.maps.some(m=>m.mapId===sessionConflict.mapId)} onClick={()=>openConsole(sessionConflict)}>Xem phiên trên bản đồ đang dùng</button>}
      {!consoleScope&&storedScopes.length>0&&<section className="ls-panel" aria-label="Yêu cầu điều phối trước"><strong>Yêu cầu trước đang chờ đối chiếu</strong><p>Mở lại đúng robot và bản đồ để đọc kết quả. Thao tác này không gửi lại lệnh chạy.</p><div className="ls-actions">{storedScopes.map(scope=><button key={scope.key} className="ls-btn" disabled={opening||loading||!operator||!catalog.maps.some(m=>m.mapId===scope.mapId)||!catalog.robots.some(r=>r.robotId===scope.robotId)} onClick={()=>openConsole(scope)}>Theo dõi {catalog.robots.find(r=>r.robotId===scope.robotId)?.robotName||scope.robotId.slice(-6)} · {catalog.maps.find(m=>m.mapId===scope.mapId)?.mapName||scope.mapId.slice(-6)}</button>)}</div></section>}
      {consoleScope&&<p className="ro-muted" role="status">{scopeBlock||'Phiên đã đóng. Có thể đổi robot, bản đồ hoặc mở phần quản lý bản đồ.'}</p>}
      {map&&!points.length&&<p>Map này chưa có điểm đang hoạt động và có thể tiếp cận. Kiểm tra cấu hình điểm đích trong Bản đồ.</p>}
    </section>
    {map&&map.status!=='ACTIVE'&&<p className="ls-error">Bản đồ này chưa hoạt động. Bạn vẫn xem được map và điểm đích; mở Bản đồ để kích hoạt trước khi điều phối.</p>}
    {map&&!consoleScope&&<section className="ls-panel"><h3>{map.mapName} · {points.length} điểm khả dụng</h3><FacilityGeometryPreview key={mapId} map={map} zones={catalog.zones.filter(z=>z.mapId===mapId)} endpoints={points}/></section>}
    {consoleScope&&<RobotConsole navigationOnly {...consoleScope} onNavigationState={setConsoleState}/>}
  </section>;
}
