import test from 'node:test';
import assert from 'node:assert/strict';
import { roomIsOperational } from '../src/features/facility/roomAvailability.js';

const room = { roomId: 'r', floorId: 'f', active: true };
const map = (mapId, status) => ({ mapId, floorId: 'f', status });
const point = mapId => ({ roomId: 'r', mapId, active: true });

test('room availability follows the active map in both directions without changing the room setting', () => {
  const maps = [map('a', 'ACTIVE'), map('b', 'INACTIVE')];
  assert.equal(roomIsOperational(room, maps, [point('a')]), true);
  assert.equal(roomIsOperational(room, maps, [point('b')]), false);
  maps[0].status = 'INACTIVE'; maps[1].status = 'ACTIVE';
  assert.equal(roomIsOperational(room, maps, [point('a')]), false);
  assert.equal(roomIsOperational(room, maps, [point('b')]), true);
  assert.equal(room.active, true);
  assert.equal(roomIsOperational(room, maps, [point('a'), point('b')]), true);
});

test('draft/archived maps, disabled rooms/points/floors and rooms without links stay inactive', () => {
  for (const status of ['DRAFT', 'INACTIVE', 'ARCHIVED']) assert.equal(roomIsOperational(room, [map('a', status)], [point('a')]), false);
  assert.equal(roomIsOperational({ ...room, active: false }, [map('a', 'ACTIVE')], [point('a')]), false);
  assert.equal(roomIsOperational(room, [map('a', 'ACTIVE')], [{ ...point('a'), active: false }]), false);
  assert.equal(roomIsOperational(room, [map('a', 'ACTIVE')], []), false);
  assert.equal(roomIsOperational(room, [{ ...map('a', 'ACTIVE'), floorId: 'other' }], [point('a')]), false);
  assert.equal(roomIsOperational(room, [map('a', 'ACTIVE')], [point('a')], [{ floorId: 'f', active: false }]), false);
});
