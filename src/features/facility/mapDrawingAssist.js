import { fromView, toView } from './mapPresentationView.js';
import { doorFitsMap, doorGeometry } from './doorGeometry.js';

const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const copy = point => ({ x: point.x, y: point.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (point, source) => finitePoint(point) && point.x >= 0 && point.y >= 0 && point.x <= source.widthM && point.y <= source.heightM;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function project(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
  if (!squared) return copy(a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / squared, 0, 1);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function segments(feature) {
  if (!['WALL', 'ROOM', 'CORRIDOR'].includes(feature.type) || !Array.isArray(feature.points)) return [];
  const count = feature.points.length, closed = feature.type !== 'WALL';
  return Array.from({ length: Math.max(0, count - (closed ? 0 : 1)) }, (_, index) => ({
    a: feature.points[index], b: feature.points[(index + 1) % count], featureId: feature.id, index,
  })).filter(edge => finitePoint(edge.a) && finitePoint(edge.b) && distance(edge.a, edge.b) > 0);
}

/** Nearest drawn wall segment, never a wall inferred from the scan image. */
export function getWallEdge(point, features, tolerance = Infinity) {
  if (!finitePoint(point) || typeof tolerance !== 'number' || Number.isNaN(tolerance) || tolerance < 0) return null;
  let best = null, nearest = tolerance;
  for (const feature of features || []) {
    if (feature.type !== 'WALL') continue;
    for (const edge of segments(feature)) {
      const target = project(point, edge.a, edge.b), gap = distance(point, target);
      if (gap <= nearest) {
        nearest = gap;
        best = { ...edge, a: copy(edge.a), b: copy(edge.b), point: target };
      }
    }
  }
  return best;
}

/** Match a saved threshold, including hinges shared by several wall segments. */
export function getDoorWall(door, features, tolerance = 1e-7) {
  const hinge = door?.points?.[0], jamb = door?.points?.[1];
  if (!finitePoint(hinge) || !finitePoint(jamb) || distance(hinge, jamb) === 0 || !Number.isFinite(tolerance) || tolerance < 0) return null;
  let best = null, nearest = Infinity;
  for (const feature of features || []) {
    if (feature.type !== 'WALL') continue;
    for (const edge of segments(feature)) {
      const start = project(hinge, edge.a, edge.b), end = project(jamb, edge.a, edge.b);
      const startGap = distance(hinge, start), endGap = distance(jamb, end);
      if (startGap <= tolerance && endGap <= tolerance && startGap + endGap <= nearest) {
        nearest = startGap + endGap;
        best = { ...edge, a: copy(edge.a), b: copy(edge.b), point: start };
      }
    }
  }
  return best;
}

// An axis-locked pointer can project outside a rotated map's rectangle. Clip
// along the same axis back to the source boundary instead of changing angle.
function constrain(point, anchor, source, rotation, horizontal) {
  const start = toView(anchor, source, rotation), end = toView(point, source, rotation);
  const local = fromView(horizontal ? { x: end.x, y: start.y } : { x: start.x, y: end.y }, source, rotation);
  const dx = local.x - anchor.x, dy = local.y - anchor.y;
  let length = 1;
  if (dx > 0) length = Math.min(length, (source.widthM - anchor.x) / dx);
  else if (dx < 0) length = Math.min(length, -anchor.x / dx);
  if (dy > 0) length = Math.min(length, (source.heightM - anchor.y) / dy);
  else if (dy < 0) length = Math.min(length, -anchor.y / dy);
  return { x: clamp(anchor.x + length * dx, 0, source.widthM), y: clamp(anchor.y + length * dy, 0, source.heightM) };
}

/**
 * Snap in local metres with a caller-supplied screen-pixel tolerance converted
 * to metres. Guides also use local coordinates. Shift axes follow the view,
 * including presentation rotation; the source grid and features stay intact.
 */
export function snapDrawingPoint(point, { features = [], source, rotation = 0, tolerance = 0, anchor = null, orthogonal = false, excludeId = null }) {
  const epsilon = Math.max(1, source.widthM, source.heightM) * 1e-9;
  const radius = Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0;
  const raw = toView(point, source, rotation), origin = finitePoint(anchor) && inside(anchor, source) ? toView(anchor, source, rotation) : null;
  const locked = orthogonal && origin, horizontal = locked && Math.abs(raw.x - origin.x) >= Math.abs(raw.y - origin.y);
  const base = locked ? constrain(point, anchor, source, rotation, horizontal) : copy(point);
  const view = toView(base, source, rotation);
  const usable = features.filter(feature => excludeId === null || feature.id !== excludeId);
  const vertices = usable.flatMap(feature => {
    const points = feature.type === 'DOOR' ? feature.points?.slice(0, 2) : ['ROOM', 'CORRIDOR', 'WALL'].includes(feature.type) ? feature.points : [];
    return (points || []).filter(p => inside(p, source)).map(p => ({ local: p, view: toView(p, source, rotation) }));
  });
  const edges = usable.flatMap(segments).filter(edge => inside(edge.a, source) && inside(edge.b, source));
  const allowed = target => !locked || Math.abs(horizontal ? target.y - origin.y : target.x - origin.x) <= epsilon;
  const result = (target, kind, guides = [], edge = null) => ({ point: copy(target), kind, guides, edge });

  if (radius > 0) {
    let vertex = null, nearest = radius;
    for (const candidate of vertices) {
      const gap = distance(view, candidate.view);
      if (allowed(candidate.view) && gap <= nearest) { vertex = candidate; nearest = gap; }
    }
    if (vertex) return result(vertex.local, 'vertex');

    let matchedEdge = null, edgePoint = null;
    nearest = radius;
    for (const edge of edges) {
      const a = toView(edge.a, source, rotation), b = toView(edge.b, source, rotation);
      let target;
      if (!locked) target = project(view, a, b);
      else {
        const start = horizontal ? a.y : a.x, end = horizontal ? b.y : b.x, value = horizontal ? origin.y : origin.x;
        if (Math.abs(end - start) <= epsilon) {
          if (Math.abs(start - value) > epsilon) continue;
          target = project(view, a, b);
        } else {
          const t = (value - start) / (end - start);
          if (t < 0 || t > 1) continue;
          target = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        }
      }
      const gap = distance(view, target);
      if (gap <= nearest && allowed(target)) { nearest = gap; matchedEdge = edge; edgePoint = target; }
    }
    if (matchedEdge) return result(fromView(edgePoint, source, rotation), 'edge', [{ a: copy(matchedEdge.a), b: copy(matchedEdge.b) }], { ...matchedEdge, a: copy(matchedEdge.a), b: copy(matchedEdge.b) });

    const targets = origin ? [...vertices, { local: anchor, view: origin }] : vertices;
    let alignX = null, alignY = null, dx = radius, dy = radius;
    for (const target of targets) {
      const xGap = Math.abs(view.x - target.view.x), yGap = Math.abs(view.y - target.view.y);
      if ((!locked || horizontal) && xGap <= dx) { alignX = target; dx = xGap; }
      if ((!locked || !horizontal) && yGap <= dy) { alignY = target; dy = yGap; }
    }
    // Keep the complete cursor movement within the magnet radius, even when
    // two different features provide horizontal and vertical alignment.
    if (alignX && alignY && Math.hypot(dx, dy) > radius) {
      if (dx <= dy) alignY = null; else alignX = null;
    }
    if (alignX || alignY) {
      const target = { x: alignX ? alignX.view.x : view.x, y: alignY ? alignY.view.y : view.y };
      const local = fromView(target, source, rotation);
      if (inside(local, source)) {
        const guides = [alignX, alignY].filter(Boolean).map(value => ({ a: copy(value.local), b: copy(local) }));
        return result(local, 'alignment', guides);
      }
    }
  }
  return result(base, locked ? 'axis' : null, locked ? [{ a: copy(anchor), b: copy(base) }] : []);
}

/** Project both door jambs onto one chosen wall and select a fitting 90° swing. */
export function doorOnWall(hinge, pointer, edge, source) {
  if (!finitePoint(hinge) || !finitePoint(pointer) || !finitePoint(edge?.a) || !finitePoint(edge?.b) || distance(edge.a, edge.b) === 0) return null;
  const geometry = doorGeometry({ points: [project(hinge, edge.a, edge.b), project(pointer, edge.a, edge.b)] }, source);
  return doorFitsMap(geometry, source) ? [geometry.hinge, geometry.closed, geometry.open] : null;
}

/**
 * Only the display stroke is split at collinear door thresholds. Persisted
 * walls, source occupancy, and navigation data remain unchanged.
 */
export function visibleWallSegments(feature, features) {
  if (feature.type !== 'WALL') return [];
  const doors = (features || []).filter(item => item.type === 'DOOR' && finitePoint(item.points?.[0]) && finitePoint(item.points?.[1]));
  return segments(feature).flatMap(edge => {
    const dx = edge.b.x - edge.a.x, dy = edge.b.y - edge.a.y, squared = dx * dx + dy * dy, length = Math.sqrt(squared);
    const epsilon = Math.max(1, length) * 1e-8;
    const coordinate = p => ((p.x - edge.a.x) * dx + (p.y - edge.a.y) * dy) / squared;
    const at = t => ({ x: edge.a.x + dx * t, y: edge.a.y + dy * t });
    const gaps = [];
    for (const door of doors) {
      const [a, b] = door.points;
      const normal = p => Math.abs(dx * (p.y - edge.a.y) - dy * (p.x - edge.a.x)) / length;
      if (normal(a) > epsilon || normal(b) > epsilon) continue;
      const ta = coordinate(a), tb = coordinate(b), start = Math.max(0, Math.min(ta, tb)), end = Math.min(1, Math.max(ta, tb));
      if ((end - start) * length > epsilon) gaps.push([start, end]);
    }
    gaps.sort((a, b) => a[0] - b[0]);
    const visible = [];
    let start = 0;
    for (const [low, high] of gaps) {
      if ((low - start) * length > epsilon) visible.push({ a: at(start), b: at(low) });
      start = Math.max(start, high);
    }
    if ((1 - start) * length > epsilon) visible.push({ a: at(start), b: at(1) });
    return visible;
  });
}
