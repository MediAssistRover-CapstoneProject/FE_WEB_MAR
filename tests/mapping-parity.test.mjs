import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { autonomyBlock, MappingAutonomy, mappingRecoveryPlan, prepareMappingWorkflow } from '../src/features/robotOperations/mappingOperations.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const state = () => ({ operator: true, checkedAt: 10000, snapshot: { mqttConnected: true, heartbeatFresh: true, dispatchReady: true }, session: { mapping_session_id: 'session', state: 'MAPPING', job_status: 'RUNNING', potentially_open: true, motionObservedAt: new Date(10000).toISOString(), autonomy: { available: true, control_selected: false } }, detail: { job: { status: 'RUNNING', selectedJobStepId: 'wait' }, steps: [{ jobStepId: 'wait', status: 'RUNNING', stepTypeSnapshot: 'WAIT', resolvedInputsJson: { event_type: 'MAPPING_SAVE_REQUESTED' } }] } });
const scope = { jobId: 'job', sessionId: 'session' };

test('autonomy accepts the same mapping WAIT lane but rejects stale Pi, permission and unavailable autonomy', () => {
  assert.equal(autonomyBlock(state(), 10001), '');
  for (const update of [{ operator: false }, { checkedAt: 0 }, { saving: true }, { snapshot: { dispatchReady: false } }, { session: { ...state().session, motionObservedAt: new Date(-10000).toISOString() } }, { session: { ...state().session, autonomy: { available: false } } }]) assert.ok(autonomyBlock({ ...state(), ...update }, 10001));
  const owned = state(); owned.session.autonomy = { available: true, control_selected: true, run_id: 'own-run' };
  assert.ok(autonomyBlock(owned, 10001)); assert.ok(autonomyBlock(owned, 10001, 'other-run')); assert.equal(autonomyBlock(owned, 10001, 'own-run'), '');
});

test('START is confirmed before RENEW and stop retains the original job/session', async () => {
  const calls = [];
  const run = new MappingAutonomy({ allowed: () => '', send: async (action, context) => { calls.push({ action, context }); return { commandId: String(calls.length), status: 'PI_ACCEPTED' }; } });
  try {
    run.start(scope, 10, true, false);
    await sleep(330);
    await run.stop();
    assert.deepEqual(calls.map(c => c.action.action), ['START', 'RENEW', 'STOP']);
    assert.ok(calls.every(c => c.context.jobId === 'job' && c.context.sessionId === 'session'));
    assert.equal(new Set(calls.map(c => c.action.runId)).size, 1);
    assert.equal(calls[0].action.stopOnReturn, true);
  } finally { run.cancel(); }
});

test('late HTTP acceptance cannot restart a stopped autonomy lease', async () => {
  let complete; const actions = [];
  const run = new MappingAutonomy({ allowed: () => '', send: action => { actions.push(action.action); return action.action === 'START' ? new Promise(resolve => { complete = resolve; }) : Promise.resolve({}); } });
  run.start(scope, 10, false, false);
  await run.stop(); complete({ commandId: 'late', status: 'PI_ACCEPTED' });
  await sleep(350);
  assert.deepEqual(actions, ['START', 'STOP']); assert.equal(run.active, false);
});

test('negative Pi receipt stops renewals; losing readiness also stops the original scope', async () => {
  for (const failure of ['PI_REJECTED', 'NO_PI_ACK', 'PUBLISH_FAILED']) {
    const actions = [];
    const run = new MappingAutonomy({ allowed: () => '', send: async action => { actions.push(action.action); return { commandId: action.action, status: action.action === 'START' ? failure : 'PI_ACCEPTED' }; } });
    run.start(scope, 10, false, false); await sleep(10);
    assert.deepEqual(actions, ['START', 'STOP']); assert.equal(run.active, false); run.cancel();
  }
  let reason = ''; const actions = [];
  const run = new MappingAutonomy({ allowed: () => reason, send: async action => { actions.push(action.action); return { commandId: 'c', status: 'PI_ACCEPTED' }; } });
  run.start(scope, 10, false, false); await sleep(5); reason = 'No fresh connection'; await sleep(330);
  assert.deepEqual(actions, ['START', 'STOP']); assert.equal(run.active, false); run.cancel();
});

test('expired unacknowledged START does not renew forever', async () => {
  let now = 0; const actions = [];
  const run = new MappingAutonomy({ clock: () => now, allowed: () => '', send: async action => { actions.push(action.action); return { commandId: 'pending', status: 'MQTT_PUBLISHED' }; } });
  run.start(scope, 10, false, false); await sleep(5); now = 3600; await sleep(330);
  assert.deepEqual(actions, ['START', 'STOP']); assert.equal(run.active, false); run.cancel();
});

test('save after autonomous finish requires matching run and a recognized completion reason', async () => {
  for (const [report, save] of [[{ reason: 'TIME_LIMIT' }, true], [{ reason: 'RETURNED_TO_START' }, true], [{ reason: 'OBSTACLE' }, false], [{ reason: 'COVERAGE_COMPLETE', coverage_complete: true, exploration: { state: 'COMPLETE' }, save_on_complete: true }, false], [{ reason: 'COVERAGE_COMPLETE', coverage_complete: true, exploration: { state: 'COMPLETE' }, save_on_complete: false }, true]]) {
    const finished = [];
    const run = new MappingAutonomy({ allowed: () => '', send: async () => ({}), onFinish: context => finished.push(context) });
    run.start(scope, 10, false, true);
    run.observe({ run_id: 'other', finished: true, ...report }, scope); assert.equal(run.active, true);
    run.observe({ run_id: run.run.runId, finished: true, ...report }, scope);
    assert.equal(finished.length, save ? 1 : 0); assert.equal(run.active, false); run.cancel();
  }
});

test('invalid duration or a blocked scope does not issue a command', () => {
  const run = new MappingAutonomy({ allowed: () => '', send: () => { throw Error('Must not send'); } });
  for (const duration of [9, 601, 10.5, NaN]) assert.throws(() => run.start(scope, duration, false, false));
  assert.throws(() => run.start({}, 10, false, false));
  run.allowed = () => 'Wrong session'; assert.throws(() => run.start(scope, 10, false, false));
});

test('mapping recovery cannot fabricate physical stop evidence from heartbeat', () => {
  const pending = { selectedUnsentStop: true, canReconcile: false, blockers: ['PI_NOT_STOPPED'] };
  assert.throws(() => mappingRecoveryPlan('job', pending, null, 'Check'), /PI_NOT_STOPPED/);
  const evidence = { jobId: 'job', recoveryRequired: true, jobStepId: 'step', operationKey: 'operation', transportSessionId: 'transport', commands: [{ commandType: 'EXECUTE_STEP', jobStepId: 'step', commandId: 'command' }] };
  assert.throws(() => mappingRecoveryPlan('job', {}, evidence, 'Check'), /heartbeat/);
  evidence.commands[0].physicalStopConfirmed = true;
  const plan = mappingRecoveryPlan('job', {}, evidence, 'Checked robot');
  assert.equal(plan.path, '/api/v1/jobs/job/operations/step/reconcile');
  assert.equal(plan.body.evidence, 'PI_STOP_CONFIRMED'); assert.equal(plan.body.outcome, 'CONFIRM_CANCELLED');
  evidence.jobId = 'other'; assert.throws(() => mappingRecoveryPlan('job', {}, evidence, 'Check'), /không thuộc/);
});

test('unsent/rejected mapping recovery uses BE selected step and transport identity', () => {
  const plan = mappingRecoveryPlan('job', { jobId: 'job', selectedRejectedMappingAction: true, canReconcile: true, jobStepId: 'step', transportSessionId: 'transport' }, null, '  Robot checked  ');
  assert.equal(plan.path, '/api/v1/jobs/job/mapping-recovery');
  assert.deepEqual(plan.body, { jobStepId: 'step', transportSessionId: 'transport', confirmedStopped: true, outcome: 'CONFIRM_CANCELLED', note: 'Robot checked' });
});

const definition = JSON.parse(await readFile(new URL('../public/robot-console/mapping-workflow.json', import.meta.url), 'utf8'));
const workflowDetail = () => ({ workflow: { ...definition.workflow, workflowId: 'published', startStepId: definition.graph.startStepCode, status: 'PUBLISHED', acceptsNewJobs: true }, steps: definition.graph.steps.map(step => ({ ...step, stepId: step.stepCode, stepTypeCode: step.stepType })), transitions: definition.graph.transitions.map(t => ({ ...t, fromStepId: t.fromStepCode, toStepId: t.toStepCode })) });
test('workflow preparation reuses an accepting published mapping version without any mutation', async () => {
  const id = await prepareMappingWorkflow({ definition, request: async () => [workflowDetail()], post: async () => { throw Error('Must not mutate'); } });
  assert.equal(id, 'published');
});
test('same workflow code with a changed save step cannot be reused as the reviewed template', async () => {
  const changed = workflowDetail(); changed.steps.find(s => s.stepCode === 'SAVE_MAPPING').paramsJson = { sensing_type: 'MAPPING', action: 'STOP' };
  const calls = [];
  await prepareMappingWorkflow({ definition, request: async path => path.endsWith('/all') ? [changed] : { content: [{ workflowCode: 'WF_MAPPING', versionNo: 8 }], last: true }, post: async (path, body) => { calls.push({ path, body }); return { workflow: { workflowId: 'replacement' } }; } });
  assert.equal(calls[0].body.workflow.versionNo, 9); assert.equal(calls[0].body.graph.steps.find(s => s.stepCode === 'SAVE_MAPPING').paramsJson.action, 'SAVE');
});

test('workflow preparation uses a new template version and validates before publishing', async () => {
  const calls = [];
  const id = await prepareMappingWorkflow({ definition, request: async path => path.endsWith('/all') ? [] : { content: [{ workflowCode: 'WF_MAPPING', versionNo: 4, status: 'DRAFT' }], last: true }, post: async (path, body) => { calls.push({ path, body }); return { workflow: { workflowId: 'new' } }; } });
  assert.equal(id, 'new'); assert.equal(calls[0].body.workflow.versionNo, 5);
  assert.deepEqual(calls.map(c => c.path), ['/api/v1/admin/workflows/graph', '/api/v1/admin/workflows/new/validate', '/api/v1/admin/workflows/new/publish']);
  assert.equal(definition.workflow.versionNo, 1);
});
