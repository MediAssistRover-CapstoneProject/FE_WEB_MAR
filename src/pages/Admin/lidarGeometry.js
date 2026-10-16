// Synthetic scan geometry inspired by the user's reference. Editing layers use
// the same coordinates; these are not measurements from a connected sensor.
export const MAP = { width: 1200, height: 680, resolution: 0.05 };
export const SCAN_START = { x: 600, y: 350, heading: 0 };
export const FLOOR = [[90,230],[500,230],[500,100],[640,100],[640,155],[930,155],[930,215],[1110,215],[1110,355],[920,355],[920,425],[1000,425],[1000,570],[650,570],[650,600],[500,600],[500,570],[230,570],[230,415],[290,415],[290,355],[90,355]].map(([x,y]) => ({x,y}));
const segments = points => points.slice(1).map((p,i) => [points[i],p].map(([x,y])=>({x,y})));
export const WALLS = [
  ...FLOOR.map((p,i) => [p,FLOOR[(i+1)%FLOOR.length]]),
  ...segments([[220,230],[220,310],[260,310]]), ...segments([[285,310],[310,310],[310,230]]),
  ...segments([[310,310],[345,310]]), ...segments([[370,310],[470,310],[470,230]]),
  ...segments([[500,230],[535,230]]), ...segments([[560,230],[640,230],[640,155]]),
  ...segments([[640,230],[640,310],[840,310]]), ...segments([[875,310],[920,310],[920,215]]),
  ...segments([[1020,215],[1020,300],[1050,300]]), ...segments([[1080,300],[1110,300]]),
  ...segments([[230,415],[270,415]]), ...segments([[300,415],[340,415],[340,570]]),
  ...segments([[340,415],[375,415]]), ...segments([[405,415],[430,415],[430,570]]),
  ...segments([[430,415],[465,415]]), ...segments([[490,415],[500,415],[500,570]]),
  ...segments([[650,570],[650,415],[675,415]]), ...segments([[705,415],[730,415],[730,570]]),
  ...segments([[730,415],[765,415]]), ...segments([[795,415],[870,415],[870,570]]),
  ...segments([[870,425],[905,425]]), ...segments([[935,425],[1000,425]]),
];
export const OBSTACLES = [
  {x:116,y:260,w:34,h:18}, {x:120,y:320,w:22,h:12}, {x:273,y:245,w:20,h:30},
  {x:380,y:250,w:40,h:16}, {x:735,y:190,w:38,h:17}, {x:764,y:260,w:14,h:30},
  {x:1068,y:238,w:17,h:34}, {x:270,y:527,w:42,h:18}, {x:354,y:470,w:35,h:18},
  {x:448,y:530,w:30,h:13}, {x:684,y:522,w:25,h:22}, {x:765,y:470,w:32,h:22},
  {x:940,y:520,w:20,h:30}, {x:486,y:367,w:14,h:15}, {x:658,y:360,w:15,h:15},
  {x:555,y:411,w:65,h:13}, {x:548,y:390,w:13,h:35}, {x:613,y:390,w:13,h:35},
];
export const SCAN_PATH = [[165,330],[280,330],[460,330],[548,330],[548,190],[548,330],[800,330],[1060,330],[880,330],[880,380],[635,380],[635,450],[580,450],[580,550],[580,450],[525,450],[525,395],[330,395]].map(([x,y]) => ({x,y}));
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
    for(const [a,b] of WALLS) {
      const sx=b.x-a.x,sy=b.y-a.y,den=dx*sy-dy*sx;
      if(Math.abs(den)<1e-9) continue;
      const qx=a.x-origin.x,qy=a.y-origin.y,t=(qx*sy-qy*sx)/den,u=(qx*dy-qy*dx)/den;
      if(t>0 && u>=0 && u<=1) distance=Math.min(distance,t);
    }
    return {x:origin.x+dx*distance,y:origin.y+dy*distance};
  });
}
