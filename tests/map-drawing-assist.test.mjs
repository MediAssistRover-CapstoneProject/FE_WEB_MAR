import test from 'node:test';
import assert from 'node:assert/strict';
import { doorFitsMap, doorGeometry } from '../src/features/facility/doorGeometry.js';
import { doorOnWall, getDoorWall, getWallEdge, snapDrawingPoint, visibleWallSegments } from '../src/features/facility/mapDrawingAssist.js';
import { fromView, toView } from '../src/features/facility/mapPresentationView.js';

const source = { widthM: 10, heightM: 8 };
const p = (x, y) => ({ x, y });
const feature = (type, id, ...points) => ({ type, id, points });
const wall = (id, ...points) => feature('WALL', id, ...points);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should be ${expected}`);
const nearPoint = (actual, expected) => { near(actual.x, expected.x); near(actual.y, expected.y); };
const snap = (point, features = [], extra = {}) => snapDrawingPoint(point, { features, source, tolerance: .15, ...extra });

test('vertices take priority over adjacent edges, with a strict distance threshold and feature exclusion', () => {
  const features = [wall('one', p(2, 2), p(5, 2))], before = structuredClone(features);
  assert.deepEqual(snap(p(2.08, 2.06), features).point, p(2, 2));
  assert.equal(snap(p(2.08, 2.06), features).kind, 'vertex');
  const edge = snap(p(3, 2.1), features);
  assert.equal(edge.kind, 'edge'); nearPoint(edge.point, p(3, 2));
  assert.equal(edge.edge.featureId, 'one'); assert.equal(edge.guides.length, 1);
  assert.equal(snap(p(3, 2.16), features).kind, null);
  assert.equal(snap(p(2.05, 2.05), features, { excludeId: 'one' }).kind, null);
  assert.deepEqual(features, before);
});

test('rooms and corridors include their closing edge; door swings and labels are not snap geometry', () => {
  const room = feature('ROOM', 'room', p(1, 1), p(4, 1), p(4, 4), p(1, 4));
  const corridor = { ...room, type: 'CORRIDOR' };
  for (const area of [room, corridor]) {
    const value = snap(p(1.1, 2.5), [area]);
    assert.equal(value.kind, 'edge'); nearPoint(value.point, p(1, 2.5)); assert.equal(value.edge.index, 3);
  }
  const door = feature('DOOR', 'door', p(3, 3), p(4, 3), p(3, 4));
  assert.equal(snap(p(3.05, 4.05), [door]).kind, 'alignment', 'Only the jamb x-coordinate can align, not the open leaf vertex');
  nearPoint(snap(p(3.05, 4.05), [door]).point, p(3, 4.05));
  assert.equal(snap(p(3.05, 3.05), [door]).kind, 'vertex');
  assert.equal(snap(p(5.03, 5.03), [feature('LABEL', 'label', p(5, 5))]).kind, null);
});

test('alignment follows rotated screen axes and returns local-coordinate guides', () => {
  const rotation = 27, vertex = p(3, 3), view = toView(vertex, source, rotation);
  const pointer = fromView(p(view.x + .08, view.y + 1), source, rotation);
  const value = snap(pointer, [wall('one', vertex, p(2, 2))], { rotation });
  assert.equal(value.kind, 'alignment');
  const projected = toView(value.point, source, rotation);
  near(projected.x, view.x); near(projected.y, view.y + 1);
  nearPoint(value.guides[0].a, vertex); nearPoint(value.guides[0].b, value.point);
});

test('Shift preserves the view axis even beside an off-axis vertex, and intersects diagonal edges', () => {
  const anchor = p(2, 3), offAxis = wall('off', p(5, 3.06), p(6, 3.06));
  const value = snap(p(4.97, 3.04), [offAxis], { anchor, orthogonal: true });
  near(value.point.y, anchor.y); near(value.point.x, 5); assert.equal(value.kind, 'alignment');
  const diagonal = wall('diagonal', p(4, 2), p(6, 4));
  const intersection = snap(p(5.08, 3.02), [diagonal], { anchor, orthogonal: true });
  assert.equal(intersection.kind, 'edge'); nearPoint(intersection.point, p(5, 3));

  const rotation = 35, origin = toView(anchor, source, rotation);
  const pointer = fromView(p(origin.x + 2, origin.y + .8), source, rotation);
  const axis = snap(pointer, [], { anchor, orthogonal: true, rotation });
  assert.equal(axis.kind, 'axis'); near(toView(axis.point, source, rotation).y, origin.y);
});

test('axis locking clips to the original map boundary after rotation and can work with snapping disabled', () => {
  const anchor = p(.1, .1), pointer = p(.1, 7.9), rotation = 45;
  const value = snap(pointer, [], { anchor, rotation, orthogonal: true, tolerance: 0 });
  assert.equal(value.kind, 'axis');
  assert.ok(value.point.x >= 0 && value.point.y >= 0 && value.point.x <= 10 && value.point.y <= 8);
  const origin = toView(anchor, source, rotation), target = toView(value.point, source, rotation);
  assert.ok(Math.abs(origin.x - target.x) < 1e-8 || Math.abs(origin.y - target.y) < 1e-8);
  assert.equal(snap(p(2.01, 2.01), [wall('one', p(2, 2), p(4, 2))], { tolerance: 0 }).kind, null);
});

test('wall lookup ignores room edges and clamps projections to the finite wall', () => {
  const features = [feature('ROOM', 'room', p(1, 1), p(4, 1), p(4, 4)), wall('diagonal', p(2, 2), p(4, 4))];
  assert.equal(getWallEdge(p(3, 1.01), features, .15), null);
  const diagonal = getWallEdge(p(3.1, 2.9), features, .15);
  nearPoint(diagonal.point, p(3, 3)); assert.equal(diagonal.featureId, 'diagonal');
  nearPoint(getWallEdge(p(4.05, 4.05), features, .15).point, p(4, 4));
  assert.equal(getWallEdge(p(4.2, 4.2), features, .15), null);
  assert.equal(getWallEdge(p(NaN, 2), features, .15), null);
});

test('saved door attachment finds the segment containing both jambs at a shared wall junction', () => {
  const features = [wall('threshold-wall', p(2, 2), p(6, 4)), wall('other-wall', p(2, 2), p(2, 5))];
  const door = feature('DOOR', 'door', p(2, 2), p(4, 3), p(1, 4));
  const before = structuredClone({ door, features });
  assert.equal(getWallEdge(door.points[0], features, 1e-7).featureId, 'other-wall', 'Nearest hinge alone is ambiguous');
  const edge = getDoorWall(door, features);
  assert.equal(edge.featureId, 'threshold-wall'); nearPoint(edge.point, p(2, 2));
  assert.deepEqual({ door, features }, before);
  assert.equal(getDoorWall({ points: [p(4, 3), p(2, 2)] }, features).featureId, 'threshold-wall', 'Swapped hinges stay attached');
});

test('saved door attachment rejects off-wall, out-of-segment and invalid thresholds', () => {
  const features = [wall('one', p(2, 2), p(5, 2)), feature('ROOM', 'room', p(1, 1), p(4, 1), p(4, 4))];
  assert.equal(getDoorWall({ points: [p(3, 2), p(6, 2)] }, features), null);
  assert.equal(getDoorWall({ points: [p(3, 2), p(4, 2.01)] }, features), null);
  assert.equal(getDoorWall({ points: [p(1, 1), p(4, 1)] }, features), null, 'Room boundaries do not create a wall attachment');
  assert.equal(getDoorWall({ points: [p(3, 2), p(3, 2)] }, features), null);
  assert.equal(getDoorWall({ points: [p(NaN, 2), p(4, 2)] }, features), null);
  const nearWall = getDoorWall({ points: [p(3, 2 + 1e-8), p(4, 2 - 1e-8)] }, features);
  assert.equal(nearWall.featureId, 'one'); nearPoint(nearWall.point, p(3, 2));
});

test('doors attach and rotate to diagonal walls, clamp width and preserve all inputs', () => {
  const edge = { a: p(2, 2), b: p(5, 5) }, hinge = p(2.9, 3.1), pointer = p(4.7, 4.3), before = structuredClone({ edge, hinge, pointer, source });
  const points = doorOnWall(hinge, pointer, edge, source);
  nearPoint(points[0], p(3, 3)); nearPoint(points[1], p(4.5, 4.5));
  near(doorGeometry({ points }, source).angleDegrees, 90);
  assert.equal(doorFitsMap(doorGeometry({ points }, source), source), true);
  const clamped = doorOnWall(p(3, 3), p(9, 7), edge, source);
  nearPoint(clamped[1], p(5, 5));
  assert.deepEqual({ edge, hinge, pointer, source }, before);
});

test('door swings fall back at map boundaries and reject degenerate or impossible placement', () => {
  const edge = { a: p(1, 8), b: p(4, 8) };
  const points = doorOnWall(p(2, 8), p(3, 8.1), edge, source);
  nearPoint(points[2], p(2, 7));
  assert.equal(doorGeometry({ points }, source).angleDegrees, -90);
  assert.equal(doorOnWall(p(3, 8), p(3, 7), edge, source), null);
  assert.equal(doorOnWall(p(1, 1), p(2, 2), { a: p(1, 1), b: p(1, 1) }, source), null);
  assert.equal(doorOnWall(p(5, 4), p(10, 4), { a: p(0, 4), b: p(10, 4) }, source), null, 'Both five-metre swings exceed the eight-metre map height');
  assert.equal(doorOnWall(p(1, 1), p(Infinity, 2), edge, source), null);
});

test('doorway display gaps merge overlaps without altering persisted walls or doors', () => {
  const main = wall('wall', p(1, 2), p(9, 2));
  const features = [main, feature('DOOR', 'one', p(3, 2), p(5, 2), p(3, 4)), feature('DOOR', 'two', p(6, 2), p(4, 2)), feature('DOOR', 'off', p(7, 2.05), p(8, 2.05))];
  const before = structuredClone(features);
  assert.deepEqual(visibleWallSegments(main, features), [{ a: p(1, 2), b: p(3, 2) }, { a: p(6, 2), b: p(9, 2) }]);
  assert.deepEqual(features, before);
  assert.deepEqual(visibleWallSegments(main, [main]), [{ a: p(1, 2), b: p(9, 2) }]);
  assert.deepEqual(visibleWallSegments(main, [feature('DOOR', 'all', p(0, 2), p(10, 2))]), []);
});

test('doorway display gaps follow diagonal and multi-segment walls without affecting other segments', () => {
  const main = wall('wall', p(1, 1), p(5, 5), p(8, 5)), door = feature('DOOR', 'door', p(2, 2), p(3, 3));
  assert.deepEqual(visibleWallSegments(main, [door]), [
    { a: p(1, 1), b: p(2, 2) }, { a: p(3, 3), b: p(5, 5) }, { a: p(5, 5), b: p(8, 5) },
  ]);
});
