import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const monitoringApi = {
  listDetections: (params) => apiRequest(query('/api/v1/admin/monitoring/detections', params)),
};
