import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
try {
  const page = await browser.newPage();
  const errors = [], calls = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', username: 'fixture' }, tokens: { accessToken: 'fixture-only' } })));
  await page.route('**/api/v1/**', route => { calls.push(route.request()); return route.fulfill({ json: { content: [], totalPages: 0 } }); });
  await page.goto('http://127.0.0.1:5187/admin?screen=Map+Studio');
  const consoleFrame = page.frameLocator('iframe[title^="Điều khiển robot thật"]');
  await consoleFrame.locator('#navMap').waitFor({ timeout: 10000 }).catch(() => consoleFrame.locator('#navMapId').waitFor());
  const frame = page.frames().find(f => f !== page.mainFrame());
  assert.equal(await frame.locator('#token').inputValue(), 'FE_SESSION');
  assert.match(await frame.locator('#cameraStreamUrl').inputValue(), /10\.3\.90\.50:8080/);
  await frame.evaluate(() => fetch('/api/v1/robots?size=1'));
  assert.equal(calls.at(-1).headers().authorization, 'Bearer fixture-only');
  assert.equal(calls.filter(r => r.method() !== 'GET').length, 0);
  const template = await frame.evaluate(async () => (await fetch('/navigation-move-workflow.json')).json());
  assert.ok(template);
  assert.deepEqual(errors, []);
  console.log('Console loaded; authenticated API bridge, camera URL and workflow assets verified; no robot commands sent.');
} finally { await browser.close(); }
