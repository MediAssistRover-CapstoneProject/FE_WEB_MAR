import { apiRequest } from '../api/client.js';

export const INCIDENT_ROOT = '/api/v1/emergency-incidents';
const incidentPath = id => `${INCIDENT_ROOT}/${encodeURIComponent(id)}`;
export const getIncident = (id, signal) => apiRequest(incidentPath(id), { signal });
export const getIncidentRouting = (id, signal) => apiRequest(`${incidentPath(id)}/routing`, { signal });
export const retryIncidentRouting = (id, rowVersion, signal) => apiRequest(`${incidentPath(id)}/retry-routing`, {
  method: 'POST', body: { rowVersion }, signal, retry: false,
});
export function actOnIncident(id, action, { note, signal } = {}) {
  if (!['acknowledge', 'start', 'confirm', 'resolve', 'close', 'false-alarm'].includes(action)) throw Error('Thao tác sự cố không hợp lệ.');
  return apiRequest(`${incidentPath(id)}/${action}`, { method: 'POST', signal,
    ...(['resolve', 'false-alarm'].includes(action) ? { body: { resolutionNote: note?.trim() } } : {}) });
}
export const getIncidentLocation = (id, signal) => apiRequest(`${incidentPath(id)}/location`, { signal });
export const getIncidentResponseRoute = (id, signal) => apiRequest(`${incidentPath(id)}/response-route`, { signal });
export const getIncidentMediaSession = (id, signal) => apiRequest(`/api/v1/media-sessions/${encodeURIComponent(id)}`, { signal });

export function emergencyError(error) {
  return ({
    MEDIA_FALL_REVIEW_NOT_ACTIVE: 'Cần mở camera của sự cố này và chờ robot kết nối trước khi xác nhận.',
    MEDIA_FALL_REVIEW_REQUIRES_MONITOR: 'Sự cố nghi té ngã cần phiên camera xác minh riêng.',
    MEDIA_ROBOT_STOP_PENDING: 'Robot đang hoàn tất dừng để hỗ trợ. Hãy chờ rồi kết nối lại.',
    MEDIA_DEVICE_NOT_CONNECTED: 'Robot chưa kết nối dịch vụ camera. Sự cố vẫn được giữ để kiểm tra trực tiếp.',
    MEDIA_DISABLED: 'Máy chủ chưa bật dịch vụ camera. Sự cố vẫn được giữ để kiểm tra trực tiếp.',
    ROBOT_MEDIA_SESSION_ALREADY_OPEN: 'Robot đang có phiên camera khác. Hãy kiểm tra người đang phụ trách.',
    MEDIA_ALREADY_ACCEPTED_BY_ANOTHER_STAFF: 'Một nhân viên khác đã tiếp nhận phiên camera này.',
    MEDIA_SESSION_CLOSED: 'Phiên camera đã kết thúc. Hãy mở lại camera của sự cố.',
    MEDIA_INCIDENT_ALREADY_CLOSED: 'Sự cố đã kết thúc. Hãy tải lại thông tin.',
  })[error?.message] || error?.message || 'Không thực hiện được thao tác. Vui lòng thử lại.';
}
