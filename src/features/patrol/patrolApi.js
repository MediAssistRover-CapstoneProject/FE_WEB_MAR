import { apiRequest } from '../api/client.js';
import { isPatrolWorkflow, patrolTemplateCount } from './patrolModel.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

const resource = id => encodeURIComponent(id);
const post = (path, body, options) => apiRequest(path, { ...options, method: 'POST', body, retry: false });

// Keep signals on reads and do not replay control requests after authentication
// recovery: the operator must first inspect the server's current state.
export const patrolApi = {
  listWorkflows: (params, options) => apiRequest(query('/api/v1/admin/workflows', params), options),
  listPublished: (params, options) => apiRequest(query('/api/v1/workflows/published', { ...params, serviceType: 'PATROL' }), options),
  getWorkflow: (id, options) => apiRequest(`/api/v1/workflows/published/${resource(id)}`, options),
  previewWorkflow: (body, options) => post('/api/v1/admin/patrol-workflows/preview', body, options),
  createWorkflow: (body, options) => post('/api/v1/admin/patrol-workflows', body, options),
  listTemplates: options => apiRequest('/api/v1/admin/patrol-workflows/templates', options),
  prepareTemplate: (checkpointCount, options) => post('/api/v1/admin/patrol-workflows/templates', { checkpointCount }, options),
  createJob: (workflowId, body, key, options) => post(`/api/v1/workflows/${resource(workflowId)}/jobs`, body, { ...options, headers: { ...options?.headers, 'Idempotency-Key': key } }),
  findJob: (workflowId, key, options) => apiRequest(query(`/api/v1/workflows/${resource(workflowId)}/jobs/by-idempotency-key`, { key }), options),
  listJobs: (params, options) => apiRequest(query('/api/v1/jobs', params), options),
  getJob: (id, options) => apiRequest(query(`/api/v1/jobs/${resource(id)}`, { includeDeleted: true }), options),
  listJobEvents: (id, params, options) => apiRequest(query(`/api/v1/jobs/${resource(id)}/events`, params), options),
  suspendJob: (id, reason, options) => post(`/api/v1/jobs/${resource(id)}/suspend`, { reason }, options),
  resumeJob: (id, reason, options) => post(`/api/v1/jobs/${resource(id)}/resume`, { reason }, options),
  cancelJob: (id, reason, options) => post(`/api/v1/jobs/${resource(id)}/cancel`, { reason }, options),
  listRobots: (params, options) => apiRequest(query('/api/v1/robots', params), options),
  getRobotSnapshot: (id, options) => apiRequest(`/api/v1/robots/${resource(id)}/snapshot`, options),
  listSchedules: (params, options) => apiRequest(query('/api/v1/schedules', params), options),
  // ONCE schedules become RETIRED after their scheduler occurrence, even if no
  // job was admitted. Retain those records when observing/recovering dispatch.
  getSchedule: (id, options) => apiRequest(query(`/api/v1/schedules/${resource(id)}`, { includeDeleted: true }), options),
  createSchedule: (body, options) => post('/api/v1/schedules', body, options),
  activateSchedule: (id, options) => post(`/api/v1/schedules/${resource(id)}/activate`, undefined, options),
  pauseSchedule: (id, options) => post(`/api/v1/schedules/${resource(id)}/pause`, undefined, options),
  retireSchedule: (id, reason, options) => post(`/api/v1/schedules/${resource(id)}/retire`, { reason }, options),
  async findSchedule(code, options) {
    return (await allPatrolPages(params => patrolApi.listSchedules({ ...params, includeDeleted: true }, options))).find(item => item.scheduleCode === code) ?? null;
  },
};

export const patrolDispatchApi = {
  get: patrolApi.getSchedule,
  find: patrolApi.findSchedule,
  create: patrolApi.createSchedule,
  activate: patrolApi.activateSchedule,
};

export async function createPatrolJob(attempt, saveAttempt) {
  let job;
  try {
    job = await patrolApi.createJob(attempt.workflowId, attempt.body, attempt.key);
  } catch (error) {
    // Invalid inputs or a rejected navigation session require a newly configured run.
    if ([400, 422].includes(error.status)) saveAttempt(null);
    throw error;
  }
  if (!job?.jobId) throw new Error('Chưa nhận được mã nhiệm vụ. Hãy kiểm tra lại cùng lượt gửi.');
  return job;
}

export async function loadPatrolWorkflows(options, includeTemplates = true) {
  const [summaries, definitions, templateList] = await Promise.allSettled([
    allPatrolPages(patrolApi.listPublished, options),
    allPatrolPages((params, config) => patrolApi.listWorkflows({ ...params, includeDeleted: true }, config), options),
    includeTemplates ? patrolApi.listTemplates(options) : [],
  ]);
  if (summaries.status === 'rejected') throw summaries.reason;

  const metadataMissing = definitions.status === 'rejected';
  const all = metadataMissing ? [] : definitions.value;
  const byId = new Map(all.filter(isPatrolWorkflow).map(item => [item.workflowId, item]));
  const ready = new Map();
  for (const summary of summaries.value) {
    if (isPatrolWorkflow(summary) && summary.workflowId) {
      ready.set(summary.workflowId, { ...byId.get(summary.workflowId), ...summary, status: 'PUBLISHED', acceptsNewJobs: true });
    }
  }

  // The template endpoint lists supported sizes even before their workflows exist.
  const templates = Array.isArray(templateList.value) ? templateList.value.filter(item =>
    Number.isInteger(item?.checkpointCount) && item.checkpointCount >= 3 && item.checkpointCount <= 11
  ) : [];
  for (const item of templates) {
    if (!item.workflowId || item.available !== true) continue;
    const workflow = ready.get(item.workflowId) || byId.get(item.workflowId);
    ready.set(item.workflowId, {
      workflowName: `Tuần tra ${item.checkpointCount} điểm`, ...workflow,
      workflowId: item.workflowId, serviceType: 'PATROL', status: 'PUBLISHED', acceptsNewJobs: true,
      inputUiJson: { ...workflow?.inputUiJson, patrol_template: { version: 1, checkpointCount: item.checkpointCount } },
    });
  }
  for (const [id, workflow] of ready) byId.set(id, workflow);
  const published = [...ready.values()].sort((a, b) =>
    Number(!!patrolTemplateCount(a)) - Number(!!patrolTemplateCount(b)) || a.workflowName.localeCompare(b.workflowName, 'vi', { numeric: true })
  );
  const unavailable = templateList.status === 'rejected' ? ![404, 405].includes(templateList.reason.status) : !Array.isArray(templateList.value);
  const templateError = unavailable
    ? 'Chưa tải được danh sách mẫu theo số điểm.' : '';
  return { workflows: [...byId.values()], published, templates, templateError, metadataMissing };
}

// Never treat a malformed or truncated page as a complete catalog.
export async function allPatrolPages(list, options = {}) {
  const items = [];
  for (let page = 0; page < 1000; page += 1) {
    const response = await list({ page, size: 100 }, options);
    if (!Array.isArray(response?.content)) throw new Error('Máy chủ trả danh sách tuần tra không đúng định dạng.');
    items.push(...response.content);
    if (response.last === true || (Number.isInteger(response.totalPages) && page + 1 >= response.totalPages)) return items;
    if (response.content.length === 0 || (response.last === undefined && response.totalPages === undefined && response.content.length < 100)) return items;
  }
  throw new Error('Danh sách tuần tra quá lớn. Hãy thu hẹp dữ liệu trên máy chủ.');
}
