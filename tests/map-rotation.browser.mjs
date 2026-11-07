import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.MAP_TEST_URL || 'http://127.0.0.1:5175';
const mapId = '11111111-1111-4111-8111-111111111111', endpointId = '22222222-2222-4222-8222-222222222222';
const source = { mapId, assetHash: 'a'.repeat(64), widthM: 10, heightM: 6, resolutionMPerPixel: .05, originXM: -2, originYM: 3, originYawRad: .4, frameId: 'map', widthPx: 200, heightPx: 120 };
const wall = { id: 'reference-wall', type: 'WALL', label: 'Tường mẫu', color: '#334155', points: [{ x: 2, y: 4.5 }, { x: 8, y: 2.5 }], lineWidthM: .03, fontSizeM: .15, endpointId: null };
const marker = { id: 'reference-marker', type: 'LABEL', label: 'Mốc kiểm tra', color: '#334155', points: [{ x: 7, y: 2 }], lineWidthM: .03, fontSizeM: .15, endpointId: null };
const endpoint = { endpointId, mapId, endpointName: 'Điểm đích đã đo', endpointCode: 'FIXED', xM: source.originXM + Math.cos(.4) * 2 - Math.sin(.4), yM: source.originYM + Math.sin(.4) * 2 + Math.cos(.4), active: true, accessible: true };
// No rotationDegrees field deliberately exercises legacy saved documents.
let entry = { source: structuredClone(source), revision: 1, draft: { schemaVersion: 1, backgroundColor: '#f8fafc', features: [structuredClone(wall), structuredClone(marker)] }, published: null, publishedRevision: null, publishedAt: null, sourceChanged: false };
const writes = [], errors = [];
let ignoreRotation = false;
await mkdir('.workstation-build/map-rotation', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'rotation-editor', username: 'rotation-editor' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === new URL(base).origin ? route.continue() : route.abort();
  const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (request.method() === 'GET') {
    if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="#cdcdcd"/><path d="M200 150 800 350 730 560 130 360Z" fill="white" stroke="#111" stroke-width="7" stroke-linejoin="round"/><path d="m300 184-23 69 86 29 23-69m180 60-23 69 86 29 23-69M200 384l95 32 23-69-95-32m318 199 23-69 95 32-23 69" fill="none" stroke="#111" stroke-width="7"/></svg>' });
    if (path === `/api/v1/maps/${mapId}/presentation`) return respond(entry);
    if (path === '/api/v1/maps') return respond({ content: [{ ...source, mapName: 'Map quét nghiêng', mapCode: 'F1', versionNo: 1, status: 'ACTIVE' }], totalPages: 1, last: true });
    if (path === '/api/v1/endpoints') return respond({ content: [endpoint], totalPages: 1, last: true });
    return respond({ content: [], totalPages: 1, last: true });
  }
  assert.ok(path.includes('/presentation'), `Rotation must not mutate navigation data: ${request.method()} ${path}`);
  const body = request.postDataJSON();
  writes.push({ method: request.method(), path, body });
  if (body.expectedRevision !== entry.revision) return respond({ message: 'Revision conflict' }, 409);
  entry = structuredClone(entry);
  entry.revision++;
  if (request.method() === 'PUT') {
    assert.equal(body.sourceAssetHash, source.assetHash);
    entry.draft = structuredClone(body.document);
    if (ignoreRotation) delete entry.draft.rotationDegrees;
  } else if (path.endsWith('/publish')) {
    entry.published = structuredClone(entry.draft);
    entry.publishedRevision = entry.revision;
    entry.publishedAt = '2026-11-07T00:00:00Z';
  } else throw Error(`Unexpected mutation: ${request.method()} ${path}`);
  return respond(entry);
});
const svg = page.locator('.mp-canvas'), content = svg.locator('.mp-map-content');
const angle = page.getByLabel('Góc xoay bản đồ', { exact: true });
const near = (actual, expected, tolerance = .03) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
async function point(x, y) {
  return content.evaluate((element, p) => {
    const value = new DOMPoint(p.x, 6 - p.y).matrixTransform(element.getScreenCTM());
    return { x: value.x, y: value.y };
  }, { x, y });
}
async function setAngle(value) {
  await angle.fill(String(value));
  await angle.press('Enter');
  await expect.poll(async () => content.evaluate(element => {
    const matrix = element.transform.baseVal.consolidate()?.matrix;
    return matrix ? Math.round(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI * 1e4) / 1e4 : 0;
  })).toBe(value);
}
async function assertFits() {
  const read = () => content.evaluate(element => {
    const root = element.ownerSVGElement, matrix = element.transform.baseVal.consolidate().matrix;
    const view = root.viewBox.baseVal;
    return { bounds: { x: view.x, y: view.y, width: view.width, height: view.height }, corners: [[0, 0], [10, 0], [10, 6], [0, 6]].map(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(matrix); return { x: p.x, y: p.y }; }) };
  });
  await expect.poll(async () => {
    const { bounds, corners } = await read();
    return corners.every(corner => corner.x >= bounds.x - 1e-5 && corner.x <= bounds.x + bounds.width + 1e-5 && corner.y >= bounds.y - 1e-5 && corner.y <= bounds.y + bounds.height + 1e-5);
  }).toBe(true);
  const { bounds, corners } = await read();
  for (const corner of corners) {
    assert.ok(corner.x >= bounds.x - 1e-5 && corner.x <= bounds.x + bounds.width + 1e-5, 'Rotated map horizontal corners remain inside fitted view');
    assert.ok(corner.y >= bounds.y - 1e-5 && corner.y <= bounds.y + bounds.height + 1e-5, 'Rotated map vertical corners remain inside fitted view');
  }
}
try {
  await page.goto(`${base}/admin/map?mapId=${mapId}&stage=presentation`);
  await expect(angle).toHaveValue('0');
  await angle.fill('360');
  await angle.press('Enter');
  await expect(angle).toHaveValue('0');
  await expect(content).toHaveAttribute('transform', 'rotate(0 5 3)');
  await expect(content.locator('image')).toHaveCount(1);
  await expect(content.locator('polyline')).toHaveCount(1);
  await expect(content.locator('g').filter({ has: page.locator('title').filter({ hasText: endpoint.endpointName }) })).toHaveCount(1);
  await setAngle(-23.5);
  await assertFits();
  await expect(page.getByText('Có thay đổi chưa lưu', { exact: true })).toBeVisible();
  assert.equal(writes.length, 0, 'Changing view angle does not write before saving');
  assert.deepEqual(entry.draft.features, [wall, marker], 'Rotation does not change stored local feature coordinates');
  assert.deepEqual(entry.source, source, 'Rotation does not change source origin/yaw/hash/dimensions');
  const endpointCircle = content.locator('g').filter({ has: page.locator('title').filter({ hasText: endpoint.endpointName }) }).locator('circle');
  near(Number(await endpointCircle.getAttribute('cx')), 2, 1e-10);
  near(Number(await endpointCircle.getAttribute('cy')), 5, 1e-10);
  const textMatrices = await content.locator('text').evaluateAll(elements => elements.map(element => {
    const matrix = element.getScreenCTM();
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d };
  }));
  for (const matrix of textMatrices) {
    near(matrix.b, 0, 1e-8);
    near(matrix.c, 0, 1e-8);
    assert.ok(matrix.a > 0 && matrix.d > 0, 'Labels remain horizontal and readable after rotating the map');
  }

  // A rectangle dragged after rotation follows displayed horizontal/vertical axes.
  await page.getByRole('button', { name: 'Vẽ phòng (R)', exact: true }).click();
  const roomA = await point(3, 2), roomB = await point(6, 4);
  await page.mouse.move(roomA.x, roomA.y); await page.mouse.down(); await page.mouse.move(roomB.x, roomB.y, { steps: 6 }); await page.mouse.up();
  const polygon = content.locator('polygon');
  await expect(polygon).toHaveCount(1);
  const displayed = await polygon.evaluate(element => Array.from(element.points, p => {
    const v = new DOMPoint(p.x, p.y).matrixTransform(element.getScreenCTM());
    return { x: v.x, y: v.y };
  }));
  for (let i = 0; i < displayed.length; i++) {
    const a = displayed[i], b = displayed[(i + 1) % displayed.length];
    assert.ok(Math.abs(a.x - b.x) < .02 || Math.abs(a.y - b.y) < .02, 'Drawn room edges align with display axes');
  }
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Phòng đã căn');

  // Vertex drag uses the inverse content transform while retaining source units.
  await page.locator('.mp-layers button').filter({ hasText: 'Mốc kiểm tra' }).click();
  const markerGroup = content.locator('g').filter({ has: page.locator('text').filter({ hasText: 'Mốc kiểm tra' }) });
  const markerVertex = markerGroup.locator('circle').first();
  const markerStart = await point(7, 2), markerEnd = await point(7.4, 2.25);
  await expect(markerVertex).toBeVisible();
  await page.mouse.move(markerStart.x, markerStart.y); await page.mouse.down(); await page.mouse.move(markerEnd.x, markerEnd.y, { steps: 6 }); await page.mouse.up();
  near(Number(await markerVertex.getAttribute('cx')), 7.4);
  near(Number(await markerVertex.getAttribute('cy')), 6 - 2.25);
  // An older server may acknowledge a save while silently dropping rotation.
  ignoreRotation = true;
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Máy chủ chưa lưu được góc xoay');
  await expect(angle).toHaveValue('-23.5');
  await expect(page.getByText('Có thay đổi chưa lưu', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
  assert.equal(entry.draft.rotationDegrees, undefined);
  const ignoredRevision = entry.revision;
  ignoreRotation = false;
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu bản nháp' })).toBeVisible();
  assert.equal(writes.at(-1).body.expectedRevision, ignoredRevision, 'Retry uses the acknowledged revision without losing local rotation');
  near(entry.draft.rotationDegrees, -23.5, 1e-8);
  assert.deepEqual(entry.draft.features.find(f => f.id === wall.id).points, wall.points);
  near(entry.draft.features.find(f => f.id === marker.id).points[0].x, 7.4);
  near(entry.draft.features.find(f => f.id === marker.id).points[0].y, 2.25);
  assert.deepEqual(entry.source, source);
  await page.reload();
  await expect(angle).toHaveValue('-23.5');
  await assertFits();
  await expect(content.locator('polygon')).toHaveCount(1);

  // Published orientation remains a snapshot when later draft angle changes.
  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã áp dụng' })).toBeVisible();
  await setAngle(-10);
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu bản nháp' })).toBeVisible();
  assert.equal(entry.published.rotationDegrees, -23.5);
  assert.equal(entry.draft.rotationDegrees, -10);
  // Ctrl+S must commit a pending numeric angle before saving the document.
  await angle.fill('-24.7');
  await angle.press('Control+s');
  await expect.poll(() => entry.draft.rotationDegrees).toBe(-24.7);
  await expect(angle).toHaveValue('-24.7');
  assert.equal(entry.published.rotationDegrees, -23.5);

  // Coarse/fine turns, undo/redo and fit after 90-degree turns.
  await page.getByRole('button', { name: 'Về 0°', exact: true }).click();
  await expect(angle).toHaveValue('0');
  const slider = page.getByRole('slider', { name: 'Thanh trượt xoay bản đồ', exact: true });
  const sliderBox = await slider.boundingBox();
  await page.mouse.move(sliderBox.x + sliderBox.width / 2, sliderBox.y + sliderBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sliderBox.x + sliderBox.width * .67, sliderBox.y + sliderBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await angle.inputValue())).toBeGreaterThan(20);
  const gestureAngle = Number(await angle.inputValue());
  await page.getByRole('button', { name: '↶ Hoàn tác', exact: true }).click();
  await expect(angle).toHaveValue('0');
  await page.getByRole('button', { name: '↷ Làm lại', exact: true }).click();
  await expect.poll(async () => Number(await angle.inputValue())).toBe(gestureAngle);
  await page.getByRole('button', { name: 'Về 0°', exact: true }).click();
  await expect(angle).toHaveValue('0');
  await page.getByRole('button', { name: 'Xoay phải 90 độ', exact: true }).click();
  await expect(angle).toHaveValue('90');
  await assertFits();
  await page.getByRole('button', { name: 'Xoay trái 90 độ', exact: true }).click();
  await expect(angle).toHaveValue('0');
  await page.getByRole('button', { name: 'Xoay trái 1 độ', exact: true }).click();
  await expect(angle).toHaveValue('-1');
  await page.getByRole('button', { name: '↶ Hoàn tác', exact: true }).click();
  await expect(angle).toHaveValue('0');
  await page.getByRole('button', { name: '↷ Làm lại', exact: true }).click();
  await expect(angle).toHaveValue('-1');
  await page.getByRole('button', { name: 'Xoay phải 1 độ', exact: true }).click();
  await expect(angle).toHaveValue('0');

  // Two points on a wall bring the closest axis into alignment.
  await page.getByRole('button', { name: 'Căn theo tường', exact: true }).click();
  const wallA = await point(2, 4.5), wallB = await point(8, 2.5);
  await page.mouse.click(wallA.x, wallA.y); await page.mouse.click(wallB.x, wallB.y);
  await expect.poll(async () => Number(await angle.inputValue())).toBeLessThan(-18.4);
  near(Number(await angle.inputValue()), -Math.atan2(2, 6) * 180 / Math.PI, .02);
  const alignedA = await point(2, 4.5), alignedB = await point(8, 2.5);
  near(alignedA.y, alignedB.y, .02);
  const preciseAlignedTransform = await content.getAttribute('transform');
  await angle.focus();
  await angle.press('Tab');
  await expect(content).toHaveAttribute('transform', preciseAlignedTransform);
  await assertFits();
  await page.getByRole('checkbox', { name: 'Lưới căn', exact: true }).check();
  await page.screenshot({ path: '.workstation-build/map-rotation/aligned-desktop.png', fullPage: true });

  // Zoom/pan use fitted rotated bounds, then fit restores all four corners.
  const fitView = await svg.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Phóng to bản đồ', exact: true }).click();
  await expect(svg).not.toHaveAttribute('viewBox', fitView);
  const oldView = await svg.getAttribute('viewBox'), box = await svg.boundingBox();
  await svg.focus(); await page.keyboard.down('Space');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  await page.keyboard.up('Space');
  await expect(svg).not.toHaveAttribute('viewBox', oldView);
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  await expect(svg).toHaveAttribute('viewBox', fitView);
  await assertFits();
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(angle).toBeVisible();
    await expect(page.getByRole('button', { name: 'Căn theo tường', exact: true })).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Rotation controls fit ' + width);
    await page.screenshot({ path: `.workstation-build/map-rotation/aligned-${width}.png`, fullPage: true });
  }

  // A scanned map can publish its orientation before any room/label is drawn.
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu bản nháp' })).toBeVisible();
  entry = { source: structuredClone(source), revision: 1, draft: { schemaVersion: 1, backgroundColor: '#f8fafc', features: [] }, published: null, publishedRevision: null, publishedAt: null, sourceChanged: false };
  await page.reload();
  await expect(angle).toHaveValue('0');
  await setAngle(-18.5);
  await page.getByRole('checkbox', { name: 'Xem bản đẹp', exact: true }).check();
  await expect(content.locator('image')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã áp dụng' })).toBeVisible();
  assert.equal(entry.published.rotationDegrees, -18.5);
  assert.deepEqual(entry.published.features, []);
  await page.reload();
  await expect(angle).toHaveValue('-18.5');
  await expect(content.locator('image')).toHaveCount(1);
  await assertFits();
  await page.getByRole('button', { name: 'Về 0°', exact: true }).click();
  await expect(angle).toHaveValue('0');
  await expect(page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  await expect.poll(() => entry.published.rotationDegrees).toBe(0);
  assert.deepEqual(entry.published.features, []);
  await page.reload();
  await expect(angle).toHaveValue('0');
  await expect(content.locator('image')).toHaveCount(1);
  assert.deepEqual(entry.source, source);
  assert.deepEqual(endpoint, { endpointId, mapId, endpointName: 'Điểm đích đã đo', endpointCode: 'FIXED', xM: source.originXM + Math.cos(.4) * 2 - Math.sin(.4), yM: source.originYM + Math.sin(.4) * 2 + Math.cos(.4), active: true, accessible: true });
  assert.ok(writes.every(item => item.path.includes('/presentation')));
  assert.deepEqual(errors, []);
  console.log('PASS: legacy rotation default, rotation/fit, horizontal labels, aligned drawing, inverse dragging, save/reload and old-server guard, publish isolation/orientation-only, gesture undo, wall alignment, zoom/pan and 390/1024px layouts. All APIs mocked.');
} finally { await browser.close(); }
