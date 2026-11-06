import test from 'node:test';
import assert from 'node:assert/strict';
import { createServoDemoDraft, ensureServoDemoDraft, SERVO_DEMO_CODE } from '../src/features/workflows/designer/servoDemoDraft.js';
import { fromDetail, toPayload, validateDocument } from '../src/features/workflows/designer/designerModel.js';
import { readDrafts, deleteDraft, writeDraft } from '../src/features/workflows/designer/designerStorage.js';
import { commissioningUnlock } from '../src/features/workflows/designer/stepCatalog.js';
import { graphDetail } from './fixtures/workflow-happy-path.mjs';

test('servo demo runs A, open, five second wait, close, then B without condition/auth steps', () => {
  const document = createServoDemoDraft();
  assert.deepEqual(validateDocument(document), []);
  const payload = toPayload(document), steps = payload.graph.steps;
  assert.deepEqual(steps.map(step => step.stepCode), ['MOVE_A', 'OPEN_SERVO', 'WAIT_5_SECONDS', 'CLOSE_SERVO', 'MOVE_B']);
  assert.deepEqual(steps.map(step => step.stepType), ['MOVE', 'CONTROL_HARDWARE', 'WAIT', 'CONTROL_HARDWARE', 'MOVE']);
  assert.equal(steps[1].paramsJson.action, 'UNLOCK_COMPARTMENT');
  assert.equal(steps[2].paramsJson.duration_sec, 5);
  assert.equal(steps[3].paramsJson.action, 'LOCK_COMPARTMENT');
  assert.equal(steps[0].inputMappingJson.endpoint_id.$ref, '/inputs/point_a_endpoint_id');
  assert.equal(steps[4].inputMappingJson.endpoint_id.$ref, '/inputs/point_b_endpoint_id');
  assert.equal(payload.workflow.defaultInputsJson.hardware_test_mode, 'COMMISSIONING_ONLY');
  assert.ok(payload.graph.transitions.every(edge => edge.conditionJson === null));
  const happy = payload.graph.transitions.filter(edge => edge.outcome === 'SUCCESS');
  assert.deepEqual(happy.map(edge => edge.toStepCode), ['OPEN_SERVO', 'WAIT_5_SECONDS', 'CLOSE_SERVO', 'MOVE_B', null]);
  const restored = fromDetail(graphDetail(payload, 'saved-demo'));
  assert.deepEqual(validateDocument(restored), []);
  assert.deepEqual(toPayload(restored).graph.steps.map(step => step.stepCode), steps.map(step => step.stepCode));
});

test('regular workflow unlock still requires auth; commissioning exemption requires fixed server template flag', () => {
  const document = createServoDemoDraft(), open = document.nodes.find(node => node.id === 'OPEN_SERVO').data;
  assert.equal(commissioningUnlock(open, document.workflow), true);
  delete document.workflow.defaultInputsJson.hardware_test_mode;
  assert.equal(commissioningUnlock(open, document.workflow), false);
  assert.ok(validateDocument(document).some(error => error.nodeId === 'OPEN_SERVO'));
  document.workflow.defaultInputsJson.hardware_test_mode = 'COMMISSIONING_ONLY';
  open.mapping.action = { $ref: '/inputs/action' };
  assert.equal(commissioningUnlock(open, document.workflow), false);
});

test('starter seed is idempotent, preserves existing drafts and respects later deletion', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const other = createServoDemoDraft(); other.workflow.workflowCode = 'EXISTING';
  writeDraft(storage, 'drafts', { document: other });
  ensureServoDemoDraft(storage, 'drafts'); ensureServoDemoDraft(storage, 'drafts');
  let drafts = readDrafts(storage, 'drafts');
  assert.equal(drafts.length, 2);
  assert.ok(drafts.some(entry => entry.document.workflow.workflowCode === 'EXISTING'));
  const starter = drafts.find(entry => entry.document.workflow.workflowCode === SERVO_DEMO_CODE);
  deleteDraft(storage, 'drafts', starter.document.localId);
  ensureServoDemoDraft(storage, 'drafts');
  assert.equal(readDrafts(storage, 'drafts').length, 1);
  storage.setItem('broken', '{broken');
  assert.throws(() => ensureServoDemoDraft(storage, 'broken'));
  assert.equal(storage.getItem('broken'), '{broken');
});
