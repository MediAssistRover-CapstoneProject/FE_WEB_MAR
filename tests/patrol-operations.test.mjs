import test from 'node:test';
import assert from 'node:assert/strict';
import { allPatrolPages, patrolApi } from '../src/features/patrol/patrolApi.js';
import { newPatrolDispatch, patrolDraftErrors, patrolHoldSummary, patrolReadiness, patrolRoute } from '../src/features/patrol/patrolModel.js';

const workflow = { workflowId: 'wf-1', workflowCode: 'WF_PATROL_A', workflowName: 'Tầng 1', serviceType: 'PATROL', status: 'PUBLISHED', acceptsNewJobs: true, startStepId: 'move-b', defaultInputsJson: { map_id: 'map-1', patrol_repeat_count: 0 } };
const endpoints = [
  { endpointId: 'ep-a', mapId: 'map-1', active: true, accessible: true, yawRad: 0 },
  { endpointId: 'ep-b', mapId: 'map-1', active: true, accessible: true, yawRad: 0 },
];
const steps = [
  { stepId: 'move-a', sequenceNo: 1, stepTypeCode: 'MOVE', paramsJson: { map_id: 'map-1', endpoint_id: 'ep-a' } },
  { stepId: 'sense-a', sequenceNo: 2, stepTypeCode: 'EXECUTE_SENSING', paramsJson: { sensing_type: 'CROWD_DENSITY', zone_id: 'zone-1', window_sec: 12 } },
  { stepId: 'move-b', sequenceNo: 3, stepTypeCode: 'MOVE', paramsJson: { map_id: 'map-1', endpoint_id: 'ep-b' } },
  { stepId: 'sense-b', sequenceNo: 4, stepTypeCode: 'EXECUTE_SENSING', paramsJson: { sensing_type: 'PATROL_FALL', fall_detection: true, window_sec: 12 } },
];
const transitions = [
  { fromStepId: 'move-b', toStepId: 'sense-b' }, { fromStepId: 'sense-b', toStepId: 'move-a' },
  { fromStepId: 'move-a', toStepId: 'sense-a' }, { fromStepId: 'sense-a', toStepId: null, terminalStatus: 'SUCCEEDED' },
].map(item => ({ ...item, outcome: 'SUCCESS', defaultTransition: true, conditionJson: null }));

test('patrol preview follows the executable success chain and pairs sensing with its checkpoint', () => {
  const route = patrolRoute({ workflow, steps, transitions }, endpoints);
  assert.deepEqual(route.checkpoints.map(point => point.endpointId), ['ep-b', 'ep-a']);
  assert.equal(route.checkpoints[0].sensingType, 'PATROL_FALL');
  assert.equal(route.checkpoints[1].zoneId, 'zone-1');
  assert.equal(route.continuous, true);
  assert.deepEqual(route.issues, []);
});

test('a conditional branch cannot be presented as a ready fixed patrol route', () => {
  const route = patrolRoute({ workflow, steps, transitions: [...transitions, { ...transitions[0], toStepId: 'move-a' }] }, endpoints);
  assert.ok(route.issues.length > 0);
  const robot = { robotId: 'robot-1', currentMapId: 'map-1', status: 'IDLE' };
  assert.equal(patrolReadiness(robot, { robot, observedAt: new Date().toISOString(), mqttConnected: true, heartbeatFresh: true, dispatchReady: true }, route).blocked, true);
});

test('a published route stops being ready if a saved endpoint becomes unavailable or loses its heading', () => {
  for (const patch of [{ active: false }, { accessible: false }, { mapId: 'map-2' }, { yawRad: null }]) {
    const changed = endpoints.map(endpoint => endpoint.endpointId === 'ep-b' ? { ...endpoint, ...patch } : endpoint);
    const route = patrolRoute({ workflow, steps, transitions }, changed);
    assert.ok(route.issues.some(issue => issue.includes('Điểm 1')), JSON.stringify(patch));
  }
  const missing = patrolRoute({ workflow, steps, transitions }, endpoints.filter(endpoint => endpoint.endpointId !== 'ep-b'));
  assert.ok(missing.issues.some(issue => issue.includes('Điểm 1')));
});

test('removing the manual hold never implies an incident or voice hold has cleared', () => {
  const before = patrolHoldSummary({ holds: [{ source: 'MANUAL' }, { source: 'INCIDENT' }, { source: 'VOICE' }] });
  assert.equal(before.manual, true);
  assert.equal(before.external, true);
  const after = patrolHoldSummary({ resumeRequested: true, holds: [{ source: 'INCIDENT' }, { source: 'VOICE' }], resumeBlockedReason: 'ACTIVE_SUSPENSION_HOLDS' });
  assert.equal(after.manual, false);
  assert.equal(after.external, true);
  assert.equal(after.labels.length, 2);
  assert.equal(after.blockedReason, 'ACTIVE_SUSPENSION_HOLDS');
});

test('stale snapshots and an existing suspended patrol block a new dispatch', () => {
  const route = patrolRoute({ workflow, steps, transitions }, endpoints);
  const robot = { robotId: 'robot-1', currentMapId: 'map-1', status: 'IDLE' };
  const now = Date.parse('2026-11-16T10:00:00Z');
  const snapshot = { robot, observedAt: '2026-11-16T10:00:00Z', mqttConnected: true, heartbeatFresh: true, dispatchReady: true, suspendedPatrolJobIds: [] };
  assert.equal(patrolReadiness(robot, snapshot, route, { now }).blocked, false);
  assert.equal(patrolReadiness(robot, snapshot, route, { now: now + 21000 }).blocked, true);
  assert.equal(patrolReadiness(robot, { ...snapshot, suspendedPatrolJobIds: ['job-1'] }, route, { now }).blocked, true);
  assert.equal(patrolReadiness(robot, snapshot, route, { now, jobs: [{ robotId: robot.robotId, status: 'SUSPENDED' }] }).blocked, true);
});

test('dispatch preserves the published route and binds one explicit robot with low priority', () => {
  const attempt = newPatrolDispatch(workflow, 'robot-1', 'unique', new Date('2026-11-16T10:00:00Z'));
  assert.deepEqual(attempt.body.inputTemplateJson, {});
  assert.equal(attempt.body.priority, 0);
  assert.equal(attempt.body.robotId, 'robot-1');
  assert.equal(attempt.code, attempt.body.scheduleCode);
  assert.equal(attempt.body.scheduleType, 'ONCE');
  assert.throws(() => newPatrolDispatch({ ...workflow, status: 'DRAFT' }, 'robot-1', 'unique'));
  assert.throws(() => newPatrolDispatch(workflow, '', 'unique'));
});

test('sensing configuration rejects the wrong zone type and insufficient fall observation time', () => {
  const catalog = { maps: [{ mapId: 'map-1', status: 'ACTIVE' }], endpoints, zones: [{ zoneId: 'zone-1', mapId: 'map-1', active: true, zoneType: 'AREA' }] };
  const draft = { name: 'Tầng 1', mapId: 'map-1', repeatCount: 1, sensingWindowSec: 12, checkpoints: [{ endpointId: 'ep-a', sensingType: 'RESTRICTED_ZONE', zoneId: 'zone-1' }] };
  assert.ok(patrolDraftErrors(draft, catalog).some(error => error.includes('vùng quan sát')));
  const fall = { ...draft, sensingWindowSec: 2, checkpoints: [{ endpointId: 'ep-a', sensingType: 'PATROL_FALL', zoneId: null }] };
  assert.ok(patrolDraftErrors(fall, catalog).some(error => error.includes('3 đến 30')));
  assert.deepEqual(patrolDraftErrors({ ...fall, sensingWindowSec: 3 }, catalog), []);
  for (const repeatCount of ['', ' ', null, undefined]) assert.ok(patrolDraftErrors({ ...fall, sensingWindowSec: 3, repeatCount }, catalog).some(error => error.includes('Số vòng')));
  assert.deepEqual(patrolDraftErrors({ ...fall, sensingWindowSec: 3, repeatCount: 0 }, catalog), []);
});

test('catalog loading keeps records after the first page and rejects malformed responses', async () => {
  const result = await allPatrolPages(async ({ page }) => ({ content: [{ id: page }], last: page === 1, totalPages: 2 }));
  assert.deepEqual(result, [{ id: 0 }, { id: 1 }]);
  await assert.rejects(allPatrolPages(async () => ({ data: [] })), /không đúng định dạng/);
});

test('a rejected job control command is sent once without authentication replay', async () => {
  const savedFetch = globalThis.fetch;
  const data = new Map([['mediassist-rover.session', JSON.stringify({ tokens: { accessToken: 'test', refreshToken: 'refresh' } })]]);
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  globalThis.sessionStorage = { getItem: () => null, removeItem: () => {} };
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ message: 'Phiên đã hết hạn' }), { status: 401 });
  };
  try {
    await assert.rejects(patrolApi.suspendJob('job/1', 'Tạm dừng theo yêu cầu'), /Phiên đã hết hạn/);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.endsWith('/api/v1/jobs/job%2F1/suspend'));
    assert.deepEqual(JSON.parse(requests[0].options.body), { reason: 'Tạm dừng theo yêu cầu' });
  } finally {
    globalThis.fetch = savedFetch;
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
});
