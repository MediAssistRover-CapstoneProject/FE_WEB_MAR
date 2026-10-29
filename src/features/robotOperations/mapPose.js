// Only place a pose on the exact map frame that supplied its geometry and TF.
export function mapPose(state, revision, now = Date.now()) {
  const p = state?.preview, pose = p?.pose, value = pose?.value;
  const waiting = message => ({ message });
  if (state?.state !== 'MAPPING' || !state.potentially_open) return waiting('Chưa có vị trí trực tiếp trong phiên quét.');
  if (!p || p.mapping_session_id !== state.mapping_session_id || String(p.revision) !== String(revision)) return waiting('Đang đồng bộ vị trí với ảnh bản đồ…');
  const age = (now - Date.parse(p.captured_at)) / 1000;
  if (pose?.fresh !== true || !Number.isFinite(pose.age_sec) || pose.age_sec < 0 || !Number.isFinite(age) || age < -1 || Math.max(age, 0) + pose.age_sec > 2.5) return waiting('Chờ tọa độ TF mới từ robot.');
  if (!Array.isArray(p.origin) || p.origin.length !== 3 || ![p.width, p.height, p.resolution, ...p.origin, value?.x_m, value?.y_m, value?.yaw_rad].every(Number.isFinite) || p.width <= 0 || p.height <= 0 || p.resolution <= 0) return waiting('Chưa có tọa độ hoặc kích thước bản đồ hợp lệ.');
  const dx = value.x_m - p.origin[0], dy = value.y_m - p.origin[1], c = Math.cos(p.origin[2]), s = Math.sin(p.origin[2]);
  const x = (c * dx + s * dy) / p.resolution, y = p.height - (-s * dx + c * dy) / p.resolution;
  if (x < 0 || y < 0 || x > p.width || y > p.height) return waiting('Robot nằm ngoài ảnh hiện tại; chờ bản đồ mở rộng.');
  return { x, y, angle: -(value.yaw_rad - p.origin[2]) * 180 / Math.PI, width: p.width, height: p.height, radius: Math.max(2, Math.min(8, .125 / p.resolution)), message: `Robot: X ${value.x_m.toFixed(2)} m · Y ${value.y_m.toFixed(2)} m · Hướng ${(value.yaw_rad * 180 / Math.PI).toFixed(0)}°` };
}
