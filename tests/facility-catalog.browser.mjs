import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>sessionStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'test-not-a-real-token'},account:{role:'ADMIN'}})));
const page=await context.newPage(),errors=[],writes=[],reads=[];page.on('pageerror',e=>errors.push(e.message));
const map={mapId:'map-a',floorId:'f1',mapName:'Bản đồ BE thử nghiệm',mapCode:'MAP_A',versionNo:3,status:'ACTIVE',widthM:40,heightM:20,resolutionMPerPixel:.05,originXM:-5,originYM:-2,originYawRad:0,frameId:'map'};
const endpoint=(id,mapId)=>({endpointId:id,mapId,endpointCode:id,endpointName:id==='end-a'?'Điểm quầy A':'Điểm bản đồ khác',endpointType:'WAYPOINT',xM:2,yM:3,yawRad:0,active:true,accessible:true,publicVisible:false});
const state={maps:[map],zones:[],rooms:[],endpoints:[endpoint('end-a','map-a'),endpoint('end-other','map-other')],'endpoint-groups':[],'endpoint-group-members':[]};
let rejectNext=false;
await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
 const req=route.request(),url=new URL(req.url()),parts=url.pathname.split('/').filter(Boolean),resource=parts[2],method=req.method();
 const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(method==='GET'){
  reads.push(url.pathname+url.search);
  // Ensure page 2 is fetched, not a hidden first-page-only implementation.
  if(resource==='endpoints'&&url.searchParams.get('page')==='0')return reply({content:Array.from({length:100},(_,i)=>endpoint('foreign-'+i,'map-other')),last:false,totalPages:2});
  return reply({content:state[resource]||[],last:true,totalPages:resource==='endpoints'?2:1});
 }
 const body=req.postDataJSON();writes.push({path:url.pathname,method,body});
 if(rejectNext){rejectNext=false;return reply({message:'Sequence number already exists in this group'},409);}
 if(resource==='endpoint-groups'){
  const result={...body,endpointGroupId:parts[3]||'group-a'};state[resource]=[result];return reply(result,method==='POST'?201:200);
 }
 if(resource==='endpoint-group-members'){
  if(method==='DELETE'){state[resource]=state[resource].map(m=>({...m,active:false}));return route.fulfill({status:204});}
  const result={...body,mapId:'map-a'};state[resource]=[result];return reply(result,method==='POST'?201:200);
 }
 if(resource==='zones'){const result={...body,zoneId:'zone-a'};state.zones=[result];return reply(result,201);}
 if(resource==='endpoints'){const result={...body,endpointId:parts[3]||'end-new'};state.endpoints=[...state.endpoints.filter(p=>p.endpointId!==result.endpointId),result];return reply(result,201);}
 throw Error('Unexpected write: '+url.pathname);
});
await mkdir('.workstation-build/facility',{recursive:true});
// The catalog is deliberately no longer a Map Studio mode. Exercise the retained
// API component in an isolated test page, not by adding a production menu back.
await page.route('**/__test/facility-catalog',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/tests/fixtures/facility-catalog.jsx"></script></body></html>`}));
try{
 await page.goto('http://127.0.0.1:5173/__test/facility-catalog');
 await page.getByText('Đã đọc danh mục từ BE. Chưa thay đổi dữ liệu máy chủ.',{exact:true}).waitFor();
 assert.equal(writes.length,0);assert.ok(reads.some(p=>p.includes('endpoints?page=1')));
 await page.getByRole('button',{name:'3. Điểm đích',exact:true}).click();
 await page.getByRole('button',{name:'Nhóm điểm đích',exact:true}).click();
 const group=page.getByRole('region',{name:'Quản lý nhóm điểm đích'});
 await group.getByLabel('Mã nhóm',{exact:true}).fill('PICKUP');await group.getByLabel('Tên nhóm',{exact:true}).fill('Các quầy nhận');
 await group.getByRole('button',{name:'Tạo nhóm',exact:true}).click();
 await group.getByLabel('Điểm thành viên',{exact:true}).selectOption('end-a');
 assert.equal(await group.getByLabel('Điểm thành viên',{exact:true}).locator('option').count(),2);
 await group.getByRole('button',{name:'Lưu thành viên',exact:true}).click();
 await group.getByText('1. Điểm quầy A',{exact:true}).waitFor();
 assert.equal(writes[0].body.mapId,'map-a');assert.equal(writes[1].body.endpointGroupId,'group-a');assert.equal(writes[1].body.sequenceNo,1);
 await group.getByRole('button',{name:'Chỉnh thành viên',exact:true}).click();await group.getByLabel('Thứ tự ưu tiên',{exact:true}).fill('2');rejectNext=true;
 await group.getByRole('button',{name:'Lưu thành viên',exact:true}).click();await page.getByRole('status').filter({hasText:'HTTP 409'}).waitFor();
 assert.equal(await group.getByText('1. Điểm quầy A',{exact:true}).count(),1);
 await group.getByRole('button',{name:'Lưu thành viên',exact:true}).click();await group.getByText('2. Điểm quầy A',{exact:true}).waitFor();
 await group.getByRole('button',{name:'Tắt thành viên',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Quản lý nhóm điểm đích"] .ls-task small')?.textContent.includes('Tắt'));
 assert.equal(writes.at(-1).method,'DELETE');
 await page.getByRole('button',{name:'2. Vùng',exact:true}).click();
 await page.getByLabel('Mã vùng BE',{exact:true}).fill('WAIT_A');await page.getByLabel('Tên vùng BE',{exact:true}).fill('Sảnh chờ');
 await page.getByLabel('Chức năng vùng BE',{exact:true}).selectOption('NO_STOP');
 await page.getByText('Tọa độ đa giác nâng cao',{exact:true}).click();await page.getByLabel('Đa giác BE (mét)',{exact:true}).fill('{"points":[[0,0],[10,0],[10,8],[0,8]]}');
 await page.getByLabel('Giới hạn tốc độ (m/s)',{exact:true}).fill('.4');await page.getByLabel('Sức chứa (người)',{exact:true}).fill('20');
 await page.getByRole('button',{name:'Lưu vùng lên BE',exact:true}).click();await page.getByText('Chỉnh vùng BE',{exact:true}).waitFor();
 assert.equal(writes.at(-1).body.zoneType,'NO_STOP');assert.equal(writes.at(-1).body.capacityLimit,20);
 for(const [width,height]of[[1920,1080],[1366,768],[1024,768],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width);await page.screenshot({path:`.workstation-build/facility/zones-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1366,height:900});await page.getByRole('button',{name:'3. Điểm đích',exact:true}).click();await page.getByRole('button',{name:'Điểm đích',exact:true}).click();
 await page.getByLabel('Mã điểm BE',{exact:true}).fill('END_NEW');await page.getByLabel('Tên điểm BE',{exact:true}).fill('Điểm mới');await page.getByLabel('X (m)',{exact:true}).fill('5');await page.getByLabel('Y (m)',{exact:true}).fill('7');await page.getByLabel('Hướng đến (radian)',{exact:true}).fill('1.57');
 await page.getByRole('button',{name:'Lưu điểm lên BE',exact:true}).click();await page.getByText('Chỉnh điểm BE',{exact:true}).waitFor();assert.equal(writes.at(-1).body.yawRad,1.57);
 assert.deepEqual(errors,[]);assert.ok(writes.every(w=>/\/api\/v1\/(zones|endpoints|endpoint-groups|endpoint-group-members)/.test(w.path)));
 console.log('PASS: paginated API catalog, map scoping, group/member CRUD + 409/204, zone + endpoint payload, responsive sizes. All writes mocked; no real BE mutations.');
}catch(e){console.error(errors);await page.screenshot({path:'.workstation-build/facility/failure.png',fullPage:true});throw e;}finally{await browser.close();}
