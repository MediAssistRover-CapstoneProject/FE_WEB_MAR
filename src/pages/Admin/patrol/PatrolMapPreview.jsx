import { useEffect, useId, useRef, useState } from 'react';
import { request } from '../../../features/robotOperations/api.js';
import { loadSavedMap } from '../../../features/robotOperations/savedMap.js';
import { mapGeometry } from '../../../features/facility/mapCoordinates.js';
import { patrolMapPose, patrolPresentationMatrix } from '../../../features/patrol/patrolMapModel.js';
import MapRobotMarker from '../../../components/MapRobotMarker.jsx';
import MapPresentationCanvas from '../MapPresentationCanvas.jsx';
import { matchingPresentation, presentationViewport } from '../../../features/operations/monitorPresentation.js';
import './patrolMapPreview.css';

function vertices(value) {
  try {
    const polygon = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(polygon?.points) && polygon.points.length >= 3 && polygon.points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) ? polygon.points : [];
  } catch { return []; }
}

const validPoint = point => Number.isFinite(point?.xM) && Number.isFinite(point?.yM);
const label = point => point.endpointName || point.endpointCode || 'Điểm tuần tra';

export default function PatrolMapPreview({ map, points = [], zones = [], onEndpoint, availableEndpoints = [], snapshot, robotName = 'Robot', targetEndpointId }) {
  const mapId = map?.mapId;
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [presentation, setPresentation] = useState(null), [presentationNotice, setPresentationNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }), [now, setNow] = useState(Date.now());
  const drag = useRef(null);
  const [viewport, setViewport] = useState({ width: 800, height: 450 });
  const svgRef = useRef(null);
  const gridId = `patrol-grid-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    setAsset(null); setError(''); setZoom(1); setPan({ x: 0, y: 0 });
    if (!mapId) return undefined;
    const controller = new AbortController();
    let url;
    loadSavedMap(mapId, request, controller.signal).then(({ metadata, blob }) => {
      const geometry = mapGeometry(metadata);
      if (controller.signal.aborted) return;
      if (map.assetHash && metadata.asset_hash !== map.assetHash) throw new Error('Phiên bản ảnh bản đồ chưa khớp dữ liệu mới nhất. Hãy tải lại trang.');
      url = URL.createObjectURL(blob);
      setAsset({ mapId, url, geometry, metadata, loaded: false });
      const decoded = new Image();
      decoded.onload = () => { if (!controller.signal.aborted) setAsset(value => value?.url === url ? { ...value, loaded: true } : value); };
      decoded.onerror = () => { if (!controller.signal.aborted) setError('Không đọc được ảnh bản đồ đã lưu. Hãy thử tải lại.'); };
      decoded.src = url;
    }).catch(cause => {
      if (!controller.signal.aborted) setError(`Không tải được bản đồ đã lưu. ${cause.message}`);
    });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [mapId, map?.assetHash, map?.versionNo, revision]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer, running = false;
    setPresentation(null); setPresentationNotice('Đang tải giao diện bản đồ đã áp dụng…');
    if (!mapId) return () => controller.abort();
    const load = async () => {
      clearTimeout(timer);
      if (running || controller.signal.aborted || document.hidden) return;
      running = true;
      try {
        const value = await request(`/api/v1/maps/${encodeURIComponent(mapId)}/presentation/published`, { signal: controller.signal });
        if (!controller.signal.aborted) { setPresentation(value); setPresentationNotice(''); }
      } catch (cause) {
        if (!controller.signal.aborted) { setPresentation(null); setPresentationNotice(cause.status === 404 ? 'Chưa có giao diện đã áp dụng. Đang dùng map gốc.' : cause.status === 409 ? 'Giao diện chưa khớp phiên bản bản đồ. Đang dùng map gốc.' : 'Chưa tải được giao diện đã áp dụng. Đang dùng map gốc.'); }
      } finally { running = false; if (!controller.signal.aborted) timer = setTimeout(load, 60000); }
    };
    load(); window.addEventListener('focus', load); document.addEventListener('visibilitychange', load);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', load); };
  }, [mapId, revision]);

  const current = asset?.mapId === mapId ? asset : null;
  const published = matchingPresentation(presentation, current?.metadata);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setViewport({ width, height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [asset?.url, Boolean(published)]);

  if (!mapId) return <div className="pt-map pt-map-empty"><MapIcon /><strong>Chọn tuyến để xem bản đồ</strong><span>Các điểm tuần tra sẽ xuất hiện theo thứ tự trên bản đồ đã lưu.</span></div>;

  const geometry = current?.geometry;
  const corners = geometry ? [[0, 0], [geometry.widthM, 0], [geometry.widthM, geometry.heightM], [0, geometry.heightM]].map(([a, b]) => [geometry.originXM + a * Math.cos(geometry.originYawRad) - b * Math.sin(geometry.originYawRad), geometry.originYM + a * Math.sin(geometry.originYawRad) + b * Math.cos(geometry.originYawRad)]) : null;
  const minX = corners ? Math.min(...corners.map(point => point[0])) : 0;
  const maxX = corners ? Math.max(...corners.map(point => point[0])) : 1;
  const minY = corners ? Math.min(...corners.map(point => point[1])) : 0;
  const maxY = corners ? Math.max(...corners.map(point => point[1])) : 1;
  const size = Math.max(maxX - minX, maxY - minY);
  const pad = size * .08;
  const publishedView = published && presentationViewport(published, zoom, null);
  const viewWidth = publishedView?.width ?? (maxX - minX + pad * 2) / zoom;
  const viewHeight = publishedView?.height ?? (maxY - minY + pad * 2) / zoom;
  const unit = Math.max(viewWidth / viewport.width, viewHeight / viewport.height);
  const pose = current?.loaded && !error ? patrolMapPose(snapshot, current.metadata, geometry, now) : null;
  const fit = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const changeZoom = value => { setZoom(value); if (value === 1) setPan({ x: 0, y: 0 }); };
  const boundedPan = (x, y) => ({ x: Math.max(-size, Math.min(size, x)), y: Math.max(-size, Math.min(size, y)) });
  const startPan = event => {
    if (zoom <= 1 || event.button !== 0 || event.target.closest('[role="button"]')) return;
    drag.current = { x: event.clientX, y: event.clientY, pan };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = event => { if (drag.current) setPan(boundedPan(drag.current.pan.x - (event.clientX - drag.current.x) * unit, drag.current.pan.y - (event.clientY - drag.current.y) * unit)); };
  const endPan = event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const keyboardPan = event => {
    if (event.target !== event.currentTarget) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', '+', '-', '='].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') fit();
    else if (['+', '='].includes(event.key)) changeZoom(Math.min(6, zoom * 1.4));
    else if (event.key === '-') changeZoom(Math.max(1, zoom / 1.4));
    else if (zoom > 1) setPan(boundedPan(pan.x + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) * viewWidth / 10, pan.y + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0) * viewHeight / 10));
  };
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

  const overlay = current?.loaded ? <>
          {zones.filter(zone => zone.mapId === mapId && zone.active === true).map(zone => {
            const polygon = vertices(zone.polygonJson);
            return polygon.length > 0 && <polygon key={zone.zoneId} points={polygon.map(([x, y]) => `${x},${-y}`).join(' ')} fill={zone.zoneType === 'KEEP_OUT' ? '#f43f5e18' : '#2f7df612'} stroke={zone.zoneType === 'KEEP_OUT' ? '#e998a5' : '#93b6e5'} strokeWidth={unit} strokeDasharray={`${unit * 4} ${unit * 4}`}><title>{zone.zoneName}</title></polygon>;
          })}
          {route.slice(1).map((point, index) => visible(point) && visible(route[index]) && <line key={`leg-${index}`} data-patrol-leg={index + 1} x1={route[index].xM} y1={-route[index].yM} x2={point.xM} y2={-point.yM} stroke="#2f7df6" strokeWidth={unit * 2.5} strokeDasharray={`${unit * 5} ${unit * 5}`} strokeLinecap="round" opacity=".8" />)}
          {otherEndpoints.map(point => <g key={point.endpointId} transform={`translate(${point.xM} ${-point.yM})`} role={onEndpoint ? 'button' : undefined} tabIndex={onEndpoint ? 0 : undefined} aria-label={`Thêm ${label(point)} vào tuyến`} onClick={event => select(event, point)} onKeyDown={event => select(event, point)} className={onEndpoint ? 'pt-map-point-button' : undefined}>
            <circle r={unit * 8} fill="#fff" stroke="#8297b6" strokeWidth={unit * 2} /><circle r={unit * 2.3} fill="#8297b6" /><title>{label(point)}</title>
          </g>)}
          {route.filter(visible).map(point => <g key={`stop-${point.routeNumber}`} transform={`translate(${point.xM} ${-point.yM})`} role={onEndpoint ? 'button' : undefined} tabIndex={onEndpoint ? 0 : undefined} aria-label={`Điểm ${point.routeNumber}: ${label(point)}`} onClick={event => select(event, point)} onKeyDown={event => select(event, point)} className={onEndpoint ? 'pt-map-point-button' : undefined}>
            <circle r={unit * 21} fill={point.endpointId === targetEndpointId ? '#10b981' : '#2f7df6'} opacity=".14" /><circle r={unit * 13} fill={point.endpointId === targetEndpointId ? '#159577' : '#2f7df6'} stroke="#fff" strokeWidth={unit * 3} /><text y={unit * .5} transform={published ? `rotate(${-geometry.originYawRad * 180 / Math.PI - (published.document.rotationDegrees || 0)})` : undefined} textAnchor="middle" dominantBaseline="central" fontFamily="inherit" fontWeight="700" fontSize={unit * 12} fill="#fff" pointerEvents="none">{point.routeNumber}</text><title>{point.routeNumber}. {label(point)}</title>
          </g>)}
          {pose && <g data-patrol-robot="" transform={`translate(${pose.xM} ${-pose.yM}) rotate(${-pose.yawRad * 180 / Math.PI})`}><MapRobotMarker length={unit * 32} live={pose.live}/><title>{robotName} · {pose.live ? 'Vị trí trực tiếp' : 'Vị trí gần nhất, chưa cập nhật'}</title></g>}

  </> : null;

  return <div className="pt-map">
    <div className="pt-map-toolbar">
      <span className="pt-map-saved"><MapIcon/>{published ? 'Bản đồ đã áp dụng' : 'Bản đồ đã lưu'}{map.versionNo ? ` · v${map.versionNo}` : ''}</span>
      <div className="pt-map-zoom" role="group" aria-label="Điều chỉnh bản đồ">
        <button type="button" aria-label="Thu nhỏ bản đồ" onClick={() => changeZoom(Math.max(1, zoom / 1.4))} disabled={!current?.loaded || zoom <= 1}>−</button>
        <button type="button" onClick={fit} disabled={!current?.loaded} aria-label="Vừa khung bản đồ">Vừa khung</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Phóng to bản đồ" onClick={() => changeZoom(Math.min(6, zoom * 1.4))} disabled={!current?.loaded || zoom >= 6}>+</button>
      </div>
    </div>
    <div className="pt-map-canvas" data-map-view={published ? 'published' : 'original'}>
      {geometry && published && <MapPresentationCanvas source={published.source} document={published.document} preview
        imageUrl={current.url} opacity={published.document.features.length ? 0 : 1} svgRef={svgRef}
        className={`pt-map-svg ${zoom > 1 ? 'pt-map-can-pan' : ''}`} role="group" tabIndex={0}
        aria-label={`Bản đồ ${map.mapName || ''}, thứ tự ${points.length} điểm tuần tra`}
        viewBox={`${publishedView.x + pan.x} ${publishedView.y + pan.y} ${viewWidth} ${viewHeight}`}
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onKeyDown={keyboardPan}>
        <g transform={`matrix(${patrolPresentationMatrix(geometry).join(' ')})`}>{overlay}</g>
      </MapPresentationCanvas>}
      {geometry && !published && <svg ref={svgRef} className={`pt-map-svg ${zoom > 1 ? 'pt-map-can-pan' : ''}`} role="group" tabIndex={0} aria-label={`Bản đồ ${map.mapName || ''}, thứ tự ${points.length} điểm tuần tra`} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onKeyDown={keyboardPan} viewBox={`${(minX + maxX - viewWidth) / 2 + pan.x} ${(-minY -maxY - viewHeight) / 2 + pan.y} ${viewWidth} ${viewHeight}`}>
        <defs><pattern id={gridId} width={size / 20} height={size / 20} patternUnits="userSpaceOnUse"><path d={`M ${size / 20} 0 H 0 V ${size / 20}`} fill="none" stroke="#dce5ee" strokeWidth={unit * .7} /></pattern></defs>
        <rect x={minX - size * 2} y={-maxY - size * 2} width={size * 5} height={size * 5} fill={`url(#${gridId})`} />
        <image href={current.url} x="0" y={-geometry.heightM} width={geometry.widthM} height={geometry.heightM} preserveAspectRatio="none" transform={`translate(${geometry.originXM} ${-geometry.originYM}) rotate(${-geometry.originYawRad * 180 / Math.PI})`} style={{ imageRendering: 'pixelated' }} onLoad={() => setAsset(value => value?.url === current.url ? { ...value, loaded: true } : value)} onError={() => { setError('Không đọc được ảnh bản đồ đã lưu. Hãy thử tải lại.'); setAsset(value => value?.url === current.url ? { ...value, loaded: false } : value); }} />
        {overlay}
      </svg>}
      {!current?.loaded && !error && <div className="pt-map-overlay" role="status"><span className="pt-map-spinner" /><strong>Đang tải bản đồ…</strong></div>}
      {error && <div className="pt-map-overlay pt-map-error" role="alert"><MapIcon /><strong>Chưa xem được bản đồ</strong><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Tải lại bản đồ</button></div>}
    </div>
    <div className="pt-map-footer"><span className="pt-map-legend"><i />Thứ tự điểm tuần tra</span><span>{pose ? `${robotName} · ${pose.live ? 'Vị trí trực tiếp' : 'Vị trí gần nhất, chưa cập nhật'}` : snapshot ? 'Chưa có vị trí robot hợp lệ trên bản đồ này' : 'Chọn robot để xem vị trí thực tế'}</span></div>
    {current?.loaded && <div className="pt-map-help">{zoom > 1 ? 'Kéo bản đồ để di chuyển · Phím mũi tên để dịch chuyển · Home để vừa khung' : 'Phóng to để xem chi tiết và kéo bản đồ'}</div>}
    {current?.loaded && <p className="pt-map-presentation-status" role="status">{published ? 'Đang dùng cùng giao diện bản đồ đã áp dụng với trang Vận hành trực tiếp.' : presentationNotice || 'Giao diện bản đồ chưa khớp phiên bản map. Đang dùng map gốc.'}</p>}
    {missingCount > 0 && <p className="pt-map-warning" role="status">{missingCount} điểm chưa có tọa độ hợp lệ trên bản đồ này. Hãy kiểm tra lại tuyến.</p>}
  </div>;
}

function MapIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" strokeLinejoin="round" /><path d="M9 3v15M15 6v15" /></svg>;
}
