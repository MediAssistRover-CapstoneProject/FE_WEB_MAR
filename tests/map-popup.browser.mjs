import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const native = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { native.push(d.type()); await d.dismiss(); });
  await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'map-editor' }, tokens: { accessToken: 'mock' } })));
  const mapId = '11111111-1111-4111-8111-111111111111';
  const source = { mapId, assetHash: 'a'.repeat(64), widthM: 10, heightM: 6, resolutionMPerPixel: .05, originXM: 0, originYM: 0, originYawRad: 0, frameId: 'map', widthPx: 200, heightPx: 120 };
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const result = pathname.endsWith('/presentation') ? { source, revision: 0, draft: { schemaVersion: 1, backgroundColor: '#fff', rotationDegrees: 0, features: [] }, sourceChanged: false }
      : pathname === '/api/v1/maps' ? { content: [{ ...source, mapName: 'Map thử nghiệm', status: 'ACTIVE', versionNo: 1 }], last: true } : { content: [], last: true };
    if (pathname.endsWith('/image.png')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="white"/></svg>' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(`http://127.0.0.1:5187/admin/map?mapId=${mapId}&stage=presentation`);
  await page.getByRole('button', { name: 'Vẽ phòng (R)', exact: true }).click();
  const canvas = page.locator('.mp-canvas');
  const points = await canvas.evaluate(e => [new DOMPoint(1,1), new DOMPoint(4,4)].map(p => { const q = p.matrixTransform(e.getScreenCTM()); return { x: q.x, y: q.y }; }));
  await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 5 }); await page.mouse.up();
  await expect(canvas.locator('polygon')).toHaveCount(1);
  await page.getByRole('button', { name: '← Thư viện bản đồ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xác nhận thao tác' });
  await expect(dialog).toContainText('Bản đồ còn chỉnh sửa chưa lưu');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(canvas.locator('polygon')).toHaveCount(1);
  await page.screenshot({ path: 'map-popup-cancel.png' });
  await page.getByRole('button', { name: '← Thư viện bản đồ', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thư viện bản đồ', exact: true })).toBeVisible();
  assert.deepEqual(native, []); assert.deepEqual(errors, []);
  console.log('Map popup regression passed: cancel retains unsaved drawing; confirm leaves editor; no native dialogs.');
} finally { await browser.close(); }
