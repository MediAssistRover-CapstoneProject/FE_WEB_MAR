import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 8000 });

const base = process.env.TEST_URL || 'http://127.0.0.1:5187';
const id = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const robotId = id(1), mapId = id(2), sessionId = id(3), endpointId = id(4), otherMap = id(5), hash = 'a'.repeat(64), profileHash = 'c'.repeat(64);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
const errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { if (!localStorage.getItem('mediassist-rover.session')) localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', username: 'robot-setup' }, tokens: { accessToken: 'fixture' } })); });
await page.addInitScript(() => {
  const fetch = window.fetch.bind(window), encoder = new TextEncoder();
  window.setupStream = { enabled: false, connections: [], aborted: 0 };
  window.fetch = async (url, options) => {
    if (!String(url).endsWith('/stream') || !window.setupStream.enabled) return fetch(url, options);
    const connection = { url: String(url), controller: null, closed: false, authorization: options.headers.get('Authorization') };
    const stream = new ReadableStream({ start(controller) { connection.controller = controller; } });
    options.signal.addEventListener('abort', () => { connection.closed = true; window.setupStream.aborted++; connection.controller.error(new DOMException('Aborted', 'AbortError')); }, { once: true });
    window.setupStream.connections.push(connection);
    window.setupStream.send = (event, value) => {
      const latest = window.setupStream.connections.at(-1);
      if (!latest.closed) latest.controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
    };
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  };
});
const world = (x, y) => ({ xM: -2 + Math.cos(.35) * x - Math.sin(.35) * y, yM: 3 + Math.sin(.35) * x + Math.cos(.35) * y });
const endpoint = { endpointId, mapId, endpointName: 'Điểm đỗ A', endpointType: 'PARK', ...world(2, 1), yawRad: 0, active: true, accessible: true };
const maps = [mapId, otherMap].map((value, index) => ({ mapId: value, mapName: index ? 'Bản đồ tầng 2' : 'Khu khám bệnh · Tầng 1', versionNo: 2, status: 'ACTIVE', assetHash: hash }));
let session = { state: 'NONE' }, connected = false, acknowledged = false, activeJob = null, wrongRobot = false, metadataHash = hash, endpointMoved = false, loseInitialization = false, heldSession = null;
let snapshotFailure = false, openCount = 0, failClose = false, failOpen = false, loseOpen = false, heldOpen = null;
let snapshotDelay = 0, profileDelay = 0, snapshotReads = 0, profileReads = 0, poseAge = 0;
const png = Buffer.from(await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 600;
  const c = canvas.getContext('2d'); c.fillStyle = '#e5e7eb'; c.fillRect(0, 0, 1000, 600); c.fillStyle = '#fff'; c.fillRect(60, 60, 880, 480);
  c.strokeStyle = '#475569'; c.lineWidth = 9; c.strokeRect(60, 60, 880, 480); c.beginPath(); c.moveTo(60, 220); c.lineTo(940, 220); c.moveTo(60, 420); c.lineTo(940, 420); c.stroke();
  for (const x of [280, 500, 720]) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x, 220); c.moveTo(x, 420); c.lineTo(x, 540); c.stroke(); }
  c.fillStyle = '#eaf0f8'; c.fillRect(65, 225, 870, 190); return canvas.toDataURL().split(',')[1];
}), 'base64');
const snapshot = () => ({ observedAt: new Date().toISOString(), robot: { robotId: wrongRobot ? id(9) : robotId, robotName: 'MAR-01', status: activeJob ? 'BUSY' : 'IDLE', currentMapId: mapId, mapAssetHash: hash, batteryPercent: 86 }, mqttConnected: connected, heartbeatFresh: connected, dispatchReady: connected, activeJobId: activeJob,
  navigationSession: session, latestPose: session.state === 'READY' ? { robotId, mapId: session.mapId, xM: endpoint.xM, yM: endpoint.yM, yawRad: 0, frameId: 'map', fresh: true, capturedAt: new Date(Date.now() - poseAge).toISOString() } : null });
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  const rows = content => json({ content, totalPages: 1, last: true });
  if (method === 'GET') {
    if (path === '/api/v1/robots') return rows([{ robotId, robotName: 'MAR-01', robotCode: 'MAR-01', status: 'IDLE', batteryPercent: 86 }, { robotId: id(9), robotName: 'MAR-02', status: 'IDLE' }]);
    if (path === `/api/v1/robots/${robotId}`) return json({ robotId, robotName: 'MAR-01', robotCode: 'MAR-01', status: 'IDLE', batteryPercent: 86 });
    if (path === '/api/v1/maps') return rows(maps);
    if (path === '/api/v1/endpoints') return rows([endpoint]);
    if (path === `/api/v1/endpoints/${endpointId}`) return json(endpointMoved ? { ...endpoint, xM: endpoint.xM + .3 } : endpoint);
    if (path.endsWith('/snapshot')) {
      snapshotReads++;
      if (path.includes(id(9))) return json({ ...snapshot(), robot: { robotId: id(9), status: 'IDLE' }, navigationSession: { state: 'NONE' }, mqttConnected: false, heartbeatFresh: false, latestPose: null });
      const value = snapshot();
      if (snapshotDelay) await new Promise(resolve => setTimeout(resolve, snapshotDelay));
      return snapshotFailure ? route.abort() : json(value);
    }
    if (path.endsWith('/navigation-zones')) {
      profileReads++;
      if (profileDelay) await new Promise(resolve => setTimeout(resolve, profileDelay));
      return json({ robotId, mapId: session.mapId, profileAcknowledged: acknowledged, profileHash, acknowledgedProfileHash: acknowledged ? profileHash : null, zoneCount: 2 });
    }
    if (path.endsWith('/image-metadata')) return json({ map_id: path.includes(otherMap) ? otherMap : mapId, asset_hash: metadataHash, frame_id: 'map', width_px: 1000, height_px: 600, resolution_m_per_pixel: .01, origin_x_m: -2, origin_y_m: 3, origin_yaw_rad: .35, navigation_reload_safe: true });
    if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: png });
    return rows([]);
  }
  assert.equal(method, 'POST');
  assert.ok(path.startsWith(`/api/v1/robots/${robotId}/navigation-session`), 'Setup must never dispatch MOVE, jobs or map mutations');
  const body = request.postDataJSON(); writes.push({ path, body });
  if (path.endsWith('/initialization')) {
    assert.equal(body.sessionId, session.sessionId);
    const next = { ...session, state: 'LOCALIZING', initialization: { mode: body.mode, revision: session.initialization.revision + 1, pose: body.mode === 'SEED' ? { x_m: body.xM, y_m: body.yM, yaw_rad: body.yawRad } : null } };
    acknowledged = false;
    if (loseInitialization) { heldSession = next; loseInitialization = false; return route.abort(); }
    session = next; return json(session);
  }
  if (path.endsWith('/close')) {
    assert.equal(body.sessionId, session.sessionId);
    if (failClose) return json({ message: 'Robot vẫn còn nhiệm vụ đang chờ' }, 409);
    session = { ...session, state: 'CLOSED' }; return json(session);
  }
  if (failOpen) return json({ message: 'Chưa tạo được phiên mới thử nghiệm' }, 409);
  const next = { robotId, sessionId: openCount++ ? id(5 + openCount) : sessionId, mapId: body.mapId, mapAssetHash: hash, state: 'WAITING_FOR_PI', expiresAt: new Date(Date.now() + body.durationSec * 1000).toISOString(), initialization: { mode: 'MANUAL', revision: 0 } };
  acknowledged = false;
  if (loseOpen) { loseOpen = false; heldOpen = next; return route.abort(); }
  session = next;
  return json(session);
});
const button = name => page.getByRole('button', { name, exact: true });
const readyBanner = page.getByText('Robot đã sẵn sàng nhận nhiệm vụ', { exact: true });
const seedButton = () => button('Xác nhận vị trí robot');
const waitConnected = async () => { await expect(page.getByLabel('Điểm khởi tạo đã lưu')).toBeEnabled(); };
async function chooseSeed() {
  await page.getByLabel('Điểm khởi tạo đã lưu').selectOption(endpointId);
  await page.getByLabel('Robot đang đúng vị trí và hướng đã chọn').check();
}
await mkdir('.workstation-build/robot-setup', { recursive: true });
try {
  await page.goto(`${base}/admin/robots`);
  await page.locator('.be-records button').first().click();
  await expect(page.getByRole('link', { name: 'Thiết lập vận hành ↗', exact: true })).toHaveAttribute('href', `/admin/robot-setup?robotId=${robotId}`);
  await page.getByRole('link', { name: 'Thiết lập vận hành ↗', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thiết lập vận hành', exact: true, level: 2 })).toBeVisible();
  await expect(page.locator('.sidebar .nav-item').filter({ hasText: 'Thiết lập vận hành' })).toHaveAttribute('aria-current', 'page');
  await expect(button('Mở phiên vận hành')).toBeEnabled();
  assert.equal(writes.length, 0, 'Opening the page never changes robot state');
  await page.getByLabel('Thời gian vận hành', { exact: true }).selectOption('28800');
  await button('Mở phiên vận hành').click();
  await expect(page.locator('.rsu-state')).toContainText('Đang chờ Pi kết nối');
  assert.deepEqual(writes[0].body, { mapId, durationSec: 28800 });
  await expect(page.locator('pre')).toContainText('--session-id ' + sessionId);
  await expect(seedButton()).toBeDisabled();
  // BE accepts initialization while WAITING_FOR_PI; no connection is required
  // to save the seed, and doing so must never claim that the robot is ready.
  await waitConnected();
  await chooseSeed();
  await expect(page.locator('[data-pose="seed"]')).toHaveCount(1);
  await expect(page.locator('[data-pose="verified"]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.workstation-build/robot-setup/initializing-desktop.png', fullPage: true });
  profileDelay = 4000;
  await seedButton().click();
  await expect.poll(() => writes.length).toBe(2);
  assert.deepEqual(writes[1].body, { sessionId, mode: 'SEED', xM: endpoint.xM, yM: endpoint.yM, yawRad: 0 });
  await expect(readyBanner).toHaveCount(0);
  connected = true;
  session = { ...session, state: 'READY' };
  await expect(page.locator('.rsu-checks .is-ok').filter({ hasText: 'Vị trí robot' })).toHaveCount(1, { timeout: 2500 });
  profileDelay = 0;
  await expect(readyBanner).toHaveCount(0);
  acknowledged = true;
  await expect(readyBanner).toBeVisible();
  await expect(page.locator('[data-pose="verified"]')).toHaveCount(1);
  await expect(page.locator('[data-pose="seed"]')).toHaveCount(0);
  await expect(page.getByLabel('Điểm khởi tạo đã lưu')).toHaveCount(0);
  await page.screenshot({ path: '.workstation-build/robot-setup/ready-desktop.png', fullPage: true });
  await page.reload(); await expect(readyBanner).toBeVisible(); assert.equal(writes.length, 2, 'A ready session is resumed after reload without reinitializing');
  // Reproduce multi-request polling latency without artificial readiness/layout flicker.
  snapshotDelay = 350; profileDelay = 850;
  const firstRead = snapshotReads;
  const firstProfileRead = profileReads;
  await page.evaluate(() => {
    window.setupTrace = [];
    window.captureSetupState = () => {
      window.setupTrace.push({ title: document.querySelector('.rsu-state strong')?.textContent,
        panels: document.querySelectorAll('.rsu-controls > .rsu-step-card').length,
        banners: document.querySelectorAll('.rsu-ready-banner').length });
    };
    window.captureSetupState();
    window.setupObserver = new MutationObserver(window.captureSetupState);
    window.setupObserver.observe(document.querySelector('.rsu-page'), { subtree: true, childList: true, characterData: true });
  });
  await expect.poll(() => snapshotReads, { timeout: 15000 }).toBeGreaterThanOrEqual(firstRead + 8);
  assert.ok(profileReads - firstProfileRead <= 4, 'profile reads run independently every five seconds instead of once per snapshot');
  const trace = await page.evaluate(() => { window.captureSetupState(); window.setupObserver.disconnect(); return window.setupTrace; });
  assert.ok(trace.length > 0);
  assert.ok(trace.every(row => row.title === 'Sẵn sàng vận hành' && row.panels === 1 && row.banners === 1), `polling latency must not toggle readiness text or remount setup panels: ${JSON.stringify([...new Set(trace.map(row => JSON.stringify(row)))])}`);
  snapshotDelay = 0; profileDelay = 0; poseAge = 6000;
  await expect(readyBanner).toHaveCount(0);
  await expect(page.locator('.rsu-ready-banner.is-checking')).toBeVisible();
  assert.equal(await page.locator('.rsu-controls > .rsu-step-card').count(), 1, 'expired telemetry must not reopen the entire setup form');
  await expect(page.locator('[data-pose="verified"]')).toHaveCount(0);
  await expect(page.getByLabel('Điểm khởi tạo đã lưu')).toHaveCount(0);
  poseAge = 0;
  await expect(readyBanner).toBeVisible();
  await button('Xem thiết lập').click(); await chooseSeed();
  endpointMoved = true;
  await seedButton().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Điểm đã thay đổi' })).toBeVisible();
  assert.equal(writes.length, 2); endpointMoved = false;
  await chooseSeed();
  metadataHash = 'b'.repeat(64);
  await seedButton().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Bản đồ đã thay đổi' })).toBeVisible();
  assert.equal(writes.length, 2); metadataHash = hash;
  connected = false;
  await expect(readyBanner).toHaveCount(0); await expect(page.getByLabel('Điểm khởi tạo đã lưu')).toBeEnabled();
  await expect(page.locator('[data-pose="verified"]')).toHaveCount(0);
  connected = true; activeJob = 'running-job';
  await expect(page.locator('.rsu-state')).toContainText('Robot đang thực hiện nhiệm vụ');
  await expect(seedButton()).toBeDisabled();
  await expect(button('Dừng phiên và mở phiên mới')).toBeDisabled();
  activeJob = null; wrongRobot = true;
  await expect(page.getByRole('alert').filter({ hasText: 'không đúng robot' })).toBeVisible();
  await expect(seedButton()).toBeDisabled(); wrongRobot = false;
  await waitConnected();
  await page.getByLabel('Bản đồ vận hành', { exact: true }).selectOption(otherMap);
  await expect(page.getByRole('alert').filter({ hasText: 'Robot đang có phiên trên' })).toBeVisible();
  assert.equal(writes.length, 2);
  await button('Xem bản đồ của phiên').click();
  await expect(readyBanner).toBeVisible(); await button('Xem thiết lập').click(); await waitConnected();
  // Map clicks use the original rotated coordinate frame, and never write on selection.
  await button('Đặt vị trí và hướng trên bản đồ').click();
  const svg = page.getByRole('img', { name: 'Bản đồ thiết lập vận hành', exact: true });
  const start = world(3, 2), end = world(4, 2);
  const screen = point => svg.evaluate((element, p) => { const v = new DOMPoint(p.xM, -p.yM).matrixTransform(element.getScreenCTM()); return { x: v.x, y: v.y }; }, point);
  const a = await screen(start), b = await screen(end);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('[data-pose="seed"]')).toHaveCount(1); assert.equal(writes.length, 2);
  const transform = await page.locator('[data-pose="seed"]').getAttribute('transform');
  const coordinates = transform.match(/translate\(([^ ]+) ([^)]+)\)/).slice(1).map(Number);
  assert.ok(Math.abs(coordinates[0] - start.xM) < .02 && Math.abs(-coordinates[1] - start.yM) < .02, 'Map placement keeps original world coordinates after yaw');
  await chooseSeed(); loseInitialization = true;
  await seedButton().click();
  await expect(page.getByRole('status').filter({ hasText: 'Đang đối chiếu yêu cầu trước.' })).toBeVisible();
  await expect(seedButton()).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Đang đối chiếu yêu cầu trước.' })).toBeVisible();
  assert.equal(writes.length, 3, 'Lost initialization response is not replayed on reload');
  session = heldSession;
  await expect(page.getByRole('status').filter({ hasText: 'Đang đối chiếu yêu cầu trước.' })).toHaveCount(0);
  await waitConnected();
  await page.getByText('Định vị nâng cao', { exact: true }).click();
  await button('Tự tìm vị trí').click();
  await expect.poll(() => writes.length).toBe(4);
  assert.deepEqual(writes[3].body, { sessionId, mode: 'GLOBAL' });
  // Rejecting the close must never create another session.
  failClose = true;
  await button('Dừng phiên và mở phiên mới').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Robot vẫn còn nhiệm vụ' })).toBeVisible();
  assert.equal(writes.length, 5); assert.ok(writes[4].path.endsWith('/close'));
  assert.equal(session.sessionId, sessionId); failClose = false;
  // A future expiry does not delay close -> create; the new code uses a new ID.
  const oldExpiry = session.expiresAt;
  assert.ok(Date.parse(oldExpiry) - Date.now() > 60 * 60 * 1000);
  await page.getByLabel('Thời hạn phiên mới', { exact: true }).selectOption('14400');
  await button('Dừng phiên và mở phiên mới').dblclick();
  await expect.poll(() => writes.length).toBe(7);
  assert.ok(writes[5].path.endsWith('/close'));
  assert.ok(writes[6].path.endsWith('/navigation-session'));
  assert.deepEqual(writes[6].body, { mapId, durationSec: 14400 });
  assert.notEqual(session.sessionId, sessionId);
  await expect(page.locator('pre')).toContainText('--session-id ' + session.sessionId);
  await expect(page.locator('pre')).not.toContainText('--session-id ' + sessionId);
  await expect(readyBanner).toHaveCount(0);
  assert.ok(Date.parse(oldExpiry) > Date.now(), 'restart completes while the old lease still had hours left');
  // When creation fails after a confirmed close, the UI allows opening again.
  failOpen = true;
  await button('Dừng phiên và mở phiên mới').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Đã đóng phiên cũ nhưng chưa tạo được phiên mới' })).toBeVisible();
  assert.equal(writes.length, 9);
  await expect(button('Mở phiên vận hành')).toBeEnabled();
  failOpen = false; await button('Mở phiên vận hành').click();
  await expect.poll(() => writes.length).toBe(10);
  await expect(page.locator('pre')).toContainText('--session-id ' + session.sessionId);
  // An uncertain create is reconciled, never automatically repeated on reload.
  loseOpen = true;
  await button('Dừng phiên và mở phiên mới').click();
  await expect.poll(() => writes.length).toBe(12);
  await expect(page.getByRole('status').filter({ hasText: 'Đang đối chiếu yêu cầu trước.' })).toBeVisible();
  assert.equal(writes.length, 12);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Đang đối chiếu yêu cầu trước.' })).toBeVisible();
  assert.equal(writes.length, 12);
  session = heldOpen;
  await expect(page.getByRole('status').filter({ hasText: 'Đang đối chiếu yêu cầu trước.' })).toHaveCount(0);
  await expect(page.locator('pre')).toContainText('--session-id ' + session.sessionId);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Thiết lập vận hành', level: 2, exact: true })).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Setup fits a mobile viewport');
  await page.screenshot({ path: '.workstation-build/robot-setup/initializing-mobile.png', fullPage: true });
  await page.getByText('Thông tin phiên và kết thúc vận hành', { exact: true }).click();
  await button('Đóng phiên vận hành').click();
  await expect.poll(() => writes.length).toBe(13);
  assert.deepEqual(writes[12].body, { sessionId: session.sessionId });
  await expect(button('Mở phiên vận hành')).toBeVisible();
  snapshotFailure = true;
  await expect(page.getByRole('alert').filter({ hasText: 'Cannot reach' })).toBeVisible();
  await expect(seedButton()).toBeDisabled(); snapshotFailure = false;
  // Exercise the streaming reader in the browser, including live pose while
  // location-history SQL has not caught up, and a delayed older state event.
  connected = true; acknowledged = true;
  session = { ...session, state: 'READY', initialization: { revision: 1 } };
  await expect(readyBanner).toBeVisible();
  await page.evaluate(() => { window.setupStream.enabled = true; });
  await expect.poll(() => page.evaluate(() => window.setupStream.connections.length)).toBeGreaterThan(0);
  assert.equal(await page.evaluate(() => window.setupStream.connections[0].authorization), 'Bearer fixture');
  const streamPose = { xM: endpoint.xM + .3, yM: endpoint.yM, yawRad: .2 };
  await page.evaluate(({ value, pose }) => {
    window.streamSequence = 10;
    const send = () => {
      const time = new Date().toISOString();
      window.setupStream.send('robot-state', { ...value, observedAt: time, latestPose: null });
      window.setupStream.send('robot-pose', { messageType: 'NAVIGATION_POSE', robotId: value.robot.robotId,
        mapId: value.navigationSession.mapId, mapAssetHash: value.navigationSession.mapAssetHash,
        navigationSessionId: value.navigationSession.sessionId, initializationRevision: 1,
        transportSessionId: 'pi-stream', sequenceNo: window.streamSequence++, receivedAt: time, capturedAt: time, pose });
    };
    send(); window.setupStreamTimer = setInterval(send, 300);
  }, { value: snapshot(), pose: streamPose });
  await expect(page.locator('[data-pose="verified"]')).toHaveAttribute('transform', `translate(${streamPose.xM} ${-streamPose.yM})`);
  await expect(page.locator('[data-setup-transport]')).toContainText('trực tiếp');
  const streamReads = snapshotReads;
  await page.waitForTimeout(2500);
  assert.ok(snapshotReads <= streamReads + 1, 'healthy state events suppress repeated REST snapshot requests');
  await expect(readyBanner).toBeVisible();
  await page.evaluate(value => window.setupStream.send('robot-state', value), { ...snapshot(), observedAt: new Date(Date.now() - 10000).toISOString(), navigationSession: { ...session, state: 'CLOSED' } });
  await expect(readyBanner).toBeVisible();
  await page.evaluate(() => clearInterval(window.setupStreamTimer));
  // Changing robot must abort the old stream and discard its position/profile.
  await page.getByLabel('Robot cần thiết lập', { exact: true }).selectOption(id(9));
  await expect.poll(() => page.evaluate(() => window.setupStream.aborted)).toBeGreaterThan(0);
  assert.equal(await page.evaluate(() => window.setupStream.connections[0].closed), true);
  await expect(page.locator('[data-pose="verified"]')).toHaveCount(0);
  await expect(readyBanner).toHaveCount(0);
  await page.getByLabel('Robot cần thiết lập', { exact: true }).selectOption(robotId);
  await expect(readyBanner).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.setupStream.connections.at(-1)?.url)).toContain(robotId);
  // Losing SSE alone does not mean losing MQTT. REST recovers new robot state.
  await page.evaluate(() => {
    window.setupStream.enabled = false;
    const latest = window.setupStream.connections.at(-1); latest.closed = true;
    latest.controller.error(Error('fixture stream disconnected'));
  });
  await expect(readyBanner).toBeVisible();
  connected = false;
  await expect(readyBanner).toHaveCount(0);
  await expect(page.locator('.rsu-checks')).toContainText('Pi chưa kết nối MQTT');
  await expect(page.locator('[data-setup-transport]')).toContainText('REST dự phòng');
  assert.equal(writes.length, 13, 'streaming, switching robots and fallback never write robot state');
  // Staff cannot access setup through its URL or legacy screen query.
  await page.evaluate(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'STAFF', username: 'staff' }, tokens: { accessToken: 'fixture' } })));
  await page.goto(`${base}/admin/robot-setup`);
  await page.waitForURL('**/admin/robots');
  await expect(page.getByRole('link', { name: /Thiết lập vận hành/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
  await page.locator('.sidebar-group-toggle').filter({ hasText: 'Robot' }).click();
  await expect(page.locator('.sidebar .nav-item').filter({ hasText: 'Thiết lập vận hành' })).toHaveCount(0);
  await page.goto(`${base}/admin?screen=Robot%20Setup`); await page.waitForURL('**/admin/robots');
  await page.evaluate(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ mode: 'demo', account: { role: 'ADMIN', username: 'demo' } })));
  await page.goto(`${base}/admin/robot-setup`);
  await expect(page.getByRole('alert')).toContainText('Chỉ quản trị viên đăng nhập thật');
  await expect(button('Mở phiên vận hành')).toHaveCount(0);
  assert.equal(writes.length, 13);
  assert.deepEqual(errors, []);
  console.log('PASS: WAITING_FOR_PI initialization, slow independent profile reads, stable readiness, authenticated SSE/live pose, old event rejection, stream cleanup on robot switch, REST fallback, close/reopen, uncertain-response recovery, permissions and mobile layout. All APIs mocked; no robot motion requests.');
} catch (error) {
  await page.screenshot({ path: '.workstation-build/robot-setup/failure.png', fullPage: true }); throw error;
} finally { await browser.close(); }
