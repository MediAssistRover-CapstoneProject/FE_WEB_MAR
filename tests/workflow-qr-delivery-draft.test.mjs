import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, copy, fromDetail, newDocument, toPayload, validateDocument, visit } from '../src/features/workflows/designer/designerModel.js';
import { rebuildQrDeliveryDraft, QR_DELIVERY_DRAFT_NOTICE } from '../src/features/workflows/designer/qrDeliveryDraft.js';
import { stepBehaviour, workflowEdgeLabel } from '../src/features/workflows/designer/designerPresentation.js';

function detailFor(payload) {
  return {
    workflow: { ...payload.workflow, workflowId: 'wf-existing', status: 'DRAFT', startStepId: 'id-' + payload.graph.startStepCode },
    tasks: payload.graph.tasks.map(task => ({ ...task, taskId: 'task-' + task.taskCode })),
    steps: payload.graph.steps.map(step => ({ ...step, stepTypeCode: step.stepType, stepId: 'id-' + step.stepCode, taskId: 'task-' + step.taskCode, enabled: true })),
    transitions: payload.graph.transitions.map((edge, index) => ({ ...edge, transitionId: 'edge-' + index, fromStepId: 'id-' + edge.fromStepCode, toStepId: edge.toStepCode ? 'id-' + edge.toStepCode : null })),
  };
}

test('QR single-button draft rebuilds the same workflow without mutating its old graph or validation', () => {
  const original = newDocument();
  Object.assign(original.workflow, { workflowId: 'wf-existing', workflowName: 'Demo nhận hàng A - giao hàng B', status: 'VALIDATED', definitionHash: 'old-hash', validatedAt: '2026-11-05', outputMappingJson: { old: { $ref: '/outputs/REMOVED/value' } } });
  original.workflow.inputUiJson = { custom: { retained: true }, designer: { positions: { REMOVED: { x: 1, y: 1 } } }, fields: { items: { kind: 'array' } } };
  original.variables = [{ key: 'items', kind: 'array', required: true }];
  const before = copy(original), draft = rebuildQrDeliveryDraft(original);
  assert.deepEqual(original, before);
  for (const key of ['workflowId', 'workflowCode', 'workflowName', 'versionNo']) assert.equal(draft.workflow[key], original.workflow[key]);
  assert.equal(draft.localId, original.localId);
  assert.deepEqual(draft.tasks, original.tasks);
  assert.equal(draft.workflow.status, 'DRAFT');
  assert.equal(draft.workflow.acceptsNewJobs, false);
  assert.equal(draft.workflow.definitionHash, undefined);
  assert.equal(draft.workflow.validatedAt, undefined);
  assert.deepEqual(draft.workflow.outputMappingJson, {});
  assert.deepEqual(draft.workflow.inputUiJson.custom, { retained: true });
  assert.deepEqual(draft.workflow.inputUiJson.deliveryDraft, { mode: 'QR_SINGLE_BUTTON', version: 3, runtimeReady: false, notice: QR_DELIVERY_DRAFT_NOTICE });
  assert.deepEqual(validateDocument(draft), []);
});

test('draft has exactly two MOVE/QR/UNLOCK/button/LOCK stages and no extra staff confirmations', () => {
  const draft = rebuildQrDeliveryDraft(newDocument());
  const steps = draft.nodes.filter(node => node.data.kind === 'step');
  const stage = ['MOVE', 'AUTHENTICATE', 'CONTROL_HARDWARE', 'INTERACT', 'CONTROL_HARDWARE'];
  assert.deepEqual(steps.map(node => node.data.stepType), [...stage, ...stage]);
  assert.equal(new Set(steps.map(node => node.id)).size, 10);
  assert.deepEqual(steps.filter(node => node.data.stepType === 'AUTHENTICATE').map(node => node.data.params), [
    { purpose: 'DELIVERY_SENDER', method: 'QR_CODE' }, { purpose: 'DELIVERY_RECEIVER', method: 'QR_CODE' },
  ]);
  assert.deepEqual(steps.filter(node => node.data.stepType === 'CONTROL_HARDWARE').map(node => node.data.params.action), ['UNLOCK_COMPARTMENT', 'LOCK_COMPARTMENT', 'UNLOCK_COMPARTMENT', 'LOCK_COMPARTMENT']);
  const buttons = steps.filter(node => node.data.stepType === 'INTERACT');
  assert.deepEqual(buttons.map(node => node.data.params.prompt_key), ['REQUEST_CLOSE_SENDER', 'REQUEST_CLOSE_RECEIVER']);
  assert.deepEqual(buttons.map(node => node.data.params.data.text), ['Đã bỏ hàng — Đóng cửa', 'Đã lấy hàng — Đóng cửa']);
  assert.ok(buttons.every(node => node.data.params.action === 'CONFIRM' && !Object.hasOwn(node.data.params.data, 'closed') && !Object.hasOwn(node.data.params.data, 'locked')));
  assert.ok(steps.every(node => node.data.maxAttempts === 1 && node.data.maxVisits === 1));
  assert.deepEqual(steps.map(node => node.position), Array.from({ length: 10 }, (_, index) => ({ x: 320 + (index % 5) * 330, y: 120 + Math.floor(index / 5) * 390 })));
});

test('runtime input references are limited to map, pickup, delivery and service request; each UNLOCK uses its own QR grant', () => {
  const draft = rebuildQrDeliveryDraft(newDocument());
  assert.deepEqual(draft.variables.map(variable => variable.key).sort(), ['delivery_endpoint_id', 'map_id', 'pickup_endpoint_id', 'service_request_id']);
  assert.ok(draft.variables.every(variable => variable.required));
  assert.ok(draft.variables.filter(variable => variable.kind === 'endpoint').every(variable => variable.mapVariable === 'map_id'));
  const steps = draft.nodes.filter(node => node.data.kind === 'step');
  assert.equal(steps[0].data.mapping.endpoint_id.$ref, '/inputs/pickup_endpoint_id');
  assert.equal(steps[5].data.mapping.endpoint_id.$ref, '/inputs/delivery_endpoint_id');
  for (const offset of [0, 5]) {
    const auth = steps[offset + 1], unlock = steps[offset + 2];
    assert.equal(auth.data.mapping.service_request_id.$ref, '/inputs/service_request_id');
    assert.equal(unlock.data.params.authorization.purpose, auth.data.params.purpose);
    for (const key of ['verification_id', 'actor_account_id', 'valid_until']) assert.equal(unlock.data.params.authorization[key].$ref, `/outputs/${auth.id}/${key}`);
  }
  visit(steps, reference => {
    if (reference.$ref.startsWith('/inputs/')) assert.ok(draft.variables.some(variable => reference.$ref === '/inputs/' + variable.key));
  });
});

test('QR draft draws only the happy path while payload retains every automatic stop', () => {
  const draft = rebuildQrDeliveryDraft(newDocument()), steps = draft.nodes.filter(node => node.data.kind === 'step');
  const payload = toPayload(draft);
  assert.equal(draft.edges.length, 11);
  assert.ok(draft.edges.every(edge => edge.data.outcome === 'SUCCESS'));
  assert.equal(draft.nodes.filter(node => node.data.kind === 'terminal').length, 1);
  assert.equal(payload.workflow.inputUiJson.designer.automaticErrorRoutes.length, 22);
  assert.equal(draft.edges.find(edge => edge.source === 'start').target, steps[0].id);
  for (const [index, node] of steps.entries()) {
    for (const outcome of ['FAILURE', 'TIMEOUT']) {
      const routes = payload.graph.transitions.filter(route => route.fromStepCode === node.id && route.outcome === outcome);
      assert.equal(routes.length, 1);
      assert.equal(routes[0].terminalStatus, 'RECOVERY_REQUIRED');
      assert.equal(routes[0].toStepCode, null);
      assert.equal(routes[0].defaultTransition, true);
      assert.equal(draft.edges.filter(edge => edge.source === node.id && edge.data.outcome === outcome).length, 0);
    }
    const success = draft.edges.filter(edge => edge.source === node.id && edge.data.outcome === 'SUCCESS');
    assert.equal(success.length, 1);
    const main = success[0];
    assert.equal(main.target, steps[index + 1]?.id ?? 'end');
    if (node.data.stepType === 'INTERACT') {
      assert.deepEqual(main.data.conditionJson, { path: `/outputs/${node.id}/confirmed`, operator: 'EQ', value: true });
      assert.equal(main.data.defaultTransition, false);
      assert.equal(main.sourceHandle, 'true');
      const routes = payload.graph.transitions.filter(route => route.fromStepCode === node.id && route.outcome === 'SUCCESS');
      assert.equal(routes.length, 2);
      assert.deepEqual(routes.find(route => !route.defaultTransition).conditionJson, { path: '/result/confirmed', operator: 'EQ', value: true });
      const fallback = routes.find(route => route.defaultTransition);
      assert.equal(fallback.priority, 2);
      assert.equal(fallback.toStepCode, null);
      assert.equal(fallback.terminalStatus, 'RECOVERY_REQUIRED');
    } else {
      assert.equal(main.data.defaultTransition, true);
      if (node.data.stepType === 'AUTHENTICATE') {
        assert.equal(node.data.timeoutSec, 120);
        assert.equal(node.data.maxAttempts, 1);
        assert.equal(workflowEdgeLabel(main, draft), 'QR hợp lệ');
        assert.match(stepBehaviour(node.data).text, /không đi sang nhánh Lỗi/);
        assert.match(stepBehaviour(node.data).limitation, /chưa đếm số lần/);
      }
    }
  }
  assert.deepEqual(validateDocument(draft), []);
});

test('changing a button guard cannot silently create an automatic success path', () => {
  const draft = rebuildQrDeliveryDraft(newDocument());
  const button = draft.nodes.find(node => node.data.stepType === 'INTERACT');
  const main = draft.edges.find(edge => edge.source === button.id);
  main.data.conditionJson.value = false;
  assert.ok(validateDocument(draft).some(issue => issue.nodeId === button.id && issue.message.includes('mặc định')));
  assert.equal(toPayload(draft).graph.transitions.filter(route => route.fromStepCode === button.id && route.outcome === 'SUCCESS' && route.defaultTransition).length, 0);
});

test('custom button rejection routes remain explicit and are not replaced by automatic stops', () => {
  let draft = rebuildQrDeliveryDraft(newDocument());
  const button = draft.nodes.find(node => node.data.stepType === 'INTERACT');
  draft.nodes.push({ id: 'reject', type: 'workflow', position: { x: 500, y: 900 }, data: { kind: 'terminal', name: 'Từ chối riêng', terminalStatus: 'FAILED' } });
  draft = connect(draft, { source: button.id, target: 'reject', sourceHandle: 'false' });
  const payload = toPayload(draft), restored = fromDetail(detailFor(payload));
  const fallback = payload.graph.transitions.find(route => route.fromStepCode === button.id && route.outcome === 'SUCCESS' && route.defaultTransition);
  assert.equal(fallback.terminalStatus, 'FAILED');
  assert.ok(restored.edges.some(edge => edge.source === button.id && edge.target === 'reject'));
  assert.deepEqual(toPayload(restored).graph, payload.graph);
});

test('graph, input form metadata and positions round-trip without losing the runtime-unready warning', () => {
  const draft = rebuildQrDeliveryDraft(newDocument()), payload = toPayload(draft);
  const restored = fromDetail(detailFor(payload)), again = toPayload(restored);
  assert.deepEqual(again.graph, payload.graph);
  assert.deepEqual(again.workflow.inputSchemaJson, payload.workflow.inputSchemaJson);
  const normalizeUi = ui => ({ ...ui, designer: { ...ui.designer, terminals: [...ui.designer.terminals].sort((a, b) => a.id.localeCompare(b.id)) } });
  assert.deepEqual(normalizeUi(again.workflow.inputUiJson), normalizeUi(payload.workflow.inputUiJson));
  assert.equal(again.workflow.inputUiJson.deliveryDraft.runtimeReady, false);
  assert.equal(payload.graph.transitions.length, 32);
  assert.equal(restored.edges.length, 11);
  assert.equal(restored.nodes.filter(node => node.data.kind === 'terminal').length, 1);
  assert.equal(restored.readOnlyReasons.length, 0);
  assert.deepEqual(validateDocument(restored), []);
});
