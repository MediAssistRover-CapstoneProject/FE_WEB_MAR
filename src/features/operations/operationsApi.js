import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const operationsApi = {
  listJobs: (params) => apiRequest(query('/api/v1/jobs', params)),
  getJob: (id) => apiRequest(`/api/v1/jobs/${id}`),
  listJobEvents: (id, params) => apiRequest(query(`/api/v1/jobs/${id}/events`, params)),
  cancelJob: (id, reason) => apiRequest(`/api/v1/jobs/${id}/cancel`, { method: 'POST', body: { reason } }),
  assignRobot: (id, robotId) => apiRequest(`/api/v1/jobs/${id}/assign-robot`, { method: 'POST', body: { robotId } }),
  listRequests: (params) => apiRequest(query('/api/v1/service-requests', params)),
  submitRequest: (id) => apiRequest(`/api/v1/service-requests/${id}/submit`, { method: 'POST' }),
  cancelRequest: (id, reason) => apiRequest(`/api/v1/service-requests/${id}/cancel`, { method: 'POST', body: { reason } }),
  listSchedules: (params) => apiRequest(query('/api/v1/schedules', params)),
  activateSchedule: (id) => apiRequest(`/api/v1/schedules/${id}/activate`, { method: 'POST' }),
  pauseSchedule: (id) => apiRequest(`/api/v1/schedules/${id}/pause`, { method: 'POST' }),
  retireSchedule: (id) => apiRequest(`/api/v1/schedules/${id}/retire`, { method: 'POST' }),
  listIncidents: (params) => apiRequest(query('/api/v1/emergency-incidents', params)),
  acknowledgeIncident: (id) => apiRequest(`/api/v1/emergency-incidents/${id}/acknowledge`, { method: 'POST' }),
  startIncident: (id) => apiRequest(`/api/v1/emergency-incidents/${id}/start`, { method: 'POST' }),
  resolveIncident: (id, resolutionNote) => apiRequest(`/api/v1/emergency-incidents/${id}/resolve`, { method: 'POST', body: { resolutionNote } }),
  closeIncident: (id) => apiRequest(`/api/v1/emergency-incidents/${id}/close`, { method: 'POST' }),
};
