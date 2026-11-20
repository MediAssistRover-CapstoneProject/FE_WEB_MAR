// Display the last confirmed robot connection for its remaining heartbeat lease.
// A failed UI request is not evidence that the robot disconnected from MQTT.
// Map freshness and command authorization use their own stricter checks.
export function robotConnection({ snapshot, receivedAt, now = Date.now() }) {
  const syncing = { connected: false, phase: 'syncing', label: 'Đang kiểm tra kết nối', detail: 'Đang đồng bộ lại với máy chủ để xác nhận kết nối robot.' };
  if (!snapshot || !receivedAt) return { connected: false, phase: 'waiting', label: 'Chờ tín hiệu robot', detail: 'Chưa nhận được trạng thái robot từ máy chủ.' };
  const elapsed = now - receivedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 15000) return syncing;
  if (snapshot.mqttConnected !== true) return {
    connected: false, phase: 'disconnected', label: 'Chờ tín hiệu robot',
    detail: snapshot.sessionFailureReason || 'Máy chủ xác nhận robot chưa kết nối MQTT.',
  };
  if (snapshot.heartbeatFresh !== true) return {
    connected: false, phase: 'disconnected', label: 'Chờ tín hiệu robot',
    detail: 'MQTT còn kết nối nhưng máy chủ chưa nhận heartbeat mới từ robot.',
  };
  const heartbeatAge = snapshot.heartbeatAgeSeconds;
  if (typeof heartbeatAge === 'number' && (!Number.isFinite(heartbeatAge) || heartbeatAge < 0 || heartbeatAge * 1000 + elapsed >= 15000)) return syncing;
  return { connected: true, phase: 'connected', label: 'Đã kết nối', detail: 'Máy chủ đã xác nhận kết nối MQTT và heartbeat của robot.' };
}
