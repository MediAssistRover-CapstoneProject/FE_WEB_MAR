import { loadDraft, mapIssues } from './mapStudioModel.js';
import { MAP } from './lidarGeometry.js';
import { findRoute, travelSpeed } from '../Workstations/mapDispatchModel.js';
import { vi } from '../../i18n/vi.js';

export const PATROL_STORAGE_KEY = 'mediassist.patrol.drafts.v1';
export const REPEATS = { once: 'Một lần', daily: 'Hằng ngày', weekly: 'Hằng tuần', interval: 'Theo khoảng giờ' };
export const mapReference = saved => saved ? { name: saved.snapshot.name, revision: saved.revision, savedAt: saved.timestamp } : null;
export const sameMap = (reference, saved) => !!reference && !!saved && JSON.stringify(reference) === JSON.stringify(mapReference(saved));

export function readPatrolMap(storage) {
  return loadDraft(storage).saved;
}

export function newPatrol(saved) {
  return {
    id: '', name: '', mapRef: mapReference(saved),
    startId: saved?.snapshot.endpoints.find(e => e.enabled !== false && e.type === 'PARK')?.id || saved?.snapshot.endpoints.find(e => e.enabled !== false)?.id || '',
    stops: [], returnToStart: false,
    schedule: { startsAt: '', repeat: 'daily', intervalHours: 2, timezone: 'Asia/Ho_Chi_Minh' },
  };
}

function readableRoute(route) {
  return route && typeof route.id === 'string' && typeof route.name === 'string'
    && typeof route.startId === 'string' && Array.isArray(route.stops)
    && route.stops.every(s => typeof s?.endpointId === 'string' && Number.isFinite(Number(s.dwellSec)))
    && route.schedule && Object.hasOwn(REPEATS, route.schedule.repeat);
}

export function loadPatrols(storage) {
  try {
    const raw = storage.getItem(PATROL_STORAGE_KEY);
    if (!raw) return { routes: [], error: '' };
    const data = JSON.parse(raw);
    if (data?.schema !== 1 || !Array.isArray(data.routes) || !data.routes.every(readableRoute)) throw Error();
    return { routes: data.routes, error: '' };
  } catch {
    return { routes: [], error: 'Không đọc được bản nháp tuần tra. Dữ liệu cũ được giữ nguyên; hãy kiểm tra quyền lưu trữ hoặc khôi phục dữ liệu trước khi lưu mới.' };
  }
}

// Write first: a failed quota/permission check must never look like a successful save.
export function writePatrols(storage, routes) {
  storage.setItem(PATROL_STORAGE_KEY, JSON.stringify({ schema: 1, routes }));
  return routes;
}

export function draftErrors(route, saved) {
  const errors = [];
  if (!route.name.trim()) errors.push('Nhập tên tuyến tuần tra.');
  if (!saved) errors.push('Lưu bản đồ trong mục Bản đồ trước khi tạo tuyến.');
  else if (!sameMap(route.mapRef, saved)) errors.push('Bản đồ đã thay đổi. Chọn “Dùng bản đồ mới” để kiểm tra lại tuyến.');
  if (!route.startId) errors.push('Chọn điểm xuất phát.');
  if (!route.stops.length) errors.push('Thêm ít nhất một điểm tuần tra sau điểm xuất phát.');
  if (route.stops.some(s => s.dwellSec === '' || !Number.isFinite(Number(s.dwellSec)) || Number(s.dwellSec) < 0 || Number(s.dwellSec) > 3600)) errors.push('Thời gian dừng phải từ 0 đến 3.600 giây.');
  if (!Object.hasOwn(REPEATS, route.schedule.repeat)) errors.push('Chọn chu kỳ hợp lệ.');
  if (route.schedule.startsAt && !Number.isFinite(new Date(route.schedule.startsAt + '+07:00').getTime())) errors.push('Giờ bắt đầu không hợp lệ.');
  if (route.schedule.repeat === 'interval' && (!Number.isFinite(Number(route.schedule.intervalHours)) || Number(route.schedule.intervalHours) < 1 || Number(route.schedule.intervalHours) > 168)) errors.push('Khoảng lặp phải từ 1 đến 168 giờ.');
  return errors;
}

export function buildPatrolPlan(map, route) {
  const timeline = [], legs = [], resolved = [], issues = [];
  let duration = 0, distance = 0;
  if (!map) return { timeline, legs, resolved, issues: ['Chưa có bản đồ đã lưu.'], duration, distance, valid: false };
  const problems = mapIssues(map);
  if (problems.length) issues.push('Bản đồ chưa hợp lệ: ' + vi(problems[0]));
  const endpoint = id => map.endpoints.find(e => e.id === id);
  const available = point => point && point.enabled !== false && point.accessible !== false && point.occupancy !== 'BUSY';
  let current = endpoint(route.startId);
  if (!available(current)) issues.push('Điểm xuất phát không còn tồn tại hoặc chưa sẵn sàng.');
  if (!route.stops.length) issues.push('Chọn ít nhất một điểm tuần tra.');
  const stops = [...route.stops, ...(route.returnToStart && route.stops.length ? [{ endpointId: route.startId, dwellSec: 0, returning: true }] : [])];
  for (const [index, stop] of stops.entries()) {
    const end = endpoint(stop.endpointId);
    const label = stop.returning ? 'Quay về điểm xuất phát' : `Điểm ${index + 1}: ${end?.name || 'điểm đã bị xóa'}`;
    const leg = { index, from: current?.name || 'điểm không tồn tại', to: end?.name || 'điểm đã bị xóa', path: [], error: '' };
    try {
      if (!available(current) || !available(end)) throw Error('Điểm không tồn tại, đang tắt, đang bận hoặc không thể đi đến.');
      const dwell = Number(stop.dwellSec);
      const speed = stop.speedMps === undefined ? Infinity : Number(stop.speedMps);
      if (!(speed > 0) || (speed !== Infinity && speed > .3)) throw Error('Tốc độ phải lớn hơn 0 và không quá 0,30 m/s.');
      if (stop.dwellSec === '' || !Number.isFinite(dwell) || dwell < 0 || dwell > 3600) throw Error('Thời gian dừng phải từ 0 đến 3.600 giây.');
      leg.path = findRoute(map, current, end);
      for (let i = 1; i < leg.path.length; i++) {
        const a = leg.path[i - 1], b = leg.path[i];
        const length = Math.hypot(b.x - a.x, b.y - a.y) * MAP.resolution;
        const seconds = length / Math.min(travelSpeed(map, a), travelSpeed(map, b), speed);
        timeline.push({ a, b, start: duration, end: duration + seconds, action: 'MOVE', label, stopIndex: index });
        duration += seconds;
        distance += length;
      }
      const previous = timeline.at(-1);
      const heading = previous ? previous.heading ?? ((Math.atan2(previous.a.y - previous.b.y, previous.b.x - previous.a.x) * 180 / Math.PI + 360) % 360) : 0;
      if (dwell > 0) timeline.push({ a: end, b: end, start: duration, end: duration + dwell, action: 'WAIT', label, stopIndex: index, heading });
      duration += dwell;
      resolved.push({ index, id: end.id, name: end.name, at: duration, returning: !!stop.returning });
    } catch (error) {
      leg.error = `Đoạn ${index + 1} (${leg.from} → ${leg.to}): ${error.message}`;
      issues.push(leg.error);
    }
    legs.push(leg);
    current = end;
  }
  return { timeline, legs, resolved, path: legs.flatMap(leg => leg.path), duration, distance, issues, valid: issues.length === 0 };
}

export function formatDuration(seconds) {
  const value = Math.ceil(seconds);
  return `${Math.floor(value / 60)} phút ${value % 60} giây`;
}

export function scheduleLabel(schedule) {
  if (!schedule.startsAt) return 'Chưa đặt giờ bắt đầu';
  const date = new Date(schedule.startsAt + '+07:00');
  if (!Number.isFinite(date.getTime())) return 'Giờ bắt đầu chưa hợp lệ';
  return `${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)} · ${schedule.repeat === 'interval' ? `Mỗi ${schedule.intervalHours} giờ` : REPEATS[schedule.repeat]}`;
}
