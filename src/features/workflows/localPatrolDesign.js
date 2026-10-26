import { freeWebPoint, isCurrentMap } from '../maps/MapProvider.js';
import { loadDraft } from '../../pages/Admin/mapStudioModel.js';
import { mapReference, sameMap } from '../../pages/Admin/patrolModel.js';
import { orderedPatrolSteps } from './patrolWorkflowModel.js';

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

export function localPatrolPlan(detail, saved, startId) {
  const ordered = orderedPatrolSteps(detail);
  const issues = [...ordered.issues];
  if (detail.workflow.serviceType !== 'PATROL') issues.push('Chỉ chọn quy trình có mục đích Tuyến tuần tra.');
  if (!detail.workflow.localOnly || !sameMap(detail.mapRef, saved)) issues.push('Chọn lại điểm đích và lưu quy trình với bản đồ hiện tại trong Thiết kế quy trình.');
  if (ordered.steps.length < 2 || ordered.steps.some(step => step.stepTypeCode !== 'MOVE' || step.enabled === false || step.paramsJson?.map_id !== LOCAL_MAP_ID || Object.keys(step.inputMappingJson ?? {}).length)) issues.push('Cần ít nhất hai bước MOVE cố định trên bản đồ đang lưu.');
  const points = ordered.steps.map(step => ({ step, endpoint: saved?.snapshot.endpoints.find(point => point.id === step.paramsJson?.endpoint_id) }));
  if (!isCurrentMap(saved?.snapshot)) issues.push('Bản đồ đã thay đổi. Lưu lại bản đồ và chọn lại các điểm đích.');
  points.forEach(({endpoint,step},index)=>{
    if(!endpoint || endpoint.enabled===false || endpoint.accessible===false || !freeWebPoint(endpoint,.3)) issues.push('Bước '+(index+1)+': điểm đích thiếu hoặc quá gần vật cản/vùng chưa biết.');
    const speed=Number(step.paramsJson?.max_speed_mps);
    if(!Number.isFinite(speed)||speed<.01||speed>.26) issues.push('Bước '+(index+1)+': tốc độ Gazebo cần trong 0,01–0,26 m/s.');
  });
  return {points,path:[],issues:[...new Set(issues)],valid:!issues.length};
}
