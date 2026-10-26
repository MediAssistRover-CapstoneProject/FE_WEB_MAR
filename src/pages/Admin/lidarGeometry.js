import { localMockMap as model, viewTransform, pixelToWeb, rosToWeb } from '../../features/maps/MapProvider.js';
export const MAP = { width:1200, height:680, resolution:model.resolution/viewTransform().scale };
export const SCAN_START = rosToWeb(model.spawn);
// Boundary is only the raster extent. Traversability is checked against occupancy.
export const FLOOR = [[0,0],[model.width,0],[model.width,model.height],[0,model.height]].map(([x,y])=>pixelToWeb({x,y}));
export const WALLS = model.obstacleGeometry.flatMap(ob=>{
  const r=ob.sourcePixels;
  const p=[[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]].map(([x,y])=>pixelToWeb({x,y}));
  return p.map((a,i)=>[a,p[(i+1)%4]]);
});
export const OBSTACLES = [];
const LIDAR_SURFACES = [...WALLS, ...OBSTACLES.flatMap(({x,y,w,h}) => {
  const corners=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
  return corners.map((point,index)=>[point,corners[(index+1)%corners.length]]);
})];
export const SCAN_PATH = [SCAN_START, SCAN_START];
export function distanceToSegment(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function inPolygon(p,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if(distanceToSegment(p,a,b)<0.001) return true;
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
export function scanPosition(progress) {
  const at=Math.max(0,Math.min(1,progress/100))*(SCAN_PATH.length-1), i=Math.min(SCAN_PATH.length-2,Math.floor(at)), t=at-i;
  return {x:SCAN_PATH[i].x+(SCAN_PATH[i+1].x-SCAN_PATH[i].x)*t,y:SCAN_PATH[i].y+(SCAN_PATH[i+1].y-SCAN_PATH[i].y)*t};
}
export function rayHits(origin, count=64) {
  return Array.from({length:count},(_,i)=>{
    const angle=i/count*Math.PI*2, dx=Math.cos(angle),dy=Math.sin(angle);
    let distance=240;
    // A LiDAR return always stops at the nearest solid surface. Furniture is
    // included here as well as walls so neither beams nor observed floor can
    // appear through an obstacle.
    for(const [a,b] of LIDAR_SURFACES) {
      const sx=b.x-a.x,sy=b.y-a.y,den=dx*sy-dy*sx;
      if(Math.abs(den)<1e-9) continue;
      const qx=a.x-origin.x,qy=a.y-origin.y,t=(qx*sy-qy*sx)/den,u=(qx*dy-qy*dx)/den;
      if(t>0 && u>=0 && u<=1) distance=Math.min(distance,t);
    }
    return {x:origin.x+dx*distance,y:origin.y+dy*distance};
  });
}
