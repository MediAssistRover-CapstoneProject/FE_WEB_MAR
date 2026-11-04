import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),calls=[],errors=[];
page.setDefaultTimeout(12000);
const base=process.env.TEST_URL||'http://127.0.0.1:5175';
const uuid=n=>`${n}`.repeat(8)+'-'+`${n}`.repeat(4)+'-4'+`${n}`.repeat(3)+'-8'+`${n}`.repeat(3)+'-'+`${n}`.repeat(12);
const [mapId,robotId,startId,goalId,sessionId,requestId,zoneId]=[1,2,3,4,5,6,7].map(uuid),hash='a'.repeat(64);
const meta={map_id:mapId,asset_hash:hash,frame_id:'map',width_px:100,height_px:100,resolution_m_per_pixel:.05,origin_x_m:0,origin_y_m:0,origin_yaw_rad:0,navigation_reload_safe:true};
const map={mapId,mapName:'Map kiểm thử API',status:'ACTIVE',versionNo:1,assetHash:hash};
const point=(endpointId,code,xM,yM)=>({endpointId,mapId,endpointCode:code,endpointName:code,endpointType:'WAYPOINT',xM,yM,yawRad:0,active:true,accessible:true,publicVisible:false});
const points=[point(startId,'START',.5,.5),point(goalId,'GOAL',3,2)];
let zones=[{zoneId,mapId,zoneCode:'SLOW',zoneName:'Hành lang',zoneType:'SPEED',polygonJson:{points:[[1,1],[2,1],[2,2]]},speedLimitMps:.15,active:true}],ack=false,request=null,loseResponse=true,revision=1,sessionMapId=mapId,sessionState='READY';
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/navigation-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"><head><meta charset="utf-8"><link rel="stylesheet" href="/robot-console/saved-map-navigation.css"></head><body><section id="mapNavigation"></section></body></html>'}));
await page.goto(base+'/navigation-fixture');
const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=100;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,100,100);return c.toDataURL().split(',')[1];}),'base64');
await page.route('**/api/v1/**',async route=>{
  const r=route.request(),path=new URL(r.url()).pathname,method=r.method(),body=r.postDataJSON();
  calls.push({path,method,body,headers:r.headers()});assert.equal(r.headers().authorization,'Bearer fixture-only');
  const json=value=>route.fulfill({json:value}),paged=rows=>json({content:rows,last:true,totalPages:1});
  if(path.endsWith('/image-metadata'))return json(meta);
  if(path.endsWith('/image.png'))return route.fulfill({contentType:'image/png',body:png});
  if(path===`/api/v1/maps/${mapId}`)return json(map);
  if(path==='/api/v1/endpoints')return paged(points);
  if(path.startsWith('/api/v1/endpoints/'))return json(points.find(p=>path.endsWith(p.endpointId)));
  if(path==='/api/v1/zones'&&method==='GET')return paged(zones);
  if(path===`/api/v1/zones/${zoneId}/deactivate`){zones[0].active=false;ack=false;return json(zones[0]);}
  if(path==='/api/v1/zones'&&method==='POST'){zones.push({...body,zoneId:uuid(8)});ack=false;return json(zones.at(-1));}
  if(path.endsWith('/snapshot')){const now=new Date().toISOString();return json({robot:{robotId,status:'IDLE',currentMapId:sessionMapId,mapAssetHash:hash},observedAt:now,mqttConnected:true,heartbeatFresh:true,dispatchReady:true,activeJobId:null,navigationSession:{sessionId,mapId:sessionMapId,mapAssetHash:hash,state:sessionState,expiresAt:'2099-01-01T00:00:00Z',initialization:{revision}},latestPose:{robotId,mapId:sessionMapId,frameId:'map',xM:.5,yM:.5,yawRad:0,fresh:true,capturedAt:now}});}
  if(path.endsWith('/navigation-session/close')){sessionState='CLOSED';return json({sessionId,state:sessionState});}
  if(path.endsWith('/navigation-zones'))return json({robotId,mapId,profileAcknowledged:ack,zoneCount:zones.filter(z=>z.active).length,restrictedZoneCount:0,speedZoneCount:zones.filter(z=>z.active).length});
  if(path.endsWith('/stream'))return route.fulfill({status:503,body:'Fixture uses REST fallback'});
  if(path==='/api/v1/navigation-routes'){
    request={serviceRequestId:requestId,status:'QUEUED',requestType:'NAVIGATION',idempotencyKey:r.headers()['idempotency-key'],requestedRobotId:robotId,requestDataJson:{map_id:mapId,navigation_session_id:sessionId}};
    if(loseResponse){loseResponse=false;return route.fulfill({status:503,json:{message:'Fixture: response lost after commit'}});}
    return json({workflowId:uuid(9),endpointIds:body.endpointIds,request});
  }
  if(path==='/api/v1/service-requests/by-idempotency-key')return json(request);
  if(path===`/api/v1/service-requests/${requestId}`)return json(request);
  if(path===`/api/v1/service-requests/${requestId}/cancel`){request.status='CANCELLED';return json(request);}
  if(path==='/api/v1/jobs')return paged([]);
  throw Error('Unexpected API '+method+' '+path);
});
await page.addScriptTag({url:base+'/robot-console/saved-map-navigation.js'});
await page.evaluate(({robotId})=>{window.navigation=SavedMapNavigation.mount({element:document.querySelector('#mapNavigation'),getToken:()=> 'fixture-only',getRobotId:()=>robotId,getSavedMapId:()=>'',isMappingActive:()=>false});},{robotId});
const writes=()=>calls.filter(c=>c.method!=='GET');
try{
  await mkdir('.workstation-build/navigation-parity',{recursive:true});
  await page.locator('#navMapId').fill(mapId);await page.locator('#navLoad').click();
  await page.locator('#navMapInfo').filter({hasText:map.mapName}).waitFor();
  await page.waitForFunction(()=>document.querySelector('#navZoneSync').dataset.state==='PENDING');
  assert.equal(writes().length,0,'Opening the console and loading map must remain read-only');
  await page.locator('#navEndpoints').selectOption(goalId);await page.locator('#navRouteAdd').click();
  await page.locator('#navEndpoints').selectOption(startId);await page.locator('#navRouteAdd').click();
  await page.locator('#navEndpoints').selectOption(goalId);await page.locator('#navRouteAdd').click();
  assert.equal(await page.locator('#navRouteList li').count(),3);assert(await page.locator('#navRouteRun').isDisabled());
  await page.getByRole('button',{name:'↑ điểm 2',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.navigation.state.route),[startId,goalId,goalId]);
  await page.getByRole('button',{name:'↓ điểm 1',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.navigation.state.route),[goalId,startId,goalId]);
  ack=true;await page.locator('#navRefresh').click();
  await page.waitForFunction(()=>!document.querySelector('#navRouteRun').disabled);
  assert.match(await page.locator('#navZoneSync').textContent(),/ACK chưa xác minh/);
  // A receipt obtained for the previous initialization must not unlock a new one.
  ack=false;revision=2;await page.locator('#navRefresh').click();
  await page.waitForFunction(()=>window.navigation.state.snapshot.navigationSession.initialization.revision===2&&!document.querySelector('#navRefresh').disabled);
  assert(await page.locator('#navRouteRun').isDisabled());
  ack=true;await page.locator('#navRefresh').click();await page.waitForFunction(()=>!document.querySelector('#navRouteRun').disabled);
  await page.locator('#navRouteSpeed').fill('0.3');
  await page.locator('#navRouteRun').click();
  await page.locator('#navAction').filter({hasText:'503'}).waitFor();
  const sent=calls.find(c=>c.path==='/api/v1/navigation-routes');
  assert.deepEqual(sent.body.endpointIds,[goalId,startId,goalId]);assert.equal(sent.body.robotId,robotId);assert.equal(sent.body.mapId,mapId);assert.equal(sent.body.navigationSessionId,sessionId);assert.equal(sent.body.maxSpeedMps,.3);assert.equal(sent.body.submit,true);assert(sent.headers['idempotency-key']);
  assert(await page.locator('#navRouteAdd').isDisabled());
  await page.locator('#navRecheck').click();
  await page.locator('#navReceipt').filter({hasText:'QUEUED'}).waitFor({state:'attached'});
  assert.equal(calls.filter(c=>c.path==='/api/v1/navigation-routes').length,1,'Read-only recovery must not replay an auto-submitted route');
  assert(calls.some(c=>c.path==='/api/v1/service-requests/by-idempotency-key'));
  await page.locator('#navCancel').click();await page.waitForFunction(()=>!document.querySelector('#navRouteClear').disabled);
  await page.locator('#navRouteClear').click();assert.equal(await page.locator('#navRouteList li').count(),0);
  // Zone edits invalidate receipts; all mutations here are intercepted fixtures.
  await page.locator('#navZoneEditor > summary').click();
  await page.locator('#navZones').selectOption(zoneId);await page.locator('#navToggleZone').click();
  assert(calls.some(c=>c.path.endsWith('/deactivate')&&c.method==='POST'));
  await page.waitForFunction(()=>window.navigation.state.zoneAck!==true);
  await page.locator('#navNewZone').click();
  await page.locator('#navZoneCode').fill('NEW_ZONE');await page.locator('#navZoneName').fill('Vùng thử');
  await page.locator('#navZonePoints').fill('[[1,1],[2,1],[2,2]]');
  await page.locator('#navZoneSpeed').fill('1');await page.locator('#navSaveZone').click();
  await page.locator('#navAction').filter({hasText:'không quá 0,8'}).waitFor();
  assert.equal(calls.filter(c=>c.path==='/api/v1/zones'&&c.method==='POST').length,0);
  await page.locator('#navZoneSpeed').fill('0.2');await page.locator('#navSaveZone').click();
  await page.locator('#navAction').filter({hasText:'Đã lưu zone'}).waitFor();
  const zone=calls.find(c=>c.path==='/api/v1/zones'&&c.method==='POST');assert.equal(zone.body.mapId,mapId);assert.equal(zone.body.speedLimitMps,.2);assert.deepEqual(zone.body.polygonJson.points,[[1,1],[2,1],[2,2]]);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`.workstation-build/navigation-parity/routes-zones-${width}.png`,fullPage:true});}
  sessionMapId=uuid(9);await page.locator('#navRefresh').click();
  await page.locator('#navSessionStatus').filter({hasText:'bản đồ khác'}).waitFor();
  await page.getByRole('button',{name:'Đóng phiên trên bản đồ khác',exact:true}).click();
  await page.waitForFunction(()=>window.navigation.state.snapshot.navigationSession.state==='CLOSED');
  const closed=calls.find(c=>c.path.endsWith('/navigation-session/close'));assert.equal(closed.path,`/api/v1/robots/${robotId}/navigation-session/close`);assert.deepEqual(closed.body,{sessionId});
  assert.deepEqual(errors,[]);
  console.log('PASS navigation parity: ordered/repeated/reordered endpoints, ACK/reinitialization gate, route payload, read-only recovery after lost POST response, cancellation, zone toggle/create/validation, desktop/mobile. All robot API calls mocked.');
}catch(e){console.log(errors);await page.screenshot({path:'.workstation-build/navigation-parity/failure.png',fullPage:true});throw e;}finally{await browser.close();}
