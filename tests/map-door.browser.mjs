import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.MAP_TEST_URL || 'http://127.0.0.1:5175';
const mapId = '11111111-1111-4111-8111-111111111111';
const source = { mapId, assetHash: 'd'.repeat(64), widthM: 10, heightM: 6, resolutionMPerPixel: .05, originXM: -2, originYM: 3, originYawRad: .4, frameId: 'map', widthPx: 200, heightPx: 120 };
let entry = { source: structuredClone(source), revision: 0, draft: { schemaVersion: 1, backgroundColor: '#ffffff', rotationDegrees: 0, features: [] }, published: null, publishedRevision: null, publishedAt: null, sourceChanged: false };
const writes = [], errors = [];
await mkdir('.workstation-build/map-door', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'door-editor', username: 'door-editor' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === new URL(base).origin ? route.continue() : route.abort();
  const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (request.method() === 'GET') {
    if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="#e5e7eb"/><path d="M100 400V100H900V400H420M300 400H100" fill="white" stroke="#1f2937" stroke-width="10" stroke-linejoin="round"/><path d="M100 400H300M420 400H900" fill="none" stroke="#1f2937" stroke-width="10"/></svg>' });
    if (path === `/api/v1/maps/${mapId}/presentation`) return respond(entry);
    if (path === '/api/v1/maps') return respond({ content: [{ ...source, mapName: 'Mặt bằng cửa mở', mapCode: 'F1', versionNo: 1, status: 'ACTIVE' }], totalPages: 1, last: true });
    return respond({ content: [], totalPages: 1, last: true });
  }
  assert.ok(path.includes('/presentation'), `Door edits must not mutate navigation data: ${request.method()} ${path}`);
  const body = request.postDataJSON(); writes.push({ method: request.method(), path, body });
  if (body.expectedRevision !== entry.revision) return respond({ message: 'Revision conflict' }, 409);
  entry = structuredClone(entry); entry.revision++;
  if (request.method() === 'PUT') { assert.equal(body.sourceAssetHash, source.assetHash); entry.draft = structuredClone(body.document); }
  else if (path.endsWith('/publish')) { entry.published = structuredClone(entry.draft); entry.publishedRevision = entry.revision; entry.publishedAt = '2026-11-07T00:00:00Z'; }
  else throw Error(`Unexpected mutation: ${request.method()} ${path}`);
  return respond(entry);
});
const svg = page.locator('.mp-canvas'), content = svg.locator('.mp-map-content');
const symbol = content.locator('.mp-door-symbol'), leaf = symbol.locator('.mp-door-leaf'), arc = symbol.locator('.mp-door-swing');
const near = (actual, expected, tolerance = .025) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
const samePoint = (a, b, tolerance = .025) => { near(a.x, b.x, tolerance); near(a.y, b.y, tolerance); };
async function point(x, y) {
  return content.evaluate((element, p) => { const value = new DOMPoint(p.x, 6 - p.y).matrixTransform(element.getScreenCTM()); return { x: value.x, y: value.y }; }, { x, y });
}
async function clickPoint(x, y) { const p = await point(x, y); await page.mouse.click(p.x, p.y); }
async function dragPoint(a, b) {
  const start = await point(a.x, a.y), end = await point(b.x, b.y);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 7 }); await page.mouse.up();
}
async function endpoints(locator) {
  return locator.evaluate(element => {
    const read = p => ({ x: p.x, y: 6 - p.y });
    if (element.tagName.toLowerCase() === 'line') return [read({ x: element.x1.baseVal.value, y: element.y1.baseVal.value }), read({ x: element.x2.baseVal.value, y: element.y2.baseVal.value })];
    return [read(element.getPointAtLength(0)), read(element.getPointAtLength(element.getTotalLength()))];
  });
}
async function handles() {
  return symbol.locator('..').locator(':scope > circle').evaluateAll(elements => elements.map(element => ({ x: element.cx.baseVal.value, y: 6 - element.cy.baseVal.value })));
}
async function save() {
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu bản nháp' })).toBeVisible();
}
try {
  await page.goto(`${base}/admin/map?mapId=${mapId}&stage=presentation`);
  await expect(content.locator('image')).toHaveCount(1);
  await page.getByRole('button', { name: 'Vẽ cửa (D)', exact: true }).click();
  await clickPoint(3, 2); await clickPoint(4.2, 2);
  await expect(symbol).toHaveCount(1);
  await expect(arc).toHaveAttribute('d', /A/i);
  await expect(symbol.locator('.mp-door-threshold')).toHaveCount(1);
  const initialLeaf = await endpoints(leaf);
  samePoint(initialLeaf[0], { x: 3, y: 2 });
  samePoint(initialLeaf[1], { x: 3, y: 3.2 });
  await expect(symbol.locator('..').locator(':scope > circle')).toHaveCount(3);
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue('');
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Cửa phòng khám');
  assert.equal(writes.length, 0, 'Drawing a door does not save until requested');
  await page.screenshot({ path: '.workstation-build/map-door/open-door-desktop.png', fullPage: true });

  // Opening side and hinge changes are independent, undoable geometry edits.
  const flip = page.getByRole('button', { name: 'Đổi phía mở', exact: true });
  const hinge = page.getByRole('button', { name: 'Đổi bên bản lề', exact: true });
  await flip.click();
  samePoint((await endpoints(leaf))[1], { x: 3, y: .8 });
  await page.getByRole('button', { name: '↶ Hoàn tác', exact: true }).click();
  samePoint((await endpoints(leaf))[1], initialLeaf[1]);
  await page.getByRole('button', { name: '↷ Làm lại', exact: true }).click();
  samePoint((await endpoints(leaf))[1], { x: 3, y: .8 });
  await hinge.click();
  const hinged = await endpoints(leaf);
  samePoint(hinged[0], { x: 4.2, y: 2 });
  samePoint(hinged[1], { x: 4.2, y: .8 });
  await save();
  assert.equal(entry.draft.features[0].type, 'DOOR');
  assert.equal(entry.draft.features[0].points.length, 3);
  const savedPoints = structuredClone(entry.draft.features[0].points);
  await page.reload();
  await expect(symbol).toHaveCount(1);
  samePoint((await endpoints(leaf))[0], savedPoints[0]);
  samePoint((await endpoints(leaf))[1], savedPoints[2]);

  // Preview and published snapshots render the same architectural glyph.
  await page.getByRole('checkbox', { name: 'Xem bản đẹp', exact: true }).check();
  await expect(symbol).toHaveCount(1);
  await expect(arc).toHaveAttribute('d', /A/i);
  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã áp dụng' })).toBeVisible();
  assert.deepEqual(entry.published.features[0].points, savedPoints);
  await page.getByRole('checkbox', { name: 'Xem bản đẹp', exact: true }).uncheck();

  // Whole-door and open-leaf vertex dragging keep local coordinates correct after rotation.
  const angle = page.getByLabel('Góc xoay bản đồ', { exact: true });
  await angle.fill('20'); await angle.press('Enter');
  await expect(content).toHaveAttribute('transform', 'rotate(20 5 3)');
  await page.locator('.mp-layers button').filter({ hasText: 'Cửa phòng khám' }).click();
  const original = await handles();
  assert.equal(original.length, 3);
  await dragPoint({ x: (original[0].x + original[2].x) / 2, y: (original[0].y + original[2].y) / 2 }, { x: (original[0].x + original[2].x) / 2 + .5, y: (original[0].y + original[2].y) / 2 + .3 });
  const shifted = await handles();
  shifted.forEach((value, index) => samePoint(value, { x: original[index].x + .5, y: original[index].y + .3 }));
  const radius = Math.hypot(shifted[1].x - shifted[0].x, shifted[1].y - shifted[0].y);
  const openTarget = { x: shifted[0].x + radius * Math.cos(Math.PI / 4), y: shifted[0].y + radius * Math.sin(Math.PI / 4) };
  await dragPoint(shifted[2], openTarget);
  const adjusted = await handles();
  samePoint(adjusted[2], openTarget);
  near(Math.hypot(adjusted[2].x - adjusted[0].x, adjusted[2].y - adjusted[0].y), radius);
  samePoint((await endpoints(leaf))[1], adjusted[2]);
  await save();
  assert.deepEqual(entry.published.features[0].points, savedPoints, 'Later door edits do not change the published snapshot');
  await page.reload();
  samePoint((await endpoints(leaf))[1], adjusted[2]);
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.locator('.mp-layers button').filter({ hasText: 'Cửa phòng khám' }).click();
    await expect(flip).toBeVisible(); await expect(hinge).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Door editor fits ' + width);
    await page.screenshot({ path: `.workstation-build/map-door/open-door-${width}.png`, fullPage: true });
  }

  // Existing two-point doors become open-door symbols without rewriting saved data.
  entry = { ...entry, revision: entry.revision + 1, draft: { schemaVersion: 1, backgroundColor: '#ffffff', rotationDegrees: 0, features: [{ id: 'legacy-door', type: 'DOOR', label: 'Cửa cũ', color: '#334155', points: [{ x: 2, y: 2 }, { x: 3, y: 2 }], lineWidthM: .02, fontSizeM: .15, endpointId: null }] }, published: null, publishedRevision: null, publishedAt: null };
  const beforeLegacy = writes.length;
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.reload();
  await expect(symbol).toHaveCount(1);
  await expect(arc).toHaveAttribute('d', /A/i);
  samePoint((await endpoints(leaf))[0], { x: 2, y: 2 });
  samePoint((await endpoints(leaf))[1], { x: 2, y: 3 });
  assert.equal(entry.draft.features[0].points.length, 2);
  assert.equal(writes.length, beforeLegacy);
  await page.locator('.mp-layers button').filter({ hasText: 'Cửa cũ' }).click();
  await flip.click(); await save();
  assert.equal(entry.draft.features[0].points.length, 3);
  await page.reload();
  samePoint((await endpoints(leaf))[1], { x: 2, y: 1 });
  assert.deepEqual(entry.source, source);
  assert.ok(writes.every(item => item.path.includes('/presentation')));
  assert.deepEqual(errors, []);
  console.log('PASS: architectural open-door glyph, opening/hinge controls, undo/redo, save/reload, preview/publish, rotated dragging, legacy doors and mobile layout. All APIs mocked.');
} finally { await browser.close(); }
