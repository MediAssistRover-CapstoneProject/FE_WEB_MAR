import test from 'node:test';
import assert from 'node:assert/strict';
import {groupError,groupCandidates,groupsFor} from '../src/features/facility/endpointGroups.js';
import {groupPayload,groupFromApi,zonePayload,endpointPayload} from '../src/features/facility/facilityContract.js';
import {createDraft,saveMap,loadDraft} from '../src/pages/Admin/mapStudioModel.js';
import {createDispatchPlan} from '../src/pages/Workstations/mapDispatchModel.js';
const endpoints=[{id:'home',name:'Gốc',type:'HOME',x:580,y:330,heading:0},{id:'far',name:'Nhận hàng',type:'PICKUP',x:815,y:245,heading:90},{id:'near',name:'Nhận tại sảnh',type:'PICKUP',x:600,y:360,heading:0}];
const group={id:'g1',code:'NHAN',name:'Quầy nhận',selectionPolicy:'PRIORITY',allowFallback:false,active:true,members:[{endpointId:'far',sequenceNo:1,active:true},{endpointId:'near',sequenceNo:2,active:true}]};
const map=()=>({...createDraft(),scan:{status:'complete',progress:100},endpoints:structuredClone(endpoints),endpointGroups:[structuredClone(group)]});
test('group validates duplicate membership/order/map scope without enforcing identical endpoint types',()=>{
 assert.equal(groupError(group,[group],endpoints),'');
 for(const members of [[...group.members,group.members[0]],[{...group.members[0],endpointId:'other-map'}],[group.members[0],{...group.members[1],sequenceNo:1}]])assert.ok(groupError({...group,members},[group],endpoints));
});
test('PRIORITY, nearest and inactive members produce different deterministic candidates',()=>{
 const m=map();assert.deepEqual(groupCandidates(m,group,endpoints[0]).map(e=>e.id),['far','near']);
 assert.deepEqual(groupCandidates(m,{...group,selectionPolicy:'NEAREST_REACHABLE'},endpoints[0]).map(e=>e.id),['near','far']);
 assert.deepEqual(groupCandidates(m,{...group,active:false},endpoints[0]),[]);
 m.endpoints[1].accessible=false;assert.deepEqual(groupCandidates(m,group,endpoints[0]).map(e=>e.id),['near']);
});
test('dispatch actually uses group policy, persists group identity and immutable membership',()=>{
 const m=map();assert.equal(createDispatchPlan(m,'home',['group:g1']).resolved[0].id,'far');
 m.endpointGroups[0].selectionPolicy='NEAREST_REACHABLE';assert.equal(createDispatchPlan(m,'home',['group:g1']).resolved[0].id,'near');
 const saved=saveMap(m,'test');m.endpointGroups[0].members=[];assert.equal(saved.saved.snapshot.endpointGroups[0].members.length,2);
 assert.equal(loadDraft({getItem:()=>JSON.stringify(saved)}).endpointGroups[0].id,'g1');
});
test('fallback flag gates moving to a later candidate when first route is blocked',()=>{
 const m=map();m.zones=[{id:'barrier',name:'Chặn cửa',type:'EXCLUSION',points:[{x:790,y:310},{x:915,y:310},{x:915,y:350},{x:790,y:350}]}];
 assert.throws(()=>createDispatchPlan(m,'home',['group:g1']),/không cho phép/);
 m.endpointGroups[0].allowFallback=true;assert.equal(createDispatchPlan(m,'home',['group:g1']).resolved[0].id,'near');
});
test('legacy endpoint names migrate to stable group IDs without mutating old storage',()=>{
 const m=map();delete m.endpointGroups;m.endpoints[1].group='Cũ';const g=groupsFor(m)[0];assert.equal(g.id,'Cũ');assert.equal(g.members[0].endpointId,'far');assert.equal(m.endpointGroups,undefined);
});
test('BE group request is DTO exact and membership is separate',()=>{
 const payload=groupPayload(group,'map-a');assert.deepEqual(Object.keys(payload).sort(),['mapId','groupCode','groupName','selectionPolicy','allowFallback','description','active'].sort());
 const normalized=groupFromApi({endpointGroupId:'g1',...payload},[{endpointGroupId:'g1',endpointId:'e',sequenceNo:1,active:false},{endpointGroupId:'g2',endpointId:'wrong',sequenceNo:1,active:true}]);assert.equal(normalized.members.length,1);assert.equal(normalized.members[0].active,false);
});
const zone={zoneCode:'WAIT',zoneName:'Khu chờ',zoneType:'WAITING',polygonJson:'{"points":[[0,0],[2,0],[2,2]]}',speedLimitMps:'.4',capacityLimit:20,calibratedAreaM2:12,cameraSourceRef:'cam-1',cameraRoiJson:'{"roi":[0,0,1,1]}',active:true,publicVisible:false};
test('BE zones retain category independently from local navigation rules',()=>{
 const p=zonePayload(zone,'map-a');assert.equal(p.speedLimitMps,.4);assert.equal(p.zoneType,'WAITING');assert.equal(p.capacityLimit,20);assert.deepEqual(p.polygonJson.points[1],[2,0]);
 assert.throws(()=>zonePayload({...zone,zoneType:'EXCLUSION'},'map-a'),/Loại vùng/);
 assert.throws(()=>zonePayload({...zone,capacityLimit:1.5},'map-a'),/số nguyên/);
 assert.throws(()=>zonePayload({...zone,cameraRoiJson:'{'},'map-a'),/JSON/);
 assert.throws(()=>zonePayload({...zone,polygonJson:'{"points":[[0,0],[1,1],[2,2]]}'},'map-a'),/diện tích/);
 assert.throws(()=>zonePayload({...zone,polygonJson:'{"points":[[0,0],[5,4],[1,4],[4,0]]}'},'map-a'),/tự cắt/);
});
test('BE endpoints use meters/radians and reject cross-map or cross-floor references',()=>{
 const form={endpointCode:'E1',endpointName:'Quầy',endpointType:'PICKUP',xM:-2,yM:4,yawRad:1.5708,active:true,accessible:true,publicVisible:false};
 const m={mapId:'map-a',floorId:'f1'},z=[{zoneId:'z',mapId:'map-b'}],rooms=[{roomId:'r',floorId:'f2'}];
 assert.equal(endpointPayload(form,m,z,rooms).xM,-2);
 assert.throws(()=>endpointPayload({...form,zoneId:'z'},m,z,rooms),/cùng bản đồ/);
 assert.throws(()=>endpointPayload({...form,roomId:'r'},m,z,rooms),/thuộc tầng/);
 assert.throws(()=>endpointPayload({...form,yawRad:90},m,z,rooms),/radian/);
 assert.throws(()=>endpointPayload({...form,endpointType:'CHARGING'},m,z,rooms),/Loại điểm/);
});
