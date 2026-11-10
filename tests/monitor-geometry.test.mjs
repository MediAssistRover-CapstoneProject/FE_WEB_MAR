import test from 'node:test';
import assert from 'node:assert/strict';
import { imagePoint, freshMonitorPose, matchingPlan, monitorPoseView } from '../src/features/operations/monitorGeometry.js';

test('inverse map transform preserves pixel centres with translated rotated maps', () => {
  for (const yaw of [0, Math.PI / 2, -.7]) {
    const r = .025, h = 188, c = Math.cos(yaw), s = Math.sin(yaw);
    const matrix = [[r*c,r*s,-3+r*c*.5-r*s*(h-.5)],[r*s,-r*c,2+r*s*.5+r*c*(h-.5)],[0,0,1]];
    const metadata = { width_px:231, height_px:h, pixel_center_to_map:matrix };
    for (const [u,v] of [[0,0],[115,90],[230,187]]) {
      const point = { xM:matrix[0][0]*u+matrix[0][1]*v+matrix[0][2], yM:matrix[1][0]*u+matrix[1][1]*v+matrix[1][2] };
      const pixel=imagePoint(point,metadata);
      assert.ok(Math.abs(pixel.x-u-.5)<1e-9);
      assert.ok(Math.abs(pixel.y-v-.5)<1e-9);
    }
    assert.equal(imagePoint({xM:1000,yM:1000},metadata),null);
  }
});

test('old, disconnected and wrong-map poses are excluded', () => {
  const now=Date.now();
  const snapshot={mqttConnected:true,heartbeatFresh:true,robot:{currentMapId:'map'},latestPose:{mapId:'map',frameId:'map',fresh:true,yawRad:0,capturedAt:new Date(now).toISOString()}};
  assert.ok(freshMonitorPose(snapshot,now));
  assert.equal(freshMonitorPose(snapshot,now+6000),null);
  assert.equal(freshMonitorPose({...snapshot,mqttConnected:false},now),null);
  assert.equal(freshMonitorPose({...snapshot,robot:{currentMapId:'other'}},now),null);
});

test('a navigation path must belong to the current job step, session and map asset', () => {
  const metadata={map_id:'map',asset_hash:'hash'};
  const job={jobId:'job',status:'RUNNING'};
  const snapshot={mqttConnected:true,heartbeatFresh:true,activeJobId:'job',selectedJobStepId:'step',navigationSession:{sessionId:'session'},navigationPlan:{jobId:'job',jobStepId:'step',sessionId:'session',mapId:'map',mapAssetHash:'hash',frameId:'map',points:[]}};
  assert.ok(matchingPlan(snapshot,metadata,job));
  assert.equal(matchingPlan(snapshot,{...metadata,asset_hash:'other'},job),null);
  assert.equal(matchingPlan({...snapshot,selectedJobStepId:'other'},metadata,job),null);
});

test('stream pose is scoped, remembered as stale and cleared on session/map/revision/job changes', () => {
  const now = Date.now(), time = offset => new Date(now + offset).toISOString(), hash = 'a'.repeat(64);
  const metadata = { map_id: 'map', asset_hash: hash, frame_id: 'map', width_px: 100, height_px: 100, resolution_m_per_pixel: .1, origin_x_m: 0, origin_y_m: 0, origin_yaw_rad: 0, pixel_center_to_map: [[.1, 0, .05], [0, -.1, 9.95], [0, 0, 1]] };
  const snapshot = { robot: { robotId: 'robot', currentMapId: 'map', mapAssetHash: hash }, mqttConnected: true, heartbeatFresh: true,
    navigationSession: { sessionId: 'session', state: 'READY', mapId: 'map', mapAssetHash: hash, initialization: { revision: 1 } } };
  const livePose = { receivedAt: now, value: { messageType: 'NAVIGATION_POSE', robotId: 'robot', mapId: 'map', mapAssetHash: hash, navigationSessionId: 'session', initializationRevision: 1, receivedAt: time(0), capturedAt: time(0), pose: { xM: 2, yM: 2, yawRad: 0 } } };
  const input = { snapshot, livePose, metadata, fresh: true, now, job: { jobId: 'job' } };
  const valid = monitorPoseView(null, input); assert.equal(valid.live, true);
  const stale = monitorPoseView(valid.memory, { ...input, now: now + 2000 });
  assert.equal(stale.live, false); assert.equal(stale.pose.xM, 2);
  assert.equal(monitorPoseView(valid.memory, { ...input, snapshot: { ...snapshot, mqttConnected: false }, now: now + 4000 }).live, false);
  assert.equal(monitorPoseView(valid.memory, { ...input, now: now + 61000 }).pose, null);
  for (const changes of [{ initialization: { revision: 2 } }, { sessionId: 'other' }, { state: 'CLOSED' }]) {
    assert.equal(monitorPoseView(valid.memory, { ...input, snapshot: { ...snapshot, navigationSession: { ...snapshot.navigationSession, ...changes } }, now: now + 2000 }).pose, null);
  }
  assert.equal(monitorPoseView(valid.memory, { ...input, metadata: { ...metadata, asset_hash: 'b'.repeat(64) } }).pose, null);
  assert.equal(monitorPoseView(valid.memory, { ...input, fresh: false, job: { jobId: 'other' } }).pose, null);
});
