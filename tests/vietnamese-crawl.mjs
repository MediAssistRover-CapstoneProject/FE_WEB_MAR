import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {navigationGroups} from '../src/features/admin/navigation.js';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>sessionStorage.setItem('mediassist-rover.session',JSON.stringify({tokens:{accessToken:'ui-test-only'},account:{role:'ADMIN'}})));
const page=await context.newPage(),errors=[],texts={};page.on('pageerror',e=>errors.push(e.message));
await page.route(url=>url.pathname.startsWith('/api/'),r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[],totalElements:0})}));
mkdirSync('.workstation-build/vi',{recursive:true});
try{for(const path of ['/','/login','/register','/workflows','/workstations',...navigationGroups.flatMap(([,items])=>items.filter(i=>i!=='Workflows').map(i=>'/admin?screen='+encodeURIComponent(i)))]){await page.goto('http://127.0.0.1:5173'+path);await page.waitForTimeout(250);texts[path]=await page.locator('body').innerText();if(path.includes('Map%20Studio')||path==='/login')await page.screenshot({path:'.workstation-build/vi/'+(path==='/login'?'login':'map')+'.png',fullPage:true});}writeFileSync('.workstation-build/vi/crawl.json',JSON.stringify({errors,texts},null,2));console.log(JSON.stringify({errors,pages:Object.keys(texts).length}));}finally{await browser.close();}
