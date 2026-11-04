import test from 'node:test';
import assert from 'node:assert/strict';
import { newDocument, addStep, connect, copy, inputRef, validateDocument, toPayload, fromDetail } from '../src/features/workflows/designer/designerModel.js';

function example(type = 'AUTHENTICATE') {
  let document = addStep(newDocument(), type, { x: 300, y: 100 });
  const step = document.nodes.find(node => node.data.kind === 'step');
  document = connect(document, { source: 'start', target: step.id, sourceHandle: 'SUCCESS' });
  document = connect(document, { source: step.id, target: 'end', sourceHandle: 'SUCCESS' });
  return { document, step: document.nodes.find(node => node.id === step.id) };
}
function guard(document, source, path, value = true) {
  const fallback = document.edges.find(edge => edge.source === source && edge.data.outcome === 'SUCCESS');
  fallback.data.priority = 2;
  document.edges.push({ id: 'guard', source, target: 'end', sourceHandle: 'SUCCESS', data: {
    outcome: 'SUCCESS', priority: 1, defaultTransition: false, conditionJson: { path, operator: 'EQ', value },
  } });
}
function detail(payload) {
  return {
    workflow: { ...payload.workflow, workflowId: 'saved', status: 'DRAFT', startStepId: payload.graph.startStepCode },
    tasks: payload.graph.tasks.map(task => ({ ...task, taskId: task.taskCode })),
    steps: payload.graph.steps.map(step => ({ ...step, stepId: step.stepCode, stepTypeCode: step.stepType, taskId: step.taskCode, enabled: true })),
    transitions: payload.graph.transitions.map((edge, index) => ({ ...edge, transitionId: String(index), fromStepId: edge.fromStepCode, toStepId: edge.toStepCode })),
  };
}
const conditional = payload => payload.graph.transitions.find(edge => !edge.defaultTransition);

test('success guard serializes source output into BE transition result without changing step input mappings', () => {
  const { document, step } = example();
  guard(document, step.id, `/outputs/${step.id}/verified`);
  const before = copy(document);
  assert.deepEqual(validateDocument(document), []);
  const payload = toPayload(document);
  assert.equal(conditional(payload).conditionJson.path, '/result/verified');
  assert.deepEqual(payload.graph.steps[0].inputMappingJson.service_request_id, inputRef('service_request_id'));
  assert.deepEqual(document, before);
});

test('BE result conditions load into the canvas and retain the same executable payload on round-trip', () => {
  const { document, step } = example();
  guard(document, step.id, `/outputs/${step.id}/verified`);
  const payload = toPayload(document), restored = fromDetail(detail(payload));
  assert.deepEqual(restored.readOnlyReasons, []);
  assert.equal(restored.edges.find(edge => !edge.data.defaultTransition).data.conditionJson.path, `/outputs/${step.id}/verified`);
  assert.deepEqual(validateDocument(restored), []);
  assert.deepEqual(toPayload(restored).graph, payload.graph);
});

test('workflow input guard maps to the uniquely bound source step input and restores its workflow key', () => {
  const { document, step } = example('MOVE');
  document.variables.push({ key: 'speed', label: 'Tốc độ', kind: 'number', required: true });
  delete step.data.params.max_speed_mps;
  step.data.mapping.max_speed_mps = inputRef('speed');
  guard(document, step.id, '/inputs/speed', 0.08);
  assert.deepEqual(validateDocument(document), []);
  const payload = toPayload(document);
  assert.equal(conditional(payload).conditionJson.path, '/inputs/max_speed_mps');
  const restored = fromDetail(detail(payload));
  assert.equal(restored.edges.find(edge => !edge.data.defaultTransition).data.conditionJson.path, '/inputs/speed');
  assert.deepEqual(restored.readOnlyReasons, []);
  assert.deepEqual(toPayload(restored).graph, payload.graph);
});

test('transition guard cannot read previous step output even when that output exists in the workflow context', () => {
  let { document, step } = example('MOVE');
  document = addStep(document, 'WAIT', { x: 600, y: 100 });
  const wait = document.nodes.find(node => node.data.stepType === 'WAIT');
  document.edges.find(edge => edge.source === step.id && edge.data.outcome === 'SUCCESS').target = wait.id;
  document = connect(document, { source: wait.id, target: 'end', sourceHandle: 'SUCCESS' });
  guard(document, wait.id, `/outputs/${step.id}/reached`);
  assert.ok(validateDocument(document).some(issue => issue.edgeId === 'guard' && issue.message.includes('chính bước nguồn')));
});

test('transition guard rejects context variables and workflow inputs absent from source resolved inputs', () => {
  for (const path of ['/vars/ready', '/inputs/other']) {
    const { document, step } = example();
    document.variables.push({ key: 'other', kind: 'boolean', required: true });
    guard(document, step.id, path);
    assert.ok(validateDocument(document).some(issue => issue.edgeId === 'guard'));
  }
});

test('ambiguous source input bindings cannot silently choose which resolved field a guard reads', () => {
  const { document, step } = example('MOVE');
  document.variables.push({ key: 'shared', kind: 'string', required: true });
  step.data.mapping.map_id = inputRef('shared');
  step.data.mapping.endpoint_id = inputRef('shared');
  guard(document, step.id, '/inputs/shared', 'value');
  assert.ok(validateDocument(document).some(issue => issue.edgeId === 'guard' && issue.message.includes('ánh xạ duy nhất')));
});

test('unsupported legacy transition scopes remain unchanged and open read-only', () => {
  for (const path of ['/error/code', '/inputs/fixed_runtime_field', '/vars/legacy']) {
    const { document, step } = example();
    guard(document, step.id, path, 'EXPECTED');
    const payload = toPayload(document), restored = fromDetail(detail(payload));
    assert.ok(restored.readOnlyReasons.length, path);
    assert.equal(restored.edges.find(edge => !edge.data.defaultTransition).data.conditionJson.path, path);
    assert.equal(conditional(toPayload(restored)).conditionJson.path, path);
  }
});
