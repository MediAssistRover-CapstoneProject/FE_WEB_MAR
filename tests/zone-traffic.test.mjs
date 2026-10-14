import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,zoneError,saveMap,loadDraft,pointAllowed} from '../src/pages/Admin/mapStudioModel.js';
import {ZONE_TYPES} from '../src/pages/Admin/zoneCatalog.js';
import {segmentAllowed,findRoute,createDispatchPlan,samplePlan} from '../src/pages/Workstations/mapDispatchModel.js';
import {applyTrafficScenario,trafficState,touchesZone} from '../src/pages/Workstations/trafficSimulation.js';
import {groupCandidates} from '../src/features/facility/endpointGroups.js';
import {groupPayload} from '../src/features/facility/facilityContract.js';
const rect=(id,type,x,y,w,h)=>({id,name:id,type,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
const base=()=>({...createDraft(),scan:{status:'complete',progress:100},endpoints:[
  {id:'home',name:'Gốc',type:'HOME',x:580,y:330,heading:0},
  {id:'pickup',name:'Nhận A',type:'PICKUP',x:815,y:245,heading:90},
  {id:'near',name:'Nhận B',type:'PICKUP',x:600,y:360,heading:0},
]});
const single=()=>rect('single','SINGLE_ROBOT',700,310,100,45);
const noReplan=()=>({...rect('no-replan','NO_REPLAN',780,180,125,140),waitTimeoutSeconds:10});
const group=policy=>({id:'pickups',code:'PICKUPS',name:'Quầy nhận',selectionPolicy:policy,active:true,allowFallback:true,members:[{endpointId:'pickup',sequenceNo:1,active:true},{endpointId:'near',sequenceNo:2,active:true}]});

test('zone catalog includes rest areas and rejects unsupported active policies',()=>{
 assert.equal(ZONE_TYPES.length,20);assert.equal(new Set(ZONE_TYPES.map(t=>t.id)).size,20);
 for(const type of ZONE_TYPES){const z={...rect(type.id,type.id,700,315,100,40),heading:0,speed:.3};assert.equal(!!zoneError(base(),z),!!type.unsupported,type.id);}
});
test('new zone configuration survives save/reload; invalid no-replan time rejected',()=>{
 const m=base();m.zones=[single(),noReplan(),rect('monitor','OCCUPANCY_MONITORING',650,310,180,45)];
 const saved=saveMap(m,'test');assert.ok(saved.saved);assert.equal(loadDraft({getItem:()=>JSON.stringify(saved)}).zones[1].waitTimeoutSeconds,10);
 for(const invalid of [0,121,NaN,''])assert.ok(zoneError(m,{...m.zones[1],waitTimeoutSeconds:invalid}));
});
test('cost 1 forbids reverse travel and final connectors; soft costs and disabled zones remain traversable',()=>{
 const m=base();m.zones=[{...rect('east','PREFERRED_DIRECTION',90,100,1020,500),heading:0,alignCost:-.5,antiAlignCost:1,crossCost:0}];
 assert.equal(zoneError(m,m.zones[0]),'');
 const a={x:580,y:330},b={x:587,y:330};
 assert.ok(segmentAllowed(m,a,b));assert.equal(segmentAllowed(m,b,a),false);
 assert.ok(findRoute(m,a,b).length);assert.throws(()=>findRoute(m,b,a),/Không có tuyến/);
 m.zones[0].antiAlignCost=.95;assert.ok(findRoute(m,b,a).length);
 m.zones[0].antiAlignCost=1;m.zones[0].enabled=false;assert.ok(findRoute(m,b,a).length);
});
test('assumed obstacle is a hard planning barrier; disabling it never changes physical walls',()=>{
 const m=base();m.zones=[rect('assumed','ASSUMED_COST',790,310,125,40)];
 assert.throws(()=>findRoute(m,m.endpoints[0],m.endpoints[1]),/Không có tuyến/);
 m.zones[0].enabled=false;assert.ok(findRoute(m,m.endpoints[0],m.endpoints[1]).length);
 assert.equal(pointAllowed(m,{x:640,y:280}),false);
});
test('single-robot fixture stops outside footprint boundary until robot 02 leaves; never two owners',()=>{
 const m=base();m.zones=[single(),rect('watch','OCCUPANCY_MONITORING',680,300,140,70)];
 const original=createDispatchPlan(m,'home',['pickup']);const plan=applyTrafficScenario(m,original,{singleRobotZoneId:'single',singleRobotSeconds:8});
 const wait=plan.timeline.find(t=>t.action==='WAIT_ZONE');assert.ok(wait);assert.ok(Math.abs(wait.end-wait.start-8)<1e-7);assert.equal(touchesZone(wait.a,m.zones[0]),false);
 assert.equal(trafficState(m,plan,wait.start+1).actors.length,1);
 assert.equal(trafficState(m,plan,wait.end+.01).actors.length,0);
 for(let t=0;t<plan.duration;t+=.1)assert.ok(trafficState(m,plan,t).occupancy[0].count<=1);
 assert.ok(Math.abs(plan.duration-original.duration-8)<1e-7);assert.equal(plan.resolved[0].id,'pickup');
 assert.ok(plan.events.some(e=>e.text.includes('giải phóng quyền')));
});
test('occupancy monitoring logs presence without changing path/duration or limiting capacity',()=>{
 const m=base();const original=createDispatchPlan(m,'home',['pickup']);m.zones=[rect('watch','OCCUPANCY_MONITORING',500,200,400,200)];
 const plan=applyTrafficScenario(m,createDispatchPlan(m,'home',['pickup']));
 assert.ok(Math.abs(plan.duration-original.duration)<1e-7);assert.equal(trafficState(m,plan,0).occupancy[0].count,1);
 m.zones.push(single());const shared=applyTrafficScenario(m,createDispatchPlan(m,'home',['pickup']),{singleRobotZoneId:'single'});
 assert.equal(trafficState(m,shared,0).occupancy[0].count,2);
});
test('no-replan waits, resumes the same route after obstacle removal; timeout halts before contact and never completes service',()=>{
 const m=base();m.zones=[noReplan()];const original=createDispatchPlan(m,'home',['pickup']);
 const plan=applyTrafficScenario(m,original,{obstacleZoneId:'no-replan',obstacleSeconds:5});
 const wait=plan.timeline.find(p=>p.action==='WAIT_OBSTACLE');assert.equal(wait.end-wait.start,5);assert.equal(plan.outcome,'complete');
 assert.ok(Math.abs(plan.distance-original.distance)<1e-7);assert.ok(Math.abs(plan.duration-original.duration-5)<1e-7);
 const blocked=applyTrafficScenario(m,original,{obstacleZoneId:'no-replan',obstacleSeconds:15});assert.equal(blocked.outcome,'blocked');assert.equal(blocked.resolved.length,0);
 assert.equal(samplePlan(blocked,blocked.duration).action,'BLOCKED');const p=samplePlan(blocked,blocked.duration).point,o=blocked.fixtures[0].point;
 assert.ok(Math.hypot(p.x-o.x,p.y-o.y)>18);assert.equal(trafficState(m,blocked,blocked.duration).actors[0].kind,'obstacle');
});
test('scenario validation does not discard saved maps; no intersection yields explicit note, occupied start rejected',()=>{
 const m=base();m.zones=[single()];const plan=createDispatchPlan(m,'home',['near']);
 assert.equal(applyTrafficScenario(m,plan,{singleRobotZoneId:'single'}).notes.length,1);
 assert.throws(()=>applyTrafficScenario(m,plan,{singleRobotZoneId:'missing'}),/không còn/);
 m.zones=[rect('single','SINGLE_ROBOT',500,200,400,200)];assert.throws(()=>applyTrafficScenario(m,createDispatchPlan(m,'home',['pickup']),{singleRobotZoneId:'single'}),/Điểm xuất phát/);
});
test('furthest/balanced choose deterministically without mutating visit counts; BE rejects demo-only policies',()=>{
 const m=base(),visits={pickup:2,near:0};
 assert.equal(groupCandidates(m,group('FURTHEST'),m.endpoints[0])[0].id,'pickup');
 assert.equal(groupCandidates(m,group('BALANCED'),m.endpoints[0],visits)[0].id,'near');
 m.endpointGroups=[group('BALANCED')];
 assert.equal(createDispatchPlan(m,'home',['group:pickups'],{visits}).resolved[0].id,'near');assert.deepEqual(visits,{pickup:2,near:0});
 const run=createDispatchPlan(m,'home',['group:pickups','group:pickups']);assert.deepEqual(run.resolved.map(e=>e.id),['pickup','near']);
 assert.throws(()=>groupPayload(group('BALANCED'),'map-1'),/mô phỏng/);assert.throws(()=>groupPayload(group('FURTHEST'),'map-1'),/mô phỏng/);
});
