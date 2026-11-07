const palette = ['#3b82f6', '#0d9488', '#d97706', '#8b5cf6', '#e11d48', '#0891b2'];
// Historical defaults were generated in lowercase. Color-picker edits use
// canonical uppercase RGB, including an explicitly chosen pale blue.
const legacyRoomColor = color => !color || color === '#dbeafe';
const bounds = points => ({ left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), bottom: Math.min(...points.map(p => p.y)), top: Math.max(...points.map(p => p.y)) });
const gap = (a, b) => Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.bottom - b.top, b.bottom - a.top));

function chooseColor(points, rooms) {
  const box = bounds(points);
  const nearby = rooms.map(room => ({ color: room.color.toLowerCase(), distance: gap(box, bounds(room.points)) })).sort((a, b) => a.distance - b.distance).slice(0, 8);
  const score = color => nearby.reduce((sum, room) => sum + (room.color === color ? 1 / (.1 + room.distance) : 0), 0);
  return palette.reduce((best, color) => score(color) < score(best) ? color : best, palette[0]);
}

/** Older default-blue rooms get consistent display hues without rewriting the draft on load. */
export function roomColorsFor(features) {
  const rooms = features.filter(feature => feature.type === 'ROOM');
  const colors = Object.fromEntries(rooms.filter(room => !legacyRoomColor(room.color)).map(room => [room.id, room.color]));
  const automatic = [];
  for (const room of rooms.filter(room => legacyRoomColor(room.color)).sort((a, b) => a.id.localeCompare(b.id))) {
    const color = chooseColor(room.points, automatic);
    colors[room.id] = color; automatic.push({ ...room, color });
  }
  return colors;
}

export function nextRoomColor(points, features) {
  const colors = roomColorsFor(features);
  return chooseColor(points, features.filter(feature => feature.type === 'ROOM').map(room => ({ ...room, color: colors[room.id] })));
}

export function areaColor(feature, roomColors) {
  if (feature.type === 'ROOM') return roomColors[feature.id];
  return !feature.color || feature.color === '#e2e8f0' ? '#64748b' : feature.color;
}

/** Freeze existing display hues before editing, moving or deleting old rooms. */
export function preserveRoomColors(previous, next) {
  const colors = roomColorsFor(previous.features);
  return { ...next, features: next.features.map(feature => feature.type === 'ROOM' && legacyRoomColor(feature.color) && colors[feature.id] ? { ...feature, color: colors[feature.id] } : feature) };
}

export function persistRoomColors(document) {
  const colors = roomColorsFor(document.features);
  return { ...document, features: document.features.map(feature => feature.type === 'ROOM' && feature.color !== colors[feature.id] ? { ...feature, color: colors[feature.id] } : feature) };
}

export function nextRoomName(features) {
  const names = new Set(features.filter(feature => feature.type === 'ROOM').map(room => room.label));
  let number = 1;
  while (names.has(`Phòng ${String(number).padStart(2, '0')}`)) number++;
  return `Phòng ${String(number).padStart(2, '0')}`;
}
