import { vi } from '../../i18n/vi.js';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LidarMap from '../Admin/LidarMap.jsx';
import '../Admin/MapStudioFigma.jsx';
import { loadDraft } from '../Admin/mapStudioModel.js';
import { TASK_NAMES } from '../Admin/MapFeatureProperties.jsx';
import { createDispatchPlan, samplePlan } from './mapDispatchModel.js';
import { injectStyles } from '../../styles/injectStyles.js';
import { groupsFor, SELECTION_POLICIES } from '../../features/facility/endpointGroups.js';
import { applyTrafficScenario, trafficState } from './trafficSimulation.js';
import TrafficScenarioControls from './TrafficScenarioControls.jsx';
import '../Admin/patrol.css';
const ThreePreview = lazy(() => import('../Admin/PatrolThreePreview.jsx'));

injectStyles('map-dispatch-linked',`
.ls-map-frame{background:#121416}
.map-dispatch .patrol-view-switch .ls-btn[aria-pressed=true]{background:#2671e8;color:white;border-color:#2671e8}.md-map>.patrol-view-heading{flex-shrink:0}.md-map>.patrol-three-scene{flex-shrink:0}
@media(min-width:1201px) and (min-height:650px){.md-map .ls-map-frame{flex:1;min-height:0;container-type:size;display:flex;align-items:center;justify-content:center}.md-map .ls-map-frame .ls-map-viewport{width:min(100%,calc(100cqh * 5 / 3));flex:none}}
.map-dispatch{margin-top:20px;min-height:0;min-width:0;overflow:auto;flex:1}.md-grid{display:grid;grid-template-columns:minmax(210px,260px) minmax(0,1fr);gap:16px;align-items:start}.md-map{min-width:0}.md-map .ls-map-foot{line-height:1.5}.md-controls{margin-top:12px;padding:16px;background:#fff;border:1px solid #dce5f0;border-radius:10px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.md-controls>div:first-child{flex:1;min-width:160px}.md-controls small{display:block}.md-steps{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.md-stop{display:flex;align-items:center;gap:6px;padding:8px;border:1px solid #dce5f0;border-radius:6px;margin-top:7px}.md-stop span{flex:1;overflow-wrap:anywhere}.md-log{max-height:160px;overflow:auto}.md-log p{margin:6px 0;color:#64748b;font-size:12px}.md-library{max-height:140px;overflow:auto}.md-notice{margin:0 0 12px;padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px}.md-run{color:#15803d}.md-grid .ls-panel{padding:14px}.map-dispatch select{width:100%;min-width:0}.ws-main--simulation:has(.map-dispatch){max-width:none;padding:24px;gap:0}.ws-main--simulation:has(.map-dispatch) .workflows-header{padding:0;margin:0}.ws-main--simulation:has(.map-dispatch) .workflows-header h1{margin-top:0}.ws-main--simulation:has(.map-dispatch) .workflows-header p{margin-bottom:0}
@media(min-width:1201px) and (min-height:650px){.map-dispatch{display:flex;flex-direction:column;overflow:hidden}.md-notice{flex-shrink:0}.md-grid{flex:1;min-height:0;align-items:stretch}.md-grid>aside{overflow-y:auto;min-height:0;padding-right:3px}.md-map{display:flex;flex-direction:column;min-height:0;gap:10px;overflow:auto}.md-map>.ls-map{flex:1;min-height:160px;display:flex;flex-direction:column}.md-map .ls-map-viewport{flex:none}.md-map .ls-map-head,.md-map .ls-map-layers,.md-map .ls-map-foot,.md-controls,.md-steps{flex-shrink:0}.md-controls,.md-steps{margin:0}.md-log{max-height:65px;flex-shrink:0}}
@media(max-width:1200px){.ws-screen:has(.map-dispatch){height:auto;overflow:visible}.md-grid{grid-template-columns:1fr}.md-grid>aside{display:grid;grid-template-columns:1fr 1fr;gap:12px}.md-map .ls-map-viewport{max-height:none}.map-dispatch{overflow:visible}.ws-main--simulation:has(.map-dispatch){height:auto;overflow:visible}}
@media(max-width:580px){.md-grid>aside{grid-template-columns:1fr}.ws-main--simulation:has(.map-dispatch){padding:16px}.md-controls{padding:12px}.md-controls .ls-actions{width:100%}}
.ws-main--simulation:has(.map-dispatch) .workflow-tabs{margin-top:14px}.ws-main--simulation:has(.map-dispatch) .preview-note{margin-top:10px}.map-dispatch{margin-top:12px}
`);
const fallback=[{workflowId:'local-route',name:'Đi qua các điểm đã chọn',workflowCode:'LOCAL_ROUTE'}];
const clock=s=>Math.floor(s/60).toString().padStart(2,'0')+':'+Math.floor(s%60).toString().padStart(2,'0');
const BINDINGS_KEY='mediassist.dispatch.bindings.v1';
const workflowKey=w=>String(w.workflowId||w.id||w.workflowCode);
function bindings(){try{return JSON.parse(localStorage.getItem(BINDINGS_KEY)||'{}')||{};}catch{return {};}}
const Button=({children,...props})=><button type="button" className="ls-btn" {...props}>{vi(children)}</button>;
function read(){return loadDraft(window.localStorage);}
export default function MapDispatch({definitions=[],loading,error}){
  const navigate=useNavigate();
  const [draft,setDraft]=useState(read),[map,setMap]=useState(()=>read().saved?.snapshot||null);
  const [workflow,setWorkflow]=useState(''),[start,setStart]=useState(''),[next,setNext]=useState(''),[stops,setStops]=useState([]);
  const [plan,setPlan]=useState(null),[elapsed,setElapsed]=useState(0),[state,setState]=useState('ready'),[speed,setSpeed]=useState(1),[message,setMessage]=useState('');
  const [history,setHistory]=useState([]);
  const [viewMode,setViewMode]=useState('2d');
  const [scenario,setScenario]=useState({}),[visits,setVisits]=useState({});
  const counted=useRef(new Set());
  const workflows=definitions.length?definitions:fallback;
  const active=state==='running'||state==='paused';
  useEffect(()=>{const refresh=()=>setDraft(read());window.addEventListener('storage',refresh);window.addEventListener('mediassist-map-saved',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('mediassist-map-saved',refresh);};},[]);
  useEffect(()=>{if(!active&&!workflows.some(w=>workflowKey(w)===workflow))setWorkflow(workflowKey(workflows[0]));},[workflows,workflow,active]);
  useEffect(()=>{
    if(!map||!workflow)return;
    const saved=bindings()[workflow];
    const compatible=saved?.mapRevision===map.revision&&saved?.mapName===map.name;
    setStart(compatible?saved.start:map.endpoints.find(e=>e.enabled!==false&&e.type==='PARK')?.id||map.endpoints.find(e=>e.enabled!==false)?.id||'');
    setStops(compatible&&Array.isArray(saved.stops)?saved.stops:[]);
    setNext('');setPlan(null);setElapsed(0);setState('ready');
    setMessage(compatible?'Đã nạp ánh xạ điểm dừng đã lưu cho quy trình này.':saved?'Bản đồ đã thay đổi. Hãy kiểm tra và lưu lại ánh xạ điểm dừng.':'');
  },[map,workflow]);
  useEffect(()=>{if(state!=='running'||!plan)return;let frame,previous=performance.now();const tick=now=>{const delta=(now-previous)/1000;previous=now;setElapsed(t=>Math.min(plan.duration,t+delta*speed));frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[state,plan,speed]);
  useEffect(()=>{if(state==='running'&&plan&&elapsed>=plan.duration){setState(plan.outcome==='blocked'?'blocked':'done');setHistory(h=>[new Date().toLocaleTimeString('vi-VN')+' · '+(plan.blocked||'Hoàn tất '+plan.resolved.map(e=>e.name).join(' → ')),...h].slice(0,20));}},[elapsed,state,plan]);
  useEffect(()=>{if(state!=='running'||!plan)return;const completed=plan.resolved.filter((e,i)=>{if(e.at>elapsed||counted.current.has(i))return false;counted.current.add(i);return true;});if(completed.length)setVisits(old=>{const next={...old};for(const e of completed)next[e.id]=(next[e.id]||0)+1;return next;});},[elapsed,state,plan]);
  const sample=useMemo(()=>plan?samplePlan(plan,elapsed):null,[plan,elapsed]);
  const traffic=useMemo(()=>plan?trafficState(map,plan,elapsed):null,[map,plan,elapsed]);
  const threePlan=useMemo(()=>({path:plan?.path||[],points:(plan?.resolved||[]).map(stop=>({endpoint:map?.endpoints.find(point=>point.id===stop.id)}))}),[map,plan]);
  const endpoints=map?.endpoints.filter(e=>e.enabled!==false)||[];
  const groups=map?groupsFor(map).filter(g=>g.active!==false&&g.members.some(m=>m.active!==false&&endpoints.some(e=>e.id===m.endpointId&&e.accessible!==false))):[];
  const currentWorkflow=workflows.find(w=>String(w.workflowId||w.id||w.workflowCode)===workflow);
  const reset=()=>{setPlan(null);setElapsed(0);setState('ready');setMessage('');counted.current=new Set();};
  const reload=()=>{setMap(draft.saved?.snapshot||null);setStart('');setStops([]);setNext('');setScenario({});setVisits({});reset();};
  const build=()=>{try{const result=applyTrafficScenario(map,createDispatchPlan(map,start,stops,{visits}),scenario);counted.current=new Set();setPlan(result);setElapsed(0);setState('ready');setMessage(['Tuyến hợp lệ: đã kiểm tra tường, vùng cấm, hướng đi và điểm dừng.',...result.notes].join(' '));return result;}catch(e){setMessage(e.message);setPlan(null);return null;}};
  const saveBinding=()=>{if(!build())return;try{localStorage.setItem(BINDINGS_KEY,JSON.stringify({...bindings(),[workflow]:{mapRevision:map.revision,mapName:map.name,start,stops}}));setMessage('Đã lưu ánh xạ bản đồ và điểm dừng cho quy trình này trên trình duyệt.');}catch{setMessage('Trình duyệt không cho lưu ánh xạ. Bạn vẫn có thể chạy mô phỏng trong phiên này.');}};
  if(!map)return <section className="ls-studio map-dispatch"><div className="ls-panel"><h2>{vi("Chưa có bản đồ đã lưu")}</h2><p>{vi("Hoàn tất Quét → Phân vùng → Điểm đích và lưu cấu hình trong Bản đồ. Điều phối sẽ dùng đúng bản đồ đó, không thay bằng ảnh minh họa.")}</p><Button onClick={()=>navigate('/admin/map')}>{vi("Mở Bản đồ")}</Button>{vi(draft.saved&&<Button onClick={reload}>{vi("Nạp bản đồ đã lưu")}</Button>)}</div></section>;
  return <section className="ls-studio map-dispatch">
    <div className="md-notice"><strong>Mô phỏng cục bộ · {vi(map.name)} · bản {map.revision}</strong><br/>Dùng vùng và nhóm điểm đã lưu. Chi phí hướng 1 chặn chiều đi; thử chờ/nhường vùng trong “Tình huống thử nghiệm”. Không gửi lệnh đến robot thật.{vi(draft.revision!==map.revision&&<p>{vi(draft.saved?.revision!==map.revision?'Có bản đã lưu mới.':'Bản nháp đã thay đổi, cần lưu trong Bản đồ để áp dụng.')} <Button disabled={active||draft.saved?.revision===map.revision} onClick={reload}>{vi("Nạp bản đã lưu mới")}</Button></p>)}
    </div>
    <div className="md-grid"><aside><section className="ls-panel"><h3>{vi("Quy trình & điểm dừng")}</h3>
      {message&&<p className="ls-notice" role="status">{vi(message)}</p>}
      <label className="ls-field">{vi("Quy trình")}<select aria-label="Quy trình" disabled={active} value={workflow} onChange={e=>{setWorkflow(e.target.value);reset();}}>{vi(workflows.map(w=>{const id=String(w.workflowId||w.id||w.workflowCode);return<option key={id} value={id}>{vi(w.name||w.workflowName||w.workflowCode)}</option>;}))}</select></label>
      <p>{vi(definitions.length?'Định nghĩa từ API; bên dưới là ánh xạ điểm để mô phỏng, không thực thi toàn bộ đồ thị quy trình của BE.':loading?'Đang tải danh sách quy trình…':'API chưa có dữ liệu. Đang dùng quy trình tuyến cục bộ.')}</p>
      {error&&<p role="status">Không tải được danh sách quy trình từ máy chủ. Bạn vẫn có thể thử tuyến mô phỏng cục bộ.</p>}
      <label className="ls-field">{vi("Điểm xuất phát")}<select aria-label="Điểm xuất phát" disabled={active} value={start} onChange={e=>{setStart(e.target.value);reset();}}><option value="">{vi("Chọn điểm xuất phát")}</option>{vi(endpoints.map(e=><option value={e.id} key={e.id}>{vi(e.name)}</option>))}</select></label>
      <label className="ls-field">{vi("Điểm tiếp theo")}<select aria-label="Điểm tiếp theo" disabled={active} value={next} onChange={e=>setNext(e.target.value)}><option value="">{vi("Chọn điểm hoặc nhóm")}</option>{vi(endpoints.map(e=><option value={e.id} key={e.id}>{vi(e.name)}{vi(e.occupancy==='BUSY'?' · đang bận':'')}</option>))}{vi(groups.map(g=><option key={g.id} value={'group:'+g.id}>Nhóm: {g.name} · {SELECTION_POLICIES[g.selectionPolicy]}</option>))}</select></label>
      <Button disabled={active||!next||stops.length>=12} onClick={()=>{setStops(s=>[...s,next]);setNext('');reset();}}>{vi("+ Thêm điểm dừng")}</Button>
      {vi(stops.map((id,i)=><div className="md-stop" key={i}><span>{vi(i+1)}{". "}{vi(id.startsWith('group:')?'Nhóm: '+(groups.find(g=>g.id===id.slice(6))?.name||'không còn khả dụng'):endpoints.find(e=>e.id===id)?.name||'Điểm không tồn tại')}</span><Button disabled={active||i===0} aria-label={vi('Đưa điểm '+(i+1)+' lên')} onClick={()=>{setStops(s=>{const a=[...s];[a[i-1],a[i]]=[a[i],a[i-1]];return a;});reset();}}>{vi("↑")}</Button><Button disabled={active} aria-label={vi('Xóa điểm dừng '+(i+1))} onClick={()=>{setStops(s=>s.filter((_,n)=>n!==i));reset();}}>{vi("×")}</Button></div>))}
      <div className="ls-actions"><Button disabled={active||!stops.length} onClick={build}>{vi("Kiểm tra tuyến")}</Button><Button disabled={active} onClick={()=>navigate('/admin/map')}>{vi("Sửa bản đồ")}</Button></div>
      <Button disabled={active||!stops.length||!start} onClick={saveBinding}>Lưu ánh xạ quy trình</Button>
      {plan&&<div className="md-steps">{plan.resolved.map((e,i)=><span key={i} className="ls-badge">{elapsed>=e.at?'✓':'○'} {e.name}</span>)}</div>}
      {plan?.selections?.map((choice,i)=><p key={i} data-testid="group-choice"><strong>{choice.groupName} → {choice.endpointName}</strong><br/>{SELECTION_POLICIES[choice.policy]}{choice.attempts.map(a=><small key={a.id} style={{display:'block'}}>Bỏ qua {a.name}: {a.reason}</small>)}</p>)}
    </section><TrafficScenarioControls map={map} value={scenario} disabled={active} onChange={value=>{setScenario(value);reset();}}/><section className="ls-panel" style={{marginTop:12}}><h3>{vi("Cấu hình đang áp dụng")}</h3><p>{vi(map.zones.filter(z=>z.enabled!==false).length)}{" vùng hoạt động · "}{vi(endpoints.length)}{" điểm đích"}</p><div className="md-library">{vi(map.zones.filter(z=>z.enabled!==false).map(z=><p key={z.id}>{"● "}{vi(z.name)}{vi(z.type==='SPEED'?' · '+z.speed+' m/s':'')}</p>))}</div><p>Nhóm chọn một điểm, không chạy lần lượt tất cả thành viên. Thử điểm kế tiếp được kiểm tra trước khi chạy, chưa phải chuyển điểm theo lỗi cảm biến thời gian thực.</p><details><summary>Lượt phục vụ trong phiên</summary><div data-testid="endpoint-visits">{endpoints.map(e=><p key={e.id}>{e.name}: {visits[e.id]||0}</p>)}</div><p>Chỉ tính khi robot hoàn tất phục vụ tại điểm; kiểm tra tuyến và tạm dừng không tăng lượt. Tải lại trang bắt đầu phiên mới.</p></details></section></aside>
      <div className="md-map"><div className="patrol-view-heading"><strong>Hành trình điều phối</strong><div className="patrol-view-switch" role="group" aria-label="Chế độ xem điều phối"><Button aria-pressed={viewMode==='2d'} onClick={()=>setViewMode('2d')}>Bản đồ 2D</Button><Button aria-pressed={viewMode==='3d'} onClick={()=>setViewMode('3d')}>Mô phỏng 3D</Button></div></div>
        {viewMode==='3d'?<><Suspense fallback={<p role="status">Đang tải mô hình 3D…</p>}><ThreePreview map={map} plan={threePlan} position={sample?.point||endpoints.find(e=>e.id===start)} actors={traffic?.actors||[]}/></Suspense><small>Cùng tuyến và thời gian với bản đồ 2D · Kéo để xoay, cuộn để phóng to · Mô phỏng trên trình duyệt.</small></>:<LidarMap draft={map} stage="endpoint" artifactPreview simulation={{path:plan?.path||[],point:sample?.point||endpoints.find(e=>e.id===start),actors:traffic?.actors||[]}}/>}
        <div className="md-controls" data-testid="dispatch-clock" data-elapsed={elapsed}><div><strong className={state==='done'?'md-run':''}>{vi(state==='running'?'Đang mô phỏng':state==='paused'?'Đã tạm dừng':state==='done'?'Hoàn tất mô phỏng':state==='blocked'?'Đã dừng: hết thời gian chờ':'Sẵn sàng điều phối')}</strong><small>{vi(sample?TASK_NAMES[sample.action]||sample.label:currentWorkflow?.name||currentWorkflow?.workflowName||'Chọn quy trình và các điểm dừng')}</small><small>{vi(plan?plan.distance.toFixed(1)+' m · '+clock(elapsed)+' / '+clock(plan.duration)+' · '+(sample?.speed||0).toFixed(2)+' m/s':'')}</small></div>
          <div className="ls-actions" role="group" aria-label={vi("Tốc độ mô phỏng")}>{vi([1,2,3,5].map(s=><button key={s} type="button" className={'ls-btn '+(speed===s?'primary':'')} aria-pressed={speed===s} onClick={()=>setSpeed(s)}>{vi(s)}{vi("×")}</button>))}</div>
          <Button onClick={reset}>{vi("Đặt lại")}</Button><button className="ls-btn primary" type="button" disabled={!stops.length||!start} onClick={()=>{if(state==='running'){setState('paused');return;}if(state==='paused'){setState('running');return;}const result=build();if(result)setState('running');}}>{vi(state==='running'?'Tạm dừng':state==='paused'?'Tiếp tục':state==='done'?'Chạy lại':'Chạy mô phỏng')}</button>
        </div>
        {traffic&&(traffic.occupancy.length>0||traffic.events.length>0)&&<section className="ls-panel md-log" style={{maxHeight:100}} aria-label="Nhật ký giao thông"><div className="md-steps">{traffic.occupancy.map(z=><span className="ls-badge" key={z.id} data-testid={'occupancy-'+z.id}>{z.name}: {z.count} robot</span>)}</div>{traffic.events.slice(-8).map((event,i)=><p key={i}>{clock(event.at)} · {event.text}</p>)}</section>}
        {vi(history.length>0&&<section className="ls-panel md-log"><h3>{vi("Lịch sử mô phỏng phiên này")}</h3>{vi(history.map((h,i)=><p key={i}>{vi(h)}</p>))}</section>)}
      </div>
    </div>
  </section>;
}
