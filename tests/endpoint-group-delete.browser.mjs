import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createDraft, saveMap } from '../src/pages/Admin/mapStudioModel.js';
import { vi } from '../src/i18n/vi.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const seed = saveMap({ ...createDraft(), scan: { status: 'complete', progress: 100 },
  endpoints: [{ id: 'home', name: 'Gốc', type: 'PARK', x: 580, y: 330, heading: 90 }],
  endpointGroups: [
    { id: 'full', code: 'FULL', name: 'Nhóm có điểm', selectionPolicy: 'PRIORITY', active: true, members: [{ endpointId: 'home', sequenceNo: 1, active: true }] },
    { id: 'empty', code: 'EMPTY', name: 'Nhóm rỗng', selectionPolicy: 'PRIORITY', active: true, members: [] },
  ],
}, '2026-10-14');
await context.addInitScript(seed => {
  sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ tokens: { accessToken: 'ui-test-only' }, account: { role: 'ADMIN' } }));
  if (!localStorage.getItem('mediassist.map-studio.lidar.v3')) localStorage.setItem('mediassist.map-studio.lidar.v3', JSON.stringify(seed));
}, seed);
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(url => url.pathname.startsWith('/api/'), route => { requests.push(route.request().url()); return route.abort(); });
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('mediassist.map-studio.lidar.v3')));
const click = name => page.getByRole('button', { name: vi(name), exact: true }).click();
const endpointStage = () => page.getByRole('navigation', { name: vi('Map Studio stages') }).getByRole('button', { name: /Điểm đích/ }).click();
const groupTab = () => page.getByRole('navigation', { name: 'Quản lý điểm đích', exact: true }).getByRole('button', { name: /^Nhóm điểm đích/ }).click();
const picker = () => page.getByLabel('Nhóm đang chỉnh', { exact: true });
const dialog = () => page.getByRole('alertdialog', { name: 'Xóa nhóm điểm đích' });
await mkdir('.workstation-build/group-delete', { recursive: true });
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5173') + '/admin?screen=Map%20Studio');
  assert.equal(await page.getByRole('link', { name: /OTTO/i }).count(), 0);
  await endpointStage();
  await page.getByRole('button', { name: /^Gốc.*Điểm gốc/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Xóa điểm đích', exact: true }).count(), 0, 'No duplicate form delete');
  assert.equal(await page.getByRole('button', { name: 'Xóa điểm đích Gốc', exact: true }).count(), 1, 'List delete remains');
  await groupTab();
  assert.equal(await page.getByRole('button', { name: 'Xóa nhóm', exact: true }).count(), 0, 'No delete for unsaved new group');
  await picker().selectOption('full');
  await page.getByLabel('Tên nhóm', { exact: true }).fill('Chỉnh sửa chưa lưu');
  await click('Xóa nhóm');
  await dialog().getByText('Thay đổi chưa lưu trong nhóm này sẽ bị bỏ.', { exact: true }).waitFor();
  await dialog().getByRole('button', { name: 'Hủy', exact: true }).click();
  assert.equal(await page.getByLabel('Tên nhóm', { exact: true }).inputValue(), 'Chỉnh sửa chưa lưu');
  assert.deepEqual(await data(), seed);
  await click('Xóa nhóm');await page.keyboard.press('Escape');
  assert.equal(await dialog().count(), 0);
  await click('Xóa nhóm');await dialog().getByRole('button', { name: 'Xóa nhóm', exact: true }).click();
  assert.equal(await picker().inputValue(), '');
  const after = await data();
  assert.deepEqual(after.endpoints, seed.endpoints);
  assert.deepEqual(after.endpointGroups, [seed.endpointGroups[1]]);
  assert.deepEqual(after.saved, seed.saved);
  await click('Save map');await page.reload();await endpointStage();await groupTab();
  assert.equal(await picker().locator('option[value="full"]').count(), 0);
  await picker().selectOption('empty');
  for (const width of [1920, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.screenshot({ path: '.workstation-build/group-delete/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '.workstation-build/group-delete/toolbar.png', fullPage: true });
  await click('Xóa nhóm');await dialog().getByRole('button', { name: 'Xóa nhóm', exact: true }).click();
  assert.deepEqual((await data()).endpointGroups, []);
  assert.deepEqual((await data()).endpoints, seed.endpoints);
  await page.getByLabel('Mã nhóm', { exact: true }).fill('NEW');
  await page.getByLabel('Tên nhóm', { exact: true }).fill('Nhóm mới');
  await click('Tạo nhóm');assert.equal((await data()).endpointGroups[0].name, 'Nhóm mới');
  assert.deepEqual(errors, []);assert.deepEqual(requests, []);
  console.log('PASS: group delete/cancel/Escape, dirty forms, empty/populated groups, preserved endpoints/snapshot, reload, create after delete, compact UI, responsive toolbar, no API writes.');
} finally { await browser.close(); }
