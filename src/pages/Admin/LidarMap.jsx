import { localMockMap as model, viewTransform } from '../../features/maps/MapProvider.js';
import { vi } from '../../i18n/vi.js';
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { FLOOR, MAP, OBSTACLES, SCAN_START, WALLS, inPolygon, rayHits, scanPosition } from './lidarGeometry.js';
import { ZONE_TYPES } from './mapStudioModel.js';
import { dragFeature } from './mapFeatureDrag.js';
import './lidarMap.css';

const LOCAL_MAP_ARTIFACT = { src:model.imagePath, widthPx:model.width, heightPx:model.height, widthM:model.width*model.resolution, heightM:model.height*model.resolution, resolution:model.resolution };
const MOCK_MAP_ROTATION_DEG = viewTransform().angle*180/Math.PI;
function readPgmToken(bytes, position) {
  let index = position;
  while (index < bytes.length) {
    while (index < bytes.length && /\s/.test(String.fromCharCode(bytes[index]))) index += 1;
    if (bytes[index] !== 35) break;
    while (index < bytes.length && bytes[index] !== 10) index += 1;
  }
  const start = index;
  while (index < bytes.length && !/\s/.test(String.fromCharCode(bytes[index]))) index += 1;
  return { value: new TextDecoder().decode(bytes.slice(start, index)), next: index };
}
function decodePgm(bytes) {
  const magic = readPgmToken(bytes, 0);
  const width = readPgmToken(bytes, magic.next);
  const height = readPgmToken(bytes, width.next);
  const max = readPgmToken(bytes, height.next);
  if (magic.value !== 'P5' || Number(width.value) !== LOCAL_MAP_ARTIFACT.widthPx || Number(height.value) !== LOCAL_MAP_ARTIFACT.heightPx || Number(max.value) !== 255) throw new Error('Map artifact không đúng định dạng PGM P5 mong đợi.');
  let dataStart = max.next;
  // P5 has exactly one whitespace separator after MAXVAL (or CRLF). Do not
  // skip arbitrary whitespace here: a valid first grayscale pixel can itself
  // have a whitespace byte value.
  if (bytes[dataStart] === 13 && bytes[dataStart + 1] === 10) dataStart += 2;
  else if (/\s/.test(String.fromCharCode(bytes[dataStart]))) dataStart += 1;
  const pixels = bytes.slice(dataStart);
  if (pixels.length < LOCAL_MAP_ARTIFACT.widthPx * LOCAL_MAP_ARTIFACT.heightPx) throw new Error('Map artifact bị thiếu dữ liệu ảnh.');
  const image = new ImageData(LOCAL_MAP_ARTIFACT.widthPx, LOCAL_MAP_ARTIFACT.heightPx);
  for (let i = 0; i < LOCAL_MAP_ARTIFACT.widthPx * LOCAL_MAP_ARTIFACT.heightPx; i += 1) {
    const value = pixels[i];
    image.data[i * 4] = value; image.data[i * 4 + 1] = value; image.data[i * 4 + 2] = value; image.data[i * 4 + 3] = 255;
  }
  const source = document.createElement('canvas');
  source.width = LOCAL_MAP_ARTIFACT.widthPx; source.height = LOCAL_MAP_ARTIFACT.heightPx;
  source.getContext('2d').putImageData(image, 0, 0);
  return source;
}
const ScanCanvas = memo(function ScanCanvas() {
  const ref=useRef(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let current=true;
    fetch(model.imagePath).then(r=>{if(!r.ok)throw Error('Không tải được ảnh LiDAR gốc.');return r.arrayBuffer();}).then(buffer=>{
      if(!current)return;
      const source=decodePgm(new Uint8Array(buffer)), ctx=ref.current.getContext('2d'), t=viewTransform();
      ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#121416';ctx.fillRect(0,0,t.width,t.height);
      ctx.translate(t.width/2,t.height/2);ctx.rotate(t.angle);ctx.scale(t.scale,t.scale);ctx.imageSmoothingEnabled=false;
      ctx.drawImage(source,-model.width/2,-model.height/2);
    }).catch(e=>{if(current)setError(e.message);});
    return()=>{current=false;};
  },[]);
  return error ? <div role="alert">{error}</div> : <canvas ref={ref} width="2400" height="1360" style={{width:'100%',height:'100%',display:'block'}} aria-label="Map LiDAR gốc — xoay hiển thị, giữ nguyên tỉ lệ"/>;
});
function Selectable({label,onSelect,onPointerDown,children}) {
  return <g role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={vi(onSelect?label:undefined)}
    onClick={onSelect?e=>{e.stopPropagation();onSelect();}:undefined} onKeyDown={onSelect?e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onSelect();}}:undefined}
    onPointerDown={onPointerDown} style={{cursor:onPointerDown?'grab':onSelect?'pointer':undefined}}>{vi(children)}</g>;
}
function Direction({point,heading,color='#60a5fa',length=25}) {
  return <g transform={'translate('+point.x+' '+point.y+') rotate('+(-heading)+')'} pointerEvents="none"><path d={'M0 0H'+length+'m-7 -5 7 5-7 5'} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></g>;
}
function Endpoint({value,preview=false}) {
  return <g opacity={preview ? 0.7 : 1}><title>{value.name || vi('New endpoint')}</title><circle cx={value.x} cy={value.y} r="14" fill="transparent"/><circle data-testid="endpoint-dot" cx={value.x} cy={value.y} r="4" fill="#60a5fa" pointerEvents="none"/></g>;
}
export default function LidarMap({draft,stage,tool,onPoint,zoneEdit,endpointEdit,onSelectZone,onSelectEndpoint,onEditZone,onEditEndpoint,rectangleStart,hoverPoint,onHover,zoneDirty,endpointDirty,simulation,overlay,collisionWarning=false,artifactPreview=false}) {
  const [zoom,setZoom]=useState(1),[centre,setCentre]=useState({x:600,y:340}),[grid,setGrid]=useState(false),[rays,setRays]=useState(true),[zonesVisible,setZonesVisible]=useState(true),[endpointsVisible,setEndpointsVisible]=useState(true);
  const drag=useRef(null),svgRef=useRef(null),suppressClick=useRef(false),rafRef=useRef(null),pendingPoint=useRef(null);
  const raw=stage==='scan',progress=draft.scan.progress;
  const robot=raw?(draft.scan.robot||SCAN_START):scanPosition(100);
  const storedTrail=Array.isArray(draft.scan.trail)?draft.scan.trail:[];
  const trail=progress>0?storedTrail:[],revealAll=!storedTrail.length&&progress>=100;
  const beams=useMemo(()=>rayHits(robot),[robot.x,robot.y]);
  // A 5:3 view adds a small vertical margin without stretching saved geometry.
  const width=MAP.width/zoom,height=MAP.width*3/5/zoom;
  const clampCentre=(point,z=zoom)=>({x:Math.max(600/z,Math.min(1200-600/z,point.x)),y:Math.max(340/z,Math.min(680-340/z,point.y))});
  const zoomTo=value=>{setZoom(value);setCentre(current=>clampCentre(current,value));};
  const coordinate=event=>{const matrix=svgRef.current?.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};};
  const activeZone=zoneEdit?.points?.length ? zoneEdit:null;
  const previewPoints=rectangleStart&&hoverPoint ? [rectangleStart,{x:hoverPoint.x,y:rectangleStart.y},hoverPoint,{x:rectangleStart.x,y:hoverPoint.y}] : null;
  const color=ZONE_TYPES.find(t=>t.id===zoneEdit?.type)?.color || '#60a5fa';
  const startDrag=(event,kind,value,vertex)=>{
    if(tool || event.button!==0 || drag.current)return;
    event.stopPropagation();event.preventDefault();
    const change=kind==='endpoint'?onEditEndpoint:onEditZone;
    const select=kind==='endpoint'?onSelectEndpoint:onSelectZone;
    if(!change || select?.(value.id)===false)return;
    const ctm=svgRef.current?.getScreenCTM();
    if(!ctm)return;
    const inverseMatrix=ctm.inverse();
    const start=new DOMPoint(event.clientX,event.clientY).matrixTransform(inverseMatrix);
    drag.current={
      kind,
      original:structuredClone(kind==='endpoint'?{...value,placed:true}:value),
      start:{x:start.x,y:start.y},
      vertex,
      change,
      pointerId:event.pointerId,
      clientX:event.clientX,
      clientY:event.clientY,
      moved:false,
      inverseMatrix,
      scale:ctm.a||1
    };
    svgRef.current.setPointerCapture(event.pointerId);
  };
  const finishDrag=cancel=>{
    if(rafRef.current){cancelAnimationFrame(rafRef.current);rafRef.current=null;}
    const current=drag.current;if(!current)return;
    drag.current=null;
    if(cancel){
      if(current.kind==='pan')setCentre(current.centre);
      else current.change(current.original);
    } else if(current.moved && pendingPoint.current && current.kind!=='pan'){
      current.change(dragFeature(current.original,current.kind,current.start,pendingPoint.current,current.vertex));
    }
    pendingPoint.current=null;
    suppressClick.current=current.moved||cancel;
    if(svgRef.current?.hasPointerCapture(current.pointerId)){
      try{svgRef.current.releasePointerCapture(current.pointerId);}catch{}
    }
  };
  useEffect(()=>{
    const cancel=e=>{if(e.key==='Escape'&&drag.current){e.preventDefault();finishDrag(true);}};
    window.addEventListener('keydown',cancel);
    return()=>{
      window.removeEventListener('keydown',cancel);
      if(rafRef.current)cancelAnimationFrame(rafRef.current);
    };
  },[]);
  const renderZone=z=>{
    const c=ZONE_TYPES.find(t=>t.id===z.type)?.color||color,p=z.points[0],editing=z===activeZone;
    const editable=!tool&&stage==='zone'&&onSelectZone;
    return <Selectable key={z.id||'new-zone'} label={'Edit zone '+(z.name||'mới')} onSelect={editable?()=>onSelectZone(z.id):undefined}
      onPointerDown={editable?e=>startDrag(e,'zone',z):undefined}>
      <polygon data-testid={editing?'selected-zone':undefined} points={z.points.map(p=>p.x+','+p.y).join(' ')} fill={c+'30'} stroke={c} strokeWidth={editing?3:1.7} strokeDasharray={editing&&zoneDirty?'6 4':undefined}/>
      <text x={p.x+6} y={p.y+18} fill={c} stroke="#101317" strokeWidth="3" paintOrder="stroke" fontSize="12" fontWeight="600">{vi(z.name)}{z.type==='SPEED'?' · '+z.speed+' m/s':''}</text>
      {editing&&z.points.map((p,i)=><g key={i}><circle data-testid={'zone-vertex-'+i} aria-label={'Kéo đỉnh '+(i+1)} cx={p.x} cy={p.y} r={7/zoom} fill="white" stroke={c} strokeWidth={2/zoom} style={{cursor:editable?'move':undefined}} onPointerDown={editable?e=>startDrag(e,'vertex',z,i):undefined}/><text x={p.x+10/zoom} y={p.y-10/zoom} fill="white" fontSize={11/zoom} pointerEvents="none">{i+1}</text></g>)}
    </Selectable>;
  };
  const renderEndpoint=(value,editing=false)=>{
    const editable=!tool&&onSelectEndpoint;
    return <Selectable key={value.id||'new-endpoint'} label={'Edit endpoint '+(value.name||'mới')} onSelect={editable?()=>onSelectEndpoint(value.id):undefined} onPointerDown={editable?e=>startDrag(e,'endpoint',value):undefined}>
      <g data-testid={editing?'selected-endpoint':undefined}><Endpoint value={value} preview={editing&&endpointDirty}/></g>
    </Selectable>;
  };
  return <section className="ls-map" aria-label={vi("LiDAR map editor")}>
    <header className="ls-map-head"><div><strong>{vi(raw?'LiDAR occupancy map':draft.name)}</strong><small>{artifactPreview ? vi(`Map quét mock · căn thẳng ${MOCK_MAP_ROTATION_DEG}° · ${LOCAL_MAP_ARTIFACT.widthPx} × ${LOCAL_MAP_ARTIFACT.heightPx} px · ${LOCAL_MAP_ARTIFACT.widthM} × ${LOCAL_MAP_ARTIFACT.heightM} m · ${LOCAL_MAP_ARTIFACT.resolution.toLocaleString('vi-VN')} m/px`) : 'Mặt bằng mô phỏng cục bộ · cùng tọa độ với tuyến 3D'}</small></div><div className="ls-map-tools">
      <button type="button" aria-label={vi("Zoom out")} disabled={zoom<=1} onClick={()=>zoomTo(Math.max(1,zoom-.25))}>{vi("−")}</button>
      <button type="button" aria-label={vi("Fit map")} onClick={()=>{setZoom(1);setCentre({x:600,y:340});}}>{vi("Fit")}</button>
      <button type="button" aria-label={vi("Zoom in")} disabled={zoom>=3} onClick={()=>zoomTo(Math.min(3,zoom+.25))}>{vi("+")}</button>
    </div></header>
    <div className="ls-map-layers"><span className="ls-live-dot"/> <span>{vi(raw?'OCCUPANCY':'MAP LAYERS')}</span><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>Lưới hỗ trợ</label>{vi(raw?<label><input type="checkbox" checked={rays} onChange={e=>setRays(e.target.checked)}/>{vi("Laser rays")}</label>:<><label><input type="checkbox" checked={zonesVisible} onChange={e=>setZonesVisible(e.target.checked)}/>{vi("Zones")}</label>{stage==='endpoint'&&<label><input type="checkbox" checked={endpointsVisible} onChange={e=>setEndpointsVisible(e.target.checked)}/>{vi("Endpoints")}</label>}</>)}<small>{vi(Math.round(zoom*100))}{vi("%")}</small></div>
    <div className="ls-map-frame"><div className="ls-map-viewport">
      <svg ref={svgRef} viewBox={[centre.x-width/2,centre.y-height/2,width,height].join(' ')} preserveAspectRatio="xMidYMid meet" aria-label={vi("LiDAR map drawing surface")} style={{cursor:tool?'crosshair':zoom>1?'grab':'default',touchAction:zoom>1||onEditZone||onEditEndpoint?'none':'auto',userSelect:'none'}}
        onPointerDownCapture={()=>{if(!drag.current)suppressClick.current=false;}}
        onClickCapture={e=>{if(suppressClick.current){e.stopPropagation();suppressClick.current=false;}}}
        onPointerDown={e=>{if(!tool&&zoom>1&&e.button===0&&!drag.current){const ctm=e.currentTarget.getScreenCTM();drag.current={kind:'pan',clientX:e.clientX,clientY:e.clientY,centre,pointerId:e.pointerId,moved:false,scale:ctm?.a||1,inverseMatrix:ctm?.inverse()};e.currentTarget.setPointerCapture(e.pointerId);}}}
        onPointerMove={e=>{
          const current=drag.current;
          if(current){
            if(e.pointerId!==current.pointerId)return;
            if(!current.moved && Math.hypot(e.clientX-current.clientX,e.clientY-current.clientY)>3){
              current.moved=true;
            }
            if(!current.moved)return;
            if(current.kind==='pan'){
              const scale=current.scale||1;
              setCentre(clampCentre({x:current.centre.x-(e.clientX-current.clientX)/scale,y:current.centre.y-(e.clientY-current.clientY)/scale}));
            } else {
              const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(current.inverseMatrix);
              pendingPoint.current={x:pt.x,y:pt.y};
              if(!rafRef.current){
                rafRef.current=requestAnimationFrame(()=>{
                  rafRef.current=null;
                  const cur=drag.current;
                  if(cur && pendingPoint.current){
                    cur.change(dragFeature(cur.original,cur.kind,cur.start,pendingPoint.current,cur.vertex));
                  }
                });
              }
            }
          } else {
            const p=coordinate(e);
            if(p)onHover?.({x:Math.round(p.x),y:Math.round(p.y)});
          }
        }}
        onPointerUp={e=>{if(e.pointerId===drag.current?.pointerId)finishDrag(false);}} onPointerCancel={e=>{if(e.pointerId===drag.current?.pointerId)finishDrag(true);}} onLostPointerCapture={e=>{if(e.pointerId===drag.current?.pointerId)finishDrag(true);}}
        onClick={e=>{if(tool){const p=coordinate(e);if(p)onPoint({x:Math.round(p.x),y:Math.round(p.y)});}}}>
        <title>{vi("LiDAR-style scan. White returns mark walls; grey is observed floor; black is unknown space.")}</title>
        <foreignObject width="1200" height="680" pointerEvents="none"><ScanCanvas trail={trail} revealAll={revealAll} artifactPreview={artifactPreview}/></foreignObject>
        {vi(grid&&<g stroke="#7a879a" strokeWidth=".4" opacity=".25" pointerEvents="none">{vi(Array.from({length:31},(_,i)=><path key={'x'+i} d={'M'+i*40+' 0V680'}/>))}{vi(Array.from({length:18},(_,i)=><path key={'y'+i} d={'M0 '+i*40+'H1200'}/>))}</g>)}
        {!raw&&zonesVisible&&draft.zones.filter(z=>z.id!==activeZone?.id).map(renderZone)}
        {!raw&&zonesVisible&&activeZone&&renderZone(activeZone)}
        {vi(!raw&&previewPoints?.length>0&&<g pointerEvents="none"><polygon points={previewPoints.map(p=>p.x+','+p.y).join(' ')} fill={color+'22'} stroke={color} strokeWidth="2" strokeDasharray="6 4"/>{vi(previewPoints.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="5" fill={color}/><text x={p.x+8} y={p.y-7} fill="white" fontSize="10">{vi(i+1)}</text></g>))}</g>)}
        {stage==='endpoint'&&endpointsVisible&&draft.endpoints.filter(e=>e.id!==endpointEdit?.id).map(e=>renderEndpoint(e))}
        {overlay}
        {vi(simulation&&<g pointerEvents="none"><polyline data-testid="dispatch-route" points={simulation.path.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="#4ade80" strokeWidth="4" strokeDasharray="8 5" strokeLinejoin="round"/>{vi(simulation.point&&<g transform={'translate('+simulation.point.x+' '+simulation.point.y+')'} data-testid="dispatch-robot"><circle r="15" fill="#1d4ed8" stroke="white" strokeWidth="3"/><rect x="-8" y="-6" width="16" height="12" rx="4" fill="#14283f"/><circle cx="-3" cy="-1" r="2" fill="#7dd3fc"/><circle cx="3" cy="-1" r="2" fill="#7dd3fc"/><Direction point={{x:0,y:0}} heading={simulation.point.heading||0} color="#4ade80" length={25}/><text y="31" textAnchor="middle" fill="white" stroke="#111827" paintOrder="stroke" strokeWidth="3" fontSize="11">{vi("MAR-01")}</text></g>)}</g>)}
        {stage==='endpoint'&&endpointsVisible&&endpointEdit?.placed&&renderEndpoint(endpointEdit,true)}
        {simulation?.actors?.map(actor=><g key={actor.id} data-testid={'traffic-actor-'+actor.kind} pointerEvents="none" transform={`translate(${actor.point.x} ${actor.point.y})`}>{actor.kind==='robot'?<circle r="12" fill="#d97706" stroke="white" strokeWidth="2"/>:<rect x="-8" y="-8" width="16" height="16" fill="#ef4444" stroke="white" strokeWidth="2"/>}<text y="-20" textAnchor="middle" fill="white" stroke="#111827" paintOrder="stroke" strokeWidth="3" fontSize="12">{actor.label}</text></g>)}
        {vi(raw&&!artifactPreview&&draft.scan.status!=='idle'&&<g pointerEvents="none">{vi(rays&&beams.map((p,i)=><line key={i} x1={robot.x} y1={robot.y} x2={p.x} y2={p.y} stroke="#68d6c0" strokeWidth=".7" opacity=".32"/>))}{collisionWarning&&<circle cx={robot.x} cy={robot.y} r="17" fill="#ef444422" stroke="#fb7185" strokeWidth="2" strokeDasharray="4 3"><animate attributeName="r" values="15;19;15" dur="1s" repeatCount="indefinite"/></circle>}<g data-testid="scan-robot" transform={`translate(${robot.x} ${robot.y}) rotate(${robot.heading||0})`}><title>MAR-01</title><rect x="-7" y="-9" width="14" height="18" rx="2.5" fill="#2f80ff" stroke="#93c5fd" strokeWidth=".9"/><rect x="-4.6" y="-5.5" width="9.2" height="11" rx="3.4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".7"/><path d="M-3.2 -5.5Q0 -8.2 3.2 -5.5V-2.8H-3.2Z" fill="#dbe4ec"/><rect x="-3.2" y="-1.5" width="6.4" height="5" rx="1.4" fill="#d2d9df"/><circle cx="-5" cy="5.2" r="1.7" fill="#ef765e"/><circle cx="5" cy="5.2" r="1.7" fill="#ef765e"/><circle cx="0" cy="-5.8" r="1.1" fill="#ffffff"/><path d="M0 -12L-2.2 -9H2.2Z" fill="#bfdbfe"/></g></g>)}
        {vi(raw&&progress===0&&draft.scan.status==='idle'&&<g pointerEvents="none"><circle cx={SCAN_START.x} cy={SCAN_START.y} r="32" fill="none" stroke="#60717f" strokeDasharray="3 6"/><path d={`M${SCAN_START.x-20} ${SCAN_START.y}H${SCAN_START.x+20}M${SCAN_START.x} ${SCAN_START.y-20}V${SCAN_START.y+20}`} stroke="#8eabb9"/><text x={SCAN_START.x} y={SCAN_START.y+63} textAnchor="middle" fill="#d3dce3" fontSize="17">Sẵn sàng quét thủ công</text><text x={SCAN_START.x} y={SCAN_START.y+88} textAnchor="middle" fill="#8b99a5" fontSize="12">Bật cảm biến, sau đó giữ nút điều khiển để di chuyển</text></g>)}
        <g transform={'translate('+(centre.x-width/2+22/zoom)+' '+(centre.y+height/2-26/zoom)+')'} pointerEvents="none"><path d={'M0 -5V0H'+(1/MAP.resolution)+'V-5'} fill="none" stroke="#afbbc5" strokeWidth={1/zoom}/><text x="0" y={15/zoom} fill="#afbbc5" fontSize={10/zoom}>{vi("1 m")}</text></g>
      </svg>
    </div></div>
    <footer className="ls-map-foot"><span><i style={{background:'#ecf0f1'}}/>{vi("Occupied")}<i style={{background:'#42474c'}}/>{vi("Free")}<i style={{background:'#111416'}}/>{vi("Unknown")}</span><span>{vi('Drag to pan when zoomed')}</span></footer>
  </section>;
}
