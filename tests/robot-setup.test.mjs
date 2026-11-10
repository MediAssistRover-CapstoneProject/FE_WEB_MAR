import assert from 'node:assert/strict';
import test from 'node:test';
import { openSetupSession, sameHash, setupConnection, setupContext, setupNextExpiry, setupPendingResolved, setupPiCommand, setupReadiness, setupSeed, setupWriteBlock } from '../src/features/robotOperations/robotSetup.js';
import { consumeSetupEvents, newerSetupPose } from '../src/features/robotOperations/robotSetupStream.js';

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
    v => { v.snapshot.latestPose.fresh = false; }, v => { v.snapshot.latestPose.capturedAt = time(-5001); },
    v => { v.snapshot.latestPose.mapId = 'other'; }, v => { v.snapshot.latestPose.robotId = 'other'; }, v => { v.snapshot.latestPose.frameId = 'odom'; },
    v => { v.snapshot.latestPose.xM = Number.NaN; }, v => { v.snapshot.latestPose.xM = 999; }, v => { v.profile.profileAcknowledged = false; }, v => { v.profile.robotId = 'other'; },
    v => { v.profile.acknowledgedProfileHash = 'b'.repeat(64); }, v => { v.profileContext = 'old initialization'; },
    v => { v.snapshot.activeJobId = 'running'; }, v => { v.snapshot.robot.status = 'BUSY'; }, v => { v.error = 'Disconnected'; },
    v => { v.now += 5001; }, v => { v.snapshot.observedAt = time(-5001); }, v => { v.asset.loaded = false; },
    v => { v.pending = { kind: 'seed' }; },
    v => { v.syncing = true; },
  ];
  for (const change of cases) { const input = fixture(); change(input); assert.equal(!!setupReadiness(input).ready, false, change.toString()); }
});

test('web synchronization and confirmed robot disconnection remain distinct', () => {
  const value = fixture();
  const connection = () => setupConnection(setupReadiness(value), value.snapshot);
  assert.equal(connection().robot, 'Robot đang kết nối');
  value.error = 'Request timed out';
  assert.equal(connection().web, 'Đang đồng bộ lại với máy chủ');
  assert.equal(connection().robot, 'Đang chờ xác nhận kết nối robot');
  assert.equal(setupReadiness(value).ready, false);
  value.error = ''; value.snapshot.mqttConnected = false;
  value.snapshot.sessionFailureReason = 'MQTT session offline';
  assert.equal(connection().web, 'Đã đồng bộ với máy chủ');
  assert.equal(connection().robot, 'Robot mất kết nối MQTT');
  assert.equal(connection().detail, 'MQTT session offline');
  value.snapshot.mqttConnected = true; value.snapshot.heartbeatFresh = false;
  assert.equal(connection().robot, 'Đang chờ heartbeat mới từ robot');
});

test('expiry scheduling invalidates telemetry and sessions at their actual boundaries', () => {
  const value = fixture();
  value.profileReceivedAt = now;
  assert.equal(setupNextExpiry(value, now), now + 5001);
  value.snapshot.latestPose.capturedAt = time(-3500);
  assert.equal(setupNextExpiry(value, now), now + 1501, 'an older pose expires before the current snapshot');
  value.snapshot.navigationSession.expiresAt = time(1000);
  assert.equal(setupNextExpiry(value, now), now + 1000);
  assert.equal(setupReadiness({ ...value, now: now + 1000 }).ready, false);
  assert.equal(setupNextExpiry(value, now + 5001), now + 15001);
  assert.equal(setupNextExpiry(value, now + 15001), null);
});

test('estimated seeds cannot stand in for the actual robot pose', () => {
  const value = fixture(); value.snapshot.navigationSession.state = 'LOCALIZING';
  value.snapshot.navigationSession.initialization.pose = { x_m: 1, y_m: 4, yaw_rad: 0 };
  assert.equal(setupReadiness(value).pose, null);
  assert.equal(setupReadiness({ ...value, snapshot: null }).ready, false);
});

test('pose freshness matches the BE five-second limit across polling intervals', () => {
  const value = fixture();
  value.snapshot.latestPose.capturedAt = time(-3500);
  assert.equal(setupReadiness(value).ready, true);
  value.snapshot.latestPose.capturedAt = time(-5001);
  assert.equal(setupReadiness(value).ready, false);
  value.snapshot.latestPose.capturedAt = time(-1000);
  value.snapshot.latestPose.fresh = false;
  assert.equal(setupReadiness(value).ready, false);
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

test('a restart is acknowledged only by a new session ID and its selected map asset', () => {
  const snapshot = fixture().snapshot;
  const pending = { kind: 'open', robotId, mapId, assetHash: hash, previousSessionId: sessionId };
  assert.equal(setupPendingResolved(pending, snapshot), false);
  snapshot.navigationSession.sessionId = '44444444-4444-4444-8444-444444444444';
  assert.equal(setupPendingResolved(pending, snapshot), true);
  assert.ok(setupPiCommand(snapshot.navigationSession).endsWith(snapshot.navigationSession.sessionId));
  snapshot.navigationSession.state = 'CLOSED';
  assert.equal(setupPendingResolved(pending, snapshot), false);
});

test('live pose can replace delayed SQL only in the same verified session and revision', () => {
  function streamed() {
    const value = fixture();
    value.asset.geometry = map;
    value.snapshot.latestPose.fresh = false;
    value.livePose = { receivedAt: now, value: { messageType: 'NAVIGATION_POSE', robotId, mapId, mapAssetHash: hash,
      navigationSessionId: sessionId, initializationRevision: 1, capturedAt: time(-100), receivedAt: time(0),
      pose: { ...value.snapshot.latestPose, xM: value.snapshot.latestPose.xM + .1 } } };
    return value;
  }
  assert.equal(setupReadiness(streamed()).ready, true);
  const cases = [
    v => { v.livePose.value.robotId = 'other'; }, v => { v.livePose.value.mapId = 'other'; },
    v => { v.livePose.value.mapAssetHash = 'b'.repeat(64); }, v => { v.livePose.value.navigationSessionId = 'old'; },
    v => { v.livePose.value.initializationRevision = 0; }, v => { v.livePose.value.pose.xM = 999; },
    v => { v.livePose.value.pose.yM = Number.NaN; }, v => { v.livePose.value.capturedAt = time(-1501); },
    v => { v.livePose.receivedAt -= 1501; }, v => { v.livePose.receivedAt += 1; },
    v => { v.snapshot.navigationSession.state = 'WAITING_FOR_PI'; }, v => { v.snapshot.mqttConnected = false; },
    v => { v.snapshot.dispatchReady = false; }, v => { v.snapshot.navigationSession.initialization.revision = 2; },
  ];
  for (const change of cases) { const value = streamed(); change(value); assert.equal(setupReadiness(value).ready, false, change.toString()); }
  const value = streamed(); value.livePose.value.initializationRevision = 0;
  value.snapshot.latestPose.fresh = true;
  assert.equal(setupReadiness(value).pose, value.snapshot.latestPose, 'invalid stream samples fall back to verified SQL');
});

test('profile acknowledgement expires independently of fresh snapshots', () => {
  const value = fixture();
  value.profileReceivedAt = now - 15001;
  assert.equal(setupReadiness(value).acknowledged, false);
  assert.equal(setupReadiness(value).connected, true);
  value.profileReceivedAt = now;
  assert.equal(setupReadiness(value).ready, true);
  value.profileError = 'network failure';
  assert.equal(setupReadiness(value).ready, false);
});

test('stream pose ordering is scoped to robot and transport', () => {
  const previous = { robotId, messageType: 'NAVIGATION_POSE', transportSessionId: 'a', sequenceNo: 10 };
  assert.equal(newerSetupPose(previous, { ...previous, sequenceNo: 11 }, robotId), true);
  assert.equal(newerSetupPose(previous, { ...previous, sequenceNo: 9 }, robotId), false);
  assert.equal(newerSetupPose(previous, { ...previous }, robotId), false);
  assert.equal(newerSetupPose(previous, { ...previous, transportSessionId: 'b', sequenceNo: 1 }, robotId), true);
  assert.equal(newerSetupPose(previous, { ...previous, robotId: 'other', sequenceNo: 11 }, robotId), false);
});

test('SSE reader handles split UTF-8, CRLF, multiline events and cancellation', async () => {
  const events = [], encoder = new TextEncoder(); let cancelled = false;
  const bytes = encoder.encode(': keepalive\r\n\r\nevent: ignored\ndata: invalid\n\nevent: robot-state\r\ndata: {"name":\r\ndata: "Vị trí"}\r\n\r\nevent: robot-pose\ndata: {"sequenceNo":1}\n\n');
  const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); }, cancel() { cancelled = true; } });
  const response = new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  // Throw from the callback after both events, as when a consumer is stopped.
  await assert.rejects(consumeSetupEvents(response, (value, event) => { events.push([value, event]); if (events.length === 2) throw Error('stop'); }), /stop/);
  assert.deepEqual(events, [[{ name: 'Vị trí' }, 'robot-state'], [{ sequenceNo: 1 }, 'robot-pose']]);
  assert.equal(cancelled, true);
  await assert.rejects(consumeSetupEvents(new Response('{}', { headers: { 'Content-Type': 'application/json' } }), () => {}));
  await assert.rejects(consumeSetupEvents(new Response('x'.repeat(1048577), { headers: { 'Content-Type': 'text/event-stream' } }), () => {}), /vượt giới hạn/);
});
