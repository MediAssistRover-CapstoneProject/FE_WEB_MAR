import test from 'node:test';
import assert from 'node:assert/strict';
import { zonePayload } from '../src/features/facility/facilityContract.js';
import { saveValidatedEndpoint } from '../src/features/facility/navigationPoint.js';

const map={mapId:'map-a',floorId:'floor-a',originXM:0,originYM:0,originYawRad:0,widthM:10,heightM:10};
const point={endpointCode:'A',endpointName:'Quầy A',endpointType:'WAYPOINT',xM:2,yM:3,yawRad:0,active:true,accessible:true,publicVisible:false};
const zone={zoneCode:'SLOW',zoneName:'Khu chậm',zoneType:'SPEED',polygonJson:{points:[[0,0],[2,0],[2,2]]},active:true};

test('SPEED zone matches BE required range (0, 0.8] before any request',()=>{
  for(const speedLimitMps of ['',null,undefined,0,-0.1,0.800001,1,'no speed'])assert.throws(()=>zonePayload({...zone,speedLimitMps},map.mapId));
  for(const speedLimitMps of [0.001,0.8,'0.4'])assert.equal(zonePayload({...zone,speedLimitMps},map.mapId).speedLimitMps,Number(speedLimitMps));
  assert.equal(zonePayload({...zone,zoneType:'NO_STOP',speedLimitMps:''},map.mapId).speedLimitMps,null,'Existing metadata-only NO_STOP remains editable');
});

test('endpoint write follows verified free-cell response and keeps exact coordinates',async()=>{
  const calls=[];
  const api={
    validateNavigationPoint:async(id,body)=>{calls.push(['verify',id,body]);return {mapId:id,knownFree:true};},
    createEndpoint:async body=>{calls.push(['create',body]);return {...body,endpointId:'endpoint-new'};},
    updateEndpoint:async(id,body)=>{calls.push(['update',id,body]);return {...body,endpointId:id};},
  };
  const created=await saveValidatedEndpoint(api,point,map,[],[]);
  assert.deepEqual(calls[0],['verify','map-a',{xM:2,yM:3}]);
  assert.equal(calls[1][0],'create');assert.equal(created.endpointId,'endpoint-new');
  calls.length=0;
  await saveValidatedEndpoint(api,{...created,publicVisible:true},map,[],[]);
  assert.equal(calls[0][0],'verify');assert.equal(calls[1][0],'update');assert.equal(calls[1][1],'endpoint-new');
  assert.equal(calls[1][2].publicVisible,true,'Publishing cannot bypass occupancy validation');
});

test('blocked/unknown/mismatched cells and verification errors never save endpoint',async()=>{
  let writes=0;
  for(const response of [{mapId:'map-a',knownFree:false},{mapId:'map-other',knownFree:true},null]){
    const api={validateNavigationPoint:async()=>response,createEndpoint:async()=>writes++,updateEndpoint:async()=>writes++};
    await assert.rejects(saveValidatedEndpoint(api,point,map,[],[]),/chưa xác nhận/);
  }
  const api={validateNavigationPoint:async()=>{throw Error('Point is occupied');},createEndpoint:async()=>writes++};
  await assert.rejects(saveValidatedEndpoint(api,point,map,[],[]),/occupied/);
  assert.equal(writes,0);
});

test('invalid map bounds are rejected before verification or persistence',async()=>{
  let called=false;
  const api={validateNavigationPoint:async()=>{called=true;}};
  await assert.rejects(saveValidatedEndpoint(api,{...point,xM:99},map,[],[]),/trong ảnh bản đồ/);
  assert.equal(called,false);
});
