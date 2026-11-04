import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
try{
  const page=await browser.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  const [mapA,mapB,robotId,sessionId,requestKey]=[1,2,3,4,5].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
  const hash='a'.repeat(64),robot={robotId,robotName:'Robot kiểm thử',status:'IDLE',currentMapId:mapB,mapAssetHash:hash};
  const maps=[mapA,mapB].map((mapId,i)=>({mapId,mapName:'Bản đồ '+(i?'B':'A'),status:'ACTIVE',assetHash:hash,versionNo:1,widthM:5,heightM:5,originXM:0,originYM:0,resolutionMPerPixel:.05}));
  let session={sessionId,mapId:mapB,mapAssetHash:hash,state:'READY',expiresAt:'2099-01-01T00:00:00Z',initialization:{revision:1}};
  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=100;return c.toDataURL().split(',')[1];}),'base64');
  await page.addInitScript(()=>localStorage.setItem('mediassist-rover.session',JSON.stringify({account:{role:'ADMIN',username:'scope-fixture'},tokens:{accessToken:'fixture-only'}})));
  await page.route('**/api/v1/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    assert.equal(request.headers().authorization,'Bearer fixture-only');
    const json=value=>route.fulfill({json:value}),rows=content=>json({content,last:true,totalPages:1});
    if(method!=='GET')writes.push({path,body:request.postDataJSON()});
    if(path.endsWith('/auth/me'))return json({role:'ADMIN',username:'scope-fixture'});
    if(path==='/api/v1/maps')return rows(maps);
    if(path==='/api/v1/robots')return rows([robot]);
    if(path.endsWith('/snapshot'))return json({robot,navigationSession:session,observedAt:new Date().toISOString(),mqttConnected:true,heartbeatFresh:true,dispatchReady:true,activeJobId:null});
    if(path.endsWith('/navigation-session/close')){session={...session,state:'CLOSED'};return json(session);}
    if(path.endsWith('/navigation-zones'))return json({robotId,mapId:mapB,profileAcknowledged:false,zoneCount:0,restrictedZoneCount:0,speedZoneCount:0});
    if(path.endsWith('/image-metadata'))return json({map_id:path.includes(mapA)?mapA:mapB,asset_hash:hash,frame_id:'map',width_px:100,height_px:100,resolution_m_per_pixel:.05,origin_x_m:0,origin_y_m:0,origin_yaw_rad:0,navigation_reload_safe:true});
    if(path.endsWith('/image.png'))return route.fulfill({contentType:'image/png',body:png});
    if(path.startsWith('/api/v1/maps/'))return json(maps.find(m=>path.includes(m.mapId)));
    if(path.includes('/by-idempotency-key'))return json(null);
    if(path.endsWith('/stream'))return route.fulfill({status:503,body:'fixture stream unavailable'});
    if(method==='GET')return rows([]);
    throw Error('Unexpected write '+path);
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5175')+'/workstations?mapId='+mapA);
  await page.getByLabel('Robot điều phối',{exact:true}).selectOption(robotId);
  await page.getByRole('button',{name:'Mở điều phối robot',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Robot đang có phiên trên bản đồ khác'}).waitFor();
  assert.equal(await page.locator('iframe').count(),0);
  assert(await page.getByLabel('Bản đồ trong database',{exact:true}).isEnabled());
  assert.equal(writes.length,0);
  await page.getByRole('button',{name:'Xem phiên trên bản đồ đang dùng',exact:true}).click();
  const frame=page.frameLocator('iframe');
  await frame.locator('#navMapInfo').filter({hasText:'Bản đồ B'}).waitFor();
  assert.equal(await page.getByLabel('Bản đồ trong database',{exact:true}).inputValue(),mapB);
  assert(await page.getByRole('button',{name:'Đổi robot hoặc bản đồ',exact:true}).isDisabled());
  const storageKey=await frame.locator('body').evaluate(()=>window.marNavigationStorage);
  await frame.locator('#navCloseSession').click();
  await page.getByRole('button',{name:'Đổi robot hoặc bản đồ',exact:true}).waitFor();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Đổi robot hoặc bản đồ')?.disabled);
  await page.getByRole('button',{name:'Đổi robot hoặc bản đồ',exact:true}).click();
  assert.equal(await page.locator('iframe').count(),0);
  assert.deepEqual(writes.map(w=>w.path),[`/api/v1/robots/${robotId}/navigation-session/close`]);

  // A pending request on B must not hijack the console opened for A.
  await page.evaluate(({storageKey,requestKey,robotId,mapB,sessionId})=>sessionStorage.setItem(storageKey,JSON.stringify({key:requestKey,kind:'SINGLE',body:{robotId,mapId:mapB,navigationSessionId:sessionId},done:false,retryable:true})),{storageKey,requestKey,robotId,mapB,sessionId});
  await page.reload();
  await page.getByRole('region',{name:'Yêu cầu điều phối trước'}).waitFor();
  await page.getByLabel('Bản đồ trong database',{exact:true}).selectOption(mapA);
  await page.getByLabel('Robot điều phối',{exact:true}).selectOption(robotId);
  await page.getByRole('button',{name:'Mở điều phối robot',exact:true}).click();
  await frame.locator('#navMapInfo').filter({hasText:'Bản đồ A'}).waitFor();
  const otherKey=await frame.locator('body').evaluate(()=>window.marNavigationStorage);
  assert.notEqual(otherKey,storageKey);
  assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)).key,storageKey),requestKey);
  assert.equal(writes.length,1,'Resuming or switching scopes never creates a MOVE');
  assert.deepEqual(errors,[]);
  console.log('PASS navigation scope: existing other-map session resumed, explicit close/change gated, scoped pending preserved without replay. All APIs mocked.');
}finally{await browser.close();}
