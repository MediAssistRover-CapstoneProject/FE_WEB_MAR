// Matches the app's top-down chassis. The caller owns map position and heading;
// +X is the front. Dimensions are display units, not a physical safety boundary.
export default function MapRobotMarker({ length = 24, live = true, color, frontColor }) {
  const width = length * .72, fieldLength = length * 1.36, fieldWidth = width * 1.38;
  const fieldColor = color || (live ? '#0ea5e9' : '#64748b');
  return <g className="map-robot-marker" data-map-robot-marker="" data-live={live} pointerEvents="none">
    <rect data-robot-part="field" x={-fieldLength / 2} y={-fieldWidth / 2} width={fieldLength} height={fieldWidth}
      rx={fieldWidth * .26} fill={fieldColor} fillOpacity={live ? .22 : .18} stroke={fieldColor} strokeWidth={length * .075} />
    <rect data-robot-part="chassis" x={-length / 2} y={-width / 2} width={length} height={width}
      rx={width * .2} fill="#fff" stroke="#0f172a" strokeWidth={length * .06} />
    <rect data-robot-part="front" x={length * .18} y={-width * .32} width={length * .22} height={width * .64}
      rx={width * .12} fill={frontColor || (live ? '#10b981' : '#94a3b8')} />
    <rect x={-length * .44} y={-width * .34} width={length * .1} height={width * .2} rx={length * .025} fill="#ef4444" />
    <rect x={-length * .44} y={width * .14} width={length * .1} height={width * .2} rx={length * .025} fill="#ef4444" />
  </g>;
}
