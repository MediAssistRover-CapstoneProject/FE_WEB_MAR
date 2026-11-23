import { orderedPatrolSteps } from '../workflows/patrolWorkflowModel.js';

export const OPEN_PATROL_STATUSES = new Set(['QUEUED', 'ACCEPTED', 'RUNNING', 'SUSPENDING', 'SUSPENDED', 'RECOVERY_REQUIRED']);
export const PATROL_STATUS = {
  QUEUED: { label: 'Đang chờ', tone: 'neutral' },
  ACCEPTED: { label: 'Robot đã nhận', tone: 'blue' },
  RUNNING: { label: 'Đang tuần tra', tone: 'green' },
  SUSPENDING: { label: 'Đang dừng an toàn', tone: 'amber' },
  SUSPENDED: { label: 'Đang tạm dừng', tone: 'amber' },
  RECOVERY_REQUIRED: { label: 'Cần kiểm tra', tone: 'red' },
  SUCCEEDED: { label: 'Đã hoàn thành', tone: 'green' },
  FAILED: { label: 'Không hoàn thành', tone: 'red' },
  CANCELLED: { label: 'Đã kết thúc', tone: 'neutral' },
};

export const SENSING_OPTIONS = [
  { value: 'CROWD_DENSITY', label: 'Mật độ người', description: 'Quan sát mật độ trong vùng đã cấu hình.' },
  { value: 'RESTRICTED_ZONE', label: 'Khu vực hạn chế', description: 'Quan sát vùng cấm đã cấu hình.' },
  { value: 'PATROL_FALL', label: 'Phát hiện ngã', description: 'Cần robot hỗ trợ PATROL_FALL; máy chủ kiểm tra khi chạy.' },
];

export const HOLD_LABELS = {
  MANUAL: 'Người vận hành tạm dừng',
  VOICE: 'Đang giao tiếp với bệnh nhân',
  MEDIA: 'Đang hỗ trợ qua cuộc gọi',
  INCIDENT: 'Đang xử lý SOS',
  JOB: 'Đang thực hiện nhiệm vụ ưu tiên',
};

export const isPatrolWorkflow = workflow => workflow?.serviceType === 'PATROL';
export const isManagedPatrol = workflow => isPatrolWorkflow(workflow) && String(workflow.workflowCode ?? '').startsWith('WF_PATROL_');
export const jobStopPending = job => ['PENDING', 'RECOVERY_REQUIRED'].includes(job?.stopStatus) || Boolean(job?.cancelRequestedAt && OPEN_PATROL_STATUSES.has(job.status) && !['CONFIRMED', 'NOT_REQUIRED'].includes(job.stopStatus));
export const jobStatus = job => jobStopPending(job) ? { label: job.stopStatus === 'RECOVERY_REQUIRED' ? 'Cần xác nhận dừng' : 'Đang chờ kết thúc an toàn', tone: job.stopStatus === 'RECOVERY_REQUIRED' ? 'red' : 'amber' } : PATROL_STATUS[job?.status] ?? { label: job?.status || 'Chưa xác định', tone: 'neutral' };

export function patrolRoute(detail, endpoints = []) {
  const workflow = detail?.workflow ?? detail ?? null;
  const { steps, issues } = detail?.steps ? orderedPatrolSteps(detail) : { steps: [], issues: [] };
  const checkpoints = steps.flatMap((step, index) => {
    if (step.stepTypeCode !== 'MOVE') return [];
    const params = step.paramsJson ?? {};
    const sensing = steps[index + 1]?.stepTypeCode === 'EXECUTE_SENSING' ? steps[index + 1].paramsJson ?? {} : {};
    return [{
      index: steps.slice(0, index).filter(item => item.stepTypeCode === 'MOVE').length + 1,
      stepId: step.stepId,
      endpointId: params.endpoint_id,
      endpoint: endpoints.find(item => item.endpointId === params.endpoint_id) ?? null,
      mapId: params.map_id,
      maxSpeedMps: params.max_speed_mps,
      zoneId: sensing.zone_id ?? null,
      sensingType: sensing.sensing_type ?? null,
      fallDetection: sensing.fall_detection === true || sensing.sensing_type === 'PATROL_FALL',
      windowSec: sensing.window_sec ?? null,
    }];
  });
  const mapId = workflow?.defaultInputsJson?.map_id ?? checkpoints[0]?.mapId ?? null;
  const repeatCount = workflow?.defaultInputsJson?.patrol_repeat_count ?? 1;
  if (detail?.steps && checkpoints.length === 0) issues.push('Quy trình chưa có điểm tuần tra cố định.');
  if (checkpoints.some(point => point.mapId !== mapId)) issues.push('Các điểm tuần tra thuộc nhiều bản đồ.');
  if (checkpoints.some(point => !point.endpointId)) issues.push('Có bước di chuyển chưa có điểm đến cố định.');
  for (const point of checkpoints) {
    const endpoint = point.endpoint;
    if (!endpoint || endpoint.mapId !== mapId || endpoint.active !== true || endpoint.accessible !== true || endpoint.yawRad == null || !Number.isFinite(Number(endpoint.yawRad))) issues.push(`Điểm ${point.index} không còn khả dụng, sai bản đồ hoặc chưa có hướng di chuyển.`);
  }
  if (!Number.isInteger(repeatCount) || repeatCount < 0 || repeatCount > 1000) issues.push('Số vòng tuần tra chưa hợp lệ.');
  return {
    workflow, mapId, repeatCount, continuous: repeatCount === 0, checkpoints, issues,
    managed: isManagedPatrol(workflow),
    published: workflow?.status === 'PUBLISHED' && workflow?.acceptsNewJobs === true,
  };
}

export function patrolDraftErrors(draft, { maps = [], endpoints = [], zones = [] } = {}) {
  const errors = [];
  if (!draft?.name?.trim() || draft.name.trim().length > 160) errors.push('Đặt tên tuyến từ 1 đến 160 ký tự.');
  if (!maps.some(map => map.mapId === draft?.mapId && map.status === 'ACTIVE')) errors.push('Chọn một bản đồ đang hoạt động.');
  const points = draft?.checkpoints ?? [];
  if (points.length < 1 || points.length > 5) errors.push('Chọn từ 1 đến 5 điểm theo thứ tự tuần tra.');
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const endpoint = endpoints.find(item => item.endpointId === point.endpointId);
    if (!endpoint || endpoint.mapId !== draft.mapId || !endpoint.active || !endpoint.accessible || endpoint.yawRad == null) errors.push(`Điểm ${index + 1} cần khả dụng, có hướng và thuộc bản đồ đã chọn.`);
    if (!SENSING_OPTIONS.some(option => option.value === point.sensingType)) errors.push(`Chọn cách quan sát cho điểm ${index + 1}.`);
    else if (point.sensingType === 'PATROL_FALL') {
      if (point.zoneId) errors.push(`Điểm ${index + 1} phát hiện ngã không dùng vùng quan sát.`);
    } else {
      const zone = zones.find(item => item.zoneId === point.zoneId);
      if (!zone || !zone.active || zone.mapId !== draft.mapId || (point.sensingType === 'RESTRICTED_ZONE' && zone.zoneType !== 'KEEP_OUT')) errors.push(`Chọn vùng quan sát hợp lệ cho điểm ${index + 1}.`);
    }
  }
  const repeats = draft?.repeatCount;
  const missingRepeats = repeats == null || (typeof repeats === 'string' && repeats.trim() === '');
  if (missingRepeats || !Number.isInteger(Number(repeats)) || Number(repeats) < 0 || Number(repeats) > 1000) errors.push('Số vòng phải từ 1 đến 1000; chọn 0 để lặp liên tục.');
  if (draft?.maxSpeedMps != null && (!Number.isFinite(Number(draft.maxSpeedMps)) || Number(draft.maxSpeedMps) < .05 || Number(draft.maxSpeedMps) > .6)) errors.push('Tốc độ phải từ 0,05 đến 0,60 m/s.');
  if (draft?.moveTimeoutSec != null && (!Number.isInteger(Number(draft.moveTimeoutSec)) || Number(draft.moveTimeoutSec) < 15 || Number(draft.moveTimeoutSec) > 120)) errors.push('Thời gian di chuyển tối đa phải từ 15 đến 120 giây.');
  const window = draft?.sensingWindowSec == null ? 12 : Number(draft.sensingWindowSec);
  const fall = draft?.fallDetection === true || points.some(point => point.sensingType === 'PATROL_FALL');
  if (!Number.isInteger(window) || window < (fall ? 3 : 1) || window > 30) errors.push(`Thời gian quan sát phải từ ${fall ? 3 : 1} đến 30 giây.`);
  return errors;
}

export function newPatrolDispatch(workflow, robotId, id, now = new Date()) {
  if (!isManagedPatrol(workflow) || workflow.status !== 'PUBLISHED' || !workflow.acceptsNewJobs) throw new Error('Chọn tuyến tuần tra đã xuất bản và đang nhận nhiệm vụ mới.');
  if (!robotId || !id) throw new Error('Chọn robot và tạo mã điều phối trước khi bắt đầu.');
  const code = `PATROL_${id}`;
  return { code, workflowName: workflow.workflowName, createdAt: now.toISOString(), body: {
    workflowId: workflow.workflowId, robotId, scheduleCode: code,
    scheduleName: `${String(workflow.workflowName ?? 'Tuần tra').slice(0, 140)} · Tuần tra`,
    scheduleType: 'ONCE', timezone: 'Asia/Ho_Chi_Minh', startsAt: now.toISOString(),
    inputTemplateJson: {}, priority: 0, misfirePolicy: 'FIRE_ONCE',
  } };
}

// This is a conservative screen check. AI profiles, map hashes, navigation and
// source holds are authoritative on the server at dispatch time.
export function patrolReadiness(robot, snapshot, route, { jobs = [], now = Date.now() } = {}) {
  const reasons = [];
  if (!route?.managed) reasons.push('Tuyến này cần được tạo bằng cấu hình tuần tra mới.');
  if (!route?.published) reasons.push('Tuyến chưa xuất bản hoặc đã ngừng nhận nhiệm vụ.');
  if (route?.issues?.length) reasons.push(...route.issues);
  if (!robot) reasons.push('Chọn robot thực hiện tuần tra.');
  else {
    const currentRobot = snapshot?.robot?.robotId === robot.robotId ? snapshot.robot : robot;
    if (currentRobot.status !== 'IDLE') reasons.push('Robot chưa ở trạng thái nghỉ.');
    if (currentRobot.currentMapId !== route?.mapId) reasons.push('Robot chưa sử dụng bản đồ của tuyến.');
    if (!snapshot || snapshot.robot?.robotId !== robot.robotId) reasons.push('Chưa có trạng thái kết nối mới của robot.');
    else {
      const observedAt = Date.parse(snapshot.observedAt);
      if (!Number.isFinite(observedAt) || now - observedAt > 20000) reasons.push('Trạng thái robot đã cũ; hãy tải lại.');
      if (!snapshot.mqttConnected || !snapshot.heartbeatFresh || !snapshot.dispatchReady) reasons.push('Kết nối robot chưa sẵn sàng.');
      if (Object.hasOwn(snapshot, 'navigationSession')) {
        const navigation = snapshot.navigationSession;
        if (navigation?.state !== 'READY') reasons.push('Phiên điều hướng chưa sẵn sàng; mở điều hướng và định vị robot trước khi tuần tra.');
        else if (navigation.mapId !== route?.mapId || (navigation.mapAssetHash && currentRobot.mapAssetHash && navigation.mapAssetHash.toLowerCase() !== currentRobot.mapAssetHash.toLowerCase())) reasons.push('Phiên điều hướng chưa khớp bản đồ của tuyến.');
      }
      if (snapshot.activeJobId || snapshot.suspendedPatrolJobIds?.length || jobs.some(job => job.robotId === robot.robotId && (OPEN_PATROL_STATUSES.has(job.status) || jobStopPending(job)))) reasons.push('Robot đang có nhiệm vụ chưa kết thúc.');
    }
  }
  return { blocked: reasons.length > 0, reasons: [...new Set(reasons)], note: 'Máy chủ sẽ kiểm tra bản đồ, định vị và cấu hình quan sát trước khi giao nhiệm vụ.' };
}

export function patrolHoldSummary(patrol) {
  const holds = patrol?.holds ?? [];
  return {
    labels: [...new Set(holds.map(hold => HOLD_LABELS[hold.source] ?? 'Đang chờ xử lý công việc khác'))],
    manual: holds.some(hold => hold.source === 'MANUAL'),
    external: holds.some(hold => hold.source !== 'MANUAL'),
    resumeRequested: patrol?.resumeRequested === true,
    blockedReason: patrol?.resumeBlockedReason ?? null,
    description: holds.length ? 'Tuần tra tiếp tục khi tất cả công việc ưu tiên kết thúc và robot đủ điều kiện.' : patrol?.resumeRequested ? 'Đã yêu cầu tiếp tục. Đang chờ robot đủ điều kiện.' : '',
  };
}
