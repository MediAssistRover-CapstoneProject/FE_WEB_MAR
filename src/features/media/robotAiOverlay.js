export const AI_OVERLAY_TOPIC = 'mar.ai.overlay.v1';
export const AI_OVERLAY_IDLE_MS = 3000;
const states = new Set(['PERSON', 'OBSERVING', 'SUSPECTED_FALL', 'PERSON_ON_FLOOR']);
const labels = { PERSON: 'Người', OBSERVING: 'Đang quan sát', SUSPECTED_FALL: 'Nghi té ngã', PERSON_ON_FLOOR: 'Nghi nằm trên sàn' };

// Same display contract as media-call.html. Optional AI data cannot affect video
// or authorize any incident action, and must come from this session's robot.
export function decodeRobotAiOverlay(payload, participant, topic, session, sequence = 0, now = performance.now()) {
  if (topic !== AI_OVERLAY_TOPIC || !session?.robotId || !session.sessionId
    || participant?.identity !== `robot-${session.robotId}`
    || !ArrayBuffer.isView(payload) || !payload.byteLength || payload.byteLength > 1200) return null;
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
    if (!value || value.v !== 1 || value.media_session_id !== session.sessionId
      || !Number.isSafeInteger(value.seq) || value.seq <= sequence
      || !Number.isInteger(value.width) || value.width < 32 || value.width > 640
      || !Number.isInteger(value.height) || value.height < 32 || value.height > 640
      || !['OK', 'PAUSED', 'DEGRADED'].includes(value.status)
      || !Array.isArray(value.detections) || value.detections.length > 8) return null;
    for (const detection of value.detections) {
      if (!detection || !Array.isArray(detection.bbox) || detection.bbox.length !== 4
        || detection.bbox.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)
        || detection.bbox[2] <= 0 || detection.bbox[3] <= 0
        || detection.bbox[0] + detection.bbox[2] > 1.0002 || detection.bbox[1] + detection.bbox[3] > 1.0002
        || typeof detection.confidence !== 'number' || !Number.isFinite(detection.confidence)
        || detection.confidence < 0 || detection.confidence > 1 || !states.has(detection.state)
        || (detection.track_id !== null && (!Number.isSafeInteger(detection.track_id) || detection.track_id < 0 || detection.track_id > 1e9))
        || (detection.distance_m !== undefined && (typeof detection.distance_m !== 'number'
          || !Number.isFinite(detection.distance_m) || detection.distance_m <= 0))) return null;
    }
    return { ...value, receivedAt: now };
  } catch { return null; }
}

export function drawRobotAiOverlay(canvas, video, overlay, { live, enabled = true, now = performance.now(), pixelRatio = 1 } = {}) {
  const context = canvas.getContext('2d');
  if (!context) return 'Chưa thể hiển thị khung nhận diện.';
  const w = video.clientWidth, h = video.clientHeight, scale = Math.min(pixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * scale) || canvas.height !== Math.round(h * scale)) {
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  }
  context.setTransform(scale, 0, 0, scale, 0, 0); context.clearRect(0, 0, w, h);
  if (!live) return 'Chờ camera và kết quả nhận diện mới.';
  if (!overlay) return 'Đang chờ dữ liệu nhận diện từ robot.';
  // Receipt time avoids clock skew between the robot and the viewer.
  const age = now - overlay.receivedAt;
  if (age < 0 || age > AI_OVERLAY_IDLE_MS) return 'Đang chờ kết quả nhận diện mới; video vẫn hoạt động.';
  if (overlay.status !== 'OK') return overlay.status === 'PAUSED'
    ? 'Nhận diện đang tạm nhường tác vụ ưu tiên.' : 'Chưa nhận được kết quả AI; video vẫn hoạt động.';
  if (!video.videoWidth || !video.videoHeight) return 'Đang chờ kích thước hình camera.';
  if (Math.abs(video.videoWidth / video.videoHeight - overlay.width / overlay.height) > .02)
    return 'Kích thước ảnh nhận diện chưa khớp camera.';
  const count = overlay.detections.length;
  const status = `${count ? `${count} người` : 'Chưa nhận diện người'} · cập nhật ${(age / 1000).toFixed(1)} giây trước`;
  if (!enabled) return 'Đã tắt khung nhận diện.';
  const fit = Math.min(w / video.videoWidth, h / video.videoHeight);
  const vw = video.videoWidth * fit, vh = video.videoHeight * fit, ox = (w - vw) / 2, oy = (h - vh) / 2;
  context.lineWidth = 2; context.font = '12px system-ui,sans-serif';
  for (const detection of overlay.detections) {
    const [x, y, bw, bh] = detection.bbox;
    const left = ox + x * vw, top = oy + y * vh;
    const color = detection.state === 'PERSON' ? '#35d98b' : detection.state === 'OBSERVING' ? '#ffda65' : '#ff6060';
    context.strokeStyle = color; context.strokeRect(left, top, bw * vw, bh * vh);
    const text = labels[detection.state] + (detection.track_id === null ? '' : ` #${detection.track_id}`)
      + (['PERSON', 'OBSERVING'].includes(detection.state) ? ` · nhận diện người ${Math.round(detection.confidence * 100)}%` : '')
      + (detection.distance_m === undefined ? '' : ` · ${detection.distance_m.toFixed(1)} m`);
    const labelWidth = Math.min(context.measureText(text).width + 10, w);
    const tx = Math.max(0, Math.min(left, w - labelWidth)), ty = Math.max(0, top - 23);
    context.fillStyle = 'rgba(0,0,0,.8)'; context.fillRect(tx, ty, labelWidth, 23);
    context.fillStyle = color; context.fillText(text, tx + 5, ty + 16, Math.max(1, labelWidth - 10));
  }
  return status;
}
