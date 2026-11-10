import test from 'node:test';
import assert from 'node:assert/strict';
import { RobotCameraConnection, openCameraSession } from '../src/features/media/robotCamera.js';

const id = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const robotId = id(1), accountId = id(2), sessionId = id(3);
const session = () => ({ sessionId, robotId, staffAccountId: accountId, mode: 'MONITOR', state: 'CONNECTING', expiresAt: new Date(Date.now() + 60000).toISOString() });
const RoomEvent = Object.fromEntries(['TrackSubscribed', 'TrackUnsubscribed', 'TrackMuted', 'TrackUnmuted', 'Reconnecting', 'Reconnected', 'Disconnected'].map(name => [name, name]));
function fixture({ sessions = [], role = 'ADMIN', enabled = true, credentials: patch = {}, create, fail } = {}) {
  const reads = [], writes = [], rooms = [];
  class Room {
    constructor() { this.events = new Map(); rooms.push(this); }
    on(name, listener) { this.events.set(name, listener); }
    emit(name, ...values) { this.events.get(name)?.(...values); }
    removeAllListeners() { this.events.clear(); }
    async connect(url, token) { this.connected = { url, token }; }
    async disconnect() { this.disconnected = true; }
  }
  const sdk = { Room, RoomEvent, Track: { Kind: { Video: 'video' }, Source: { Camera: 'camera' } }, DisconnectReason: { DUPLICATE_IDENTITY: 2 } };
  const request = async (path, options = {}) => {
    (options.method === 'POST' ? writes : reads).push({ path, ...options });
    if (fail?.(path, options)) throw Object.assign(Error('MEDIA_DEVICE_NOT_CONNECTED'), { status: 400 });
    if (path === '/api/v1/media/configuration') return { enabled };
    if (path === '/api/v1/media-sessions') return options.method === 'POST' ? create ? create() : session() : sessions;
    if (path.endsWith('/join-token')) return { url: 'wss://camera.example.test', room: `mar-${sessionId}`, identity: `staff-${accountId}`, token: 'secret-token', expiresAt: session().expiresAt, session: session(), ...patch };
    if (path.endsWith('/end')) return {};
    return session();
  };
  const connection = new RobotCameraConnection({ robotId, account: { accountId, role }, request, loadSdk: async () => sdk });
  return { connection, reads, writes, rooms, sdk };
}

test('MONITOR creates once, joins only its robot camera and closes its own session', async () => {
  const f = fixture();
  try {
    await f.connection.start();
    assert.deepEqual(f.writes.map(value => [value.path, value.body]), [
      ['/api/v1/media-sessions', { robotId, mode: 'MONITOR' }], [`/api/v1/media-sessions/${sessionId}/join-token`, {}],
    ]);
    const room = f.rooms[0], track = { kind: 'video' };
    room.emit(RoomEvent.TrackSubscribed, track, { source: 'camera' }, { identity: `robot-${id(4)}` });
    assert.equal(f.connection.state.track, null);
    room.emit(RoomEvent.TrackSubscribed, { kind: 'audio' }, { source: 'microphone' }, { identity: `robot-${robotId}` });
    assert.equal(f.connection.state.track, null);
    room.emit(RoomEvent.TrackSubscribed, track, { source: 'camera' }, { identity: `robot-${robotId}` });
    assert.equal(f.connection.state.track, track);
    assert.equal(f.connection.state.phase, 'live');
    await f.connection.poll();
    assert.equal(f.writes.length, 2, 'status refresh never recreates or accepts a session');
    room.emit(RoomEvent.Reconnecting); assert.equal(f.connection.state.phase, 'reconnecting');
    room.emit(RoomEvent.TrackUnsubscribed, track); assert.equal(f.connection.state.track, null);
  } finally { await f.connection.stop(); }
  assert.equal(f.writes.at(-1).path, `/api/v1/media-sessions/${sessionId}/end`);
  assert.equal(f.rooms[0].disconnected, true);
});

test('existing own MONITOR can be resumed, and another viewer or ASSIST is never accepted or ended', async () => {
  for (const existing of [session(), { ...session(), staffAccountId: id(5) }, { ...session(), mode: 'ASSIST', incidentId: id(6) }]) {
    const f = fixture({ sessions: [existing] });
    await f.connection.start(); await f.connection.stop();
    assert.deepEqual(f.writes.map(value => value.path), existing.mode === 'MONITOR' && existing.staffAccountId === accountId ? [`/api/v1/media-sessions/${sessionId}/join-token`] : []);
  }
});

test('disabled media and disconnected Pi wait without repeated creates in the same attempt', async () => {
  const disabled = fixture({ enabled: false }); await disabled.connection.start(); await disabled.connection.stop();
  assert.equal(disabled.writes.length, 0); assert.equal(disabled.rooms.length, 0);
  const offline = fixture({ fail: (path, options) => path === '/api/v1/media-sessions' && options.method === 'POST' });
  await offline.connection.start(); assert.match(offline.connection.state.message, /Robot chưa kết nối/); await offline.connection.stop();
  assert.equal(offline.rooms.length, 0); assert.equal(offline.writes.length, 1);
});

test('staff cannot automatically open a general monitor session', async () => {
  const f = fixture({ role: 'STAFF' }); await f.connection.start(); await f.connection.stop();
  assert.equal(f.writes.length, 0); assert.equal(f.rooms.length, 0); assert.equal(f.connection.state.phase, 'restricted');
});

test('wrong session, wrong room and insecure credentials never connect to media', async () => {
  for (const credentials of [{ session: { ...session(), robotId: id(4) } }, { session: { ...session(), mode: 'ASSIST' } },
    { identity: 'staff-other' }, { room: 'another-room' }, { url: 'ws://camera.example.test' }, { expiresAt: 'invalid' }]) {
    const f = fixture({ sessions: [session()], credentials });
    await f.connection.start(); await f.connection.stop(); assert.equal(f.rooms.length, 0);
    assert.equal(f.writes.some(write => write.path.endsWith('/end')), false);
  }
});

test('a create response arriving after unmount is cleaned up without joining', async () => {
  let resolve;
  const created = new Promise(done => { resolve = done; });
  const f = fixture({ create: () => created });
  const starting = f.connection.start();
  while (!f.writes.length) await new Promise(done => setTimeout(done, 0));
  const stopping = f.connection.stop(); resolve(session());
  await Promise.all([starting, stopping]);
  assert.deepEqual(f.writes.map(value => value.path), ['/api/v1/media-sessions', `/api/v1/media-sessions/${sessionId}/end`]);
  assert.equal(f.rooms.length, 0);
});

test('another browser taking the same identity stops retries and is not ended on cleanup', async () => {
  const f = fixture(); await f.connection.start();
  f.rooms[0].emit(RoomEvent.Disconnected, f.sdk.DisconnectReason.DUPLICATE_IDENTITY);
  assert.equal(f.connection.state.phase, 'restricted');
  await f.connection.stop(); assert.equal(f.writes.length, 2);
  assert.equal(openCameraSession({ ...session(), expiresAt: new Date(Date.now() - 1).toISOString() }), false);
});
