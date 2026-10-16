import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createDraft,saveMap} from '../src/pages/Admin/mapStudioModel.js';
import {vi} from '../src/i18n/vi.js';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const seed=saveMap({...createDraft(),scan:{status:'complete',progress:100},zones:[
  {id:'slow',name:'Khu chậm',type:'SPEED',speed:.3,points:[{x:700,y:310},{x:800,y:310},{x:800,y:355},{x:700,y:355}]},
],endpoints:[
  {id:'home',name:'Gốc',type:'PARK',x:580,y:330},
  {id:'target',name:'Quầy A',type:'WAYPOINT',x:815,y:245},
]},'test');
await context.addInitScript(seed=>{sessionStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'test-only'},account:{role:'ADMIN'}}));localStorage.setItem('mediassist.map-studio.lidar.v3',JSON.stringify(seed));},seed);
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route(url=>url.pathname.startsWith('/api/'),route=>route.fulfill({status:200,contentType:'application/json',body:'{"content":[],"totalElements":0}'}));
try{
  await page.goto('http://127.0.0.1:5173/admin?screen=Map%20Studio');
  await page.getByRole('navigation',{name:vi('Map Studio stages')}).getByRole('button',{name:/Vùng/}).click();
  const types=page.getByLabel('Loại vùng',{exact:true});
  assert.deepEqual(await types.locator('option').evaluateAll(options=>options.map(option=>option.value)),['KEEP_OUT','SPEED','NO_STOP']);
  await page.getByRole('button',{name:/Khu chậm/}).click();
  assert.equal(await types.inputValue(),'SPEED');
  assert.deepEqual(errors,[]);
  console.log('PASS: Map Studio exposes only KEEP_OUT, SPEED and NO_STOP.');
}finally{await browser.close();}
