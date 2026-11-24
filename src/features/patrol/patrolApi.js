import { apiRequest } from '../api/client.js';

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
  getWorkflow: (id, options) => apiRequest(query(`/api/v1/admin/workflows/${resource(id)}`, { includeDeleted: true }), options),
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
