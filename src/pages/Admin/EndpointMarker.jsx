export default function EndpointMarker({ point, unit, draft = false }) {
  const color = draft ? '#d97706' : '#15803d';
  const name = point.endpointName || point.endpointCode || 'Điểm mới';
  const label = name.length > 22 ? name.slice(0, 21) + '…' : name;
  const width = Math.max(60, [...label].length * 6.3 + 22);
  return <g transform={`scale(${unit})`}>
    <circle r="22" fill="transparent"/>
    <circle r="17" fill={draft?'#fef3c7':'#dcfce7'} fillOpacity=".65"/>
    {draft && <circle r="20" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3"/>}
    <g transform={`rotate(${-Number(point.yawRad||0)*180/Math.PI})`}>
      <path d="M11 -5 L28 0 L11 5 Z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
    </g>
    <circle r="12" fill="white" stroke={color} strokeWidth="1.5" style={{filter:'drop-shadow(0 2px 2px #0f172a25)'}}/>
    <circle r="8.5" fill={color}/>
    {point.endpointType==='CHARGER' ? <path d="M1 -6 L-4 1 H0 L-1 6 L5 -1 H1 Z" fill="white"/> : point.endpointType==='PARK' ? <text textAnchor="middle" y="4" fill="white" fontSize="11" fontWeight="700">P</text> : <><circle r="3" fill="white"/><circle r="5.5" fill="none" stroke="white" strokeOpacity=".5" strokeWidth="1"/></>}
    <g transform="translate(17 -35)" pointerEvents="none">
      <rect width={width} height="25" rx="7" fill="white" stroke={draft?'#fcd34d':'#bbf7d0'} strokeWidth="1" style={{filter:'drop-shadow(0 2px 3px #0f172a18)'}}/>
      <circle cx="9" cy="12.5" r="2.5" fill={color}/>
      <text x="16" y="16.5" fontFamily="Inter,Arial,sans-serif" fontSize="11" fontWeight="600" fill="#1e293b">{label}</text>
    </g>
  </g>;
}
