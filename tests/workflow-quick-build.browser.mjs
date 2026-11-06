import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5173';
await mkdir('.workstation-build/workflow-designer', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'quick-build', username: 'quick-build' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  if (!url.pathname.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  if (request.method() !== 'GET') writes.push(url.pathname);
  return route.fulfill({ status: request.method() === 'GET' ? 200 : 500, contentType: 'application/json', body: JSON.stringify({ content: [], last: true, totalPages: 1 }) });
});
const add = label => page.locator('.wfd-palette-list button').filter({ has: page.locator('strong', { hasText: new RegExp('^' + label + '$') }) }).click();
const edges = () => page.locator('.react-flow__edge');
try {
  await page.goto(base + '/workflow');
  await page.getByRole('button', { name: '＋ Tạo quy trình', exact: true }).first().click();
  await add('Di chuyển');
  await expect(edges()).toHaveCount(2);
  await expect(page.locator('.wfd-palette')).toContainText('Thêm tiếp sau:');
  await expect(page.getByLabel('Thực thi và xử lý sự cố')).toContainText('Pi / robot');
  await expect(page.getByLabel('Thực thi và xử lý sự cố')).toContainText('RECOVERY_REQUIRED');
  await add('Xác thực');
  await expect(edges()).toHaveCount(3);
  await expect(page.getByLabel('Thực thi và xử lý sự cố')).toContainText('Thực thi: BE');
  await add('Di chuyển');
  await expect(edges()).toHaveCount(4);
  const options = await page.getByLabel('Biến cho Điểm đến', { exact: true }).locator('option').evaluateAll(options => options.map(o => o.value));
  assert.ok(options.includes('destination_1_endpoint_id'));
  assert.ok(options.includes('destination_2_endpoint_id'));
  assert.ok(!options.includes('service_request_id'));
  await expect(page.locator('.wfd-inspector')).toContainText('Chỉ truyền UUID endpoint');
  await page.getByRole('button', { name: '↶ Hoàn tác', exact: true }).click();
  await expect(edges()).toHaveCount(3);
  await page.getByRole('button', { name: '↷ Làm lại', exact: true }).click();
  await expect(edges()).toHaveCount(4);
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  const moves = page.locator('.react-flow__node').filter({ has: page.locator('.wfd-node-top small', { hasText: /^MOVE$/ }) });
  await moves.last().locator('.wfd-node>strong').click();
  await add('Kiểm tra điều kiện');
  await expect(page.getByLabel('Trường kết quả', { exact: true })).toHaveValue('reached');
  await expect(page.locator('.wfd-palette')).toContainText('Với bước rẽ nhánh');
  await expect(edges()).toHaveCount(4);
  await add('Chờ');
  await expect(edges()).toHaveCount(4);
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  await page.screenshot({ path: '.workstation-build/workflow-designer/quick-build.png', fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('PASS: one-click main path, identity filtering, runtime summary, undo/redo and explicit branches; no server writes.');
} finally {
  await browser.close();
}
