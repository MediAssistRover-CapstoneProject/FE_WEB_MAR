import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, copy, fromDetail, toPayload, validateDocument } from '../src/features/workflows/designer/designerModel.js';
import { graphDetail, happyPathDocument } from './fixtures/workflow-happy-path.mjs';

test('happy-path-only design compiles complete stop routes and reopens without error wires or terminals', () => {
  const document = happyPathDocument(), payload = toPayload(document);
  assert.deepEqual(validateDocument(document), []);
  assert.equal(payload.graph.transitions.length, 6);
  assert.equal(payload.workflow.inputUiJson.designer.automaticErrorRoutes.length, 4);
  for (const step of payload.graph.steps) for (const outcome of ['FAILURE', 'TIMEOUT']) {
    const routes = payload.graph.transitions.filter(t => t.fromStepCode === step.stepCode && t.outcome === outcome);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].terminalStatus, 'RECOVERY_REQUIRED');
    assert.equal(routes[0].toStepCode, null);
    assert.equal(routes[0].defaultTransition, true);
  }
  let restored = fromDetail(graphDetail(payload));
  for (let round = 0; round < 3; round++) {
    assert.equal(restored.edges.length, 3);
    assert.ok(restored.edges.every(e => e.data.outcome === 'SUCCESS'));
    assert.equal(restored.nodes.filter(n => n.data.kind === 'terminal').length, 1);
    assert.deepEqual(validateDocument(restored), []);
    assert.deepEqual(toPayload(restored).graph, payload.graph);
    restored = fromDetail(graphDetail(toPayload(restored)));
  }
});

test('older v1 designer automatic routes fold back into the step without changing runtime transitions', () => {
  const payload = toPayload(happyPathDocument());
  delete payload.workflow.inputUiJson.designer.automaticErrorRoutes;
  const restored = fromDetail(graphDetail(payload));
  assert.equal(restored.edges.length, 3);
  assert.deepEqual(toPayload(restored).graph, payload.graph);
});

test('explicit custom error routes stay on canvas even when they end in RECOVERY_REQUIRED', () => {
  let document = happyPathDocument();
  const first = document.nodes.find(n => n.data.kind === 'step');
  document.nodes.push({ id: 'custom-stop', type: 'workflow', position: { x: 650, y: 450 }, data: { kind: 'terminal', name: 'Cần nhân viên', terminalStatus: 'RECOVERY_REQUIRED' } });
  document = connect(document, { source: first.id, target: 'custom-stop', sourceHandle: 'FAILURE' });
  const payload = toPayload(document), restored = fromDetail(graphDetail(payload));
  assert.equal(restored.edges.filter(e => e.data.outcome === 'FAILURE').length, 1);
  assert.equal(restored.nodes.find(n => n.id === 'custom-stop').data.name, 'Cần nhân viên');
  assert.deepEqual(toPayload(restored).graph, payload.graph);
});

test('imported workflows without designer provenance retain every explicit error route', () => {
  const payload = toPayload(happyPathDocument());
  delete payload.workflow.inputUiJson.designer;
  const restored = fromDetail(graphDetail(payload));
  assert.equal(restored.edges.filter(e => ['FAILURE', 'TIMEOUT'].includes(e.data.outcome)).length, 4);
  assert.deepEqual(toPayload(restored).graph, payload.graph);
});

test('changed targets, outcomes, statuses, conditions and priorities are not hidden as automatic stops', () => {
  const payload = toPayload(happyPathDocument());
  for (const patch of [
    { terminalStatus: 'FAILED' }, { priority: 2 },
    { toStepId: 'id-' + payload.graph.steps[1].stepCode, terminalStatus: null },
    { outcome: 'SUCCESS', priority: 2, defaultTransition: false, conditionJson: { path: '/result/elapsed', operator: 'GT', value: 0 } },
    { conditionJson: { path: '/error/code', operator: 'EXISTS' } },
  ]) {
    const detail = graphDetail(payload), route = detail.transitions.find(t => t.outcome === 'FAILURE');
    Object.assign(route, patch);
    assert.ok(fromDetail(detail).edges.some(e => e.id === route.transitionId), JSON.stringify(patch));
  }
  const detail = graphDetail(payload), route = detail.transitions.find(t => t.outcome === 'FAILURE');
  detail.transitions.push({ ...copy(route), transitionId: 'conditional-error', defaultTransition: false, priority: 2 });
  assert.equal(fromDetail(detail).edges.filter(e => e.source === payload.graph.startStepCode && e.data.outcome === 'FAILURE').length, 2);
});
