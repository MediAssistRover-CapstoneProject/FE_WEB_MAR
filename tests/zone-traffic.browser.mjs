import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createDraft,saveMap} from '../src/pages/Admin/mapStudioModel.js';
import {vi} from '../src/i18n/vi.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const rect=(id,name,type,x,y,w,h)=>({id,name,type,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
const seed=saveMap({...createDraft(),scan:{status:'complete',progress:100},zones:[
 rect('single','Lối hẹp','SINGLE_ROBOT',700,310,100,45),
 {...rect('wait','Cửa phòng','NO_REPLAN',780,180,125,140),waitTimeoutSeconds:3},
 rect('watch','Sảnh theo dõi','OCCUPANCY_MONITORING',500,200,420,200),
],endpoints:[{id:'home',name:'Gốc',type:'HOME',x:580,y:330,heading:0},{id:'a',name:'Quầy A',type:'PICKUP',x:815,y:245,heading:90},{id:'b',name:'Quầy B',type:'PICKUP',x:600,y:360,heading:0}],endpointGroups:[{id:'g',code:'PICKUP',name:'Nhóm nhận',active:true,selectionPolicy:'BALANCED',allowFallback:true,members:[{endpointId:'a',sequenceNo:1,active:true},{endpointId:'b',sequenceNo:2,active:true}]}]},'test');
await context.addInitScript(seed=>{sessionStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'test-only'},account:{role:'ADMIN'}}));if(!localStorage.getItem('mediassist.map-studio.lidar.v3'))localStorage.setItem('mediassist.map-studio.lidar.v3',JSON.stringify(seed));},seed);
const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(url=>url.pathname.startsWith('/api/'),route=>{if(route.request().method()!=='GET')writes.push(route.request().url());return route.fulfill({status:200,contentType:'application/json',body:'{"content":[],"totalElements":0}'});});
await mkdir('.workstation-build/zone-traffic',{recursive:true});
const click=name=>page.getByRole('button',{name,exact:true}).click();
try{
 await page.goto('http://127.0.0.1:5173/workstations');
 await page.getByLabel('Điểm tiếp theo',{exact:true}).selectOption('group:g');await click('+ Thêm điểm dừng');
 await click('Kiểm tra tuyến');assert.match(await page.getByTestId('group-choice').textContent(),/Quầy A/);
 await click('Kiểm tra tuyến');assert.match(await page.getByTestId('group-choice').textContent(),/Quầy A/);
 await page.getByText('Lượt phục vụ trong phiên',{exact:true}).click();assert.match(await page.getByTestId('endpoint-visits').textContent(),/Quầy A: 0/);
 await page.getByText('Tình huống thử nghiệm',{exact:true}).click();
 await page.getByLabel('Vùng do MAR-02 ảo giữ',{exact:true}).selectOption('single');
 await page.getByLabel('Thời gian chờ robot ảo rời (giây)',{exact:true}).fill('8');
 await click('5×');await click('Chạy mô phỏng');
 await page.locator('.md-controls small').filter({hasText:'Chờ MAR-02 ảo'}).waitFor({timeout:15000});
 await click('Tạm dừng');const transform=await page.getByTestId('dispatch-robot').getAttribute('transform');
 assert.equal(await page.getByTestId('traffic-actor-robot').count(),1);
 assert.match(await page.getByTestId('occupancy-single').textContent(),/1 robot/);
 await page.screenshot({path:'.workstation-build/zone-traffic/wait-zone.png',fullPage:true});
 await page.waitForTimeout(200);assert.equal(await page.getByTestId('dispatch-robot').getAttribute('transform'),transform);
 await click('Tiếp tục');await page.getByText('Hoàn tất mô phỏng',{exact:true}).waitFor({timeout:20000});
 assert.match(await page.getByTestId('endpoint-visits').textContent(),/Quầy A: 1/);
 assert.equal(await page.getByTestId('traffic-actor-robot').count(),0);
 await click('Kiểm tra tuyến');assert.match(await page.getByTestId('group-choice').textContent(),/Quầy B/);
 assert.match(await page.getByTestId('endpoint-visits').textContent(),/Quầy A: 1/);
 await click('Chạy mô phỏng');await page.getByText('Hoàn tất mô phỏng',{exact:true}).waitFor({timeout:15000});
 assert.match(await page.getByTestId('endpoint-visits').textContent(),/Quầy B: 1/);
 // Equal counters select A again. No-replan timeout must not increment A.
 await page.getByLabel('Vùng do MAR-02 ảo giữ',{exact:true}).selectOption('');
 await page.getByLabel('Vùng có vật cản thử nghiệm',{exact:true}).selectOption('wait');
 await page.getByLabel('Thời gian vật cản tồn tại khi gặp (giây)',{exact:true}).fill('8');
 await click('Chạy mô phỏng');await page.getByText('Đã dừng: hết thời gian chờ',{exact:true}).waitFor({timeout:15000});
 assert.match(await page.getByTestId('endpoint-visits').textContent(),/Quầy A: 1/);
 assert.equal(await page.getByTestId('traffic-actor-obstacle').count(),1);
 await page.screenshot({path:'.workstation-build/zone-traffic/obstacle-timeout.png',fullPage:true});
 for(const [width,height]of[[1920,1080],[1366,768],[1024,768],[390,844]]){
   await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width>1200){const box=await page.getByTestId('dispatch-clock').boundingBox();assert.ok(box.y+box.height<=height,`Controls fit at ${width}`);}
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5173/admin?screen=Map%20Studio');
 await page.getByRole('navigation',{name:vi('Map Studio stages')}).getByRole('button',{name:/Vùng/}).click();
 const types=page.getByLabel('Loại vùng',{exact:true});assert.equal(await types.locator('option').count(),5);
 await page.getByRole('button',{name:/Cửa phòng.*Không lập lại đường/}).click();
 assert.equal(await types.inputValue(),'NO_REPLAN','Previously saved advanced zones remain editable');
 await page.getByLabel('Thời gian chờ vật cản (giây)',{exact:true}).fill('12');
 await page.getByText('Chưa đồng bộ với robot',{exact:true}).waitFor();
 await page.screenshot({path:'.workstation-build/zone-traffic/zone-catalog.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 console.log('PASS: group balance counts actual service, robot 02 wait/release, occupancy, obstacle timeout, catalog and responsive controls; no API writes.');
}catch(e){await page.screenshot({path:'.workstation-build/zone-traffic/failure.png',fullPage:true});console.error(errors);throw e;}finally{await browser.close();}
