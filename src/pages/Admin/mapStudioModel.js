import { MAP, FLOOR, WALLS, OBSTACLES, SCAN_START, inPolygon, distanceToSegment } from './lidarGeometry.js';
import { groupsFor, groupError } from '../../features/facility/endpointGroups.js';
import { ZONE_TYPES, blockedZone, noStopZone } from './zoneCatalog.js';
export { ZONE_TYPES } from './zoneCatalog.js';

export const STAGES = [
  ['scan', 'Scan', 'Record the physical space with LiDAR before adding map features.'],
  ['zone', 'Zone', 'Draw named areas and set where or how the robot may travel.'],
  ['endpoint', 'Endpoint', 'Đặt điểm đích theo chức năng trên bản đồ.'],
];
export const STORAGE_KEY = 'mediassist.map-studio.lidar.v3';
export const ENDPOINT_TYPES = ['WAYPOINT', 'CHARGER', 'PARK', 'STAGING'];
export function createDraft() {
  return { schema: 3, revision: 0, name: 'Tầng 1 bệnh viện', scan: { status: 'idle', progress: 0, robot: { ...SCAN_START }, trail: [{ x: SCAN_START.x, y: SCAN_START.y }] }, zones: [], endpoints: [], endpointGroups: [], saved: null };
}
export function validPoint(p) { return Number.isFinite(p?.x) && Number.isFinite(p?.y) && p.x >= 0 && p.x <= MAP.width && p.y >= 0 && p.y <= MAP.height; }
export function loadDraft(storage) {
  try {
    const d = JSON.parse(storage.getItem(STORAGE_KEY));
    if (d?.schema !== 3 || !Number.isInteger(d.revision) || typeof d.name !== 'string' || !['idle', 'running', 'paused', 'captured', 'complete'].includes(d.scan?.status) || !Number.isFinite(d.scan.progress) || d.scan.progress < 0 || d.scan.progress > 100 || !Array.isArray(d.zones) || !Array.isArray(d.endpoints)) return createDraft();
    // Preserve structurally readable legacy drafts so users can export or
    // explicitly reclassify them. mapIssues still rejects every legacy type.
    if (d.zones.some(z => !z || typeof z.name !== 'string' || !Array.isArray(z.points) || z.points.some(p => !validPoint(p))) || d.endpoints.some(e => !e || typeof e.name !== 'string' || !validPoint(e))) return createDraft();
    // A damaged saved snapshot must not crash Dispatch or discard a valid draft.
    let saved=d.saved;
    if(saved){try{if(saved.revision!==saved.snapshot?.revision||mapIssues(saved.snapshot).length)saved=null;}catch{saved=null;}}
    const scan={...d.scan,status:d.scan.status==='running'?'paused':d.scan.status};
    // Completed legacy maps keep their original serialized shape. Active scan
    // drafts receive the manual-control state required by the new demo.
    if(scan.status!=='complete'){
      const source=validPoint(scan.robot)?scan.robot:SCAN_START;
      scan.robot={...SCAN_START,...source,heading:Number.isFinite(source.heading)?source.heading:SCAN_START.heading};
      scan.trail=Array.isArray(scan.trail)&&scan.trail.length&&scan.trail.every(validPoint)?scan.trail.map(({x,y})=>({x,y})):[{x:scan.robot.x,y:scan.robot.y}];
    }
    return { ...d, endpointGroups: groupsFor(d), saved, scan };
  } catch { return createDraft(); }
}
export function changeDraft(draft, changes) { return { ...draft, ...changes, revision: draft.revision + 1 }; }
export function removeEndpointGroup(draft, id) {
  const groups = groupsFor(draft);
  if (!groups.some(group => group.id === id)) return draft;
  // An explicit array also prevents deleted legacy groups being recreated on reload.
  return changeDraft(draft, { endpointGroups: groups.filter(group => group.id !== id) });
}
// Local draft only. The published snapshot stays unchanged until Save map.
export function removeEndpoint(draft, id) {
  if (!draft.endpoints.some(e => e.id === id)) return draft;
  const endpoints = draft.endpoints.filter(e => e.id !== id).map(e => {
    const next = { ...e };
    if (next.queueId === id) delete next.queueId;
    if (next.exitId === id) delete next.exitId;
    return next;
  });
  const endpointGroups = groupsFor(draft).map(g => ({ ...g, members: g.members.filter(m => m.endpointId !== id) }));
  return changeDraft(draft, { endpoints, endpointGroups });
}
export function stageEnabled(draft, stage) { return stage === 'scan' || ['zone', 'endpoint'].includes(stage) && draft.scan.status === 'complete'; }
export function freePoint(point, clearance = 8) {
  if (!validPoint(point) || !inPolygon(point, FLOOR)) return false;
  if (WALLS.some(([a, b]) => distanceToSegment(point, a, b) < clearance)) return false;
  return !OBSTACLES.some(r => point.x >= r.x - clearance && point.x <= r.x + r.w + clearance && point.y >= r.y - clearance && point.y <= r.y + r.h + clearance);
}
export function pointAllowed(draft, point) { return freePoint(point) && !draft.zones.some(z => blockedZone(z) && (inPolygon(point, z.points) || z.points.some((p,i)=>distanceToSegment(point,p,z.points[(i+1)%z.points.length]) < 8))); }
export function polygonArea(points) { return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2); }
function intersects(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const on = (p, q, r) => Math.abs(cross(p, q, r)) < 1e-7 && r.x >= Math.min(p.x, q.x) && r.x <= Math.max(p.x, q.x) && r.y >= Math.min(p.y, q.y) && r.y <= Math.max(p.y, q.y);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
export function zoneError(draft, zone) {
  if (!zone.name.trim()) return 'Enter a zone name.';
  if (draft.zones.some(z => z.id !== zone.id && z.name.toLowerCase() === zone.name.trim().toLowerCase())) return 'A zone with this name already exists.';
  if (!ZONE_TYPES.some(t => t.id === zone.type)) return 'Select a zone type.';
  if (zone.points.length < 3 || zone.points.length > 24 || zone.points.some(p => !validPoint(p))) return 'Draw a zone with 3–24 corners inside the map.';
  for (let i = 0; i < zone.points.length; i++) {
    const a = zone.points[i], b = zone.points[(i + 1) % zone.points.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 2) return 'Zone corners must be distinct.';
    for (let j = i + 2; j < zone.points.length; j++) {
      if (i === 0 && j === zone.points.length - 1) continue;
      if (intersects(a, b, zone.points[j], zone.points[(j + 1) % zone.points.length])) return 'Zone edges must not cross. Undo the last corner or redraw the zone.';
    }
  }
  if (polygonArea(zone.points) < 100) return 'Draw a larger zone (at least 0.25 m²).';
  // OTTO zones are overlays: they can cross walls and unknown/occupied cells.
  // Only endpoints require observed traversable floor.
  if ((blockedZone(zone) || noStopZone(zone)) && draft.endpoints.some(e => inPolygon(e, zone.points) || zone.points.some((p,i)=>distanceToSegment(e,p,zone.points[(i+1)%zone.points.length]) < 8))) return zone.type==='KEEP_OUT'?'Vùng cấm quá gần hoặc phủ lên điểm đích đã lưu. Hãy di chuyển điểm đích trước.':'Vùng NO_STOP không được phủ lên điểm đích đã lưu. Hãy di chuyển điểm đích trước.';
  if (zone.type === 'SPEED' && (!Number.isFinite(zone.speed) || zone.speed < 0.1 || zone.speed > 1.5)) return 'Set a speed between 0.1 and 1.5 m/s.';
  return '';
}
export function endpointError(draft, endpoint) {
  if (!endpoint.name.trim()) return 'Enter an endpoint name.';
  if (!ENDPOINT_TYPES.includes(endpoint.type)) return 'Select an endpoint type.';
  if (!freePoint(endpoint)) return 'Place the endpoint on scanned free space, at least 0.4 m from walls and obstacles.';
  if (!pointAllowed(draft, endpoint)) return 'An endpoint cannot be placed inside a KEEP_OUT zone.';
  if (draft.zones.some(z => noStopZone(z) && inPolygon(endpoint, z.points))) return 'An endpoint cannot be placed inside a NO_STOP zone.';
  if (draft.endpoints.some(e => e.id !== endpoint.id && e.name.toLowerCase() === endpoint.name.trim().toLowerCase())) return 'An endpoint with this name already exists.';
  if (draft.endpoints.some(e => e.id !== endpoint.id && Math.hypot(e.x - endpoint.x, e.y - endpoint.y) < 16)) return 'Keep endpoints at least 0.8 m apart.';
  for (const key of ['queueId','exitId']) if (endpoint[key] && (endpoint[key] === endpoint.id || !draft.endpoints.some(e=>e.id===endpoint[key] && e.enabled !== false && ['WAYPOINT','PARK','STAGING'].includes(e.type)))) return 'Điểm chờ/thoát phải là một điểm đường, điểm đỗ hoặc điểm tập kết khác đang bật.';
  if (endpoint.queueId && endpoint.queueId === endpoint.exitId) return 'Điểm chờ và điểm thoát phải khác nhau.';
  if (endpoint.tasks && (!Array.isArray(endpoint.tasks) || endpoint.tasks.length > 12 || endpoint.tasks.some(t=>!['WAIT','LOAD','UNLOAD','CHARGE','NOTIFY'].includes(t.action) || !Number.isFinite(t.seconds) || t.seconds < 0 || t.seconds > 300))) return 'Mỗi điểm có tối đa 12 tác vụ, thời gian mỗi tác vụ từ 0 đến 300 giây.';
  return '';
}
export function mapIssues(draft) {
  const groups=groupsFor(draft);
  return [draft.scan.status !== 'complete' ? 'Finish the scan first.' : '', !draft.name.trim() ? 'Enter a map name.' : '', !draft.endpoints.length ? 'Add at least one endpoint.' : '', ...draft.zones.map(z => zoneError(draft, z)), ...draft.endpoints.map(e => endpointError(draft, e)), ...groups.map(g=>groupError(g,groups,draft.endpoints))].filter(Boolean);
}
export function saveMap(draft, timestamp) {
  if (mapIssues(draft).length) return draft;
  const { saved, ...snapshot } = draft;
  return { ...draft, saved: { revision: draft.revision, timestamp, snapshot: structuredClone(snapshot) } };
}
export function exportMap(draft) {
  const { saved, ...configuration } = draft;
  return { mode: 'local-lidar-demo', ...configuration, geometry: { ...MAP, floor: FLOOR, walls: WALLS, obstacles: OBSTACLES } };
}
