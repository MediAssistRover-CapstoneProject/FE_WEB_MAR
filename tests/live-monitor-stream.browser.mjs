import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5187';
const id = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const robotId = id(1), mapId = id(2), jobId = id(3), sessionId = id(4), stepId = id(5), hash = 'a'.repeat(64);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const reads = new Map(), writes = [], errors = [];
let failSnapshot = false, snapshotDelay = 0, detailDelay = 0;
let job = { jobId, jobCode: 'JOB-STREAM', robotId, status: 'RUNNING', rowVersion: 1, selectedJobStepId: stepId, schemaVersion: 3, beOrchestrated: true, queuedAt: new Date().toISOString() };
let steps = [{ jobStepId: stepId, rowVersion: 1, stepTypeSnapshot: 'MOVE', stepCodeSnapshot: 'MOVE_A', status: 'RUNNING', executionSequenceNo: 1 }];
const robot = { robotId, currentMapId: mapId, mapAssetHash: hash, robotCode: 'MAR-01', status: 'BUSY' };
const snapshot = () => ({ observedAt: new Date().toISOString(), robot, mqttConnected: true, heartbeatFresh: true, activeJobId: jobId, selectedJobStepId: job.selectedJobStepId,
  navigationSession: { robotId, sessionId, mapId, mapAssetHash: hash, state: 'READY', expiresAt: new Date(Date.now() + 60000).toISOString(), initialization: { revision: 1 } }, latestPose: null });
const detail = () => structuredClone({ job, steps, tasks: [] });
const metadata = { map_id: mapId, asset_hash: hash, frame_id: 'map', width_px: 100, height_px: 100, width_m: 10, height_m: 10, resolution_m_per_pixel: .1, origin_x_m: 0, origin_y_m: 0, origin_yaw_rad: 0, pixel_center_to_map: [[.1, 0, .05], [0, -.1, 9.95], [0, 0, 1]] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'monitor-stream', role: 'ADMIN' }, tokens: { accessToken: 'fixture' } }));
  const fetch = window.fetch.bind(window), encoder = new TextEncoder();
  window.monitorStreams = [];
  window.fetch = async (path, options) => {
    if (!String(path).endsWith('/stream')) return fetch(path, options);
    const entry = { path: String(path), closed: false };
    const stream = new ReadableStream({ start(controller) { entry.controller = controller; } });
    options.signal.addEventListener('abort', () => { entry.closed = true; entry.controller.error(new DOMException('Aborted', 'AbortError')); }, { once: true });
    window.monitorStreams.push(entry);
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  };
  window.emitMonitor = (kind, value, job = false) => {
    const stream = window.monitorStreams.findLast(item => !item.closed && item.path.includes(job ? '/jobs/' : '/robots/'));
    stream?.controller.enqueue(encoder.encode(`event: ${kind}\ndata: ${JSON.stringify(value)}\n\n`));
  };
});
await page.route('**/api/v1/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() !== 'GET') { writes.push(path); return route.fulfill({ json: {} }); }
  reads.set(path, (reads.get(path) || 0) + 1);
  const json = value => route.fulfill({ json: value });
  const rows = content => json({ content, last: true, totalPages: 1, totalElements: content.length });
  if (path === '/api/v1/robots') return rows([robot]);
  if (path === '/api/v1/maps') return rows([{ mapId, mapName: 'Stream map', status: 'ACTIVE', versionNo: 1 }]);
  if (path === '/api/v1/jobs') return rows([job]);
  if (path === `/api/v1/jobs/${jobId}`) { const value = detail(); if (detailDelay) await new Promise(done => setTimeout(done, detailDelay)); return json(value); }
  if (path.endsWith('/snapshot')) { const value = snapshot(); if (snapshotDelay) await new Promise(done => setTimeout(done, snapshotDelay)); return failSnapshot ? route.abort() : json(value); }
  if (path.endsWith('/image-metadata')) return json(metadata);
  if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: png });
  if (path.endsWith('/presentation/published')) return json({ source: { mapId, assetHash: hash, widthM: 10, heightM: 10, widthPx: 100, heightPx: 100, frameId: 'map', resolutionMPerPixel: .1, originXM: 0, originYM: 0, originYawRad: 0 }, document: { schemaVersion: 1, backgroundColor: '#fff', rotationDegrees: 0, features: [] } });
  return rows([]);
});
const pose = (x, sequence = 1, overrides = {}) => ({ messageType: 'NAVIGATION_POSE', robotId, mapId, mapAssetHash: hash, navigationSessionId: sessionId, initializationRevision: 1, transportSessionId: 'pi', sequenceNo: sequence, capturedAt: new Date().toISOString(), receivedAt: new Date().toISOString(), pose: { xM: x, yM: 2, yawRad: 0 }, ...overrides });
const emit = (kind, value, job = false) => page.evaluate(({ kind, value, job }) => window.emitMonitor(kind, value, job), { kind, value, job });
const robotSnapshotPath = `/api/v1/robots/${robotId}/snapshot`, detailPath = `/api/v1/jobs/${jobId}`;
try {
  await page.goto(base + '/admin/live-operations');
  await expect(page.locator('.rm-current ol li')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.monitorStreams.filter(stream => stream.path.includes('/jobs/') && !stream.closed).length)).toBe(1);
  assert.equal(reads.get(detailPath), 1, 'mission card and explorer share their initial detail request');
  await page.locator('.lo-explorer > summary').click();
  await expect(page.locator('.lo-step')).toHaveCount(1);
  await emit('robot-state', snapshot()); await emit('robot-pose', pose(2));
  await expect(page.locator('.rm-position')).toHaveCount(1);
  const svg = page.locator('.rm-map-canvas > svg');
  await page.getByRole('button', { name: 'Phóng to bản đồ', exact: true }).click();
  const zoom = await svg.getAttribute('viewBox');
  const imageUrl = await svg.locator('image').getAttribute('href');
  await page.evaluate(() => {
    window.savedMapSvg = document.querySelector('.rm-map-canvas > svg');
    window.savedMissionStep = document.querySelector('.rm-current ol li');
    window.monitorBlankFrames = [];
    window.monitorObserver = new MutationObserver(() => {
      if (!document.querySelector('.rm-current ol li') || !document.querySelector('.rm-map-canvas > svg')) window.monitorBlankFrames.push(performance.now());
    });
    window.monitorObserver.observe(document.querySelector('.rm-monitor'), { subtree: true, childList: true });
  });
  for (let n = 2; n < 8; n++) { await emit('robot-pose', pose(2 + n / 10, n)); }
  await expect(page.locator('.rm-position')).toHaveAttribute('transform', /translate\(27 /);
  await emit('robot-pose', pose(8, 1));
  await emit('robot-pose', pose(8, 20, { navigationSessionId: id(9) }));
  await expect(page.locator('.rm-position-stale')).toHaveCount(1);
  await emit('robot-pose', pose(3, 21));
  await expect(page.locator('.rm-position')).toHaveAttribute('transform', /translate\(30 /);
  // Step-only version changes must update both panels without clearing either.
  steps = [{ ...steps[0], rowVersion: 2, status: 'SUCCEEDED' }];
  await emit('job-state', detail(), true);
  await expect(page.locator('.rm-current .is-done')).toHaveCount(1);
  await expect(page.locator('.lo-step-success')).toHaveCount(1);
  assert.equal(reads.get(detailPath), 1, 'streamed step updates do not cause duplicate REST reads');
  detailDelay = 800; snapshotDelay = 250;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.rm-current ol li')).toHaveCount(1);
  await expect.poll(() => reads.get(detailPath)).toBe(2);
  await expect(svg).toHaveAttribute('viewBox', zoom);
  await expect(svg.locator('image')).toHaveAttribute('href', imageUrl);
  assert.equal(await page.evaluate(() => document.querySelector('.rm-map-canvas > svg') === window.savedMapSvg && document.querySelector('.rm-current ol li') === window.savedMissionStep), true);
  await page.waitForTimeout(1000); detailDelay = 0; snapshotDelay = 0;
  // Keep state stream healthy: REST snapshot polling should remain quiet.
  await page.evaluate(value => { window.robotKeepalive = setInterval(() => window.emitMonitor('robot-state', { ...value, observedAt: new Date().toISOString() }), 500); }, snapshot());
  const before = reads.get(robotSnapshotPath);
  await page.waitForTimeout(4500);
  assert.equal(reads.get(robotSnapshotPath), before);
  await expect(page.locator('.rm-position')).toHaveCount(0);
  await expect(page.locator('.rm-position-stale')).toHaveCount(1);
  await expect(page.locator('.rm-map')).toContainText('Vị trí gần nhất lúc');
  await expect(svg).toHaveAttribute('viewBox', zoom);
  await page.evaluate(() => { clearInterval(window.robotKeepalive); const stream = window.monitorStreams.findLast(item => item.path.includes('/robots/') && !item.closed); stream.closed = true; stream.controller.error(Error('stream lost')); });
  await expect.poll(() => reads.get(robotSnapshotPath), { timeout: 10000 }).toBeGreaterThan(before);
  failSnapshot = true;
  await expect(page.locator('.rm-robot-bar')).toContainText('Chờ tín hiệu robot', { timeout: 10000 });
  assert.equal(await page.evaluate(() => { window.monitorObserver.disconnect(); return window.monitorBlankFrames.length; }), 0);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), 1);
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  // The compact row above the map shares the feed and follows BE selection.
  const progress = page.getByRole('region', { name: 'Bước hiện tại trên bản đồ' });
  const nextId = id(6);
  steps.push({ jobStepId: nextId, rowVersion: 1, stepTypeSnapshot: 'HANDLE_PAYLOAD', status: 'PENDING', executionSequenceNo: 2 });
  job = { ...job, rowVersion: 2 };
  await emit('job-state', detail(), true);
  await expect(progress).toContainText('Bước 1');
  await expect(progress.locator('.rm-progress-title')).toHaveText('Di chuyển');
  await expect(progress.locator('.rm-step-status')).toHaveText('✓ Thành công');
  assert.equal(await progress.evaluate(node => node.nextElementSibling.classList.contains('rm-map-canvas')), true, 'detail is immediately above the map');
  const stripBox = await progress.boundingBox(), mapBox = await page.locator('.rm-map-canvas').boundingBox();
  assert.ok(stripBox.height < 90 && stripBox.y + stripBox.height <= mapBox.y + 1, 'horizontal row stays compact and never covers the map');
  await expect(progress.locator('ol, .rm-progress-next')).toHaveCount(0);
  job = { ...job, rowVersion: 3, selectedJobStepId: nextId };
  steps[1] = { ...steps[1], rowVersion: 2, status: 'RUNNING', resolvedInputsJson: { message: 'Chờ nhân viên nhận hàng tại Phòng 03.' } };
  await emit('job-state', detail(), true);
  await expect(progress).toContainText('Bước 2');
  await expect(progress.locator('.rm-step-status')).toHaveText('Chờ xác nhận bước');
  await expect(progress.locator('.rm-progress-title')).toHaveText('Xử lý hàng hóa');
  assert.equal(await page.evaluate(() => window.monitorStreams.filter(stream => stream.path.includes('/jobs/') && !stream.closed).length), 1, 'progress row shares the existing job subscription');
  await mkdir('.workstation-build/mission-progress', { recursive: true });
  await page.locator('.rm-map').screenshot({ path: '.workstation-build/mission-progress/running.png' });
  job = { ...job, rowVersion: 4, status: 'RECOVERY_REQUIRED' };
  steps[1] = { ...steps[1], rowVersion: 3, status: 'FAILED', errorCode: 'ROBOT_OFFLINE' };
  await emit('job-state', detail(), true);
  await expect(progress.locator('.rm-step-status')).toHaveText('Cần xử lý');
  await expect(progress.locator('.rm-progress-title')).toHaveText('Xử lý hàng hóa');
  await expect(progress.locator('.rm-progress-next')).toHaveCount(0);
  // Another server fixture: success remains visible after the active list refresh.
  job = { ...job, rowVersion: 5, status: 'SUCCEEDED', selectedJobStepId: null };
  steps[1] = { ...steps[1], rowVersion: 4, status: 'SUCCEEDED', errorCode: null };
  await emit('job-state', detail(), true);
  await expect(progress).toContainText('Nhiệm vụ đã hoàn thành');
  const beforeFinalRefresh = reads.get(detailPath);
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect.poll(() => reads.get(detailPath)).toBeGreaterThan(beforeFinalRefresh);
  await expect(progress).toContainText('Nhiệm vụ đã hoàn thành');
  await expect(svg).toHaveAttribute('viewBox', zoom);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(progress).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout fits the viewport');
  await page.locator('.rm-map').screenshot({ path: '.workstation-build/mission-progress/mobile.png' });
  // Reload with only historical jobs: the empty state must also render safely.
  await page.reload();
  await expect(progress).toContainText('Chưa có bước đang thực hiện');
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  console.log('PASS: shared state/pose feeds, stable map, progress waits for BE selection, confirmation/failure/success states, retained terminal result after list refresh, mobile and empty state. All APIs mocked; no writes.');
} catch (error) {
  console.error('Live monitor errors:', errors, 'page:', await page.locator('body').innerText().catch(() => 'unavailable')); throw error;
} finally { await browser.close(); }
