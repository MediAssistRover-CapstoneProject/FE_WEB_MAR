import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationalRoomReader } from '../src/features/facility/operationalRooms.js';

test('legacy room API is scoped through all pages of active maps/endpoints, never just the floor', async () => {
  const rooms = [
    { roomId: 'old', floorId: 'f', active: true }, { roomId: 'new', floorId: 'f', active: true },
    { roomId: 'off', floorId: 'f', active: false }, { roomId: 'unlinked', floorId: 'f', active: true },
  ];
  const catalogs = { rooms, maps: [{ mapId: 'a', floorId: 'f', status: 'INACTIVE' }, { mapId: 'b', floorId: 'f', status: 'ACTIVE' }],
    floors: [{ floorId: 'f', active: true }], endpoints: [
      ...Array.from({ length: 100 }, (_, i) => ({ endpointId: i, roomId: 'old', mapId: 'a', active: true })),
      { roomId: 'new', mapId: 'b', active: true }, { roomId: 'off', mapId: 'b', active: true },
    ] };
  const calls = [];
  const reader = createOperationalRoomReader(async path => {
    calls.push(path); const url = new URL(path, 'http://fixture');
    const rows = catalogs[url.pathname.split('/').at(-1)], page = Number(url.searchParams.get('page'));
    return { content: rows.slice(page * 100, (page + 1) * 100), totalPages: Math.ceil(rows.length / 100), last: (page + 1) * 100 >= rows.length };
  });
  assert.deepEqual((await reader()).map(room => room.roomId), ['new']);
  assert.ok(calls.some(path => path.includes('endpoints?page=1')));
  assert.deepEqual(await reader({ mapId: 'a' }), []);
  catalogs.maps[0].status = 'ACTIVE'; catalogs.maps[1].status = 'INACTIVE';
  assert.deepEqual((await reader()).map(room => room.roomId), ['old']);
});

test('current API availability flags are respected without a legacy catalog fallback', async () => {
  const reader = createOperationalRoomReader(async path => {
    assert.ok(path.startsWith('/api/v1/rooms?'));
    return { content: [{ roomId: 'a', active: true, operational: true }, { roomId: 'b', active: true, operational: false }], last: true };
  });
  assert.deepEqual((await reader()).map(room => room.roomId), ['a']);
});

test('a failed map lookup does not fall back to unverified room choices', async () => {
  const reader = createOperationalRoomReader(async path => {
    if (path.includes('/rooms?')) return { content: [{ roomId: 'unknown', active: true }], last: true };
    throw Error('Map catalog unavailable');
  });
  await assert.rejects(reader(), /Map catalog unavailable/);
});
