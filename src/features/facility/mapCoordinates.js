export function mapGeometry(metadata) {
  if (![metadata?.width_px, metadata?.height_px, metadata?.resolution_m_per_pixel].every(v => Number.isFinite(v) && v > 0) || ![metadata.origin_x_m, metadata.origin_y_m, metadata.origin_yaw_rad].every(Number.isFinite)) throw Error('Kích thước hoặc gốc tọa độ ảnh bản đồ không hợp lệ.');
  return { originXM: metadata.origin_x_m, originYM: metadata.origin_y_m, originYawRad: metadata.origin_yaw_rad, widthM: metadata.width_px * metadata.resolution_m_per_pixel, heightM: metadata.height_px * metadata.resolution_m_per_pixel, resolutionMPerPixel: metadata.resolution_m_per_pixel };
}

// Convert world metres to map cells, reject clicks in the surrounding margin,
// then use the cell centre, including when the map origin is rotated.
export function insideMap(map, xM, yM) {
  if (![xM,yM].every(Number.isFinite)) return false;
  const yaw=Number(map.originYawRad||0),c=Math.cos(yaw),s=Math.sin(yaw),dx=xM-Number(map.originXM),dy=yM-Number(map.originYM);
  const x=c*dx+s*dy,v=Number(map.heightM)-(-s*dx+c*dy);
  return x>=0&&v>=0&&x<Number(map.widthM)&&v<Number(map.heightM);
}
export function snapMapPoint(map, xM, yM) {
  const yaw = map.originYawRad, c = Math.cos(yaw), s = Math.sin(yaw), r = map.resolutionMPerPixel;
  const dx = xM - map.originXM, dy = yM - map.originYM;
  const x = c * dx + s * dy, y = -s * dx + c * dy;
  if (![x, y, r].every(Number.isFinite) || r <= 0 || !insideMap(map,xM,yM)) return null;
  const a = (Math.floor(x / r) + .5) * r, b = map.heightM-(Math.floor((map.heightM-y)/r)+.5)*r;
  return { xM: Number((map.originXM + c * a - s * b).toFixed(6)), yM: Number((map.originYM + s * a + c * b).toFixed(6)) };
}

export function endpointHeading(start,end) {
  return Math.atan2(end.yM-start.yM,end.xM-start.xM);
}
