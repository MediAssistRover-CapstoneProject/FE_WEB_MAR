import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { localToWorld } from '../src/features/facility/mapPresentation.js';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const source = { mapId: id(1), assetHash: 'a'.repeat(64), widthM: 10, heightM: 6, widthPx: 200, heightPx: 120,
  resolutionMPerPixel: .05, originXM: -2, originYM: 3, originYawRad: .4, frameId: 'map' };
const r = .05, c = Math.cos(.4), s = Math.sin(.4), h = 120;
const metadata = { map_id: id(1), asset_hash: source.assetHash, width_m: 10, height_m: 6, width_px: 200, height_px: 120,
  resolution_m_per_pixel: r, origin_x_m: -2, origin_y_m: 3, origin_yaw_rad: .4, frame_id: 'map',
  pixel_center_to_map: [[r*c, r*s, -2+r*c*.5-r*s*(h-.5)], [r*s, -r*c, 3+r*s*.5+r*c*(h-.5)], [0, 0, 1]] };
const feature = (name, x) => ({ id: name, type: 'LANDMARK', label: name === 'robot-marker' ? 'Vị trí trên bản đã sửa' : 'Điểm đích đã sửa',
  color: '#334155', points: [{ x, y: 2 }], fontSizeM: .15, lineWidthM: .03, endpointId: null });
let published = { source: structuredClone(source), revision: 3, document: { schemaVersion: 1, backgroundColor: '#ffffff',
  rotationDegrees: -20, features: [feature('robot-marker', 4), feature('destination-marker', 7)] } }, presentationStatus = 200;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
const robot = { robotId: id(2), currentMapId: id(1), robotName: 'MAR-01', status: 'BUSY' };
const job = { jobId: id(3), robotId: id(2), status: 'RUNNING', jobCode: 'MAP-TEST', schemaVersion: 3, beOrchestrated: true, inputJson: { endpointId: id(5) } };
const endpoint = { endpointId: id(5), mapId: id(1), ...localToWorld({ x: 7, y: 2 }, source) };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const writes = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'test-only' } })));
await page.route('**/api/v1/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  const list = rows => reply({ content: rows, totalPages: 1, last: true, totalElements: rows.length });
  if (req.method() !== 'GET') { writes.push(path); return reply({}); }
  if (path === '/api/v1/auth/me') return reply({ username: 'admin', role: 'ADMIN' });
  if (path === '/api/v1/maps') return list([{ mapId: id(1), mapName: 'Map đã sửa', status: 'ACTIVE', versionNo: 1 }]);
  if (path.endsWith('/presentation/published')) return reply(presentationStatus === 200 ? published : { message: 'Không có giao diện' }, presentationStatus);
  if (path.endsWith('/image-metadata')) return reply(metadata);
  if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: png });
  if (path === '/api/v1/robots') return list([robot]);
  if (path.endsWith('/snapshot')) return reply({ robot, mqttConnected: true, heartbeatFresh: true, activeJobId: job.jobId,
    selectedJobStepId: id(4), navigationSession: { sessionId: id(6) },
    latestPose: { ...localToWorld({ x: 4, y: 2 }, source), mapId: id(1), jobId: job.jobId, yawRad: .4,
      frameId: 'map', fresh: true, capturedAt: new Date().toISOString(), locationId: id(7) },
    navigationPlan: { mapId: id(1), mapAssetHash: source.assetHash, frameId: 'map', jobId: job.jobId,
      jobStepId: id(4), sessionId: id(6), endpointId: id(5), points: [localToWorld({ x: 4, y: 2 }, source), endpoint] } });
  if (path === '/api/v1/jobs') return list([job]);
  if (path === `/api/v1/jobs/${job.jobId}`) return reply({ job, steps: [] });
  if (path === '/api/v1/endpoints') return list([endpoint]);
  if (path === '/api/v1/workflows/published') return reply([]);
  return list([]);
});

try {
  await page.goto(`${base}/admin/live-operations`);
  const canvas = page.locator('.rm-map-canvas'), svg = canvas.locator('svg');
  await expect(canvas).toHaveAttribute('data-map-view', 'published');
  await expect(canvas.getByText('Vị trí trên bản đã sửa', { exact: true })).toBeVisible();
  await expect(canvas.locator('.rm-position')).toHaveCount(1);
  await expect(canvas.locator('.rm-plan')).toHaveCount(1);
  await expect(canvas.locator('image')).toHaveCount(0);
  const alignment = await canvas.evaluate(node => {
    const at = (selector, x, y) => {
      const el = node.querySelector(selector), p = node.querySelector('svg').createSVGPoint();
      p.x = x; p.y = y; const result = p.matrixTransform(el.getScreenCTM()); return { x: result.x, y: result.y };
    };
    return { robot: at('.rm-position', 0, 0), marker: at('[data-feature-id="robot-marker"]', 4, 4),
      destination: at('.rm-destination', 0, 0), endMarker: at('[data-feature-id="destination-marker"]', 7, 4) };
  });
  for (const [a, b] of [[alignment.robot, alignment.marker], [alignment.destination, alignment.endMarker]]) {
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .01, 'live coordinates must align with edited map features');
  }
  const originalView = await svg.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Phóng to bản đồ', exact: true }).click();
  await expect(svg).not.toHaveAttribute('viewBox', originalView);
  await page.getByRole('button', { name: 'Theo robot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Theo robot', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await mkdir('.workstation-build/monitor-presentation', { recursive: true });
  await canvas.screenshot({ path: '.workstation-build/monitor-presentation/edited-live-map.png' });
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await canvas.screenshot({ path: '.workstation-build/monitor-presentation/mobile-map.png' });
  const refresh = async () => { await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); };
  presentationStatus = 404; await refresh();
  await expect(canvas).toHaveAttribute('data-map-view', 'original');
  await expect(page.locator('.rm-presentation-status')).toContainText('Chưa có giao diện đã áp dụng');
  await expect(canvas.locator('image')).toHaveCount(1);
  await expect(canvas.locator('.rm-position')).toHaveCount(1);
  presentationStatus = 200; published.source.assetHash = 'b'.repeat(64); await refresh();
  await expect(page.locator('.rm-presentation-status')).toContainText('không khớp');
  await expect(canvas).toHaveAttribute('data-map-view', 'original');
  published.source.assetHash = source.assetHash; published.document.features = []; await refresh();
  await expect(canvas).toHaveAttribute('data-map-view', 'published');
  await expect(canvas.locator('image')).toHaveCount(1);
  await expect(canvas.locator('.mp-map-content')).toHaveAttribute('transform', 'rotate(-20 5 3)');
  published.document.features = [feature('robot-marker', 4)]; published.document.rotationDegrees = 90; await refresh();
  await expect(canvas.locator('.mp-map-content')).toHaveAttribute('transform', 'rotate(90 5 3)');
  await expect(svg).toHaveAttribute('viewBox', '2 -2 6 10');
  presentationStatus = 503; await refresh();
  await expect(page.locator('.rm-presentation-status')).toContainText('Chưa tải được giao diện');
  await expect(canvas).toHaveAttribute('data-map-view', 'original');
  assert.deepEqual(writes, [], 'map monitoring must not modify navigation data');
  assert.deepEqual(errors, []);
  console.log('Live edited map passed: rotation, coordinate alignment, follow, zoom, fallback, refresh, mobile and read-only API calls.');
} finally { await browser.close(); }
