import { loadDraft } from '../../pages/Admin/mapStudioModel.js';
import { mapReference } from '../../pages/Admin/patrolModel.js';

export const LOCAL_MAP_ID = 'local-map-studio';
export const LOCAL_WORKFLOWS_KEY = 'mediassist.local-patrol-workflows.v1';

// Same saved snapshot as Map Studio and Dispatch. Never merge server coordinates.
export function localMapCatalog(storage = window.localStorage) {
  const saved = loadDraft(storage).saved;
  return {
    saved,
    maps: saved ? [{ mapId: LOCAL_MAP_ID, mapName: saved.snapshot.name, versionNo: saved.revision, status: 'ACTIVE' }] : [],
    endpoints: (saved?.snapshot.endpoints ?? []).map(point => ({
      endpointId: point.id, endpointName: point.name, endpointCode: point.name,
      mapId: LOCAL_MAP_ID, active: point.enabled !== false, accessible: point.accessible !== false,
    })),
  };
}

export function readLocalDesigns(storage = window.localStorage) {
  const raw = storage.getItem(LOCAL_WORKFLOWS_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (data.schema !== 1 || !Array.isArray(data.designs) || data.designs.some(detail => !detail?.workflow?.localOnly || !detail.workflow.workflowId || !Array.isArray(detail.steps) || !Array.isArray(detail.tasks) || !Array.isArray(detail.transitions))) throw Error();
    return data.designs;
  } catch { throw new Error('Không đọc được quy trình đã lưu trên thiết bị. Dữ liệu cũ được giữ nguyên.'); }
}

export function mergeLocalDesigns(remote, storage = window.localStorage) {
  const local = readLocalDesigns(storage).map(detail => detail.workflow);
  return [...local, ...remote.filter(item => !local.some(own => own.workflowId === item.workflowId))];
}

export async function getDesign(id, fetchRemote, storage = window.localStorage) {
  const local = readLocalDesigns(storage).find(detail => detail.workflow.workflowId === id);
  if (local) return local;
  if (id.startsWith('local-patrol-')) throw new Error('Bản nháp này đã bị xóa trên thiết bị.');
  return fetchRemote(id);
}

export function saveLocalGraph({ workflow, graph }, storage = window.localStorage) {
  const designs = readLocalDesigns(storage);
  const { saved, endpoints } = localMapCatalog(storage);
  if (!saved) throw new Error('Hãy lưu bản đồ tại Bản đồ → Điểm đích trước.');
  if (graph.steps.some(step => step.paramsJson.map_id !== LOCAL_MAP_ID || !endpoints.some(point => point.endpointId === step.paramsJson.endpoint_id && point.active && point.accessible))) throw new Error('Chọn lại điểm đích từ bản đồ đã lưu. Điểm trên máy chủ không thuộc bản đồ này.');
  const id = workflow.workflowId || 'local-patrol-' + crypto.randomUUID();
  const detail = {
    workflow: { ...workflow, workflowId: id, localOnly: true, status: 'DRAFT', acceptsNewJobs: false, startStepId: graph.startStepCode, updatedAt: new Date().toISOString() },
    mapRef: mapReference(saved),
    tasks: graph.tasks.map(task => ({ ...task, taskId: task.taskCode })),
    steps: graph.steps.map(step => ({ ...step, stepId: step.stepCode, taskId: step.taskCode, stepTypeCode: step.stepType, enabled: true })),
    transitions: graph.transitions.map(edge => ({ ...edge, fromStepId: edge.fromStepCode, toStepId: edge.toStepCode })),
  };
  storage.setItem(LOCAL_WORKFLOWS_KEY, JSON.stringify({ schema: 1, designs: [...designs.filter(item => item.workflow.workflowId !== id), detail] }));
  return detail;
}

export function removeLocalDesign(id, storage = window.localStorage) {
  storage.setItem(LOCAL_WORKFLOWS_KEY, JSON.stringify({ schema: 1, designs: readLocalDesigns(storage).filter(detail => detail.workflow.workflowId !== id) }));
}
