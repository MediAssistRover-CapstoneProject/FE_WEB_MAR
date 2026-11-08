import assert from 'node:assert/strict';
import test from 'node:test';
import { openSetupSession, sameHash, setupContext, setupPendingResolved, setupPiCommand, setupReadiness, setupSeed, setupWriteBlock } from '../src/features/robotOperations/robotSetup.js';

const robotId = '11111111-1111-4111-8111-111111111111', mapId = '22222222-2222-4222-8222-222222222222', sessionId = '33333333-3333-4333-8333-333333333333', hash = 'a'.repeat(64);
const now = Date.now(), time = offset => new Date(now + offset).toISOString();
const map = { mapId, status: 'ACTIVE', originXM: -2, originYM: 3, originYawRad: .4, widthM: 10, heightM: 6 };
function fixture() {
  const snapshot = { robot: { robotId, status: 'IDLE', currentMapId: mapId, mapAssetHash: hash }, observedAt: time(0), mqttConnected: true, heartbeatFresh: true, dispatchReady: true, activeJobId: null,
    navigationSession: { robotId, sessionId, mapId, mapAssetHash: hash, state: 'READY', expiresAt: time(60000), initialization: { revision: 1 } },
    latestPose: { robotId, mapId, frameId: 'map', fresh: true, xM: -2 + Math.cos(.4) * 2 - Math.sin(.4), yM: 3 + Math.sin(.4) * 2 + Math.cos(.4), yawRad: 0, capturedAt: time(0) } };
  return { snapshot, receivedAt: now, map: { ...map }, asset: { mapId, loaded: true, metadata: { asset_hash: hash, frame_id: 'map', navigation_reload_safe: true } }, profile: { robotId, mapId, profileHash: hash, acknowledgedProfileHash: hash, profileAcknowledged: true }, profileContext: setupContext(snapshot), now };
}

test('readiness requires a verified fresh pose, matching live session and acknowledged profile', () => {
  const value = fixture();
  assert.equal(setupReadiness(value).ready, true);
  const cases = [
    v => { v.snapshot.mqttConnected = false; }, v => { v.snapshot.heartbeatFresh = false; }, v => { v.snapshot.dispatchReady = false; },
    v => { v.snapshot.navigationSession.state = 'LOCALIZING'; }, v => { v.snapshot.navigationSession.initialization.revision = 0; },
    v => { v.snapshot.navigationSession.mapAssetHash = 'b'.repeat(64); }, v => { v.snapshot.navigationSession.mapId = 'other'; },
    v => { v.snapshot.robot.currentMapId = 'other'; }, v => { v.snapshot.robot.mapAssetHash = 'b'.repeat(64); },
    v => { v.map.status = 'INACTIVE'; }, v => { v.asset.metadata.navigation_reload_safe = false; },
    v => { v.snapshot.navigationSession.expiresAt = time(-1); }, v => { v.snapshot.navigationSession.robotId = 'other'; },
    v => { v.snapshot.latestPose.fresh = false; }, v => { v.snapshot.latestPose.capturedAt = time(-2501); },
    v => { v.snapshot.latestPose.mapId = 'other'; }, v => { v.snapshot.latestPose.robotId = 'other'; }, v => { v.snapshot.latestPose.frameId = 'odom'; },
    v => { v.snapshot.latestPose.xM = Number.NaN; }, v => { v.snapshot.latestPose.xM = 999; }, v => { v.profile.profileAcknowledged = false; }, v => { v.profile.robotId = 'other'; },
    v => { v.profile.acknowledgedProfileHash = 'b'.repeat(64); }, v => { v.profileContext = 'old initialization'; },
    v => { v.snapshot.activeJobId = 'running'; }, v => { v.snapshot.robot.status = 'BUSY'; }, v => { v.error = 'Disconnected'; },
    v => { v.now += 5001; }, v => { v.snapshot.observedAt = time(-5001); }, v => { v.asset.loaded = false; },
    v => { v.pending = { kind: 'seed' }; },
  ];
  for (const change of cases) { const input = fixture(); change(input); assert.equal(!!setupReadiness(input).ready, false, change.toString()); }
});

test('estimated seeds cannot stand in for the actual robot pose', () => {
  const value = fixture(); value.snapshot.navigationSession.state = 'LOCALIZING';
  value.snapshot.navigationSession.initialization.pose = { x_m: 1, y_m: 4, yaw_rad: 0 };
  assert.equal(setupReadiness(value).pose, null);
  assert.equal(setupReadiness({ ...value, snapshot: null }).ready, false);
});

test('map-origin rotation is honored when choosing a saved seed, including zero values', () => {
  const endpoint = { mapId, active: true, accessible: true, xM: -2 + Math.cos(.4) * 2 - Math.sin(.4), yM: 3 + Math.sin(.4) * 2 + Math.cos(.4), yawRad: 0 };
  assert.deepEqual(setupSeed(endpoint, map), { xM: endpoint.xM, yM: endpoint.yM, yawRad: 0 });
  for (const changes of [{ mapId: 'other' }, { active: false }, { accessible: false }, { xM: 999 }, { yawRad: Number.NaN }, { yawRad: 4 }]) assert.throws(() => setupSeed({ ...endpoint, ...changes }, map));
  assert(sameHash(hash.toUpperCase(), hash)); assert.equal(sameHash(hash, 123), false);
});

test('writes are blocked for old snapshots, wrong operational state and active jobs', () => {
  assert.equal(setupWriteBlock(fixture().snapshot, now, now), '');
  for (const snapshot of [null, { ...fixture().snapshot, activeJobId: 'job' }, { ...fixture().snapshot, robot: { robotId, status: 'BUSY' } }, { ...fixture().snapshot, robot: { robotId, status: 'MAINTENANCE' } }]) assert.ok(setupWriteBlock(snapshot, now, now));
  assert.ok(setupWriteBlock(fixture().snapshot, now - 5001, now));
});

test('unknown initialization outcome cannot be cleared by an unchanged revision', () => {
  const snapshot = fixture().snapshot, pending = { kind: 'seed', robotId, sessionId, revision: 1 };
  assert.equal(setupPendingResolved(pending, snapshot), false);
  snapshot.navigationSession.initialization.revision++;
  assert.equal(setupPendingResolved(pending, snapshot), true);
  assert.equal(setupPendingResolved(pending, { ...snapshot, robot: { robotId: 'other' } }), false);
  assert.equal(setupPendingResolved({ kind: 'open', robotId, mapId, assetHash: hash }, snapshot), true);
  assert.equal(setupPendingResolved({ kind: 'open', robotId, mapId: 'other', assetHash: hash }, snapshot), false);
  assert.equal(setupPendingResolved({ kind: 'close', robotId, sessionId }, snapshot), false);
  snapshot.navigationSession.state = 'CLOSED';
  assert.equal(setupPendingResolved({ kind: 'close', robotId, sessionId }, snapshot), true);
});

test('Pi launch commands accept only validated session identifiers', () => {
  assert.ok(openSetupSession(fixture().snapshot.navigationSession, now));
  assert.ok(setupPiCommand({ sessionId }).endsWith('--session-id ' + sessionId));
  assert.equal(setupPiCommand({ sessionId: '$(bad command)' }), '');
});
