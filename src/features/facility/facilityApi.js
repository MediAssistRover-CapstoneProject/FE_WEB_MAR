import { apiRequest } from '../api/client.js';

function query(path, params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return `${path}${search.size ? `?${search}` : ''}`;
}

function catalog(resource, params, options) { return apiRequest(query(`/api/v1/${resource}`, params), options); }

export const facilityApi = {
  listFloors: (params, options) => catalog('floors', params, options),
  listMaps: (params, options) => catalog('maps', params, options),
  getMapDeletionImpact: (id, options) => apiRequest(`/api/v1/maps/${encodeURIComponent(id)}/deletion-impact`, options),
  deleteMap: async (id, reason) => {
    const result = await apiRequest(`/api/v1/maps/${encodeURIComponent(id)}/force`, { method: 'DELETE', headers: { 'X-Confirm-Hard-Delete': 'true' }, body: { reason }, retry: false });
    if (result?.resourceId !== id || result?.resourceType !== 'MAP' || result?.deleted?.Map !== 1) throw new Error('Máy chủ chưa xác nhận xóa vĩnh viễn bản đồ. Hãy tải lại danh sách để kiểm tra.');
    return result;
  },
  listZones: (params, options) => catalog('zones', params, options),
  listRooms: (params, options) => catalog('rooms', params, options),
  createRoom: body => apiRequest('/api/v1/rooms', { method: 'POST', body, retry: false }),
  updateRoom: (id, body) => apiRequest(`/api/v1/rooms/${encodeURIComponent(id)}`, { method: 'PUT', body, retry: false }),
  listPublicRooms: (params, options) => apiRequest(query('/api/v1/public/rooms', params), { skipAuth: true, ...options }),
  listEndpoints: (params, options) => catalog('endpoints', params, options),
  listEndpointGroups: (params, options) => catalog('endpoint-groups', params, options),
  listEndpointGroupMembers: (params) => catalog('endpoint-group-members', params),
  getMapArtifact: (id) => apiRequest(`/api/v1/maps/${id}/artifact-metadata`),
  getMapImageMetadata: (id, options) => apiRequest(`/api/v1/maps/${id}/image-metadata`, options),
  validateNavigationPoint: (id, point) => apiRequest(`/api/v1/maps/${id}/validate-navigation-point`, { method: 'POST', body: point }),
  navigationCopy: (id) => apiRequest(`/api/v1/maps/${id}/navigation-copy`, { method: 'POST', body: {}, retry: false }),
  createZone: (body) => apiRequest('/api/v1/zones', { method: 'POST', body }),
  updateZone: (id, body) => apiRequest(`/api/v1/zones/${id}`, { method: 'PUT', body }),
  activateZone: (id, reason) => apiRequest(`/api/v1/zones/${encodeURIComponent(id)}/activate`, { method: 'POST', body: { reason }, retry: false }),
  deactivateZone: (id, reason) => apiRequest(`/api/v1/zones/${encodeURIComponent(id)}/deactivate`, { method: 'POST', body: { reason }, retry: false }),
  createEndpoint: (body) => apiRequest('/api/v1/endpoints', { method: 'POST', body }),
  updateEndpoint: (id, body) => apiRequest(`/api/v1/endpoints/${id}`, { method: 'PUT', body }),
  createEndpointGroup: (body) => apiRequest('/api/v1/endpoint-groups', { method: 'POST', body }),
  updateEndpointGroup: (id, body) => apiRequest(`/api/v1/endpoint-groups/${id}`, { method: 'PUT', body }),
  createEndpointGroupMember: (body) => apiRequest('/api/v1/endpoint-group-members', { method: 'POST', body }),
  updateEndpointGroupMember: (groupId, endpointId, body) => apiRequest(`/api/v1/endpoint-group-members/${groupId}/${endpointId}`, { method: 'PUT', body }),
  removeEndpointGroupMember: (groupId, endpointId) => apiRequest(`/api/v1/endpoint-group-members/${groupId}/${endpointId}`, { method: 'DELETE' }),
  activateMap: (id) => apiRequest(`/api/v1/maps/${id}/activate`, { method: 'POST' }),
  archiveMap: (id) => apiRequest(`/api/v1/maps/${id}/archive`, { method: 'POST' }),
  activateEndpoint: (id) => apiRequest(`/api/v1/endpoints/${id}/activate`, { method: 'POST', body: { reason: 'Kích hoạt lại điểm đích.' }, retry: false }),
  deactivateEndpoint: (id) => apiRequest(`/api/v1/endpoints/${id}/deactivate`, { method: 'POST', body: { reason: 'Ngừng sử dụng điểm đích.' }, retry: false }),
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
