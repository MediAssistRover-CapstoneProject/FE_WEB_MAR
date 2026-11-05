import { vi } from '../../i18n/vi.js';

export const ACTIVE_STATUSES = ['QUEUED', 'ACCEPTED', 'RUNNING'];
export const TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'CANCELLED'];
export const JOB_GROUPS = [
  { id: 'active', label: 'Đang hoạt động', statuses: ACTIVE_STATUSES },
  { id: 'attention', label: 'Cần xử lý', statuses: ['RECOVERY_REQUIRED'] },
  { id: 'history', label: 'Lịch sử', statuses: TERMINAL_STATUSES },
];

export const JOB_STATUS = {
  QUEUED: { label: 'Chờ điều phối', tone: 'waiting' },
  ACCEPTED: { label: 'Robot đã nhận', tone: 'running' },
  RUNNING: { label: 'Đang thực hiện', tone: 'running' },
  RECOVERY_REQUIRED: { label: 'Cần xử lý', tone: 'attention' },
  SUCCEEDED: { label: 'Thành công', tone: 'success' },
  FAILED: { label: 'Thất bại', tone: 'failed' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  PENDING: { label: 'Chưa thực hiện', tone: 'neutral' },
  RETRYING: { label: 'Đang thử lại', tone: 'waiting' },
  TIMED_OUT: { label: 'Quá thời gian chờ', tone: 'failed' },
  SKIPPED: { label: 'Đã bỏ qua', tone: 'neutral' },
};

export function statusInfo(status) {
  return JOB_STATUS[status] || { label: vi(status || 'Chưa có trạng thái'), tone: 'neutral' };
}

export function confirmationBlock(job, role, step, now = Date.now()) {
  if (job?.cancelRequestedAt || job?.cancelCommandId) return 'Đang chờ hủy. Không xác nhận thêm bước thực thi.';
  const input = step?.resolvedInputsJson || {};
  if (role !== 'ADMIN' && (input.actor === 'ADMIN' || input.required_role === 'ADMIN')) return 'Bước này cần quản trị viên xác nhận.';
  if (step?.stepTypeSnapshot !== 'AUTHENTICATE' && (!job?.beOrchestrated || job.schemaVersion !== 3)) return 'Phiên thực thi này không hỗ trợ xác nhận bước trên trang này.';
  if (step?.stepTypeSnapshot === 'AUTHENTICATE' && input.method && input.method !== 'STAFF_CONFIRMATION') return 'Bước này yêu cầu xác thực bằng phương thức khác, không dùng xác nhận nhân viên.';
  const started = Date.parse(step?.startedAt);
  if (job?.beOrchestrated && (!Number.isFinite(started) || !(step?.timeoutSecSnapshot > 0))) return 'Chưa có đủ thông tin thời hạn của bước. Làm mới để kiểm tra lại.';
  if (Number.isFinite(started) && step?.timeoutSecSnapshot > 0 && now >= started + step.timeoutSecSnapshot * 1000) return 'Bước đã vượt thời gian chờ theo dữ liệu hiển thị. Chờ máy chủ cập nhật kết quả, không xác nhận thêm.';
  return '';
}

export function allowedJobActions(job, role, step, now = Date.now()) {
  const operator = ['ADMIN', 'STAFF'].includes(role);
  const active = ACTIVE_STATUSES.includes(job?.status);
  return {
    cancel: operator && active && !job.cancelRequestedAt && !job.cancelCommandId,
    assignRobot: role === 'ADMIN' && job?.status === 'QUEUED' && !job.acceptedAt && !job.cancelRequestedAt && !job.cancelCommandId,
    assignStaff: role === 'ADMIN' && (active || job?.status === 'RECOVERY_REQUIRED'),
    recover: operator && job?.status === 'RECOVERY_REQUIRED',
    confirmStep: operator && job?.status === 'RUNNING' && step?.status === 'RUNNING'
      && ['AUTHENTICATE', 'HANDLE_PAYLOAD', 'INTERACT'].includes(step.stepTypeSnapshot)
      && step.resolvedInputsJson?.action !== 'SPEAK' && !confirmationBlock(job, role, step, now),
  };
}

export function operationSummary(job, step, now = Date.now()) {
  if (TERMINAL_STATUSES.includes(job.status) || job.status === 'RECOVERY_REQUIRED') return null;
  const since = value => { const at = Date.parse(value); return Number.isFinite(at) ? durationLabel(Math.max(0, (now - at) / 1000)) : null; };
  if (job.cancelRequestedAt || job.cancelCommandId) return { title: 'Đang chờ hủy', tone: 'waiting', message: 'Đã gửi yêu cầu hủy. Chờ kết quả từ máy chủ và robot; chưa xác nhận robot đã dừng.', elapsed: since(job.cancelRequestedAt) };
  if (job.status === 'QUEUED') return { title: 'Chờ điều phối', tone: 'waiting', message: job.robotId ? 'Đã phân robot, đang chờ tiếp nhận. Máy chủ kiểm tra điều kiện trước khi chạy.' : 'Chưa phân robot. Máy chủ sẽ điều phối khi có robot phù hợp.', elapsed: since(job.queuedAt) };
  if (job.status === 'ACCEPTED') return { title: 'Robot đã tiếp nhận', tone: 'running', message: 'Đang chờ máy chủ ghi nhận bắt đầu thực thi.', elapsed: since(job.acceptedAt) };
  if (job.status !== 'RUNNING') return null;
  const human = step?.status === 'RUNNING' && ['AUTHENTICATE', 'HANDLE_PAYLOAD', 'INTERACT'].includes(step.stepTypeSnapshot) && step.resolvedInputsJson?.action !== 'SPEAK';
  const started = Date.parse(step?.startedAt), overdue = Number.isFinite(started) && step.timeoutSecSnapshot > 0 && now >= started + step.timeoutSecSnapshot * 1000;
  return { title: overdue ? 'Bước đã vượt thời gian chờ' : human ? 'Chờ xác nhận bước' : 'Đang thực thi', tone: overdue || human ? 'waiting' : 'running', message: overdue ? 'Thời hạn hiển thị đã qua. Chờ trạng thái chính thức từ máy chủ.' : human ? 'Kiểm tra yêu cầu bên dưới và chỉ xác nhận sau khi hoàn thành thực tế.' : 'Theo dõi bước hiện tại và tín hiệu kết nối của robot.', elapsed: since(step?.startedAt || job.startedAt), timeout: step?.timeoutSecSnapshot > 0 ? durationLabel(step.timeoutSecSnapshot) : null };
}

// Only use evidence exposed by BE. HELLO journal contents and final eligibility
// are still validated by BE; this is a preliminary operator checklist.
export function recoveryPlan(detail, evidence) {
  const job = detail?.job, step = selectedStep(detail), blocked = [];
  const generic = { kind: 'job', key: 'POST /api/v1/jobs/{id}/reconcile', path: { id: job?.jobId }, blocked, evidenceTypes: [] };
  if (job?.status !== 'RECOVERY_REQUIRED') return { ...generic, blocked: ['Công việc không còn yêu cầu phục hồi.'] };
  if (!job.beOrchestrated) return generic;
  if (!evidence || evidence.jobId !== job.jobId || evidence.recoveryRequired !== true || !Array.isArray(evidence.commands)) return { ...generic, blocked: ['Chưa có bằng chứng phục hồi hợp lệ từ máy chủ.'] };
  const commands = evidence.commands;
  const closed = command => ['ABANDONED', 'RESOLVED_BY_STAFF'].includes(command.state) || (['COMPLETED', 'STOP_CONFIRMED'].includes(command.state) && command.physicalStopConfirmed === true) || (command.state === 'EXPIRED' && command.sendAttempts === 0);
  const unresolved = commands.filter(command => !closed(command));
  const command = commands.find(command => command.jobStepId === job.selectedJobStepId && command.commandType === 'EXECUTE_STEP');
  if (!unresolved.length) {
    // Mapping WAIT recovery has additional physical checks in the generic BE API.
    if (step?.resolvedInputsJson?.event_type === 'MAPPING_SAVE_REQUESTED') {
      const p = evidence.physicalUncertainty || {};
      if (!p.sessionOwned || !p.heartbeatFresh || !p.robotReportsIdle || p.activeOperationReported || p.mappingOpen) blocked.push('Dừng và đóng phiên tạo bản đồ tại robot; chờ kết nối mới và tín hiệu robot rảnh.');
    }
    return generic;
  }
  if (!step || !command || evidence.jobStepId !== step.jobStepId || !evidence.operationKey || command.state === 'RESOLVED_BY_STAFF') return { ...generic, blocked: ['Có lệnh chưa được giải quyết nhưng chưa xác định đúng bước hiện tại. Cần kiểm tra robot và nhật ký trước khi đối soát.'] };
  if (!command.commandId) blocked.push('Chưa có mã lệnh hợp lệ để đối soát.');
  if (unresolved.some(other => other.jobStepId !== step.jobStepId)) blocked.push('Còn lệnh thuộc bước khác chưa được giải quyết. Cần đối chiếu nhật ký tại robot trước.');
  const rejected = command.state === 'REJECTED' && command.sendAttempts === 1 && !command.acknowledgedAt && !step.startedAt && step.stepTypeSnapshot === 'MOVE' && step.errorCode === 'LOCALIZATION_NOT_READY';
  const physical = evidence.physicalUncertainty || {};
  if (!evidence.transportSessionId) blocked.push('Chưa có phiên kết nối để đối soát. Cần robot kết nối lại hoặc quản trị viên kiểm tra lệnh bị từ chối.');
  if (!rejected) {
    if (physical.sessionOwned !== true) blocked.push('Phiên kết nối robot chưa thuộc máy chủ hiện tại. Cần robot kết nối lại.');
    if (physical.heartbeatFresh !== true) blocked.push('Chưa có heartbeat còn hiệu lực. Kiểm tra kết nối robot.');
    if (physical.robotReportsIdle !== true) blocked.push('Robot chưa báo trạng thái rảnh. Kiểm tra robot trước khi đối soát.');
    if (physical.activeOperationReported !== false) blocked.push('Chưa xác nhận robot không còn thao tác đang chạy.');
    if (physical.mappingOpen !== false) blocked.push('Chưa xác nhận phiên tạo bản đồ đã đóng.');
  }
  const evidenceTypes = rejected ? ['COMMAND_NOT_ACCEPTED'] : [...(command.physicalStopConfirmed === true ? ['PI_STOP_CONFIRMED'] : []), ...(command.operatorReconciled === true ? ['STAFF_INSPECTED_STOP'] : [])];
  if (!evidenceTypes.length) blocked.push('Chưa có bằng chứng dừng được máy chủ ghi nhận. Kiểm tra và đối soát tại robot trước.');
  return { kind: 'operation', key: 'POST /api/v1/jobs/{jobId}/operations/{jobStepId}/reconcile', path: { jobId: job.jobId, jobStepId: step.jobStepId }, commandId: command.commandId, operationKey: evidence.operationKey, transportSessionId: evidence.transportSessionId, stepCode: step.stepCodeSnapshot, evidenceTypes, blocked };
}

export function recoveryIdentity(plan) {
  return JSON.stringify([plan.kind, plan.path, plan.commandId, plan.operationKey, plan.transportSessionId]);
}

// A REST response that began before an SSE update must not roll back the UI.
export function newerJob(previous, incoming) {
  if (!previous || previous.jobId !== incoming.jobId) return incoming;
  if (Number.isFinite(previous.rowVersion) && Number.isFinite(incoming.rowVersion)
    && previous.rowVersion > incoming.rowVersion) return previous;
  return incoming;
}

export function mergeJobDetail(previous, incoming) {
  if (!previous || previous.job.jobId !== incoming.job.jobId) return incoming;
  const job = newerJob(previous.job, incoming.job);
  const knownSteps = new Map((previous.steps || []).map(step => [step.jobStepId, step]));
  for (const step of incoming.steps || []) {
    const before = knownSteps.get(step.jobStepId);
    if (!before || !Number.isFinite(before.rowVersion) || !Number.isFinite(step.rowVersion) || step.rowVersion > before.rowVersion) knownSteps.set(step.jobStepId, step);
  }
  return { ...previous, ...incoming, job, steps: [...knownSteps.values()], tasks: job === previous.job && job !== incoming.job ? previous.tasks : incoming.tasks };
}

export function dataFreshness(receivedAt, now = Date.now(), failed = false) {
  const ageSeconds = receivedAt == null ? null : Math.max(0, Math.floor((now - receivedAt) / 1000));
  return { ageSeconds, stale: failed || ageSeconds == null || ageSeconds >= 45 };
}

export function assertJobAction(key, expected, fresh, role) {
  const job = fresh.job, step = selectedStep(fresh), allowed = allowedJobActions(job, role, step);
  if (job.jobId !== expected.job.jobId) throw Error('Công việc đã thay đổi. Đóng biểu mẫu và kiểm tra lại.');
  if (key.endsWith('/cancel') && !allowed.cancel) throw Error('Công việc không còn nhận yêu cầu hủy hoặc đã có yêu cầu đang chờ xử lý.');
  if (key.endsWith('/assign-robot') && !allowed.assignRobot) throw Error('Công việc không còn ở trạng thái cho phép phân robot.');
  if (key.endsWith('/assign-staff') && !allowed.assignStaff) throw Error('Công việc không còn ở trạng thái cho phép phân nhân viên.');
  if (key.endsWith('/reconcile') && !allowed.recover) throw Error('Công việc không còn yêu cầu phục hồi. Kiểm tra lại trạng thái mới.');
  if (key.endsWith('/responses') || key.endsWith('/auth-verifications')) {
    const before = selectedStep(expected);
    if (!allowed.confirmStep || !before || before.jobStepId !== step?.jobStepId || before.stepTypeSnapshot !== step.stepTypeSnapshot
      || before.attemptNo !== step.attemptNo || JSON.stringify(before.resolvedInputsJson) !== JSON.stringify(step.resolvedInputsJson)) {
      throw Error('Bước hoặc yêu cầu xác nhận đã thay đổi. Đóng biểu mẫu và kiểm tra bước hiện tại trước khi xác nhận lại.');
    }
  }
}

export function selectedStep(detail) {
  return detail?.steps?.find(step => step.jobStepId === detail.job?.selectedJobStepId);
}

export function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${total} giây`;
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), rest = total % 60;
  return [hours && `${hours} giờ`, minutes && `${minutes} phút`, rest && `${rest} giây`].filter(Boolean).join(' ');
}

const readableText = value => typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'string' ? value.trim() : null;
const errorExplanations = {
  ENDPOINT_DRIFT_DURING_ALIGNMENT: 'Robot báo lệch khỏi điểm đích trong lúc căn chỉnh vị trí.',
  LOCALIZATION_NOT_READY: 'Robot chưa xác định được vị trí đủ điều kiện để di chuyển.',
  STEP_TIMEOUT: 'Bước thực thi vượt quá thời gian chờ.',
  ROBOT_OFFLINE: 'Robot mất kết nối trong quá trình thực hiện.',
};

// Presentation whitelist: raw runtime inputs, journal identities and diagnostic
// JSON stay in the technical view, never in an operator's step summary.
export function stepSummary(step, catalogs = {}) {
  const input = step.resolvedInputsJson || {};
  const result = step.resultJson?.data || step.resultJson || {};
  const targetId = result.endpoint_id || result.endpointId || input.endpoint_id || input.destinationEndpointId || input.target_endpoint_id;
  const target = catalogs.endpoints?.find(endpoint => endpoint.endpointId === targetId);
  const start = Date.parse(step.startedAt), end = Date.parse(step.endedAt);
  const duration = Number.isFinite(start) && Number.isFinite(end) ? durationLabel((end - start) / 1000) : null;
  let outcome = readableText(result.summary) || readableText(result.message);
  if (!outcome && typeof result.reached === 'boolean') outcome = result.reached ? 'Robot báo đã đến điểm đích' : 'Robot chưa xác nhận đến điểm đích';
  if (!outcome && result.confirmed === true) outcome = 'Đã xác nhận thực hiện';
  if (!outcome && step.status === 'SUCCEEDED') outcome = 'Bước thực thi hoàn tất';
  const issue = ['FAILED', 'RECOVERY_REQUIRED'].includes(step.status)
    ? errorExplanations[step.errorCode] || readableText(step.errorDetailsJson?.message) || readableText(step.errorDetailsJson?.reason) || readableText(step.errorCode)
    : null;
  return {
    target: readableText(target?.endpointName) || target?.endpointCode || readableText(result.endpoint_name) || readableText(input.endpoint_name) || (targetId ? 'Chưa có tên điểm đến' : null),
    outcome, duration, issue,
    startedAt: Number.isFinite(start) ? step.startedAt : null,
    endedAt: Number.isFinite(end) ? step.endedAt : null,
    attempts: step.attemptNo > 1 ? step.attemptNo : null,
    timeout: ['RUNNING', 'PENDING', 'RETRYING'].includes(step.status) && step.timeoutSecSnapshot > 0 ? durationLabel(step.timeoutSecSnapshot) : null,
    interruption: readableText(step.interruptionReason),
    interruptedAt: readableText(step.interruptionReason) && Number.isFinite(Date.parse(step.interruptionRequestedAt)) ? step.interruptionRequestedAt : null,
    instruction: ['INTERACT', 'HANDLE_PAYLOAD', 'AUTHENTICATE'].includes(step.stepTypeSnapshot) ? readableText(input.message) || readableText(input.text) : null,
  };
}

export function jobPresentation(job, catalogs = {}) {
  const requestRecord = catalogs.requests?.find(row => (row.request?.serviceRequestId || row.serviceRequestId) === job.serviceRequestId);
  const request = requestRecord?.request || requestRecord;
  const workflow = catalogs.workflows?.find(row => row.workflowId === job.workflowId);
  const robot = catalogs.robots?.find(row => row.robotId === job.robotId);
  const input = { ...request?.requestDataJson, ...job.inputJson };
  const targetId = input.destinationEndpointId || input.deliveryEndpointId || input.endpointId || input.target_endpoint_id || input.endpoint_id;
  const target = catalogs.endpoints?.find(row => row.endpointId === targetId);
  const targetName = readableText(target?.endpointName) || readableText(input.destinationName) || readableText(input.deliveryRoomName) || input.destinationRoomName;
  const type = request?.requestType || workflow?.serviceType || input.requestType;
  const typeLabel = type && vi(type);
  return {
    title: readableText(workflow?.workflowName) || readableText(job.workflowName) || (typeLabel && typeLabel !== type ? typeLabel : null) || `Công việc ${job.jobCode?.slice(-6) || job.jobId?.slice(0, 8) || ''}`,
    robot: readableText(robot?.robotName) || readableText(robot?.robotCode) || (job.robotId ? `Robot · ${job.robotId.slice(0, 8)}` : 'Chưa phân robot'),
    target: targetName || (targetId ? `Điểm đến · ${targetId.slice(0, 8)}` : null),
    workflow: readableText(workflow?.workflowName) || (job.workflowId ? `Quy trình · ${job.workflowId.slice(0, 8)}` : 'Chưa có thông tin'),
    requestCode: request?.requestCode,
  };
}

export function jobProblem(detail) {
  if (!detail?.job) return null;
  const job = detail.job;
  if (!['FAILED', 'RECOVERY_REQUIRED'].includes(job.status)) return null;
  const orderedSteps = [...(detail.steps || [])].sort((a, b) => (a.executionSequenceNo || 0) - (b.executionSequenceNo || 0));
  const failedStep = [...orderedSteps].reverse().find(step => ['FAILED', 'RECOVERY_REQUIRED'].includes(step.status));
  const code = job.errorCode || failedStep?.errorCode;
  if (!code && !job.failureReason && !['FAILED', 'RECOVERY_REQUIRED'].includes(job.status)) return null;
  return {
    code,
    step: failedStep?.stepCodeSnapshot,
    stepId: failedStep?.jobStepId,
    stepNumber: failedStep ? orderedSteps.indexOf(failedStep) + 1 : null,
    stepName: failedStep?.stepTypeSnapshot ? vi(failedStep.stepTypeSnapshot) : 'Thực thi',
    message: errorExplanations[code] || job.failureReason || 'Công việc chưa hoàn thành. Xem bước lỗi và nhật ký để xác định nguyên nhân.',
    recovery: job.status === 'RECOVERY_REQUIRED',
  };
}

export function filterJobs(jobs, { group = 'active', search = '', status = '', robotId = '', workflowId = '', from = '', to = '' }, catalogs) {
  const statuses = JOB_GROUPS.find(item => item.id === group)?.statuses || [];
  const needle = search.trim().toLocaleLowerCase('vi');
  const start = from ? Date.parse(`${from}T00:00:00`) : null;
  const end = to ? Date.parse(`${to}T23:59:59.999`) : null;
  return jobs.filter(job => statuses.includes(job.status) && (!status || job.status === status) && (!robotId || job.robotId === robotId)
    && (!workflowId || job.workflowId === workflowId)
    && (start == null || Date.parse(job.queuedAt) >= start) && (end == null || Date.parse(job.queuedAt) <= end))
    .filter(job => {
      if (!needle) return true;
      const info = jobPresentation(job, catalogs);
      return [info.title, info.robot, info.target, info.requestCode, job.jobCode].filter(Boolean).join(' ').toLocaleLowerCase('vi').includes(needle);
    })
    .sort((a, b) => (Date.parse(b.queuedAt) || 0) - (Date.parse(a.queuedAt) || 0));
}
