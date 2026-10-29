import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPose } from '../src/features/robotOperations/mapPose.js';
const now = Date.parse('2026-10-29T06:00:00Z');
const state = () => ({state:'MAPPING',potentially_open:true,mapping_session_id:'s',preview:{mapping_session_id:'s',revision:5,width:200,height:100,resolution:.1,origin:[-5,-2,0],captured_at:new Date(now).toISOString(),pose:{fresh:true,age_sec:.1,value:{x_m:5,y_m:3,yaw_rad:Math.PI/2}}}});
test('places robot in map pixels with inverted image Y and heading', () => {
  const point=mapPose(state(),'5',now);
  assert.equal(point.x,100); assert.equal(point.y,50); assert.equal(point.angle,-90);
});
test('supports rotated map origins', () => {
  const s=state();s.preview.origin=[0,0,Math.PI/2];s.preview.pose.value={x_m:-3,y_m:5,yaw_rad:Math.PI/2};
  const p=mapPose(s,5,now);assert.ok(Math.abs(p.x-50)<1e-8);assert.ok(Math.abs(p.y-70)<1e-8);assert.ok(Math.abs(p.angle)<1e-8);
});
test('hides stale, mismatched, closed, out of bounds and invalid poses', () => {
  assert.equal(mapPose(state(),6,now).x,undefined);
  assert.equal(mapPose(state(),5,now+2600).x,undefined);
  for(const change of [s=>s.potentially_open=false,s=>s.preview.mapping_session_id='other',s=>s.preview.pose.fresh=false,s=>s.preview.pose.value.x_m=1000,s=>s.preview.resolution=0]) {
    const s=state();change(s);assert.equal(mapPose(s,5,now).x,undefined);
  }
});
