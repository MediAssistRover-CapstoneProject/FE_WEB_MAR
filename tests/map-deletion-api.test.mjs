import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { facilityApi } from '../src/features/facility/facilityApi.js';

globalThis.localStorage = { getItem: () => null, removeItem: () => {} };
globalThis.sessionStorage = globalThis.localStorage;
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('map deletion uses force endpoint, confirmation header and cascade response', async () => {
  const result = { resourceId: 'map/1', resourceType: 'MAP', deleted: { Map: 1, Endpoint: 3, Room: 2 } };
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/api/v1/maps/map%2F1/force'));
    assert.equal(options.method, 'DELETE');
    assert.equal(new Headers(options.headers).get('X-Confirm-Hard-Delete'), 'true');
    assert.deepEqual(JSON.parse(options.body), { reason: 'Xóa bản quét cũ' });
    return json(result);
  };
  assert.deepEqual(await facilityApi.deleteMap('map/1', 'Xóa bản quét cũ'), result);
});

test('preview requests are read-only and include the abort signal', async () => {
  const controller = new AbortController();
  const result = { resourceId: 'm1', canHardDelete: true, blockers: [], dependencies: { Endpoint: 3, Room: 2, sharedRooms: 1 } };
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/maps/m1/deletion-impact'));
    assert.equal(options.method, 'GET'); assert.equal(options.signal, controller.signal);
    return json(result);
  };
  assert.deepEqual(await facilityApi.getMapDeletionImpact('m1', { signal: controller.signal }), result);
});

test('archived or unconfirmed responses never count as permanent deletion', async () => {
  for (const result of [{ mapId: 'm1', status: 'ARCHIVED' }, { resourceId: 'm1', resourceType: 'MAP', deleted: { Map: 0 } }, { resourceId: 'other', resourceType: 'MAP', deleted: { Map: 1 } }, null]) {
    globalThis.fetch = async () => json(result);
    await assert.rejects(facilityApi.deleteMap('m1', 'Xóa bản quét cũ'), /chưa xác nhận/);
  }
});

test('dependency conflicts remain visible and do not trigger another delete', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({ message: 'Shift.room_id còn 1 bản ghi tham chiếu' }, 409); };
  await assert.rejects(facilityApi.deleteMap('m1', 'Xóa bản quét cũ'), error => error.status === 409 && /Shift/.test(error.message));
  assert.equal(calls, 1);
});
