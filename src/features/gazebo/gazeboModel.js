import { MAP, FLOOR, WALLS, OBSTACLES } from '../../pages/Admin/lidarGeometry.js';

export function toRosPoint(point) {
  return { x: (point.x - MAP.width / 2) * MAP.resolution, y: (MAP.height / 2 - point.y) * MAP.resolution, yaw: (point.heading || 0) * Math.PI / 180 };
}

export function fromRosPoint(point) {
  if (!point || ![point.x, point.y, point.yaw].every(Number.isFinite)) return null;
  return { x: point.x / MAP.resolution + MAP.width / 2, y: MAP.height / 2 - point.y / MAP.resolution, heading: point.yaw * 180 / Math.PI };
}

export async function gazeboManifest(snapshot) {
  // Preserve the exact serialized content for a cross-language map fingerprint.
  const content = JSON.stringify({ geometry: 'mar-hospital-v1', map: MAP, floor: FLOOR, walls: WALLS, obstacles: OBSTACLES, zones: snapshot.zones || [], endpoints: snapshot.endpoints || [] });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  const mapKey = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  return { format: 'mar-gazebo-v1', mapKey, content };
}

export async function downloadGazeboMap(snapshot) {
  const data = await gazeboManifest(snapshot);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hospital.gazebo.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function bridgeUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('Nhập địa chỉ cầu nối, ví dụ http://192.168.1.20:8765');
  if (globalThis.location?.protocol === 'https:' && url.protocol !== 'https:') throw Error('Web HTTPS cần cầu nối HTTPS. Chạy FE local HTTP khi thử trên mạng nội bộ.');
  return url.origin;
}

export function routeRequest(plan, manifest, runId) {
  if (!manifest || !plan?.valid || !plan.points?.length) throw Error('Chọn quy trình MOVE hợp lệ trên bản đồ đã lưu.');
  return { runId, mapKey: manifest.mapKey, steps: plan.points.map(({ endpoint, step }) => ({ endpointId: endpoint.id, speed: Number(step.paramsJson.max_speed_mps) })) };
}
