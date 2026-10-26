import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],commands=[];let mode='ready',state={},polling=true,run=0;
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/v1/simulation/**',async route=>{
 const req=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='POST'){
  const body=req.postDataJSON();commands.push(body);
  return route.fulfill({status:202,headers,json:{accepted:true,runId:body.commandType==='START_PATROL'?'run-'+(++run):body.runId,correlationId:'command-'+commands.length}});
 }
 if(!polling)return route.abort('connectionrefused');
 const m=await page.evaluate(()=>window.gazeboTestManifest);
 return route.fulfill({headers,json:{protocol:'MAR-SIM-1',mapId:mode==='mismatch'?'other':m.mapId,mapVersion:m.mapVersion,connected:true,mqttConnected:true,rosConnected:true,simulationActive:true,ready:true,status:'IDLE',poseFresh:true,pose:m.spawn,path:[],...state}});
});
const until=async pred=>{for(let i=0;i<80;i++){if(await pred())return;await page.waitForTimeout(100);}throw Error('Timed out');};
const start=page.getByRole('button',{name:'Chạy quy trình trong Gazebo',exact:true});
try{
 await page.goto('http://127.0.0.1:5175/tests/gazebo.fixture.html');await until(()=>start.isEnabled());
 const frame=await page.locator('iframe').elementHandle();
 await page.getByRole('button',{name:'Mở màn hình lớn',exact:true}).click();
 assert.equal(await page.locator('.gazebo-desktop-expanded').count(),1);assert.equal(context.pages().length,1);
 assert.equal(await frame.evaluate(e=>e.isConnected),true);
 await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();
 await until(()=>page.evaluate(()=>!!document.fullscreenElement));
 await page.evaluate(()=>document.exitFullscreen());
 await page.getByRole('button',{name:'Thu lại',exact:true}).click();
 assert.equal(await frame.evaluate(e=>e.isConnected),true);
 // Actual noVNC server is embedded; inspect its DOM without issuing motion commands.
 const vnc=page.frameLocator('iframe');await vnc.locator('#noVNC_container canvas').first().waitFor({timeout:30000});
 await until(async()=>await vnc.locator('html').evaluate(e=>e.classList.contains('noVNC_connected')));
 await page.getByRole('button',{name:'3d',exact:true}).click();await page.locator('.patrol-three-scene canvas').waitFor();
 const canvas=await page.locator('.patrol-three-scene canvas').elementHandle();
 mode='mismatch';await until(()=>start.isDisabled());mode='ready';await until(()=>start.isEnabled());
 await start.click();await until(()=>commands.length===1);await page.waitForTimeout(800);assert.equal(await start.isDisabled(),true);
 assert.equal(await page.getByText('Đã đến tất cả điểm đích',{exact:true}).count(),0);
 state={status:'RUNNING',runId:'run-1',total:2,completed:0,path:[{x:2.9,y:-1,yaw:0},{x:3.3,y:-1,yaw:0}]};
 await page.getByText('Đang di chuyển',{exact:true}).waitFor();assert.equal(await canvas.evaluate(e=>e.isConnected),true);
 await page.getByRole('button',{name:'2d',exact:true}).click();await page.locator('[data-testid="dispatch-robot"]').waitFor();
 polling=false;await page.getByRole('alert').waitFor({timeout:10000});assert.equal(await start.isDisabled(),true);
 assert.equal(await page.locator('[data-testid="dispatch-robot"]').count(),0);
 polling=true;state={...state,status:'RUNNING'};await page.getByText('Đang di chuyển',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Dừng hành trình',exact:true}).click();await until(()=>commands.some(c=>c.commandType==='CANCEL_PATROL'));
 state={...state,status:'CANCELED'};await page.getByText('Đã dừng',{exact:true}).waitFor();
 await page.getByRole('button',{name:'gazebo',exact:true}).click();
 await page.getByRole('button',{name:'Mở màn hình lớn',exact:true}).click();
 await until(async()=>await vnc.locator('html').evaluate(e=>e.classList.contains('noVNC_connected')));
 await mkdir('.workstation-build/gazebo',{recursive:true});await page.screenshot({path:'.workstation-build/gazebo/embedded-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'.workstation-build/gazebo/embedded-mobile.png'});
 await page.getByRole('button',{name:'Thu lại',exact:true}).click();
 const before=commands.length;await page.getByRole('button',{name:'Rời màn hình',exact:true}).click();await page.waitForTimeout(1500);console.log('unmount',before,commands,errors,await page.locator('.gazebo-panel').count());await until(()=>commands.length>before);
 assert.equal(commands.at(-1).commandType,'CANCEL_PATROL');assert.deepEqual(errors,[]);
 console.log('PASS: real embedded noVNC connected, expand/fullscreen keeps iframe, no new tab, 2D/3D telemetry, 202 not success, mismatched map, lost API, stop, unmount, mobile. Commands intercepted (no robot motion).');
}finally{await browser.close();}


