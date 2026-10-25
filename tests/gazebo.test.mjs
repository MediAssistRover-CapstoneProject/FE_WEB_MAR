import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { toRosPoint, fromRosPoint, gazeboManifest, bridgeUrl, routeRequest } from '../src/features/gazebo/gazeboModel.js';

test('ROS coordinates preserve origin, inverted image Y and heading', () => {
  assert.deepEqual(toRosPoint({ x: 600, y: 350 }), { x: 0, y: -.5, yaw: 0 });
  const point = { x: 580, y: 330, heading: 90 };
  assert.deepEqual(fromRosPoint(toRosPoint(point)), point);
  assert.equal(fromRosPoint({ x: NaN, y: 0, yaw: 0 }), null);
});

test('cross-language manifest changes with saved endpoints and zones', async () => {
  const snapshot = { zones: [], endpoints: [{ id: 'a', name: 'Điểm A', x: 580, y: 330 }, { id: 'b', name: 'Điểm B', x: 720, y: 330 }] };
  const manifest = await gazeboManifest(snapshot);
  assert.equal(manifest.mapKey, createHash('sha256').update(manifest.content).digest('hex'));
  assert.notEqual(manifest.mapKey, (await gazeboManifest({ ...snapshot, zones: [{ type: 'SPEED', speed: .2 }] })).mapKey);
  await mkdir('.workstation-build/gazebo', { recursive: true });
  await writeFile('.workstation-build/gazebo/test-map.json', JSON.stringify(manifest));
  const plan = { valid: true, points: snapshot.endpoints.map(endpoint => ({ endpoint, step: { paramsJson: { max_speed_mps: '.3' } } })) };
  assert.deepEqual(routeRequest(plan, manifest, 'run-1').steps, [{ endpointId: 'a', speed: .3 }, { endpointId: 'b', speed: .3 }]);
  assert.throws(() => routeRequest({ ...plan, valid: false }, manifest, 'run-1'));
});

test('bridge requires a bare HTTP origin without embedded credentials', () => {
  assert.equal(bridgeUrl('http://192.168.1.10:8765/'), 'http://192.168.1.10:8765');
  for (const value of ['ws://localhost:8765', 'http://a:b@localhost:8765', 'http://localhost:8765/run', 'http://localhost:8765/?token=x']) assert.throws(() => bridgeUrl(value));
});
