import { svgPoint } from '../../features/facility/mapPresentation.js';

export default function MapDoorSymbol({ geometry, source, color, lineWidth, selected = false }) {
  const hinge = svgPoint(geometry.hinge, source), closed = svgPoint(geometry.closed, source), open = svgPoint(geometry.open, source);
  return <g className="mp-door-symbol" data-opening-angle={geometry.angleDegrees}>
    <path d={`M ${hinge.x} ${hinge.y} L ${closed.x} ${closed.y} ${geometry.arcPath.replace(/^M\s+[^A]+/, '')} L ${hinge.x} ${hinge.y} Z`} fill={selected ? '#3b82f6' : 'transparent'} fillOpacity={selected ? .06 : 0} stroke="none" pointerEvents="all"/>
    <line className="mp-door-threshold" x1={hinge.x} y1={hinge.y} x2={closed.x} y2={closed.y} stroke={color} strokeWidth={lineWidth * .65} strokeDasharray={`${geometry.radius * .08} ${geometry.radius * .06}`} strokeOpacity=".35"/>
    <path className="mp-door-swing" d={geometry.arcPath} fill="none" stroke={color} strokeWidth={Math.max(.008, lineWidth * .65)} strokeLinecap="round"/>
    <line className="mp-door-leaf" x1={hinge.x} y1={hinge.y} x2={open.x} y2={open.y} stroke={color} strokeWidth={lineWidth} strokeLinecap="round"/>
    <circle cx={hinge.x} cy={hinge.y} r={Math.min(lineWidth, geometry.radius * .025)} fill={color} pointerEvents="none"/>
  </g>;
}
