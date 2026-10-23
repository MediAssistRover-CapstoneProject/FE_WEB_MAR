import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, saveMap, STORAGE_KEY } from '../src/pages/Admin/mapStudioModel.js';
import { buildPatrolPlan, draftErrors, loadPatrols, mapReference, newPatrol, PATROL_STORAGE_KEY, readPatrolMap, sameMap, scheduleLabel, writePatrols } from '../src/pages/Admin/patrolModel.js';
import { samplePlan, segmentAllowed, createDispatchPlan } from '../src/pages/Workstations/mapDispatchModel.js';

const endpoint = (id, x, y, type = 'WAYPOINT') => ({ id, name: id, x, y, type });
const map = () => ({ ...createDraft(), scan: { status: 'complete', progress: 100 }, endpoints: [endpoint('home', 580, 330, 'PARK'), endpoint('pharmacy', 815, 245), endpoint('hall', 580, 550)] });
const rectangle = (type, x, y, w, h) => ({ id: type, name: type, type, points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
function fixture() {
  const saved = saveMap(map(), '2026-10-20T00:00:00Z').saved;
  return { saved, route: { ...newPatrol(saved), name: 'Ca tối', stops: [{ endpointId: 'pharmacy', dwellSec: 8 }, { endpointId: 'hall', dwellSec: 15 }] } };
}
function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}
test('patrol visits every selected point in order, waits and returns without executing endpoint tasks', () => {
  const { saved, route } = fixture();
  saved.snapshot.endpoints[1].tasks = [{ action: 'LOAD', seconds: 100 }];
  const original = structuredClone(saved);
  route.returnToStart = true;
  const plan = buildPatrolPlan(saved.snapshot, route);
  assert.equal(plan.valid, true);
  assert.deepEqual(plan.resolved.map(s => s.id), ['pharmacy', 'hall', 'home']);
  assert.equal(plan.timeline.filter(s => s.action === 'WAIT').reduce((sum, s) => sum + s.end - s.start, 0), 23);
  assert.equal(plan.timeline.some(s => s.action === 'LOAD'), false);
  for (const leg of plan.legs) for (let i = 1; i < leg.path.length; i++) assert.ok(segmentAllowed(saved.snapshot, leg.path[i - 1], leg.path[i]));
  const wait = plan.timeline.find(s => s.action === 'WAIT');
  assert.equal(samplePlan(plan, wait.start + 2).point.x, 815);
  assert.equal(samplePlan(plan, plan.duration).point.x, 580);
  assert.deepEqual(saved, original);
});
test('blocked segment reports its specific endpoints and no path is drawn through the blockage', () => {
  const { saved, route } = fixture();
  saved.snapshot.zones = [rectangle('KEEP_OUT', 790, 310, 125, 40)];
  const plan = buildPatrolPlan(saved.snapshot, route);
  assert.equal(plan.valid, false);
  assert.match(plan.issues[0], /Đoạn 1 \(home → pharmacy\)/);
  assert.deepEqual(plan.legs[0].path, []);
});
test('speed zone affects estimates; missing, disabled and no-stop endpoints cannot simulate', () => {
  const { saved, route } = fixture();
  const normal = buildPatrolPlan(saved.snapshot, route);
  saved.snapshot.zones = [{ ...rectangle('SPEED', 500, 315, 400, 32), speed: .1 }];
  assert.ok(buildPatrolPlan(saved.snapshot, route).duration > normal.duration);
  saved.snapshot.endpoints[1].enabled = false;
  assert.equal(buildPatrolPlan(saved.snapshot, route).valid, false);
  saved.snapshot.endpoints.splice(1, 1);
  assert.match(buildPatrolPlan(saved.snapshot, route).issues.join(' '), /điểm đã bị xóa/);
  const fresh = fixture();
  fresh.saved.snapshot.zones = [rectangle('NO_STOP', 795, 225, 40, 40)];
  assert.equal(buildPatrolPlan(fresh.saved.snapshot, fresh.route).valid, false);
});
test('create/save/reload/edit/delete preserves the shared map and handles storage errors', () => {
  const storage = memory(), { saved, route } = fixture();
  const draft = { ...saved.snapshot, saved };
  storage.setItem(STORAGE_KEY, JSON.stringify(draft));
  assert.deepEqual(readPatrolMap(storage), saved);
  const value = { ...route, id: 'route-1' };
  writePatrols(storage, [value]);
  assert.deepEqual(loadPatrols(storage).routes, [value]);
  writePatrols(storage, [{ ...loadPatrols(storage).routes[0], name: 'Ca sáng', stops: [...value.stops].reverse() }]);
  assert.equal(loadPatrols(storage).routes[0].stops[0].endpointId, 'hall');
  writePatrols(storage, []);
  assert.deepEqual(loadPatrols(storage).routes, []);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(draft));
  assert.throws(() => writePatrols({ setItem: () => { throw Error('quota'); } }, [value]), /quota/);
  storage.setItem(PATROL_STORAGE_KEY, '{bad');
  assert.ok(loadPatrols(storage).error);
  assert.equal(storage.getItem(PATROL_STORAGE_KEY), '{bad');
});
test('map revisions and invalid dwell/schedule values require correction', () => {
  const { saved, route } = fixture();
  assert.deepEqual(draftErrors(route, saved), []);
  assert.equal(sameMap(route.mapRef, saved), true);
  saved.revision++;
  assert.equal(sameMap(route.mapRef, saved), false);
  assert.match(draftErrors(route, saved).join(' '), /Bản đồ đã thay đổi/);
  route.mapRef = mapReference(saved);
  route.stops[0].dwellSec = -1;
  route.schedule = { startsAt: '2026-10-20T18:00', repeat: 'interval', intervalHours: 0 };
  assert.match(draftErrors(route, saved).join(' '), /Thời gian dừng/);
  assert.match(draftErrors(route, saved).join(' '), /Khoảng lặp/);
  assert.match(scheduleLabel(route.schedule), /18:00/);
});
test('dispatch endpoint groups still resolve exactly one member', () => {
  const m = map();
  m.endpointGroups = [{ id: 'group', code: 'G', name: 'Nhóm', active: true, selectionPolicy: 'PRIORITY', members: [{ endpointId: 'pharmacy', active: true, sequenceNo: 1 }, { endpointId: 'hall', active: true, sequenceNo: 2 }] }];
  assert.equal(createDispatchPlan(m, 'home', ['group:group']).resolved.length, 1);
});
