import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSyncedSpeechDrafts, editableSpeechData, speechChanges, speechData, speechError, speechSteps } from '../src/features/voice/workflowSpeech.js';
import { fingerprint, newDocument } from '../src/features/workflows/designer/designerModel.js';
import { readDrafts, writeDraft } from '../src/features/workflows/designer/designerStorage.js';

const first = { stepCode: 'ARRIVE', stepTypeCode: 'INTERACT', sequenceNo: 2,
  paramsJson: { action: 'SPEAK', prompt_key: 'ARRIVE', data: { text: 'Đã đến nơi', volume: 0 } }, inputMappingJson: {} };
const mapped = { ...first, stepCode: 'MAPPED', sequenceNo: 1,
  inputMappingJson: { data: { text: { $ref: '/inputs/message' }, volume: 80 } } };

test('speech list follows effective action and sequence, including disabled speech', () => {
  const detail = { steps: [first, mapped, { ...first, stepCode: 'OFF', sequenceNo: 3, enabled: false },
    { ...first, inputMappingJson: { action: 'CONFIRM' } }, { stepTypeCode: 'MOVE' }] };
  assert.deepEqual(speechSteps(detail).map(step => step.stepCode), ['MAPPED', 'ARRIVE', 'OFF']);
  assert.deepEqual(speechData(mapped), mapped.inputMappingJson.data);
});

test('saves only modified speech with original params and mapping for conflict detection', () => {
  const data = { ...speechData(mapped), volume: 50 };
  const changes = speechChanges({ steps: [first, mapped] }, { ARRIVE: { ...speechData(first) }, MAPPED: data });
  assert.deepEqual(changes, [{ stepCode: 'MAPPED', expectedParamsJson: mapped.paramsJson,
    expectedInputMappingJson: mapped.inputMappingJson, data }]);
  assert.equal(changes[0].data.text.$ref, '/inputs/message');
  assert.equal(speechData(first).volume, 0);
});

test('whole-object bindings stay read-only while individual field bindings are retained', () => {
  assert.equal(editableSpeechData(mapped), true);
  assert.equal(editableSpeechData({ ...first, inputMappingJson: { data: { $ref: '/inputs/speech' } } }), false);
  assert.equal(editableSpeechData({ ...first, paramsJson: { action: 'SPEAK' } }), false);
});

test('validates required text and numeric boundaries without inserting robot defaults', () => {
  assert.equal(speechError({ text: 'Xin chào' }), '');
  assert.equal(speechError({ text: 'Xin chào', volume: 0, speed_wpm: 80, language_code: 'vi' }), '');
  assert.equal(speechError({ text: { $ref: '/inputs/message' }, volume: { $ref: '/inputs/volume' } }), '');
  for (const data of [{ text: '' }, { text: ' ' }, { text: 'x'.repeat(501) }, { text: 'Hi', volume: 101 },
    { text: 'Hi', speed_wpm: 79 }, { text: 'Hi', volume: 10.5 }, { text: 'Hi', language_code: 'fr' }])
    assert.ok(speechError(data));
});

test('clears obsolete synced designer caches and retains unsaved design changes', () => {
  const records = new Map();
  const storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  const synced = newDocument(); synced.workflow.workflowId = 'workflow-1';
  const pending = newDocument(); pending.workflow.workflowId = 'workflow-1';
  writeDraft(storage, 'drafts', { document: synced, syncFingerprint: fingerprint(synced) });
  writeDraft(storage, 'drafts', { document: pending, syncFingerprint: null });
  assert.equal(clearSyncedSpeechDrafts(storage, 'drafts', 'workflow-1'), true);
  assert.deepEqual(readDrafts(storage, 'drafts').map(entry => entry.document.localId), [pending.localId]);
});
