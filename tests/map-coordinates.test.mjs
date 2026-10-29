import test from 'node:test';
import assert from 'node:assert/strict';
import { endpointHeading, insideMap, mapGeometry, snapMapPoint } from '../src/features/facility/mapCoordinates.js';
const metadata={width_px:200,height_px:100,resolution_m_per_pixel:.05,origin_x_m:-3,origin_y_m:-2,origin_yaw_rad:0};
test('uses saved image dimensions and snaps endpoint coordinates to a cell centre',()=>{
  const map=mapGeometry(metadata);assert.equal(map.widthM,10);assert.equal(map.heightM,5);
  assert.deepEqual(snapMapPoint(map,-2.99,-1.99),{xM:-2.975,yM:-1.975});
  assert.equal(snapMapPoint(map,-3.1,-2),null);assert.equal(snapMapPoint(map,7,0),null);
});
test('matches HTML PNG edges and uses row centres from the top of the image',()=>{
  const map=mapGeometry(metadata);
  assert.equal(insideMap(map,-3,3),true);
  assert.equal(insideMap(map,-3,-2),false);
  assert.deepEqual(snapMapPoint(map,-3,3),{xM:-2.975,yM:2.975});
  assert.deepEqual(snapMapPoint(map,0,0),{xM:.025,yM:-.025});
});
test('drag directions are world angles in radians',()=>{
  const start={xM:2,yM:3};
  assert.equal(endpointHeading(start,{xM:2,yM:5}),Math.PI/2);
  assert.equal(endpointHeading(start,{xM:2,yM:1}),-Math.PI/2);
  assert.equal(endpointHeading(start,{xM:5,yM:3}),0);
});
test('rotated origins produce world coordinates for endpoint API',()=>{
  const map=mapGeometry({...metadata,origin_yaw_rad:Math.PI/2});
  assert.deepEqual(snapMapPoint(map,-3.01,-1.99),{xM:-3.025,yM:-1.975});
  assert.throws(()=>mapGeometry({...metadata,resolution_m_per_pixel:0}));
});
