import test from 'node:test';
import assert from 'node:assert/strict';
import { copy, fromDetail, newDocument, toPayload, validateDocument, visit } from '../src/features/workflows/designer/designerModel.js';
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
  assert.deepEqual(draft.workflow.inputUiJson.deliveryDraft, { mode: 'QR_SINGLE_BUTTON', version: 2, runtimeReady: false, notice: QR_DELIVERY_DRAFT_NOTICE });
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

test('QR retries stay inside authentication; button rejection is separate from waiting and errors have specific exits', () => {
  const draft = rebuildQrDeliveryDraft(newDocument()), steps = draft.nodes.filter(node => node.data.kind === 'step');
  assert.equal(draft.edges.find(edge => edge.source === 'start').target, steps[0].id);
  for (const [index, node] of steps.entries()) {
    for (const outcome of ['FAILURE', 'TIMEOUT']) {
      const routes = draft.edges.filter(edge => edge.source === node.id && edge.data.outcome === outcome);
      assert.equal(routes.length, 1);
      const target = draft.nodes.find(n => n.id === routes[0].target);
      assert.equal(target.data.terminalStatus, 'RECOVERY_REQUIRED');
      assert.match(target.data.name, outcome === 'FAILURE' ? /Lỗi thực thi/ : node.data.stepType === 'AUTHENTICATE' ? /xác thực QR/ : node.data.stepType === 'INTERACT' ? /chờ nút/ : /di chuyển \/ servo/);
      assert.equal(routes[0].data.defaultTransition, true);
    }
    const success = draft.edges.filter(edge => edge.source === node.id && edge.data.outcome === 'SUCCESS');
    const field = node.data.stepType === 'INTERACT' ? 'confirmed' : null;
    const main = success.find(edge => edge.target === (steps[index + 1]?.id ?? 'end'));
    assert.ok(main);
    if (field) {
      assert.deepEqual(main.data.conditionJson, { path: `/outputs/${node.id}/${field}`, operator: 'EQ', value: true });
      assert.equal(main.data.defaultTransition, false);
      const fallback = success.find(edge => edge.data.defaultTransition);
      assert.match(draft.nodes.find(n => n.id === fallback.target).data.name, /Phản hồi nút không hợp lệ/);
      assert.equal(fallback.data.priority, 2);
      assert.equal(main.sourceHandle, 'true');
      assert.equal(fallback.sourceHandle, 'false');
      assert.equal(workflowEdgeLabel(fallback, draft), 'Phản hồi không hợp lệ');
      assert.equal(success.length, 2);
    } else {
      assert.equal(success.length, 1);
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

test('graph, input form metadata and positions round-trip without losing the runtime-unready warning', () => {
  const draft = rebuildQrDeliveryDraft(newDocument()), payload = toPayload(draft);
  const restored = fromDetail(detailFor(payload)), again = toPayload(restored);
  assert.deepEqual(again.graph, payload.graph);
  assert.deepEqual(again.workflow.inputSchemaJson, payload.workflow.inputSchemaJson);
  const normalizeUi = ui => ({ ...ui, designer: { ...ui.designer, terminals: [...ui.designer.terminals].sort((a, b) => a.id.localeCompare(b.id)) } });
  assert.deepEqual(normalizeUi(again.workflow.inputUiJson), normalizeUi(payload.workflow.inputUiJson));
  assert.equal(again.workflow.inputUiJson.deliveryDraft.runtimeReady, false);
  assert.equal(payload.graph.transitions.length, 32);
  assert.equal(restored.readOnlyReasons.length, 0);
  assert.deepEqual(validateDocument(restored), []);
});
