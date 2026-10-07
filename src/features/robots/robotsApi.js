import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const robotsApi = {
  list: (params) => apiRequest(query('/api/v1/robots', params)),
  get: (id) => apiRequest(`/api/v1/robots/${id}`),
  maintenance: (id, reason) => apiRequest(`/api/v1/robots/${id}/maintenance`, { method: 'POST', body: { reason } }),
  reconcile: (id, reason) => apiRequest(`/api/v1/robots/${id}/reconcile`, { method: 'POST', body: { reason } }),
  statusHistory: (id, params) => apiRequest(query(`/api/v1/robots/${id}/status-history`, params)),
  locationHistory: (id, params) => apiRequest(query(`/api/v1/robots/${id}/location-history`, params)),
};
