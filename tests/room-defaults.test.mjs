import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRoomCode } from '../src/features/facility/roomDefaults.js';

test('new room codes skip saved rooms on every floor, inactive rooms and unsaved drafts', () => {
  const saved = [{ roomCode: 'ROOM_01', floorId: 'other-floor', active: false }, { roomCode: 'room_02' }, { roomCode: 'ROOM_04' }];
  const draft = [{ roomCode: 'ROOM_03' }, { type: 'WALL', roomCode: null }];
  assert.equal(nextRoomCode([...saved, ...draft]), 'ROOM_05');
  assert.equal(nextRoomCode([...saved, ...draft, { roomCode: 'ROOM_05' }]), 'ROOM_06');
  assert.equal(saved[1].roomCode, 'room_02');
});

test('deleted rooms do not cause duplicate codes, and codes can grow past two digits', () => {
  assert.equal(nextRoomCode(), 'ROOM_01');
  assert.equal(nextRoomCode([{ roomCode: 'ROOM_01' }, { roomCode: 'ROOM_03' }]), 'ROOM_02');
  assert.equal(nextRoomCode(Array.from({ length: 99 }, (_, index) => ({ roomCode: `ROOM_${String(index + 1).padStart(2, '0')}` }))), 'ROOM_100');
});
