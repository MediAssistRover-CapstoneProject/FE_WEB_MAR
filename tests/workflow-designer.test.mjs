import test from 'node:test';
import assert from 'node:assert/strict';
import { newDocument, addStep, connect, canConnect, validateDocument, toPayload, fromDetail, inputRef, renameVariable, inputUsages, fingerprint, convertLocal, availableDestinations, copy } from '../src/features/workflows/designer/designerModel.js';
import { readDrafts, writeDraft, deleteDraft, designerStorageKey } from '../src/features/workflows/designer/designerStorage.js';
import { saveDesign, publishDesign } from '../src/features/workflows/designer/designerService.js';
import { valueError, stepCatalog, variableFitsField } from '../src/features/workflows/designer/stepCatalog.js';

const mapId = '11111111-1111-4111-8111-111111111111', endpointId = '22222222-2222-4222-8222-222222222222';
export function simple(type = 'MOVE') {
  let d = addStep(newDocument(), type, { x: 300, y: 150 });
  const step = d.nodes.find(n => n.data.kind === 'step');
  d = connect(d, { source: 'start', target: step.id, sourceHandle: 'SUCCESS' });
  d = connect(d, { source: step.id, target: 'end', sourceHandle: 'SUCCESS' });
  return d;
}
export function detailFor(payload, status = 'DRAFT') {
  return { workflow: { ...payload.workflow, workflowId: 'wf-1', startStepId: 'id-' + payload.graph.startStepCode, status, acceptsNewJobs: status === 'PUBLISHED' }, tasks: payload.graph.tasks.map(t => ({ ...t, taskId: 'task-' + t.taskCode })), steps: payload.graph.steps.map(s => ({ ...s, stepTypeCode: s.stepType, stepId: 'id-' + s.stepCode, taskId: 'task-' + s.taskCode, enabled: true })), transitions: payload.graph.transitions.map((e, i) => ({ ...e, transitionId: 'edge-' + i, fromStepId: 'id-' + e.fromStepCode, toStepId: e.toStepCode ? 'id-' + e.toStepCode : null })) };
}

test('MOVE creates reusable map/endpoint inputs with typed $ref and explicit runtime fallback transitions', () => {
  const d = simple(), payload = toPayload(d);
  assert.deepEqual(validateDocument(d), []);
  assert.equal(payload.workflow.schemaVersion, 3);
  assert.equal(payload.graph.steps[0].inputMappingJson.map_id.$ref, '/inputs/map_id');
  assert.equal(payload.graph.steps[0].paramsJson.max_speed_mps, 0.08);
  assert.equal(payload.graph.transitions.length, 3);
  assert.equal(payload.graph.transitions.find(t => t.outcome === 'FAILURE').terminalStatus, 'RECOVERY_REQUIRED');
  assert.equal(payload.workflow.inputUiJson.fields.destination_1_endpoint_id.mapVariable, 'map_id');
  assert.ok(payload.workflow.inputSchemaJson.required.includes('map_id'));
});
test('second MOVE gets its own destination but shares the map variable', () => {
  const d = addStep(simple(), 'MOVE', { x: 500, y: 0 });
  assert.equal(d.variables.filter(v => v.kind === 'map').length, 1);
  assert.equal(d.variables.filter(v => v.kind === 'endpoint').length, 2);
  assert.notEqual(d.nodes.filter(n => n.data.stepType === 'MOVE')[0].data.mapping.endpoint_id.$ref, d.nodes.filter(n => n.data.stepType === 'MOVE')[1].data.mapping.endpoint_id.$ref);
});
test('authentication and payload steps create and share one required service request UUID input', () => {
  let d = simple('AUTHENTICATE');
  assert.deepEqual(validateDocument(d), []);
  const request = d.variables.find(v => v.key === 'service_request_id');
  assert.equal(request.kind, 'string');
  assert.equal(request.required, true);
  assert.equal(request.schema.format, 'uuid');
  d = addStep(d, 'AUTHENTICATE', { x: 500, y: 0 });
  d = addStep(d, 'HANDLE_PAYLOAD', { x: 800, y: 0 });
  assert.equal(d.variables.filter(v => v.key === 'service_request_id').length, 1);
  assert.ok(d.nodes.filter(n => ['AUTHENTICATE', 'HANDLE_PAYLOAD'].includes(n.data.stepType)).every(n => n.data.mapping.service_request_id.$ref === '/inputs/service_request_id'));
  assert.equal(toPayload(d).workflow.inputSchemaJson.properties.service_request_id.format, 'uuid');
});
test('request input auto-binding preserves existing configuration and does not overwrite incompatible variables', () => {
  const original = newDocument();
  original.variables.push({ key: 'service_request_id', label: 'Mã yêu cầu hiện có', kind: 'string', required: true, description: 'Giữ cấu hình', schema: { type: 'string', format: 'uuid' } });
  assert.deepEqual(addStep(original, 'AUTHENTICATE', { x: 0, y: 0 }).variables[0], original.variables[0]);
  original.variables[0].kind = 'number';
  const invalid = addStep(original, 'AUTHENTICATE', { x: 0, y: 0 });
  assert.equal(invalid.variables[0].kind, 'number');
  assert.equal(invalid.nodes.find(n => n.data.stepType === 'AUTHENTICATE').data.mapping.service_request_id, undefined);
  assert.ok(validateDocument(invalid).some(e => e.message.includes('Yêu cầu dịch vụ')));
});
test('map and endpoint UUIDs are not valid service request variable suggestions or bindings', () => {
  const field = stepCatalog.AUTHENTICATE.fields.find(f => f.key === 'service_request_id');
  assert.equal(variableFitsField({ kind: 'map' }, field), false);
  assert.equal(variableFitsField({ kind: 'endpoint' }, field), false);
  assert.equal(variableFitsField({ kind: 'string' }, field), true);
  const d = simple('AUTHENTICATE');
  d.variables.push({ key: 'map_id', kind: 'map', required: true });
  d.nodes.find(n => n.data.stepType === 'AUTHENTICATE').data.mapping.service_request_id = inputRef('map_id');
  assert.ok(validateDocument(d).some(e => e.message.includes('kiểu biến không tương thích')));
});
test('graph round-trip preserves tasks, real transitions, typed params, inputs, output mapping and canvas positions', () => {
  const d = simple();
  d.variables[1].selection = 'room-endpoint'; d.workflow.outputMappingJson = { reached: { $ref: `/outputs/${d.nodes[2].id}/reached` } };
  d.tasks[0].configJson = { legacy: true }; d.workflow.inputUiJson.extra = { preserved: 1 };
  const payload = toPayload(d), restored = fromDetail(detailFor(payload));
  const again = toPayload(restored);
  assert.deepEqual(again.graph, payload.graph);
  assert.deepEqual(again.workflow.inputSchemaJson, payload.workflow.inputSchemaJson);
  assert.deepEqual(again.workflow.inputUiJson.extra, { preserved: 1 });
  assert.equal(restored.nodes.find(n => n.id === payload.graph.steps[0].stepCode).position.x, 300);
  assert.deepEqual(restored.nodes.find(n => n.id === 'end').position, d.nodes.find(n => n.id === 'end').position);
  assert.equal(restored.variables[1].selection, 'room-endpoint');
});
test('conditional routes use SUCCESS true/false data, preserve fallback priority even when added first', () => {
  let d = addStep(newDocument(), 'CHECK_CONDITION', { x: 300, y: 0 });
  const id = d.nodes.find(n => n.data.kind === 'step').id;
  d.variables.push({ key: 'confirmed', label: 'Xác nhận', kind: 'boolean', required: true });
  d.nodes.find(n => n.id === id).data.params.expression.path = '/inputs/confirmed';
  d = connect(d, { source: 'start', target: id, sourceHandle: 'SUCCESS' });
  d = connect(d, { source: id, target: 'end', sourceHandle: 'false' });
  d = connect(d, { source: id, target: 'end', sourceHandle: 'true' });
  assert.deepEqual(validateDocument(d), []);
  const routes = toPayload(d).graph.transitions.filter(e => e.outcome === 'SUCCESS');
  assert.equal(routes.find(e => e.defaultTransition).priority, 2);
  assert.equal(routes.find(e => !e.defaultTransition).conditionJson.path, '/result/value');
  assert.ok(routes.every(e => e.outcome === 'SUCCESS'));
});
test('connections cannot create cycles, self loops, multiple starts or start-to-terminal', () => {
  const d = simple(), id = d.nodes.find(n => n.data.kind === 'step').id;
  assert.equal(canConnect(d, { source: id, target: id }), false);
  assert.equal(canConnect(d, { source: id, target: 'start' }), false);
  assert.equal(canConnect(d, { source: 'start', target: id }), false);
  assert.equal(canConnect(newDocument(), { source: 'start', target: 'end' }), false);
});
test('missing connections, unreachable steps and JSON drafts are actionable validation errors', () => {
  const d = addStep(newDocument(), 'WAIT', { x: 0, y: 0 }); d.invalidJson = { tasks: '[' };
  const errors = validateDocument(d);
  assert.ok(errors.some(e => e.message.includes('JSON')));
  assert.ok(errors.some(e => e.nodeId === 'start'));
  assert.ok(errors.some(e => e.message.includes('chưa được nối')));
  assert.ok(errors.some(e => e.message.includes('đường thành công')));
});
test('input rename updates nested refs, conditions, output mapping and map dependencies; in-use vars are detectable', () => {
  const d = simple();
  d.workflow.outputMappingJson = { map: inputRef('map_id') };
  d.nodes[2].data.params.extra = { nested: [inputRef('map_id')] };
  const renamed = renameVariable(d, 'map_id', 'selected_map');
  assert.equal(renamed.nodes[2].data.mapping.map_id.$ref, '/inputs/selected_map');
  assert.equal(renamed.nodes[2].data.params.extra.nested[0].$ref, '/inputs/selected_map');
  assert.equal(renamed.variables[1].mapVariable, 'selected_map');
  assert.ok(inputUsages(renamed, 'selected_map').length >= 3);
  assert.throws(() => renameVariable(d, 'map_id', 'destination_1_endpoint_id'), /duy nhất/);
});
test('undeclared, wrong-type and optional unbound inputs cannot be saved', () => {
  const d = simple(); d.variables[0].kind = 'number'; d.variables[0].required = false;
  d.nodes[2].data.mapping.endpoint_id = inputRef('missing');
  const errors = validateDocument(d);
  assert.ok(errors.some(e => e.message.includes('chưa được khai báo')));
  assert.ok(errors.some(e => e.message.includes('kiểu biến')));
  assert.ok(errors.some(e => e.message.includes('bắt buộc hoặc')));
});
test('output references from one branch cannot feed a merged node on another branch', () => {
  let d = simple('WAIT');
  d = addStep(d, 'WAIT', { x: 0, y: 0 }); d = addStep(d, 'WAIT', { x: 0, y: 0 });
  const [a, b, c] = d.nodes.filter(n => n.data.kind === 'step');
  d.edges = d.edges.filter(e => e.source === 'start');
  d = connect(d, { source: a.id, target: b.id, sourceHandle: 'SUCCESS' });
  d = connect(d, { source: a.id, target: c.id, sourceHandle: 'FAILURE' });
  d = connect(d, { source: b.id, target: c.id, sourceHandle: 'SUCCESS' });
  d = connect(d, { source: c.id, target: 'end', sourceHandle: 'SUCCESS' });
  c.data.mapping.duration_sec = { $ref: `/outputs/${b.id}/duration_sec` }; // connect() copies, modify the current node.
  d.nodes.find(n => n.id === c.id).data.mapping.duration_sec = c.data.mapping.duration_sec;
  assert.ok(validateDocument(d).some(e => e.nodeId === c.id && e.message.includes('chưa chắc tồn tại')));
});
test('fixed executor discriminators and hardware retries stay protected', () => {
  const d = simple('WAIT'); d.nodes[2].data.mapping.wait_type = inputRef('mode'); d.variables.push({ key: 'mode', kind: 'string', required: true });
  assert.ok(validateDocument(d).some(e => e.message.includes('cố định')));
  const hardware = simple('CONTROL_HARDWARE'); hardware.nodes[2].data.maxAttempts = 2;
  assert.ok(validateDocument(hardware).some(e => e.message.includes('một lần')));
});
test('a failed predecessor has no output even when it dominates the next step', () => {
  let d = simple('WAIT'); d = addStep(d, 'WAIT', { x: 500, y: 100 });
  const [a, b] = d.nodes.filter(n => n.data.kind === 'step');
  d = connect(d, { source: a.id, target: b.id, sourceHandle: 'FAILURE' });
  d = connect(d, { source: b.id, target: 'end', sourceHandle: 'SUCCESS' });
  d.nodes.find(n => n.id === b.id).data.mapping.duration_sec = { $ref: `/outputs/${a.id}/duration_sec` };
  assert.ok(validateDocument(d).some(e => e.nodeId === b.id && e.message.includes('chưa chắc tồn tại')));
});
test('known scalar/structured values validate types instead of coercing strings', () => {
  assert.match(valueError('5', { kind: 'number' }), /số/);
  assert.match(valueError({}, { kind: 'array' }), /mảng/);
  assert.equal(valueError(false, { kind: 'boolean', required: true }), '');
  assert.equal(valueError(inputRef('duration'), { kind: 'number' }), '');
  assert.equal(Object.keys(stepCatalog).length, 11);
});
test('legacy cyclic and disabled workflows remain read-only and retain transitions', () => {
  const detail = detailFor(toPayload(simple()));
  detail.transitions[0].toStepId = detail.steps[0].stepId; detail.transitions[0].terminalStatus = null;
  const d = fromDetail(detail);
  assert.ok(d.readOnlyReasons.some(r => r.includes('vòng lặp')));
  assert.equal(d.edges.find(e => e.id === 'edge-0').target, d.nodes[1].id);
  detail.steps[0].enabled = false;
  assert.ok(fromDetail(detail).readOnlyReasons.some(r => r.includes('hỗ trợ')));
});
test('local patrol conversion makes a copy with endpoint inputs, never leaks local IDs', () => {
  const d = simple(); d.workflow.workflowId = 'local-patrol-original'; d.legacyLocal = true; d.workflow.localOnly = true;
  d.nodes[2].data.params = { mode: 'PATROL', max_speed_mps: .08, map_id: 'local-map-studio', endpoint_id: 'local-point' }; d.nodes[2].data.mapping = {};
  const next = convertLocal(d);
  assert.equal(d.workflow.workflowId, 'local-patrol-original');
  assert.equal(next.workflow.workflowId, undefined);
  assert.equal(next.legacyLocal, false);
  assert.ok(!JSON.stringify(toPayload(next)).includes('local-map-studio'));
  assert.deepEqual(validateDocument(next), []);
});
test('destination catalog filters map, room, active/accessibility; MOVE rejects wrong-map points', () => {
  const catalog = { maps: [{ mapId, status: 'ACTIVE' }], endpoints: [{ endpointId, mapId, roomId: 'room-a', active: true, accessible: true }, { endpointId: 'other', mapId, roomId: 'room-b', active: true, accessible: false }] };
  assert.equal(availableDestinations(catalog, mapId, 'room-a').length, 1);
  assert.equal(availableDestinations(catalog, mapId, 'room-b').length, 0);
  const d = simple(); d.nodes[2].data.mapping = {}; d.nodes[2].data.params = { map_id: mapId, endpoint_id: endpointId, mode: 'NORMAL', max_speed_mps: .08 };
  assert.deepEqual(validateDocument(d, catalog), []);
  catalog.endpoints[0].mapId = 'another';
  assert.ok(validateDocument(d, catalog).some(e => e.message.includes('sai bản đồ')));
});
test('draft storage isolates account/backend, preserves corrupt originals and surfaces quota failure', () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const key = designerStorageKey('server-a', { accountId: 'a' });
  assert.notEqual(key, designerStorageKey('server-b', { accountId: 'a' }));
  assert.notEqual(key, designerStorageKey('server-a', { accountId: 'b' }));
  const entry = { document: newDocument(), syncFingerprint: null };
  writeDraft(storage, key, entry); writeDraft(storage, key, entry); assert.equal(readDrafts(storage, key).length, 1);
  deleteDraft(storage, key, entry.document.localId); assert.deepEqual(readDrafts(storage, key), []);
  storage.setItem(key, 'broken'); assert.throws(() => writeDraft(storage, key, entry)); assert.equal(storage.getItem(key), 'broken');
  assert.throws(() => writeDraft({ getItem: () => null, setItem: () => { throw Error('quota'); } }, key, entry), /quota/);
});
test('save creates graph atomically; editing awaits metadata then graph and propagates partial failures', async () => {
  const d = simple(), calls = [];
  const created = await saveDesign(d, { createGraph: async body => { calls.push('createGraph'); return detailFor(body); } });
  assert.deepEqual(calls, ['createGraph']); assert.equal(created.syncFingerprint, fingerprint(created.document));
  await assert.rejects(saveDesign(created.document, { update: async () => calls.push('update'), replaceGraph: async () => { calls.push('graph'); throw Error('graph failed'); } }), /graph failed/);
  assert.deepEqual(calls, ['createGraph', 'update', 'graph']);
});
test('publish requires a matching validated saved document and trusts only server success', async () => {
  const document = simple(), entry = { document, syncFingerprint: fingerprint(document) }; let called = 0;
  const api = { publish: async () => { called++; throw Error('not ready'); } };
  await assert.rejects(publishDesign(entry, api), /kiểm tra/); assert.equal(called, 0);
  document.workflow.status = 'VALIDATED'; document.workflow.workflowId = 'wf-1';
  await assert.rejects(publishDesign(entry, api), /not ready/); assert.equal(called, 1);
  document.nodes[2].data.params.max_speed_mps = .1;
  await assert.rejects(publishDesign(entry, api), /kiểm tra/); assert.equal(called, 1);
});
