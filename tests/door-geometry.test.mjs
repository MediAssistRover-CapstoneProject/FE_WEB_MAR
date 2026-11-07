import test from 'node:test';
import assert from 'node:assert/strict';
import { doorFitsMap, doorGeometry, setDoorOpening } from '../src/features/facility/doorGeometry.js';

const source = { widthM: 10, heightM: 8 };
const door = (...points) => ({ type: 'DOOR', points });
const point = (x, y) => ({ x, y });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);
const nearPoint = (actual, expected) => { near(actual.x, expected.x); near(actual.y, expected.y); };

test('architectural leaf and SVG sweep follow horizontal, vertical and diagonal spans', () => {
  for (const [hinge, closed, open] of [
    [point(3, 3), point(5, 3), point(3, 5)],
    [point(3, 3), point(3, 5), point(1, 3)],
    [point(3, 3), point(5, 5), point(1, 5)],
    [point(5, 3), point(3, 3), point(5, 1)],
  ]) {
    const geometry = doorGeometry(door(hinge, closed), source);
    nearPoint(geometry.open, open);
    near(geometry.radius, Math.hypot(closed.x - hinge.x, closed.y - hinge.y));
    near(geometry.angleDegrees, 90);
    assert.equal(geometry.sweep, 0, 'Local CCW maps to negative SVG sweep');
    assert.match(geometry.arcPath, /^M .+ A .+ 0 0 0 /);
  }
});

test('legacy doors at a scan boundary choose the side that fits without mutating saved points', () => {
  const legacy = door(point(2, 8), point(4, 8)), original = structuredClone(legacy);
  const geometry = doorGeometry(legacy, source);
  nearPoint(geometry.open, point(2, 6));
  near(geometry.angleDegrees, -90);
  assert.equal(geometry.sweep, 1);
  assert.deepEqual(legacy, original);
  assert.equal(setDoorOpening(legacy, source, { flipSwing: true }), null);
});

test('opening flip and hinge swap cover four saved door orientations', () => {
  const initial = door(point(3, 3), point(5, 3));
  assert.deepEqual(setDoorOpening(initial, source), [point(3, 3), point(5, 3), point(3, 5)]);
  const flipped = setDoorOpening(initial, source, { flipSwing: true });
  assert.deepEqual(flipped, [point(3, 3), point(5, 3), point(3, 1)]);
  const swapped = setDoorOpening(initial, source, { swapHinge: true });
  assert.deepEqual(swapped, [point(5, 3), point(3, 3), point(5, 5)]);
  assert.deepEqual(setDoorOpening(initial, source, { swapHinge: true, flipSwing: true }), [point(5, 3), point(3, 3), point(5, 1)]);
  assert.deepEqual(setDoorOpening(door(...flipped), source, { flipSwing: true }), setDoorOpening(initial, source));
  assert.deepEqual(setDoorOpening(door(...swapped), source, { swapHinge: true }), setDoorOpening(initial, source));
});

test('explicit opening direction projects to leaf width and survives JSON reload', () => {
  const feature = door(point(3, 3), point(5, 3), point(4, 4));
  const geometry = doorGeometry(feature, source);
  near(geometry.angleDegrees, 45);
  near(Math.hypot(geometry.open.x - geometry.hinge.x, geometry.open.y - geometry.hinge.y), 2);
  nearPoint(geometry.open, point(3 + Math.SQRT2, 3 + Math.SQRT2));
  const normalized = setDoorOpening(feature, source);
  const reloaded = doorGeometry(JSON.parse(JSON.stringify(door(...normalized))), source);
  nearPoint(reloaded.open, geometry.open);
  near(reloaded.angleDegrees, 45);
  near(doorGeometry(door(...setDoorOpening(feature, source, { flipSwing: true })), source).angleDegrees, -45);
  // Older polyline-shaped doors may contain extra vertices; they remain readable.
  nearPoint(doorGeometry(door(...feature.points, point(9, 9)), source).open, geometry.open);
});

test('full opening arc must fit even when hinge, jamb and leaf endpoints are inside', () => {
  // The quarter-circle reaches farther left between its diagonal endpoints.
  const opening = door(point(.9, 4), point(.2, 4.7), point(.2, 3.3));
  const geometry = doorGeometry(opening, source);
  assert.ok(opening.points.every(p => p.x >= 0 && p.y >= 0 && p.x <= source.widthM && p.y <= source.heightM));
  near(geometry.angleDegrees, 90);
  assert.equal(doorFitsMap(geometry, source), false);
  assert.equal(setDoorOpening(opening, source), null);
  assert.equal(doorFitsMap({ ...geometry, hinge: point(.5, 4), closed: point(.5, 5.4), open: point(.5, 2.6), radius: 1.4, angleDegrees: 180 }, source), false);

  // A legacy diagonal quarter turn reaches farther left between its endpoints;
  // choose the opposite side when only that complete arc fits.
  const diagonal = door(point(.9, 4), point(.2, 4.7));
  const diagonalGeometry = doorGeometry(diagonal, source);
  near(diagonalGeometry.angleDegrees, -90);
  assert.equal(doorFitsMap(diagonalGeometry, source), true);
  assert.equal(setDoorOpening(diagonal, source, { flipSwing: true }), null);
  assert.equal(doorFitsMap(null, source), false);
  assert.equal(doorFitsMap({ ...diagonalGeometry, radius: Infinity }, source), false);
});

test('degenerate or nonfinite doors cannot create invalid SVG arcs or persisted geometry', () => {
  for (const feature of [door(), door(point(1, 1)), door(point(1, 1), point(1, 1)), door(point(NaN, 1), point(2, 1)), door(point(1, 1), point(Infinity, 1)), door(point(1, 1), point(2, 1), point(1, 1)), door(point(1, 1), point(2, 1), point(NaN, 1))]) {
    assert.equal(doorGeometry(feature, source), null);
    assert.equal(setDoorOpening(feature, source), null);
  }
  assert.equal(doorGeometry(door(point(1, 1), point(2, 1)), { widthM: 0, heightM: 8 }), null);
});
