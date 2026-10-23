// Shared by the designer and Patrol: the workflow is the only route definition.
export async function loadAllPages(fetchPage) {
  const items = [];
  for (let page = 0; page < 1000; page += 1) {
    const result = await fetchPage({ page, size: 100 });
    if (Array.isArray(result)) return [...items, ...result];
    const content = result?.content ?? [];
    items.push(...content);
    if (result?.last === true || (Number.isInteger(result?.totalPages) && page + 1 >= result.totalPages) || content.length === 0) return items;
    if (result?.last === undefined && result?.totalPages === undefined && content.length < 100) return items;
  }
  throw new Error('Danh sách quá lớn. Vui lòng thu hẹp dữ liệu trên máy chủ.');
}

export const workflowStatusLabel = status => ({ DRAFT: 'Bản nháp', VALIDATED: 'Đã xác thực', PUBLISHED: 'Đã xuất bản', ARCHIVED: 'Đã lưu trữ' }[status] ?? status);

export function orderedPatrolSteps(detail) {
  const steps = detail?.steps ?? [];
  const transitions = detail?.transitions ?? [];
  const issues = [];
  const ordered = [];
  if (!transitions.length) return { steps: [...steps].sort((a, b) => a.sequenceNo - b.sequenceNo), issues: ['Chưa có liên kết giữa các bước. Lưu quy trình dạng Tuyến tuần tra để tạo chuỗi thực thi.'] };
  let id = detail.workflow?.startStepId;
  const visited = new Set();
  while (id && !visited.has(id)) {
    const step = steps.find(item => item.stepId === id);
    if (!step) { issues.push('Bước bắt đầu hoặc bước kế tiếp không tồn tại.'); break; }
    visited.add(id); ordered.push(step);
    const next = transitions.filter(item => item.fromStepId === id && item.outcome === 'SUCCESS');
    if (next.length !== 1 || next[0].conditionJson != null || next[0].defaultTransition !== true) { issues.push('Tuyến có nhánh điều kiện, chưa thể mô phỏng như một chuỗi cố định.'); break; }
    if (!next[0].toStepId) {
      if (next[0].terminalStatus !== 'SUCCEEDED') issues.push('Tuyến chưa kết thúc bằng trạng thái thành công.');
      id = null; break;
    }
    id = next[0].toStepId;
  }
  if (id && visited.has(id)) issues.push('Tuyến có vòng lặp trong quy trình; chưa hỗ trợ mô phỏng.');
  if (ordered.length !== steps.length) issues.push('Có bước nằm ngoài chuỗi tuần tra hoặc chưa có bước bắt đầu.');
  return { steps: ordered, issues };
}

export function resolvePatrolRoute(detail, maps, endpoints) {
  const { steps, issues } = orderedPatrolSteps(detail);
  const workflow = detail.workflow;
  const points = steps.map(step => ({ step, mapId: step.paramsJson?.map_id, speed: Number(step.paramsJson?.max_speed_mps), endpoint: endpoints.find(item => item.endpointId === step.paramsJson?.endpoint_id) }));
  if (steps.length < 2 || steps.some(step => step.stepTypeCode !== 'MOVE' || step.enabled === false)) issues.push('Tuyến cần ít nhất hai bước Di chuyển đang bật.');
  if (steps.some(step => Object.keys(step.inputMappingJson ?? {}).length)) issues.push('Tuyến dùng tham số động; chưa thể xem trước bằng điểm đích cố định.');
  const ids = [...new Set(points.map(point => point.mapId))];
  const map = maps.find(item => item.mapId === ids[0]);
  if (ids.length !== 1 || !map) issues.push('Các điểm phải thuộc cùng một bản đồ có trong hệ thống.');
  if (points.some(point => !point.endpoint || point.endpoint.mapId !== point.mapId || point.endpoint.active === false || point.endpoint.accessible === false)) issues.push('Có điểm đích bị thiếu, ngừng sử dụng, không thể tiếp cận hoặc sai bản đồ.');
  if (points.some(point => !Number.isFinite(point.speed) || point.speed <= 0 || point.speed > .3 || !Number.isFinite(point.endpoint?.xM) || !Number.isFinite(point.endpoint?.yM))) issues.push('Tọa độ hoặc tốc độ di chuyển chưa hợp lệ.');
  const deploymentIssues = [...issues];
  if (workflow?.serviceType !== 'PATROL') deploymentIssues.push('Chọn loại “Tuyến tuần tra” trong Thiết kế quy trình rồi lưu.');
  if (workflow?.schemaVersion !== 3) deploymentIssues.push('Quy trình chưa dùng cấu hình tuần tra phiên bản 3.');
  if (workflow?.status !== 'PUBLISHED' || !workflow?.acceptsNewJobs) deploymentIssues.push('Cần xác thực và xuất bản phiên bản này trước khi lập lịch thật.');
  if (map?.status !== 'ACTIVE') deploymentIssues.push('Bản đồ chưa được kích hoạt.');
  return { workflow, points, map, mapId: map?.mapId, issues, deploymentIssues };
}

export function patrolRobotReady(robot, route) {
  return !!route && route.deploymentIssues.length === 0 && !!robot && robot.currentMapId === route.mapId && robot.status === 'IDLE' && (robot.capabilitiesJson ?? []).includes('MOVE');
}

export function buildPatrolGraph(tasks) {
  const all = tasks.flatMap(task => task.steps.map(step => ({ ...step, taskCode: task.code })));
  if (all.length < 2 || all.some(step => step.type !== 'MOVE' || step.enabled === false)) throw new Error('Tuyến tuần tra cần ít nhất 2 bước Di chuyển đang bật, không chứa loại bước khác.');
  if (new Set(all.map(step => step.values.map_id)).size !== 1 || all.some(step => typeof step.values.map_id !== 'string' || !step.values.map_id || typeof step.values.endpoint_id !== 'string' || !step.values.endpoint_id || Object.keys(step.inputMappingJson ?? {}).length)) throw new Error('Chọn điểm đích cố định trên cùng một bản đồ cho mọi bước.');
  if (all.some(step => !Number.isFinite(Number(step.values.max_speed_mps)) || Number(step.values.max_speed_mps) <= 0 || Number(step.values.max_speed_mps) > .3)) throw new Error('Tốc độ phải lớn hơn 0 và không quá 0,30 m/s.');
  const steps = all.map((step, index) => ({ taskCode: step.taskCode, stepType: 'MOVE', stepCode: step.code, stepName: step.name || `Điểm tuần tra ${index + 1}`, sequenceNo: index + 1, description: step.description ?? '', paramsJson: { ...step.values, mode: 'PATROL', max_speed_mps: Number(step.values.max_speed_mps) }, inputMappingJson: {}, timeoutSec: step.timeoutSec ?? 300, maxAttempts: step.maxAttempts ?? 1, retryDelaySec: step.retryDelaySec ?? 0, retryCodesJson: step.retryCodesJson ?? [], maxVisits: step.maxVisits ?? 1, auditLevel: step.auditLevel ?? 'BASIC' }));
  return { startStepCode: steps[0].stepCode, tasks: tasks.map((task, index) => ({ taskCode: task.code, taskName: task.name, sequenceNo: index + 1, description: task.description ?? '', configJson: task.configJson ?? {} })), steps, transitions: steps.flatMap((step, index) => ['SUCCESS', 'FAILURE', 'TIMEOUT'].map(outcome => ({ fromStepCode: step.stepCode, toStepCode: outcome === 'SUCCESS' ? steps[index + 1]?.stepCode ?? null : null, outcome, conditionJson: null, priority: 1, defaultTransition: true, terminalStatus: outcome === 'SUCCESS' ? (index === steps.length - 1 ? 'SUCCEEDED' : null) : 'RECOVERY_REQUIRED' }))) };
}

// Preview only: straight-line interpolation does not claim Nav2 path planning.
export function patrolPreview(points, elapsed = 0) {
  let duration = 0, distance = 0;
  const segments = points.slice(1).map((point, index) => {
    const from = points[index].endpoint, to = point.endpoint;
    const length = Math.hypot(to.xM - from.xM, to.yM - from.yM);
    const seconds = Math.max(length / point.speed, .1);
    const segment = { from, to, start: duration, seconds, index };
    distance += length; duration += seconds; return segment;
  });
  const segment = segments.find(item => elapsed < item.start + item.seconds) ?? segments.at(-1);
  const ratio = segment ? Math.max(0, Math.min(1, (elapsed - segment.start) / segment.seconds)) : 0;
  return { duration, distance, progress: duration ? Math.min(1, elapsed / duration) : 0, targetIndex: segment ? segment.index + 1 : 0, position: segment ? { xM: segment.from.xM + (segment.to.xM - segment.from.xM) * ratio, yM: segment.from.yM + (segment.to.yM - segment.from.yM) * ratio } : points[0]?.endpoint };
}
