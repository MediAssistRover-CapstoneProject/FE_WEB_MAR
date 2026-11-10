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
const existingZone={zoneId:'zone-existing',mapId:'map-a',zoneCode:'zone_001',zoneName:'Vùng đã cấu hình',zoneType:'SPEED',polygonJson:{points:[[-3,-1],[-2,-1],[-2,0],[-3,0]]},speedLimitMps:.3,capacityLimit:20,calibratedAreaM2:6,cameraSourceRef:'cam-existing',cameraRoiJson:{roi:[0,0,1,1]},active:false,publicVisible:true,description:'Ghi chú cũ'};
const state={maps:[map],zones:[existingZone],rooms:[],endpoints:[endpoint('end-a','map-a'),endpoint('end-other','map-other')],'endpoint-groups':[],'endpoint-group-members':[]};
let rejectNext=false,rejectPoint=false,failPointNetwork=false,reloadSafe=true,uncertainCopy=false,rejectEndpointState=false,zoneStateResponse='',zoneSequence=0;
await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
 const req=route.request(),url=new URL(req.url()),parts=url.pathname.split('/').filter(Boolean),resource=parts[2],method=req.method();
 const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(method==='GET'){
  reads.push(url.pathname+url.search);
  if(url.pathname.endsWith('/image-metadata'))return reply({map_id:parts[3],width_px:800,height_px:400,resolution_m_per_pixel:.05,origin_x_m:-5,origin_y_m:-2,origin_yaw_rad:0,navigation_reload_safe:reloadSafe});
  if(url.pathname.endsWith('/image.png'))return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=','base64')});
  // Ensure page 2 is fetched, not a hidden first-page-only implementation.
  if(resource==='endpoints'&&url.searchParams.get('page')==='0')return reply({content:Array.from({length:100},(_,i)=>endpoint('foreign-'+i,'map-other')),last:false,totalPages:2});
  if(resource==='zones')return reply({content:state.zones.filter(zone=>zone.active||url.searchParams.get('includeDeleted')==='true'),last:true,totalPages:1});
  return reply({content:state[resource]||[],last:true,totalPages:resource==='endpoints'?2:1});
 }
 const body=req.postDataJSON();writes.push({path:url.pathname,method,body});
 if(resource==='maps'&&parts[4]==='validate-navigation-point')return failPointNetwork?route.abort('namenotresolved'):rejectPoint?reply({message:'Point is occupied or unknown'},400):reply({mapId:parts[3],knownFree:true});
 if(resource==='maps'&&parts[4]==='navigation-copy'){
  if(uncertainCopy)return reply({message:'Connection lost while creating map'},503);
  const source=state.maps.find(m=>m.mapId===parts[3]),copy={...source,mapId:'map-nav',mapName:'Bản đồ tương thích mới',status:'DRAFT'};
  state.maps.push(copy);state.endpoints.push(...state.endpoints.filter(p=>p.mapId===source.mapId).map(p=>({...p,mapId:copy.mapId,endpointId:p.endpointId+'-copy'})));reloadSafe=true;
  return reply({mapId:copy.mapId,status:copy.status,assetHash:'test-hash'});
 }
 if(resource==='maps'&&parts[4]==='activate'){state.maps=state.maps.map(m=>({...m,status:'ACTIVE'}));return reply(state.maps[0]);}
 if(rejectNext){rejectNext=false;return reply({message:'Sequence number already exists in this group'},409);}
 if(resource==='endpoint-groups'){
  const result={...body,endpointGroupId:parts[3]||'group-a'};state[resource]=[result];return reply(result,method==='POST'?201:200);
 }
 if(resource==='endpoint-group-members'){
  if(method==='DELETE'){state[resource]=state[resource].map(m=>({...m,active:false}));return route.fulfill({status:204});}
  const result={...body,mapId:'map-a'};state[resource]=[result];return reply(result,method==='POST'?201:200);
 }
 if(resource==='zones'&&['activate','deactivate'].includes(parts[4])){
  assert.equal(method,'POST');assert.deepEqual(Object.keys(body),['reason']);assert.ok(body.reason.length>=5&&body.reason.length<=500);
  if(zoneStateResponse==='error')return reply({message:'Zone state temporarily unavailable'},503);
  const result={...state.zones.find(zone=>zone.zoneId===parts[3]),active:parts[4]==='activate'};
  if(zoneStateResponse==='mismatch')return reply({...result,mapId:'wrong-map'});
  state.zones=state.zones.map(zone=>zone.zoneId===result.zoneId?result:zone);return reply(result);
 }
 if(resource==='zones'){const result={...body,zoneId:parts[3]||'zone-'+(++zoneSequence)};state.zones=[...state.zones.filter(z=>z.zoneId!==result.zoneId),result];return reply(result,method==='POST'?201:200);}
 if(resource==='endpoints'&&['activate','deactivate'].includes(parts[4])){
  if(rejectEndpointState){rejectEndpointState=false;return reply({message:'Endpoint state temporarily unavailable'},503);}
  const point=state.endpoints.find(p=>p.endpointId===parts[3]);
  const result={...point,active:parts[4]==='activate'};
  state.endpoints=state.endpoints.map(p=>p.endpointId===result.endpointId?result:p);return reply(result);
 }
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
 const inactiveShape=()=>page.locator('[data-zone-id="zone-existing"]');
 assert.equal(await inactiveShape().getAttribute('data-zone-state'),'inactive');
 assert.equal(await inactiveShape().locator('polygon').getAttribute('stroke'),'#64748b');
 assert.ok(await inactiveShape().locator('polygon').getAttribute('stroke-dasharray'));
 assert.match(await inactiveShape().locator('text').textContent(),/Đã ngừng/);
 // A simple zone needs a name, type and a polygon; all extra fields stay collapsed.
 assert.equal(await page.getByLabel('Nguồn camera',{exact:true}).isVisible(),false);
 assert.equal(await page.getByLabel('Mã vùng',{exact:true}).isVisible(),false);
 assert.equal(await page.getByLabel('Giới hạn tốc độ (m/s)',{exact:true}).count(),0);
 await page.getByLabel('Tên vùng',{exact:true}).fill('Vùng cấm mới');
 assert.equal(await page.getByRole('button',{name:'Lưu vùng',exact:true}).isDisabled(),true);
 await page.getByText('Bản đồ quét đã lưu · Bấm vùng hoặc điểm để chỉnh sửa.',{exact:false}).waitFor();
 const zoneCanvas=page.getByRole('img',{name:'Lớp vùng và điểm đích BE theo mét',exact:true});
 await page.getByRole('button',{name:'Vẽ vùng',exact:true}).click();await zoneCanvas.scrollIntoViewIfNeeded();
 const zoneBox=await zoneCanvas.boundingBox(),beforeDraw=writes.length;
 for(const [x,y]of[[.2,.35],[.4,.35],[.4,.6],[.2,.6]])await page.mouse.click(zoneBox.x+zoneBox.width*x,zoneBox.y+zoneBox.height*y);
 assert.equal(writes.length,beforeDraw,'Drawing does not save automatically');
 await page.getByRole('button',{name:'Lưu vùng',exact:true}).click();await page.getByRole('heading',{name:'Chỉnh sửa vùng',exact:true}).waitFor();
 assert.equal(writes.at(-1).method,'POST');assert.equal(writes.at(-1).body.zoneCode,'ZONE_002','Auto code avoids existing codes ignoring case');
 assert.equal(writes.at(-1).body.zoneName,'Vùng cấm mới');assert.equal(writes.at(-1).body.zoneType,'KEEP_OUT');assert.equal(writes.at(-1).body.polygonJson.points.length,4);
 for(const key of ['speedLimitMps','capacityLimit','calibratedAreaM2','cameraSourceRef','cameraRoiJson'])assert.equal(writes.at(-1).body[key],null);
 assert.equal(writes.at(-1).body.active,true);assert.equal(writes.at(-1).body.publicVisible,false);
 // Editing only the name preserves all advanced fields from the existing API record.
 await page.getByRole('button',{name:/Vùng đã cấu hình/}).click();
 assert.equal(await inactiveShape().getAttribute('data-zone-state'),'inactive','Selected inactive zone keeps its gray dashed style');
 assert.equal(await page.getByLabel('Giới hạn tốc độ (m/s)',{exact:true}).isVisible(),true);
 assert.equal(await page.getByLabel('Nguồn camera',{exact:true}).isVisible(),false);
 await page.getByLabel('Tên vùng',{exact:true}).fill('Vùng giảm tốc đã sửa');
 await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.zm-saved')?.textContent.includes('Vùng giảm tốc đã sửa'));
 assert.equal(writes.at(-1).method,'PUT');assert.equal(writes.at(-1).path,'/api/v1/zones/zone-existing');
 for(const key of ['zoneCode','speedLimitMps','capacityLimit','calibratedAreaM2','cameraSourceRef','cameraRoiJson','active','publicVisible','description'])assert.deepEqual(writes.at(-1).body[key],existingZone[key],key+' retained while advanced section is closed');
 // Lifecycle actions are visible, require a reason and preserve the saved configuration.
 const zoneState=page.getByRole('region',{name:'Trạng thái vùng',exact:true});
 const zoneReason=zoneState.getByLabel('Lý do đổi trạng thái vùng',{exact:true});
 const activateZone=()=>zoneState.getByRole('button',{name:'Kích hoạt lại vùng',exact:true});
 const deactivateZone=()=>zoneState.getByRole('button',{name:'Ngừng hoạt động vùng',exact:true});
 await activateZone().waitFor();assert.equal(await activateZone().isDisabled(),true);
 await zoneReason.fill('Kiểm tra kích hoạt vùng');
 const savedZone=structuredClone(state.zones.find(zone=>zone.zoneId==='zone-existing'));
 await page.getByLabel('Tên vùng',{exact:true}).fill('Tên chưa lưu');
 assert.equal(await activateZone().isDisabled(),true,'Do not discard unsaved edits when changing lifecycle');
 await page.getByRole('button',{name:'Bỏ thay đổi',exact:true}).click();
 assert.equal(await activateZone().isEnabled(),true);
 zoneStateResponse='error';await activateZone().click();
 await page.getByRole('status').filter({hasText:'HTTP 503'}).waitFor();
 assert.equal(await activateZone().count(),1,'Failed requests keep the inactive state');
 assert.deepEqual(state.zones.find(zone=>zone.zoneId==='zone-existing'),savedZone);
 zoneStateResponse='mismatch';await activateZone().click();
 await page.getByRole('status').filter({hasText:'đúng vùng'}).waitFor();
 assert.equal(await activateZone().count(),1,'A different map response cannot update the selected zone');
 zoneStateResponse='';await activateZone().click();await deactivateZone().waitFor();
 assert.equal(await inactiveShape().getAttribute('data-zone-state'),'active');
 assert.equal(await inactiveShape().locator('polygon').getAttribute('stroke-dasharray'),null);
 assert.deepEqual(state.zones.find(zone=>zone.zoneId==='zone-existing'),{...savedZone,active:true});
 assert.equal(await zoneReason.inputValue(),'','Clear the reason only after a confirmed transition');
 await zoneReason.fill('Tạm ngừng vùng để cấu hình lại');await deactivateZone().click();await activateZone().waitFor();
 assert.equal(writes.at(-1).path,'/api/v1/zones/zone-existing/deactivate');
 assert.deepEqual(state.zones.find(zone=>zone.zoneId==='zone-existing'),savedZone,'Deactivation preserves geometry and advanced fields');
 await page.reload();await page.getByRole('button',{name:'2. Vùng',exact:true}).click();
 await page.getByRole('button',{name:/Vùng giảm tốc đã sửa/}).click();await activateZone().waitFor();
 assert.ok(reads.some(path=>path.startsWith('/api/v1/zones?')&&path.includes('includeDeleted=true')),'Inactive zones remain available after reload');
 const zoneFilters=page.getByRole('navigation',{name:'Lọc danh sách vùng',exact:true});
 await zoneFilters.getByRole('button',{name:/Đã ngừng/}).click();
 assert.equal(await page.locator('.zm-saved .ls-item').count(),1);
 assert.match(await page.locator('.zm-saved .ls-item').textContent(),/Ngừng hoạt động/);
 await zoneFilters.getByRole('button',{name:/Đang hoạt động/}).click();
 assert.equal(await page.locator('.zm-saved .ls-item.is-inactive').count(),0);
 await zoneFilters.getByRole('button',{name:/Tất cả/}).click();
 await page.screenshot({path:'.workstation-build/facility/zone-inactive.png',fullPage:true});
 // Speed-specific input is shown only for SPEED; geometry can still be entered manually.
 await page.getByRole('button',{name:'+ Vùng mới',exact:true}).click();await page.getByLabel('Tên vùng',{exact:true}).fill('Khu vực giảm tốc');
 await page.getByLabel('Loại vùng',{exact:true}).selectOption('SPEED');
 assert.equal(await page.getByLabel('Giới hạn tốc độ (m/s)',{exact:true}).evaluate(input=>input.required&&!input.checkValidity()),true);
 await page.getByLabel('Giới hạn tốc độ (m/s)',{exact:true}).fill('.9');
 assert.equal(await page.getByLabel('Giới hạn tốc độ (m/s)',{exact:true}).evaluate(input=>input.checkValidity()),false,'SPEED cannot exceed BE limit .8');
 await page.getByLabel('Giới hạn tốc độ (m/s)',{exact:true}).fill('.4');
 await page.getByText('Nhập tọa độ thủ công',{exact:true}).click();await page.getByLabel('Tọa độ vùng (mét)',{exact:true}).fill('{"points":[[0,0],[10,0],[10,8],[0,8]]}');
 await page.getByText('Nhập tọa độ thủ công',{exact:true}).click();
 await page.getByRole('button',{name:'Lưu vùng',exact:true}).click();await page.getByRole('heading',{name:'Chỉnh sửa vùng',exact:true}).waitFor();
 assert.equal(writes.at(-1).body.zoneType,'SPEED');assert.equal(writes.at(-1).body.speedLimitMps,.4);assert.equal(writes.at(-1).body.zoneCode,'ZONE_003');
 for(const [width,height]of[[1920,1080],[1366,768],[1024,768],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width);await page.screenshot({path:`.workstation-build/facility/zones-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1366,height:900});await page.getByRole('button',{name:'3. Điểm đích',exact:true}).click();await page.getByRole('button',{name:'Điểm đích',exact:true}).click();
 assert.equal(await page.locator('[data-zone-state="inactive"]').count(),0,'Inactive zones are not rendered on the endpoint map');
 assert.equal(await page.locator('[data-zone-id="zone-existing"]').count(),0);
 assert.ok(await page.locator('[data-zone-state="active"]').count()>0,'Active zones remain visible on the endpoint map');
 await page.getByText('Cài đặt điểm và liên kết',{exact:true}).click();
 assert.equal(await page.getByLabel('Vùng liên kết',{exact:true}).locator('option').filter({hasText:'Vùng giảm tốc đã sửa'}).count(),0,'Inactive zones are not offered for endpoint links');
 await page.getByText('Cài đặt điểm và liên kết',{exact:true}).click();
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
 assert.equal(writes.at(-2).path,'/api/v1/maps/map-a/validate-navigation-point');
 assert.deepEqual(writes.at(-2).body,{xM:selectedX,yM:selectedY});
 assert.equal(writes.at(-1).body.mapId,'map-a');assert.equal(writes.at(-1).body.xM,selectedX);assert.equal(writes.at(-1).body.yM,selectedY);
 assert.equal(writes.at(-1).method,'POST');assert.equal(writes.at(-1).body.endpointType,'WAYPOINT');assert.equal(writes.at(-1).body.active,true);assert.equal(writes.at(-1).body.accessible,true);
 const countBefore=writes.length;
 await page.getByLabel('X (m)',{exact:true}).fill('1000');await page.getByRole('button',{name:/Lưu điểm đích|Lưu thay đổi/ }).click();
 await page.getByRole('status').filter({hasText:'Điểm đích phải nằm trong ảnh bản đồ'}).waitFor();assert.equal(writes.length,countBefore);
 const movedX=selectedX+.5,movedY=selectedY+.75;
 await page.getByLabel('X (m)',{exact:true}).fill(String(movedX));await page.getByLabel('Y (m)',{exact:true}).fill(String(movedY));await page.getByLabel('Tên điểm',{exact:true}).fill('Điểm đã sửa');
 await page.getByRole('button',{name:/Lưu điểm đích|Lưu thay đổi/ }).click();await page.getByRole('status').filter({hasText:'Đã lưu thay đổi.'}).waitFor();
 assert.equal(writes.at(-1).method,'PUT');assert.equal(writes.at(-1).path,'/api/v1/endpoints/end-new');assert.equal(writes.at(-1).body.endpointType,'WAYPOINT');
 assert.equal(writes.at(-1).body.xM,movedX);assert.equal(writes.at(-1).body.yM,movedY);
 assert.deepEqual(writes.at(-2).body,{xM:movedX,yM:movedY},'Occupancy validation uses the new position');
 // Edit a different saved point immediately after saving the first one.
 await canvas.scrollIntoViewIfNeeded();
 const secondMarker=await canvas.evaluate(svg=>{const p=new DOMPoint(2,-3).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};});
 const beforeSecondDrag=writes.length;
 await page.mouse.move(secondMarker.x,secondMarker.y);await page.mouse.down();
 await page.mouse.move(secondMarker.x+65,secondMarker.y+35,{steps:6});await page.mouse.up();
 assert.equal(await page.getByLabel('Điểm đã lưu',{exact:true}).inputValue(),'end-a','Clicking the second marker selects its own ID');
 assert.equal(await page.getByLabel('Mã điểm',{exact:true}).inputValue(),'end-a','The form must match the selected second point');
 assert.ok(Number(await page.getByLabel('X (m)',{exact:true}).inputValue())>2,'Dragging a saved second endpoint must change its X');
 assert.ok(Number(await page.getByLabel('Y (m)',{exact:true}).inputValue())<3,'Dragging a saved second endpoint must change its Y');
 assert.equal(Number(await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue()),0,'Moving the second point preserves its heading');
 assert.equal(writes.length,beforeSecondDrag,'Dragging a saved endpoint only edits its draft');
 const draggedX=Number(await page.getByLabel('X (m)',{exact:true}).inputValue()),draggedY=Number(await page.getByLabel('Y (m)',{exact:true}).inputValue());
 await Promise.all([
  page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/v1/endpoints/end-a'),
  page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click(),
 ]);
 assert.equal(writes.at(-1).body.xM,draggedX,'Saving B sends the dragged X to B, not A');
 assert.equal(writes.at(-1).body.yM,draggedY,'Saving B sends the dragged Y to B, not A');
 assert.equal(writes.at(-1).body.yawRad,0);
 assert.equal(state.endpoints.find(p=>p.endpointId==='end-new').xM,movedX,'Dragging and saving B leaves A unchanged');
 await page.getByRole('button',{name:'Đặt lại vị trí / hướng',exact:true}).click();
 await canvas.scrollIntoViewIfNeeded();
 const secondPlacement=await canvas.evaluate(svg=>{
  const matrix=svg.getScreenCTM();
  const start=new DOMPoint(-1.025,-1.225).matrixTransform(matrix),end=new DOMPoint(-.025,-2.225).matrixTransform(matrix);
  return {start:{x:start.x,y:start.y},end:{x:end.x,y:end.y}};
 });
 await page.mouse.move(secondPlacement.start.x,secondPlacement.start.y);await page.mouse.down();
 await page.mouse.move(secondPlacement.end.x,secondPlacement.end.y,{steps:6});await page.mouse.up();
 assert.equal(await page.getByLabel('Điểm đã lưu',{exact:true}).inputValue(),'end-a','Map placement must retain the second endpoint ID');
 assert.equal(Number(await page.getByLabel('X (m)',{exact:true}).inputValue()),-1.025);
 assert.equal(Number(await page.getByLabel('Y (m)',{exact:true}).inputValue()),1.225);
 await page.getByLabel('X (m)',{exact:true}).fill('-1');await page.getByLabel('Y (m)',{exact:true}).fill('1.25');
 const beforeNetworkFailure=writes.length;failPointNetwork=true;
 await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Cannot reach the MediAssistRover API'}).waitFor();
 assert.equal(writes.length,beforeNetworkFailure+1,'DNS failure during validation never sends an endpoint update');
 assert.equal(state.endpoints.find(p=>p.endpointId==='end-a').xM,draggedX,'Failed save keeps the persisted coordinates');
 assert.equal(Number(await page.getByLabel('X (m)',{exact:true}).inputValue()),-1,'Failed save retains the draft X');
 assert.equal(Number(await page.getByLabel('Y (m)',{exact:true}).inputValue()),1.25,'Failed save retains the draft Y');
 failPointNetwork=false;
 await Promise.all([
  page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/v1/endpoints/end-a'),
  page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click(),
 ]);
 assert.equal(writes.at(-1).path,'/api/v1/endpoints/end-a');assert.equal(writes.at(-1).body.xM,-1);assert.equal(writes.at(-1).body.yM,1.25);
 assert.equal(state.endpoints.find(p=>p.endpointId==='end-new').xM,movedX,'Saving the second point preserves the first');
 await page.reload();await page.locator('[data-map-id="map-a"]').waitFor();
 await page.getByRole('button',{name:'3. Điểm đích',exact:true}).click();
 await page.getByLabel('Điểm đã lưu',{exact:true}).selectOption('end-a');
 assert.equal(Number(await page.getByLabel('X (m)',{exact:true}).inputValue()),-1,'Second endpoint X survives reload');
 assert.equal(Number(await page.getByLabel('Y (m)',{exact:true}).inputValue()),1.25,'Second endpoint Y survives reload');
 await page.getByLabel('Điểm đã lưu',{exact:true}).selectOption('end-new');
 assert.equal(Number(await page.getByLabel('X (m)',{exact:true}).inputValue()),movedX,'Saved X survives reload');
 assert.equal(Number(await page.getByLabel('Y (m)',{exact:true}).inputValue()),movedY,'Saved Y survives reload');
 const writesBeforeRejectedPoint=writes.length;rejectPoint=true;
 await page.getByLabel('Tên điểm',{exact:true}).fill('Điểm không được lưu');
 await page.getByRole('button',{name:/Lưu điểm đích|Lưu thay đổi/}).click();await page.getByRole('status').filter({hasText:'Point is occupied or unknown'}).waitFor();
 assert.equal(writes.length,writesBeforeRejectedPoint+1,'Occupied point only calls verification');assert.equal(writes.at(-1).path,'/api/v1/maps/map-a/validate-navigation-point');
 assert.notEqual(state.endpoints.find(p=>p.endpointId==='end-new').endpointName,'Điểm không được lưu');
 rejectPoint=false;await page.getByRole('button',{name:'Bỏ thay đổi',exact:true}).click();
 // Lifecycle actions operate on the saved endpoint only, without deleting it or saving a draft.
 const pointState=page.getByRole('region',{name:'Trạng thái điểm đích',exact:true});
 await pointState.getByText('Đang hoạt động',{exact:true}).waitFor();
 const beforeDirtyState=writes.length;
 await page.getByLabel('Tên điểm',{exact:true}).fill('Bản nháp chưa lưu');
 assert.equal(await pointState.getByRole('button',{name:'Ngừng sử dụng điểm',exact:true}).isDisabled(),true);
 assert.equal(writes.length,beforeDirtyState);
 await page.getByRole('button',{name:'Bỏ thay đổi',exact:true}).click();
 rejectEndpointState=true;
 await pointState.getByRole('button',{name:'Ngừng sử dụng điểm',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Endpoint state temporarily unavailable'}).waitFor();
 assert.equal(state.endpoints.find(p=>p.endpointId==='end-new').active,true);
 await pointState.getByText('Đang hoạt động',{exact:true}).waitFor();
 const beforeDisable=writes.length,savedPoint=structuredClone(state.endpoints.find(p=>p.endpointId==='end-new'));
 rejectPoint=true; // Stopping use must work without requiring the point to pass occupancy validation again.
 await pointState.getByRole('button',{name:'Ngừng sử dụng điểm',exact:true}).click();
 await pointState.getByRole('button',{name:'Kích hoạt lại điểm',exact:true}).waitFor();
 assert.equal(writes.length,beforeDisable+1);assert.equal(writes.at(-1).method,'POST');assert.equal(writes.at(-1).path,'/api/v1/endpoints/end-new/deactivate');
 assert.deepEqual(state.endpoints.find(p=>p.endpointId==='end-new'),{...savedPoint,active:false});
 assert.match(await page.getByLabel('Điểm đã lưu',{exact:true}).locator('option:checked').innerText(),/Ngừng sử dụng/);
 assert.equal(await page.locator('[data-endpoint-state="inactive"]').count(),1);
 assert.equal(writes.some(w=>w.path.startsWith('/api/v1/endpoints/')&&w.method==='DELETE'),false);
 await page.screenshot({path:'.workstation-build/facility/endpoint-inactive.png',fullPage:true});
 await page.getByRole('button',{name:'2. Vùng',exact:true}).click();
 assert.equal(await page.locator('[data-endpoint-state="inactive"]').count(),0,'Other map views hide inactive endpoints');
 await page.getByRole('button',{name:'3. Điểm đích',exact:true}).click();
 assert.equal(await page.locator('[data-endpoint-state="inactive"]').count(),1,'Endpoint management retains inactive points for reactivation');
 rejectPoint=false;
 await pointState.getByRole('button',{name:'Kích hoạt lại điểm',exact:true}).click();
 await pointState.getByRole('button',{name:'Ngừng sử dụng điểm',exact:true}).waitFor();
 assert.equal(writes.at(-1).path,'/api/v1/endpoints/end-new/activate');assert.equal(writes.at(-1).method,'POST');
 assert.deepEqual(state.endpoints.find(p=>p.endpointId==='end-new'),savedPoint);
 await page.getByRole('button',{name:'-90°',exact:true}).click();assert.equal(Number(await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue()),-90);
 assert.equal(await page.getByRole('button',{name:'Kích hoạt bản đồ',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Bỏ thay đổi',exact:true}).click();assert.equal(Number(await page.getByLabel('Hướng đến (độ)',{exact:true}).inputValue()),90);
 await page.getByRole('button',{name:'Kích hoạt bản đồ',exact:true}).click();await page.getByText('Bản đồ đã kích hoạt',{exact:false}).waitFor();
 assert.equal(writes.at(-1).path,'/api/v1/maps/map-a/activate');assert.equal(await page.getByRole('button',{name:'Mở Điều phối →',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Công khai 2 điểm đích',exact:true}).click();await page.getByRole('button',{name:'Công khai 2 điểm đích',exact:true}).waitFor({state:'detached'});
 assert.ok(state.endpoints.filter(p=>p.mapId==='map-a').every(p=>p.publicVisible));assert.equal(state.endpoints.find(p=>p.mapId==='map-other').publicVisible,false);
 await page.screenshot({path:'.workstation-build/facility/endpoint-map.png',fullPage:true});
 for(const [width,height]of[[1024,768],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Endpoint no overflow '+width);await page.screenshot({path:`.workstation-build/facility/endpoint-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1366,height:900});reloadSafe=false;
 await page.getByRole('button',{name:'Kiểm tra lại khả năng dẫn đường',exact:true}).click();
 await page.getByText('Map cần bản sao tương thích dẫn đường',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Mở Điều phối →',exact:true}).isDisabled(),true);
 await page.getByText('Vùng, nhóm điểm và liên kết phòng không được sao chép',{exact:false}).waitFor();
 const beforeCopy=writes.length;
 await page.getByRole('button',{name:'Tạo bản đồ tương thích dẫn đường',exact:true}).click();
 await page.locator('[data-map-id="map-nav"]').waitFor();
 assert.equal(writes.length,beforeCopy+1);assert.equal(writes.at(-1).path,'/api/v1/maps/map-a/navigation-copy');
 assert.equal(state.maps.find(m=>m.mapId==='map-a').status,'ACTIVE','Original map is preserved');
 assert.equal(state.maps.find(m=>m.mapId==='map-nav').status,'DRAFT');
 assert.equal(state.zones.some(z=>z.mapId==='map-nav'),false,'Zones must be reviewed on new map');
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Kích hoạt bản đồ'&&!button.disabled));
 assert.equal(await page.getByRole('button',{name:'Kích hoạt bản đồ',exact:true}).isEnabled(),true);
 // A lost copy response must not invite another create, including automatic retry.
 reloadSafe=false;uncertainCopy=true;
 await page.getByRole('button',{name:'Kiểm tra lại khả năng dẫn đường',exact:true}).click();
 await page.getByText('Map cần bản sao tương thích dẫn đường',{exact:true}).waitFor();
 const beforeUncertain=writes.length;
 await page.getByRole('button',{name:'Tạo bản đồ tương thích dẫn đường',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Chưa xác nhận được kết quả tạo bản sao'}).waitFor();
 assert.equal(writes.length,beforeUncertain+1);assert.equal(await page.getByRole('button',{name:'Tạo bản đồ tương thích dẫn đường',exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);assert.ok(writes.every(w=>/\/api\/v1\/(maps|zones|endpoints|endpoint-groups|endpoint-group-members)/.test(w.path)));
 console.log('PASS: paginated API catalog, map scoping, group/member CRUD + 409/204, zone + endpoint payload, responsive sizes. All writes mocked; no real BE mutations.');
}catch(e){console.error(errors);await page.screenshot({path:'.workstation-build/facility/failure.png',fullPage:true});throw e;}finally{await browser.close();}
