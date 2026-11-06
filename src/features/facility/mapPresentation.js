import { apiRequest } from '../api/client.js';

const path = id => `/api/v1/maps/${encodeURIComponent(id)}/presentation`;
export const mapPresentationApi = {
  get: (id, signal) => apiRequest(path(id), { signal }),
  save: (id, body) => apiRequest(path(id), { method: 'PUT', body, retry: false }),
  publish: (id, expectedRevision) => apiRequest(`${path(id)}/publish`, { method: 'POST', body: { expectedRevision }, retry: false }),
  unpublish: (id, expectedRevision) => apiRequest(`${path(id)}/unpublish`, { method: 'POST', body: { expectedRevision }, retry: false }),
};

export const featureNames = { ROOM: 'Phòng', CORRIDOR: 'Hành lang', WALL: 'Tường', DOOR: 'Cửa', LABEL: 'Nhãn', LANDMARK: 'Ký hiệu' };
export function worldToLocal(point, source) {
  const dx = point.xM - source.originXM, dy = point.yM - source.originYM;
  const c = Math.cos(source.originYawRad), s = Math.sin(source.originYawRad);
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}
export function localToWorld(point, source) {
  const c = Math.cos(source.originYawRad), s = Math.sin(source.originYawRad);
  return { xM: source.originXM + c * point.x - s * point.y, yM: source.originYM + s * point.x + c * point.y };
}
export const insideMap = (point, source) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0 && point.x <= source.widthM && point.y <= source.heightM;
export const svgPoint = (point, source) => ({ x: point.x, y: source.heightM - point.y });
export const featureCenter = feature => ({ x: feature.points.reduce((n, p) => n + p.x, 0) / feature.points.length, y: feature.points.reduce((n, p) => n + p.y, 0) / feature.points.length });
export function rectangle(a, b) {
  return [{ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) }, { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) }, { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) }];
}
export function newFeature(type, points, source) {
  const scale = Math.max(.05, Math.min(source.widthM, source.heightM) / 35);
  return { id: crypto.randomUUID(), type, label: featureNames[type], color: ({ ROOM: '#dbeafe', CORRIDOR: '#e2e8f0', WALL: '#334155', DOOR: '#0d9488', LABEL: '#334155', LANDMARK: '#7c3aed' })[type], points, lineWidthM: Math.min(2, Math.max(.01, Math.round(scale / 3 * 100) / 100)), fontSizeM: Math.min(5, Math.max(.05, Math.round(scale * 100) / 100)), endpointId: null };
}
export function presentationIssues(document, source) {
  const errors = [];
  if (!document || document.schemaVersion !== 1 || !Array.isArray(document.features)) return ['Bản vẽ không đúng định dạng.'];
  if (document.features.length > 500) errors.push('Tối đa 500 đối tượng.');
  for (const feature of document.features) {
    if (feature.points.some(p => !insideMap(p, source))) errors.push(`${feature.label || 'Đối tượng'} nằm ngoài map.`);
    if (['ROOM', 'CORRIDOR'].includes(feature.type)) {
      let area = 0;
      feature.points.forEach((a, i) => { const b = feature.points[(i + 1) % feature.points.length]; area += a.x * b.y - b.x * a.y; });
      if (feature.points.length < 3 || Math.abs(area) < .000001) errors.push('Phòng/hành lang phải có diện tích.');
    }
  }
  return errors;
}
