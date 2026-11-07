import { useId } from 'react';
import { featureCenter, svgPoint, worldToLocal, insideMap } from '../../features/facility/mapPresentation.js';
import { rotationBounds } from '../../features/facility/mapPresentationView.js';
import { doorGeometry } from '../../features/facility/doorGeometry.js';
import MapDoorSymbol from './MapDoorSymbol.jsx';

export default function MapPresentationCanvas({ source, document, imageUrl, opacity = 0, endpoints = [], selectedId, preview, points = [], onFeatureDown, onVertexDown, svgRef, contentRef, showGrid = false, ...events }) {
  const gridId = useId(), rotation = document.rotationDegrees ?? 0, bounds = rotationBounds(source, rotation);
  const screen = p => svgPoint(p, source);
  const pointString = values => values.map(p => { const v = screen(p); return `${v.x},${v.y}`; }).join(' ');
  const markerSize = Math.max(source.widthM, source.heightM) / 220, gridSpacing = Math.max(source.widthM, source.heightM) / 20;
  return <svg ref={svgRef} tabIndex={0} className="mp-canvas" viewBox={`0 0 ${source.widthM} ${source.heightM}`} aria-label="Bản đồ đang chỉnh giao diện" {...events}>
    <g ref={contentRef} className="mp-map-content" transform={`rotate(${rotation} ${source.widthM / 2} ${source.heightM / 2})`}>
    <rect width={source.widthM} height={source.heightM} fill={document.backgroundColor} />
    {imageUrl && opacity > 0 && <image href={imageUrl} width={source.widthM} height={source.heightM} opacity={opacity} preserveAspectRatio="none" pointerEvents="none" />}
    {document.features.map(feature => {
      const door = feature.type === 'DOOR' ? doorGeometry(feature, source) : null;
      const center = screen(door ? door.labelPoint : featureCenter(feature)), polygon = ['ROOM', 'CORRIDOR'].includes(feature.type), single = ['LABEL', 'LANDMARK'].includes(feature.type), selected = selectedId === feature.id && !preview;
      return <g key={feature.id} onPointerDown={event => onFeatureDown?.(event, feature)} style={{ cursor: onFeatureDown ? 'move' : 'default' }}>
        {door ? <MapDoorSymbol geometry={door} source={source} color={feature.color} lineWidth={feature.lineWidthM} selected={selected}/> : !single && (polygon ? <polygon points={pointString(feature.points)} fill="transparent" stroke={selected ? '#3b82f6' : '#94a3b8'} strokeOpacity={selected ? .65 : .38} strokeWidth={selected ? 1.25 : 1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : <polyline points={pointString(feature.points)} fill="none" stroke={feature.color} strokeWidth={feature.lineWidthM} strokeLinecap="round" strokeLinejoin="round" />)}
        {feature.type === 'LANDMARK' && <circle cx={center.x} cy={center.y} r={feature.fontSizeM * .85} fill={feature.color} opacity={.15} />}
        {feature.label && <text x={center.x} y={center.y} transform={`rotate(${-rotation} ${center.x} ${center.y})`} textAnchor="middle" dominantBaseline="central" fill={single ? feature.color : '#1e293b'} fontSize={feature.fontSizeM} fontWeight="600" pointerEvents="none">{feature.label}</text>}
        {selected && feature.points.map((p, index) => { const v = screen(p); return <circle key={index} cx={v.x} cy={v.y} r={markerSize * .8} fill="white" stroke="#60a5fa" strokeWidth={1} vectorEffect="non-scaling-stroke" onPointerDown={event => onVertexDown?.(event, feature, index)} style={{ cursor: 'crosshair' }} />; })}
      </g>;
    })}
    {endpoints.filter(e => e.active && e.accessible).map(endpoint => {
      const local = worldToLocal(endpoint, source); if (!insideMap(local, source)) return null;
      const p = screen(local);
      return <g key={endpoint.endpointId} pointerEvents="none"><circle cx={p.x} cy={p.y} r={markerSize} fill="#2563eb" stroke="white" strokeWidth={markerSize / 3} /><title>{endpoint.endpointName}</title></g>;
    })}
    {points.length > 0 && <g pointerEvents="none"><polyline points={pointString(points)} fill="none" stroke="#3b82f6" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />{points.map((point, i) => { const p = screen(point); return <circle key={i} cx={p.x} cy={p.y} r={markerSize * .7} fill="#3b82f6" />; })}</g>}
    </g>
    {showGrid && <g className="mp-alignment-grid" pointerEvents="none"><defs><pattern id={gridId} width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse"><path d={`M ${gridSpacing} 0 H 0 V ${gridSpacing}`} fill="none" stroke="#3b82f6" strokeOpacity=".3" strokeWidth="1" vectorEffect="non-scaling-stroke"/></pattern></defs><rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill={`url(#${gridId})`}/></g>}
  </svg>;
}
