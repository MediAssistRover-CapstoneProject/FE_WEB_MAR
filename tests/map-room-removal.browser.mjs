import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5191';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'test-admin' }, tokens: { accessToken: 'fixture' } })));
const errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
const maps = [{ mapId: 'm1', mapCode: 'M1', mapName: 'Bản đồ tầng 1', floorId: 'f1', versionNo: 1, status: 'ACTIVE' }];
const source = { mapId: 'm1', assetHash: 'a'.repeat(64), widthM: 10, heightM: 6, resolutionMPerPixel: .05, originXM: 0, originYM: 0, originYawRad: 0, widthPx: 200, heightPx: 120 };
const rooms = [
  { roomId: 'r5', floorId: 'f1', roomCode: 'SOS_01', roomName: 'Phòng 05', roomType: 'SOS', active: true, publicVisible: true },
  { roomId: 'shared', floorId: 'f1', roomCode: 'ROOM_06', roomName: 'Phòng dùng chung', roomType: 'GENERAL', active: true, publicVisible: true },
];
const point = (id, roomId, mapId = 'm1') => ({ endpointId: id, mapId, roomId, endpointCode: id.toUpperCase(), endpointName: 'Điểm ' + id, endpointType: 'WAYPOINT', xM: 2, yM: 2, yawRad: 0, active: true, accessible: true, publicVisible: true });
const points = [point('p5', 'r5'), point('p6', 'shared'), point('p6-other-map', 'shared', 'm2')];
const shape = (room, pointId, x) => ({ id: 'shape-' + room.roomId, type: 'ROOM', roomId: room.roomId, roomCode: room.roomCode, roomName: room.roomName, label: room.roomName, roomType: room.roomType, roomPublicVisible: true, endpointId: pointId, color: '#3b82f6', fontSizeM: .2, lineWidthM: .02, points: [{ x, y: 1 }, { x: x + 2, y: 1 }, { x: x + 2, y: 3 }, { x, y: 3 }] });
const initial = { schemaVersion: 1, backgroundColor: '#ffffff', features: [shape(rooms[0], 'p5', 1), shape(rooms[1], 'p6', 5)] };
let entry = { source, revision: 1, draft: structuredClone(initial), published: structuredClone(initial), publishedRevision: 1, sourceChanged: false };
let configured = 'r5', failPublish = false;
await page.route(url => url.pathname.startsWith('/api/'), async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  const json = (value, status = 200) => route.fulfill({ status, json: value });
  const list = value => json({ content: value, totalPages: 1, last: true });
  if (method === 'GET') {
    if (path === '/api/v1/maps') return list(maps);
    if (path === '/api/v1/rooms') return list(url.searchParams.get('includeDeleted') === 'true' ? rooms : rooms.filter(room => room.active));
    if (path === '/api/v1/endpoints') return list(url.searchParams.get('includeDeleted') === 'true' ? points : points.filter(point => point.active));
    if (path === '/api/v1/floors') return list([{ floorId: 'f1', floorName: 'Tầng 1', active: true }]);
    if (path === '/api/v1/admin/system-settings') return list([{ settingKey: 'sos.monitoring-room-id', active: true, settingValue: { value: configured } }]);
    if (path.endsWith('/presentation')) return json(entry);
    if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#eee"/></svg>' });
    return list([]);
  }
  assert.ok(path.includes('/presentation'), 'The UI must publish atomically, not separately delete/deactivate rooms or endpoints');
  const body = request.postDataJSON(); writes.push({ path, method, body });
  if (body.expectedRevision !== entry.revision || failPublish && method === 'POST') return json({ message: 'Bản vẽ đã thay đổi ở phiên khác' }, 409);
  entry = structuredClone(entry); entry.revision++;
  if (method === 'PUT') entry.draft = body.document;
  else if (path.endsWith('/publish')) {
    const retained = new Set(entry.draft.features.filter(feature => feature.type === 'ROOM').map(feature => feature.roomId));
    for (const feature of entry.published?.features || []) {
      if (feature.type !== 'ROOM' || !feature.roomId || retained.has(feature.roomId)) continue;
      const linked = points.filter(point => point.roomId === feature.roomId);
      const usedElsewhere = linked.some(point => point.mapId !== 'm1' && point.active);
      for (const point of linked.filter(point => point.mapId === 'm1')) point.active = false;
      if (!usedElsewhere) {
        rooms.find(room => room.roomId === feature.roomId).active = false;
        if (configured === feature.roomId) configured = '';
      }
    }
    entry.published = structuredClone(entry.draft); entry.publishedRevision = entry.revision;
  }
  return json(entry);
});
const layers = page.locator('.mp-layers button');
const retirementNote = page.getByRole('note').filter({ hasText: 'phòng bị xóa khỏi bản vẽ' });
const apply = page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true });
await mkdir('.workstation-build/map-room-removal', { recursive: true });
try {
  await page.goto(base + '/admin/map?mapId=m1&stage=presentation');
  await layers.filter({ hasText: 'Phòng 05' }).click();
  page.once('dialog', dialog => { assert.match(dialog.message(), /ngừng hoạt động/); return dialog.dismiss(); });
  await page.getByRole('button', { name: /^Xóa/ }).click();
  await expect(layers.filter({ hasText: 'Phòng 05' })).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /^Xóa/ }).click();
  await expect(retirementNote).toContainText('Phòng 05');
  assert.equal(writes.length, 0); assert.equal(rooms[0].active, true); assert.equal(configured, 'r5');
  await page.getByRole('button', { name: '↶ Hoàn tác', exact: true }).click();
  await expect(retirementNote).toHaveCount(0);
  await expect(layers.filter({ hasText: 'Phòng 05' })).toHaveCount(1);
  await page.getByRole('button', { name: '↷ Làm lại', exact: true }).click();
  await expect(retirementNote).toContainText('Phòng 05');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu bản nháp');
  assert.equal(rooms[0].active, true); assert.equal(points[0].active, true); assert.equal(configured, 'r5');
  await page.reload(); await expect(retirementNote).toContainText('Phòng 05');
  failPublish = true; await apply.click();
  await expect(page.getByRole('alert')).toContainText('phiên khác');
  assert.equal(rooms[0].active, true); assert.equal(points[0].active, true);
  failPublish = false; await apply.click();
  await expect(page.getByRole('status')).toContainText('Đã áp dụng bản đồ');
  await expect(retirementNote).toHaveCount(0);
  assert.equal(rooms[0].active, false); assert.equal(points[0].active, false); assert.equal(configured, '');
  await page.goto(base + '/admin/facility?tab=rooms');
  const list = page.getByRole('complementary', { name: 'Danh sách phòng quản trị' });
  await expect(list.getByRole('button', { name: /Phòng 05/ })).toContainText('Ngừng hoạt động');
  await page.getByLabel('Lọc trạng thái phòng').selectOption('active');
  await expect(list.getByRole('button', { name: /Phòng 05/ })).toHaveCount(0);
  await page.getByLabel('Lọc trạng thái phòng').selectOption('inactive');
  await expect(list.getByRole('button', { name: /Phòng 05/ })).toHaveCount(1);
  await page.screenshot({ path: '.workstation-build/map-room-removal/catalog.png', fullPage: true });
  await page.goto(base + '/admin/map?mapId=m1&stage=presentation');
  await layers.filter({ hasText: 'Phòng dùng chung' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /^Xóa/ }).click();
  await apply.click();
  await expect(page.getByRole('status')).toContainText('Đã áp dụng bản đồ');
  assert.equal(entry.published.features.length, 0, 'Removing the last room is publishable');
  assert.equal(rooms[1].active, true, 'Another-map endpoint preserves the shared room');
  assert.equal(points[1].active, false); assert.equal(points[2].active, true);
  assert.ok(writes.every(write => write.path.includes('/presentation')));
  assert.deepEqual(errors, []);
  console.log('PASS: delete confirmation/cancel, undo/redo, draft/reload isolation, failed publish, retirement on apply, SOS release, inactive catalog/filter, shared room protection and removal of last room. All API requests mocked.');
} catch (error) {
  console.error(page.url(), errors, (await page.locator('body').innerText()).slice(-4000));
  await page.screenshot({ path: '.workstation-build/map-room-removal/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
