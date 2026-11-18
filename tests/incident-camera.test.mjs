import test from 'node:test';
import assert from 'node:assert/strict';
import { IncidentCameraConnection, activeFallReview } from '../src/features/media/incidentCamera.js';
import { scopedIncidentLocation, centimetrePoint } from '../src/features/operations/incidentLocation.js';

const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const incident = { incidentId: id(1), robotId: id(2), incidentType: 'AI_SUSPECTED_FALL', mapId: id(3) };
const account = { accountId: id(4), role: 'ADMIN' };
const makeSession = () => ({ sessionId: id(5), robotId: incident.robotId, incidentId: incident.incidentId, staffAccountId: account.accountId,
  mode: 'MONITOR', state: 'ACTIVE', expiresAt: new Date(Date.now() + 60000).toISOString(), deviceSeenAt: new Date().toISOString() });

function setup({ initial = true, mutateSession, failRead = false, pendingCreate } = {}) {
  let session = makeSession(); const calls = [], changes = [];
  class Room {
    constructor() { this.handlers = {}; this.localParticipant = { setMicrophoneEnabled: async () => assert.fail('A MONITOR must never open the microphone') }; }
    on(name, handler) { this.handlers[name] = handler; }
    async connect() {
      this.handlers.video({ kind: 'video', isMuted: false }, { source: 'camera' }, { identity: `robot-${incident.robotId}` });
    }
    removeAllListeners() { this.handlers = {}; }
    async disconnect() {}
  }
  const request = async (path, options = {}) => {
    calls.push({ path, ...options });
    if (path === '/api/v1/media/configuration') return { enabled: true };
    if (path === '/api/v1/media-sessions' && options.method !== 'POST') return initial ? [{ ...session, staffAccountId: null, state: 'RINGING' }] : [];
    if (path === '/api/v1/media-sessions' && options.method === 'POST') {
      if (pendingCreate) await pendingCreate;
      return session;
    }
    if (path.endsWith('/accept')) return mutateSession ? mutateSession(session) : session;
    if (path.endsWith('/join-token')) return { url: 'wss://media.example.test', room: `mar-${session.sessionId}`, identity: `staff-${account.accountId}`, token: 'test-only', expiresAt: session.expiresAt, session };
    if (path.endsWith('/end')) return { ...session, state: 'ENDED' };
    if (failRead) throw Object.assign(Error('unavailable'), { status: 503 });
    return session;
  };
  const camera = new IncidentCameraConnection({ incident, account, request, loadSdk: async () => ({ Room, Track: { Kind: { Video: 'video', Audio: 'audio' }, Source: { Camera: 'camera' } }, RoomEvent: { TrackSubscribed: 'video' } }), onChange: value => changes.push(value) });
  return { camera, calls, changes, setSession: value => { session = value; } };
}

test('fall camera accepts the matching incident, joins MONITOR and never publishes local tracks', async () => {
  const f = setup();
  try {
    await f.camera.start();
    f.camera.emit({ videoFresh: true });
    assert.equal(f.camera.state.phase, 'live');
    assert.equal(activeFallReview(f.camera.state, incident, account), true);
    assert.equal(f.calls.some(call => call.path.endsWith('/accept')), true);
    assert.equal(f.calls.some(call => call.path.endsWith('/join-token')), true);
    assert.equal(f.calls.some(call => call.path === '/api/v1/media-sessions' && call.method === 'POST'), false);
    await f.camera.toggleMicrophone();
  } finally { await f.camera.stop(); }
  assert.equal(f.calls.at(-1).path, `/api/v1/media-sessions/${id(5)}/end`);
});

test('create includes incident scope and cleans up a late create after unmount', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const f = setup({ initial: false, pendingCreate: gate });
  const start = f.camera.start();
  while (!f.calls.some(call => call.path === '/api/v1/media-sessions' && call.method === 'POST')) await new Promise(resolve => setImmediate(resolve));
  const stop = f.camera.stop(); release(); await Promise.all([start, stop]);
  assert.deepEqual(f.calls.find(call => call.path === '/api/v1/media-sessions' && call.method === 'POST').body,
    { incidentId: incident.incidentId, robotId: incident.robotId, mode: 'MONITOR' });
  assert.equal(f.calls.some(call => call.path.endsWith('/end')), true);
  assert.equal(f.calls.some(call => call.path.endsWith('/join-token')), false);
});

test('a mismatched acceptance cannot join or be used to confirm this incident', async () => {
  const f = setup({ mutateSession: session => ({ ...session, incidentId: id(99) }) });
  await f.camera.start();
  assert.equal(f.camera.state.phase, 'error');
  assert.equal(f.calls.some(call => call.path.endsWith('/join-token')), false);
  assert.equal(activeFallReview(f.camera.state, incident, account), false);
  await f.camera.stop();
});

test('confirmation requires fresh same-account ACTIVE media and an unmuted video', () => {
  const media = { phase: 'live', videoFresh: true, track: { isMuted: false }, session: makeSession(), checkedAt: Date.now() };
  assert.equal(activeFallReview(media, incident, account), true);
  for (const update of [{ phase: 'reconnecting' }, { videoFresh: false }, { checkedAt: 0 }, { track: null }, { track: { isMuted: true } },
    { session: { ...media.session, state: 'CONNECTING' } }, { session: { ...media.session, staffAccountId: id(99) } },
    { session: { ...media.session, incidentId: id(99) } }, { session: { ...media.session, mode: 'ASSIST' } },
    { session: { ...media.session, expiresAt: new Date(0).toISOString() } }]) {
    assert.equal(activeFallReview({ ...media, ...update }, incident, account), false);
  }
});

test('failed media status reads disable confirmation while retaining the incident', async () => {
  const f = setup({ failRead: true });
  try { await f.camera.start(); assert.equal(activeFallReview(f.camera.state, incident, account), false); }
  finally { await f.camera.stop(); }
});

test('response locations convert cm to m and reject the wrong map revision', () => {
  const value = { status: 'FOUND', mapId: incident.mapId, mapAssetHash: 'hash', unit: 'cm', patientLocation: { xCm: 0, yCm: 250 }, robotObservationLocation: { xCm: 200, yCm: 0 }, points: [{ xCm: 0, yCm: 0 }, { xCm: 0, yCm: 250 }], distanceCm: 250 };
  const metadata = { map_id: incident.mapId, asset_hash: 'hash' };
  const result = scopedIncidentLocation(value, incident, metadata);
  assert.deepEqual(result.patient, { xM: 0, yM: 2.5 });
  assert.deepEqual(result.observation, { xM: 2, yM: 0 }); assert.equal(result.distanceM, 2.5);
  assert.equal(scopedIncidentLocation(value, incident, { ...metadata, asset_hash: 'other' }), null);
  assert.equal(scopedIncidentLocation({ ...value, unit: 'm' }, incident, metadata), null);
  assert.deepEqual(scopedIncidentLocation({ ...value, points: [{ xCm: 0, yCm: 0 }, { xCm: 'bad', yCm: 0 }, { xCm: 0, yCm: 250 }] }, incident, metadata).points, []);
  assert.equal(centimetrePoint({ xCm: '0', yCm: 0 }), null);
});
