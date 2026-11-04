import { deliveryDocument } from './fixtures/workflow-delivery-design.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { newDocument, addStep, connect, validateDocument, toPayload, authorizationFromStep, effectiveParams, suggestedCondition } from '../src/features/workflows/designer/designerModel.js';
import { stepCatalog, fieldsForStep, interactionPresets, variableValueError } from '../src/features/workflows/designer/stepCatalog.js';
import { outputsForStep, lookupOutput } from '../src/features/workflows/designer/stepOutputs.js';
import { referenceOptions } from '../src/features/workflows/designer/referenceOptions.js';
import { stepContractIssues } from '../src/features/workflows/designer/stepContractChecks.js';

test('all 11 input catalogs cover the business field names accepted by the BE', () => {
  const expected = {
    MOVE: ['map_id', 'endpoint_id', 'mode', 'max_speed_mps'], AUTHENTICATE: ['purpose', 'method', 'service_request_id'], CONTROL_HARDWARE: ['compartment_id', 'action', 'service_request_id', 'authorization'], HANDLE_PAYLOAD: ['action', 'service_request_id', 'compartment_id', 'items'], CHECK_CONDITION: ['expression'], SET_CONTEXT: ['operations'],
    INTERACT: ['prompt_key', 'action', 'data', 'actor', 'required_role', 'compartment_id', 'patient_reference', 'endpoint_id', 'question', 'items', 'message', 'incident_id', 'detection_event_id'],
    DATA_SERVICE: ['service_key', 'operation', 'question', 'language_code', 'map_id', 'endpoint_id', 'endpoint_group_id', 'targets', 'index', 'detection_event_id', 'mapping_session_id', 'artifact_id', 'floor_id', 'map_name'],
    EXECUTE_SENSING: ['sensing_type', 'zone_id', 'window_sec', 'action', 'mapping_session_id', 'artifact_id', 'preview_rate_hz'], WAIT: ['wait_type', 'duration_sec', 'event_type', 'correlation_key', 'incident_id'],
    NOTIFY: ['notification_type', 'severity', 'data', 'require_ack', 'ack_policy', 'recipients', 'message', 'incident_id', 'metrics', 'robot_id', 'charge_request_id', 'staff_event', 'health', 'recovery_request_id', 'endpoint_id', 'detection_event_id', 'zone_id', 'map_id'],
  };
  assert.equal(Object.keys(stepCatalog).length, 11);
  for (const [type, keys] of Object.entries(expected)) assert.deepEqual(stepCatalog[type].fields.map(f => f.key).sort(), keys.sort(), type);
});
test('a complete delivery graph binds actual auth/payload/door/lock outputs without fictitious input confirmations', () => {
  const { doc, stages } = deliveryDocument();
  assert.deepEqual(validateDocument(doc), []);
  assert.equal(doc.nodes.filter(n => n.data.kind === 'step').length, 22);
  assert.equal(doc.variables.filter(v => v.key === 'service_request_id').length, 1);
  assert.equal(doc.variables.filter(v => v.key === 'items').length, 1);
  assert.ok(!doc.variables.some(v => v.key === 'confirmed'));
  for (const [stage, ids] of Object.entries(stages)) {
    for (const [checkIndex, sourceIndex, field] of [[2, 1, 'verified'], [5, 4, 'confirmed'], [7, 6, 'closed'], [10, 9, 'locked']]) assert.equal(doc.nodes.find(n => n.id === ids[checkIndex]).data.params.expression.path, `/outputs/${ids[sourceIndex]}/${field}`);
    const auth = effectiveParams(doc.nodes.find(n => n.id === ids[3])).authorization;
    assert.equal(auth.purpose, 'DELIVERY_' + stage);
    assert.equal(auth.verification_id.$ref, `/outputs/${ids[1]}/verification_id`);
  }
  const payload = toPayload(doc);
  assert.equal(payload.graph.steps.length, 22);
  assert.ok(payload.graph.transitions.some(t => t.terminalStatus === 'RECOVERY_REQUIRED'));
});
test('output menus contain completed result fields for each action, with no fake /value on payload', () => {
  const { doc, stages } = deliveryDocument();
  const ids = stages.SENDER;
  const options = referenceOptions(doc, ids[5]);
  const payload = options.outputs.find(n => n.id === ids[4]);
  assert.ok(payload.fields.some(f => f.path === 'confirmed' && f.kind === 'boolean'));
  assert.ok(!payload.fields.some(f => f.path === 'value'));
  assert.ok(options.outputs.some(n => n.stepType === 'AUTHENTICATE' && n.fields.some(f => f.path === 'verified')));
  assert.ok(!options.outputs.some(n => stages.RECEIVER.includes(n.id)));
  const own = referenceOptions(doc, ids[5], true).outputs.find(n => n.id === ids[5]);
  assert.deepEqual(own.fields.map(f => f.path), ['value']);
});
test('unknown output leafs and cross-stage authorization cannot silently pass validation', () => {
  const { doc, stages } = deliveryDocument();
  const check = doc.nodes.find(n => n.id === stages.SENDER[5]); check.data.params.expression.path = `/outputs/${stages.SENDER[4]}/value`;
  assert.ok(validateDocument(doc).some(e => e.message.includes('không có trường output value')));
  check.data.params.expression.path = `/outputs/${stages.SENDER[4]}/confirmed`;
  const unlock = doc.nodes.find(n => n.id === stages.SENDER[3]); unlock.data.params.authorization.purpose = 'DELIVERY_RECEIVER';
  assert.ok(validateDocument(doc).some(e => e.message.includes('đúng mục đích')));
  assert.throws(() => authorizationFromStep(doc, stages.SENDER[3], stages.RECEIVER[1]), /mọi đường chạy/);
});
test('edge conditions use the correct source result and never assume every step has /value', () => {
  const { doc, stages } = deliveryDocument();
  for (const [index, field] of [[1, 'verified'], [4, 'confirmed'], [6, 'closed'], [9, 'locked']]) assert.equal(suggestedCondition(doc, stages.SENDER[index], true).path, `/outputs/${stages.SENDER[index]}/${field}`);
  assert.ok(!suggestedCondition(doc, stages.SENDER[4], false).path.startsWith(`/outputs/${stages.SENDER[4]}/`));
});
test('service-specific required fields, fixed authorization purpose and interaction metadata are visible', () => {
  const fieldNames = (type, params) => fieldsForStep({ stepType: type, params, mapping: {} });
  assert.equal(fieldNames('AUTHENTICATE', {}).find(f => f.key === 'purpose').fixed, true);
  assert.equal(fieldNames('DATA_SERVICE', { service_key: 'RESOLVE_TARGETS' }).find(f => f.key === 'endpoint_group_id').required, true);
  assert.equal(fieldNames('DATA_SERVICE', { service_key: 'SELECT_TARGET' }).find(f => f.key === 'targets').required, true);
  assert.deepEqual(fieldNames('DATA_SERVICE', { service_key: 'COMMIT_MAP_ARTIFACT' }).map(f => f.key).sort(), ['service_key', 'mapping_session_id', 'artifact_id', 'floor_id', 'map_name'].sort());
  assert.ok(fieldNames('INTERACT', { action: 'CONFIRM' }).some(f => f.key === 'actor'));
  assert.ok(!fieldNames('INTERACT', { action: 'SPEAK' }).some(f => f.key === 'actor'));
  assert.ok(!fieldNames('WAIT', { wait_type: 'DURATION' }).some(f => f.key === 'event_type'));
});
test('nested speech, item and context errors are caught before the backend save', () => {
  const data = (stepType, params) => ({ stepType, params, mapping: {}, timeoutSec: 60, maxAttempts: 1 });
  assert.ok(stepContractIssues(data('INTERACT', { action: 'SPEAK', prompt_key: 'CUSTOM', data: { text: '', volume: 101 } })).some(e => e.includes('Nội dung nói')));
  assert.ok(stepContractIssues(data('HANDLE_PAYLOAD', { items: [] })).some(e => e.includes('ít nhất một')));
  assert.ok(stepContractIssues(data('HANDLE_PAYLOAD', { items: [{ item_code: 'A', quantity: 1 }, { item_code: 'A', quantity: .5 }] })).some(e => e.includes('trùng mã')));
  assert.ok(stepContractIssues(data('SET_CONTEXT', { operations: [{ path: '/inputs/id', operation: 'SET', value: 1 }] })).some(e => e.includes('/vars/')));
  assert.ok(stepContractIssues(data('SET_CONTEXT', { operations: [{ path: '/vars/mapping_session_id', value: 'x' }] })).some(e => e.includes('BE cấp')));
  assert.ok(stepContractIssues(data('NOTIFY', { recipients: ['UNKNOWN_ROLE'] })).some(e => e.includes('UUID')));
});
test('items input preview enforces its nonempty item schema', () => {
  const { doc } = deliveryDocument(), v = doc.variables.find(v => v.key === 'items');
  assert.match(variableValueError([], v), /Cần/);
  assert.ok(variableValueError([{ item_code: 'A', quantity: 0 }], v));
  assert.equal(variableValueError([{ item_code: 'A', quantity: 1 }], v), '');
});
test('context variables and DATA_SERVICE outputs have actionable paths and types', () => {
  let d = addStep(newDocument(), 'SET_CONTEXT', { x: 300, y: 0 }); const setter = d.nodes.at(-1).id;
  d.nodes.at(-1).data.params.operations = [{ path: '/vars/counter', operation: 'SET', value: 0 }];
  d = addStep(d, 'WAIT', { x: 600, y: 0 }); const wait = d.nodes.at(-1).id;
  d = connect(d, { source: 'start', target: setter, sourceHandle: 'SUCCESS' }); d = connect(d, { source: setter, target: wait, sourceHandle: 'SUCCESS' }); d = connect(d, { source: wait, target: 'end', sourceHandle: 'SUCCESS' });
  assert.ok(referenceOptions(d, wait).context.some(v => v.key === 'counter' && v.kind === 'number'));
  assert.ok(outputsForStep({ stepType: 'DATA_SERVICE', params: { service_key: 'SELECT_TARGET' } }).some(f => f.path === 'data/has_target'));
  assert.equal(lookupOutput({ stepType: 'HANDLE_PAYLOAD' }, 'value'), null);
});
test('a context key assigned on both branches remains selectable even though neither setter dominates', () => {
  let d = addStep(newDocument(), 'CHECK_CONDITION', { x: 200, y: 0 }); const check = d.nodes.at(-1).id;
  d.variables.push({ key: 'confirmed', label: 'Điều kiện', kind: 'boolean', required: true }); d.nodes.at(-1).data.params.expression.path = '/inputs/confirmed';
  const setters = [];
  for (let i = 0; i < 2; i++) { d = addStep(d, 'SET_CONTEXT', { x: 400, y: i * 200 }); setters.push(d.nodes.at(-1).id); d.nodes.at(-1).data.params.operations = [{ path: '/vars/delay', operation: 'SET', value: i + 1 }]; }
  d = addStep(d, 'WAIT', { x: 600, y: 0 }); const wait = d.nodes.at(-1).id;
  d.nodes.at(-1).data.mapping.duration_sec = { $ref: '/vars/delay' };
  d = connect(d, { source: 'start', target: check, sourceHandle: 'SUCCESS' });
  d = connect(d, { source: check, target: setters[0], sourceHandle: 'true' }); d = connect(d, { source: check, target: setters[1], sourceHandle: 'false' });
  for (const id of setters) d = connect(d, { source: id, target: wait, sourceHandle: 'SUCCESS' });
  d = connect(d, { source: wait, target: 'end', sourceHandle: 'SUCCESS' });
  assert.deepEqual(validateDocument(d), []);
  assert.ok(referenceOptions(d, wait).context.some(v => v.key === 'delay' && v.kind === 'number'));
  assert.ok(!referenceOptions(d, wait).outputs.some(v => setters.includes(v.id)));
});
test('INCREMENT needs prior numeric initialization and wrong output types are rejected', () => {
  let d = addStep(newDocument(), 'SET_CONTEXT', { x: 200, y: 0 }); const increment = d.nodes.at(-1).id;
  d.nodes.at(-1).data.params.operations = [{ path: '/vars/count', operation: 'INCREMENT', value: 1 }];
  d = connect(d, { source: 'start', target: increment, sourceHandle: 'SUCCESS' }); d = connect(d, { source: increment, target: 'end', sourceHandle: 'SUCCESS' });
  assert.ok(validateDocument(d).some(e => e.message.includes('khởi tạo')));
  const { doc, stages } = deliveryDocument();
  doc.nodes.find(n => n.id === stages.SENDER[4]).data.mapping.items = { $ref: `/outputs/${stages.SENDER[1]}/verified` };
  assert.ok(validateDocument(doc).some(e => e.message.includes('kiểu output boolean')));
});
test('the editor reports existing BE/Pi sensing incompatibilities instead of promising unsupported publication', () => {
  const issues = stepContractIssues({ stepType: 'EXECUTE_SENSING', params: { sensing_type: 'MAPPING', action: 'START', mapping_session_id: 'x' }, mapping: {}, timeoutSec: 10, maxAttempts: 2 });
  assert.ok(issues.some(e => e.includes('BE hiện chưa chấp nhận')));
  assert.ok(issues.some(e => e.includes('55')));
});
test('output catalog covers required schema-3 result properties in the companion BE', t => {
  const root = new URL('../../BE_MAR/src/main/resources/contracts/mar-step-2/', import.meta.url);
  if (!existsSync(new URL('be-step-contracts.json', root))) { t.skip('Companion BE not available'); return; }
  const be = JSON.parse(readFileSync(new URL('be-step-contracts.json', root))), pi = JSON.parse(readFileSync(new URL('pi-step-outputs.schema.json', root)));
  const variants = [
    ['MOVE', {}], ['CONTROL_HARDWARE', { action: 'LOCK_COMPARTMENT' }], ['AUTHENTICATE', {}], ['HANDLE_PAYLOAD', { action: 'LOAD' }], ['NOTIFY', {}], ['WAIT', { wait_type: 'DURATION' }], ['WAIT', { wait_type: 'EVENT' }], ['CHECK_CONDITION', {}], ['SET_CONTEXT', { operations: [] }], ['DATA_SERVICE', { service_key: 'SELECT_TARGET' }], ['INTERACT', { action: 'CONFIRM', prompt_key: 'CLOSE_SENDER' }], ['INTERACT', { action: 'SPEAK' }],
  ];
  for (const [type, params] of variants) {
    const isPi = ['MOVE', 'CONTROL_HARDWARE'].includes(type) || type === 'WAIT' && params.wait_type === 'DURATION';
    const schema = (isPi ? pi : be).$defs[type + (isPi ? '' : 'Output')];
    const fields = outputsForStep({ stepType: type, params });
    for (const required of schema.required ?? []) assert.ok(fields.some(f => f.path === required), type + '.' + required);
    for (const field of fields) assert.ok(Object.hasOwn(schema.properties ?? {}, field.path.split('/')[0]), type + '.' + field.path);
  }
});
