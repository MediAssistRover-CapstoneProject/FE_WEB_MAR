import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchInputErrors, dispatchVariables, newDispatch, resumeDispatch, updateDispatchValue } from '../src/features/workflows/dispatchModel.js';
import { pathForScreen, screenForSlug } from '../src/features/admin/screenRoutes.js';

const mapId = '11111111-1111-4111-8111-111111111111', endpointId = '22222222-2222-4222-8222-222222222222';
const workflow = { workflowId: 'wf', workflowName: 'Giao hàng', inputSchemaJson: { properties: { map_id: { type: 'string' }, destination: { type: 'string' }, enabled: { type: 'boolean' }, count: { type: 'integer', minimum: 1 }, items: { type: 'array' } }, required: ['destination', 'enabled', 'count'] }, inputUiJson: { fields: { map_id: { kind: 'map', label: 'Bản đồ' }, destination: { kind: 'endpoint', mapVariable: 'map_id' } } } };
const catalog = { maps: [{ mapId, status: 'ACTIVE' }], endpoints: [{ endpointId, mapId, active: true, accessible: true }] };

test('dispatch validates real schema values, active maps and map-scoped endpoints', () => {
  const values = { map_id: mapId, destination: endpointId, enabled: false, count: 1 };
  assert.deepEqual(dispatchInputErrors(workflow, values, catalog), {});
  assert.ok(dispatchInputErrors(workflow, { ...values, map_id: 'missing' }, catalog).destination);
  assert.ok(dispatchInputErrors(workflow, { ...values, count: 0 }, catalog).count);
  assert.ok(dispatchInputErrors(workflow, { ...values, items: [{ nested: { $ref: '/vars/secret' } }] }, catalog).items);
  assert.equal(dispatchVariables(workflow)[0].label, 'Bản đồ');
  assert.deepEqual(updateDispatchValue(workflow, values, dispatchVariables(workflow)[0], 'other'), { map_id: 'other', enabled: false, count: 1 });
});

test('dispatch freezes one-time input snapshot and uses FIRE_ONCE for immediate execution', () => {
  const inputs = { enabled: false, items: [{ quantity: 2 }] };
  const attempt = newDispatch(workflow, 'robot', inputs, 50, 'stable-id', new Date('2026-11-06T01:00:00Z'));
  inputs.items[0].quantity = 99;
  assert.equal(attempt.body.inputTemplateJson.items[0].quantity, 2);
  assert.equal(attempt.body.scheduleType, 'ONCE');
  assert.equal(attempt.body.misfirePolicy, 'FIRE_ONCE');
  assert.equal(attempt.body.robotId, 'robot');
  assert.equal(pathForScreen('Workflow Dispatch'), '/admin/workflow-dispatch');
  assert.equal(screenForSlug('workflow-dispatch'), 'Workflow Dispatch');
});

test('lost create response is recovered by unique schedule code without creating twice', async () => {
  let schedule, creates = 0, activates = 0, saved;
  const attempt = newDispatch(workflow, '', {}, 50, 'stable');
  const api = {
    find: async code => schedule?.scheduleCode === code ? schedule : undefined,
    create: async body => { creates++; schedule = { scheduleId: 's1', scheduleCode: body.scheduleCode, status: 'PAUSED' }; throw Error('response lost'); },
    activate: async () => { activates++; return { ...schedule, status: 'ACTIVE' }; },
  };
  await assert.rejects(resumeDispatch(attempt, api, value => { saved = value; }), /response lost/);
  const result = await resumeDispatch(attempt, api, value => { saved = value; });
  assert.equal(creates, 1); assert.equal(activates, 1); assert.equal(result.status, 'ACTIVE'); assert.equal(saved.scheduleId, 's1');
});

test('lost activation response is checked with GET and never reactivates an already active run', async () => {
  let status = 'PAUSED', saved, activates = 0;
  const attempt = { ...newDispatch(workflow, '', {}, 50, 'stable'), scheduleId: 's1' };
  const api = {
    get: async () => ({ scheduleId: 's1', status }),
    activate: async () => { activates++; status = 'ACTIVE'; throw Error('response lost'); },
  };
  await assert.rejects(resumeDispatch(attempt, api, value => { saved = value; }), /response lost/);
  const result = await resumeDispatch(saved, api, value => { saved = value; });
  assert.equal(activates, 1); assert.equal(result.status, 'ACTIVE');
});

test('failure to reconcile an interrupted request never starts another run', async () => {
  let creates = 0;
  const api = { find: async () => { throw Error('unavailable'); }, create: async () => { creates++; } };
  await assert.rejects(resumeDispatch(newDispatch(workflow, '', {}, 50, 'stable'), api, () => {}), /unavailable/);
  assert.equal(creates, 0);
});

test('retired one-time run remains complete when recovered', async () => {
  const attempt = { ...newDispatch(workflow, '', {}, 50, 'stable'), scheduleId: 's1' };
  const result = await resumeDispatch(attempt, { get: async () => ({ scheduleId: 's1', status: 'RETIRED' }) }, () => {});
  assert.equal(result.status, 'RETIRED');
});
