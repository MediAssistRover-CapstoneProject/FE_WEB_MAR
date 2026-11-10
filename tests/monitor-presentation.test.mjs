import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingPresentation, presentationViewport } from '../src/features/operations/monitorPresentation.js';
import { rotationBounds, toView } from '../src/features/facility/mapPresentationView.js';

const source = { mapId: 'map', assetHash: 'hash', widthM: 10, heightM: 6, widthPx: 200, heightPx: 120,
  resolutionMPerPixel: .05, originXM: -2, originYM: 3, originYawRad: .4, frameId: 'map' };
const metadata = { map_id: 'map', asset_hash: 'hash', width_m: 10, height_m: 6, width_px: 200, height_px: 120,
  resolution_m_per_pixel: .05, origin_x_m: -2, origin_y_m: 3, origin_yaw_rad: .4, frame_id: 'map' };
const published = { source, document: { schemaVersion: 1, features: [], rotationDegrees: -20 } };

test('only a published drawing for the same map asset and coordinate system is accepted', () => {
  assert.equal(matchingPresentation(published, metadata), published);
  for (const change of [{ mapId: 'other' }, { assetHash: 'other' }, { widthM: 11 }, { widthPx: 201 },
    { originXM: 1 }, { originYawRad: 0 }, { resolutionMPerPixel: .1 }, { frameId: 'odom' }]) {
    assert.equal(matchingPresentation({ ...published, source: { ...source, ...change } }, metadata), null);
  }
  assert.equal(matchingPresentation(null, metadata), null);
  assert.equal(matchingPresentation({ source, draft: published.document }, metadata), null);
  assert.equal(matchingPresentation(published, null), null);
});

test('fit contains every corner for straightened and quarter-turn maps', () => {
  for (const rotationDegrees of [0, -20, 90, -90, 180]) {
    const view = presentationViewport({ ...published, document: { ...published.document, rotationDegrees } }, 1);
    assert.deepEqual(view, rotationBounds(source, rotationDegrees));
    for (const point of [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 6 }, { x: 10, y: 6 }]) {
      const p = toView(point, source, rotationDegrees);
      assert.ok(p.x >= view.x - 1e-9 && p.x <= view.x + view.width + 1e-9);
      assert.ok(p.y >= view.y - 1e-9 && p.y <= view.y + view.height + 1e-9);
    }
  }
});

test('follow centres the rotated robot position without changing pixel or map coordinates', () => {
  const before = structuredClone(published), pixel = { x: 80, y: 80 };
  const view = presentationViewport(published, 3, pixel), point = toView({ x: 4, y: 2 }, source, -20);
  assert.ok(Math.abs(view.x + view.width / 2 - point.x) < 1e-9);
  assert.ok(Math.abs(view.y + view.height / 2 - point.y) < 1e-9);
  assert.deepEqual(published, before);
  assert.deepEqual(pixel, { x: 80, y: 80 });
});
