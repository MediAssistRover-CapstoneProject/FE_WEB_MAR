import test from 'node:test';
import assert from 'node:assert/strict';
import { newRoomForm, roomForm, roomPayload, hydrateRoomFeatures } from '../src/features/facility/roomEditing.js';
import { presentationIssues } from '../src/features/facility/mapPresentation.js';
import { settingPayload, settingSpecs } from '../src/features/admin/systemSettings.js';
import { roomTypePatch } from '../src/features/facility/roomDefaults.js';

test('selecting SOS suggests a unique SOS code across inactive rooms, floors and unsaved map shapes', () => {
  const rooms = [{ roomId: 'old', roomCode: 'sos_01', floorId: 'other-floor', active: false },
    { id: 'draft', roomCode: 'SOS_02' }, { roomId: 'own', roomCode: 'ROOM_01' }];
  const form = { roomCode: 'ROOM_01', roomType: 'GENERAL' };
  assert.deepEqual(roomTypePatch(form, 'SOS', rooms, { roomId: 'own' }), { roomType: 'SOS', roomCode: 'SOS_03' });
  assert.equal(form.roomCode, 'ROOM_01');
  assert.deepEqual(roomTypePatch(form, 'WARD', rooms), { roomType: 'WARD' });
  assert.deepEqual(roomTypePatch(form, 'SOS', null), { roomType: 'SOS' }, 'a failed catalog read does not invent a supposedly free code');
});

test('the edited room keeps its own SOS code while a different room cannot reuse it', () => {
  const rooms = [{ roomId: 'own', roomCode: 'SOS_01' }, { roomId: 'other', roomCode: 'SOS_02' }];
  assert.equal(roomTypePatch({ roomCode: 'SOS_01' }, 'SOS', rooms, { roomId: 'own' }).roomCode, 'SOS_01');
  assert.equal(roomTypePatch({ roomCode: 'SOS_01' }, 'SOS', rooms).roomCode, 'SOS_03');
  const shapes = [...rooms, { id: 'shape-own', roomId: 'own', roomCode: 'SOS_01' }, { id: 'draft', roomCode: 'SOS_03' }];
  assert.equal(roomTypePatch({ roomCode: 'SOS_01' }, 'SOS', shapes, { roomId: 'own', id: 'shape-own' }).roomCode, 'SOS_01');
});

test('new rooms use an available code and leave identity generation to the backend', () => {
  const form = newRoomForm([{ roomCode: 'ROOM_01', active: false, floorId: 'other' }], 'f1');
  const payload = roomPayload({ ...form, roomName: 'Trực SOS', roomType: ' sos ' }, null, [], [], []);
  assert.equal(payload.roomType, 'SOS');
  assert.equal(payload.roomCode, 'ROOM_02');
  assert.equal(payload.active, true);
  assert.equal(payload.publicVisible, false);
  assert.ok(!Object.hasOwn(payload, 'roomId'));
  assert.throws(() => roomPayload({ ...form, roomName: 'SOS', floorId: '' }, null, [], [], []), /chọn tầng/);
});

test('inactive ordinary rooms cannot become SOS but existing SOS can be deactivated', () => {
  const room = { roomId: 'r1', floorId: 'f1', roomCode: 'ROOM_01', roomName: 'Phòng trực', roomType: 'WARD', active: false };
  assert.throws(() => roomPayload({ ...roomForm(room), roomType: 'SOS' }, 'r1', [room], [], []), /Bật Phòng hoạt động/);
  const previous = { ...room, roomType: 'SOS', active: true };
  const payload = roomPayload({ ...roomForm(previous), active: false }, 'r1', [previous], [], []);
  assert.equal(payload.active, false);
  assert.equal(payload.roomCode, previous.roomCode);
  assert.equal(payload.roomType, 'SOS');
});

test('draft validation rejects multiple SOS rooms before saving or applying', () => {
  const feature = { type: 'ROOM', points: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }], roomType: 'SOS' };
  const source = { widthM: 10, heightM: 10 };
  assert.deepEqual(presentationIssues({ schemaVersion: 1, features: [feature] }, source), []);
  assert.match(presentationIssues({ schemaVersion: 1, features: [feature, { ...feature, roomType: 'sos' }] }, source)[0], /một phòng SOS/);
});

test('reopening a published map follows a transferred SOS without discarding new draft edits', () => {
  const old = { id: 'a', type: 'ROOM', roomId: 'r1', roomType: 'SOS', roomName: 'Trực', label: 'Trực' };
  const rooms = [{ roomId: 'r1', roomType: 'WARD', roomName: 'Trực' }];
  assert.equal(hydrateRoomFeatures({ features: [old] }, [], rooms, { features: [old] }).features[0].roomType, 'WARD');
  assert.equal(hydrateRoomFeatures({ features: [{ ...old, roomType: 'LABORATORY' }] }, [], rooms, { features: [old] }).features[0].roomType, 'LABORATORY');
});

test('system settings cannot construct a direct SOS setting write', () => {
  assert.throws(() => settingPayload(null, 'sos.monitoring-room-id', settingSpecs['sos.monitoring-room-id'], 'room-id'), /danh mục phòng/);
});
