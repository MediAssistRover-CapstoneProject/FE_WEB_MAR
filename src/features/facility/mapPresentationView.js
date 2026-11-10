// Presentation transforms never change the map's local grid or ROS coordinates.
// Positive angles follow SVG's clockwise rotation in its x-right / y-down plane.
export function normalizeRotation(degrees) {
  if (!Number.isFinite(degrees)) throw new RangeError('Góc xoay phải là số hữu hạn.');
  let value = Math.round((((degrees + 180) % 360 + 360) % 360 - 180) * 1e6) / 1e6;
  if (value >= 180) value -= 360;
  return value === 0 ? 0 : value;
}

function dimensions(source) {
  if (!Number.isFinite(source?.widthM) || !Number.isFinite(source?.heightM) || source.widthM <= 0 || source.heightM <= 0) {
    throw new RangeError('Kích thước map phải là số dương hữu hạn.');
  }
  return { width: source.widthM, height: source.heightM };
}

function finitePoint(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new TypeError('Tọa độ phải là số hữu hạn.');
}

function rotateSvg(point, width, height, degrees) {
  const radians = normalizeRotation(degrees) * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  // Exact quarter-turns must not leave a tiny negative vertex outside the map.
  const c = Math.abs(cosine) < 1e-12 ? 0 : cosine, s = Math.abs(sine) < 1e-12 ? 0 : sine;
  const dx = point.x - width / 2, dy = point.y - height / 2;
  return { x: width / 2 + c * dx - s * dy, y: height / 2 + s * dx + c * dy };
}

export function toView(point, source, degrees = 0) {
  const { width, height } = dimensions(source);
  finitePoint(point);
  return rotateSvg({ x: point.x, y: height - point.y }, width, height, degrees);
}

export function fromView(point, source, degrees = 0) {
  const { width, height } = dimensions(source);
  finitePoint(point);
  const raw = rotateSvg(point, width, height, -degrees), epsilon = Math.max(1, width, height) * 1e-10;
  const snap = (value, maximum) => Math.abs(value) < epsilon ? 0 : Math.abs(value - maximum) < epsilon ? maximum : value;
  return { x: snap(raw.x, width), y: snap(height - raw.y, height) };
}

export function rotationBounds(source, degrees = 0) {
  const { width, height } = dimensions(source);
  const corners = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }].map(point => toView(point, source, degrees));
  const minX = Math.min(...corners.map(point => point.x)), maxX = Math.max(...corners.map(point => point.x));
  const minY = Math.min(...corners.map(point => point.y)), maxY = Math.max(...corners.map(point => point.y));
  return { x: minX === 0 ? 0 : minX, y: minY === 0 ? 0 : minY, width: maxX - minX, height: maxY - minY };
}

export function contentBounds(source, features = [], endpoints = [], degrees = 0) {
  const rotBounds = rotationBounds(source, degrees);
  if (!features || !features.length) return rotBounds;

  const allPoints = [];
  features.forEach(f => {
    if (Array.isArray(f.points)) {
      f.points.forEach(p => {
        if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
          allPoints.push(toView(p, source, degrees));
        }
      });
    }
  });

  if (Array.isArray(endpoints)) {
    endpoints.forEach(e => {
      if (Number.isFinite(Number(e.xM)) && Number.isFinite(Number(e.yM))) {
        const dx = Number(e.xM) - (source.originXM || 0), dy = Number(e.yM) - (source.originYM || 0);
        const c = Math.cos(source.originYawRad || 0), s = Math.sin(source.originYawRad || 0);
        const lx = c * dx + s * dy, ly = -s * dx + c * dy;
        if (lx >= 0 && ly >= 0 && lx <= source.widthM && ly <= source.heightM) {
          allPoints.push(toView({ x: lx, y: ly }, source, degrees));
        }
      }
    });
  }

  if (allPoints.length < 3) return rotBounds;

  const xs = allPoints.map(p => p.x), ys = allPoints.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = Math.max(0.1, maxX - minX), height = Math.max(0.1, maxY - minY);

  // 7% lề thoáng xung quanh giúp các phòng không bao giờ bị cấn mép khung hình
  const padX = Math.max(0.25, width * 0.07);
  const padY = Math.max(0.25, height * 0.07);

  return {
    x: Math.round((minX - padX) * 1000) / 1000,
    y: Math.round((minY - padY) * 1000) / 1000,
    width: Math.round((width + padX * 2) * 1000) / 1000,
    height: Math.round((height + padY * 2) * 1000) / 1000,
  };
}

export function viewRectangle(a, b, source, degrees = 0) {
  const start = toView(a, source, degrees), end = toView(b, source, degrees);
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  return [{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }].map(point => fromView(point, source, degrees));
}

export function straightenRotation(a, b, source, currentDegrees = 0) {
  const start = toView(a, source, currentDegrees), end = toView(b, source, currentDegrees);
  if (Math.hypot(end.x - start.x, end.y - start.y) <= Math.max(1, source.widthM, source.heightM) * 1e-10) return null;
  const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
  // Treat a wall as an undirected line, so reversing the picked points gives
  // the same correction, including a diagonal exactly between the two axes.
  const misalignment = ((angle + 45) % 90 + 90) % 90 - 45;
  return normalizeRotation(currentDegrees - misalignment);
}
