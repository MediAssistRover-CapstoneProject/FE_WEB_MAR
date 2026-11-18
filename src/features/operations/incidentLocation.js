export const centimetrePoint = point => point && [point.xCm, point.yCm].every(Number.isFinite)
  ? { xM: point.xCm / 100, yM: point.yCm / 100 } : null;

export function scopedIncidentLocation(value, incident, metadata) {
  if (!value || value.unit !== 'cm' || value.mapId !== incident.mapId
    || metadata && (metadata.map_id !== value.mapId || metadata.asset_hash !== value.mapAssetHash)) return null;
  const points = value.status === 'FOUND' && Array.isArray(value.points) ? value.points.map(centimetrePoint) : [];
  return { patient: centimetrePoint(value.patientLocation), observation: centimetrePoint(value.robotObservationLocation),
    destination: centimetrePoint(value.destination), origin: centimetrePoint(value.origin),
    points: points.every(Boolean) ? points : [],
    distanceM: Number.isFinite(value.distanceCm) ? value.distanceCm / 100 : null };
}

export const routeReason = reason => ({
  FALL_VIEWPOINT_UNAVAILABLE: 'Chưa có vị trí người hoặc vị trí robot lúc phát hiện đã được xác minh.',
  MAP_MISSING: 'Sự cố chưa có bản đồ liên kết.', MAP_DATA_UNAVAILABLE: 'Chưa tải được dữ liệu bản đồ để tìm đường.',
  MONITORING_ROOM_MISSING: 'Chưa cấu hình phòng trực để tính đường hỗ trợ.', MONITORING_ROOM_INVALID: 'Cấu hình phòng trực chưa hợp lệ.',
  MONITORING_ROOM_UNAVAILABLE: 'Phòng trực hiện không khả dụng.', DIFFERENT_FLOOR: 'Phòng trực và sự cố nằm ở hai tầng khác nhau.',
  ORIGIN_ENDPOINT_MISSING_ON_MAP: 'Phòng trực chưa có điểm xuất phát trên bản đồ.', ORIGIN_POSITION_NOT_FREE: 'Điểm xuất phát chưa nằm trong vùng đi được.',
  SOS_POSITION_MISSING: 'Sự cố chưa có vị trí để tìm đường.', SOS_POSITION_OUTSIDE_MAP: 'Vị trí ghi nhận nằm ngoài bản đồ.',
  PATIENT_POSITION_OUTSIDE_MAP: 'Vị trí người nằm ngoài bản đồ.', NO_PATH: 'Chưa tìm được đường hỗ trợ trên bản đồ.',
  SOS_POSITION_NOT_FREE: 'Vị trí đích chưa nằm trong vùng đi được.', PATIENT_POSITION_NOT_FREE: 'Chưa tìm được điểm đi bộ phù hợp gần người cần hỗ trợ.',
})[reason] || 'Chưa có đường hỗ trợ phù hợp. Cần kiểm tra vị trí thực tế.';
