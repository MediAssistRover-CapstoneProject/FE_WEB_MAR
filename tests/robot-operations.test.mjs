import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleWorkflows, movementBlock, MappingJog, committedMapId, isOperator } from '../src/features/robotOperations/model.js';

const valid = () => ({ operator: true, checkedAt: 10000, now: 10001, snapshot: { mqttConnected: true, heartbeatFresh: true, dispatchReady: true }, session: { state: 'MAPPING', job_status: 'RUNNING', potentially_open: true }, detail: { job: { status: 'RUNNING', selectedJobStepId: 'step' }, steps: [{ jobStepId: 'step', status: 'RUNNING', stepTypeSnapshot: 'WAIT', resolvedInputsJson: { event_type: 'MAPPING_SAVE_REQUESTED' } }] } });
test('controls require permission, fresh Pi state and the exact mapping WAIT step', () => {
  assert.equal(movementBlock(valid()), '');
  for (const change of [{ operator: false }, { checkedAt: 0 }, { now: 13000 }, { saving: true }, { snapshot: { dispatchReady: false } }, { session: { state: 'MAPPING', job_status: 'RUNNING', potentially_open: false } }, { detail: { job: { status: 'RECOVERY_REQUIRED' } } }, { detail: { ...valid().detail, steps: [] } }]) assert.ok(movementBlock({ ...valid(), ...change }));
  assert.equal(isOperator({ mode: 'demo', account: { role: 'ADMIN' }, tokens: { accessToken: 'test' } }), false);
});
test('only published schema 3 workflows of the requested type are offered', () => {
  const w = { workflowId: 'w', schemaVersion: 3, status: 'PUBLISHED', acceptsNewJobs: true, definitionHash: 'hash', serviceType: 'SPEECH' };
  const d = { workflow: w, steps: [{ enabled: true, stepTypeCode: 'INTERACT', paramsJson: { action: 'SPEAK' } }] };
  assert.equal(eligibleWorkflows([d], 'SPEECH').length, 1);
  for (const change of [{ schemaVersion: 2 }, { status: 'DRAFT' }, { acceptsNewJobs: false }, { definitionHash: null }, { serviceType: 'MAPPING' }]) assert.equal(eligibleWorkflows([{ ...d, workflow: { ...w, ...change } }], 'SPEECH').length, 0);
  assert.equal(eligibleWorkflows([{ ...d, steps: [{ enabled: true, stepTypeCode: 'MOVE' }] }], 'SPEECH').length, 0);
});
test('map handoff only uses a successful commit from a successful job', () => {
  const detail = { job: { status: 'RUNNING' }, steps: [{ status: 'SUCCEEDED', resolvedInputsJson: { service_key: 'COMMIT_MAP_ARTIFACT' }, resultJson: { data: { map_id: 'server-map' } } }] };
  assert.equal(committedMapId(detail), ''); detail.job.status = 'SUCCEEDED'; assert.equal(committedMapId(detail), 'server-map');
});
test('a late movement response cannot restart renewal after stop', async () => {
  let resolveMove; const calls = [];
  const jog = new MappingJog({ allowed: () => '', send: (x, z) => { calls.push([x, z]); return x ? new Promise(resolve => { resolveMove = resolve; }) : Promise.resolve({ commandId: 'stop' }); } });
  jog.start(.05, 0, 4); await jog.stop(); resolveMove({ commandId: 'late' });
  await new Promise(r => setTimeout(r, 380));
  assert.deepEqual(calls, [[.05, 0], [0, 0]]); assert.equal(jog.active, false);
});
test('pulses respect pacing, expire, and stop on a lost readiness guard', async () => {
  let reason = ''; const calls = [];
  const jog = new MappingJog({ allowed: () => reason, send: async (x, z) => { calls.push({ x, z, time: Date.now() }); return { commandId: String(calls.length) }; } });
  jog.start(.08, 0, 4);
  await new Promise(r => setTimeout(r, 380)); reason = 'offline';
  await new Promise(r => setTimeout(r, 330));
  assert.ok(calls[1].time - calls[0].time >= 280); assert.equal(calls.at(-1).x, 0); assert.equal(jog.active, false);
});
test('negative Pi acknowledgement stops movement and never retries', async () => {
  const calls = [];
  const jog = new MappingJog({ allowed: () => '', send: async (x, z) => { calls.push([x, z]); return { commandId: 'move' }; } });
  jog.start(.05, 0, 4); await Promise.resolve(); jog.acknowledge({ commandId: 'move', status: 'NO_PI_ACK' });
  await new Promise(r => setTimeout(r, 350)); assert.deepEqual(calls, [[.05, 0], [0, 0]]);
});
test('time limit automatically stops; failed pulse does not renew', async () => {
  const calls = [];
  const jog = new MappingJog({ allowed: () => '', send: async (x, z) => { calls.push([x, z]); return { commandId: 'test' }; } });
  jog.start(.05, 0, .4); await new Promise(r => setTimeout(r, 520));
  assert.equal(jog.active, false); assert.deepEqual(calls.at(-1), [0, 0]);
  const failed = [];
  const other = new MappingJog({ allowed: () => '', send: async (x, z) => { failed.push([x, z]); if (x) throw Error('Network failure'); return {}; } });
  other.start(.05, 0, 4); await new Promise(r => setTimeout(r, 350));
  assert.deepEqual(failed, [[.05, 0], [0, 0]]);
});
