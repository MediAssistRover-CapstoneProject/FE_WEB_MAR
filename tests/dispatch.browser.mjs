import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createDraft,saveMap} from '../src/pages/Admin/mapStudioModel.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const draft=saveMap({...createDraft(),revision:7,name:'Khu khám ngoại trú',scan:{status:'complete',progress:100},zones:[{id:'slow',name:'Qua sảnh chậm',type:'SPEED',speed:.2,points:[{x:540,y:315},{x:620,y:315},{x:620,y:355},{x:540,y:355}]}],endpointGroups:[{id:'pickup-group',code:'PICKUP_GROUP',name:'Nhóm quầy thuốc',selectionPolicy:'PRIORITY',allowFallback:false,active:true,members:[{endpointId:'pickup',sequenceNo:1,active:true}]}],endpoints:[{id:'home',name:'Điểm gốc',type:'PARK',x:580,y:330,heading:0},{id:'pickup',name:'Quầy thuốc',type:'WAYPOINT',x:815,y:245,heading:90,tasks:[{action:'LOAD',seconds:3}]}]},'now');
await context.addInitScript(d=>{sessionStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'ui-test-only'},account:{role:'ADMIN'}}));if(!localStorage.getItem('mediassist.map-studio.lidar.v3'))localStorage.setItem('mediassist.map-studio.lidar.v3',JSON.stringify(d));},draft);
const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(url=>url.pathname.startsWith('/api/'),r=>{if(r.request().method()!=='GET')writes.push(r.request().url());return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[...(r.request().url().includes('/workflows')?[{workflowId:'wf-1',workflowName:'Giao thuốc',workflowCode:'WF_DELIVERY'}]:[])],totalElements:1})});});
await mkdir('.workstation-build/vi',{recursive:true});
try{
 await page.goto('http://127.0.0.1:5173/workstations');await page.getByText('Mô phỏng cục bộ · Khu khám ngoại trú · bản 7').waitFor();
 await page.getByLabel('Điểm tiếp theo',{exact:true}).selectOption('group:pickup-group');await page.getByRole('button',{name:'+ Thêm điểm dừng',exact:true}).click();
 await page.getByRole('button',{name:'Lưu ánh xạ quy trình',exact:true}).click();
 assert.equal(await page.getByLabel('Quy trình',{exact:true}).inputValue(),'wf-1');
 await page.reload();await page.getByText('Đã nạp ánh xạ điểm dừng đã lưu cho quy trình này.',{exact:true}).waitFor();
 assert.equal(await page.locator('.md-stop').count(),1);
 await page.getByRole('button',{name:'Kiểm tra tuyến',exact:true}).click();assert.ok((await page.getByTestId('dispatch-route').getAttribute('points')).length>30);
 await page.getByRole('button',{name:'Chạy mô phỏng',exact:true}).click();await page.waitForTimeout(700);
 await page.getByRole('button',{name:'Tạm dừng',exact:true}).click();const position=await page.getByTestId('dispatch-robot').getAttribute('transform');await page.waitForTimeout(400);assert.equal(await page.getByTestId('dispatch-robot').getAttribute('transform'),position);
 await page.getByRole('button',{name:'3×',exact:true}).click();assert.equal(await page.getByRole('button',{name:'3×',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.waitForTimeout(700);assert.notEqual(await page.getByTestId('dispatch-robot').getAttribute('transform'),position);
 await page.getByRole('button',{name:'Tạm dừng',exact:true}).click();
 const elapsed=async()=>Number(await page.getByTestId('dispatch-clock').getAttribute('data-elapsed'));
 const deltas={};
 for(const speed of [1,2,3,5]){await page.getByRole('button',{name:speed+'×',exact:true}).click();const before=await elapsed();await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.waitForTimeout(650);await page.getByRole('button',{name:'Tạm dừng',exact:true}).click();deltas[speed]=(await elapsed())-before;}
 assert.ok(deltas[2]>deltas[1]*1.4&&deltas[3]>deltas[1]*2.1&&deltas[5]>deltas[1]*3.5,'Speed changes elapsed simulation time: '+JSON.stringify(deltas));
 for(const [width,height]of[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844]]){await page.setViewportSize({width,height});const frame=await page.locator('.ls-map-viewport').boundingBox();assert.ok(frame.height>0&&Math.abs(frame.width/frame.height-5/3)<.01,'Dispatch map stays 5:3 '+width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+width);if(width>1200){const bounds=await page.getByTestId('dispatch-clock').boundingBox();assert.ok(bounds.y+bounds.height<=height,'Run controls remain in viewport '+width);}await page.screenshot({path:'.workstation-build/vi/dispatch-'+width+'.png',fullPage:true});}
 await page.getByRole('button',{name:'Đặt lại',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Chạy mô phỏng',exact:true}).count(),1);
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS: saved-map dispatch, route preview, movement, pause/resume, speed controls and 5 responsive viewports; no API writes.');
}catch(e){console.error(errors);await page.screenshot({path:'.workstation-build/vi/dispatch-failure.png',fullPage:true});throw e;}finally{await browser.close();}
