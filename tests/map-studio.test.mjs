import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, createDraft, stageEnabled, loadDraft, STORAGE_KEY, freePoint, zoneError, endpointError, changeDraft, saveMap, mapIssues, exportMap } from '../src/pages/Admin/mapStudioModel.js';
import { SCAN_PATH, rayHits } from '../src/pages/Admin/lidarGeometry.js';
const rectangle=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const zone=(points,type='NO_STOP')=>({id:'z1',name:'Zone A',type,speed:.3,points});
const endpoint=(patch={})=>({id:'e1',name:'Home',type:'PARK',x:580,y:330,heading:90,...patch});
const captured=()=>({...createDraft(),scan:{status:'complete',progress:100}});
test('exactly three steps; raw scan carries no semantic labels or navigation data',()=>{
  const d=createDraft();
  assert.deepEqual(STAGES.map(s=>s[0]),['scan','zone','endpoint']);
  assert.deepEqual(d.zones,[]);assert.deepEqual(d.endpoints,[]);
  assert.equal(stageEnabled(d,'endpoint'),false);
  d.scan={status:'captured',progress:100};assert.equal(stageEnabled(d,'zone'),false);
  d.scan.status='complete';assert.equal(stageEnabled(d,'zone'),true);assert.equal(stageEnabled(d,'endpoint'),true);
  assert.equal(stageEnabled(d,'publish'),false);
});
test('separate storage schema preserves legacy data and resumes recording as paused',()=>{
  const reads=[];const d=createDraft();d.scan={status:'running',progress:40};
  const result=loadDraft({getItem:key=>{reads.push(key);return JSON.stringify(d);}});
  assert.deepEqual(reads,[STORAGE_KEY]);assert.equal(result.scan.status,'paused');
  assert.equal(loadDraft({getItem:()=>JSON.stringify({schema:2})}).scan.status,'idle');
  assert.equal(loadDraft({getItem:()=>'{broken'}).scan.status,'idle');
});
test('endpoint placement rejects unknown space, walls and furniture',()=>{
  assert.equal(freePoint({x:10,y:10}),false);
  assert.equal(freePoint({x:640,y:280}),false);
  assert.equal(freePoint({x:125,y:270}),false);
  assert.equal(freePoint({x:580,y:330}),true);
});
test('the compact scan robot fits through mapped door openings',()=>{
  assert.equal(freePoint({x:548,y:240},6),true);
  assert.equal(freePoint({x:513,y:230},6),true);
  assert.equal(freePoint({x:607,y:230},6),true);
  assert.equal(freePoint({x:268,y:415},6),true);
  assert.equal(freePoint({x:317,y:415},6),true);
  assert.equal(freePoint({x:353,y:415},6),true);
  assert.equal(freePoint({x:417,y:415},6),true);
});
test('manual scans reject endpoints outside the recorded LiDAR trail',()=>{
  const d=captured();d.scan.trail=[{x:580,y:330}];
  assert.equal(endpointError(d,endpoint()),'');
  assert.match(endpointError(d,endpoint({x:815,y:245})),/recorded by LiDAR/);
});
test('the simulated survey path stays in free space',()=>{
  SCAN_PATH.slice(1).forEach((b,i)=>{const a=SCAN_PATH[i];for(let t=0;t<=1;t+=.05)assert.ok(freePoint({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},2),'Survey must not cross a wall or obstacle');});
  assert.equal(rayHits({x:580,y:330}).length,64);
});
test('zone polygons reject invalid geometry but may overlay occupied or unknown space (OTTO)',()=>{
  const d=captured();
  assert.equal(zoneError(d,zone(rectangle(330,320,80,55))),'');
  assert.match(zoneError(d,zone([{x:330,y:320},{x:420,y:390},{x:420,y:320},{x:330,y:390}])),/cross/);
  assert.match(zoneError(d,zone([{x:330,y:320},{x:330,y:320},{x:410,y:370}])),/distinct/);
  assert.equal(zoneError(d,zone(rectangle(10,10,30,30))),'');
  assert.match(zoneError(d,zone(rectangle(330,330,3,3))),/larger/);
});
test('zone and endpoint guards enforce exclusion rules in both editing directions',()=>{
  const d=captured();const z=zone(rectangle(540,315,80,30),'KEEP_OUT');
  d.zones=[z];assert.match(endpointError(d,endpoint()),/KEEP_OUT/);
  d.zones=[];d.endpoints=[endpoint()];assert.match(zoneError(d,z),/phủ lên điểm đích/);
});
test('speed parameters and canonical zone values are validated',()=>{
  const d=captured();
  assert.match(zoneError(d,{...zone(rectangle(330,320,80,55),'SPEED'),speed:0}),/speed/);
  assert.match(zoneError(d,zone(rectangle(330,320,80,55),'AREA')),/zone type/);
  assert.equal(zoneError(d,zone(rectangle(330,320,80,55),'NO_STOP')),'');
});
test('endpoint names and separation are validated without requiring arrival heading',()=>{
  const d=captured();d.endpoints=[endpoint()];
  assert.match(endpointError(d,endpoint({id:'e2',name:'Home',x:400})),/already exists/);
  assert.match(endpointError(d,endpoint({id:'e2',name:'Other',x:582})),/apart/);
  assert.equal(endpointError(d,endpoint({heading:undefined})),'');
  assert.equal(endpointError(d,endpoint({name:'Updated'})),'');
});
test('save requires finished scan and endpoint, keeps snapshot stable after edits',()=>{
  let d=createDraft();assert.equal(saveMap(d,'now').saved,null);
  d=captured();d.endpoints=[endpoint()];assert.deepEqual(mapIssues(d),[]);
  d=saveMap(d,'2026-10-13');assert.equal(d.saved.revision,0);
  const next=changeDraft(d,{endpoints:[endpoint({name:'Changed'})]});
  assert.notEqual(next.saved.revision,next.revision);assert.equal(next.saved.snapshot.endpoints[0].name,'Home');
  assert.equal(exportMap(next).mode,'local-lidar-demo');assert.ok(exportMap(next).geometry.walls.length>20);
});
