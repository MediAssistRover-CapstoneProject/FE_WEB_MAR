import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  if (!localStorage.getItem('mediassist-rover.session')) localStorage.setItem('mediassist-rover.session', JSON.stringify({ tokens: { accessToken: 'test-only' }, account: { role: 'ADMIN' } }));
});
const page = await context.newPage(), errors = [], deletes = [];
page.on('pageerror', error => errors.push(error.message));
const map = (id, status) => ({ mapId: id, mapName: `Bản đồ ${id}`, floorId: 'floor-1', versionNo: 1, status, widthM: 10, heightM: 8, resolutionMPerPixel: .05, originXM: 0, originYM: 0, originYawRad: 0 });
let maps = [map('a', 'ACTIVE'), map('b', 'DRAFT')], failDelete = false, releaseDelete, autoDelete = false;
const failIds = new Set();
await page.route(url => url.pathname.startsWith('/api/'), async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (request.method() === 'DELETE') {
    deletes.push({ path, body: request.postDataJSON() });
    assert.match(path, /^\/api\/v1\/maps\/[a-g]$/);
    const id = path.split('/').at(-1);
    if (failDelete || failIds.has(id)) return reply({ message: 'Bạn không có quyền xóa bản đồ này.' }, 403);
    if (!autoDelete) await new Promise(resolve => { releaseDelete = resolve; });
    const deleted = maps.find(item => item.mapId === id);
    maps = maps.filter(item => item.mapId !== id);
    return reply({ ...deleted, status: 'ARCHIVED' });
  }
  if (request.method() !== 'GET') throw Error(`Unexpected write: ${request.method()} ${path}`);
  if (path.endsWith('/image-metadata')) return reply({ map_id: path.split('/')[4], width_px: 200, height_px: 160, resolution_m_per_pixel: .05, origin_x_m: 0, origin_y_m: 0, origin_yaw_rad: 0 });
  if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64') });
  if (path.endsWith('/published/all')) return reply([]);
  return reply({ content: path.split('/')[3] === 'maps' ? maps : [], last: true, totalPages: 1 });
});
const base = process.env.TEST_URL || 'http://127.0.0.1:5175';
const dialog = page.getByRole('dialog', { name: 'Xóa bản đồ?' });
const deleteButton = page.getByRole('button', { name: 'Xóa bản đồ', exact: true });
const confirm = dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true });
const reason = dialog.getByRole('textbox', { name: 'Lý do xóa' });
const selectedMap = page.locator('.sml-picker summary');
await mkdir('.workstation-build/map-delete', { recursive: true });
try {
  await page.goto(base + '/admin/map');
  await expect(selectedMap).toContainText('Bản đồ a');
  await deleteButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Bản đồ này đang hoạt động');
  await expect(reason).toBeFocused();
  await expect(confirm).toBeDisabled();
  await reason.fill('     ');
  await expect(confirm).toBeDisabled();
  await reason.fill('cũ');
  await expect(confirm).toBeDisabled();
  await reason.fill('Bản đồ đã cũ');
  await expect(confirm).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(deleteButton).toBeFocused();
  assert.equal(deletes.length, 0, 'Escape does not delete');
  await deleteButton.click();
  await expect(reason).toHaveValue('');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  assert.equal(deletes.length, 0, 'Cancel does not delete');

  // A server rejection preserves the map, reason and retry action.
  failDelete = true;
  await deleteButton.click();
  await reason.fill('  Bản quét cũ, đã có bản thay thế.  ');
  await confirm.click();
  await expect(dialog.getByRole('alert')).toContainText('Bạn không có quyền');
  await expect(reason).toHaveValue('  Bản quét cũ, đã có bản thay thế.  ');
  await expect(selectedMap).toContainText('Bản đồ a');
  assert.deepEqual(deletes[0], { path: '/api/v1/maps/a', body: { reason: 'Bản quét cũ, đã có bản thay thế.' } });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '.workstation-build/map-delete/error-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();

  // Delete the map currently open in the editor, then clear its URL/return link.
  failDelete = false;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
  await page.getByRole('button', { name: '← Thư viện bản đồ', exact: true }).click();
  await deleteButton.click();
  await reason.fill('Bản quét cũ, đã có bản thay thế.');
  await page.screenshot({ path: '.workstation-build/map-delete/confirm-desktop.png', fullPage: true });
  await confirm.click();
  await expect(dialog.getByRole('button', { name: 'Đang xóa…', exact: true })).toBeDisabled();
  await expect(reason).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  assert.equal(deletes.length, 2, 'Only one request is sent while pending');
  releaseDelete();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Đã xóa bản đồ “Bản đồ a”' })).toBeVisible();
  await expect(selectedMap).toContainText('Bản đồ b');
  await expect(page.locator('.sml-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: '← Quay lại bản đồ đang chỉnh', exact: true })).toHaveCount(0);
  assert.equal(new URL(page.url()).searchParams.has('mapId'), false);
  await selectedMap.click();
  await page.getByRole('button', { name: 'Tải lại danh sách map', exact: true }).click();
  await expect(page.locator('.sml-map-option')).toHaveCount(1);
  await expect(page.locator('.sml-map-option')).toContainText('Bản đồ b');
  await selectedMap.click();

  // Deleting the final map leaves a usable empty library, including after reload.
  await page.setViewportSize({ width: 390, height: 844 });
  await deleteButton.click();
  await expect(dialog).not.toContainText('Bản đồ này đang hoạt động');
  await reason.fill('Không sử dụng bản quét này nữa.');
  await confirm.click();
  await expect(dialog.getByRole('button', { name: 'Đang xóa…', exact: true })).toBeDisabled();
  releaseDelete();
  await expect(page.getByRole('heading', { name: 'Chưa có bản đồ đã lưu' })).toBeVisible();
  await expect(page.locator('.sml-count')).toHaveText('0');
  await expect(page.locator('.sml-preview')).toHaveCount(0);
  await page.screenshot({ path: '.workstation-build/map-delete/empty-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chưa có bản đồ đã lưu' })).toBeVisible();

  // Select multiple maps in the database picker without changing the preview.
  maps = 'abcdefg'.split('').map(id => map(id, id === 'a' ? 'ACTIVE' : 'DRAFT'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/admin/map?mapId=a&stage=zone');
  await page.getByRole('button', { name: '← Thư viện bản đồ', exact: true }).click();
  await selectedMap.click();
  await page.getByRole('button', { name: 'Chọn để xóa', exact: true }).click();
  const all = page.getByRole('checkbox', { name: 'Chọn tất cả', exact: true });
  const checkMap = id => page.getByRole('checkbox', { name: `Chọn xóa Bản đồ ${id} · v1`, exact: true });
  const bulkDelete = page.getByRole('button', { name: /Xóa đã chọn/ });
  await expect(bulkDelete).toBeDisabled();
  await checkMap('b').check();
  await expect(selectedMap).toContainText('Bản đồ a');
  await expect(page.locator('.sml-picker')).toHaveAttribute('open', '');
  await expect(all).toHaveJSProperty('indeterminate', true);
  await expect(bulkDelete).toHaveText('Xóa đã chọn (1)');
  await all.check();
  await expect(bulkDelete).toHaveText('Xóa đã chọn (7)');
  await expect(all).toHaveJSProperty('indeterminate', false);
  await all.uncheck();
  await expect(bulkDelete).toBeDisabled();
  await checkMap('a').check();
  await checkMap('b').check();
  await checkMap('c').check();
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Bulk selection fits ' + width);
    await page.screenshot({ path: `.workstation-build/map-delete/bulk-select-${width}.png`, fullPage: true });
  }
  const requestsBeforeBulk = deletes.length;
  await bulkDelete.click();
  let bulkDialog = page.getByRole('dialog', { name: 'Xóa 3 bản đồ?', exact: true });
  await expect(bulkDialog.locator('.sml-delete-target')).toHaveCount(3);
  await expect(bulkDialog).toContainText('Có 1 bản đồ đang hoạt động');
  await bulkDialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  assert.equal(deletes.length, requestsBeforeBulk, 'Cancel does not send any bulk delete');
  await expect(bulkDelete).toHaveText('Xóa đã chọn (3)');

  // Keep only failed maps selected, and retry without resending successful deletes.
  failIds.add('c');
  await bulkDelete.click();
  await bulkDialog.getByRole('textbox', { name: 'Lý do xóa' }).fill('  Dọn các bản quét cũ.  ');
  await bulkDialog.getByRole('button', { name: 'Xác nhận xóa 3 bản đồ', exact: true }).click();
  await expect(bulkDialog.getByRole('button', { name: 'Đang xóa…', exact: true })).toBeDisabled();
  await expect.poll(() => deletes.length).toBe(requestsBeforeBulk + 1);
  releaseDelete();
  await expect.poll(() => deletes.length).toBe(requestsBeforeBulk + 2);
  releaseDelete();
  await expect(dialog.getByRole('alert')).toContainText('Bản đồ c');
  await expect(dialog).toContainText('Đã xóa 2 bản đồ');
  await expect(dialog.locator('.sml-delete-target')).toHaveCount(1);
  await expect(dialog.locator('.sml-delete-target')).toContainText('Bản đồ c');
  await expect(page.locator('.sml-count')).toHaveText('5');
  await expect(bulkDelete).toHaveText('Xóa đã chọn (1)');
  assert.equal(new URL(page.url()).searchParams.has('mapId'), false);
  assert.deepEqual(deletes.slice(requestsBeforeBulk).map(item => item.path), ['/api/v1/maps/a', '/api/v1/maps/b', '/api/v1/maps/c']);
  assert.ok(deletes.slice(requestsBeforeBulk).every(item => item.body.reason === 'Dọn các bản quét cũ.'));
  await page.screenshot({ path: '.workstation-build/map-delete/bulk-partial-error-mobile.png', fullPage: true });
  failIds.clear();
  await confirm.click();
  await expect.poll(() => deletes.length).toBe(requestsBeforeBulk + 4);
  releaseDelete();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.sml-count')).toHaveText('4');
  await expect(bulkDelete).toHaveText('Xóa đã chọn (0)');
  assert.equal(deletes.at(-1).path, '/api/v1/maps/c', 'Retry sends only the failed map');

  // Refresh prunes selections removed on the server; exiting select mode resets them.
  await checkMap('e').check();
  maps = maps.filter(item => item.mapId !== 'e');
  await page.getByRole('button', { name: 'Tải lại danh sách map', exact: true }).click();
  await expect(page.locator('.sml-count')).toHaveText('3');
  await expect(bulkDelete).toBeDisabled();
  await checkMap('d').check();
  await page.getByRole('button', { name: 'Hủy chọn', exact: true }).click();
  await expect(all).toHaveCount(0);
  await page.getByRole('button', { name: 'Chọn để xóa', exact: true }).click();
  await expect(bulkDelete).toHaveText('Xóa đã chọn (0)');

  // Select all remaining maps and finish in the empty state.
  await all.check();
  await bulkDelete.click();
  bulkDialog = page.getByRole('dialog', { name: 'Xóa 3 bản đồ?', exact: true });
  await bulkDialog.getByRole('textbox', { name: 'Lý do xóa' }).fill('Dọn các bản đồ còn lại.');
  autoDelete = true;
  await bulkDialog.getByRole('button', { name: 'Xác nhận xóa 3 bản đồ', exact: true }).click();
  await expect(bulkDialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Chưa có bản đồ đã lưu' })).toBeVisible();
  await expect(page.locator('.sml-count')).toHaveText('0');
  await expect(page.locator('.sml-bulk-toolbar')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chưa có bản đồ đã lưu' })).toBeVisible();

  // Demo accounts may view maps but cannot see the destructive action.
  maps = [map('b', 'DRAFT')];
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('mediassist-rover.session'));
    session.mode = 'demo';
    localStorage.setItem('mediassist-rover.session', JSON.stringify(session));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Thư viện bản đồ', exact: true })).toBeVisible();
  await expect(deleteButton).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chọn để xóa', exact: true })).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log('PASS: single/bulk deletion, checkbox/select-all/reset, cancel, validation, partial failure and retry, pending lock, selection/URL cleanup, refresh, empty state and mobile layout. All APIs mocked.');
} finally {
  await browser.close();
}
