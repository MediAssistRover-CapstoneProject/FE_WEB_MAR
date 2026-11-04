export function designerStorageKey(baseUrl, account) { return `mediassist.workflow-designer.v1:${encodeURIComponent(baseUrl)}:${encodeURIComponent(account?.accountId ?? account?.username ?? 'anonymous')}`; }
export function readDrafts(storage, key) {
  const raw = storage.getItem(key);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.drafts) || value.drafts.some(d => !d?.document?.localId || !d.document.workflow || !Array.isArray(d.document.nodes) || !Array.isArray(d.document.edges) || !Array.isArray(d.document.tasks) || !Array.isArray(d.document.variables) || d.document.nodes.some(n => !n?.id || !n.data || !n.position))) throw new Error('Không đọc được bản nháp thiết kế. Dữ liệu gốc vẫn được giữ.');
  return value.drafts;
}
export function writeDraft(storage, key, entry) {
  const drafts = readDrafts(storage, key);
  const value = { ...entry, savedAt: new Date().toISOString() };
  storage.setItem(key, JSON.stringify({ version: 1, drafts: [value, ...drafts.filter(d => d.document.localId !== entry.document.localId)] }));
  return value;
}
export function deleteDraft(storage, key, id) { storage.setItem(key, JSON.stringify({ version: 1, drafts: readDrafts(storage, key).filter(d => d.document.localId !== id) })); }
