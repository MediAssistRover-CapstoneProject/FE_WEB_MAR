import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],calls=[];
page.setDefaultTimeout(10000);
const ids=Array.from({length:7},(_,i)=>`${i+1}`.repeat(8)+'-'+`${i+1}`.repeat(4)+'-4'+`${i+1}`.repeat(3)+'-8'+`${i+1}`.repeat(3)+'-'+`${i+1}`.repeat(12));
const [mapId,robotId,startId,goalId,sessionId,workflowId,requestId]=ids,hash='a'.repeat(64);
const map={mapId,mapName:'Bản đồ thử nghiệm',status:'ACTIVE',versionNo:1,assetHash:hash,widthM:5,heightM:5,resolutionMPerPixel:.05,originXM:0,originYM:0,originYawRad:0};
const start={endpointId:startId,mapId,endpointCode:'START',endpointName:'Vị trí đặt robot',endpointType:'WAYPOINT',xM:.5,yM:.6,yawRad:.7,active:true,accessible:true,publicVisible:false};
const goal={...start,endpointId:goalId,endpointCode:'GOAL',endpointName:'Quầy tiếp nhận',xM:3,yM:2,yawRad:1};
const robot={robotId,robotName:'Robot thử nghiệm',status:'OFFLINE'};
const meta={map_id:mapId,asset_hash:hash,frame_id:'map',width_px:100,height_px:100,resolution_m_per_pixel:.05,origin_x_m:0,origin_y_m:0,origin_yaw_rad:0,navigation_reload_safe:true};
const definition=JSON.parse(await readFile('public/robot-console/navigation-move-workflow.json','utf8'));
const detail={workflow:{...definition.workflow,workflowId,startStepId:'step',status:'PUBLISHED',acceptsNewJobs:true},steps:definition.graph.steps.map(s=>({...s,stepId:'step',stepTypeCode:s.stepType})),transitions:definition.graph.transitions.map(t=>({...t,fromStepId:'step',toStepId:null}))};
const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,100,100);ctx.strokeStyle='black';ctx.lineWidth=3;ctx.strokeRect(2,2,96,96);ctx.beginPath();ctx.moveTo(50,0);ctx.lineTo(50,45);ctx.stroke();return c.toDataURL().split(',')[1];}),'base64');
let session=null,request=null,changedStart=false,badImage=false,metadataReads=0,metadataRace=false,raceReads=0;
const writes=()=>calls.filter(c=>c.method!=='GET');
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('mediassist-rover.session',JSON.stringify({account:{role:'ADMIN',username:'fixture'},tokens:{accessToken:'fixture-only'}})));
await page.route('**/api/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,method=req.method(),body=req.postDataJSON();
  calls.push({path,method,body,headers:req.headers()});assert.equal(req.headers().authorization,'Bearer fixture-only');
  const json=value=>route.fulfill({json:value}),paged=rows=>json({content:rows,last:true,totalPages:1});
  if(path.endsWith('/auth/me'))return json({role:'ADMIN',username:'fixture'});
  if(path.endsWith('/image-metadata')){metadataReads++;return json(metadataRace&&++raceReads>1?{...meta,asset_hash:'b'.repeat(64)}:meta);}
  // Current BE CORS does not expose X-Map-Asset-Hash. No BE change is needed.
  if(path.endsWith('/image.png'))return route.fulfill({contentType:'image/png',headers:badImage?{'X-Map-Asset-Hash':'b'.repeat(64),'Access-Control-Expose-Headers':'X-Map-Asset-Hash'}:{},body:png});
  if(path===`/api/v1/maps/${mapId}`)return json(map);
  if(path.endsWith('/snapshot')){const now=new Date().toISOString(),ready=session?.state==='READY';return json({robot:{...robot,status:ready?'IDLE':'OFFLINE',currentMapId:mapId,mapAssetHash:hash},observedAt:now,mqttConnected:ready,heartbeatFresh:ready,dispatchReady:ready,activeJobId:null,navigationSession:session||{state:'NONE'},latestPose:ready?{robotId,mapId,frameId:'map',xM:.75,yM:.6,yawRad:.7,fresh:true,capturedAt:now}:null});}
  if(path.endsWith('/navigation-session')&&method==='POST'){session={sessionId,robotId,mapId,mapAssetHash:hash,state:'WAITING_FOR_PI',expiresAt:'2099-01-01T00:00:00Z',initialization:{revision:0}};return json(session);}
  if(path.endsWith('/navigation-session/initialization')){session.state='LOCALIZING';session.initialization.revision++;return json(session);}
  if(path.endsWith('/navigation-session/close')){session.state='CLOSED';return json(session);}
  if(path===`/api/v1/endpoints/${startId}`)return json({...start,xM:changedStart?.75:.5});
  if(path===`/api/v1/endpoints/${goalId}`)return json(goal);
  if(path==='/api/v1/endpoints')return paged([{...start,xM:changedStart?.75:.5},goal,{...start,endpointId:'disabled',active:false},{...start,endpointId:'foreign',mapId:'other-map'}]);
  if(path==='/api/v1/maps')return paged([{...map,mapId:'draft-map',status:'DRAFT'},map]);
  if(path==='/api/v1/robots')return paged([robot]);
  if(path==='/api/v1/admin/workflows')return paged([detail.workflow]);
  if(path===`/api/v1/admin/workflows/${workflowId}`)return json(detail);
  if(path==='/api/v1/navigation-requests'){request={serviceRequestId:requestId,status:'DRAFT'};return json({request});}
  if(path===`/api/v1/service-requests/${requestId}`)return json(request);
  if(path.endsWith('/submit')){request.status='QUEUED';return json(request);}
  if(path.endsWith('/cancel')){request.status='CANCELLED';return json(request);}
  if(path==='/api/v1/jobs')return paged([]);
  if(path.endsWith('/published/all'))return json([]);
  if(method==='GET')return paged([]);
  throw Error('Unexpected robot mutation '+method+' '+path);
});
const wait=condition=>page.waitForFunction(condition);
try{
  await mkdir('.workstation-build/navigation-dispatch',{recursive:true});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5175')+`/workstations?mapId=${mapId}`);
  const mapSelect=page.getByLabel('Bản đồ trong database',{exact:true});await mapSelect.locator(`option[value="${mapId}"]`).waitFor({state:'attached'});
  assert.equal(await page.getByLabel('Điểm đích điều phối',{exact:true}).count(),0,'No destination at the setup stage');
  await page.getByLabel('Robot điều phối',{exact:true}).selectOption(robotId);
  await mapSelect.selectOption('draft-map');assert(await page.getByRole('button',{name:'Mở điều phối robot',exact:true}).isDisabled());
  await mapSelect.selectOption(mapId);assert(await page.getByRole('button',{name:'Mở điều phối robot',exact:true}).isEnabled());
  await page.getByRole('button',{name:'Mở điều phối robot',exact:true}).click();
  const f=page.frameLocator('iframe[title="Điều phối robot trên bản đồ đang hoạt động"]');
  await f.locator('#navMapInfo').filter({hasText:'Bản đồ thử nghiệm'}).waitFor();
  await f.locator(`#navSeedEndpoint option[value="${startId}"]`).waitFor({state:'attached'});
  assert(metadataReads>=2);assert.equal(writes().length,0);
  assert.equal(await f.locator('#navMapLoader').isVisible(),false);assert.equal(await f.locator('#navEndpointEditor').isVisible(),false);
  assert.equal(await f.locator('#navEndpoints').inputValue(),'');assert.equal(await f.locator('#navSeedEndpoint option[value="disabled"]').evaluate(o=>o.disabled),true);assert.equal(await f.locator('#navSeedEndpoint option[value="foreign"]').count(),0);
  const canvas=f.locator('#navCanvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await page.mouse.click(box.x+box.width*.1,box.y+box.height*.88);
  assert.equal(await f.locator('#navSeedEndpoint').inputValue(),startId);assert.equal(await f.locator('#navEndpoints').inputValue(),'');assert.equal(writes().length,0);assert(await f.locator('#navSendSeed').isDisabled());
  await f.locator('#navAssign').click();await wait(()=>document.querySelector('iframe').contentDocument.querySelector('#navSessionId').value.length>0);
  assert.equal(await f.locator('#navSessionId').inputValue(),sessionId);
  assert.equal(await f.locator('#navPiCommand').evaluate(node=>node.closest('details')),null);
  await f.locator('body').evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedText=text;}}}));
  await f.locator('#navCopySession').click();assert.equal(await f.locator('body').evaluate(()=>window.copiedText),sessionId);
  await f.locator('#navCopyCommand').click();assert((await f.locator('body').evaluate(()=>window.copiedText)).includes('navigation_session.zsh --session-id '+sessionId));
  assert.deepEqual(writes()[0].body,{mapId,durationSec:7200});
  changedStart=true;await f.locator('#navSendSeed').click();await f.locator('#navAction').filter({hasText:'Endpoint khởi tạo đã thay đổi'}).waitFor();assert.equal(calls.filter(c=>c.path.endsWith('/initialization')).length,0);
  await f.locator('#navLoad').click();await wait(()=>!document.querySelector('iframe').contentDocument.querySelector('#navLoad').disabled);
  await f.locator('#navSeedEndpoint').selectOption(startId);await f.locator('#navSendSeed').click();await wait(()=>document.querySelector('iframe').contentDocument.querySelector('#navSessionStatus').dataset.state==='LOCALIZING');
  assert.deepEqual(calls.find(c=>c.path.endsWith('/initialization')).body,{sessionId,mode:'SEED',xM:.75,yM:.6,yawRad:.7});
  await f.locator('#navEndpoints').selectOption(goalId);await f.locator('#navPrepare').click();await wait(()=>!!document.querySelector('iframe').contentDocument.querySelector('#navWorkflowId').value);assert(await f.locator('#navMove').isDisabled());
  session.state='READY';await f.locator('#navRefresh').click();await wait(()=>!document.querySelector('iframe').contentDocument.querySelector('#navMove').disabled);
  for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await f.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await f.locator('#mapNavigation').screenshot({path:`.workstation-build/navigation-dispatch/navigation-${width}.png`});}
  await f.locator('#navMove').click();await wait(()=>document.querySelector('iframe').contentDocument.querySelector('#navReceipt').textContent.includes('QUEUED'));
  const move=calls.find(c=>c.path==='/api/v1/navigation-requests');assert.equal(move.body.robotId,robotId);assert.equal(move.body.navigationSessionId,sessionId);assert.equal(move.body.mapId,mapId);assert.equal(move.body.destinationEndpointId,goalId);assert.equal(move.body.workflowId,workflowId);assert(move.headers['idempotency-key']);assert(calls.some(c=>c.path.endsWith('/submit')&&c.method==='POST'));
  await f.locator('#navCancel').click();await wait(()=>!document.querySelector('iframe').contentDocument.querySelector('#navCloseSession').disabled);await f.locator('#navCloseSession').click();await wait(()=>document.querySelector('iframe').contentDocument.querySelector('#navSessionStatus').dataset.state==='CLOSED');assert.equal(await f.locator('#navSessionId').inputValue(),'');assert(await f.locator('#navCopyCommand').isDisabled());
  badImage=true;await f.locator('#navLoad').click();await f.locator('#navAction').filter({hasText:'Ảnh bản đồ không khớp'}).waitFor();assert(await f.locator('#navAssign').isDisabled());
  badImage=false;metadataRace=true;await f.locator('#navLoad').click();await f.locator('#navAction').filter({hasText:'Bản đồ đã thay đổi trong lúc tải ảnh'}).waitFor();assert(await f.locator('#navAssign').isDisabled());
  assert.equal(writes().filter(c=>c.path.endsWith('/navigation-session')).length,1);assert(!writes().some(c=>/\/endpoints/.test(c.path)));assert.deepEqual(errors,[]);
  console.log('PASS FE-only: no duplicate destination, saved start endpoint, visible/copyable session ID and Pi command, unchanged image API, stale endpoint rejection, READY gate, authenticated MOVE/submit/cancel/close, desktop/mobile. All API calls mocked.');
}catch(e){console.log(errors);await page.screenshot({path:'.workstation-build/navigation-dispatch/failure.png',fullPage:true});throw e;}finally{await browser.close();}
