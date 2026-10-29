import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDraft, saveMap, STORAGE_KEY } from '../src/pages/Admin/mapStudioModel.js';
import { buildPatrolGraph } from '../src/features/workflows/patrolWorkflowModel.js';
import { LOCAL_MAP_ID, LOCAL_WORKFLOWS_KEY, localMapCatalog, readLocalDesigns, mergeLocalDesigns, saveLocalGraph, removeLocalDesign, getDesign, localPatrolPlan } from '../src/features/workflows/localPatrolDesign.js';

function fixture() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const map = saveMap({ ...createDraft(), scan: { status: 'complete', progress: 100 }, endpoints: [
    { id: 'ep1', name: 'EP1', x: 580, y: 330, type: 'PARK', enabled: true },
    { id: 'ep2', name: 'EP2', x: 580, y: 550, type: 'WAYPOINT', enabled: true },
  ] }, '2026-10-22T00:00:00Z');
  storage.setItem(STORAGE_KEY, JSON.stringify(map));
  const workflow = { workflowId: 'server-patrol', workflowName: 'Tuần tra', serviceType: 'PATROL', status: 'PUBLISHED' };
  const graph = buildPatrolGraph([{ code: 'TASK', name: 'Tuyến', steps: ['ep1', 'ep2', 'ep1'].map((id, index) => ({ code: 'MOVE_' + index, type: 'MOVE', values: { map_id: LOCAL_MAP_ID, endpoint_id: id, max_speed_mps: .08 } })) }]);
  return { storage, map, workflow, graph };
}

test('dropdown catalog reads exactly shared EP1/EP2, no server or generated points', () => {
  const { storage } = fixture();
  assert.deepEqual(localMapCatalog(storage).endpoints.map(point => point.endpointName), ['EP1', 'EP2']);
  storage.setItem(STORAGE_KEY, JSON.stringify(createDraft()));
  assert.deepEqual(localMapCatalog(storage).endpoints, []);
  assert.deepEqual(localMapCatalog(storage).maps, []);
});

test('local save → reload → edit → delete, without remote calls or map modifications', async () => {
  const { storage, workflow, graph } = fixture();
  const before = storage.getItem(STORAGE_KEY);
  const saved = saveLocalGraph({ workflow, graph }, storage);
  assert.equal(saved.workflow.localOnly, true);
  assert.equal(saved.workflow.acceptsNewJobs, false);
  assert.equal(saved.workflow.status, 'DRAFT');
  const loaded = await getDesign(workflow.workflowId, () => { throw Error('remote called'); }, storage);
  assert.deepEqual(loaded, saved);
  graph.steps[1].paramsJson.max_speed_mps = .1;
  saveLocalGraph({ workflow, graph }, storage);
  assert.equal(readLocalDesigns(storage)[0].steps[1].paramsJson.max_speed_mps, .1);
  const merged = mergeLocalDesigns([workflow, { workflowId: 'speech', serviceType: 'SPEECH' }], storage);
  assert.equal(merged.filter(item => item.serviceType === 'PATROL').length, 1);
  assert.equal(merged[0].localOnly, true);
  removeLocalDesign(workflow.workflowId, storage);
  assert.deepEqual(readLocalDesigns(storage), []);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('local route follows all MOVE steps, respects speed and invalidates changed maps', () => {
  const { storage, workflow, graph, map } = fixture();
  const detail = saveLocalGraph({ workflow, graph }, storage);
  const plan = localPatrolPlan(detail, map.saved, 'ep1');
  assert.equal(plan.valid, true, plan.issues.join('; '));
  assert.deepEqual(plan.resolved.map(point => point.id), ['ep1', 'ep2', 'ep1']);
  assert.ok(plan.duration >= plan.distance / .08 - .001);
  const changed = structuredClone(map.saved); changed.revision += 1;
  assert.equal(localPatrolPlan(detail, changed, 'ep1').valid, false);
  changed.snapshot.endpoints.pop();
  assert.equal(localPatrolPlan(detail, changed, 'ep1').valid, false);
});

test('server map IDs cannot be saved as local route and corrupt storage is preserved', () => {
  const { storage, workflow, graph } = fixture();
  graph.steps[0].paramsJson.map_id = 'gazebo-server-map';
  assert.throws(() => saveLocalGraph({ workflow, graph }, storage), /Chọn lại điểm/);
  storage.setItem(LOCAL_WORKFLOWS_KEY, '{broken');
  assert.throws(() => saveLocalGraph({ workflow, graph }, storage), /Dữ liệu cũ/);
  assert.equal(storage.getItem(LOCAL_WORKFLOWS_KEY), '{broken');
});

test('Patrol has only PATROL choices and no robot/scheduler writes; Map Studio has no source tabs', () => {
  const patrol = readFileSync(new URL('../src/pages/Admin/PatrolRoutesFigma.jsx', import.meta.url), 'utf8');
  assert.match(patrol, /item.serviceType === 'PATROL'/);
  assert.doesNotMatch(patrol, /createSchedule|activateSchedule|listRobots|listSchedules|createJob|Quy trình khác/);
  assert.match(patrol, /<LidarMap/);
  assert.match(patrol, /Chạy mô phỏng/);
  const map = readFileSync(new URL('../src/pages/Admin/MapStudioFigma.jsx', import.meta.url), 'utf8');
  assert.match(map, /<LiveMapping embedded/);
  assert.doesNotMatch(map, /<RobotConsole|aria-pressed=\{mode === 'robot'\}/);
  const move = readFileSync(new URL('../src/pages/Workflows/MoveDestinationFields.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(move, /workflowApi|listEndpoints|listMaps/);
});
