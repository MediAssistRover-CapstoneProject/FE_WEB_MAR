import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{
  localStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'test-only'},account:{role:'ADMIN'}}));
  window.facilityUpdates=0;
  window.addEventListener('mediassist-facility-updated',()=>window.facilityUpdates++);
});
const page=await context.newPage(),errors=[],writes=[];
page.on('pageerror',error=>errors.push(error.message));
const map=(mapId,status,floorId='f1')=>({mapId,mapName:`Bản đồ ${mapId}`,floorId,status,versionNo:1,widthM:10,heightM:8,resolutionMPerPixel:.05,originXM:0,originYM:0,originYawRad:0});
let maps,metadata,points,responseMode,release;
const reset=()=>{
  maps=[map('a','ACTIVE'),map('b','DRAFT'),map('c','ACTIVE','f2'),map('d','INACTIVE'),map('e','ARCHIVED')];
  metadata={navigation_reload_safe:true};
  points=[{endpointId:'p1',mapId:'b',active:true,accessible:true}];
  responseMode='success';
};
reset();
await context.route(url=>url.pathname.startsWith('/api/'),async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(request.method()!=='GET'){
    writes.push({method:request.method(),path});
    if(!path.endsWith('/b/activate'))throw Error(`Unexpected write: ${path}`);
    if(responseMode==='hold')await new Promise(resolve=>{release=resolve;});
    if(responseMode==='failure')return reply({message:'Không thể kích hoạt lúc này'},409);
    if(responseMode==='mismatch')return reply({...maps[0],status:'ACTIVE'});
    maps=maps.map(item=>item.mapId==='b'?{...item,status:'ACTIVE'}:item.floorId==='f1'&&item.status==='ACTIVE'?{...item,status:'INACTIVE'}:item);
    return reply(maps.find(item=>item.mapId==='b'));
  }
  if(path.endsWith('/image-metadata'))return reply({map_id:path.split('/')[4],width_px:200,height_px:160,resolution_m_per_pixel:.05,origin_x_m:0,origin_y_m:0,origin_yaw_rad:0,...metadata});
  if(path.endsWith('/image.png'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=','base64')});
  if(path.endsWith('/published/all'))return reply([]);
  return reply({content:path==='/api/v1/maps'?maps:path==='/api/v1/endpoints'?points:[],last:true,totalPages:1});
});
const base=process.env.TEST_URL||'http://127.0.0.1:5175';
const preview=page.locator('.sml-preview');
const activate=page.getByRole('button',{name:'Kích hoạt bản đồ',exact:true});
const choose=async id=>{
  const picker=page.locator('.sml-picker');
  if(!await picker.evaluate(element=>element.open))await picker.locator('summary').click();
  await picker.getByRole('button',{name:new RegExp(`Bản đồ ${id} `)}).click();
};
const open=async()=>{
  await page.goto(base+'/admin/map');
  await expect(page.getByRole('button',{name:'Đã kích hoạt',exact:true})).toBeDisabled();
  await choose('b');
};
try{
  await open();
  await mkdir('.workstation-build/map-activation',{recursive:true});
  for(const width of [2560,1440,1024,390]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Layout fits ${width}px`);
    await expect(activate).toBeEnabled();
    if(width===1440||width===390)await page.screenshot({path:`.workstation-build/map-activation/library-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  for(const invalidPoints of [[],[{mapId:'a',active:true,accessible:true}],[{mapId:'b',active:false,accessible:true}],[{mapId:'b',active:true,accessible:false}]]){
    points=invalidPoints;
    await activate.click();
    await expect(page.getByRole('alert')).toContainText('ít nhất một điểm đích');
    assert.equal(writes.length,0,'Invalid endpoints never activate the map');
    await expect(activate).toBeEnabled();
  }
  points=[{mapId:'b',active:true,accessible:true}];
  for(const invalidMetadata of [{navigation_reload_safe:false},{navigation_reload_safe:undefined},{map_id:'other',navigation_reload_safe:true}]){
    metadata=invalidMetadata;
    await activate.click();
    await expect(page.getByRole('alert')).toContainText('Chưa xác minh');
    assert.equal(writes.length,0,'Unverified map never activates');
  }
  metadata={navigation_reload_safe:true};
  for(const mode of ['failure','mismatch']){
    responseMode=mode;
    await activate.click();
    await expect(page.getByRole('alert')).toContainText(mode==='failure'?'Không thể kích hoạt lúc này':'chưa xác nhận');
    await expect(preview.locator('.sml-status')).toHaveText('Nháp');
    assert.equal(await page.evaluate(()=>window.facilityUpdates),0);
  }
  responseMode='hold';
  const writeCount=writes.length;
  await activate.click();
  await expect(page.getByRole('button',{name:'Đang kích hoạt…',exact:true})).toBeDisabled();
  await page.locator('.sml-picker summary').click();
  await expect(page.locator('.sml-map-option').first()).toBeDisabled();
  await expect(page.getByRole('button',{name:'Tải lại danh sách map',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Xóa bản đồ',exact:true})).toBeDisabled();
  await expect.poll(()=>typeof release).toBe('function');
  assert.equal(writes.length,writeCount+1,'Only one activation request in flight');
  release();
  await expect(preview.locator('.sml-status')).toHaveText('Đang hoạt động');
  await expect(page.getByRole('button',{name:'Đã kích hoạt',exact:true})).toBeDisabled();
  await expect(page.getByRole('status').filter({hasText:'Đã kích hoạt bản đồ'})).toBeVisible();
  assert.equal(await page.evaluate(()=>window.facilityUpdates),1);
  await expect(page.locator('.sml-map-option').filter({hasText:'Bản đồ a'}).locator('.sml-status')).toHaveText('Không hoạt động');
  await expect(page.locator('.sml-map-option').filter({hasText:'Bản đồ c'}).locator('.sml-status')).toHaveText('Đang hoạt động');
  await page.getByRole('button',{name:'Tải lại danh sách map',exact:true}).click();
  await expect(preview.locator('.sml-status')).toHaveText('Đang hoạt động');
  await choose('d');await expect(activate).toBeEnabled();
  await choose('e');await expect(activate).toBeDisabled();
  assert.deepEqual(errors,[]);
  console.log('PASS: library activation, prerequisites, server failures, response validation, pending controls, same-floor replacement, reload and desktop/mobile layout. All API requests mocked.');
}finally{await browser.close();}
