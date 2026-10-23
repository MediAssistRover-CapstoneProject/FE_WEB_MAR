import { useId } from 'react';

export default function PatrolRoutePreview({ route, position }) {
  const gridId = useId();
  const endpoints = route?.points.map((point, index) => ({ ...point.endpoint, order: index + 1 })).filter(point => Number.isFinite(point.xM) && Number.isFinite(point.yM)) ?? [];
  const map = route?.map;
  const yaw = Number(map?.originYawRad) || 0;
  const local = point => {
    const x = point.xM - (Number(map?.originXM) || 0), y = point.yM - (Number(map?.originYM) || 0);
    return { x: x * Math.cos(yaw) + y * Math.sin(yaw), y: -x * Math.sin(yaw) + y * Math.cos(yaw) };
  };
  const coords = endpoints.map(local);
  const minX = Math.min(0, ...coords.map(p => p.x)), minY = Math.min(0, ...coords.map(p => p.y));
  const maxX = Math.max(Number(map?.widthM) || 1, ...coords.map(p => p.x)), maxY = Math.max(Number(map?.heightM) || 1, ...coords.map(p => p.y));
  const scale = Math.min(640 / Math.max(.1, maxX - minX), 330 / Math.max(.1, maxY - minY));
  const project = point => { const p = local(point); return { x: 50 + (p.x - minX) * scale, y: 380 - (p.y - minY) * scale }; };
  const points = endpoints.map(project), robot = position ? project(position) : null;
  return <div className="patrol-coordinate-map">
    <header><strong>{map?.mapName || 'Xem trước tuyến tuần tra'}</strong><span>Sơ đồ tọa độ · Không phải bản đồ điều hướng</span></header>
    {!points.length ? <div className="patrol-map-empty"><span aria-hidden="true">⌖</span><strong>Chọn quy trình để hiện các điểm</strong><p>Điểm và thứ tự lấy từ các bước Di chuyển đã lưu, không cần tạo lại tuyến.</p></div> : <svg viewBox="0 0 740 430" role="img" aria-label="Sơ đồ các điểm đích theo thứ tự của quy trình">
      <defs><pattern id={gridId} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#293e59" strokeWidth=".7" /></pattern></defs>
      <rect width="740" height="430" fill={`url(#${gridId})`} />
      <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#76b6ff" strokeWidth="3" strokeDasharray="7 6" />
      {points.map((p, index) => <g key={index}><circle cx={p.x} cy={p.y} r="14" fill="#2563eb" stroke="white" strokeWidth="2"/><text x={p.x} y={p.y + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{endpoints[index].order}</text><title>{endpoints[index].order}. {endpoints[index].endpointName} ({endpoints[index].xM}, {endpoints[index].yM})</title></g>)}
      {robot && <g transform={`translate(${robot.x},${robot.y})`}><circle r="20" fill="#60a5fa" opacity=".25"/><circle r="9" fill="white" stroke="#1d4ed8" strokeWidth="3"/><title>Vị trí mô phỏng</title></g>}
    </svg>}
    <footer>Đường nét đứt chỉ nối các điểm để xem thứ tự. Chưa tải ảnh bản đồ, chưa kiểm tra vật cản hoặc vùng cấm.</footer>
  </div>;
}
