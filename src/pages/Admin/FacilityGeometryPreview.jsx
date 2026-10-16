import { useId } from 'react';

export function polygonPoints(value){try{const object=typeof value==='string'?JSON.parse(value):value;return Array.isArray(object?.points)?object.points.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)):[];}catch{return [];}}
export default function FacilityGeometryPreview({map,zones,endpoints,zoneEdit,endpointEdit,onPoint,onZone,onEndpoint,drawing}){
  const id=useId().replaceAll(':','');
  const x=Number(map.originXM),y=Number(map.originYM),w=Number(map.widthM),h=Number(map.heightM),yaw=Number(map.originYawRad||0);
  const corners=[[0,0],[w,0],[w,h],[0,h]].map(([a,b])=>[x+a*Math.cos(yaw)-b*Math.sin(yaw),y+a*Math.sin(yaw)+b*Math.cos(yaw)]);
  if(![x,y,w,h,yaw].every(Number.isFinite)||w<=0||h<=0)return <p className="ls-error">Metadata kích thước bản đồ không hợp lệ; không thể xem tọa độ.</p>;
  const minX=Math.min(...corners.map(p=>p[0])),maxX=Math.max(...corners.map(p=>p[0])),minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1]));
  const size=Math.max(maxX-minX,maxY-minY),pad=size*.05,scale=size/500;
  const points=polygonPoints(zoneEdit?.polygonJson);
  return <div style={{margin:'16px 0',border:'1px solid #dce5f0',borderRadius:8,overflow:'hidden'}}>
    <svg role="img" aria-label="Lớp vùng và điểm đích BE theo mét" viewBox={`${minX-pad} ${-maxY-pad} ${maxX-minX+pad*2} ${maxY-minY+pad*2}`} style={{width:'100%',display:'block',aspectRatio:'16 / 10',background:'#f1f5f9',cursor:drawing?'crosshair':'default'}} onClick={e=>{
      if(!drawing)return;const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());onPoint?.({xM:Number(p.x.toFixed(3)),yM:Number((-p.y).toFixed(3))});
    }}>
      <defs><pattern id={id} width={size/20} height={size/20} patternUnits="userSpaceOnUse"><path d={`M ${size/20} 0 H 0 V ${size/20}`} fill="none" stroke="#dce5f0" strokeWidth={scale*.5}/></pattern></defs>
      <polygon points={corners.map(p=>`${p[0]},${-p[1]}`).join(' ')} fill={`url(#${id})`} stroke="#94a3b8" strokeWidth={scale}/>
      {zones.filter(z=>z.zoneId!==zoneEdit?.zoneId).map(z=><polygon key={z.zoneId} points={polygonPoints(z.polygonJson).map(p=>`${p[0]},${-p[1]}`).join(' ')} fill={z.zoneType==='KEEP_OUT'?'#fda4af55':'#60a5fa44'} stroke={z.zoneType==='KEEP_OUT'?'#e11d48':'#2563eb'} strokeWidth={scale} opacity={z.active?1:.35} onClick={e=>{if(!drawing){e.stopPropagation();onZone?.(z.zoneId);}}}><title>{z.zoneName}</title></polygon>)}
      {points.length>0&&<polygon points={points.map(p=>`${p[0]},${-p[1]}`).join(' ')} fill="#fbbf2444" stroke="#d97706" strokeWidth={scale*1.5}/>}
      {endpoints.filter(p=>p.endpointId!==endpointEdit?.endpointId).map(p=><g key={p.endpointId} transform={`translate(${p.xM},${-p.yM})`} opacity={p.active?1:.35} onClick={e=>{if(!drawing){e.stopPropagation();onEndpoint?.(p);}}}><circle r={scale*4} fill="#2f80ff" stroke="white" strokeWidth={scale}/><path d={`M 0 0 L ${Math.cos(p.yawRad)*scale*12} ${-Math.sin(p.yawRad)*scale*12}`} stroke="#1d4ed8" strokeWidth={scale*1.5}/><text x={scale*6} y={-scale*6} fontSize={scale*7} fill="#172b4d">{p.endpointName}</text><title>{p.endpointName} · ({p.xM}, {p.yM}) m</title></g>)}
      {endpointEdit&&endpointEdit.xM!==''&&endpointEdit.yM!==''&&<g transform={`translate(${endpointEdit.xM},${-endpointEdit.yM})`}><circle r={scale*5} fill="#f59e0b"/><path d={`M 0 0 L ${Math.cos(endpointEdit.yawRad)*scale*15} ${-Math.sin(endpointEdit.yawRad)*scale*15}`} stroke="#b45309" strokeWidth={scale*2}/></g>}
    </svg>
    <p style={{padding:10,fontSize:11}}>Lớp tọa độ danh mục · X sang phải, Y hướng lên · đơn vị mét. Không phải ảnh quét và không xác nhận đường đi/vật cản. {drawing?'Bấm trên khung để đặt hình học.':'Bấm vùng hoặc điểm để chọn.'}</p>
  </div>;
}
