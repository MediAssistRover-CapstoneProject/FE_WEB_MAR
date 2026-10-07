import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

function catalog(resource, params) { return apiRequest(query(`/api/v1/${resource}`, params)); }

export const facilityApi = {
  listFloors: (params) => catalog('floors', params),
  listMaps: (params) => catalog('maps', params),
  listZones: (params) => catalog('zones', params),
  listRooms: (params) => catalog('rooms', params),
  listEndpoints: (params) => catalog('endpoints', params),
  activateMap: (id) => apiRequest(`/api/v1/maps/${id}/activate`, { method: 'POST' }),
  archiveMap: (id) => apiRequest(`/api/v1/maps/${id}/archive`, { method: 'POST' }),
  activateEndpoint: (id) => apiRequest(`/api/v1/endpoints/${id}/activate`, { method: 'POST' }),
  deactivateEndpoint: (id) => apiRequest(`/api/v1/endpoints/${id}/deactivate`, { method: 'POST' }),
};
