import { inPolygon, distanceToSegment, MAP } from '../Admin/lidarGeometry.js';
import { samplePlan } from './mapDispatchModel.js';

const RADIUS=8; // 0.4 m circular footprint, not certified robot safety fields.
export function touchesZone(point,zone,radius=RADIUS){
  return inPolygon(point,zone.points)||zone.points.some((p,i)=>distanceToSegment(point,p,zone.points[(i+1)%zone.points.length])<=radius);
}
function interiorPoint(plan,zone,margin){
  return plan.path.find(p=>inPolygon(p,zone.points)&&zone.points.every((a,i)=>distanceToSegment(p,a,zone.points[(i+1)%zone.points.length])>=margin));
}
function seconds(value,fallback){const result=value??fallback;if(!Number.isFinite(result)||result<1||result>180)throw Error('Thời gian tình huống thử nghiệm phải từ 1 đến 180 giây.');return result;}

// Deterministic test fixtures on the saved route: robot 02 holds one zone;
// an obstacle clears after a configured wait. No fleet API or sensor commands.
export function applyTrafficScenario(map,plan,scenario={}){
  const fixtures=[],notes=[],events=[],timeline=[],path=[plan.path[0]],resolved=[];
  const configured=[['singleRobotZoneId','SINGLE_ROBOT'],['obstacleZoneId','NO_REPLAN']];
  for(const [key,type] of configured){
    if(!scenario[key])continue;
    const zone=map.zones.find(z=>z.id===scenario[key]&&z.type===type&&z.enabled!==false);
    if(!zone)throw Error('Vùng thử nghiệm không còn hoạt động. Hãy chọn lại.');
    const point=interiorPoint(plan,zone,type==='NO_REPLAN'?24:8);
    if(!point){notes.push(`Tuyến không đi đủ sâu vào “${zone.name}”, nên không kích hoạt tình huống tại vùng này.`);continue;}
    const single=type==='SINGLE_ROBOT';
    if(single?touchesZone(plan.path[0],zone):Math.hypot(plan.path[0].x-point.x,plan.path[0].y-point.y)<=18)throw Error(`Điểm xuất phát đã nằm trong vùng đang bị chiếm/vật cản “${zone.name}”. Chọn điểm xuất phát bên ngoài để thử chờ an toàn.`);
    fixtures.push({id:type,zone,point,hold:seconds(single?scenario.singleRobotSeconds:scenario.obstacleSeconds,single?8:5),triggered:false,visibleUntil:Infinity});
  }
  let time=0,distance=0,blocked=null;
  const add=(part,a,b,duration)=>{timeline.push({...part,a,b,start:time,end:time+duration});time+=duration;};
  outer:for(const original of plan.timeline){
    if(original.action==='MOVE'){
      const count=Math.max(1,Math.ceil(Math.hypot(original.b.x-original.a.x,original.b.y-original.a.y)/2));
      let a=original.a;
      for(let i=1;i<=count;i++){
        const b={x:original.a.x+(original.b.x-original.a.x)*i/count,y:original.a.y+(original.b.y-original.a.y)*i/count};
        for(const f of fixtures){
          if(f.triggered)continue;
          const single=f.id==='SINGLE_ROBOT';
          if(!(single?touchesZone(b,f.zone):Math.hypot(b.x-f.point.x,b.y-f.point.y)<=18))continue;
          f.triggered=true;const timeout=single?Infinity:(f.zone.waitTimeoutSeconds??20),wait=Math.min(f.hold,timeout);
          f.visibleUntil=time+f.hold;
          const label=single?`Chờ MAR-02 ảo giải phóng ${f.zone.name}`:`Giữ tuyến, chờ vật cản tại ${f.zone.name}`;
          events.push({at:time,text:label});
          const heading=(Math.atan2(a.y-b.y,b.x-a.x)*180/Math.PI+360)%360;
          add({action:single?'WAIT_ZONE':'WAIT_OBSTACLE',label,speed:0,heading},a,a,wait);
          if(f.hold>timeout){blocked=`Đã chờ ${timeout} giây tại ${f.zone.name}: vật cản chưa rời. Dừng mô phỏng, không tự đổi tuyến.`;events.push({at:time,text:blocked});break outer;}
          events.push({at:time,text:single?`MAR-02 ảo đã rời ${f.zone.name}; MAR-01 được đi tiếp.`:`Vật cản đã rời ${f.zone.name}; tiếp tục đúng tuyến cũ.`});
        }
        add(original,a,b,(original.end-original.start)/count);
        distance+=Math.hypot(b.x-a.x,b.y-a.y)*MAP.resolution;path.push(b);a=b;
      }
    }else add(original,original.a,original.b,original.end-original.start);
    for(const arrival of plan.resolved.filter(r=>Math.abs(r.at-original.end)<1e-7))resolved.push({...arrival,at:time});
  }
  if(blocked){const at=path.at(-1);timeline.push({a:at,b:at,start:time,end:time,label:blocked,action:'BLOCKED',speed:0,heading:timeline.at(-1)?.heading??0});}
  const result={...plan,path,timeline,resolved,duration:time,distance,fixtures,notes,events,outcome:blocked?'blocked':'complete',blocked};
  const tracked=map.zones.filter(z=>z.enabled!==false&&['SINGLE_ROBOT','OCCUPANCY_MONITORING'].includes(z.type));
  for(const zone of tracked){
    let inside=touchesZone(path[0],zone);
    if(inside)events.push({at:0,text:`MAR-01 đang ở trong ${zone.name}.`});
    for(const part of timeline){
      const next=touchesZone(part.b,zone);if(next===inside)continue;
      events.push({at:part.end,text:`MAR-01 ${next?'vào':'rời'} ${zone.name}${zone.type==='SINGLE_ROBOT'?(next?' · nhận quyền sử dụng.':' · giải phóng quyền sử dụng.'):'.'}`});inside=next;
    }
    for(const f of fixtures.filter(f=>f.id==='SINGLE_ROBOT'&&touchesZone(f.point,zone))){
      events.push({at:0,text:`MAR-02 ảo đang giữ ${zone.name}.`});
      if(Number.isFinite(f.visibleUntil))events.push({at:f.visibleUntil,text:`MAR-02 ảo rời ${zone.name}.`});
    }
  }
  events.sort((a,b)=>a.at-b.at);
  return result;
}
export function trafficState(map,plan,elapsed){
  const point=samplePlan(plan,elapsed).point;
  const actors=(plan.fixtures||[]).filter(f=>elapsed<f.visibleUntil).map(f=>({id:f.id,point:f.point,kind:f.id==='SINGLE_ROBOT'?'robot':'obstacle',label:f.id==='SINGLE_ROBOT'?'MAR-02 ảo':'Vật cản thử'}));
  const robots=[point,...actors.filter(a=>a.kind==='robot').map(a=>a.point)];
  const occupancy=map.zones.filter(z=>z.enabled!==false&&['SINGLE_ROBOT','OCCUPANCY_MONITORING'].includes(z.type)).map(z=>({id:z.id,name:z.name,type:z.type,count:robots.filter(p=>touchesZone(p,z)).length}));
  return {actors,occupancy,events:(plan.events||[]).filter(e=>e.at<=elapsed)};
}
