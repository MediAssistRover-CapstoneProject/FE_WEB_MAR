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
  listEndpointGroups: (params) => catalog('endpoint-groups', params),
  listEndpointGroupMembers: (params) => catalog('endpoint-group-members', params),
  getMapArtifact: (id) => apiRequest(`/api/v1/maps/${id}/artifact-metadata`),
  createZone: (body) => apiRequest('/api/v1/zones', { method: 'POST', body }),
  updateZone: (id, body) => apiRequest(`/api/v1/zones/${id}`, { method: 'PUT', body }),
  createEndpoint: (body) => apiRequest('/api/v1/endpoints', { method: 'POST', body }),
  updateEndpoint: (id, body) => apiRequest(`/api/v1/endpoints/${id}`, { method: 'PUT', body }),
  createEndpointGroup: (body) => apiRequest('/api/v1/endpoint-groups', { method: 'POST', body }),
  updateEndpointGroup: (id, body) => apiRequest(`/api/v1/endpoint-groups/${id}`, { method: 'PUT', body }),
  createEndpointGroupMember: (body) => apiRequest('/api/v1/endpoint-group-members', { method: 'POST', body }),
  updateEndpointGroupMember: (groupId, endpointId, body) => apiRequest(`/api/v1/endpoint-group-members/${groupId}/${endpointId}`, { method: 'PUT', body }),
  removeEndpointGroupMember: (groupId, endpointId) => apiRequest(`/api/v1/endpoint-group-members/${groupId}/${endpointId}`, { method: 'DELETE' }),
  activateMap: (id) => apiRequest(`/api/v1/maps/${id}/activate`, { method: 'POST' }),
  archiveMap: (id) => apiRequest(`/api/v1/maps/${id}/archive`, { method: 'POST' }),
  activateEndpoint: (id) => apiRequest(`/api/v1/endpoints/${id}/activate`, { method: 'POST' }),
  deactivateEndpoint: (id) => apiRequest(`/api/v1/endpoints/${id}/deactivate`, { method: 'POST' }),
};

// Facility list endpoints accept page/size only, NOT mapId filters. Fetch every
// page and scope locally; otherwise members past page 1 silently disappear.
export async function allFacilityPages(list) {
  const result = [];
  for (let page = 0; page < 1000; page++) {
    const response = await list({ page, size: 100 });
    if (!Array.isArray(response?.content)) throw new Error('Máy chủ trả danh mục không đúng định dạng phân trang.');
    result.push(...response.content);
    if (response.last === true || page + 1 >= response.totalPages || response.content.length < 100) return result;
  }
  throw new Error('Danh mục quá lớn để tải toàn bộ; hãy thu hẹp dữ liệu phía máy chủ.');
}
