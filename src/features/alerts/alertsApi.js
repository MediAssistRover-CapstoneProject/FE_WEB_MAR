import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const alertsApi = {
  list: (params) => apiRequest(query('/api/v1/alerts', params)),
  get: (id) => apiRequest(`/api/v1/alerts/${id}`),
  acknowledge: (id) => apiRequest(`/api/v1/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolve: (id) => apiRequest(`/api/v1/alerts/${id}/resolve`, { method: 'POST' }),
  close: (id) => apiRequest(`/api/v1/alerts/${id}/close`, { method: 'POST' }),
};
