import { localMockMap, webToRos, rosToWeb, isCurrentMap } from '../maps/MapProvider.js';
export const toRosPoint = webToRos;
export const fromRosPoint = p => p && [p.x,p.y].every(Number.isFinite) ? rosToWeb(p) : null;
export async function gazeboManifest() { return localMockMap; }
export async function downloadGazeboMap() {
 const url=URL.createObjectURL(new Blob([JSON.stringify(localMockMap)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='hospital.gazebo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function routeRequest(plan, model=localMockMap) {
 if(!plan?.valid || !plan.points?.length) throw Error('Chọn quy trình MOVE và điểm đích hợp lệ.');
 return {commandType:'START_PATROL',mapId:model.mapId,mapKey:model.mapVersion,steps:plan.points.map(({endpoint,step})=>({...webToRos(endpoint),endpointId:endpoint.id,name:endpoint.name,speed:Number(step.paramsJson.max_speed_mps)}))};
}
export function validateMapSnapshot(snapshot) { return isCurrentMap(snapshot); }
