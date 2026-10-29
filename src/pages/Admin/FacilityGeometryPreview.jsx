import { useEffect, useId, useRef, useState } from 'react';
import { request } from '../../features/robotOperations/api.js';
import { loadSavedMap } from '../../features/robotOperations/savedMap.js';
import { endpointHeading, mapGeometry, snapMapPoint } from '../../features/facility/mapCoordinates.js';
import EndpointMarker from './EndpointMarker.jsx';

export function polygonPoints(value){try{const object=typeof value==='string'?JSON.parse(value):value;return Array.isArray(object?.points)?object.points.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)):[];}catch{return [];}}
export default function FacilityGeometryPreview({map,zones,endpoints,zoneEdit,endpointEdit,onPoint,onZone,onEndpoint,drawing,onPlacementEnd,allowDraftMove=false}){
  const id=useId().replaceAll(':','');
  const [asset,setAsset]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [zoom,setZoom]=useState(1);
  const svgRef=useRef(null);
  const [viewport,setViewport]=useState({width:800,height:500});
  useEffect(()=>{
    const svg=svgRef.current;if(!svg)return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width&&height)setViewport({width,height});});
    observer.observe(svg);return()=>observer.disconnect();
  },[map.mapId,asset?.loaded]);
  const pointDrag=useRef(null);
  useEffect(()=>{pointDrag.current=null;},[map.mapId,drawing]);
  const worldPoint=e=>{const matrix=e.currentTarget.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return {xM:p.x,yM:-p.y};};
  const endPlacement=()=>{if(pointDrag.current){pointDrag.current=null;onPlacementEnd?.();}};
  useEffect(()=>{
    const controller=new AbortController();let url;
    setAsset(null);setError('');
    setZoom(1);
    loadSavedMap(map.mapId,request,controller.signal).then(({metadata,blob})=>{
      const geometry=mapGeometry(metadata);
      if(controller.signal.aborted)return;
      url=URL.createObjectURL(blob);setAsset({mapId:map.mapId,url,geometry,loaded:false});
    }).catch(e=>{if(!controller.signal.aborted)setError('Không tải được ảnh bản đồ: '+e.message);});
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[map.mapId,revision]);
  const currentAsset=asset?.mapId===map.mapId?asset:null;
  map=currentAsset?{...map,...currentAsset.geometry}:map;
  const x=Number(map.originXM),y=Number(map.originYM),w=Number(map.widthM),h=Number(map.heightM),yaw=Number(map.originYawRad||0);
  const corners=[[0,0],[w,0],[w,h],[0,h]].map(([a,b])=>[x+a*Math.cos(yaw)-b*Math.sin(yaw),y+a*Math.sin(yaw)+b*Math.cos(yaw)]);
  if(![x,y,w,h,yaw].every(Number.isFinite)||w<=0||h<=0)return <p className="ls-error">Metadata kích thước bản đồ không hợp lệ; không thể xem tọa độ.</p>;
  const minX=Math.min(...corners.map(p=>p[0])),maxX=Math.max(...corners.map(p=>p[0])),minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1]));
  const size=Math.max(maxX-minX,maxY-minY),pad=size*.05,scale=size/500;
  const markerUnit=Math.max((maxX-minX+pad*2)/viewport.width,(maxY-minY+pad*2)/viewport.height)/zoom;
  const points=polygonPoints(zoneEdit?.polygonJson);
  return <div style={{margin:'16px 0',border:'1px solid #dce5f0',borderRadius:8,overflow:'hidden'}}>
    <div className="ls-actions" style={{padding:'8px 10px'}}><button type="button" className="ls-btn" aria-label="Thu nhỏ map" onClick={()=>setZoom(z=>Math.max(1,z/1.4))}>−</button><button type="button" className="ls-btn" onClick={()=>{setZoom(1);}}>Vừa khung</button><button type="button" className="ls-btn" aria-label="Phóng to map" onClick={()=>setZoom(z=>Math.min(8,z*1.4))}>+</button><span>{Math.round(zoom*100)}% · Bản đồ cố định</span></div>
    <svg ref={svgRef} role="img" aria-label="Lớp vùng và điểm đích BE theo mét" viewBox={`${(minX+maxX)/2-(maxX-minX+pad*2)/zoom/2} ${-(minY+maxY)/2-(maxY-minY+pad*2)/zoom/2} ${(maxX-minX+pad*2)/zoom} ${(maxY-minY+pad*2)/zoom}`} style={{width:'100%',display:'block',aspectRatio:'16 / 10',background:'#f1f5f9',cursor:drawing?'crosshair':'default',touchAction:drawing?'none':'pan-y',userSelect:'none'}} onPointerDown={e=>{
      if(e.button!==0)return;
      if(drawing&&endpointEdit&&currentAsset?.loaded){const p=worldPoint(e),point=p&&snapMapPoint(map,p.xM,p.yM);if(!point)return;e.preventDefault();pointDrag.current={point,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);onPoint?.({...point,yawRad:Number(endpointEdit.yawRad)||0});return;}

    }} onPointerMove={e=>{
      const dpoint=pointDrag.current;if(dpoint){const end=worldPoint(e);if(!end)return;if(dpoint.mode==='move'){const point=snapMapPoint(map,dpoint.point.xM+end.xM-dpoint.start.xM,dpoint.point.yM+end.yM-dpoint.start.yM);if(point)onPoint?.({...point,yawRad:dpoint.yawRad});}else if(Math.hypot(e.clientX-dpoint.x,e.clientY-dpoint.y)>=6){onPoint?.({...dpoint.point,yawRad:endpointHeading(dpoint.point,end)});}return;}
    }} onPointerUp={endPlacement} onPointerCancel={endPlacement} onLostPointerCapture={endPlacement} onDragStart={e=>e.preventDefault()} onClick={e=>{
      if(!drawing||endpointEdit||!currentAsset?.loaded)return;const p=worldPoint(e),point=p&&snapMapPoint(map,p.xM,p.yM);if(point)onPoint?.(point);
    }}>
      <defs><pattern id={id} width={size/20} height={size/20} patternUnits="userSpaceOnUse"><path d={`M ${size/20} 0 H 0 V ${size/20}`} fill="none" stroke="#dce5f0" strokeWidth={scale*.5}/></pattern></defs>
      <polygon points={corners.map(p=>`${p[0]},${-p[1]}`).join(' ')} fill={`url(#${id})`} stroke="#94a3b8" strokeWidth={scale}/>
      {currentAsset&&<image href={currentAsset.url} x="0" y={-h} width={w} height={h} preserveAspectRatio="none" transform={`translate(${x} ${-y}) rotate(${-yaw*180/Math.PI})`} style={{imageRendering:'pixelated'}} onLoad={()=>setAsset(a=>a?.url===currentAsset.url?{...a,loaded:true}:a)} onError={()=>{setError('Không đọc được ảnh bản đồ. Hãy tải lại ảnh.');setAsset(null);}}/>}
      {zones.filter(z=>z.zoneId!==zoneEdit?.zoneId).map(z=><polygon key={z.zoneId} points={polygonPoints(z.polygonJson).map(p=>`${p[0]},${-p[1]}`).join(' ')} fill={z.zoneType==='KEEP_OUT'?'#fda4af55':'#60a5fa44'} stroke={z.zoneType==='KEEP_OUT'?'#e11d48':'#2563eb'} strokeWidth={scale} opacity={z.active?1:.35} onClick={e=>{if(!drawing){e.stopPropagation();onZone?.(z.zoneId);}}}><title>{z.zoneName}</title></polygon>)}
      {points.length>0&&<polygon points={points.map(p=>`${p[0]},${-p[1]}`).join(' ')} fill="#fbbf2444" stroke="#d97706" strokeWidth={scale*1.5}/>}
      {endpoints.filter(p=>p.endpointId!==endpointEdit?.endpointId).map(p=><g key={p.endpointId} transform={`translate(${p.xM},${-p.yM})`} opacity={p.active?1:.35} onClick={e=>{if(!drawing){e.stopPropagation();onEndpoint?.(p);}}}><EndpointMarker point={p} unit={markerUnit}/><title>{p.endpointName} · ({p.xM}, {p.yM}) m</title></g>)}
      {endpointEdit&&endpointEdit.xM!==''&&endpointEdit.yM!==''&&<g data-draft-endpoint="true" aria-label="Điểm endpoint đang chỉnh" transform={`translate(${endpointEdit.xM},${-endpointEdit.yM})`} style={{cursor:allowDraftMove&&!endpointEdit.endpointId?'move':'default',touchAction:'none'}} onPointerDown={e=>{
        if(!allowDraftMove||endpointEdit.endpointId||!currentAsset?.loaded||e.button!==0)return;
        const svg=e.currentTarget.ownerSVGElement,matrix=svg?.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
        e.preventDefault();e.stopPropagation();pointDrag.current={mode:'move',point:{xM:Number(endpointEdit.xM),yM:Number(endpointEdit.yM)},start:{xM:p.x,yM:-p.y},yawRad:Number(endpointEdit.yawRad)||0};svg.setPointerCapture(e.pointerId);
      }}><EndpointMarker point={endpointEdit} unit={markerUnit} draft/><title>{allowDraftMove&&!endpointEdit.endpointId?'Kéo điểm cam để đổi vị trí, giữ nguyên hướng':'Điểm đang chỉnh'}</title></g>}
    </svg>
    {error?<p className="ls-error" role="alert">{error}</p>:!currentAsset?.loaded?<p style={{padding:10}} role="status">Đang tải ảnh map đã lưu từ BE…</p>:<p style={{padding:10,fontSize:12}}>{drawing?endpointEdit?'Bấm trên sàn đã quét, kéo theo hướng robot cần quay rồi thả. Điểm cam là bản nháp, cần lưu để tạo endpoint.':'Bấm trên ảnh map để thêm đỉnh vùng.':'Bản đồ quét đã lưu · Bấm vùng hoặc điểm để chỉnh sửa.'} Tọa độ tính bằng mét trong hệ tọa độ của map.</p>}
    <button type="button" className="ls-btn" onClick={()=>setRevision(v=>v+1)}>Tải lại ảnh map</button>
  </div>;
}
