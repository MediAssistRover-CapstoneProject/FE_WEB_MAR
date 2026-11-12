import test from 'node:test';
import assert from 'node:assert/strict';
import { endpointRoomPayload, hydrateRoomFeatures, roomForm, roomPayload } from '../src/features/facility/roomEditing.js';

const room = { roomId: 'r1', floorId: 'f1', roomCode: 'ROOM_01', roomName: 'Phòng mới', roomType: 'EXAMINATION', departmentCode: null, description: null, active: true, publicVisible: false };

test('room edits retain associations and reject codes used by inactive rooms on other floors', () => {
  const maps = [{ mapId: 'm1', floorId: 'f1' }, { mapId: 'm2', floorId: 'f2' }];
  const groups = [{ endpointGroupId: 'g1', mapId: 'm1' }, { endpointGroupId: 'g2', mapId: 'm2' }];
  const form = { ...roomForm(room), defaultEndpointGroupId: 'g1', roomName: '  Tên đã sửa  ' };
  const result = roomPayload(form, 'r1', [room], groups, maps);
  assert.equal(result.roomName, 'Tên đã sửa');
  assert.equal(result.floorId, 'f1'); assert.equal(result.defaultEndpointGroupId, 'g1');
  assert.equal(result.departmentCode, null); assert.equal(result.description, null);
  assert.throws(() => roomPayload({ ...form, roomCode: 'room_02' }, 'r1', [room, { roomId: 'r2', floorId: 'f2', roomCode: 'ROOM_02', active: false }], groups, maps), /Mã phòng đã/);
  assert.throws(() => roomPayload({ ...form, defaultEndpointGroupId: 'g2' }, 'r1', [room], groups, maps), /cùng tầng/);
});

test('unlink changes only room association and retains navigation and visibility', () => {
  const point = { endpointId: 'p1', mapId: 'm1', roomId: 'r1', zoneId: 'z1', endpointCode: 'P1', endpointName: 'Điểm 1', endpointType: 'WAYPOINT', xM: 1.25, yM: 3.75, yawRad: -1.2, active: false, accessible: false, publicVisible: true, description: 'Ghi chú' };
  const { endpointId, ...expected } = point;
  assert.deepEqual(endpointRoomPayload(point, null), { ...expected, roomId: null });
  assert.equal(point.roomId, 'r1');
});

test('Map Studio merges catalog changes without overwriting unpublished room edits', () => {
  const base = { id: 'feature-1', type: 'ROOM', roomId: 'r1', endpointId: 'old', roomName: 'Phòng cũ', label: 'Phòng cũ', roomCode: 'ROOM_01', roomType: 'GENERAL', departmentCode: '', roomDescription: '', roomPublicVisible: true, points: [] };
  const published = { features: [base] };
  const points = [{ endpointId: 'old', roomId: null }, { endpointId: 'new', roomId: 'r1', active: true, accessible: true }];
  const merged = hydrateRoomFeatures({ features: [{ ...base }] }, points, [room], published).features[0];
  assert.equal(merged.roomName, 'Phòng mới'); assert.equal(merged.label, 'Phòng mới');
  assert.equal(merged.endpointId, 'new'); assert.equal(merged.roomType, 'EXAMINATION');
  assert.equal(merged.roomPublicVisible, false);
  const draft = { ...base, roomName: 'Đang soạn', label: 'Nhãn riêng', roomType: 'WARD', endpointId: 'draft-point' };
  const kept = hydrateRoomFeatures({ features: [draft] }, points, [room], published).features[0];
  assert.equal(kept.roomName, 'Đang soạn'); assert.equal(kept.label, 'Nhãn riêng');
  assert.equal(kept.endpointId, 'draft-point'); assert.equal(kept.roomType, 'WARD');
  assert.equal(base.roomName, 'Phòng cũ');
});
