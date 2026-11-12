import test from 'node:test';
import assert from 'node:assert/strict';
import { removedPublishedRooms } from '../src/features/facility/roomEditing.js';

const a = { id: 'shape-a', type: 'ROOM', roomId: 'room-a', roomName: 'Phòng 05', endpointId: 'point-a' };
const b = { id: 'shape-b', type: 'ROOM', roomId: 'room-b', roomName: 'Phòng 06', endpointId: 'point-b' };
const published = { features: [a, b] };

test('pending removal compares rooms in the last publication with the edited draft', () => {
  assert.deepEqual(removedPublishedRooms(published, { features: [b] }), [a]);
  assert.deepEqual(removedPublishedRooms(published, { features: [] }), [a, b]);
  assert.deepEqual(removedPublishedRooms(published, { features: [a, b] }), []);
  assert.deepEqual(removedPublishedRooms(null, { features: [] }), []);
});

test('redrawn shapes and undo retain room identity and do not flag a room for retirement', () => {
  assert.deepEqual(removedPublishedRooms(published, { features: [{ ...a, id: 'redrawn' }, b] }), []);
  const legacy = { ...a, roomId: null };
  assert.deepEqual(removedPublishedRooms({ features: [legacy] }, { features: [] }, [{ endpointId: 'point-a', roomId: 'room-a' }]), [legacy]);
  assert.deepEqual(removedPublishedRooms(published, { features: [{ ...a, roomId: null }, b] }, [{ endpointId: 'point-a', roomId: 'room-a' }]), []);
});

test('unlinked draft rooms and non-room labels cannot retire unrelated rooms', () => {
  assert.deepEqual(removedPublishedRooms({ features: [{ id: 'new', type: 'ROOM' }, { ...a, type: 'LABEL' }] }, { features: [] }), []);
});
