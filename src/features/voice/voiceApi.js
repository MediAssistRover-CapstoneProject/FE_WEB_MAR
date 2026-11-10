import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const voiceApi = {
  listFaqs: () => apiRequest('/api/v1/admin/assistant/faqs'),
  saveFaq: (id, body) => apiRequest(`/api/v1/admin/assistant/faqs${id ? `/${encodeURIComponent(id)}` : ''}`, {method: id ? 'PUT' : 'POST', body}),
  deleteFaq: (id, revision) => apiRequest(query(`/api/v1/admin/assistant/faqs/${encodeURIComponent(id)}`, {revision}), {method:'DELETE'}),
  testFaq: (question) => apiRequest('/api/v1/admin/assistant/faqs/test', {method:'POST',body:{question}}),
  listInteractions: (params) => apiRequest(query('/api/v1/voice/interactions', params)),
  listCommands: (params) => apiRequest(query('/api/v1/voice/commands', params)),
};
