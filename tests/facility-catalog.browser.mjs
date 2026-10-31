import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>sessionStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'test-not-a-real-token'},account:{role:'ADMIN'}})));
const page=await context.newPage(),errors=[],writes=[],reads=[];page.on('pageerror',e=>errors.push(e.message));
const map={mapId:'map-a',floorId:'f1',mapName:'Bản đồ BE thử nghiệm',mapCode:'MAP_A',versionNo:3,status:'DRAFT',widthM:40,heightM:20,resolutionMPerPixel:.05,originXM:-5,originYM:-2,originYawRad:0,frameId:'map'};
const endpoint=(id,mapId)=>({endpointId:id,mapId,endpointCode:id,endpointName:id==='end-a'?'Điểm quầy A':'Điểm bản đồ khác',endpointType:'WAYPOINT',xM:2,yM:3,yawRad:0,active:true,accessible:true,publicVisible:false});
const state={maps:[map],zones:[],rooms:[],endpoints:[endpoint('end-a','map-a'),endpoint('end-other','map-other')],'endpoint-groups':[],'endpoint-group-members':[]};
let rejectNext=false;
await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
 const req=route.request(),url=new URL(req.url()),parts=url.pathname.split('/').filter(Boolean),resource=parts[2],method=req.method();
 const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(method==='GET'){
  reads.push(url.pathname+url.search);
  if(url.pathname.endsWith('/image-metadata'))return reply({map_id:'map-a',width_px:800,height_px:400,resolution_m_per_pixel:.05,origin_x_m:-5,origin_y_m:-2,origin_yaw_rad:0});
  if(url.pathname.endsWith('/image.png'))return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=','base64')});
  // Ensure page 2 is fetched, not a hidden first-page-only implementation.
  if(resource==='endpoints'&&url.searchParams.get('page')==='0')return reply({content:Array.from({length:100},(_,i)=>endpoint('foreign-'+i,'map-other')),last:false,totalPages:2});
  return reply({content:state[resource]||[],last:true,totalPages:resource==='endpoints'?2:1});
 }
 const body=req.postDataJSON();writes.push({path:url.pathname,method,body});
 if(resource==='maps'&&parts[4]==='activate'){state.maps=state.maps.map(m=>({...m,status:'ACTIVE'}));return reply(state.maps[0]);}
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
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:5175')+'/__test/facility-catalog');
 await page.locator('[data-map-id="map-a"]').waitFor();
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
 await page.getByText('Bản đồ quét đã lưu · Bấm vùng hoặc điểm để chỉnh sửa.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'+ Điểm mới',exact:true}).click();
 const canvas=page.getByRole('img',{name:'Lớp vùng và điểm đích BE theo mét',exact:true});
 await canvas.scrollIntoViewIfNeeded();
 const bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+60,bounds.y+bounds.height/2-60,{steps:5});await page.mouse.up();
 let selectedX=Number(await page.getByLabel('X (m)',{exact:true}).inputValue()),selectedY=Number(await page.getByLabel('Y (m)',{exact:true}).inputValue());
 assert.ok(Math.abs(selectedX-15)<.05);assert.ok(Math.abs(selectedY-8)<.05);
 assert.ok(Math.abs(Number(await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue())-45)<2);
 const previousX=selectedX,previousY=selectedY,previousAngle=await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue(),previousView=await canvas.getAttribute('viewBox'),writeCount=writes.length;
 const marker=await page.locator('[data-draft-endpoint]').evaluate(node=>{const p=new DOMPoint(0,0).matrixTransform(node.getScreenCTM());return {x:p.x,y:p.y};});
 await page.mouse.move(marker.x,marker.y);await page.mouse.down();await page.mouse.move(marker.x+65,marker.y+35,{steps:6});await page.mouse.up();
 selectedX=Number(await page.getByLabel('X (m)',{exact:true}).inputValue());selectedY=Number(await page.getByLabel('Y (m)',{exact:true}).inputValue());
 assert.ok(selectedX>previousX);assert.ok(selectedY<previousY);assert.equal(await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue(),previousAngle);assert.equal(await canvas.getAttribute('viewBox'),previousView);assert.equal(writes.length,writeCount);
 await page.getByLabel('Mã điểm',{exact:true}).fill('END_NEW');await page.getByLabel('Tên điểm',{exact:true}).fill('Điểm mới');await page.getByLabel('Hướng đến (độ)',{exact:true}).fill('90');
 await page.getByRole('button',{name:/Lưu điểm đích|Lưu thay đổi/ }).click();await page.getByText('Chỉnh điểm đích',{exact:true}).waitFor();assert.equal(writes.at(-1).body.yawRad,Math.PI/2);
 assert.equal(writes.at(-1).body.mapId,'map-a');assert.equal(writes.at(-1).body.xM,selectedX);assert.equal(writes.at(-1).body.yM,selectedY);
 assert.equal(writes.at(-1).method,'POST');assert.equal(writes.at(-1).body.endpointType,'WAYPOINT');assert.equal(writes.at(-1).body.active,true);assert.equal(writes.at(-1).body.accessible,true);
 const countBefore=writes.length;
 await page.getByLabel('X (m)',{exact:true}).fill('1000');await page.getByRole('button',{name:/Lưu điểm đích|Lưu thay đổi/ }).click();
 await page.getByRole('status').filter({hasText:'Điểm đích phải nằm trong ảnh bản đồ'}).waitFor();assert.equal(writes.length,countBefore);
 await page.getByLabel('X (m)',{exact:true}).fill(String(selectedX));await page.getByLabel('Tên điểm',{exact:true}).fill('Điểm đã sửa');
 await page.getByRole('button',{name:/Lưu điểm đích|Lưu thay đổi/ }).click();await page.getByRole('status').filter({hasText:'Đã lưu thay đổi.'}).waitFor();
 assert.equal(writes.at(-1).method,'PUT');assert.equal(writes.at(-1).path,'/api/v1/endpoints/end-new');assert.equal(writes.at(-1).body.endpointType,'WAYPOINT');
 await page.getByRole('button',{name:'-90°',exact:true}).click();assert.equal(Number(await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue()),-90);
 assert.equal(await page.getByRole('button',{name:'Kích hoạt bản đồ',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Bỏ thay đổi',exact:true}).click();assert.equal(Number(await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue()),90);
 await page.getByRole('button',{name:'Kích hoạt bản đồ',exact:true}).click();await page.getByText('Bản đồ sẵn sàng điều phối',{exact:false}).waitFor();
 assert.equal(writes.at(-1).path,'/api/v1/maps/map-a/activate');assert.equal(await page.getByRole('button',{name:'Mở Điều phối →',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Công khai 2 điểm đích',exact:true}).click();await page.getByRole('button',{name:'Công khai 2 điểm đích',exact:true}).waitFor({state:'detached'});
 assert.ok(state.endpoints.filter(p=>p.mapId==='map-a').every(p=>p.publicVisible));assert.equal(state.endpoints.find(p=>p.mapId==='map-other').publicVisible,false);
 await page.screenshot({path:'.workstation-build/facility/endpoint-map.png',fullPage:true});
 for(const [width,height]of[[1024,768],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Endpoint no overflow '+width);await page.screenshot({path:`.workstation-build/facility/endpoint-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);assert.ok(writes.every(w=>/\/api\/v1\/(maps|zones|endpoints|endpoint-groups|endpoint-group-members)/.test(w.path)));
 console.log('PASS: paginated API catalog, map scoping, group/member CRUD + 409/204, zone + endpoint payload, responsive sizes. All writes mocked; no real BE mutations.');
}catch(e){console.error(errors);await page.screenshot({path:'.workstation-build/facility/failure.png',fullPage:true});throw e;}finally{await browser.close();}
