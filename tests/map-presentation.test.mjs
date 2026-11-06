import test from 'node:test';
import assert from 'node:assert/strict';
import { insideMap, localToWorld, newFeature, presentationIssues, rectangle, svgPoint, worldToLocal } from '../src/features/facility/mapPresentation.js';

const source = { widthM: 10, heightM: 6, originXM: -3.4, originYM: 5.2, originYawRad: Math.PI / 3 };
test('rotated ROS coordinates and top-left SVG stay aligned', () => {
  const local = { x: 2.5, y: 4.5 };
  const world = localToWorld(local, source), back = worldToLocal(world, source);
  assert.ok(Math.abs(back.x - local.x) < 1e-10);
  assert.ok(Math.abs(back.y - local.y) < 1e-10);
  assert.deepEqual(svgPoint(local, source), { x: 2.5, y: 1.5 });
});
test('drag rectangles work in either direction and reject zero-area or outside geometry', () => {
  const points = rectangle({ x: 4, y: 4 }, { x: 1, y: 1 });
  assert.deepEqual(points, rectangle({ x: 1, y: 1 }, { x: 4, y: 4 }));
  const room = newFeature('ROOM', points, source);
  const doc = { schemaVersion: 1, backgroundColor: '#ffffff', features: [room] };
  assert.deepEqual(presentationIssues(doc, source), []);
  assert.ok(presentationIssues({ ...doc, features: [{ ...room, points: rectangle({ x: 1, y: 1 }, { x: 1, y: 4 }) }] }, source).length);
  assert.equal(insideMap({ x: 11, y: 0 }, source), false);
  assert.equal(insideMap({ x: Number.NaN, y: 0 }, source), false);
});
