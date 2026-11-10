import { useId } from 'react';
import { featureCenter, svgPoint, worldToLocal, insideMap } from '../../features/facility/mapPresentation.js';
import { rotationBounds } from '../../features/facility/mapPresentationView.js';
import { doorGeometry } from '../../features/facility/doorGeometry.js';
import { visibleWallSegments } from '../../features/facility/mapDrawingAssist.js';
import { areaColor, nextRoomColor, roomColorsFor } from '../../features/facility/roomAppearance.js';
import MapDoorSymbol from './MapDoorSymbol.jsx';

export default function MapPresentationCanvas({ source, document, imageUrl, opacity = 0, endpoints = [], selectedId, preview, points = [], drawingTool, drawingAssist = null, drawingPreview = [], doorPreview = null, onFeatureDown, onVertexDown, svgRef, contentRef, showGrid = false, children, ...events }) {
  const gridId = useId(), rotation = document.rotationDegrees ?? 0, bounds = rotationBounds(source, rotation);
  const screen = p => svgPoint(p, source);
  const pointString = values => values.map(p => { const v = screen(p); return `${v.x},${v.y}`; }).join(' ');
  const markerSize = Math.max(source.widthM, source.heightM) / 220, gridSpacing = Math.max(source.widthM, source.heightM) / 20;
  const matrix = contentRef?.current?.getScreenCTM();
  const pixel = matrix ? 1 / Math.hypot(matrix.a, matrix.b) : Math.max(source.widthM, source.heightM) / 800;
  const hasDrawingPreview = drawingPreview.length > 1 && drawingPreview.some(point => Math.hypot(point.x - drawingPreview[0].x, point.y - drawingPreview[0].y) > 1e-9);
  const ghostDoor = !preview && doorPreview && doorGeometry({ points: doorPreview }, source);
  const visibleFeatures = ghostDoor ? [...document.features, { type: 'DOOR', points: doorPreview }] : document.features;
  const hasDoorSymbols = visibleFeatures.some(feature => feature.type === 'DOOR');
  const snapPoint = drawingAssist?.kind && screen(drawingAssist.point);
  const snapLabels = { vertex: 'Đỉnh', edge: 'Cạnh', alignment: 'Căn hàng', axis: 'Ngang/dọc' };
  const roomColors = roomColorsFor(document.features);
  const pendingArea = ['ROOM', 'CORRIDOR', 'polygon'].includes(drawingTool) && points.length >= 3;
  const pendingColor = pendingArea && (drawingTool === 'CORRIDOR' ? '#64748b' : nextRoomColor(points, document.features));
  return <svg ref={svgRef} tabIndex={0} className="mp-canvas" viewBox={`0 0 ${source.widthM} ${source.heightM}`} aria-label="Bản đồ đang chỉnh giao diện" {...events}>
    <g ref={contentRef} className="mp-map-content" transform={`rotate(${rotation} ${source.widthM / 2} ${source.heightM / 2})`}>
    <rect width={source.widthM} height={source.heightM} fill={document.backgroundColor} />
    {imageUrl && opacity > 0 && <image href={imageUrl} width={source.widthM} height={source.heightM} opacity={opacity} preserveAspectRatio="none" pointerEvents="none" />}
    {document.features.map(feature => {
      const door = feature.type === 'DOOR' ? doorGeometry(feature, source) : null;
      const center = screen(door ? door.labelPoint : featureCenter(feature)), polygon = ['ROOM', 'CORRIDOR'].includes(feature.type), single = ['LABEL', 'LANDMARK'].includes(feature.type), selected = selectedId === feature.id && !preview;
      const color = polygon && areaColor(feature, roomColors);
      const wallSegments = feature.type === 'WALL' && hasDoorSymbols && visibleWallSegments(feature, visibleFeatures);
      const epsilon = Math.max(1, source.widthM, source.heightM) * 1e-9;
      const cutWall = wallSegments && (wallSegments.length !== feature.points.length - 1 || wallSegments.some(({ a, b }, i) => Math.hypot(a.x - feature.points[i].x, a.y - feature.points[i].y) > epsilon || Math.hypot(b.x - feature.points[i + 1].x, b.y - feature.points[i + 1].y) > epsilon));
      return <g key={feature.id} data-feature-id={feature.id} onPointerDown={event => onFeatureDown?.(event, feature)} style={{ cursor: onFeatureDown ? 'move' : 'default' }}>
        {door ? <MapDoorSymbol geometry={door} source={source} color={feature.color} lineWidth={feature.lineWidthM} selected={selected}/> : !single && (polygon ? <polygon points={pointString(feature.points)} fill={color} fillOpacity={selected ? .26 : .16} stroke={color} strokeOpacity={selected ? 1 : .88} strokeWidth={selected ? 2 : 1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : cutWall ? <g>
          <path d={feature.points.map((point, i) => { const p = screen(point); return `${i ? 'L' : 'M'} ${p.x} ${p.y}`; }).join(' ')} fill="none" stroke="transparent" strokeWidth={Math.max(feature.lineWidthM, 6 * pixel)} pointerEvents="stroke" />
          {wallSegments.map(({ a, b }, i) => { const start = screen(a), end = screen(b); return <line key={i} className="mp-wall-segment" x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={feature.color} strokeWidth={feature.lineWidthM} strokeLinecap="round" />; })}
        </g> : <polyline points={pointString(feature.points)} fill="none" stroke={feature.color} strokeWidth={feature.lineWidthM} strokeLinecap="round" strokeLinejoin="round" />)}
        {feature.type === 'LANDMARK' && <circle cx={center.x} cy={center.y} r={feature.fontSizeM * .85} fill={feature.color} opacity={.15} />}
        {feature.label && <g transform={`rotate(${-rotation} ${center.x} ${center.y})`} pointerEvents="none">
          <text x={center.x} y={center.y} textAnchor="middle" dominantBaseline="central" fill="#ffffff" stroke="#ffffff" strokeWidth={Math.max(0.03, feature.fontSizeM * 0.26)} strokeLinejoin="round" fontSize={feature.fontSizeM} fontWeight="700">{feature.label}</text>
          <text x={center.x} y={center.y} textAnchor="middle" dominantBaseline="central" fill={single ? feature.color : '#0f172a'} fontSize={feature.fontSizeM} fontWeight="700">{feature.label}</text>
        </g>}
        {selected && feature.points.map((p, index) => { const v = screen(p); return <circle key={index} cx={v.x} cy={v.y} r={markerSize * .8} fill="white" stroke="#60a5fa" strokeWidth={1} vectorEffect="non-scaling-stroke" onPointerDown={event => onVertexDown?.(event, feature, index)} style={{ cursor: 'crosshair' }}><title>{door ? ['Bản lề', 'Mép cửa · Kéo để đổi chiều rộng', 'Đầu cánh · Kéo để chỉnh góc minh họa'][index] : `Đỉnh ${index + 1}`}</title></circle>; })}
      </g>;
    })}
    {endpoints.filter(e => e.active && e.accessible).map(endpoint => {
      const local = worldToLocal(endpoint, source); if (!insideMap(local, source)) return null;
      const p = screen(local);
      return <g key={endpoint.endpointId} pointerEvents="none"><circle cx={p.x} cy={p.y} r={markerSize * 1.5} fill="rgba(37, 99, 235, 0.2)" /><circle cx={p.x} cy={p.y} r={markerSize} fill="#2563eb" stroke="white" strokeWidth={markerSize / 3} /><title>{endpoint.endpointName}</title></g>;
    })}
    {!preview && <g className="mp-drawing-overlays" pointerEvents="none" aria-hidden="true">
      {drawingAssist?.edge && (() => { const a = screen(drawingAssist.edge.a), b = screen(drawingAssist.edge.b); return <line className="mp-snap-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0d9488" strokeWidth={4} strokeOpacity={.3} vectorEffect="non-scaling-stroke" />; })()}
      {drawingAssist?.guides?.map((guide, i) => { const a = screen(guide.a), b = screen(guide.b); return <line key={i} className="mp-snap-guide" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0d9488" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />; })}
      {pendingArea ? <polygon className="mp-pending-area" points={pointString(points)} fill={pendingColor} fillOpacity={.1} stroke={pendingColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="4 4" /> : points.length > 1 && <polyline className="mp-pending-shape" points={pointString(points)} fill="none" stroke="#3b82f6" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />}
      {hasDrawingPreview && <polyline className="mp-drawing-preview" points={pointString(drawingPreview)} fill="none" stroke="#3b82f6" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="5 4" />}
      {points.map((point, i) => { const p = screen(point); return <circle key={i} cx={p.x} cy={p.y} r={3 * pixel} fill="#3b82f6" />; })}
      {ghostDoor && <g className="mp-drawing-preview mp-door-preview" opacity={.65}><MapDoorSymbol geometry={ghostDoor} source={source} color="#2563eb" lineWidth={2 * pixel} /></g>}
      {snapPoint && <g className="mp-snap-target mp-snap-indicator" data-snap-kind={drawingAssist.kind} transform={`translate(${snapPoint.x} ${snapPoint.y}) rotate(${-rotation})`}>
        <circle r={5 * pixel} fill="white" fillOpacity={.9} stroke="#0d9488" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <circle r={1.5 * pixel} fill="#0d9488" />
        <text x={9 * pixel} y={-9 * pixel} fontSize={10 * pixel} fontWeight="600" fill="#0f766e" stroke="white" strokeWidth={3 * pixel} paintOrder="stroke" strokeLinejoin="round">{snapLabels[drawingAssist.kind]}</text>
      </g>}
    </g>}
    {children}
    </g>
    {showGrid && <g className="mp-alignment-grid" pointerEvents="none"><defs><pattern id={gridId} width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse"><path d={`M ${gridSpacing} 0 H 0 V ${gridSpacing}`} fill="none" stroke="#3b82f6" strokeOpacity=".3" strokeWidth="1" vectorEffect="non-scaling-stroke"/></pattern></defs><rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill={`url(#${gridId})`}/></g>}
  </svg>;
}
