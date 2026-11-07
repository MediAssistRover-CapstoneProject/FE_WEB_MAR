import test from 'node:test';
import assert from 'node:assert/strict';
import { fromView, normalizeRotation, rotationBounds, straightenRotation, toView, viewRectangle } from '../src/features/facility/mapPresentationView.js';

const source = { widthM: 10, heightM: 6 };
const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);
const nearPoint = (actual, expected) => { near(actual.x, expected.x); near(actual.y, expected.y); };

test('rotation wraps consistently, rounds fine adjustments and rejects invalid angles', () => {
  assert.equal(normalizeRotation(180), -180);
  assert.equal(normalizeRotation(-540), -180);
  assert.equal(normalizeRotation(720 + 12.3456784), 12.345678);
  assert.equal(normalizeRotation(179.9999999), -180);
  assert.equal(Object.is(normalizeRotation(-0), -0), false);
  for (const value of [NaN, Infinity, -Infinity, undefined, '20']) assert.throws(() => normalizeRotation(value), RangeError);
});

test('display transforms roundtrip map vertices and interior points without touching the source', () => {
  const original = structuredClone(source);
  const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }, { x: 2.75, y: 4.3 }];
  for (const degrees of [0, 90, -90, -180, 21.3, -37.6, 179.9]) {
    for (const point of points) nearPoint(fromView(toView(point, source, degrees), source, degrees), point);
  }
  assert.deepEqual(source, original);
  assert.deepEqual(toView({ x: 2, y: 1 }, source, 0), { x: 2, y: 5 });
  assert.throws(() => fromView({ x: NaN, y: 2 }, source, 20), TypeError);
  assert.throws(() => rotationBounds({ widthM: 0, heightM: 6 }, 0), RangeError);
});

test('fit bounds contain all four raw corners for quarter turns and oblique rotations', () => {
  assert.deepEqual(rotationBounds(source, 0), { x: 0, y: 0, width: 10, height: 6 });
  for (const degrees of [90, -90]) assert.deepEqual(rotationBounds(source, degrees), { x: 2, y: -2, width: 6, height: 10 });
  for (const degrees of [15, -23.7, 45, 135, 179.9]) {
    const bounds = rotationBounds(source, degrees);
    for (const point of [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }]) {
      const view = toView(point, source, degrees);
      assert.ok(view.x >= bounds.x - 1e-10 && view.x <= bounds.x + bounds.width + 1e-10);
      assert.ok(view.y >= bounds.y - 1e-10 && view.y <= bounds.y + bounds.height + 1e-10);
    }
    near(bounds.x + bounds.width / 2, 5);
    near(bounds.y + bounds.height / 2, 3);
  }
});

test('rooms drawn after rotation align to display axes while retaining raw local coordinates', () => {
  const a = { x: 3, y: 2 }, b = { x: 6, y: 4 };
  assert.deepEqual(viewRectangle(a, b, source, 0), [{ x: 3, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 4 }, { x: 3, y: 4 }]);
  for (const degrees of [27, -31.5, 90, -90]) {
    const local = viewRectangle(a, b, source, degrees), screen = local.map(point => toView(point, source, degrees));
    near(screen[0].y, screen[1].y);
    near(screen[1].x, screen[2].x);
    near(screen[2].y, screen[3].y);
    near(screen[3].x, screen[0].x);
    const reversed = viewRectangle(b, a, source, degrees);
    local.forEach((point, index) => nearPoint(reversed[index], point));
  }
  assert.notDeepEqual(viewRectangle(a, b, source, 27), viewRectangle(a, b, source, 0));
});

test('two picked wall points straighten to the nearest horizontal or vertical direction', () => {
  for (const [a, b] of [
    [{ x: 2, y: 2 }, { x: 7, y: 1 }],
    [{ x: 2, y: 1 }, { x: 3, y: 5 }],
    [{ x: 2, y: 2 }, { x: 5, y: 5 }],
    [{ x: 1, y: 2 }, { x: 8, y: 2 }],
  ]) {
    for (const initial of [0, 23, -31, 90, 179]) {
      const aligned = straightenRotation(a, b, source, initial);
      assert.equal(straightenRotation(b, a, source, initial), aligned);
      assert.ok(Math.abs(normalizeRotation(aligned - initial)) <= 45.000001);
      const start = toView(a, source, aligned), end = toView(b, source, aligned);
      assert.ok(Math.abs(start.x - end.x) < 1e-6 || Math.abs(start.y - end.y) < 1e-6);
    }
  }
  assert.equal(straightenRotation({ x: 4, y: 3 }, { x: 4, y: 3 }, source, 21), null);
});
