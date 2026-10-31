import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { vi } from '../src/i18n/vi.js';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const STORAGE_KEY='mediassist.map-studio.lidar.v3';
const legacy={schema:3,revision:0,name:'Map mô phỏng cũ',scan:{status:'complete',progress:100},zones:[{id:'local-zone',name:'Vùng mô phỏng cũ',type:'KEEP_OUT',points:[{x:100,y:100},{x:200,y:100},{x:200,y:200}]}],endpoints:[],endpointGroups:[],saved:null};
await context.addInitScript(({legacy,key})=>{
  sessionStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'test-only'},account:{role:'ADMIN'}}));
  if(!sessionStorage.getItem('map-database-fixture')){
    localStorage.setItem(key,JSON.stringify(legacy));
    sessionStorage.setItem('map-database-fixture','seeded');
  }
},{legacy,key:STORAGE_KEY});
const page=await context.newPage(),errors=[],writes=[],images=[];
page.on('pageerror',e=>errors.push(e.message));
const map=(id,status)=>({mapId:id,mapName:`Map database ${id}`,floorId:'floor-1',versionNo:1,status,widthM:10,heightM:8,resolutionMPerPixel:.05,originXM:0,originYM:0,originYawRad:0});
let maps=[map('a','ACTIVE'),map('b','DRAFT')],failMaps=false;
await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
  const req=route.request(),url=new URL(req.url()),resource=url.pathname.split('/')[3];
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()!=='GET'){writes.push(req.url());return reply({message:'Unexpected write'},400);}
  if(url.pathname.endsWith('/image-metadata')){
    const id=url.pathname.split('/')[4];images.push(id);
    return reply({map_id:id,width_px:200,height_px:160,resolution_m_per_pixel:.05,origin_x_m:0,origin_y_m:0,origin_yaw_rad:0});
  }
  if(url.pathname.endsWith('/image.png'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=','base64')});
  if(resource==='maps'&&failMaps)return reply({message:'Database unavailable'},503);
  if(url.pathname.endsWith('/published/all'))return reply([]);
  return reply({content:resource==='maps'?maps:[],last:true,totalPages:1});
});
const base=process.env.TEST_URL||'http://127.0.0.1:5175';
const tab=name=>page.getByRole('navigation',{name:vi('Map Studio stages'),exact:true}).getByRole('button',{name,exact:true});
const expectMap=async id=>{
  await page.locator(`[data-map-id="${id}"]`).waitFor();
  await page.getByText('Bản đồ quét đã lưu · Bấm vùng hoặc điểm để chỉnh sửa.',{exact:false}).waitFor();
  assert.equal(await page.locator('.ls-map').count(),0,'No local simulation canvas');
  assert.equal(await page.getByText('Vùng mô phỏng cũ',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:/mô phỏng/i}).count(),0,'No simulation entry');
};
await mkdir('.workstation-build/map-database-flow',{recursive:true});
try{
  await page.goto(base+'/admin/map');
  await page.getByRole('heading',{name:'Thư viện bản đồ',level:2,exact:true}).waitFor();
  const picker=page.locator('.sml-picker'),summary=picker.locator('summary');
  await summary.getByText('Map database a',{exact:true}).waitFor();
  assert.equal(await picker.getAttribute('open'),null,'Map picker starts compact');
  await summary.focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:/Map database b/}).waitFor();
  for(const width of [2560,1024,1440]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Map picker fits '+width);
  }
  await page.getByRole('button',{name:/Map database b/}).click();
  assert.equal(await picker.getAttribute('open'),null,'Choosing a map collapses the picker');
  await summary.getByText('Map database b',{exact:true}).waitFor();
  await summary.click();await summary.click();
  assert.equal(await picker.getAttribute('open'),null,'Picker can be opened and closed');
  await page.screenshot({path:'.workstation-build/map-database-flow/library-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await summary.click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'.workstation-build/map-database-flow/library-mobile.png',fullPage:true});
  await summary.click();await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Mở bản đồ',exact:true}).click();
  await expectMap('b');
  await page.getByRole('button',{name:'← Thư viện bản đồ',exact:true}).click();
  await summary.getByText('Map database b',{exact:true}).waitFor();
  await page.getByRole('button',{name:'← Quay lại bản đồ đang chỉnh',exact:true}).click();
  await expectMap('b');
  await tab('3. Điểm đích').click();await expectMap('b');
  assert.equal(await page.getByLabel('Bản đồ BE',{exact:true}).count(),0,'Editor uses the map selected in the library');
  assert.equal(await page.getByText('Đã đọc danh mục từ BE. Chưa thay đổi dữ liệu máy chủ.',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Công khai 0 điểm đích',exact:true}).count(),0);
  for(const width of [2560,1440,1024,390]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Endpoint fits '+width);
    await page.screenshot({path:`.workstation-build/map-database-flow/endpoint-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'← Thư viện bản đồ',exact:true}).click();
  await summary.click();
  await page.getByRole('button',{name:/Map database a/}).click();
  await page.getByRole('button',{name:'Mở bản đồ',exact:true}).click();
  await tab('2. Vùng').click();await expectMap('a');
  await tab('1. Quét').click();
  assert.equal(await page.getByRole('button',{name:/mô phỏng/i}).count(),0);
  await tab('2. Vùng').click();await expectMap('a');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY),JSON.stringify(legacy),'Mapping does not rewrite legacy local drafts');
  await page.screenshot({path:'.workstation-build/map-database-flow/zones-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'.workstation-build/map-database-flow/zones-mobile.png',fullPage:true});

  // Even without a completed local scan, database tabs remain available.
  await page.evaluate(()=>localStorage.clear());
  await page.goto(base+'/admin/map');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY),null,'Mapping no longer creates simulated drafts');
  await page.getByRole('button',{name:'Quét map mới',exact:true}).click();
  await tab('2. Vùng').click();await expectMap('a');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY),null);
  await page.goto(base+'/admin/map?mapId=b');await expectMap('b');
  await tab('2. Vùng').click();await expectMap('b');
  assert.ok(images.includes('a')&&images.includes('b'),'Images requested by selected database map ID');

  // Missing or unavailable database maps never fall back to a local map.
  maps=[];await page.goto(base+'/admin/map');
  await page.getByText('Database chưa có bản đồ.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Quét map mới',exact:true}).click();
  await tab('2. Vùng').click();
  await page.getByText('Chưa có bản đồ để chỉnh sửa',{exact:true}).waitFor();
  assert.equal(await page.locator('.ls-map').count(),0);
  failMaps=true;await page.goto(base+'/admin/map');
  await page.getByRole('alert').filter({hasText:'Database unavailable'}).waitFor();
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('PASS: database-first entry, legacy draft isolation, map selection across tabs/scan, direct mapId, empty/error states and mobile layout. All API requests mocked.');
}finally{await browser.close();}
