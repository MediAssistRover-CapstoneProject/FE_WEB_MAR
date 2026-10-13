export const ZONE_CATEGORIES={WAITING:'Khu chờ',CORRIDOR:'Hành lang',RESTRICTED:'Khu hạn chế',SERVICE:'Khu dịch vụ',OTHER:'Khu khác'};
export const ENDPOINT_CATEGORIES={ROOM_STOP:'Điểm dừng phòng',PICKUP:'Nhận hàng',DROPOFF:'Giao hàng',WAITING:'Điểm chờ',CHECKPOINT:'Điểm kiểm tra',MANUAL_CHARGE:'Sạc có người hỗ trợ'};
const text=(value,name,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`${name} bắt buộc, tối đa ${max} ký tự.`);return value.trim();};
const number=(value,name)=>{if(value===''||value==null||!Number.isFinite(Number(value)))throw Error(`${name} phải là số hữu hạn.`);return Number(value);};
function optionalNumber(value,name,min=0,strict=false){if(value===''||value==null)return null;const n=number(value,name);if(strict?n<=min:n<min)throw Error(`${name} không hợp lệ.`);return n;}
export function parseJson(value,name){if(value===''||value==null)return null;try{return typeof value==='string'?JSON.parse(value):value;}catch{throw Error(`${name} chưa đúng JSON.`);}}
export function zonePayload(form,mapId) {
  if(!mapId)throw Error('Chọn bản đồ BE trước.');
  if(!ZONE_CATEGORIES[form.zoneType])throw Error('Loại vùng không thuộc danh mục BE.');
  const polygon=parseJson(form.polygonJson,'Đa giác');
  if(!Array.isArray(polygon?.points)||polygon.points.length<3||polygon.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n))))throw Error('Đa giác cần points gồm ít nhất 3 cặp [x, y] theo mét.');
  const vertices=polygon.points.slice();
  if(vertices.length>3&&vertices[0][0]===vertices.at(-1)[0]&&vertices[0][1]===vertices.at(-1)[1])vertices.pop();
  if(new Set(vertices.map(p=>p.join(','))).size!==vertices.length)throw Error('Các đỉnh đa giác không được trùng nhau.');
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-10&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
  for(let i=0;i<vertices.length;i++)for(let j=i+2;j<vertices.length;j++){
    if(i===0&&j===vertices.length-1)continue;
    const a=vertices[i],b=vertices[(i+1)%vertices.length],c=vertices[j],d=vertices[(j+1)%vertices.length];
    if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw Error('Các cạnh đa giác không được tự cắt.');
  }
  const area=Math.abs(polygon.points.reduce((s,p,i)=>{const q=polygon.points[(i+1)%polygon.points.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
  if(area<1e-8)throw Error('Đa giác phải có diện tích khác 0.');
  const capacity=optionalNumber(form.capacityLimit,'Sức chứa');
  if(capacity!==null&&!Number.isInteger(capacity))throw Error('Sức chứa phải là số nguyên không âm.');
  if((form.cameraSourceRef||'').length>255)throw Error('Nguồn camera tối đa 255 ký tự.');
  return {mapId,zoneCode:text(form.zoneCode,'Mã vùng',64),zoneName:text(form.zoneName,'Tên vùng',160),zoneType:form.zoneType,polygonJson:polygon,
    speedLimitMps:optionalNumber(form.speedLimitMps,'Giới hạn tốc độ',0,true),capacityLimit:capacity,calibratedAreaM2:optionalNumber(form.calibratedAreaM2,'Diện tích hiệu chuẩn',0,true),
    cameraSourceRef:form.cameraSourceRef?.trim()||null,cameraRoiJson:parseJson(form.cameraRoiJson,'Vùng camera'),active:!!form.active,publicVisible:!!form.publicVisible,description:form.description||''};
}
export function endpointPayload(form,map,zones,rooms) {
  if(!map?.mapId)throw Error('Chọn bản đồ BE trước.');
  if(!ENDPOINT_CATEGORIES[form.endpointType])throw Error('Loại điểm không thuộc danh mục BE.');
  if(form.zoneId&&!zones.some(z=>z.zoneId===form.zoneId&&z.mapId===map.mapId))throw Error('Vùng phải thuộc cùng bản đồ.');
  if(form.roomId&&!rooms.some(r=>r.roomId===form.roomId&&r.floorId===map.floorId))throw Error('Phòng phải thuộc tầng của bản đồ.');
  const yawRad=number(form.yawRad,'Góc hướng');
  if(yawRad < -3.141593 || yawRad > 3.141593)throw Error('Góc hướng từ -π đến π radian.');
  return {mapId:map.mapId,zoneId:form.zoneId||null,roomId:form.roomId||null,endpointCode:text(form.endpointCode,'Mã điểm',64),endpointName:text(form.endpointName,'Tên điểm',160),endpointType:form.endpointType,
    xM:number(form.xM,'X (m)'),yM:number(form.yM,'Y (m)'),yawRad,active:!!form.active,accessible:!!form.accessible,publicVisible:!!form.publicVisible,description:form.description||''};
}
export function groupFromApi(group,members){return {id:group.endpointGroupId,code:group.groupCode,name:group.groupName,selectionPolicy:group.selectionPolicy,allowFallback:group.allowFallback,active:group.active,description:group.description||'',members:members.filter(m=>m.endpointGroupId===group.endpointGroupId).map(m=>({endpointId:m.endpointId,sequenceNo:m.sequenceNo,active:m.active}))};}
export function groupPayload(group,mapId){if(!['PRIORITY','NEAREST_REACHABLE'].includes(group.selectionPolicy))throw Error('Chính sách này chỉ dùng trong mô phỏng, chưa thuộc hợp đồng API nhóm điểm.');return {mapId,groupCode:group.code,groupName:group.name,selectionPolicy:group.selectionPolicy,allowFallback:group.allowFallback,description:group.description||'',active:group.active};}
