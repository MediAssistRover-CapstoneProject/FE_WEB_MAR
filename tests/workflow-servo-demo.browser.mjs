import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { graphDetail } from './fixtures/workflow-happy-path.mjs';
import { SERVO_DEMO_NAME } from '../src/features/workflows/designer/servoDemoDraft.js';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5189';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(10000);
const writes = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'servo-demo-test' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (!url.pathname.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const respond = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (req.method() !== 'GET') writes.push({ path: url.pathname, body: req.postDataJSON() });
  if (url.pathname === '/api/v1/admin/workflows/graph') return respond(graphDetail(req.postDataJSON(), 'servo-saved'));
  return respond({ content: [], last: true, totalPages: 1 });
});
try {
  await page.goto(base + '/workflow');
  const card = page.locator('.wfd-library-card').filter({ has: page.getByRole('heading', { name: SERVO_DEMO_NAME, exact: true }) });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Mở quy trình', exact: true }).click();
  await expect(page.locator('.wfd-node-top small', { hasText: /^(MOVE|WAIT|CONTROL_HARDWARE)$/ })).toHaveCount(5);
  await expect(page.locator('.wfd-node-top small', { hasText: /^(AUTHENTICATE|CHECK_CONDITION|INTERACT)$/ })).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(6);
  const wait = page.locator('.react-flow__node').filter({ hasText: 'Chờ 5 giây' });
  await wait.click();
  await expect(page.getByRole('spinbutton', { name: 'Thời gian chờ (giây)', exact: true })).toHaveValue('5');
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByText('Đã lưu đầy đủ workflow lên máy chủ.', { exact: true })).toBeVisible();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/api/v1/admin/workflows/graph');
  assert.equal(writes[0].body.graph.steps[1].paramsJson.authorization, undefined);
  assert.equal(writes[0].body.graph.steps[2].paramsJson.duration_sec, 5);
  assert.ok(writes[0].body.graph.transitions.every(edge => edge.conditionJson === null));
  await mkdir('.workstation-build/workflow-servo-demo', { recursive: true });
  await page.screenshot({ path: '.workstation-build/workflow-servo-demo/desktop.png', fullPage: true });
  await page.reload();
  await expect(card).toHaveCount(1);
  assert.equal(writes.length, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: servo starter appears once, shows exactly five unconditional steps, waits 5 seconds, saves correct graph without execution, and survives reload; APIs mocked.');
} finally { await browser.close(); }
