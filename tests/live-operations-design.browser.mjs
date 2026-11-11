import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5198';
const output = '.workstation-build/live-operations-design';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1536, height: 1120 } });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const robotId = id(1), mapId = id(2), jobId = id(3), stepId = id(4), workflowId = id(5), hash = 'a'.repeat(64);
const robot = { robotId, robotName: 'MAR-01', robotCode: 'MAR-01', status: 'BUSY', currentMapId: mapId, mapAssetHash: hash, batteryPercent: 82 };
const endpoint = { endpointId: id(6), endpointName: 'Phòng 305', mapId, xM: 7.6, yM: 1.2, active: true, accessible: true };
const job = { jobId, robotId, workflowId, jobCode: 'JOB-20261110-032', status: 'RUNNING', rowVersion: 1, schemaVersion: 3, beOrchestrated: true, selectedJobStepId: stepId, queuedAt: new Date().toISOString(), inputJson: { endpointId: endpoint.endpointId } };
const steps = [
  { jobStepId: id(7), executionSequenceNo: 1, stepCodeSnapshot: 'PICKUP', stepTypeSnapshot: 'HANDLE_PAYLOAD', status: 'SUCCEEDED' },
  { jobStepId: stepId, executionSequenceNo: 2, stepCodeSnapshot: 'MOVE_RECEIVER', stepTypeSnapshot: 'MOVE', status: 'RUNNING', startedAt: new Date().toISOString(), timeoutSecSnapshot: 600, resolvedInputsJson: { endpoint_id: endpoint.endpointId } },
  { jobStepId: id(8), executionSequenceNo: 3, stepCodeSnapshot: 'HANDOVER', stepTypeSnapshot: 'INTERACT', status: 'PENDING' },
];
let connected = true;
const jobs = [job, ...[9, 10].map(n => ({ ...job, jobId: id(n), jobCode: `JOB-QUEUE-${n}`, robotId: null, status: 'QUEUED', priority: n, selectedJobStepId: null })),
  { ...job, jobId: id(11), status: 'RECOVERY_REQUIRED', robotId: id(50) }, { ...job, jobId: id(12), status: 'SUCCEEDED' }];
const writes = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'design-test', fullName: 'Quản trị viên', role: 'ADMIN' }, tokens: { accessToken: 'fixture' } })));
const png = Buffer.from(await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 600;
  const c = canvas.getContext('2d'); c.fillStyle = '#f8fafc'; c.fillRect(0, 0, 1000, 600);
  c.fillStyle = '#fff'; c.fillRect(80, 75, 840, 450);
  c.lineWidth = 5; c.strokeStyle = '#64748b'; c.strokeRect(80, 75, 840, 450);
  const labels = ['Tiếp đón', 'Phòng 301', 'Phòng 302', 'Phòng thuốc', 'Phòng 304', 'Phòng 305'];
  for (let i = 0; i < 6; i++) {
    const x = 80 + i % 3 * 280, y = i < 3 ? 75 : 365;
    c.fillStyle = ['#f0f7ff', '#f4f2fb', '#edf8f5'][i % 3]; c.fillRect(x + 4, y + 4, 272, 152);
    c.strokeRect(x, y, 280, 160); c.fillStyle = '#56708b'; c.textAlign = 'center'; c.font = '19px Arial'; c.fillText(labels[i], x + 140, y + 87);
  }
  c.fillStyle = '#fff'; c.fillRect(84, 237, 832, 124);
  c.fillStyle = '#9aacc1'; c.font = '15px Arial'; c.fillText('HÀNH LANG · TẦNG 3', 500, 308);
  return canvas.toDataURL().split(',')[1];
}), 'base64');
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const reply = (json, status = 200) => route.fulfill({ status, json });
  const list = content => reply({ content, totalElements: content.length, totalPages: 1, last: true });
  if (req.method() !== 'GET') { writes.push(path); return reply({}); }
  if (path.endsWith('/stream')) return reply({ message: 'Use mocked REST' }, 503);
  if (path === '/api/v1/auth/me') return reply({ username: 'design-test', role: 'ADMIN' });
  if (path === '/api/v1/robots') return list([robot]);
  if (path.endsWith('/snapshot')) return reply({ observedAt: new Date().toISOString(), robot, mqttConnected: connected, heartbeatFresh: connected, dispatchReady: connected, activeJobId: jobId, selectedJobStepId: stepId,
    navigationSession: { sessionId: id(13), state: 'READY', mapId, initialization: { revision: 1 } },
    latestPose: { robotId, jobId, mapId, frameId: 'map', fresh: true, xM: 3.1, yM: 3.0, yawRad: 0, capturedAt: new Date().toISOString() },
    navigationPlan: { mapId, mapAssetHash: hash, frameId: 'map', jobId, jobStepId: stepId, sessionId: id(13), initializationRevision: 1, endpointId: endpoint.endpointId, points: [{ xM: 3.1, yM: 3 }, { xM: 7.6, yM: 3 }, endpoint] } });
  if (path === '/api/v1/maps') return list([{ mapId, mapName: 'Khu khám bệnh · Tầng 3', status: 'ACTIVE', versionNo: 2 }]);
  if (path.endsWith('/image-metadata')) return reply({ map_id: mapId, asset_hash: hash, width_m: 10, height_m: 6, width_px: 1000, height_px: 600, resolution_m_per_pixel: .01, origin_x_m: 0, origin_y_m: 0, origin_yaw_rad: 0, frame_id: 'map', pixel_center_to_map: [[.01, 0, .005], [0, -.01, 5.995], [0, 0, 1]] });
  if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: png });
  if (path.endsWith('/presentation/published')) return reply({ message: 'Chưa có giao diện đã áp dụng' }, 404);
  if (path === '/api/v1/jobs') return list(jobs);
  const selected = jobs.find(item => path === `/api/v1/jobs/${item.jobId}`);
  if (selected) return reply({ job: selected, steps: selected.jobId === jobId ? steps : [] });
  if (path === '/api/v1/workflows/published') return reply([{ workflowId, workflowName: 'Giao thuốc đến phòng bệnh' }]);
  if (path === '/api/v1/endpoints') return list([endpoint]);
  return list([]);
});
try {
  await mkdir(output, { recursive: true });
  await page.goto(`${base}/admin/live-operations`);
  await expect(page.locator('.rm-position')).toHaveCount(1);
  await expect(page.locator('.rm-current .rm-mission-title')).toContainText('Giao thuốc');
  await expect(page.locator('.lo-metrics')).toBeVisible();
  await expect(page.locator('.lo-explorer')).not.toHaveAttribute('open', '');
  await expect(page.locator('.lo-metric strong')).toHaveText(['3', '2', '1', '1']);
  const checkMonitorLayout = async width => {
    const map = await page.locator('.rm-map').boundingBox(), mission = await page.locator('.rm-current').boundingBox();
    const queue = await page.locator('.rm-queue').boundingBox(), layout = await page.locator('.rm-layout').boundingBox();
    assert.ok(Math.abs(queue.x - layout.x) <= 1 && Math.abs(queue.width - layout.width) <= 1, 'job queue spans the full monitor width');
    assert.ok(queue.y >= Math.max(map.y + map.height, mission.y + mission.height), 'job queue follows both map and mission');
    if (width > 1000) assert.ok(Math.abs(map.y + map.height - mission.y - mission.height) <= 1, 'mission bottom aligns with the map');
  };
  await checkMonitorLayout(1536);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await checkMonitorLayout(width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `layout fits ${width}px`);
    await page.screenshot({ path: `${output}/${width === 390 ? 'mobile' : 'tablet'}.png`, fullPage: true });
  }

  // A long mission stays bounded and wheel input never chains into the page.
  steps.push(...Array.from({ length: 17 }, (_, index) => ({ jobStepId: id(100 + index), executionSequenceNo: index + 4, stepCodeSnapshot: `MOVE_${index + 4}`, stepTypeSnapshot: 'MOVE', status: 'PENDING' })));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.rm-mission-body li')).toHaveCount(20);
  for (const width of [1536, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const mission = page.locator('.rm-current'), body = mission.locator('.rm-mission-body');
    await mission.scrollIntoViewIfNeeded();
    const cameraBounds = await page.locator('.rm-right .rc-camera-card').boundingBox();
    const missionBounds = await mission.boundingBox();
    assert.ok(cameraBounds.y + cameraBounds.height <= missionBounds.y, 'camera remains above the mission');
    await checkMonitorLayout(width);
    if (width <= 1000) assert.ok(missionBounds.height <= 461, 'long content stays bounded when stacked');
    assert.ok(await body.evaluate(el => el.scrollHeight > el.clientHeight), 'long mission has its own scroll area');
    const headerY = (await mission.locator('header').boundingBox()).y;
    const actionY = (await mission.getByRole('button').boundingBox()).y;
    await body.evaluate(el => { el.scrollTop = 0; });
    await body.hover();
    const pageY = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 180);
    await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    for (const edge of ['bottom', 'top']) {
      await body.evaluate((el, edge) => { el.scrollTop = edge === 'bottom' ? el.scrollHeight : 0; }, edge);
      await page.mouse.wheel(0, edge === 'bottom' ? 600 : -600);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => scrollY), pageY, `page stays still at the ${edge} edge (${width}px)`);
    }
    assert.equal((await mission.locator('header').boundingBox()).y, headerY, 'mission header stays visible');
    assert.equal((await mission.getByRole('button').boundingBox()).y, actionY, 'mission action stays visible');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `long mission fits ${width}px`);
    await page.screenshot({ path: `${output}/long-mission-${width}.png`, fullPage: true });
  }

  await page.locator('.lo-metric-red').click();
  await expect(page.locator('.lo-explorer')).toHaveAttribute('open', '');
  await expect(page.locator('.lo-groups button.is-active')).toContainText('Cần xử lý');
  await page.locator('.lo-explorer > summary').click();
  connected = false;
  await page.setViewportSize({ width: 1536, height: 1120 });
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('.rm-robot-bar')).toHaveClass(/is-disconnected/);
  await expect(page.locator('.rm-position')).toHaveCount(0);
  await expect(page.locator('.rm-robot-telemetry')).toContainText('Chờ tín hiệu robot');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/disconnected.png`, fullPage: true });
  jobs.splice(0, jobs.length);
  await page.reload();
  await expect(page.locator('.rm-mission-empty')).toBeVisible();
  await checkMonitorLayout(1536);
  await page.screenshot({ path: `${output}/empty-mission.png`, fullPage: true });
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  console.log('PASS: overview, metric navigation, responsive 390/1024/1536px, camera above mission, bounded 20-step mission with contained wheel scrolling and fixed header/action, honest disconnected state; all APIs mocked and no mutations.');
} finally {
  await page.screenshot({ path: `${output}/last-state.png`, fullPage: true }).catch(() => {});
  await browser.close();
}
