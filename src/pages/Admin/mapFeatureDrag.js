import { MAP } from './lidarGeometry.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Work in map coordinates, independent of viewport size, zoom and pan.
export function dragFeature(original, kind, start, current, vertex) {
  const dx = Math.round(current.x - start.x), dy = Math.round(current.y - start.y);
  if (kind === 'zone') {
    const xs = original.points.map(p => p.x), ys = original.points.map(p => p.y);
    const x = clamp(dx, -Math.min(...xs), MAP.width - Math.max(...xs));
    const y = clamp(dy, -Math.min(...ys), MAP.height - Math.max(...ys));
    return { ...original, points: original.points.map(p => ({ x: p.x + x, y: p.y + y })) };
  }
  if (kind === 'vertex') {
    return { ...original, points: original.points.map((p, i) => i === vertex
      ? { x: clamp(p.x + dx, 0, MAP.width), y: clamp(p.y + dy, 0, MAP.height) } : p) };
  }
  return { ...original, x: clamp(original.x + dx, 0, MAP.width), y: clamp(original.y + dy, 0, MAP.height), placed: true };
}
