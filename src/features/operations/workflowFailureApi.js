import { apiRequest } from '../api/client.js';

const path = id => `/api/v1/jobs/${encodeURIComponent(id)}/failure-handling`;
export const workflowFailureApi = {
  get: (id, signal) => apiRequest(path(id), { signal }),
  acknowledge: id => apiRequest(`${path(id)}/acknowledge`, { method: 'POST' }),
  escalate: (id, note) => apiRequest(`${path(id)}/escalate`, { method: 'POST', body: { note } }),
};
