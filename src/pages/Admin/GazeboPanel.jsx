import GazeboDesktop from './GazeboDesktop.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import PatrolThreePreview from './PatrolThreePreview.jsx';
import LidarMap from './LidarMap.jsx';
import { apiRequest } from '../../features/api/client.js';
import { getSession } from '../../features/auth/session.js';
import { localMockMap, isCurrentMap } from '../../features/maps/MapProvider.js';
import { fromRosPoint, routeRequest } from '../../features/gazebo/gazeboModel.js';
import './gazebo.css';
const labels={IDLE:'Sẵn sàng',STARTING:'Nav2 đang nhận mục tiêu',RUNNING:'Đang di chuyển',CANCELING:'Đang yêu cầu dừng',CANCELED:'Đã dừng',SUCCEEDED:'Đã đến tất cả điểm đích',FAILED:'Không hoàn thành'};
const activeStatuses=['STARTING','RUNNING','CANCELING'];
const emptyMap={name:'Bản đồ LiDAR local',zones:[],endpoints:[],scan:{status:'saved',progress:100}};
export default function GazeboPanel({map,plan,viewMode='gazebo'}) {
 const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(null);
 const run=useRef(''); const mounted=useRef(false);
 const admin=getSession()?.account?.role==='ADMIN' || getSession()?.user?.role==='ADMIN';
 const cancel=()=>run.current && apiRequest('/api/v1/simulation/commands',{method:'POST',body:{commandType:'CANCEL_PATROL',runId:run.current},keepalive:true,retry:false}).catch(()=>{});
 useEffect(()=>{
  mounted.current=true; let timer,stopped=false;const controller=new AbortController();
  async function poll(){
   try {
    const value=await apiRequest('/api/v1/simulation/state?runId='+encodeURIComponent(document.hidden?'':run.current),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3000)])});
    if(!stopped){setState(value);setError('');setPending(p=>p&&(value.runId===p.runId || value.lastAck?.correlationId===p.correlationId&&value.lastAck.accepted===false || Date.now()-p.at>7000)?null:p);}
   }catch(e){if(!stopped){setState(null);setError(e.message);}}
   finally {if(!stopped)timer=setTimeout(poll,700);}
  }
  const hide=()=>{if(document.hidden)cancel();};
  document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',cancel);poll();
  return()=>{mounted.current=false;stopped=true;clearTimeout(timer);controller.abort();cancel();document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',cancel);};
 },[]);
 const matches=state?.mapId===localMockMap.mapId&&state?.mapVersion===localMockMap.mapVersion;
 const connected=!!state?.connected&&matches;
 const pose=connected&&state.poseFresh?fromRosPoint(state.pose):null;
 const pathKey=JSON.stringify(connected?state?.path||[]:[]);
 const renderPlan=useMemo(()=>({points:plan?.points||[],path:JSON.parse(pathKey).map(fromRosPoint).filter(Boolean)}),[plan,pathKey]);
 const moving=!!pending||activeStatuses.includes(state?.status);
 const ready=connected&&state?.ready&&plan?.valid&&isCurrentMap(map)&&admin&&!moving&&!busy;
 const execute=async(commandType)=>{
  setBusy(true);setError('');
  try{
   const body=commandType==='START_PATROL'?routeRequest(plan):{commandType,runId:run.current};
   const receipt=await apiRequest('/api/v1/simulation/commands',{method:'POST',body,signal:AbortSignal.timeout(5000)});
   if(commandType==='START_PATROL'){run.current=receipt.runId;setPending({...receipt,at:Date.now()});if(!mounted.current)cancel();}
  }catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current)setBusy(false);}
 };
 const gui=import.meta.env.VITE_GAZEBO_GUI_URL||'http://localhost:6080/vnc.html?autoconnect=1&resize=scale';
 return <div className="gazebo-panel">
  <p className="patrol-notice">MOCK MAP · LiDAR {localMockMap.width} × {localMockMap.height} px · Vật cản cao 1 m là cấu hình mô phỏng được cho phép. Chuyển động lấy từ ROS 2 qua MQTT.</p>
  <div className="simulation-badges" role="status">{[['MQTT',state?.mqttConnected],['ROS 2',connected&&state?.rosConnected],['Gazebo simulation',connected&&state?.simulationActive],['Nav2',connected&&state?.ready]].map(([name,ok])=><span key={name} className={ok?'is-ready':''}>{name}: {ok?'Đã kết nối':'Chưa sẵn sàng'}</span>)}</div>
  {error&&<p role="alert" className="patrol-notice is-error">{error}</p>}
  {!admin&&<p className="patrol-notice">Cần đăng nhập tài khoản ADMIN để chạy robot mô phỏng.</p>}
  {state?.connected&&!matches&&<p role="alert">Map trên BE/Gazebo khác phiên bản FE. Hãy tạo lại gói map và khởi động lại mô phỏng.</p>}
  {!!plan?.issues?.length&&<ul className="patrol-notice is-error">{plan.issues.map(x=><li key={x}>{x}</li>)}</ul>}
  <div className="patrol-readiness"><strong>{pending?'BE đã nhận yêu cầu; chờ phản hồi MQTT/Nav2':labels[state?.status]||'Đang chờ bộ mô phỏng'}</strong><span>{state?.reason||state?.message}</span>{state?.lastAck?.accepted===false&&<span role="alert">Adapter từ chối: {state.lastAck.error}</span>}{state?.publishError&&<span role="alert">{state.publishError}</span>}</div>
  {viewMode==='gazebo' ? <GazeboDesktop canStop={!!run.current&&moving&&!busy} onStop={()=>execute('CANCEL_PATROL')}/> : viewMode==='3d' ? <PatrolThreePreview map={map||emptyMap} plan={renderPlan} position={pose}/> : <LidarMap draft={map||emptyMap} stage="endpoint" artifactPreview simulation={{path:renderPlan.path,point:pose}}/>}
  <div className="patrol-simulation-summary"><div><small>Vị trí ROS (m)</small><strong>{pose?state.pose.x.toFixed(2)+', '+state.pose.y.toFixed(2):'Chưa có dữ liệu mới'}</strong></div><div><small>Điểm hoàn thành</small><strong>{state?.completed||0}/{state?.total||0}</strong></div><div><small>Điểm đang đến</small><strong>{state?.targetName||'—'}</strong></div></div>
  <div className="patrol-actions"><button className="patrol-primary" disabled={!ready} onClick={()=>execute('START_PATROL')}>Chạy quy trình trong Gazebo</button><button disabled={!run.current||!moving||busy} onClick={()=>execute('CANCEL_PATROL')}>Dừng hành trình</button></div>
  <p className="patrol-map-note">Xuất phát tại vị trí định vị thật trong Gazebo. Nav2 tính đường đến từng MOVE; nét đường chỉ hiện khi ROS gửi về. Rời trang hoặc mất kết nối sẽ yêu cầu hủy. Vùng vẽ trên web chưa được đưa vào costmap Nav2.</p>
 </div>;
}
