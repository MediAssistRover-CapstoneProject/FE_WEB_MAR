import { MAP, inPolygon } from '../Admin/lidarGeometry.js';
import { pointAllowed, mapIssues } from '../Admin/mapStudioModel.js';
import { vi } from '../../i18n/vi.js';
import { groupsFor, groupCandidates } from '../../features/facility/endpointGroups.js';

const STEP=10, WIDTH=121, HEIGHT=69;
const point=k=>({x:(k%WIDTH)*STEP,y:Math.floor(k/WIDTH)*STEP});
export function travelSpeed(map,p){
  return Math.min(.6,...map.zones.filter(z=>z.enabled!==false&&z.type==='SPEED_LIMIT'&&inPolygon(p,z.points)).map(z=>z.speed));
}
export function segmentAllowed(map,a,b){
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));
  const forbidden=Math.hypot(b.x-a.x,b.y-a.y)<.001?[]:map.zones.filter(z=>z.enabled!==false&&z.type==='PREFERRED_DIRECTION'&&directionPenalty(z,a,b)>=1);
  for(let i=0;i<=n;i++){
    const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};
    if(!pointAllowed(map,p)||forbidden.some(z=>inPolygon(p,z.points)))return false;
  }
  return true;
}
function directionPenalty(z,a,b){
  const heading=Math.atan2(a.y-b.y,b.x-a.x),dot=Math.cos(heading-z.heading*Math.PI/180);
  // Hard one-way restrictions include diagonal connectors: a backwards
  // component must not evade the rule by being classified as a cross move.
  if((z.antiAlignCost===1&&dot<-.000001)||(z.alignCost===1&&dot>.000001)||(z.crossCost===1&&Math.abs(dot)<.999999))return 1;
  return dot>.7?(z.alignCost??-.5):dot<-.7?(z.antiAlignCost??0):(z.crossCost??0);
}
function directionCost(map,a,b){
  let cost=1;
  for(const z of map.zones.filter(z=>z.enabled!==false&&z.type==='PREFERRED_DIRECTION'&&inPolygon(a,z.points))){
    const penalty=directionPenalty(z,a,b);
    cost*=Math.max(.1,1+penalty*4);
  }
  return cost;
}
class Heap{
  values=[];
  push(v){let i=this.values.push(v)-1;while(i){let p=(i-1)>>1;if(this.values[p][0]<=v[0])break;this.values[i]=this.values[p];i=p;}this.values[i]=v;}
  pop(){const root=this.values[0],last=this.values.pop();if(this.values.length){let i=0;while(i*2+1<this.values.length){let c=i*2+1;if(c+1<this.values.length&&this.values[c+1][0]<this.values[c][0])c++;if(this.values[c][0]>=last[0])break;this.values[i]=this.values[c];i=c;}this.values[i]=last;}return root;}
}
// Navigation geometry and editing geometry share coordinates. Every edge is
// sampled, including the connectors to endpoint positions, to avoid wall cuts.
export function findRoute(map,start,end){
  if(!pointAllowed(map,start)||!pointAllowed(map,end))throw Error('Điểm đầu hoặc điểm đích nằm trong vùng cấm, tường hoặc vùng chưa quét.');
  if(Math.hypot(start.x-end.x,start.y-end.y)<.01)return[start];
  const free=new Map(),ok=k=>{if(!free.has(k))free.set(k,pointAllowed(map,point(k)));return free.get(k);};
  const neighbors=(p,arrival=false)=>{const result=[];const cx=Math.round(p.x/STEP),cy=Math.round(p.y/STEP);for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++){if(x<0||x>=WIDTH||y<0||y>=HEIGHT)continue;const k=y*WIDTH+x;if(ok(k)&&(arrival?segmentAllowed(map,point(k),p):segmentAllowed(map,p,point(k))))result.push(k);}return result;};
  const starts=neighbors(start),ends=new Set(neighbors(end,true));
  const queue=new Heap(),dist=new Map(),previous=new Map();
  for(const k of starts){const d=Math.hypot(start.x-point(k).x,start.y-point(k).y)*MAP.resolution/travelSpeed(map,start)*directionCost(map,start,point(k));dist.set(k,d);queue.push([d,k]);}
  let target=null,best=Infinity;
  while(queue.values.length){const [d,k]=queue.pop();if(d!==dist.get(k))continue;if(d>=best)break;const a=point(k);
    if(ends.has(k)){const total=d+Math.hypot(a.x-end.x,a.y-end.y)*MAP.resolution/travelSpeed(map,a)*directionCost(map,a,end);if(total<best){best=total;target=k;}}
    const x=k%WIDTH,y=Math.floor(k/WIDTH);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(x+dx<0||x+dx>=WIDTH||y+dy<0||y+dy>=HEIGHT)continue;const n=k+dx+dy*WIDTH,b=point(n);if(!ok(n)||!segmentAllowed(map,a,b))continue;const nd=d+STEP*MAP.resolution/travelSpeed(map,a)*directionCost(map,a,b);if(nd<(dist.get(n)??Infinity)){dist.set(n,nd);previous.set(n,k);queue.push([nd,n]);}}
  }
  if(target===null)throw Error('Không có tuyến an toàn giữa '+(start.name||'điểm đầu')+' và '+(end.name||'điểm đích')+'. Kiểm tra vùng cấm, cửa và khoảng hở 0,4 m.');
  const path=[];for(let k=target;k!==undefined;k=previous.get(k))path.push(point(k));
  return[start,...path.reverse(),end].filter((p,i,a)=>!i||Math.hypot(p.x-a[i-1].x,p.y-a[i-1].y)>.01);
}
const defaultTasks={PICKUP:[{action:'LOAD',seconds:4}],DROPOFF:[{action:'UNLOAD',seconds:4}],PARKING:[{action:'WAIT',seconds:2}],CHARGING:[{action:'CHARGE',seconds:10}]};
export function createDispatchPlan(map,startId,stops,options={}){
  const issues=mapIssues(map);if(issues.length)throw Error('Bản đồ chưa hợp lệ: '+vi(issues[0]));
  let current=map.endpoints.find(e=>e.id===startId);if(!current||current.enabled===false)throw Error('Chọn điểm xuất phát đang hoạt động.');
  if(current.occupancy==='BUSY')throw Error('Điểm xuất phát đang được sử dụng.');
  if(!stops.length)throw Error('Thêm ít nhất một điểm dừng.');
  const timeline=[],path=[current],resolved=[],selections=[],visits={...options.visits};let time=0,distance=0;
  const move=(end,label)=>{const route=findRoute(map,current,end);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.y-a.y)*MAP.resolution,speed=Math.min(travelSpeed(map,a),travelSpeed(map,b));timeline.push({a,b,start:time,end:time+length/speed,label,action:'MOVE',speed});time+=length/speed;distance+=length;path.push(b);}current=end;};
  for(const stop of stops){let end=map.endpoints.find(e=>e.id===stop);
    if(stop.startsWith('group:')){
      const group=groupsFor(map).find(g=>g.id===stop.slice(6));
      const candidates=groupCandidates(map,group,current,visits),attempts=[];
      for(const candidate of candidates){
        try{let from=current;for(const id of [candidate.queueId,candidate.id,candidate.exitId].filter(Boolean)){
          const to=map.endpoints.find(p=>p.id===id);
          if(!to||to.enabled===false||to.accessible===false||to.occupancy==='BUSY')throw Error('Điểm chờ/thoát không sẵn sàng.');
          findRoute(map,from,to);from=to;
        }end=candidate;break;}
        catch(error){attempts.push({id:candidate.id,name:candidate.name,reason:error.message});if(!group.allowFallback)throw Error(`Nhóm ${group.name}: ${error.message} Nhóm không cho phép thử điểm kế tiếp.`);}
      }
      if(end)selections.push({groupId:group.id,groupName:group.name,policy:group.selectionPolicy,endpointId:end.id,endpointName:end.name,attempts});
    }
    if(!end||end.enabled===false||end.accessible===false)throw Error('Không có điểm đang hoạt động, rảnh và có thể đi đến trong lựa chọn này.');
    if(end.occupancy==='BUSY')throw Error('Điểm '+end.name+' đang bận. Chọn điểm khác hoặc nhóm điểm tương đương.');
    for(const id of [end.queueId,end.id])if(id){const p=map.endpoints.find(e=>e.id===id);if(!p||p.enabled===false||p.occupancy==='BUSY')throw Error('Điểm chờ không sẵn sàng.');move(p,p.id===end.id?'Di chuyển đến '+p.name:'Qua điểm chờ '+p.name);}
    // Heading and endpoint ownership are applied during the endpoint task block.
    const arrival=current;timeline.push({a:arrival,b:arrival,start:time,end:time+.3,label:'Định hướng tại '+end.name,action:'ARRIVE',heading:end.heading,speed:0});time+=.3;
    for(const task of end.tasks??defaultTasks[end.type]??[]){timeline.push({a:arrival,b:arrival,start:time,end:time+Math.max(.1,task.seconds),label:end.name,action:task.action,heading:end.heading,speed:0});time+=Math.max(.1,task.seconds);}
    resolved.push({id:end.id,name:end.name,at:time});
    visits[end.id]=(visits[end.id]||0)+1;
    if(end.exitId){const exit=map.endpoints.find(e=>e.id===end.exitId);if(!exit||exit.enabled===false||exit.occupancy==='BUSY')throw Error('Điểm thoát không sẵn sàng.');move(exit,'Rời điểm phục vụ qua '+exit.name);}
  }
  return {path,timeline,duration:time,distance,resolved,selections,startId,revision:map.revision};
}
export function samplePlan(plan,elapsed){
  const part=plan.timeline.find(p=>p.end>elapsed)||plan.timeline.at(-1);
  if(!part)return {point:plan.path[0],label:'Đã ở điểm đích',action:'DONE',speed:0};
  const fraction=Math.max(0,Math.min(1,(elapsed-part.start)/(part.end-part.start||1)));
  return {...part,point:{x:part.a.x+(part.b.x-part.a.x)*fraction,y:part.a.y+(part.b.y-part.a.y)*fraction,heading:part.heading??((Math.atan2(part.a.y-part.b.y,part.b.x-part.a.x)*180/Math.PI+360)%360)}};
}
