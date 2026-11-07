import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.MAP_TEST_URL || 'http://127.0.0.1:5175';
const mapId = '11111111-1111-4111-8111-111111111111';
const source = { mapId, assetHash: 'e'.repeat(64), widthM: 10, heightM: 6, resolutionMPerPixel: .05, originXM: -2, originYM: 3, originYawRad: .4, frameId: 'map', widthPx: 200, heightPx: 120 };
const feature = (id, type, label, points) => ({ id, type, label, points, color: '#334155', lineWidthM: .02, fontSizeM: .15, endpointId: null });
const wall = feature('reference-wall', 'WALL', 'Tường chéo mẫu', [{ x: 2, y: 2 }, { x: 6, y: 4 }]);
const room = feature('reference-room', 'ROOM', 'Phòng mẫu', [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 1, y: 2 }]);
let entry = { source: structuredClone(source), revision: 1, draft: { schemaVersion: 1, backgroundColor: '#ffffff', rotationDegrees: 20, features: [structuredClone(wall), structuredClone(room)] }, published: null, publishedRevision: null, publishedAt: null, sourceChanged: false };
const writes = [], errors = [];
await mkdir('.workstation-build/map-drawing-assist', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'smart-drawing-editor', username: 'smart-drawing-editor' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === new URL(base).origin ? route.continue() : route.abort();
  const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (request.method() === 'GET') {
    if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="#eef2f7"/><path d="M200 400 600 200M100 500H300V400H100Z" fill="white" stroke="#334155" stroke-width="4"/></svg>' });
    if (path === `/api/v1/maps/${mapId}/presentation`) return respond(entry);
    if (path === '/api/v1/maps') return respond({ content: [{ ...source, mapName: 'Map vẽ nhanh', mapCode: 'F1', versionNo: 1, status: 'ACTIVE' }], totalPages: 1, last: true });
    return respond({ content: [], totalPages: 1, last: true });
  }
  assert.ok(path.startsWith(`/api/v1/maps/${mapId}/presentation`), `Drawing must only write presentation: ${request.method()} ${path}`);
  const body = request.postDataJSON(); writes.push({ method: request.method(), path, body });
  if (body.expectedRevision !== entry.revision) return respond({ message: 'Revision conflict' }, 409);
  entry = structuredClone(entry); entry.revision++;
  if (request.method() === 'PUT') {
    assert.equal(body.sourceAssetHash, source.assetHash);
    entry.draft = structuredClone(body.document);
  } else if (path.endsWith('/publish')) {
    entry.published = structuredClone(entry.draft); entry.publishedRevision = entry.revision; entry.publishedAt = '2026-11-07T00:00:00Z';
  } else throw Error(`Unexpected mutation: ${request.method()} ${path}`);
  return respond(entry);
});

const svg = page.locator('.mp-canvas'), content = svg.locator('.mp-map-content');
const layers = page.locator('.mp-layers button');
const snap = page.getByRole('checkbox', { name: 'Bắt dính', exact: true });
const wallTool = page.getByRole('button', { name: 'Vẽ tường (W)', exact: true });
const doorTool = page.getByRole('button', { name: 'Vẽ cửa (D)', exact: true });
const indicator = content.locator('.mp-snap-indicator');
const near = (actual, expected, tolerance = .025) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
const samePoint = (a, b, tolerance = .025) => { near(a.x, b.x, tolerance); near(a.y, b.y, tolerance); };
async function screen(point) {
  return content.evaluate((element, p) => {
    const value = new DOMPoint(p.x, 6 - p.y).matrixTransform(element.getScreenCTM());
    return { x: value.x, y: value.y };
  }, point);
}
async function local(point) {
  return content.evaluate((element, p) => {
    const value = new DOMPoint(p.x, p.y).matrixTransform(element.getScreenCTM().inverse());
    return { x: value.x, y: 6 - value.y };
  }, point);
}
async function click(point) {
  const p = await screen(point);
  const target = await page.evaluate(p => { const node = document.elementFromPoint(p.x, p.y); return { canvas: !!node?.closest('.mp-canvas'), tag: node?.tagName, text: node?.textContent?.slice(0, 120) }; }, p);
  assert.ok(target.canvas, `Fixture click ${JSON.stringify(point)} hits canvas, got ${JSON.stringify(target)}`);
  await page.mouse.click(p.x, p.y);
}
async function move(point) { const p = await screen(point); await page.mouse.move(p.x, p.y); }
async function save() {
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu bản nháp' })).toBeVisible();
}
async function finishWall() { await svg.focus(); await page.keyboard.press('Enter'); }
async function resetDraft(features) {
  entry = { ...entry, revision: entry.revision + 1, draft: { ...entry.draft, features: structuredClone(features) }, published: null, publishedRevision: null, publishedAt: null };
  await page.reload();
  await expect(layers).toHaveCount(features.length);
}
const addedWalls = () => entry.draft.features.filter(f => f.type === 'WALL' && f.id !== wall.id);
const onReferenceWall = p => near((p.x - 2) * 2 - (p.y - 2) * 4, 0, .02);

try {
  await page.goto(`${base}/admin/map?mapId=${mapId}&stage=presentation`);
  await expect(content.locator('image')).toHaveCount(1);
  await expect(snap).toBeChecked();
  await expect(content).toHaveAttribute('transform', 'rotate(20 5 3)');

  // Snapping uses a screen-pixel radius, even after rotation. Each click adds
  // another segment while the wall tool remains active.
  await wallTool.click();
  const corner = await screen({ x: 1, y: 1 });
  await page.mouse.move(corner.x + 4, corner.y + 3);
  await expect(indicator).toBeVisible();
  await page.mouse.click(corner.x + 4, corner.y + 3);
  await page.keyboard.down('Alt');
  await move({ x: 4.1, y: 1.4 });
  await expect(content.locator('.mp-drawing-preview')).toBeVisible();
  await click({ x: 4.1, y: 1.4 });
  await expect(wallTool).toHaveAttribute('aria-pressed', 'true');
  await click({ x: 4.6, y: 2 });
  await page.keyboard.up('Alt');
  await expect(layers).toHaveCount(4);
  assert.equal(writes.length, 0, 'Draft drawing remains local until saved');
  await finishWall();
  await expect(content.locator('.mp-drawing-preview')).toHaveCount(0);
  await page.getByRole('button', { name: '↶ Hoàn tác', exact: true }).click();
  await expect(layers).toHaveCount(3);
  await page.getByRole('button', { name: '↷ Làm lại', exact: true }).click();
  await expect(layers).toHaveCount(4);
  await save();
  const chain = addedWalls();
  assert.equal(chain.length, 2);
  samePoint(chain[0].points[0], { x: 1, y: 1 });
  samePoint(chain[0].points[1], { x: 4.1, y: 1.4 });
  samePoint(chain[1].points[0], chain[0].points[1]);
  samePoint(chain[1].points[1], { x: 4.6, y: 2 });

  // A close wall edge is projected; Alt deliberately keeps a nearby vertex
  // unsnapped, rather than merely switching off the indicator.
  await wallTool.click();
  const edge = await screen({ x: 4, y: 3 });
  await page.mouse.move(edge.x + 3, edge.y + 2);
  await expect(indicator).toBeVisible();
  await page.mouse.click(edge.x + 3, edge.y + 2);
  await page.keyboard.down('Alt'); await click({ x: 5, y: 1.5 }); await page.keyboard.up('Alt');
  await finishWall(); await save();
  onReferenceWall(addedWalls().at(-1).points[0]);
  await wallTool.click();
  const freeNear = await screen({ x: 1, y: 2 });
  freeNear.x += 6; freeNear.y += 5;
  const expectedFree = await local(freeNear);
  await page.keyboard.down('Alt');
  await page.mouse.move(freeNear.x, freeNear.y);
  await expect(indicator).toHaveCount(0);
  await page.mouse.click(freeNear.x, freeNear.y);
  await click({ x: 2, y: 2.6 });
  await page.keyboard.up('Alt');
  await finishWall(); await save();
  samePoint(addedWalls().at(-1).points[0], expectedFree, .01);
  assert.ok(Math.hypot(expectedFree.x - 1, expectedFree.y - 2) > .04, 'Alt fixture is distinguishable from snapped corner');

  // Shift means horizontal/vertical in the current view, not in unrotated
  // local map coordinates.
  await wallTool.click();
  const start = { x: 6.2, y: 1.2 }, startScreen = await screen(start);
  await page.keyboard.down('Alt'); await click(start); await page.keyboard.up('Alt');
  await page.keyboard.down('Shift');
  await page.mouse.move(startScreen.x + 100, startScreen.y + 18);
  await page.mouse.click(startScreen.x + 100, startScreen.y + 18);
  await page.keyboard.up('Shift');
  await finishWall(); await save();
  const locked = addedWalls().at(-1).points, a = await screen(locked[0]), b = await screen(locked[1]);
  near(a.y, b.y, 1);
  assert.ok(Math.abs(b.x - a.x) > 75, 'Shift draws a usable horizontal segment');

  // A door drawn near a diagonal wall aligns hinge/jamb to that wall. Pointer
  // distance off the wall determines neither a skewed threshold nor its width.
  await doorTool.click();
  await click({ x: 2.8, y: 2.4 });
  await move({ x: 5, y: 4 });
  await expect(content.locator('.mp-drawing-preview')).toBeVisible();
  await click({ x: 5, y: 4 });
  await save();
  let doors = entry.draft.features.filter(f => f.type === 'DOOR');
  assert.equal(doors.length, 1);
  const [hinge, closed, open] = doors[0].points;
  samePoint(hinge, { x: 2.8, y: 2.4 }); samePoint(closed, { x: 5.2, y: 3.6 });
  onReferenceWall(hinge); onReferenceWall(closed);
  near(Math.hypot(open.x - hinge.x, open.y - hinge.y), Math.hypot(closed.x - hinge.x, closed.y - hinge.y), .001);
  await expect(content.locator('[data-feature-id="reference-wall"] .mp-wall-segment')).toHaveCount(2);
  assert.deepEqual(entry.draft.features.find(f => f.id === wall.id), wall, 'Door placement preserves persisted wall geometry');

  await doorTool.click(); await click({ x: 5.6, y: 3.8 }); await click({ x: 8, y: 5 }); await save();
  doors = entry.draft.features.filter(f => f.type === 'DOOR');
  assert.equal(doors.length, 2);
  samePoint(doors[1].points[1], { x: 6, y: 4 });

  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã áp dụng' })).toBeVisible();
  const published = structuredClone(entry.published);
  await page.reload();
  await expect(layers).toHaveCount(published.features.length);
  assert.deepEqual(entry.draft, published);
  assert.deepEqual(entry.source, source);

  // Zoom changes the map-to-screen scale; a close edge must still snap at the
  // same screen-pixel distance. Toggling snap off supports free drawing.
  await page.getByRole('button', { name: 'Phóng to bản đồ', exact: true }).click();
  await page.getByRole('button', { name: 'Phóng to bản đồ', exact: true }).click();
  await wallTool.click();
  const zoomed = await screen({ x: 4.2, y: 3.1 });
  await page.mouse.move(zoomed.x + 3, zoomed.y + 2);
  await expect(indicator).toBeVisible();
  await snap.uncheck();
  await page.mouse.move(zoomed.x + 4, zoomed.y + 2);
  await expect(indicator).toHaveCount(0);
  await snap.check();
  await svg.focus(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  assert.deepEqual(entry.published, published, 'Later view interactions preserve published snapshot');

  // Temporary Space panning must retain an in-progress door's chosen wall.
  // The second point is deliberately far from that wall so losing attachment
  // cannot accidentally pass as ordinary proximity snapping.
  await resetDraft([wall]);
  await page.getByRole('button', { name: 'Phóng to bản đồ', exact: true }).click();
  await doorTool.click(); await click({ x: 2.8, y: 2.4 });
  const panStart = await screen({ x: 5, y: 2.8 });
  const beforePan = await svg.getAttribute('viewBox');
  await page.keyboard.down('Space');
  await page.mouse.move(panStart.x, panStart.y); await page.mouse.down();
  await page.mouse.move(panStart.x + 35, panStart.y - 20, { steps: 7 }); await page.mouse.up();
  await page.keyboard.up('Space');
  assert.notEqual(await svg.getAttribute('viewBox'), beforePan, 'Fixture actually pans the zoomed map');
  await move({ x: 5, y: 4 }); await click({ x: 5, y: 4 }); await save();
  const pannedDoor = entry.draft.features.find(f => f.type === 'DOOR');
  assert.ok(pannedDoor, 'Door commits after temporary pan');
  samePoint(pannedDoor.points[0], { x: 2.8, y: 2.4 });
  samePoint(pannedDoor.points[1], { x: 5.2, y: 3.6 });

  // At a wall junction, a hinge alone belongs to both walls. Resizing must
  // choose the wall containing the whole original threshold, not the last
  // wall returned for that hinge, and retain a manually chosen leaf direction.
  const junction = feature('junction-wall', 'WALL', 'Tường giao tại bản lề', [{ x: 2, y: 2 }, { x: 2, y: 5 }]);
  const customHinge = { x: 2, y: 2 }, customClosed = { x: 4, y: 3 };
  const radians = Math.PI / 6;
  const customOpen = { x: 2 + 2 * Math.cos(radians) - Math.sin(radians), y: 2 + 2 * Math.sin(radians) + Math.cos(radians) };
  const customDoor = feature('custom-angle-door', 'DOOR', 'Cửa góc mở riêng', [customHinge, customClosed, customOpen]);
  await resetDraft([wall, junction, customDoor]);
  await layers.filter({ hasText: customDoor.label }).click();
  const jambStart = await screen(customClosed), jambTarget = await screen({ x: 5, y: 4 });
  await page.mouse.move(jambStart.x, jambStart.y); await page.mouse.down();
  await page.mouse.move(jambTarget.x, jambTarget.y, { steps: 8 }); await page.mouse.up();
  await save();
  const resized = entry.draft.features.find(f => f.id === customDoor.id).points;
  samePoint(resized[0], customHinge); samePoint(resized[1], { x: 5.2, y: 3.6 });
  const oldRadius = Math.hypot(customOpen.x - customHinge.x, customOpen.y - customHinge.y);
  const newRadius = Math.hypot(resized[2].x - resized[0].x, resized[2].y - resized[0].y);
  near((resized[2].x - resized[0].x) / newRadius, (customOpen.x - customHinge.x) / oldRadius, .001);
  near((resized[2].y - resized[0].y) / newRadius, (customOpen.y - customHinge.y) / oldRadius, .001);
  near(newRadius, Math.hypot(resized[1].x - resized[0].x, resized[1].y - resized[0].y), .001);
  assert.deepEqual(entry.draft.features.find(f => f.id === wall.id), wall);
  assert.deepEqual(entry.draft.features.find(f => f.id === junction.id), junction);
  assert.deepEqual(entry.source, source);

  // Undo while a pointer remains held must end that gesture. A later move from
  // the same pointer must not reapply the stale drag document over the undo.
  const name = page.getByLabel('Tên hiển thị', { exact: true });
  await name.fill('Cửa vừa đổi tên');
  const heldStart = await screen(resized[1]), heldMove = await screen({ x: 4.5, y: 3.4 });
  await page.mouse.move(heldStart.x, heldStart.y); await page.mouse.down();
  await page.mouse.move(heldMove.x, heldMove.y, { steps: 5 });
  await page.keyboard.press('Control+z');
  await expect(name).toHaveValue(customDoor.label);
  const afterUndoMove = await screen({ x: 4, y: 4 });
  await page.mouse.move(afterUndoMove.x, afterUndoMove.y, { steps: 5 }); await page.mouse.up();
  await expect(name).toHaveValue(customDoor.label);
  const restoredHandles = await content.locator('[data-feature-id="custom-angle-door"] > circle').evaluateAll(elements => elements.map(element => ({ x: element.cx.baseVal.value, y: 6 - element.cy.baseVal.value })));
  assert.equal(restoredHandles.length, 3);
  restoredHandles.forEach((point, index) => samePoint(point, resized[index], .001));
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeDisabled();
  await page.screenshot({ path: '.workstation-build/map-drawing-assist/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 950 });
  await expect(snap).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Smart drawing controls fit mobile');
  await page.screenshot({ path: '.workstation-build/map-drawing-assist/mobile.png', fullPage: true });
  assert.ok(writes.every(item => item.path.startsWith(`/api/v1/maps/${mapId}/presentation`)));
  assert.deepEqual(errors, []);
  console.log('PASS: vertex/edge snapping, Alt bypass, Shift in rotated view, continuous undoable walls, wall-attached doors/clamping, Space-pan attachment, junction jamb resizing with custom leaf direction, undo during held drag, save/reload/publish, zoom and mobile. All APIs mocked.');
} catch (error) {
  await page.screenshot({ path: '.workstation-build/map-drawing-assist/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
