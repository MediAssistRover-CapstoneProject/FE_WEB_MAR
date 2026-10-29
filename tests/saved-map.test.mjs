import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSavedMap } from '../src/features/robotOperations/savedMap.js';
const metadata = { map_id: 'new-scan', width_px: 200, height_px: 100, resolution_m_per_pixel: .05 };
test('loads the committed map from persistent endpoints without requesting a live Pi preview', async () => {
  const calls = [], controller = new AbortController();
  const result = await loadSavedMap('new-scan', async (path, options) => {
    calls.push(path); assert.equal(options.signal, controller.signal);
    return path.endsWith('/image-metadata') ? metadata : new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type':'image/png' } });
  }, controller.signal);
  assert.deepEqual(calls, ['/api/v1/maps/new-scan/image-metadata', '/api/v1/maps/new-scan/image.png']);
  assert.equal(result.metadata.map_id,'new-scan'); assert.equal(result.blob.size,3);
});
test('rejects another map or an absent saved image instead of showing a wrong map', async () => {
  await assert.rejects(loadSavedMap('new-scan', async path => path.endsWith('/image-metadata') ? {...metadata,map_id:'old-map'} : new Response('png',{headers:{'Content-Type':'image/png'}})));
  await assert.rejects(loadSavedMap('new-scan', async path => path.endsWith('/image-metadata') ? metadata : new Response(null,{status:204})));
});
