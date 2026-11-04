import { fingerprint, toPayload } from './designerModel.js';

// Updates are intentionally sequential: the BE metadata/graph APIs are separate transactions.
export async function saveDesign(document, api) {
  const payload = toPayload(document);
  let detail;
  if (!document.workflow.workflowId) detail = await api.createGraph(payload);
  else {
    await api.update(document.workflow.workflowId, payload.workflow);
    detail = await api.replaceGraph(document.workflow.workflowId, payload.graph);
  }
  const saved = { ...document, workflow: { ...document.workflow, ...detail.workflow }, legacyLocal: false };
  return { document: saved, syncFingerprint: fingerprint(saved) };
}
export async function publishDesign(entry, api) {
  if (!entry.syncFingerprint || entry.syncFingerprint !== fingerprint(entry.document) || entry.document.workflow.status !== 'VALIDATED') throw new Error('Lưu và kiểm tra lại đúng phiên bản đang mở trước khi publish.');
  return api.publish(entry.document.workflow.workflowId);
}
