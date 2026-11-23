import test from 'node:test';
import assert from 'node:assert/strict';
import { patrolMapPose, patrolPresentationMatrix } from '../src/features/patrol/patrolMapModel.js';
import { jobStatus, jobStopPending } from '../src/features/patrol/patrolModel.js';

const now = Date.parse('2026-11-22T03:00:00Z');
const metadata = { map_id: 'map-1', asset_hash: 'hash-1', frame_id: 'map' };
const geometry = { originXM: 5, originYM: -3, originYawRad: Math.PI / 2, widthM: 10, heightM: 6 };
const fixture = () => ({ robot: { robotId: 'robot-1', currentMapId: 'map-1', mapAssetHash: 'hash-1' }, observedAt: new Date(now).toISOString(), mqttConnected: true, heartbeatFresh: true, latestPose: { robotId: 'robot-1', mapId: 'map-1', xM: 2, yM: 2, yawRad: .3, frameId: 'map', fresh: true, capturedAt: new Date(now - 1000).toISOString() } });

test('published floorplan keeps world positions aligned for non-zero and rotated map origins', () => {
  const [a, b, c, d, e, f] = patrolPresentationMatrix(geometry);
  // World (2,2) is local (5,3) on a map based at (5,-3) and rotated 90 degrees.
  assert.ok(Math.abs(a * 2 + c * -2 + e - 5) < 1e-9);
  assert.ok(Math.abs(b * 2 + d * -2 + f - 3) < 1e-9);
});

test('map marker requires a real matching pose inside the rotated saved raster', () => {
  assert.equal(patrolMapPose(fixture(), metadata, geometry, now)?.live, true);
  for (const change of [
    data => { data.robot.currentMapId = 'other'; },
    data => { data.robot.mapAssetHash = 'other'; },
    data => { data.latestPose.mapId = 'other'; },
    data => { data.latestPose.robotId = 'other'; },
    data => { data.latestPose.frameId = 'odom'; },
    data => { data.latestPose.xM = 50; },
    data => { data.latestPose.yawRad = NaN; },
  ]) { const data = fixture(); change(data); assert.equal(patrolMapPose(data, metadata, geometry, now), null); }
  assert.equal(patrolMapPose({}, metadata, geometry, now), null);
});
test('old or disconnected pose is clearly stale and is never animated as live', () => {
  for (const change of [
    data => { data.latestPose.capturedAt = new Date(now - 16000).toISOString(); },
    data => { data.observedAt = new Date(now - 21000).toISOString(); },
    data => { data.latestPose.fresh = false; },
    data => { data.heartbeatFresh = false; },
    data => { data.mqttConnected = false; },
    data => { data.latestPose.capturedAt = new Date(now + 10000).toISOString(); },
  ]) { const data = fixture(); change(data); assert.equal(patrolMapPose(data, metadata, geometry, now)?.live, false); }
});
test('terminal cancellation displays completed stop separately from a pending physical stop', () => {
  const base = { status: 'CANCELLED', cancelRequestedAt: new Date(now).toISOString() };
  for (const stopStatus of ['CONFIRMED', 'NOT_REQUIRED']) {
    assert.equal(jobStopPending({ ...base, stopStatus }), false);
    assert.equal(jobStatus({ ...base, stopStatus }).label, 'Đã kết thúc');
  }
  assert.equal(jobStopPending({ ...base, stopStatus: 'PENDING' }), true);
  assert.equal(jobStatus({ ...base, stopStatus: 'PENDING' }).label, 'Đang chờ kết thúc an toàn');
  assert.equal(jobStatus({ ...base, stopStatus: 'RECOVERY_REQUIRED' }).label, 'Cần xác nhận dừng');
});
