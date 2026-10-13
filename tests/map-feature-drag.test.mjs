import test from 'node:test';
import assert from 'node:assert/strict';
import {dragFeature} from '../src/pages/Admin/mapFeatureDrag.js';
const zone={id:'z',name:'Vùng A',points:[{x:100,y:100},{x:200,y:100},{x:200,y:200},{x:100,y:200}]};
test('zone drag translates every vertex equally without changing the original',()=>{
  const moved=dragFeature(zone,'zone',{x:150,y:150},{x:187.2,y:131.9});
  assert.deepEqual(moved.points,zone.points.map(p=>({x:p.x+37,y:p.y-18})));
  assert.equal(zone.points[0].x,100);assert.equal(moved.id,zone.id);
});
test('zone drag clamps the entire shape at map boundaries',()=>{
  assert.deepEqual(dragFeature(zone,'zone',{x:150,y:150},{x:-1000,y:2000}).points,[{x:0,y:580},{x:100,y:580},{x:100,y:680},{x:0,y:680}]);
});
test('vertex drag updates only the selected corner',()=>{
  const moved=dragFeature(zone,'vertex',{x:200,y:100},{x:225,y:120},1);
  assert.deepEqual(moved.points,[zone.points[0],{x:225,y:120},zone.points[2],zone.points[3]]);
});
test('endpoint drag keeps click offset, heading and saved metadata',()=>{
  const point={id:'e',x:580,y:330,heading:92,tasks:[{action:'WAIT',seconds:4}],group:'existing'};
  const moved=dragFeature(point,'endpoint',{x:586,y:334},{x:636,y:351});
  assert.deepEqual(moved,{...point,x:630,y:347,placed:true});
});
