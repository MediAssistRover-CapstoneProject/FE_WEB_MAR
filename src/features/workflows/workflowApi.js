import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const workflowApi = {
  list: (params) => apiRequest(query('/api/v1/admin/workflows', params)),
  get: (id) => apiRequest(`/api/v1/admin/workflows/${id}`),
  listPublished: params => apiRequest(query('/api/v1/workflows/published', params)),
  listStepTypes: () => apiRequest('/api/v1/workflows/step-types'),
  listMaps: params => apiRequest(query('/api/v1/maps', params)),
  listEndpoints: params => apiRequest(query('/api/v1/endpoints', params)),
  listRobots: params => apiRequest(query('/api/v1/robots', params)),
  listSchedules: params => apiRequest(query('/api/v1/schedules', params)),
  create: (body) => apiRequest('/api/v1/admin/workflows', { method: 'POST', body }),
  createGraph: (body) => apiRequest('/api/v1/admin/workflows/graph', { method: 'POST', body }),
  replaceGraph: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}/graph`, { method: 'PUT', body }),
  update: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}`, { method: 'PUT', body }),
  remove: (id) => apiRequest(`/api/v1/admin/workflows/${id}`, { method: 'DELETE' }),
  addTask: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}/tasks`, { method: 'POST', body }),
  updateTask: (id, taskId, body) => apiRequest(`/api/v1/admin/workflows/${id}/tasks/${taskId}`, { method: 'PUT', body }),
  deleteTask: (id, taskId) => apiRequest(`/api/v1/admin/workflows/${id}/tasks/${taskId}`, { method: 'DELETE' }),
  addStep: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}/steps`, { method: 'POST', body }),
  updateStep: (id, stepId, body) => apiRequest(`/api/v1/admin/workflows/${id}/steps/${stepId}`, { method: 'PUT', body }),
  deleteStep: (id, stepId) => apiRequest(`/api/v1/admin/workflows/${id}/steps/${stepId}`, { method: 'DELETE' }),
  addTransition: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}/transitions`, { method: 'POST', body }),
  validate: (id) => apiRequest(`/api/v1/admin/workflows/${id}/validate`, { method: 'POST' }),
  publish: (id) => apiRequest(`/api/v1/admin/workflows/${id}/publish`, { method: 'POST' }),
  archive: (id) => apiRequest(`/api/v1/admin/workflows/${id}/archive`, { method: 'POST' }),
  createSchedule: body => apiRequest('/api/v1/schedules', { method: 'POST', body }),
  activateSchedule: id => apiRequest(`/api/v1/schedules/${id}/activate`, { method: 'POST' }),
};

export function latestWorkflowVersions(workflows) {
  const latestByCode = new Map();
  for (const workflow of workflows ?? []) {
    const code = String(workflow.workflowCode ?? workflow.code ?? workflow.workflowId ?? workflow.id).toLowerCase();
    const current = latestByCode.get(code);
    if (!current || Number(workflow.versionNo ?? 0) > Number(current.versionNo ?? 0)) latestByCode.set(code, workflow);
  }
  return [...latestByCode.values()];
}
