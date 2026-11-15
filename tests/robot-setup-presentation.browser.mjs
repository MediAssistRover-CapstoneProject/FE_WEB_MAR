import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
import { localToWorld } from '../src/features/facility/mapPresentation.js';

const expect = baseExpect.configure({ timeout: 8000 });
const base = process.env.TEST_URL || 'http://127.0.0.1:5187';
const output = '.workstation-build/robot-setup-presentation';
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const mapId = id(1), robotId = id(2), sessionId = id(3), endpointId = id(4);
const hash = 'a'.repeat(64), profileHash = 'c'.repeat(64);
const source = { mapId, assetHash: hash, widthM: 10, heightM: 6, widthPx: 200, heightPx: 120,
  resolutionMPerPixel: .05, originXM: -2, originYM: 3, originYawRad: .4, frameId: 'map' };
const metadata = { map_id: mapId, asset_hash: hash, width_px: 200, height_px: 120,
  resolution_m_per_pixel: .05, origin_x_m: -2, origin_y_m: 3, origin_yaw_rad: .4, frame_id: 'map', navigation_reload_safe: true };
// width_m/height_m are deliberately absent: setup computes physical geometry from the PNG grid.
const feature = (featureId, label, x, y = 2) => ({ id: featureId, type: 'LANDMARK', label, color: '#334155',
  points: [{ x, y }], fontSizeM: .15, lineWidthM: .03, endpointId: null });
let published = { source: structuredClone(source), revision: 3, document: { schemaVersion: 1,
  backgroundColor: '#ffffff', rotationDegrees: -20,
  features: [feature('robot-marker', 'Vị trí trên bản đã chỉnh', 4), feature('endpoint-marker', 'Điểm đỗ đã chỉnh', 7)] } };
let presentationStatus = 200;
const endpoint = { endpointId, mapId, endpointName: 'Điểm đỗ A', endpointType: 'PARK',
  ...localToWorld({ x: 7, y: 2 }, source), yawRad: .4, active: true, accessible: true };
let session = { robotId, sessionId, mapId, mapAssetHash: hash, state: 'READY', expiresAt: new Date(Date.now() + 7200000).toISOString(),
  initialization: { mode: 'MANUAL', revision: 1 } };
const robot = { robotId, robotName: 'MAR-01', robotCode: 'MAR-01', status: 'IDLE', currentMapId: mapId, mapAssetHash: hash, batteryPercent: 86 };
const snapshot = () => ({ observedAt: new Date().toISOString(), robot, mqttConnected: true, heartbeatFresh: true, dispatchReady: true,
  navigationSession: session, latestPose: session.state === 'READY' ? { robotId, mapId,
    ...localToWorld({ x: 4, y: 2 }, source), yawRad: .4, frameId: 'map', fresh: true, capturedAt: new Date().toISOString() } : null });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
const errors = [], writes = [], reads = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'fixture' } })));
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  const list = content => json({ content, totalPages: 1, last: true, totalElements: content.length });
  if (request.method() !== 'GET') {
    const body = request.postDataJSON(); writes.push({ path, method: request.method(), body });
    assert.equal(request.method(), 'POST');
    assert.equal(path, `/api/v1/robots/${robotId}/navigation-session/initialization`, 'Only explicitly confirmed initialization may mutate robot state');
    session = { ...session, state: 'LOCALIZING', initialization: { revision: session.initialization.revision + 1,
      mode: body.mode, pose: { x_m: body.xM, y_m: body.yM, yaw_rad: body.yawRad } } };
    return json({ ...session, observedAt: new Date().toISOString() });
  }
  reads.push(path);
  if (path === '/api/v1/auth/me') return json({ username: 'admin', role: 'ADMIN' });
  if (path === '/api/v1/robots') return list([robot]);
  if (path === '/api/v1/maps') return list([{ mapId, mapName: 'Map đã chỉnh sửa', versionNo: 1, status: 'ACTIVE', assetHash: hash }]);
  if (path === '/api/v1/endpoints') return list([endpoint]);
  if (path === `/api/v1/endpoints/${endpointId}`) return json(endpoint);
  if (path.endsWith('/snapshot')) return json(snapshot());
  if (path.endsWith('/navigation-zones')) return json({ robotId, mapId, profileAcknowledged: true, profileHash, acknowledgedProfileHash: profileHash });
  if (path.endsWith('/image-metadata')) return json(metadata);
  if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: png });
  if (path.endsWith('/presentation/published')) return json(presentationStatus === 200 ? published : { message: 'Không có bản đồ đã áp dụng' }, presentationStatus);
  if (path.endsWith('/stream')) return route.fulfill({ contentType: 'text/event-stream', body: '' });
  return list([]);
});
const button = name => page.getByRole('button', { name, exact: true });
const map = () => page.locator('.rsu-map-view');
const svg = () => map().locator('svg[role="img"]');
const refreshMap = async () => { await button('Tải lại bản đồ').click(); };
const featurePoint = async (featureId, point) => map().locator(`[data-feature-id="${featureId}"]`).evaluate((node, point) => {
  const result = new DOMPoint(point.x, point.y).matrixTransform(node.getScreenCTM());
  return { x: result.x, y: result.y };
}, point);
const markerPoint = selector => map().locator(selector).evaluate(node => {
  const result = new DOMPoint(0, 0).matrixTransform(node.getScreenCTM());
  return { x: result.x, y: result.y };
});
const closeTo = (a, b, tolerance, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= tolerance, `${label}: ${JSON.stringify({ a, b })}`);
const publishedReads = () => reads.filter(path => path.endsWith('/presentation/published')).length;

try {
  await mkdir(output, { recursive: true });
  await page.goto(`${base}/admin/robot-setup?robotId=${robotId}&mapId=${mapId}`);
  await expect(map()).toHaveAttribute('data-map-view', 'published');
  await expect(map().getByText('Vị trí trên bản đã chỉnh', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Robot đã sẵn sàng nhận nhiệm vụ', { exact: true })).toBeVisible();
  assert.equal(writes.length, 0, 'Viewing an edited map never opens/restarts or initializes a robot session');
  await button('Xem thiết lập').click();
  await expect(page.getByLabel('Điểm khởi tạo đã lưu')).toBeEnabled();
  await expect(map().locator('.mp-map-content')).toHaveAttribute('transform', 'rotate(-20 5 3)');
  await expect(map().locator('[data-pose="verified"]')).toHaveCount(1);
  await expect(map().locator('[data-seed-endpoint]')).toHaveCount(1);
  closeTo(await markerPoint('[data-pose="verified"]'), await featurePoint('robot-marker', { x: 4, y: 4 }), .01, 'live pose aligns with edited landmark');
  closeTo(await markerPoint('[data-seed-endpoint]'), await featurePoint('endpoint-marker', { x: 7, y: 4 }), .01, 'saved endpoint aligns with edited landmark');
  const initialView = await svg().getAttribute('viewBox');
  await button('Phóng to bản đồ thiết lập').click();
  await expect(svg()).not.toHaveAttribute('viewBox', initialView);
  await button('Vừa khung').click();
  await expect(svg()).toHaveAttribute('viewBox', initialView);
  await map().screenshot({ path: `${output}/edited-desktop.png` });

  // Pointer picking must invert both the saved presentation rotation and the map-origin yaw.
  await button('Đặt vị trí và hướng trên bản đồ').click();
  await svg().scrollIntoViewIfNeeded();
  const start = await featurePoint('robot-marker', { x: 4.02, y: 3.98 });
  const end = await featurePoint('robot-marker', { x: 5.025, y: 3.975 });
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 }); await page.mouse.up();
  await expect(map().locator('[data-pose="seed"]')).toHaveCount(1);
  const worldSeed = localToWorld({ x: 4.025, y: 2.025 }, source);
  const transform = await map().locator('[data-pose="seed"]').getAttribute('transform');
  const match = transform.match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);
  assert.ok(match, 'seed keeps original world-coordinate marker transform');
  closeTo({ x: Number(match[1]), y: -Number(match[2]) }, { x: worldSeed.xM, y: worldSeed.yM }, .001, 'pointer selection retains original world coordinates');
  assert.equal(writes.length, 0, 'pointer gesture remains local until explicit confirmation');
  await page.getByLabel('Robot đang đúng vị trí và hướng đã chọn').check();
  await button('Xác nhận vị trí robot').click();
  await expect.poll(() => writes.length).toBe(1);
  assert.equal(writes[0].body.sessionId, sessionId);
  assert.equal(writes[0].body.mode, 'SEED');
  closeTo({ x: writes[0].body.xM, y: writes[0].body.yM }, { x: worldSeed.xM, y: worldSeed.yM }, .001, 'seed API body remains in ROS world coordinates');
  assert.ok(Math.abs(writes[0].body.yawRad - .4) < .025, `seed heading is world yaw, not presentation angle: ${writes[0].body.yawRad}`);

  // Resume a ready observation; visual map changes must not create more state mutations.
  session = { ...session, state: 'READY' };
  await button('Cập nhật trạng thái thiết lập').click();
  await expect(map().locator('[data-pose="verified"]')).toHaveCount(1);
  for (const status of [404, 409]) {
    presentationStatus = status; await refreshMap();
    await expect(map()).toHaveAttribute('data-map-view', 'original');
    await expect(map().locator('.mp-map-content')).toHaveCount(0);
    await expect(map().locator('image')).toHaveCount(1);
    await expect(map().locator('[data-pose="verified"]')).toHaveCount(1);
  }
  presentationStatus = 200; published.source.assetHash = 'b'.repeat(64); await refreshMap();
  await expect(map()).toHaveAttribute('data-map-view', 'original');
  await expect(map().locator('.mp-map-content')).toHaveCount(0);
  published.source.assetHash = hash; await refreshMap();
  await expect(map()).toHaveAttribute('data-map-view', 'published');
  presentationStatus = 503; await refreshMap();
  await expect(map().locator('.rsu-presentation-status')).toContainText('Chưa cập nhật được bản chỉnh sửa');
  await expect(map()).toHaveAttribute('data-map-view', 'published');
  presentationStatus = 200;
  const beforeFocus = publishedReads();
  published.document.features[0].label = 'Bản chỉnh sửa mới sau khi áp dụng';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(publishedReads).toBeGreaterThan(beforeFocus);
  await expect(map().getByText('Bản chỉnh sửa mới sau khi áp dụng', { exact: true }).last()).toBeVisible();

  // A published rotation-only document remains valid and shows the original image.
  published.document.features = []; published.document.rotationDegrees = 90; await refreshMap();
  await expect(map()).toHaveAttribute('data-map-view', 'published');
  await expect(map().locator('.mp-map-content')).toHaveAttribute('transform', 'rotate(90 5 3)');
  await expect(map().locator('image')).toHaveCount(1);
  if (await button('Xem thiết lập').isVisible()) await button('Xem thiết lập').click();
  await expect(page.getByLabel('Điểm khởi tạo đã lưu')).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'edited setup map fits mobile viewport');
  await map().screenshot({ path: `${output}/edited-mobile.png` });
  assert.equal(writes.length, 1, 'fallback/refresh/focus/zoom never dispatch commands or mutate navigation maps');
  assert.ok(!reads.some(path => path.endsWith('/presentation')), 'operational map reads published data rather than draft presentation');
  assert.deepEqual(errors, []);
  console.log('PASS: Robot Setup edited map rendering, nonzero-origin coordinate alignment, pointer seed world coordinates/heading, zoom/fit, 404/409/hash fallback, reload/focus refresh, rotation-only image, mobile and read-only map API behavior. All APIs mocked.');
} catch (error) {
  console.error('Robot Setup presentation errors:', errors, 'Page:', await page.locator('body').innerText().catch(() => 'unavailable'));
  throw error;
} finally { await browser.close(); }
