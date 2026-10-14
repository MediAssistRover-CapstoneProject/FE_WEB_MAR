import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const reportsApi = {
  getAnalytics: (params) => apiRequest(query('/api/v1/admin/reports/analytics', params)),
  listJobs: (params) => apiRequest(query('/api/v1/admin/reports/jobs', params)),
  exportJobsCsv: (params) => apiRequest(query('/api/v1/admin/reports/jobs/export.csv', params), { headers: { Accept: 'text/csv' } }),
};
