import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const workflowApi = {
  list: (params) => apiRequest(query('/api/v1/admin/workflows', params)),
  get: (id) => apiRequest(`/api/v1/admin/workflows/${id}`),
  listPublished: () => apiRequest('/api/v1/admin/workflows/published/all'),
  listStepTypes: () => apiRequest('/api/v1/admin/workflows/step-types'),
  create: (body) => apiRequest('/api/v1/admin/workflows', { method: 'POST', body }),
  update: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}`, { method: 'PUT', body }),
  remove: (id) => apiRequest(`/api/v1/admin/workflows/${id}`, { method: 'DELETE' }),
  addTask: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}/tasks`, { method: 'POST', body }),
  updateTask: (id, taskId, body) => apiRequest(`/api/v1/admin/workflows/${id}/tasks/${taskId}`, { method: 'PUT', body }),
  deleteTask: (id, taskId) => apiRequest(`/api/v1/admin/workflows/${id}/tasks/${taskId}`, { method: 'DELETE' }),
  addStep: (id, body) => apiRequest(`/api/v1/admin/workflows/${id}/steps`, { method: 'POST', body }),
  updateStep: (id, stepId, body) => apiRequest(`/api/v1/admin/workflows/${id}/steps/${stepId}`, { method: 'PUT', body }),
  deleteStep: (id, stepId) => apiRequest(`/api/v1/admin/workflows/${id}/steps/${stepId}`, { method: 'DELETE' }),
  validate: (id) => apiRequest(`/api/v1/admin/workflows/${id}/validate`, { method: 'POST' }),
  publish: (id) => apiRequest(`/api/v1/admin/workflows/${id}/publish`, { method: 'POST' }),
  archive: (id) => apiRequest(`/api/v1/admin/workflows/${id}/archive`, { method: 'POST' }),
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
