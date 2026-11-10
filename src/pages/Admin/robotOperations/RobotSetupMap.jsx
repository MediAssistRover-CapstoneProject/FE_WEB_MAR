import { memo, useRef, useState, useSyncExternalStore } from 'react';
import { endpointHeading, snapMapPoint } from '../../../features/facility/mapCoordinates.js';
import { setupContext, setupLivePose } from '../../../features/robotOperations/robotSetup.js';

const number = value => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default memo(function RobotSetupMap({ asset, endpoints, seed, pose, snapshot, poseFeed, allowLivePose, choosing, disabled, onPoint, onEndpoint, onLoaded, onImageError, onReload, reloading }) {
  const svgRef = useRef(null), drag = useRef(null);
  const [zoom, setZoom] = useState(1);
  const livePose = useSyncExternalStore(poseFeed.subscribe, poseFeed.getSnapshot, poseFeed.getSnapshot);
  const current = (allowLivePose && setupLivePose(livePose, snapshot, asset)) || pose;
  const scope = JSON.stringify([asset?.mapId, asset?.metadata.asset_hash, setupContext(snapshot)]);
  const remembered = useRef(null);
  if (remembered.current?.scope !== scope) remembered.current = null;
  if (current) remembered.current = { scope, pose: current };
  const displayPose = current || remembered.current?.pose;
  if (!asset) return <div className="rsu-map-empty"><span aria-hidden="true">⌖</span><strong>Chọn bản đồ để bắt đầu</strong><p>Bản đồ quét và vị trí robot sẽ xuất hiện tại đây.</p></div>;
  const map = asset.geometry, yaw = map.originYawRad, w = map.widthM, h = map.heightM;
  const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => ({ x: map.originXM + Math.cos(yaw) * x - Math.sin(yaw) * y, y: map.originYM + Math.sin(yaw) * x + Math.cos(yaw) * y }));
  const left = Math.min(...corners.map(p => p.x)), right = Math.max(...corners.map(p => p.x)), bottom = Math.min(...corners.map(p => p.y)), top = Math.max(...corners.map(p => p.y));
  const size = Math.max(right - left, top - bottom), pad = size * .08, width = (right - left + 2 * pad) / zoom, height = (top - bottom + 2 * pad) / zoom;
  const unit = size / 90;
  const worldPoint = event => {
    const matrix = svgRef.current?.getScreenCTM(); if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { xM: p.x, yM: -p.y };
  };
  const marker = (point, color, label, key) => point && <g key={key} className="rsu-pose-marker" data-pose={key} transform={`translate(${point.xM} ${-point.yM})`} pointerEvents="none">
    <circle r={unit * 1.8} fill={color} opacity=".13" />
    <g transform={`rotate(${-point.yawRad * 180 / Math.PI})`}><circle r={unit * .65} fill={color} stroke="white" strokeWidth={unit * .2} /><path d={`M ${unit * .5} 0 H ${unit * 2.6} M ${unit * 1.6} ${-unit * .8} L ${unit * 2.6} 0 L ${unit * 1.6} ${unit * .8}`} fill="none" stroke={color} strokeWidth={unit * .4} strokeLinecap="round" strokeLinejoin="round" /></g>
    <title>{label}</title>
  </g>;
  const release = () => { drag.current = null; };
  return <div className="rsu-map-view">
    <div className="rsu-map-tools"><span>{choosing ? 'Bấm vị trí, kéo theo hướng robot rồi thả' : 'Bản đồ quét đã lưu'}</span><div><button type="button" aria-label="Thu nhỏ bản đồ thiết lập" onClick={() => setZoom(v => Math.max(1, v / 1.3))}>−</button><button type="button" onClick={() => setZoom(1)}>Vừa khung</button><button type="button" aria-label="Phóng to bản đồ thiết lập" onClick={() => setZoom(v => Math.min(5, v * 1.3))}>+</button></div></div>
    <svg ref={svgRef} role="img" aria-label="Bản đồ thiết lập vận hành" viewBox={`${(left + right) / 2 - width / 2} ${-(bottom + top) / 2 - height / 2} ${width} ${height}`} style={{ touchAction: choosing ? 'none' : 'pan-y', cursor: choosing && !disabled ? 'crosshair' : 'default' }} onPointerDown={event => {
      if (!choosing || disabled || !asset.loaded || event.button !== 0) return;
      const p = worldPoint(event), point = p && snapMapPoint(map, p.xM, p.yM); if (!point) return;
      event.preventDefault(); drag.current = { point, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId); onPoint({ ...point, yawRad: seed?.yawRad || 0 });
    }} onPointerMove={event => {
      if (!drag.current || disabled) return;
      const p = worldPoint(event); if (p && Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 5) onPoint({ ...drag.current.point, yawRad: endpointHeading(drag.current.point, p) });
    }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      <image href={asset.url} x="0" y={-h} width={w} height={h} preserveAspectRatio="none" transform={`translate(${map.originXM} ${-map.originYM}) rotate(${-yaw * 180 / Math.PI})`} onLoad={onLoaded} onError={onImageError} style={{ imageRendering: 'pixelated' }} />
      {endpoints.map(point => <g key={point.endpointId} data-seed-endpoint={point.endpointId} role="button" tabIndex={disabled ? -1 : 0} aria-label={`Chọn vị trí ${point.endpointName}`} aria-disabled={disabled} transform={`translate(${point.xM} ${-point.yM})`} onPointerDown={event => event.stopPropagation()} onClick={() => { if (!disabled) onEndpoint(point); }} onKeyDown={event => { if (!disabled && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onEndpoint(point); } }}>
        <circle r={unit * 1.7} fill="transparent" /><circle r={unit * .55} fill={point.endpointType === 'PARK' ? '#0f766e' : '#64748b'} stroke="white" strokeWidth={unit * .18} /><title>{point.endpointName}</title>
      </g>)}
      {marker(seed, '#d97706', 'Vị trí khởi tạo dự kiến', 'seed')}
      {marker(displayPose, current ? '#2563eb' : '#8793a3', current ? 'Vị trí robot đã xác minh' : 'Vị trí cuối — đang chờ xác minh', current ? 'verified' : 'last')}
    </svg>
    {!asset.loaded && <p role="status">Đang tải ảnh bản đồ…</p>}
    <div className="rsu-map-legend"><span><i className="rsu-dot rsu-dot-blue" />Vị trí đã xác minh</span><span><i className="rsu-dot rsu-dot-last" />Vị trí cuối, chưa xác minh</span><span><i className="rsu-dot rsu-dot-orange" />Vị trí khởi tạo dự kiến</span><span><i className="rsu-dot rsu-dot-teal" />Điểm đỗ / điểm đã lưu</span></div>
    <footer className="rsu-map-footer"><span data-setup-position>{displayPose ? `${current ? 'Robot' : 'Vị trí cuối'}: X ${number(displayPose.xM)} m · Y ${number(displayPose.yM)} m · ${number(displayPose.yawRad * 180 / Math.PI)}°${current ? '' : ' · Đang chờ xác minh'}` : 'Chưa có vị trí robot được xác minh trên bản đồ này.'}</span><button type="button" className="rsu-text-button" disabled={reloading} onClick={onReload}>Tải lại bản đồ</button></footer>
  </div>;
});
