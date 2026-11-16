import { useEffect, useId, useRef, useState } from 'react';
import { request } from '../../../features/robotOperations/api.js';
import { loadSavedMap } from '../../../features/robotOperations/savedMap.js';
import { mapGeometry } from '../../../features/facility/mapCoordinates.js';
import './patrolMapPreview.css';

function vertices(value) {
  try {
    const polygon = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(polygon?.points) && polygon.points.length >= 3 && polygon.points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) ? polygon.points : [];
  } catch { return []; }
}

const validPoint = point => Number.isFinite(point?.xM) && Number.isFinite(point?.yM);
const label = point => point.endpointName || point.endpointCode || 'Điểm tuần tra';

export default function PatrolMapPreview({ map, points = [], zones = [], onEndpoint, availableEndpoints = [] }) {
  const mapId = map?.mapId;
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: 800, height: 450 });
  const svgRef = useRef(null);
  const gridId = `patrol-grid-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    setAsset(null); setError(''); setZoom(1);
    if (!mapId) return undefined;
    const controller = new AbortController();
    let url;
    loadSavedMap(mapId, request, controller.signal).then(({ metadata, blob }) => {
      const geometry = mapGeometry(metadata);
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setAsset({ mapId, url, geometry, loaded: false });
    }).catch(cause => {
      if (!controller.signal.aborted) setError(`Không tải được bản đồ đã lưu. ${cause.message}`);
    });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [mapId, revision]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setViewport({ width, height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [asset?.url]);

  if (!mapId) return <div className="pt-map pt-map-empty"><MapIcon /><strong>Chọn tuyến để xem bản đồ</strong><span>Các điểm tuần tra sẽ xuất hiện theo thứ tự trên bản đồ đã lưu.</span></div>;

  const current = asset?.mapId === mapId ? asset : null;
  const geometry = current?.geometry;
  const corners = geometry ? [[0, 0], [geometry.widthM, 0], [geometry.widthM, geometry.heightM], [0, geometry.heightM]].map(([a, b]) => [geometry.originXM + a * Math.cos(geometry.originYawRad) - b * Math.sin(geometry.originYawRad), geometry.originYM + a * Math.sin(geometry.originYawRad) + b * Math.cos(geometry.originYawRad)]) : null;
  const minX = corners ? Math.min(...corners.map(point => point[0])) : 0;
  const maxX = corners ? Math.max(...corners.map(point => point[0])) : 1;
  const minY = corners ? Math.min(...corners.map(point => point[1])) : 0;
  const maxY = corners ? Math.max(...corners.map(point => point[1])) : 1;
  const size = Math.max(maxX - minX, maxY - minY);
  const pad = size * .08;
  const viewWidth = (maxX - minX + pad * 2) / zoom;
  const viewHeight = (maxY - minY + pad * 2) / zoom;
  const unit = Math.max(viewWidth / viewport.width, viewHeight / viewport.height);
  const visible = point => validPoint(point) && (!point.mapId || point.mapId === mapId);
  const route = points.map((point, index) => ({ ...point, routeNumber: index + 1 }));
  const missingCount = route.filter(point => !visible(point)).length;
  const routeIds = new Set(route.map(point => point.endpointId));
  const otherEndpoints = availableEndpoints.filter(point => point.active === true && visible(point) && !routeIds.has(point.endpointId));
  const select = (event, point) => {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    if (event.type === 'keydown') event.preventDefault();
    onEndpoint?.(point);
  };

  return <div className="pt-map">
    <div className="pt-map-toolbar">
      <span className="pt-map-saved"><span />Bản đồ đã lưu</span>
      <div className="pt-map-zoom" role="group" aria-label="Điều chỉnh bản đồ">
        <button type="button" aria-label="Thu nhỏ bản đồ" onClick={() => setZoom(value => Math.max(1, value / 1.4))} disabled={!current?.loaded || zoom <= 1}>−</button>
        <button type="button" onClick={() => setZoom(1)} disabled={!current?.loaded} aria-label="Vừa khung bản đồ">Vừa khung</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Phóng to bản đồ" onClick={() => setZoom(value => Math.min(6, value * 1.4))} disabled={!current?.loaded || zoom >= 6}>+</button>
      </div>
    </div>
    <div className="pt-map-canvas">
      {geometry && <svg ref={svgRef} className="pt-map-svg" role={onEndpoint ? 'group' : 'img'} aria-label={`Bản đồ ${map.mapName || ''}, thứ tự ${points.length} điểm tuần tra`} viewBox={`${(minX + maxX - viewWidth) / 2} ${(-minY - maxY - viewHeight) / 2} ${viewWidth} ${viewHeight}`}>
        <defs><pattern id={gridId} width={size / 20} height={size / 20} patternUnits="userSpaceOnUse"><path d={`M ${size / 20} 0 H 0 V ${size / 20}`} fill="none" stroke="#dce5ee" strokeWidth={unit * .7} /></pattern></defs>
        <rect x={(minX + maxX - viewWidth) / 2} y={(-minY - maxY - viewHeight) / 2} width={viewWidth} height={viewHeight} fill={`url(#${gridId})`} />
        <image href={current.url} x="0" y={-geometry.heightM} width={geometry.widthM} height={geometry.heightM} preserveAspectRatio="none" transform={`translate(${geometry.originXM} ${-geometry.originYM}) rotate(${-geometry.originYawRad * 180 / Math.PI})`} style={{ imageRendering: 'pixelated' }} onLoad={() => setAsset(value => value?.url === current.url ? { ...value, loaded: true } : value)} onError={() => { setError('Không đọc được ảnh bản đồ đã lưu. Hãy thử tải lại.'); setAsset(value => value?.url === current.url ? { ...value, loaded: false } : value); }} />
        {current.loaded && <>
          {zones.filter(zone => zone.mapId === mapId && zone.active === true).map(zone => {
            const polygon = vertices(zone.polygonJson);
            return polygon.length > 0 && <polygon key={zone.zoneId} points={polygon.map(([x, y]) => `${x},${-y}`).join(' ')} fill={zone.zoneType === 'KEEP_OUT' ? '#f43f5e18' : '#2f7df612'} stroke={zone.zoneType === 'KEEP_OUT' ? '#e998a5' : '#93b6e5'} strokeWidth={unit} strokeDasharray={`${unit * 4} ${unit * 4}`}><title>{zone.zoneName}</title></polygon>;
          })}
          {route.slice(1).map((point, index) => visible(point) && visible(route[index]) && <line key={`leg-${index}`} data-patrol-leg={index + 1} x1={route[index].xM} y1={-route[index].yM} x2={point.xM} y2={-point.yM} stroke="#2f7df6" strokeWidth={unit * 2.5} strokeDasharray={`${unit * 5} ${unit * 5}`} strokeLinecap="round" opacity=".8" />)}
          {otherEndpoints.map(point => <g key={point.endpointId} transform={`translate(${point.xM} ${-point.yM})`} role={onEndpoint ? 'button' : undefined} tabIndex={onEndpoint ? 0 : undefined} aria-label={`Thêm ${label(point)} vào tuyến`} onClick={event => select(event, point)} onKeyDown={event => select(event, point)} className={onEndpoint ? 'pt-map-point-button' : undefined}>
            <circle r={unit * 8} fill="#fff" stroke="#8297b6" strokeWidth={unit * 2} /><circle r={unit * 2.3} fill="#8297b6" /><title>{label(point)}</title>
          </g>)}
          {route.filter(visible).map(point => <g key={`stop-${point.routeNumber}`} transform={`translate(${point.xM} ${-point.yM})`} role={onEndpoint ? 'button' : undefined} tabIndex={onEndpoint ? 0 : undefined} aria-label={`Điểm ${point.routeNumber}: ${label(point)}`} onClick={event => select(event, point)} onKeyDown={event => select(event, point)} className={onEndpoint ? 'pt-map-point-button' : undefined}>
            <circle r={unit * 19} fill="#2f7df6" opacity=".12" /><circle r={unit * 13} fill="#2f7df6" stroke="#fff" strokeWidth={unit * 3} /><text y={unit * .5} textAnchor="middle" dominantBaseline="central" fontFamily="inherit" fontWeight="700" fontSize={unit * 12} fill="#fff" pointerEvents="none">{point.routeNumber}</text><title>{point.routeNumber}. {label(point)}</title>
          </g>)}
        </>}
      </svg>}
      {!current?.loaded && !error && <div className="pt-map-overlay" role="status"><span className="pt-map-spinner" /><strong>Đang tải bản đồ…</strong></div>}
      {error && <div className="pt-map-overlay pt-map-error" role="alert"><MapIcon /><strong>Chưa xem được bản đồ</strong><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Tải lại bản đồ</button></div>}
    </div>
    <div className="pt-map-footer"><span className="pt-map-legend"><i />Thứ tự điểm tuần tra</span><span>Đường nối minh họa thứ tự, không phải đường di chuyển thực tế.</span></div>
    {missingCount > 0 && <p className="pt-map-warning" role="status">{missingCount} điểm chưa có tọa độ hợp lệ trên bản đồ này. Hãy kiểm tra lại tuyến.</p>}
  </div>;
}

function MapIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" strokeLinejoin="round" /><path d="M9 3v15M15 6v15" /></svg>;
}
