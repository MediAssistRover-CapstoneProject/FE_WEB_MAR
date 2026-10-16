import { inPolygon, distanceToSegment } from '../Admin/lidarGeometry.js';
import { samplePlan } from './mapDispatchModel.js';

const RADIUS=8;
export function touchesZone(point,zone,radius=RADIUS){
  return inPolygon(point,zone.points)||zone.points.some((p,i)=>distanceToSegment(point,p,zone.points[(i+1)%zone.points.length])<=radius);
}

// The canonical zone contract has no synthetic multi-robot/obstacle scenario
// types. Keep the dispatch API stable while returning the unmodified plan.
export function applyTrafficScenario(_map,plan){
  return {...plan,fixtures:[],notes:[],events:[],outcome:'complete',blocked:null};
}

export function trafficState(_map,plan,elapsed){
  samplePlan(plan,elapsed);
  return {actors:[],occupancy:[],events:[]};
}
