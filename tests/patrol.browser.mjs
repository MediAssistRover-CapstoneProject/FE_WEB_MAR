import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { createDraft, saveMap, STORAGE_KEY } from '../src/pages/Admin/mapStudioModel.js';
import { PATROL_STORAGE_KEY } from '../src/pages/Admin/patrolModel.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const draft = saveMap({ ...createDraft(), revision: 7, name: 'Tầng 1 kiểm thử', scan: { status: 'complete', progress: 100 }, endpoints: [
  { id: 'home', name: 'Điểm gốc', type: 'PARK', x: 580, y: 330 },
  { id: 'hall', name: 'Hành lang', type: 'WAYPOINT', x: 620, y: 330 },
  { id: 'pharmacy', name: 'Kho thuốc', type: 'WAYPOINT', x: 720, y: 330 },
] }, '2026-10-20T00:00:00Z');
await context.addInitScript(() => sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'patrol-ui-test-only' } })));
const page = await context.newPage(), errors = [], apiRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await page.route('**/api/v1/**', route => {
  apiRequests.push({ method: route.request().method(), url: route.request().url() });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }) });
});
await mkdir('.workstation-build/patrol', { recursive: true });
const root = page.locator('.patrol-workspace');
const button = name => root.getByRole('button', { name, exact: true });
try {
  await page.goto((process.env.TEST_BASE_URL || 'http://127.0.0.1:5173') + '/admin?screen=Patrol');
  await root.getByText('Chưa có bản đồ đã lưu', { exact: true }).waitFor();
  assert.equal(await button('Lưu bản nháp').isDisabled(), true);
  await page.evaluate(({ draft, key }) => { localStorage.setItem(key, JSON.stringify(draft)); window.dispatchEvent(new Event('mediassist-map-saved')); }, { draft, key: STORAGE_KEY });
  await button('Dùng bản đồ mới').click();
  await root.getByLabel('Tên tuyến', { exact: true }).fill('Tuần tra buổi tối');
  await root.getByLabel('Điểm xuất phát', { exact: true }).selectOption('home');
  await root.getByLabel('Thêm điểm đích', { exact: true }).selectOption('hall');
  await button('+ Thêm điểm').click();
  // Select the other existing endpoint on the shared map, without modifying it.
  await root.locator('svg g[role=button][aria-label$="Kho thuốc"]').click();
  assert.equal(await root.locator('.patrol-stop').count(), 2);
  await root.getByLabel('Thời gian dừng điểm 1', { exact: true }).fill('1');
  await root.getByLabel('Thời gian dừng điểm 2', { exact: true }).fill('2');
  await root.getByLabel('Ngày và giờ bắt đầu (giờ Việt Nam)', { exact: true }).fill('2026-10-21T18:00');
  await button('Lưu bản nháp').click();
  await root.getByText('Đã lưu bản nháp trên trình duyệt này. Lịch chưa được kích hoạt.', { exact: true }).waitFor();
  await page.reload();
  await root.locator('.patrol-library').getByRole('button').filter({ hasText: 'Tuần tra buổi tối' }).click();
  assert.equal(await root.locator('.patrol-stop').count(), 2);
  assert.equal(await root.getByLabel('Thời gian dừng điểm 2', { exact: true }).inputValue(), '2');
  await button('Chạy mô phỏng').click();
  await page.waitForTimeout(500);
  await button('Tạm dừng').click();
  const position = await root.getByTestId('dispatch-robot').getAttribute('transform');
  await page.waitForTimeout(300);
  assert.equal(await root.getByTestId('dispatch-robot').getAttribute('transform'), position);
  await root.getByLabel('Tốc độ mô phỏng', { exact: true }).selectOption('10');
  await button('Tiếp tục mô phỏng').click();
  await root.getByText('Đã hoàn tất hành trình mô phỏng.', { exact: true }).waitFor({ timeout: 15000 });
  assert.match(await root.locator('.patrol-preview').innerText(), /2\/2 điểm hoàn tất/);
  await button('Đặt lại').click();
  assert.equal(await root.getByLabel('Tiến độ mô phỏng').getAttribute('value'), '0');
  await button('Đưa điểm 2 lên').click();
  await root.getByLabel('Tên tuyến', { exact: true }).fill('Tuần tra đã chỉnh');
  await button('Lưu bản nháp').click();
  await page.reload();
  await root.locator('.patrol-library button').filter({ hasText: 'Tuần tra đã chỉnh' }).click();
  assert.match(await root.locator('.patrol-stop').first().innerText(), /Kho thuốc/);
  for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}px`);
    const box = await root.locator('.ls-map-viewport').boundingBox();
    assert.ok(box.width > 200 && Math.abs(box.width / box.height - 5 / 3) < .02);
    await page.screenshot({ path: `.workstation-build/patrol/patrol-${width}.png`, fullPage: true });
  }
  assert.deepEqual(JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)), draft);
  // Map replacement stops a simulation and requires explicit rebinding.
  await button('Chạy mô phỏng').click();
  await page.evaluate(key => {
    const d = JSON.parse(localStorage.getItem(key)); d.revision++; d.saved.revision++; d.saved.snapshot.revision++;
    d.saved.timestamp = '2026-10-21T00:00:00Z';
    localStorage.setItem(key, JSON.stringify(d)); window.dispatchEvent(new Event('mediassist-map-saved'));
  }, STORAGE_KEY);
  await button('Dùng bản đồ mới').waitFor();
  assert.equal(await button('Chạy mô phỏng').isDisabled(), true);
  await button('Dùng bản đồ mới').click();
  assert.equal(await button('Chạy mô phỏng').isEnabled(), true);
  await button('Xóa tuyến').click();
  assert.deepEqual(JSON.parse(await page.evaluate(key => localStorage.getItem(key), PATROL_STORAGE_KEY)).routes, []);
  await page.reload();
  assert.equal(await root.locator('.patrol-library button').count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(apiRequests, [], 'Patrol must not call backend APIs');
  console.log('PASS: empty state; map click selection; create/save/reload; movement/pause/resume/completion/reset; edit/reorder/delete; map revision guard; three viewport sizes; no API calls; original map unchanged.');
} catch (error) {
  await page.screenshot({ path: '.workstation-build/patrol/failure.png', fullPage: true });
  console.error(errors);
  throw error;
} finally {
  await browser.close();
}
