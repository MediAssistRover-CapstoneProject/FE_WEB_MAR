import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,zoneError,endpointError,saveMap,loadDraft,pointAllowed} from '../src/pages/Admin/mapStudioModel.js';
import {ZONE_TYPES} from '../src/pages/Admin/zoneCatalog.js';
import {findRoute,createDispatchPlan,travelSpeed} from '../src/pages/Workstations/mapDispatchModel.js';

const rect=(id,type,x,y,w,h)=>({id,name:id,type,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],speed:.3});
const base=()=>({...createDraft(),scan:{status:'complete',progress:100},endpoints:[
  {id:'park',name:'Gốc',type:'PARK',x:580,y:330},
  {id:'target',name:'Đích',type:'WAYPOINT',x:815,y:245},
]});

test('zone catalog contains exactly the canonical contract values',()=>{
  assert.deepEqual(ZONE_TYPES.map(type=>type.id),['KEEP_OUT','SPEED','NO_STOP']);
  assert.equal(new Set(ZONE_TYPES.map(type=>type.id)).size,3);
  assert.ok(ZONE_TYPES.every(type=>!zoneError(base(),rect(type.id,type.id,330,320,80,55))));
  assert.match(zoneError(base(),rect('legacy','EXCLUSION',330,320,80,55)),/Select a zone type/);
});

test('KEEP_OUT blocks travel and SPEED changes travel duration',()=>{
  const map=base();
  map.zones=[rect('blocked','KEEP_OUT',790,310,125,40)];
  assert.throws(()=>findRoute(map,map.endpoints[0],map.endpoints[1]),/Không có tuyến/);
  map.zones=[{...rect('slow','SPEED',500,315,400,32),speed:.1}];
  assert.equal(travelSpeed(map,{x:580,y:330}),.1);
  assert.ok(createDispatchPlan(map,'park',['target']).duration>0);
});

test('NO_STOP permits transit but rejects endpoints inside the zone',()=>{
  const map=base();
  const zone=rect('no-stop','NO_STOP',500,300,160,80);
  map.zones=[zone];
  assert.equal(pointAllowed(map,{x:580,y:330}),true);
  assert.match(endpointError(map,map.endpoints[0]),/NO_STOP/);
  map.zones=[];map.endpoints=[];
  const saved=saveMap({...map,endpoints:[{id:'park',name:'Gốc',type:'PARK',x:580,y:330}]},'test');
  assert.deepEqual(loadDraft({getItem:()=>JSON.stringify(saved)}),saved);
});
