import { speechFields } from '../workflows/designer/stepCatalog.js';
import { fingerprint } from '../workflows/designer/designerModel.js';
import { deleteDraft, readDrafts } from '../workflows/designer/designerStorage.js';

export function speechData(step) {
  const params = { ...step.paramsJson, ...step.inputMappingJson };
  return params.data;
}

export function speechSteps(detail) {
  return (detail?.steps ?? []).filter(step => step.stepTypeCode === 'INTERACT'
    && { ...step.paramsJson, ...step.inputMappingJson }.action === 'SPEAK')
    .sort((a, b) => a.sequenceNo - b.sequenceNo);
}

export function isBound(value) {
  return value !== null && typeof value === 'object';
}

export function editableSpeechData(step) {
  const data = speechData(step);
  return !!data && typeof data === 'object' && !Array.isArray(data)
    && !Object.hasOwn(data, '$ref') && !Object.hasOwn(data, '$template');
}

export function speechError(data) {
  for (const field of speechFields) {
    const value = data?.[field.key];
    if (isBound(value)) continue;
    if (field.required && (typeof value !== 'string' || !value.trim())) return 'Nhập nội dung robot sẽ đọc.';
    if (value === undefined) continue;
    if (field.maxLength && (typeof value !== 'string' || value.length > field.maxLength)) return `${field.label} tối đa ${field.maxLength} ký tự.`;
    if (field.options && !field.options.includes(value)) return 'Chọn tiếng Việt hoặc tiếng Anh.';
    if (field.kind === 'integer' && (!Number.isInteger(value) || value < field.min || value > field.max)) return `${field.label} từ ${field.min} đến ${field.max}.`;
  }
  return '';
}

export function speechChanges(detail, drafts) {
  return speechSteps(detail).filter(step => drafts[step.stepCode]
    && JSON.stringify(drafts[step.stepCode]) !== JSON.stringify(speechData(step)))
    .map(step => ({ stepCode: step.stepCode, expectedParamsJson: step.paramsJson,
      expectedInputMappingJson: step.inputMappingJson, data: drafts[step.stepCode] }));
}

export function clearSyncedSpeechDrafts(storage, storageKey, workflowId) {
  let unsynced = false;
  for (const entry of readDrafts(storage, storageKey)) {
    if (entry.document.workflow.workflowId !== workflowId) continue;
    if (entry.syncFingerprint === fingerprint(entry.document)) deleteDraft(storage, storageKey, entry.document.localId);
    else unsynced = true;
  }
  return unsynced;
}
