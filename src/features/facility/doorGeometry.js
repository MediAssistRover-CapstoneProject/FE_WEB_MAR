// Door coordinates use the original map's local grid (x right, y up).
// The optional third point records the open leaf direction, never a ROS pose.
const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const dimensions = source => Number.isFinite(source?.widthM) && Number.isFinite(source?.heightM) && source.widthM > 0 && source.heightM > 0;
const inside = (point, source) => finitePoint(point) && point.x >= 0 && point.y >= 0 && point.x <= source.widthM && point.y <= source.heightM;
const copy = point => ({ x: point.x, y: point.y });

function snap(point, source) {
  const epsilon = Math.max(1, source.widthM, source.heightM) * 1e-10;
  const axis = (value, maximum) => Math.abs(value) < epsilon ? 0 : Math.abs(value - maximum) < epsilon ? maximum : value;
  return { x: axis(point.x, source.widthM), y: axis(point.y, source.heightM) };
}

/** All leaf/sweep geometry must remain in the source, including arc extrema. */
export function doorFitsMap(geometry, source) {
  if (!dimensions(source) || !geometry || !finitePoint(geometry.hinge) || !finitePoint(geometry.closed) || !finitePoint(geometry.open)
    || !Number.isFinite(geometry.radius) || geometry.radius <= 0 || !Number.isFinite(geometry.angleDegrees) || Math.abs(geometry.angleDegrees) > 180 + 1e-9) return false;
  const { hinge, closed, open, radius } = geometry;
  const points = [hinge, closed, open];
  const start = Math.atan2(closed.y - hinge.y, closed.x - hinge.x), sweep = geometry.angleDegrees * Math.PI / 180;
  const positive = angle => (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    const distance = positive(sweep >= 0 ? angle - start : start - angle);
    if (distance <= Math.abs(sweep) + 1e-10) points.push({ x: hinge.x + radius * Math.cos(angle), y: hinge.y + radius * Math.sin(angle) });
  }
  return points.every(point => inside(snap(point, source), source));
}

/**
 * Two points mean hinge + closed jamb. A legacy door opens 90 degrees to the
 * left of that directed span, falling back to the other side at the map edge.
 * A third point controls direction; its distance is projected onto door width.
 * angleDegrees is signed in local coordinates; sweep is for SVG's y-down plane.
 */
export function doorGeometry(feature, source) {
  if (!dimensions(source) || !Array.isArray(feature?.points) || feature.points.length < 2) return null;
  const [first, second, third] = feature.points;
  if (!finitePoint(first) || !finitePoint(second) || (third !== undefined && !finitePoint(third))) return null;
  const hinge = copy(first), closed = copy(second), dx = closed.x - hinge.x, dy = closed.y - hinge.y;
  const radius = Math.hypot(dx, dy), epsilon = Math.max(1, source.widthM, source.heightM) * 1e-10;
  if (!Number.isFinite(radius) || radius <= epsilon) return null;
  let open;
  if (third) {
    const length = Math.hypot(third.x - hinge.x, third.y - hinge.y);
    if (!Number.isFinite(length) || length <= epsilon) return null;
    open = snap({ x: hinge.x + (third.x - hinge.x) * radius / length, y: hinge.y + (third.y - hinge.y) * radius / length }, source);
  } else {
    const left = snap({ x: hinge.x - dy, y: hinge.y + dx }, source);
    const right = snap({ x: hinge.x + dy, y: hinge.y - dx }, source);
    const leftFits = doorFitsMap({ hinge, closed, open: left, radius, angleDegrees: 90 }, source);
    const rightFits = doorFitsMap({ hinge, closed, open: right, radius, angleDegrees: -90 }, source);
    open = !leftFits && rightFits ? right : left;
  }
  if (!finitePoint(open)) return null;
  const ox = open.x - hinge.x, oy = open.y - hinge.y;
  const angle = Math.atan2((dx / radius) * (oy / radius) - (dy / radius) * (ox / radius), (dx / radius) * (ox / radius) + (dy / radius) * (oy / radius));
  const angleDegrees = Math.abs(angle) < 1e-12 ? 0 : angle * 180 / Math.PI;
  const sweep = angleDegrees < 0 ? 1 : 0;
  const arcPath = angleDegrees === 0 ? '' : `M ${closed.x} ${source.heightM - closed.y} A ${radius} ${radius} 0 0 ${sweep} ${open.x} ${source.heightM - open.y}`;
  const labelPoint = { x: hinge.x + dx * .4 + ox * .4, y: hinge.y + dy * .4 + oy * .4 };
  return { hinge, closed, open, radius, angleDegrees, sweep, labelPoint, arcPath };
}

/** Return persisted hinge/jamb/open points, or null if the new leaf leaves map. */
export function setDoorOpening(feature, source, { flipSwing = false, swapHinge = false } = {}) {
  const geometry = doorGeometry(feature, source);
  if (!geometry) return null;
  const hinge = copy(swapHinge ? geometry.closed : geometry.hinge);
  const closed = copy(swapHinge ? geometry.hinge : geometry.closed);
  let side = geometry.angleDegrees < 0 ? -1 : 1;
  if (swapHinge) side *= -1; // Keep the leaf on the same physical side of wall.
  if (flipSwing) side *= -1;
  // Preserve manually chosen opening angles; use a visible quarter turn for
  // collinear leaf directions where changing side would otherwise do nothing.
  const magnitude = Math.abs(Math.sin(geometry.angleDegrees * Math.PI / 180)) < 1e-10 ? 90 : Math.abs(geometry.angleDegrees);
  const radians = side * magnitude * Math.PI / 180;
  const c = Math.abs(Math.cos(radians)) < 1e-12 ? 0 : Math.cos(radians);
  const s = Math.abs(Math.sin(radians)) < 1e-12 ? 0 : Math.sin(radians);
  const dx = closed.x - hinge.x, dy = closed.y - hinge.y;
  const open = snap({ x: hinge.x + c * dx - s * dy, y: hinge.y + s * dx + c * dy }, source);
  const points = [hinge, closed, open];
  return points.every(point => inside(point, source)) && doorFitsMap(doorGeometry({ points }, source), source) ? points : null;
}
