import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const adminApi = {
  listStaff: (params) => apiRequest(query('/api/v1/admin/staff', params)),
  createStaff: (body) => apiRequest('/api/v1/admin/staff', { method: 'POST', body }),
  updateStaff: (id, body) => apiRequest(`/api/v1/admin/staff/${id}`, { method: 'PUT', body }),
  deactivateStaff: (id) => apiRequest(`/api/v1/admin/staff/${id}`, { method: 'DELETE' }),
  lockAccount: (id) => apiRequest(`/api/v1/admin/accounts/${id}/lock`, { method: 'POST' }),
  unlockAccount: (id) => apiRequest(`/api/v1/admin/accounts/${id}/unlock`, { method: 'POST' }),
  resetAccountPassword: (id, newPassword) => apiRequest(`/api/v1/admin/accounts/${id}/reset-password`, { method: 'POST', body: { newPassword } }),
  listSettings: (params) => apiRequest(query('/api/v1/admin/system-settings', params)),
  createSetting: (body) => apiRequest('/api/v1/admin/system-settings', { method: 'POST', body }),
  updateSetting: (id, body) => apiRequest(`/api/v1/admin/system-settings/${id}`, { method: 'PUT', body }),
  deleteSetting: (id) => apiRequest(`/api/v1/admin/system-settings/${id}`, { method: 'DELETE' }),
  listAuditLogs: (params) => apiRequest(query('/api/v1/admin/audit-logs', params)),
  getOverview: () => apiRequest('/api/v1/admin/reports/overview'),
};
