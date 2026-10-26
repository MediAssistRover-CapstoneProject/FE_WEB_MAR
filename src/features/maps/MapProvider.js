import model from './localMockMap.generated.json' with { type: 'json' };

// One provider only. File upload / ROS / database providers are not implemented.
export const localMockMap = model;
export const MapSource = 'LOCAL_MOCK';
export const getMapModel = () => model;

export function pixelToRos(p, m = model) {
  const [ox, oy, yaw] = m.origin, r = m.resolution;
  const a = p.x*r, b = (m.height-p.y)*r;
  return { x: ox+Math.cos(yaw)*a-Math.sin(yaw)*b, y: oy+Math.sin(yaw)*a+Math.cos(yaw)*b };
}
export function rosToPixel(p, m = model) {
  const [ox, oy, yaw] = m.origin, a = p.x-ox, b = p.y-oy;
  return { x: (Math.cos(yaw)*a+Math.sin(yaw)*b)/m.resolution, y: m.height-(-Math.sin(yaw)*a+Math.cos(yaw)*b)/m.resolution };
}
export function viewTransform(m = model) {
  const { width, height, padding, rotationRad: angle } = m.coordinateTransform.view;
  const c = Math.cos(angle), s = Math.sin(angle);
  const boundsW = Math.abs(m.width*c)+Math.abs(m.height*s);
  const boundsH = Math.abs(m.width*s)+Math.abs(m.height*c);
  return { width, height, angle, c, s, scale: Math.min((width-2*padding)/boundsW, (height-2*padding)/boundsH) };
}
export function pixelToWeb(p, m = model) {
  const t = viewTransform(m), x = p.x-m.width/2, y = p.y-m.height/2;
  return { x: t.width/2+t.scale*(t.c*x-t.s*y), y: t.height/2+t.scale*(t.s*x+t.c*y) };
}
export function webToPixel(p, m = model) {
  const t = viewTransform(m), x = (p.x-t.width/2)/t.scale, y = (p.y-t.height/2)/t.scale;
  return { x: m.width/2+t.c*x+t.s*y, y: m.height/2-t.s*x+t.c*y };
}
export function webToRos(p, m = model) {
  return { ...pixelToRos(webToPixel(p, m), m), yaw: (p.heading || 0)*Math.PI/180+m.origin[2]+viewTransform(m).angle };
}
export function rosToWeb(p, m = model) {
  return { ...pixelToWeb(rosToPixel(p, m), m), heading: ((p.yaw || 0)-m.origin[2]-viewTransform(m).angle)*180/Math.PI };
}
export function rosToThree(p) { return { x: p.x, y: p.z || 0, z: -p.y }; }
export function occupancyAt(p, m = model) {
  const x = Math.floor(p.x), y = Math.floor(p.y);
  return x >= 0 && y >= 0 && x < m.width && y < m.height ? m.occupancyGrid[y*m.width+x] : -1;
}
export function freeWebPoint(p, clearanceM = 0, m = model) {
  const pixel = webToPixel(p, m), r = clearanceM/m.resolution;
  // Check every cell intersecting the footprint, including unknown cells.
  for (let y = Math.floor(pixel.y-r); y <= Math.floor(pixel.y+r); y++) {
    for (let x = Math.floor(pixel.x-r); x <= Math.floor(pixel.x+r); x++) {
      const dx = Math.max(x-pixel.x, 0, pixel.x-(x+1));
      const dy = Math.max(y-pixel.y, 0, pixel.y-(y+1));
      if (Math.hypot(dx,dy) <= r && occupancyAt({x,y},m) !== 0) return false;
    }
  }
  return occupancyAt(pixel,m) === 0;
}
export function mapBinding() { return { sourceType: MapSource, mapId: model.mapId, mapVersion: model.mapVersion }; }
export function isCurrentMap(snapshot) { return snapshot?.mapSource?.mapId === model.mapId && snapshot?.mapSource?.mapVersion === model.mapVersion; }
