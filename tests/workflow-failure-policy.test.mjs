import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFailurePolicy, failurePolicy, failurePolicyIssues } from '../src/features/workflows/workflowFailurePolicy.js';
import { newDocument, toPayload, fromDetail, validateDocument } from '../src/features/workflows/designer/designerModel.js';
import { happyPathDocument, graphDetail } from './fixtures/workflow-happy-path.mjs';
import { rebuildQrDeliveryDraft } from '../src/features/workflows/designer/qrDeliveryDraft.js';

test('new workflows opt in, older definitions stay opt out until explicitly configured', () => {
  assert.equal(failurePolicy(newDocument().workflow).enabled, true);
  assert.equal(failurePolicy({ inputUiJson: {} }).enabled, false);
  assert.deepEqual(failurePolicyIssues(newDocument().workflow), []);
});
test('policy and unrelated metadata survive payload and server reload with no extra error wires', () => {
  const doc = happyPathDocument();
  doc.workflow.inputUiJson.custom = { preserved: true };
  doc.workflow.inputUiJson.failureHandling = { ...defaultFailurePolicy, acknowledgeTimeoutSec: 90, resolutionTimeoutSec: 300, notifyAdminImmediately: true };
  const payload = toPayload(doc), loaded = fromDetail(graphDetail(payload));
  assert.deepEqual(toPayload(loaded).workflow.inputUiJson.failureHandling, doc.workflow.inputUiJson.failureHandling);
  assert.deepEqual(loaded.workflow.inputUiJson.custom, { preserved: true });
  assert.equal(loaded.edges.length, 3);
});
test('QR preset enables handling on new drafts and preserves explicit policy choices', () => {
  assert.equal(failurePolicy(rebuildQrDeliveryDraft(newDocument()).workflow).enabled, true);
  const doc = newDocument(); doc.workflow.inputUiJson.failureHandling = { ...defaultFailurePolicy, enabled: false, acknowledgeTimeoutSec: 300 };
  assert.deepEqual(rebuildQrDeliveryDraft(doc).workflow.inputUiJson.failureHandling, doc.workflow.inputUiJson.failureHandling);
});
test('invalid policy blocks save, including malformed metadata and unreasonable deadlines', () => {
  for (const policy of [[], { enabled: 'true' }, { version: 2 }, { acknowledgeTimeoutSec: 0 }, { resolutionTimeoutSec: 86401 }, { acknowledgeTimeoutSec: 30.5 }]) {
    const doc = happyPathDocument(); doc.workflow.inputUiJson.failureHandling = policy;
    assert.ok(failurePolicyIssues(doc.workflow).length);
    assert.ok(validateDocument(doc).length);
  }
});
