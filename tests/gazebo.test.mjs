import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {localMockMap as m,pixelToRos,rosToPixel,pixelToWeb,webToPixel,webToRos,rosToWeb,rosToThree,freeWebPoint,mapBinding,isCurrentMap} from '../src/features/maps/MapProvider.js';
import {routeRequest} from '../src/features/gazebo/gazeboModel.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('provider binds exact local YAML + PGM, no database map',()=>{
 const root=new URL('../public/mock-map-4b43a4f2/',import.meta.url);
 const hash=createHash('sha256').update(readFileSync(new URL('map.yaml',root))).update(readFileSync(new URL('map.pgm',root))).digest('hex');
 assert.equal(m.mapVersion,hash);assert.equal(m.sourceType,'LOCAL_MOCK');assert.equal(m.width,235);assert.equal(m.height,207);
 assert.deepEqual(m.counts,{free:23038,occupied:2694,unknown:22913});
 assert.equal(isCurrentMap({mapSource:mapBinding()}),true);assert.equal(isCurrentMap({mapSource:{...mapBinding(),mapVersion:'old'}}),false);
});
test('pixel, ROS, web and Three landmarks round trip including rotated origin',()=>{
 for(const model of [m,{...m,origin:[-3,4,.73]}])for(const p of [{x:0,y:0},{x:m.width,y:m.height},{x:149.5,y:143.5}]){
  const ros=pixelToRos(p,model),back=rosToPixel(ros,model),web=pixelToWeb(p,model),pixel=webToPixel(web,model);
  close(back.x,p.x);close(back.y,p.y);close(pixel.x,p.x);close(pixel.y,p.y);
  const pose={...ros,yaw:.9},again=webToRos(rosToWeb(pose,model),model);
  close(again.x,pose.x);close(again.y,pose.y);close(again.yaw,pose.yaw);
  assert.deepEqual(rosToThree(ros),{x:ros.x,y:0,z:-ros.y});
 }
 close(pixelToRos({x:0,y:m.height}).x,m.origin[0]);close(pixelToRos({x:0,y:m.height}).y,m.origin[1]);
});
test('geometry covers occupied cells exactly once, no free or unknown cells',()=>{
 const coverage=new Uint8Array(m.width*m.height);
 for(const ob of m.obstacleGeometry){const r=ob.sourcePixels;assert.equal(ob.height,1);assert.equal(ob.provenance,'PGM_OCCUPIED_RECTANGLE_EXACT');
  const center=pixelToRos({x:r.x+r.width/2,y:r.y+r.height/2});close(center.x,ob.position[0]);close(center.y,ob.position[1]);
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)coverage[y*m.width+x]++;
 }
 m.occupancyGrid.forEach((v,i)=>assert.equal(coverage[i],v===100?1:0));
 assert.deepEqual(m.doorGeometry,[]);assert.deepEqual(m.wallGeometry,[]);
});
test('unknown/outside blocked and spawn has footprint clearance',()=>{
 assert.equal(freeWebPoint(rosToWeb(m.spawn),.3),true);
 assert.equal(freeWebPoint(pixelToWeb({x:-1,y:0}),.3),false);
 const i=m.occupancyGrid.indexOf(-1);assert.equal(freeWebPoint(pixelToWeb({x:i%m.width+.5,y:Math.floor(i/m.width)+.5})),false);
});
test('MOVE request preserves workflow order and calibrated coordinates',()=>{
 const points=[0,.4].map((dx,i)=>({endpoint:{id:`ep${i}`,name:`Point ${i}`,...rosToWeb({...m.spawn,x:m.spawn.x+dx})},step:{paramsJson:{max_speed_mps:.15}}}));
 const body=routeRequest({valid:true,points});assert.equal(body.commandType,'START_PATROL');assert.equal(body.mapId,m.mapId);
 assert.deepEqual(body.steps.map(s=>s.endpointId),['ep0','ep1']);close(body.steps[1].x,m.spawn.x+.4);close(body.steps[1].y,m.spawn.y);
 assert.throws(()=>routeRequest({valid:false,points}));
});
