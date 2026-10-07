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
  validate: (id) => apiRequest(`/api/v1/admin/workflows/${id}/validate`, { method: 'POST' }),
  publish: (id) => apiRequest(`/api/v1/admin/workflows/${id}/publish`, { method: 'POST' }),
  archive: (id) => apiRequest(`/api/v1/admin/workflows/${id}/archive`, { method: 'POST' }),
};
