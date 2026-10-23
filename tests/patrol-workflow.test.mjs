import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatrolGraph, loadAllPages, orderedPatrolSteps, resolvePatrolRoute, patrolPreview, patrolRobotReady } from '../src/features/workflows/patrolWorkflowModel.js';
import { editorTasks, stepPayload } from '../src/features/workflows/workflowDraftModel.js';

function fixture() {
  const maps = [{ mapId: 'map-1', status: 'ACTIVE' }];
  const endpoints = [0, 1, 2].map(index => ({ endpointId: `ep-${index}`, mapId: 'map-1', endpointName: `Điểm ${index}`, xM: index, yM: 0, active: true, accessible: true }));
  const tasks = [{ code: 'PATROL_ROUTE', name: 'Tuyến tuần tra', steps: endpoints.map((endpoint, index) => ({ code: `MOVE_${index}`, type: 'MOVE', values: { map_id: 'map-1', endpoint_id: endpoint.endpointId, max_speed_mps: '0.1', mode: 'PATROL' } })) }];
  const graph = buildPatrolGraph(tasks);
  const detail = {
    workflow: { workflowId: 'wf-1', serviceType: 'PATROL', schemaVersion: 3, status: 'PUBLISHED', acceptsNewJobs: true, startStepId: graph.startStepCode },
    tasks: [{ taskId: 'task-1', taskCode: 'PATROL_ROUTE', taskName: 'Tuyến tuần tra', sequenceNo: 1 }],
    steps: graph.steps.map(step => ({ ...step, taskId: 'task-1', stepId: step.stepCode, stepTypeCode: step.stepType, enabled: true })),
    transitions: graph.transitions.map(edge => ({ ...edge, fromStepId: edge.fromStepCode, toStepId: edge.toStepCode })),
  };
  return { maps, endpoints, tasks, graph, detail };
}

test('graph uses one task and 3 numeric MOVE configurations, with safe terminal transitions', () => {
  const { graph } = fixture();
  assert.equal(graph.tasks.length, 1);
  assert.equal(graph.steps.length, 3);
  assert.equal(graph.transitions.length, 9);
  assert.equal(graph.steps[0].paramsJson.max_speed_mps, .1);
  assert.equal(graph.transitions.at(-3).terminalStatus, 'SUCCEEDED');
  assert.ok(graph.transitions.filter(edge => edge.outcome !== 'SUCCESS').every(edge => edge.terminalStatus === 'RECOVERY_REQUIRED'));
});

test('save → reload → edit → save keeps the same endpoint references and order', () => {
  const { detail, endpoints } = fixture();
  const tasks = editorTasks(detail);
  assert.deepEqual(tasks[0].steps.map(step => step.values.endpoint_id), endpoints.map(point => point.endpointId));
  tasks[0].steps.reverse();
  const graph = buildPatrolGraph(tasks);
  assert.deepEqual(graph.steps.map(step => step.paramsJson.endpoint_id), [...endpoints].reverse().map(point => point.endpointId));
  assert.equal(graph.startStepCode, 'MOVE_2');
});

test('preview follows SUCCESS graph order rather than array or sequence ordering', () => {
  const { detail } = fixture();
  detail.steps.reverse();
  detail.steps[0].sequenceNo = 0;
  assert.deepEqual(orderedPatrolSteps(detail).steps.map(step => step.stepId), ['MOVE_0', 'MOVE_1', 'MOVE_2']);
});

test('draft is previewable but never deployable', () => {
  const { detail, maps, endpoints } = fixture();
  detail.workflow.status = 'DRAFT'; detail.workflow.acceptsNewJobs = false;
  const route = resolvePatrolRoute(detail, maps, endpoints);
  assert.equal(route.issues.length, 0);
  assert.ok(route.deploymentIssues.length > 0);
  assert.equal(patrolRobotReady({ currentMapId: 'map-1', status: 'IDLE', capabilitiesJson: ['MOVE'] }, route), false);
});

test('workflow name does not imply PATROL and legacy chains require explicit conversion', () => {
  const { detail, maps, endpoints } = fixture();
  detail.workflow.serviceType = 'CUSTOM'; detail.workflow.workflowName = 'Tuần tra'; detail.transitions = [];
  const route = resolvePatrolRoute(detail, maps, endpoints);
  assert.equal(route.points.length, 3);
  assert.ok(route.issues.some(issue => issue.includes('liên kết')));
  assert.ok(route.deploymentIssues.some(issue => issue.includes('Tuyến tuần tra')));
});

test('reject missing, inaccessible and cross-map endpoints', () => {
  for (const mutation of [items => items.pop(), items => { items[0].accessible = false; }, items => { items[1].mapId = 'other'; }]) {
    const { detail, maps, endpoints } = fixture(); mutation(endpoints);
    assert.ok(resolvePatrolRoute(detail, maps, endpoints).issues.length);
  }
});

test('reject branching and cycles rather than pretending they form a linear route', () => {
  const { detail } = fixture();
  detail.transitions.push({ ...detail.transitions[0], toStepId: 'MOVE_2' });
  assert.ok(orderedPatrolSteps(detail).issues.length);
  detail.transitions.pop();
  detail.transitions.find(edge => edge.fromStepId === 'MOVE_2' && edge.outcome === 'SUCCESS').toStepId = 'MOVE_0';
  assert.ok(orderedPatrolSteps(detail).issues.some(issue => issue.includes('vòng lặp')));
});

test('builder rejects wrong map, missing point, unsupported step, invalid speed and dynamic input', () => {
  const mutations = [step => { step.values.map_id = 'other'; }, step => { step.values.endpoint_id = ''; }, step => { step.type = 'WAIT'; }, step => { step.values.max_speed_mps = 'abc'; }, step => { step.values.max_speed_mps = .31; }, step => { step.inputMappingJson = { endpoint_id: '$.input.endpoint' }; }];
  for (const mutate of mutations) { const { tasks } = fixture(); mutate(tasks[0].steps[0]); assert.throws(() => buildPatrolGraph(tasks)); }
});

test('robot readiness is evaluated against assigned robot, map and capabilities', () => {
  const { detail, maps, endpoints } = fixture(); const route = resolvePatrolRoute(detail, maps, endpoints);
  const ready = { currentMapId: 'map-1', status: 'IDLE', capabilitiesJson: ['MOVE'] };
  assert.equal(patrolRobotReady(ready, route), true);
  for (const patch of [{ status: 'OFFLINE' }, { currentMapId: 'other' }, { capabilitiesJson: [] }]) assert.equal(patrolRobotReady({ ...ready, ...patch }, route), false);
});

test('simulation interpolates smoothly and has a consistent end and reset', () => {
  const { detail, maps, endpoints } = fixture(); const route = resolvePatrolRoute(detail, maps, endpoints);
  const start = patrolPreview(route.points, 0), middle = patrolPreview(route.points, 5), end = patrolPreview(route.points, 200);
  assert.equal(start.progress, 0); assert.equal(start.distance, 2); assert.equal(start.duration, 20);
  assert.equal(middle.position.xM, .5); assert.equal(middle.progress, .25);
  assert.equal(end.progress, 1); assert.equal(end.position.xM, 2);
  assert.deepEqual(patrolPreview(route.points, 0), start);
  assert.equal(patrolPreview([]).progress, 0);
});

test('all pages are fetched with BE size limit and failures are not masked', async () => {
  const calls = [];
  const items = await loadAllPages(async params => { calls.push(params); return { content: [params.page], totalPages: 3, last: params.page === 2 }; });
  assert.deepEqual(items, [0, 1, 2]); assert.ok(calls.every(call => call.size === 100));
  await assert.rejects(loadAllPages(async () => { throw new Error('403'); }), /403/);
  assert.deepEqual(await loadAllPages(async () => ({ content: [], totalPages: 0 })), []);
});

test('generic MOVE save converts numeric text but preserves dynamic configuration', () => {
  const { tasks } = fixture();
  assert.equal(stepPayload(tasks[0].steps[0], 'task', 1).paramsJson.max_speed_mps, .1);
  tasks[0].steps[0].values.max_speed_mps = { $ref: 'input.speed' };
  assert.deepEqual(stepPayload(tasks[0].steps[0], 'task', 1).paramsJson.max_speed_mps, { $ref: 'input.speed' });
});
