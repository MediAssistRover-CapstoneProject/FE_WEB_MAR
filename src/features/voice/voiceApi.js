import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

export const voiceApi = {
  listInteractions: (params) => apiRequest(query('/api/v1/voice/interactions', params)),
  listCommands: (params) => apiRequest(query('/api/v1/voice/commands', params)),
};
