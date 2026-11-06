import test from 'node:test';
import assert from 'node:assert/strict';
import { newDocument, appendStep, quickAppendSource, connect, copy, toPayload, fromDetail, validateDocument, inputRef } from '../src/features/workflows/designer/designerModel.js';
import { stepCatalog, variableFitsField } from '../src/features/workflows/designer/stepCatalog.js';

const field = (type, key) => stepCatalog[type].fields.find(f => f.key === key);
const at = x => ({ x, y: 170 });

test('palette builds a main path with one click per step and shares only the map', () => {
  const original = newDocument(), before = copy(original);
  let doc = appendStep(original, 'MOVE', null, at(380));
  const first = doc.nodes.at(-1).id;
  doc = appendStep(doc, 'MOVE', first, at(680));
  const second = doc.nodes.at(-1).id;
  assert.deepEqual(original, before);
  assert.deepEqual(doc.edges.map(e => [e.source, e.target]), [['start', first], [first, second], [second, 'end']]);
  assert.deepEqual(validateDocument(doc), []);
  assert.equal(doc.variables.filter(v => v.kind === 'map').length, 1);
  assert.equal(doc.variables.filter(v => v.kind === 'endpoint').length, 2);
  const body = toPayload(doc);
  assert.equal(body.graph.transitions.filter(t => t.terminalStatus === 'RECOVERY_REQUIRED').length, 4);
});

test('quick append keeps custom error and timeout branches intact', () => {
  let doc = appendStep(newDocument(), 'WAIT', null, at(380));
  const source = doc.nodes.at(-1).id;
  doc.nodes.push({ id: 'recovery', data: { kind: 'terminal', terminalStatus: 'RECOVERY_REQUIRED' }, position: at(1000) });
  doc = connect(doc, { source, target: 'recovery', sourceHandle: 'FAILURE' });
  doc = connect(doc, { source, target: 'recovery', sourceHandle: 'TIMEOUT' });
  const branches = copy(doc.edges.filter(e => e.data.outcome !== 'SUCCESS'));
  const next = appendStep(doc, 'WAIT', source, at(680));
  assert.deepEqual(next.edges.filter(e => e.data.outcome !== 'SUCCESS'), branches);
});

test('existing step paths, conditional routes and failure terminals require explicit wiring', () => {
  let doc = appendStep(newDocument(), 'WAIT', null, at(380));
  const first = doc.nodes.at(-1).id;
  doc = appendStep(doc, 'WAIT', first, at(680));
  assert.equal(quickAppendSource(doc, first), null);
  assert.deepEqual(appendStep(doc, 'WAIT', first, at(900)).edges, doc.edges);
  const last = doc.nodes.at(-1).id;
  doc.edges.find(e => e.source === last).data.defaultTransition = false;
  assert.equal(quickAppendSource(doc, last), null);
  doc.edges.find(e => e.source === last).data.defaultTransition = true;
  doc.nodes.find(n => n.id === 'end').data.terminalStatus = 'FAILED';
  assert.equal(quickAppendSource(doc, last), null);
});

test('condition steps receive a real output expression but require explicit branch choices', () => {
  let doc = appendStep(newDocument(), 'MOVE', null, at(380));
  const move = doc.nodes.at(-1).id;
  doc = appendStep(doc, 'CHECK_CONDITION', move, at(680));
  const check = doc.nodes.at(-1);
  assert.equal(check.data.params.expression.path, `/outputs/${move}/reached`);
  assert.ok(!doc.edges.some(e => e.source === check.id));
  assert.equal(quickAppendSource(doc, check.id), null);
  const next = appendStep(doc, 'WAIT', check.id, at(980));
  assert.deepEqual(next.edges, doc.edges);
});

test('endpoint dropdown excludes service requests and other identities, including plain string UUIDs', () => {
  const endpoint = field('MOVE', 'endpoint_id');
  for (const key of ['service_request_id', 'map_id', 'zone_id', 'floor_id', 'verification_id', 'endpoint_group_id', 'delivery_group_endpoint_group_id']) {
    assert.equal(variableFitsField({ key, kind: 'string', schema: { format: 'uuid' } }, endpoint), false, key);
  }
  for (const key of ['pickup_endpoint_id', 'delivery_endpoint_id', 'destination_1_endpoint_id']) {
    assert.equal(variableFitsField({ key, kind: 'endpoint' }, endpoint), true, key);
    assert.equal(variableFitsField({ key, kind: 'string' }, endpoint), true, key);
    assert.equal(variableFitsField({ key, kind: 'string' }, field('AUTHENTICATE', 'service_request_id')), false, key);
  }
  assert.equal(variableFitsField({ path: 'data/endpoint_id', kind: 'string' }, endpoint), true);
  assert.equal(variableFitsField({ path: 'service_request_id', kind: 'string' }, endpoint), false);
  assert.equal(variableFitsField({ key: 'custom_id', kind: 'string' }, endpoint), true);
});

test('incorrect identity is blocked before saving an existing workflow', () => {
  let doc = appendStep(newDocument(), 'MOVE', null, at(380));
  doc.variables.push({ key: 'service_request_id', kind: 'string', required: true, schema: { type: 'string', format: 'uuid' } });
  doc.nodes.at(-1).data.mapping.endpoint_id = inputRef('service_request_id');
  assert.ok(validateDocument(doc).some(e => e.message.includes('kiểu biến không tương thích')));
});

test('quick-built graph and its runtime fallback transitions survive a server round trip', () => {
  let doc = appendStep(newDocument(), 'MOVE', null, at(380));
  doc = appendStep(doc, 'AUTHENTICATE', doc.nodes.at(-1).id, at(680));
  const payload = toPayload(doc);
  const detail = {
    workflow: { ...payload.workflow, workflowId: 'quick', startStepId: payload.graph.startStepCode },
    tasks: payload.graph.tasks.map(t => ({ ...t, taskId: t.taskCode })),
    steps: payload.graph.steps.map(s => ({ ...s, stepId: s.stepCode, stepTypeCode: s.stepType, taskId: s.taskCode, enabled: true })),
    transitions: payload.graph.transitions.map(t => ({ ...t, fromStepId: t.fromStepCode, toStepId: t.toStepCode })),
  };
  assert.deepEqual(toPayload(fromDetail(detail)).graph, payload.graph);
});
