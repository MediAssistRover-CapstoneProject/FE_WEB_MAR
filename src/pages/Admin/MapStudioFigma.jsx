import { vi } from '../../i18n/vi.js';
import { cloneElement, useEffect, useId, useRef, useState } from 'react';
import { injectStyles } from '../../styles/injectStyles.js';
import LidarMap from './LidarMap.jsx';
import { downloadGazeboMap } from '../../features/gazebo/gazeboModel.js';
import WorkspaceTabs from '../../components/WorkspaceTabs.jsx';
import EndpointGroupEditor from './EndpointGroupEditor.jsx';
import { groupsFor } from '../../features/facility/endpointGroups.js';
import { useNavigate } from 'react-router-dom';
import { ZoneProperties, EndpointProperties, ZoneTypePicker } from './MapFeatureProperties.jsx';
import { MAP, SCAN_START } from './lidarGeometry.js';
import { STAGES, STORAGE_KEY, ZONE_TYPES, ENDPOINT_TYPES, ROBOT_SAFETY_GAP_METERS, createDraft, loadDraft, changeDraft, removeEndpoint, removeEndpointGroup, stageEnabled, validPoint, driveRobotStep, zoneError, endpointError, polygonArea, mapIssues, saveMap, exportMap } from './mapStudioModel.js';
import liveCamera from '../../assets/images/live-camera.png';

const styles = String.raw`
.ls-group-toolbar{display:flex;align-items:end;flex-wrap:wrap;gap:10px;margin:12px 0}.ls-group-toolbar .ls-field{flex:1;min-width:180px;margin:0}.ls-group-toolbar>.ls-btn{flex-shrink:0}
.ls-policy{padding:12px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;font-size:12px}.ls-policy strong{color:#1d4ed8}.ls-endpoint-row{display:flex;gap:8px;align-items:center}.ls-endpoint-row .ls-item{flex:1;min-width:0}.ls-endpoint-row .ls-btn{flex-shrink:0}
.workspace .content:has(.ls-studio){max-width:none;min-width:0;padding:20px 24px 28px}
.ls-studio{color:#172b4d;font:13px/1.5 Inter,Arial,sans-serif;min-width:0;--ls-line:#dce5f0;--ls-muted:#64748b}.ls-advanced{border-top:1px solid #dce5f0;margin-top:16px;padding-top:12px}.ls-advanced summary{cursor:pointer;font-weight:650}.ls-task{padding:10px;background:#f1f5f9;border-radius:8px;margin:8px 0}.ls-studio h4{margin:12px 0 4px}
.ls-studio *{box-sizing:border-box}.ls-studio h2,.ls-studio h3,.ls-studio p{margin:0}.ls-studio button,.ls-studio input,.ls-studio select{font:inherit}
.ls-group-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.ls-group-grid>form,.ls-group-grid>section{min-width:0}.ls-studio .ls-panel button.ls-btn.primary{background:#2f80ff;border-color:#2f80ff;color:white}.ls-studio .ls-panel button.ls-btn.primary:disabled{opacity:.5}@media(max-width:760px){.ls-group-grid{grid-template-columns:1fr}}
.ls-field textarea{width:100%;min-width:0;max-width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font:inherit;resize:vertical}.ls-field input[type=checkbox]{width:auto}.ls-studio .workspace-tabs{margin:0 0 18px}.ls-source{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.ls-source button[aria-pressed=true]{border-color:#2f80ff;color:#1d4ed8;background:#eff6ff}.facility-catalog{display:grid;gap:14px}.ls-main:has(.ls-group-area){position:static}.ls-group-area{display:grid;min-width:0}
.ls-studio button{transform:none;box-shadow:none}.ls-studio button:disabled{opacity:.45;cursor:not-allowed}.ls-studio button:focus-visible,.ls-studio [tabindex]:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}
.ls-endpoint-tabs{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:12px;margin-bottom:16px;border-bottom:1px solid var(--ls-line)}.ls-endpoint-tabs .ls-btn{min-width:145px}.ls-endpoint-tabs .ls-btn.active{background:#eaf2ff;border-color:#93c5fd;color:#1d4ed8}
.ls-studio .ls-notice{position:fixed;top:72px;right:24px;max-width:min(420px,calc(100vw - 32px));z-index:70;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px #172b4d1a}.ls-notice button{flex-shrink:0}
.ls-topline{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;color:var(--ls-muted);font-size:11px}.ls-badge{color:#1d4ed8;background:#eaf2ff;padding:3px 9px;border-radius:5px}
.ls-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;padding:6px;border:1px solid var(--ls-line);border-radius:11px;background:#fff;margin-bottom:18px}
.ls-nav button{display:flex;align-items:center;gap:12px;padding:12px 16px;color:#475569;background:#f8fafc;text-align:left}.ls-nav button b{display:grid;place-items:center;width:26px;height:26px;flex-shrink:0;border:1px solid #cbd5e1;border-radius:7px;font-size:12px}.ls-nav button[aria-current=step]{color:white;background:#2f80ff}.ls-nav button[aria-current=step] b{border-color:#ffffff55;background:#ffffff15}.ls-nav small{display:block;font-size:10px;opacity:.75;font-weight:400}
.ls-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}.ls-heading h2{font-size:23px;letter-spacing:-.5px}.ls-heading p{color:var(--ls-muted);margin-top:3px;font-size:12px}.ls-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
.ls-studio .ls-btn{background:#fff;border:1px solid #cbd5e1;color:#334155;padding:9px 12px;border-radius:7px;font-size:12px;font-weight:600;min-height:36px}.ls-studio .ls-btn:hover:not(:disabled){background:#eff6ff}.ls-studio .ls-btn.primary{background:#2f80ff;border-color:#2f80ff;color:white}.ls-studio .ls-btn.danger{background:#fff1f2;border-color:#fecdd3;color:#be123c;margin:0}.ls-studio .ls-btn.small{padding:4px 9px;min-height:29px;font-size:11px}.ls-studio .ls-btn.active{border-color:#2f80ff;color:#2563eb;background:#eff6ff}
.ls-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(275px,310px);gap:16px;align-items:start}.ls-main,.ls-inspector{display:grid;gap:14px;min-width:0}.ls-main{position:sticky;top:16px}.ls-panel{background:white;border:1px solid var(--ls-line);border-radius:11px;padding:17px;min-width:0}.ls-panel h3{font-size:13px;font-weight:700;margin-bottom:13px}.ls-panel p{color:var(--ls-muted);font-size:12px;margin:8px 0}.ls-panel .ls-actions{margin-top:12px}.ls-full{width:100%;margin-top:9px}
.ls-map{min-width:0;border:1px solid #28333f;border-radius:11px;overflow:hidden;background:#121416}.ls-map-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 16px;background:#1c2229;color:#e5eaf0}.ls-map-head strong,.ls-map-head small{display:block}.ls-map-head small{font-size:10px;color:#9aa8b6;margin-top:3px}.ls-map-tools{display:flex;flex-shrink:0;border:1px solid #465260;border-radius:6px;overflow:hidden}.ls-map-tools button{border-radius:0;background:#27313b;color:#e2e8f0;padding:5px 10px;font-size:12px}
.ls-map-layers{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 15px;color:#98a6b5;background:#161c22;border-top:1px solid #2b3540;border-bottom:1px solid #2b3540;font-size:10px}.ls-map-layers>span:nth-child(2){letter-spacing:1.1px;font-size:9px}.ls-live-dot{width:5px;height:5px;border-radius:50%;background:#69d2b8}.ls-map-layers label{display:flex;gap:5px;align-items:center;cursor:pointer}.ls-map-layers input{accent-color:#60a5fa;width:12px;height:12px;margin:0}.ls-map-layers small{margin-left:auto}
.ls-map-viewport{position:relative;aspect-ratio:5/3;min-width:0;background:#121416;overflow:hidden}.ls-map-viewport>svg{width:100%;height:100%;position:absolute;inset:0;display:block}.ls-map-foot{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 15px;background:#1c2229;border-top:1px solid #2b3540;color:#a7b4c2;font-size:10px}.ls-map-foot>span{display:flex;gap:6px;align-items:center}.ls-map-foot i{width:7px;height:7px;border:1px solid #778491;border-radius:1px;display:inline-block;margin-left:5px}
.ls-layout--scan{grid-template-columns:minmax(0,1fr) minmax(320px,350px)}.ls-camera{position:relative;overflow:hidden;aspect-ratio:16/9;border-radius:9px;background:#0f172a}.ls-camera img{display:block;width:100%;height:100%;object-fit:cover}.ls-camera:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,#0005,transparent 28%,transparent 68%,#0009)}.ls-camera-badge,.ls-camera-label{position:absolute;z-index:1;color:#fff}.ls-camera-badge{top:10px;left:10px;padding:4px 8px;border-radius:999px;background:#0f172acc;font-size:9px;font-weight:800;letter-spacing:.65px}.ls-camera-badge.live:before{content:"";display:inline-block;width:6px;height:6px;margin-right:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px #22c55e33}.ls-camera-label{left:11px;right:11px;bottom:9px;display:flex;justify-content:space-between;gap:10px;font-size:10px}.ls-camera-info{display:flex;justify-content:space-between;gap:10px;margin-top:9px;color:var(--ls-muted);font-size:10px}.ls-camera-info b{color:#334155}
.ls-drive-panel{text-align:center}.ls-drive-pad{display:grid;grid-template-columns:repeat(3,58px);grid-template-rows:repeat(3,50px);justify-content:center;gap:7px;margin:4px auto 12px}.ls-drive-key{display:grid;place-items:center;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#334155;font-size:20px;font-weight:800;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;transition:background .15s,border-color .15s,color .15s,transform .15s}.ls-drive-key:hover{border-color:#60a5fa;background:#eff6ff;color:#2563eb;transform:translateY(-1px)}.ls-drive-key.active{border-color:#2f80ff;background:#2f80ff;color:#fff;box-shadow:0 5px 12px #2f80ff33;transform:translateY(1px)}.ls-drive-key.stop{border-color:#fecaca;background:#fff1f2;color:#be123c;font-size:9px;letter-spacing:.4px}.ls-drive-key.stop.active{border-color:#e11d48;background:#e11d48;color:#fff}.ls-drive-up{grid-column:2}.ls-drive-left{grid-column:1;grid-row:2}.ls-drive-stop{grid-column:2;grid-row:2}.ls-drive-right{grid-column:3;grid-row:2}.ls-drive-down{grid-column:2;grid-row:3}.ls-drive-status{display:flex;align-items:center;justify-content:center;gap:7px;padding:8px 10px;border-radius:7px;background:#f8fafc;color:#64748b;font-size:10px}.ls-drive-status i{width:7px;height:7px;border-radius:50%;background:#94a3b8}.ls-drive-status.moving{color:#1d4ed8;background:#eff6ff}.ls-drive-status.moving i{background:#2f80ff}.ls-drive-help{margin:0 0 9px!important;color:#475569!important}.ls-safety-note{margin-top:10px!important;padding:9px 10px;border-radius:7px;background:#fffbeb;color:#92400e!important;text-align:left}
.ls-drive-status.collision{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;font-weight:700}.ls-drive-status.collision i{background:#ef4444;box-shadow:0 0 0 4px #ef444426}
.ls-notice{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e40af;padding:10px 13px;margin-bottom:14px;overflow-wrap:anywhere}.ls-hint{padding:10px 12px;background:#f1f5f9;border-radius:7px;color:#64748b;font-size:11px;margin-top:12px}.ls-toolhint{padding:11px 14px;background:#eaf2ff;border:1px solid #c4dcff;border-radius:8px;color:#1d4ed8;display:flex;justify-content:space-between;align-items:center;gap:10px}.ls-error{font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;padding:9px 11px;border-radius:7px;margin-top:12px}
.ls-stat{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:12px}.ls-stat span{color:var(--ls-muted)}.ls-stat b{text-align:right;overflow-wrap:anywhere}.ls-field{display:grid;gap:5px;font-size:11px;color:#475569;margin:11px 0}.ls-field input,.ls-field select{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:6px;padding:8px 9px;background:white;color:#172b4d}.ls-field input:focus,.ls-field select:focus{outline:2px solid #93c5fd;outline-offset:1px}.ls-field input[type=range]{padding:0;accent-color:#2f80ff}
.ls-item-list{display:grid;gap:6px;max-height:225px;overflow:auto}.ls-studio .ls-item{width:100%;display:flex;align-items:center;gap:10px;background:#f8fafc;color:#334155;border:1px solid transparent;border-radius:7px;padding:10px;text-align:left;font-size:12px;overflow-wrap:anywhere}.ls-studio .ls-item.selected{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}.ls-item>i{width:8px;height:8px;border-radius:2px;flex-shrink:0}.ls-item strong,.ls-item small{display:block}.ls-item small{color:var(--ls-muted);font-size:10px;margin-top:2px}.ls-item>span{min-width:0}.ls-confirm{padding:24px;border:1px solid #dce5f0;background:white;border-radius:12px;width:min(440px,calc(100vw - 32px));color:#172b4d;box-shadow:0 18px 60px #0f172a33}.ls-confirm::backdrop{background:#0f172a66}.ls-confirm p{margin:8px 0 18px;color:#64748b}
.ls-runbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.ls-runbar small{display:block;color:var(--ls-muted);font-size:11px;margin-top:3px}.ls-empty{padding:13px;border:1px dashed #cbd5e1;border-radius:7px;color:var(--ls-muted);font-size:11px}.ls-saved{color:#15803d}
@media(min-width:1800px){.ls-layout{grid-template-columns:minmax(0,1fr) 350px}.ls-layout--scan{grid-template-columns:minmax(0,1fr) 380px}}
@media(max-width:1100px){.ls-layout{grid-template-columns:minmax(0,1fr) 270px}.ls-layout--scan{grid-template-columns:minmax(0,1fr) 300px}.ls-nav small{display:none}.ls-nav button{padding:10px}.ls-drive-pad{grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,46px)}}
@media(max-width:900px){.ls-layout{grid-template-columns:1fr}.ls-main{position:static}.ls-inspector{grid-template-columns:repeat(2,minmax(0,1fr))}.workspace .content:has(.ls-studio){padding:16px}}
@media(max-width:550px){.ls-inspector{grid-template-columns:1fr}.ls-nav button{gap:6px;font-size:11px;padding:8px 5px}.ls-nav button b{width:20px;height:20px;font-size:10px}.ls-heading h2{font-size:20px}.ls-map-head{padding:11px}.ls-map-head strong{font-size:12px}.ls-panel{padding:14px}.ls-map-layers{gap:7px}.ls-topline{font-size:10px}}
`;
injectStyles('mediassist-map-studio-lidar-v3', styles);

function Button({children,tone='',className='',...props}) { return <button type="button" {...props} className={'ls-btn '+tone+' '+className}>{vi(children)}</button>; }
function Panel({title,children}) { return <section className="ls-panel"><h3>{vi(title)}</h3>{vi(children)}</section>; }
function Stat({label,children}) { return <div className="ls-stat"><span>{vi(label)}</span><b>{vi(children)}</b></div>; }
function Field({label,children,...props}) { const id=useId();return <label className="ls-field"><span id={id}>{vi(label)}</span>{vi(children?cloneElement(children,{'aria-labelledby':id}):<input {...props} aria-labelledby={id}/>)}</label>; }
const emptyZone=()=>({id:'',name:'',description:'',enabled:true,type:'KEEP_OUT',speed:0.3,points:[]});
const emptyEndpoint=()=>({id:'',name:'',description:'',type:'WAYPOINT',x:580,y:330,enabled:true,placed:false});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const DRIVE_LABELS={forward:'Tiến',left:'Quay trái',right:'Quay phải'};
export default function MapStudioFigma({initialStage='scan'}) {
  return <SimulatedMapStudio initialStage={initialStage}/>;
}
function SimulatedMapStudio({initialStage='scan'}) {
  const goTo=useNavigate();
  const [draft,setDraft]=useState(()=>loadDraft(window.localStorage));
  const [endpointTab,setEndpointTab]=useState('points');
  const [groupDirty,setGroupDirty]=useState(false);
  const [stage,setStage]=useState(()=>stageEnabled(draft,initialStage)?initialStage:'scan');
  const [zone,setZone]=useState(emptyZone),[endpoint,setEndpoint]=useState(emptyEndpoint);
  const [tool,setTool]=useState(''),[rectangleStart,setRectangleStart]=useState(null),[hover,setHover]=useState(null);
  const [notice,setNotice]=useState(''),[storageError,setStorageError]=useState(false),[confirm,setConfirm]=useState(null);
  const [driveDirection,setDriveDirection]=useState('');
  const [collisionWarning,setCollisionWarning]=useState(false);
  const draftRef=useRef(draft);
  const confirmRef=useRef(null);
  draftRef.current=draft;
  const index=STAGES.findIndex(([id])=>id===stage);
  const zoneType=ZONE_TYPES.find(t=>t.id===zone.type);
  const zoneOriginal=draft.zones.find(z=>z.id===zone.id);
  const endpointOriginal=draft.endpoints.find(e=>e.id===endpoint.id);
  const zoneDirty=zone.points.length>0 && (!zoneOriginal || !same(zone,zoneOriginal));
  const endpointValue=(({placed,...value})=>value)(endpoint);
  const endpointDirty=endpoint.placed && (!endpointOriginal || !same(endpointValue,endpointOriginal));
  const unsaved=stage==='zone'?zoneDirty:stage==='endpoint'?(endpointTab==='groups'?groupDirty:endpointDirty):false;
  const issues=mapIssues(draft);
  const saved=draft.saved?.revision===draft.revision;
  const zoneProblem=zone.points.length?zoneError(draft,zone):'';
  const endpointProblem=endpoint.placed?endpointError(draft,endpointValue):'';
  useEffect(()=>{try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(draft));window.dispatchEvent(new Event('mediassist-map-saved'));setStorageError(false);}catch{setStorageError(true);}},[draft]);
  useEffect(()=>{
    if(draft.scan.status!=='running'||!driveDirection)return;
    const timer=setInterval(()=>{
      const current=draftRef.current;
      if(current.scan.status!=='running')return;
      const previous=current.scan.robot||SCAN_START;
      const {robot,moved,blocked}=driveRobotStep(previous,driveDirection);
      if(blocked){setDriveDirection('');setCollisionWarning(true);return;}
      if(!moved)return;
      const trail=current.scan.trail?.length?current.scan.trail:[{x:previous.x,y:previous.y}],last=trail[trail.length-1];
      const record=Math.hypot(robot.x-last.x,robot.y-last.y)>=14;
      const nextTrail=record?[...trail,{x:robot.x,y:robot.y}]:trail;
      const progress=Math.min(100,Math.round((current.scan.progress+.75)*100)/100);
      const next={...current,scan:{...current.scan,status:'running',progress,robot,trail:nextTrail}};
      draftRef.current=next;setDraft(next);
    },80);
    return ()=>clearInterval(timer);
  },[draft.scan.status,driveDirection]);
  useEffect(()=>{if(draft.scan.status!=='running'&&driveDirection)setDriveDirection('');},[draft.scan.status,driveDirection]);
  useEffect(()=>{if(!collisionWarning)return;const timer=setTimeout(()=>setCollisionWarning(false),3500);return()=>clearTimeout(timer);},[collisionWarning]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(confirm)confirmRef.current?.showModal();},[confirm]);
  useEffect(()=>{
    const stop=()=>setDriveDirection('');
    const stopWhenHidden=()=>{if(document.hidden)stop();};
    window.addEventListener('blur',stop);
    document.addEventListener('visibilitychange',stopWhenHidden);
    return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stopWhenHidden);};
  },[]);
  useEffect(()=>{
    const directions={ArrowUp:'forward',ArrowLeft:'left',ArrowRight:'right'};
    const editing=target=>target instanceof HTMLElement && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
    const keyDown=event=>{
      const direction=directions[event.key];
      if(!direction||editing(event.target)||['captured','complete'].includes(draftRef.current.scan.status))return;
      event.preventDefault();
      if(event.repeat)return;
      if(draftRef.current.scan.status!=='running')setDraft(current=>({...current,scan:{...current.scan,status:'running'}}));
      setCollisionWarning(false);setDriveDirection(direction);
    };
    const keyUp=event=>{
      const direction=directions[event.key];
      if(!direction||editing(event.target))return;
      event.preventDefault();setDriveDirection(current=>current===direction?'':current);
    };
    window.addEventListener('keydown',keyDown);
    window.addEventListener('keyup',keyUp);
    return()=>{window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);};
  },[]);
  const update=patch=>setDraft(current=>changeDraft(current,typeof patch==='function'?patch(current):patch));
  const cancelTool=()=>{setTool('');setRectangleStart(null);};
  const guard=action=>{if(unsaved){setConfirm({kind:'discard-edit',action});return false;}action();return true;};
  const navigate=target=>{
    if(!stageEnabled(draft,target))return;
    guard(()=>{setStage(target);setZone(emptyZone());setEndpoint(emptyEndpoint());cancelTool();setNotice('');});
  };
  const selectZone=id=>id===zone.id?true:guard(()=>{setZone(structuredClone(draft.zones.find(z=>z.id===id)));cancelTool();setNotice('');});
  const selectEndpoint=id=>id===endpoint.id?true:guard(()=>{setEndpoint({...draft.endpoints.find(e=>e.id===id),placed:true});cancelTool();setNotice('');});
  const openEndpointTab=tab=>guard(()=>{setEndpointTab(tab);setEndpoint(emptyEndpoint());cancelTool();setNotice('');});
  const newZone=()=>guard(()=>{setZone(emptyZone());cancelTool();setNotice('');});
  const newEndpoint=()=>guard(()=>{setEndpoint(emptyEndpoint());setTool('endpoint');setNotice('Click scanned free space to position the new endpoint.');});
  const requestEndpointDelete=value=>{
    const groupCount=groupsFor(draft).filter(g=>g.members.some(m=>m.endpointId===value.id)).length;
    const linkCount=draft.endpoints.filter(e=>e.queueId===value.id||e.exitId===value.id).length;
    setConfirm({kind:'delete-endpoint',name:value.name,groupCount,linkCount,action:()=>{
      setDraft(current=>removeEndpoint(current,value.id));
      // Clear references in the open form too, so a later save cannot restore them.
      if(endpoint.id===value.id){setEndpoint(emptyEndpoint());cancelTool();}
      else setEndpoint(current=>({...current,queueId:current.queueId===value.id?undefined:current.queueId,exitId:current.exitId===value.id?undefined:current.exitId}));
      setNotice('Đã xóa điểm đích khỏi bản nháp. Bấm Lưu bản đồ để cập nhật bản dùng cho Điều phối.');
    }});
  };
  const onPoint=point=>{
    if(!validPoint(point))return setNotice('Choose a position inside the map.');
    if(tool==='rectangle'){
      if(!rectangleStart){setRectangleStart(point);return;}
      const x=Math.min(rectangleStart.x,point.x),y=Math.min(rectangleStart.y,point.y),right=Math.max(rectangleStart.x,point.x),bottom=Math.max(rectangleStart.y,point.y);
      setZone(current=>({...current,points:[{x,y},{x:right,y},{x:right,y:bottom},{x,y:bottom}]}));cancelTool();
    } else if(tool==='polygon'){
      if(zone.points.length>=24)return setNotice('A zone supports up to 24 corners. Finish the shape or undo a corner.');
      setZone(current=>({...current,points:[...current.points,point]}));
    } else if(tool==='endpoint'||stage==='endpoint'&&!endpoint.placed){
      const candidate={...endpoint,...point,placed:true};
      // Position is previewed even when invalid, so the reason stays visible.
      setEndpoint(candidate);cancelTool();
    }
  };
  const storeZone=event=>{
    event.preventDefault();const value={...zone,name:zone.name.trim()};
    const error=zoneError(draft,value);if(error)return setNotice(error);
    value.id ||= crypto.randomUUID();
    update(current=>({zones:[...current.zones.filter(z=>z.id!==value.id),value]}));setZone(value);cancelTool();setNotice('Zone saved. Its overlay is available in Endpoint.');
  };
  const storeEndpoint=event=>{
    event.preventDefault();const value={...endpointValue,name:endpoint.name.trim(),group:endpoint.group?.trim()||''};
    const error=endpointError(draft,value);if(error)return setNotice(error);
    value.id ||= crypto.randomUUID();
    update(current=>({endpoints:[...current.endpoints.filter(e=>e.id!==value.id),value]}));setEndpoint({...value,placed:true});cancelTool();setNotice('Đã lưu điểm đích.');
  };
  const download=()=>{
    const blob=new Blob([JSON.stringify(exportMap(draft),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='hospital-lidar-map.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const toolText={rectangle:rectangleStart?'Click the opposite corner of the rectangle.':'Click the first corner of the rectangle.',polygon:'Click each corner, then choose Finish shape.',endpoint:'Click scanned free space to place the endpoint.'}[tool];
  const stopDrive=event=>{
    if(event?.pointerId!==undefined&&event.currentTarget?.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    setDriveDirection('');
  };
  const driveHandlers=direction=>({
    onPointerDown:event=>{if(['captured','complete'].includes(draft.scan.status)||event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture?.(event.pointerId);if(draft.scan.status!=='running')setDraft(current=>({...current,scan:{...current.scan,status:'running'}}));setCollisionWarning(false);setDriveDirection(direction);},
    onPointerUp:stopDrive,
    onPointerCancel:stopDrive,
    onPointerLeave:stopDrive,
    onLostPointerCapture:()=>setDriveDirection(''),
    onKeyDown:event=>{if(!['captured','complete'].includes(draft.scan.status)&&!event.repeat&&(event.key===' '||event.key==='Enter')){event.preventDefault();if(draft.scan.status!=='running')setDraft(current=>({...current,scan:{...current.scan,status:'running'}}));setCollisionWarning(false);setDriveDirection(direction);}},
    onKeyUp:event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();setDriveDirection('');}},
    onBlur:()=>setDriveDirection(''),
    onContextMenu:event=>event.preventDefault()
  });
  const stopNow=event=>{
    event.preventDefault();
    setDriveDirection('');
  };
  return <section className="ls-studio">
    <WorkspaceTabs label={vi('Map Studio stages')} active={stage} onSelect={navigate} items={STAGES.map(([id,name],i)=>({id,label:`${i+1}. ${vi(name)}`,disabled:!stageEnabled(draft,id),hint:!stageEnabled(draft,id)?vi('Finish the scan first'):undefined}))}/>
    <div className="ls-topline"><span>{draft.name}</span><span>{vi(storageError?'Storage unavailable — export your map':saved?'Map saved in this browser':'Draft autosaved in this browser')}</span></div>
    <header className="ls-heading"><div><h2>{index+1}. {vi(STAGES[index][1])}</h2><p>{vi(STAGES[index][2])}</p></div><div className="ls-actions">{vi(index>0&&<Button onClick={()=>navigate(STAGES[index-1][0])}>{vi("← Back")}</Button>)}{vi(stage==='zone'&&<Button tone="primary" onClick={()=>navigate('endpoint')}>{vi("Continue to Endpoint →")}</Button>)}{vi(stage==='endpoint'&&<Button tone="primary" disabled={!!issues.length||unsaved||saved} onClick={()=>{setDraft(current=>saveMap(current,new Date().toISOString()));setNotice('Map saved locally with scan, zones and endpoints.');}}>{vi(saved?'Map saved':'Save map')}</Button>)}</div></header>
    {notice&&<div className="ls-notice" role="status"><span>{vi(notice)}</span><Button className="small" aria-label="Đóng thông báo" onClick={()=>setNotice('')}>×</Button></div>}
    {confirm&&<dialog ref={confirmRef} onCancel={()=>setConfirm(null)} className="ls-confirm" role="alertdialog" aria-label={confirm.kind==='delete-endpoint'?'Xóa điểm đích':vi(confirm.kind==='reset'?'Start a new scan?':'Unsaved changes')}>
      <strong>{confirm.kind==='delete-endpoint'?`Xóa điểm đích “${confirm.name}”?`:vi(confirm.kind==='reset'?'Start a new scan?':'Discard unsaved changes?')}</strong>
      {confirm.kind==='delete-endpoint'?<><p>Điểm sẽ bị xóa khỏi bản nháp và gỡ khỏi {confirm.groupCount} nhóm. Liên kết điểm chờ/thoát tại {confirm.linkCount} điểm khác cũng được gỡ.</p><p>Bản đồ đã lưu chưa thay đổi cho đến khi bạn lưu lại. Chỉnh sửa chưa lưu của điểm bị xóa sẽ mất.</p></>:<p>{vi(confirm.kind==='reset'?'The current draft will be cleared, including its zones and endpoints. Export it first if you need to keep it.':'Your saved map features will remain. Only the edits in the open form will be discarded.')}</p>}
      <div className="ls-actions"><Button autoFocus onClick={()=>setConfirm(null)}>{confirm.kind==='delete-endpoint'?'Hủy':vi('Keep editing')}</Button><Button tone="danger" onClick={()=>{if(confirm.kind==='reset'){setDraft(createDraft());setStage('scan');setZone(emptyZone());setEndpoint(emptyEndpoint());cancelTool();setNotice('New scan ready.');}else confirm.action();setConfirm(null);}}>{confirm.kind==='delete-endpoint'?'Xóa điểm đích':vi(confirm.kind==='reset'?'Clear draft and restart':'Discard edits')}</Button></div>
    </dialog>}
    {stage==='endpoint'&&<nav className="ls-endpoint-tabs" aria-label="Quản lý điểm đích"><Button className={endpointTab==='points'?'active':''} aria-pressed={endpointTab==='points'} onClick={()=>endpointTab!=='points'&&openEndpointTab('points')}>Điểm đích ({draft.endpoints.length})</Button><Button className={endpointTab==='groups'?'active':''} aria-pressed={endpointTab==='groups'} onClick={()=>endpointTab!=='groups'&&openEndpointTab('groups')}>Nhóm điểm đích ({groupsFor(draft).length})</Button></nav>}
    {stage==='endpoint'&&endpointTab==='groups'?<EndpointGroupEditor groups={groupsFor(draft)} endpoints={draft.endpoints} onDirtyChange={setGroupDirty}
      onDelete={group=>{setDraft(current=>removeEndpointGroup(current,group.id));setNotice('Đã xóa nhóm. Các điểm đích vẫn được giữ nguyên.');}}
      onSave={group=>{const value={...group,id:group.id||crypto.randomUUID()};update(current=>({endpointGroups:[...groupsFor(current).filter(g=>g.id!==value.id),value]}));return value;}}
      onMember={(group,member)=>update(current=>({endpointGroups:groupsFor(current).map(g=>g.id===group.id?{...g,members:[...g.members.filter(m=>m.endpointId!==member.endpointId),member]}:g)}))}
      onRemove={(group,member)=>update(current=>({endpointGroups:groupsFor(current).map(g=>g.id===group.id?{...g,members:g.members.filter(m=>m.endpointId!==member.endpointId)}:g)}))}/>:<div className={'ls-layout '+(stage==='scan'?'ls-layout--scan':'')}>
      <div className="ls-main">
        <LidarMap draft={draft} stage={stage} artifactPreview tool={tool} onPoint={onPoint} zoneEdit={stage==='zone'?zone:null} endpointEdit={stage==='endpoint'?endpoint:null} onSelectZone={selectZone} onSelectEndpoint={selectEndpoint} onEditZone={setZone} onEditEndpoint={setEndpoint} rectangleStart={rectangleStart} hoverPoint={hover} onHover={setHover} zoneDirty={zoneDirty} endpointDirty={endpointDirty} collisionWarning={collisionWarning}/>
        <Panel title="Dùng mặt bằng này trong Gazebo"><p>Lưu bản đồ cùng vùng và điểm đích, sau đó tải gói này để tạo thế giới 3D trong Docker. Tuần tra dùng lại cùng tọa độ.</p><Button disabled={!draft.saved || !saved || unsaved} onClick={() => downloadGazeboMap(draft.saved.snapshot).catch(error => setNotice(error.message))}>Tải bản đồ cho Gazebo</Button><Button onClick={() => goTo('/admin/patrol')}>Mở Tuần tra</Button></Panel>
        {vi(tool&&<div className="ls-toolhint"><span>{vi(toolText)}</span><Button className="small" onClick={cancelTool}>{vi("Cancel tool")}</Button></div>)}
        {vi(stage==='scan'&&<Panel title={vi("Scan controls")}><div className="ls-runbar"><div><strong>{({idle:'Sẵn sàng quét thủ công',running:'Cảm biến đang bật · hãy điều khiển robot',paused:'Đã tạm dừng cảm biến',captured:'Chờ xác nhận hoàn tất',complete:'Bản quét đã hoàn tất'})[draft.scan.status]}</strong><small>Bản đồ chỉ hiện những vùng robot đã đi qua và ghi nhận</small></div><div className="ls-actions">
          <Button tone={draft.scan.progress>0?'primary':''} disabled={draft.scan.progress<=0} onClick={()=>{setDriveDirection('');if(draft.scan.status!=='complete')update(current=>({scan:{...current.scan,status:'complete'}}));setStage('zone');setNotice('Đã hoàn tất bản quét thủ công. Hãy khoanh vùng trên dữ liệu vừa ghi nhận.');}}>Hoàn tất quét → Phân vùng</Button>
        </div></div></Panel>)}
        {stage!=='scan'&&<div className="ls-hint">{stage==='zone'?'Khoanh vùng bằng hình chữ nhật hoặc đa giác. Kéo bên trong để di chuyển, kéo chấm trắng để chỉnh đường biên.':'Kéo chấm xanh trên bản đồ để đổi vị trí điểm đích.'} Nhấn Esc để hủy lượt kéo, sau đó bấm Lưu để giữ thay đổi.</div>}
      </div>
      <aside className="ls-inspector">
        {stage==='endpoint'&&<Panel title={'Điểm đích đã lưu · '+draft.endpoints.length}>
          {draft.endpoints.length?<div className="ls-item-list">{draft.endpoints.map(e=><div className="ls-endpoint-row" key={e.id}>
            <button type="button" className={'ls-item '+(e.id===endpoint.id?'selected':'')} onClick={()=>selectEndpoint(e.id)}><i style={{background:'#60a5fa'}}/><span><strong>{e.name}</strong><small>{vi(e.type)}</small></span></button>
            <Button tone="danger" className="small" aria-label={'Xóa điểm đích '+e.name} onClick={()=>requestEndpointDelete(e)}>Xóa</Button>
          </div>)}</div>:<div className="ls-empty">Chưa có điểm đích. Đặt điểm trực tiếp trên bản đồ để bắt đầu.</div>}
        </Panel>}
        {stage==='scan'&&<>
          <Panel title="Camera phía trước robot">
            <div className="ls-camera">
              <img src={liveCamera} alt="Ảnh minh họa camera cho mô phỏng"/>
              <span className="ls-camera-badge">ẢNH MINH HỌA</span>
              <span className="ls-camera-label"><b>MAR-01 · Mô phỏng</b><span>Không phải camera trực tiếp</span></span>
            </div>
            <div className="ls-camera-info"><span>Nguồn camera</span><b>Ảnh minh họa cục bộ</b></div>
            <p>Ảnh minh họa cho chế độ mô phỏng. Chưa kết nối camera robot thật.</p>
          </Panel>
          <Panel title="Điều khiển robot">
            <div className="ls-drive-panel">
              <p className="ls-drive-help">Nhấn giữ nút trên màn hình hoặc phím mũi tên để di chuyển. Thả nút/phím để robot tự dừng.</p>
              <div className="ls-drive-pad" role="group" aria-label="Các nút điều khiển hướng robot">
                <button type="button" disabled={['captured','complete'].includes(draft.scan.status)} className={'ls-drive-key ls-drive-up '+(driveDirection==='forward'?'active':'')} aria-label="Giữ để robot tiến thẳng" aria-pressed={driveDirection==='forward'} {...driveHandlers('forward')}>↑</button>
                <button type="button" disabled={['captured','complete'].includes(draft.scan.status)} className={'ls-drive-key ls-drive-left '+(driveDirection==='left'?'active':'')} aria-label="Giữ để robot cua trái" aria-pressed={driveDirection==='left'} {...driveHandlers('left')}>←</button>
                <button type="button" className={'ls-drive-key stop ls-drive-stop '+(!driveDirection?'active':'')} aria-label="Dừng robot" aria-pressed={!driveDirection} onPointerDown={stopNow} onClick={stopNow}>DỪNG</button>
                <button type="button" disabled={['captured','complete'].includes(draft.scan.status)} className={'ls-drive-key ls-drive-right '+(driveDirection==='right'?'active':'')} aria-label="Giữ để robot cua phải" aria-pressed={driveDirection==='right'} {...driveHandlers('right')}>→</button>
              </div>
              <div className={'ls-drive-status '+(collisionWarning?'collision':driveDirection?'moving':'')} role={collisionWarning?'alert':'status'}><i/>{collisionWarning?'Cảnh báo va chạm · Robot đã tự dừng':driveDirection?`Đang giữ: ${DRIVE_LABELS[driveDirection]}`:'Robot đang dừng'}</div>
              <p className="ls-safety-note">Tự động dừng cách tường hoặc vật cản tối thiểu {ROBOT_SAFETY_GAP_METERS.toLocaleString('vi-VN')} m. Chế độ demo chưa gửi lệnh tới robot vật lý.</p>
            </div>
          </Panel>
          <Panel title="Phiên quét"><Field label="Tên bản đồ" maxLength={60} value={draft.name} onChange={e=>update({name:e.target.value})}/><Stat label="Nguồn">Mô phỏng LiDAR thủ công</Stat><Stat label="Vị trí đã ghi nhận">{draft.scan.trail?.length||0}</Stat><Stat label="Độ phân giải">0,05 m / ô</Stat><Button tone="danger" className="ls-full" disabled={draft.scan.status==='idle'} onClick={()=>setConfirm({kind:'reset'})}>Quét mới</Button></Panel>
        </>}
        {vi(stage==='zone'&&<><Panel title={vi(zone.id?'Edit zone':'Create zone')}><form onSubmit={storeZone}><Field label="Zone name" required maxLength={40} placeholder={vi("e.g. Pharmacy")} value={zone.name} onChange={e=>setZone(z=>({...z,name:e.target.value}))}/><ZoneTypePicker value={zone.type} onChange={type=>setZone(z=>({...z,type}))}/><p>{vi(zoneType.help)}</p><ZoneProperties zone={zone} setZone={setZone}/>
          {vi(zone.type==='SPEED'&&<Field label="Maximum speed (m/s)" type="number" min=".1" max="1.5" step=".05" required value={zone.speed} onChange={e=>setZone(z=>({...z,speed:e.target.value===''?'':Number(e.target.value)}))}/>)}
          <div className="ls-actions"><Button className={tool==='rectangle'?'active':''} onClick={()=>{setZone(z=>({...z,points:[]}));setRectangleStart(null);setTool('rectangle');}}>{vi("Draw rectangle")}</Button><Button className={tool==='polygon'?'active':''} onClick={()=>{setZone(z=>({...z,points:[]}));setRectangleStart(null);setTool('polygon');}}>{vi("Draw polygon")}</Button></div>
          {vi(tool==='polygon'&&<div className="ls-actions"><Button className="small" disabled={!zone.points.length} onClick={()=>setZone(z=>({...z,points:z.points.slice(0,-1)}))}>{vi("Undo corner")}</Button><Button className="small" disabled={zone.points.length<3} onClick={cancelTool}>{vi("Finish shape")}</Button></div>)}
          {zone.points.length>0&&<Stat label="Vùng đã khoanh">{(polygonArea(zone.points)*MAP.resolution**2).toFixed(1)} m²</Stat>}
          {vi(zoneProblem&&<div className="ls-error">{vi(zoneProblem)}</div>)}
          <Button type="submit" tone="primary" className="ls-full" disabled={!zone.points.length||!!zoneProblem||!!tool||!zoneDirty}>{vi("Save zone")}</Button>
        </form><div className="ls-actions"><Button onClick={newZone}>{vi("New zone")}</Button>{vi(zone.id&&<Button onClick={()=>setZone(z=>({...z,id:'',name:z.name+' (bản sao)'}))}>{vi("Nhân bản vùng")}</Button>)}{vi(zone.id&&<Button tone="danger" onClick={()=>{update({zones:draft.zones.filter(z=>z.id!==zone.id)});setZone(emptyZone());cancelTool();setNotice('Zone removed.');}}>{vi("Delete zone")}</Button>)}</div></Panel><Panel title={vi('Saved zones · '+draft.zones.length)}>{vi(draft.zones.length?<div className="ls-item-list">{vi(draft.zones.map(z=><button key={z.id} type="button" className={'ls-item '+(z.id===zone.id?'selected':'')} onClick={()=>selectZone(z.id)}><i style={{background:ZONE_TYPES.find(t=>t.id===z.type)?.color}}/><span><strong>{vi(z.name)}</strong><small>{vi(ZONE_TYPES.find(t=>t.id===z.type)?.label)}</small></span></button>))}</div>:<div className="ls-empty">{vi("No zones yet. Draw a shape to label an area or add a rule.")}</div>)}</Panel></>)}
        {vi(stage==='endpoint'&&<><Panel title={vi(endpoint.id?'Edit endpoint':'Create endpoint')}><form onSubmit={storeEndpoint}><Field label="Endpoint name" maxLength={40} required placeholder={vi("e.g. Pharmacy pickup")} value={endpoint.name} onChange={e=>setEndpoint(p=>({...p,name:e.target.value}))}/><Field label="Endpoint type"><select value={endpoint.type} onChange={e=>setEndpoint(p=>({...p,type:e.target.value}))}>{vi(ENDPOINT_TYPES.map(t=><option key={t} value={t}>{vi(t)}</option>))}</select></Field>
          {!endpoint.placed&&<Button className={'ls-full '+(tool==='endpoint'?'active':'')} onClick={()=>setTool('endpoint')}>{vi('Place on map')}</Button>}
          <EndpointProperties endpoint={endpoint} setEndpoint={setEndpoint} draft={draft} onOpenGroups={()=>openEndpointTab('groups')}/>
          {vi(endpointProblem&&<div className="ls-error">{vi(endpointProblem)}</div>)}
          <Button type="submit" tone="primary" className="ls-full" disabled={!endpoint.placed||!!endpointProblem||!!tool||!endpointDirty}>{vi("Save endpoint")}</Button>
        </form><div className="ls-actions"><Button onClick={newEndpoint}>{vi("New endpoint")}</Button></div></Panel>
        <Panel title={vi("Map configuration")}><Stat label="Zones">{vi(draft.zones.length)}</Stat><Stat label="Endpoints">{vi(draft.endpoints.length)}</Stat><Stat label="Status">{vi(saved?<span className="ls-saved">{vi("Saved locally")}</span>:'Draft')}</Stat>{vi(unsaved?<div className="ls-error">{vi("Save or discard the open endpoint edits before saving the map.")}</div>:issues.length>0&&<div className="ls-error">{vi(issues[0])}</div>)}<Button tone="primary" className="ls-full" disabled={!!issues.length||unsaved||saved} onClick={()=>{setDraft(current=>saveMap(current,new Date().toISOString()));setNotice('Map saved locally with scan, zones and endpoints.');}}>{vi(saved?'Map saved':'Save map configuration')}</Button><Button className="ls-full" disabled={!!issues.length||unsaved} onClick={download}>{vi("Export map JSON")}</Button><p>{vi("Bản đã lưu là nguồn dữ liệu cho Điều phối. Bản nháp mới không thay đổi phiên mô phỏng đang chạy. Không triển khai đến robot thật.")}</p><Button className="ls-full" tone="primary" disabled={!draft.saved||storageError||unsaved} onClick={()=>goTo('/workstations')}>{vi("Mở Điều phối với bản đã lưu →")}</Button></Panel></>)}
      </aside>
    </div>}
  </section>;
}
export const workflow=STAGES.map(([id,label])=>[id,label]);
