import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'test-admin' }, tokens: { accessToken: 'fixture' } })));
const page = await context.newPage(), errors = [], writes = [], reads = [];
page.setDefaultTimeout(10000);
page.on('pageerror', error => errors.push(error.message));
const room = (roomId, roomCode, roomName, roomType = 'GENERAL', extra = {}) => ({ roomId, roomCode, roomName, roomType, floorId: 'f1', active: true, publicVisible: false, ...extra });
const rooms = [room('r1', 'ROOM_01', 'Phòng khám'), room('inactive', 'ROOM_02', 'Phòng ngừng dùng', 'GENERAL', { active: false, floorId: 'f2' }), room('r2', 'ROOM_03', 'Trực cũ', 'SOS', { floorId: 'f2', originalName: 'Phòng bệnh', originalType: 'WARD' })];
rooms.push(room('inactive-sos-code', 'SOS_01', 'Phòng giữ mã SOS', 'GENERAL', { active: false, floorId: 'f2' }));
const endpoints = ['p1', 'p2'].map((endpointId, index) => ({ endpointId, mapId: 'm1', roomId: index ? null : 'r1', endpointCode: endpointId.toUpperCase(), endpointName: 'Điểm ' + endpointId, xM: index + 1, yM: 2, yawRad: 0, endpointType: 'WAYPOINT', active: true, accessible: true, publicVisible: false }));
endpoints.push({ ...endpoints[0], endpointId: 'old-point', mapId: 'm2', roomId: 'r2', endpointName: 'Điểm trực', originalName: 'Điểm ban đầu' });
const maps = [{ mapId: 'm1', floorId: 'f1', mapName: 'Map tầng 1', mapCode: 'M1', versionNo: 1, status: 'ACTIVE', widthM: 10, heightM: 6 }, { mapId: 'm2', floorId: 'f2', mapName: 'Map tầng 2', status: 'ACTIVE' }];
const floors = [{ floorId: 'f1', floorName: 'Tầng 1', active: true }, { floorId: 'f2', floorName: 'Tầng 2', active: true }];
const source = { mapId: 'm1', assetHash: 'a'.repeat(64), widthM: 10, heightM: 6, resolutionMPerPixel: .05, originXM: 0, originYM: 0, originYawRad: 0, widthPx: 200, heightPx: 120 };
let configured = 'r2', created = 0, rejectWrite = false, failReadAfterWrite = false, failRead = false;
let entry;
const restore = target => {
  if (!target) return;
  target.roomName = target.originalName || target.roomName;
  target.roomType = target.originalType || (target.roomType === 'SOS' ? 'GENERAL' : target.roomType);
  delete target.originalName; delete target.originalType;
  for (const endpoint of endpoints.filter(endpoint => endpoint.roomId === target.roomId)) {
    if (endpoint.originalName) endpoint.endpointName = endpoint.originalName;
    delete endpoint.originalName;
  }
};
const reconcile = (target, previous) => {
  if (target.roomType === 'SOS' && target.active) {
    if (configured && configured !== target.roomId) restore(rooms.find(room => room.roomId === configured));
    target.originalName ??= previous?.roomName || target.roomName;
    target.originalType ??= previous?.roomType === 'SOS' ? 'GENERAL' : previous?.roomType || 'GENERAL';
    for (const endpoint of endpoints.filter(endpoint => endpoint.roomId === target.roomId)) endpoint.originalName ??= endpoint.endpointName;
    configured = target.roomId;
  } else if (target.originalType) {
    restore(target);
    if (configured === target.roomId) configured = '';
  }
};
await context.route(url => url.pathname.startsWith('/api/'), async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  const json = (value, status = 200) => route.fulfill({ status, json: value });
  const list = rows => json({ content: rows, totalPages: 1, last: true });
  if (method === 'GET') {
    reads.push(path + url.search);
    if (path === '/api/v1/rooms') return failRead ? json({ message: 'Danh mục tạm lỗi' }, 503) : list(rooms);
    if (path === '/api/v1/endpoints') return list(endpoints);
    if (path === '/api/v1/maps') return list(maps);
    if (path === '/api/v1/floors') return list(floors);
    if (path === '/api/v1/admin/system-settings') return list([{ settingKey: 'sos.monitoring-room-id', active: true, settingValue: { value: configured } }]);
    if (path.endsWith('/presentation')) return json(entry);
    if (path.endsWith('/image.png')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#eee"/></svg>' });
    return list([]);
  }
  const body = request.postDataJSON(); writes.push({ path, method, body });
  if (path.startsWith('/api/v1/rooms')) {
    if (rejectWrite) return json({ message: 'Room code already exists' }, 409);
    assert.ok(!Object.hasOwn(body, 'roomId'), 'FE must not generate a room UUID');
    const target = method === 'POST' ? { roomId: `00000000-0000-4000-8000-${String(++created).padStart(12, '0')}` } : rooms.find(room => path.endsWith('/' + room.roomId));
    assert.ok(target); const previous = structuredClone(target);
    Object.assign(target, body);
    if (method === 'POST') rooms.push(target);
    reconcile(target, previous);
    if (failReadAfterWrite) failRead = true;
    return json(target, method === 'POST' ? 201 : 200);
  }
  if (path.includes('/presentation')) {
    assert.equal(body.expectedRevision, entry.revision);
    entry = structuredClone(entry); entry.revision++;
    if (method === 'PUT') entry.draft = body.document;
    else if (path.endsWith('/publish')) {
      for (const feature of entry.draft.features.filter(feature => feature.type === 'ROOM')) {
        let target = rooms.find(room => room.roomId === feature.roomId);
        const previous = target ? structuredClone(target) : null;
        if (!target) { target = room(`map-created-${++created}`, feature.roomCode, feature.roomName); rooms.push(target); }
        Object.assign(target, { roomCode: feature.roomCode, roomName: feature.roomName, roomType: feature.roomType, active: true });
        reconcile(target, previous);
        Object.assign(feature, { roomId: target.roomId, roomName: target.roomName, roomType: target.roomType });
        endpoints.find(endpoint => endpoint.endpointId === feature.endpointId).roomId = target.roomId;
      }
      entry.published = structuredClone(entry.draft); entry.publishedRevision = entry.revision;
      if (failReadAfterWrite) failRead = true;
    }
    return json(entry);
  }
  throw Error('Unexpected mutation ' + path);
});

const detail = page.getByRole('article', { name: 'Chi tiết phòng', exact: true });
const edit = async name => {
  await page.getByRole('complementary', { name: 'Danh sách phòng quản trị' }).getByRole('button', { name: new RegExp(name) }).click();
  await detail.getByRole('button', { name: 'Chỉnh sửa phòng', exact: true }).click();
  return detail.getByRole('form', { name: 'Chỉnh sửa thông tin phòng', exact: true });
};
const saveEdit = async form => {
  await form.getByRole('button', { name: 'Lưu thông tin phòng', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Chỉnh sửa phòng', exact: true })).toBeEnabled();
};
await mkdir('.workstation-build/room-sos', { recursive: true });
try {
  await page.goto(base + '/admin/facility?tab=rooms');
  await page.getByRole('button', { name: 'Thêm phòng', exact: true }).click();
  let form = page.getByRole('form', { name: 'Tạo phòng mới', exact: true });
  await expect(form.getByLabel('Mã phòng', { exact: true })).toHaveValue('ROOM_04');
  await expect(form.getByLabel('Loại phòng', { exact: true })).toHaveValue('GENERAL');
  await form.getByLabel('Tên phòng', { exact: true }).fill('Trực mới');
  await form.getByLabel('Mã phòng', { exact: true }).fill('room_02');
  await form.getByRole('button', { name: 'Lưu phòng mới' }).click();
  await expect(page.getByRole('alert')).toContainText('Mã phòng đã được sử dụng');
  assert.equal(writes.length, 0);
  await form.getByLabel('Mã phòng', { exact: true }).fill('ROOM_04');
  await form.getByLabel('Loại phòng', { exact: true }).selectOption('SOS');
  await expect(form.getByLabel('Mã phòng', { exact: true })).toHaveValue('SOS_02');
  await form.getByLabel('Phòng hoạt động', { exact: true }).uncheck();
  await form.getByRole('button', { name: 'Lưu phòng mới' }).click();
  await expect(page.getByRole('alert')).toContainText('Bật Phòng hoạt động');
  assert.equal(writes.length, 0);
  await form.getByLabel('Phòng hoạt động', { exact: true }).check();
  rejectWrite = true;
  await form.getByRole('button', { name: 'Lưu phòng mới' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 409');
  await expect(form.getByLabel('Tên phòng', { exact: true })).toHaveValue('Trực mới');
  rejectWrite = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.workstation-build/room-sos/create-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
  await expect(form).toHaveCount(0);
  await expect(detail.getByRole('heading', { name: 'Trực mới', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm phòng', exact: true })).toBeEnabled();
  assert.equal(writes.length, 2); assert.equal(created, 1);
  assert.equal(writes.at(-1).body.roomCode, 'SOS_02');
  assert.equal(configured, rooms.find(room => room.roomName === 'Trực mới').roomId);
  assert.equal(rooms.find(room => room.roomId === 'r2').roomType, 'WARD');
  assert.equal(endpoints.find(endpoint => endpoint.endpointId === 'old-point').endpointName, 'Điểm ban đầu');
  await expect(page.getByRole('complementary', { name: 'Danh sách phòng quản trị' })).toContainText('Phòng bệnh');

  form = await edit('Phòng khám');
  await form.getByLabel('Loại phòng', { exact: true }).selectOption('SOS');
  await form.getByText('Thiết lập nâng cao', { exact: true }).click();
  await expect(form.getByLabel('Mã phòng', { exact: true })).toHaveValue('SOS_03');
  rejectWrite = true;
  await form.getByRole('button', { name: 'Lưu thông tin phòng', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 409');
  await expect(form.getByLabel('Loại phòng', { exact: true })).toHaveValue('SOS');
  rejectWrite = false; await saveEdit(form);
  assert.equal(configured, 'r1');
  assert.equal(rooms.find(room => room.roomId === 'r1').roomCode, 'SOS_03');
  assert.equal(rooms.find(room => room.roomName === 'Trực mới').roomType, 'GENERAL');

  form = await edit('Phòng khám');
  await form.getByLabel('Loại phòng', { exact: true }).selectOption('PHARMACY');
  await expect(form.getByRole('note')).toContainText('khôi phục');
  await saveEdit(form);
  assert.equal(configured, '');
  assert.equal(rooms.find(room => room.roomId === 'r1').roomType, 'GENERAL');
  await expect(detail).toContainText('Phòng chung');
  form = await edit('Phòng khám');
  await form.getByLabel('Loại phòng', { exact: true }).selectOption('SOS'); await saveEdit(form);
  form = await edit('Phòng khám');
  await form.getByLabel('Phòng hoạt động', { exact: true }).uncheck(); await saveEdit(form);
  assert.equal(configured, ''); assert.equal(rooms.find(room => room.roomId === 'r1').active, false);

  await page.getByRole('button', { name: 'Thêm phòng', exact: true }).click();
  form = page.getByRole('form', { name: 'Tạo phòng mới', exact: true });
  await form.getByLabel('Tên phòng', { exact: true }).fill('Trực sau lỗi');
  await form.getByLabel('Loại phòng', { exact: true }).selectOption('SOS');
  failReadAfterWrite = true;
  await form.getByRole('button', { name: 'Lưu phòng mới' }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu, chưa tải lại được dữ liệu');
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thêm phòng', exact: true })).toBeDisabled();
  const writesAfterFailure = writes.length;
  failRead = false; failReadAfterWrite = false;
  await page.getByRole('button', { name: 'Tải lại phòng', exact: true }).click();
  await expect(detail.getByRole('heading', { name: 'Trực sau lỗi', exact: true })).toBeVisible();
  assert.equal(writes.length, writesAfterFailure);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.workstation-build/room-sos/rooms-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto(base + '/admin/system-settings');
  const sosCard = page.getByRole('region', { name: 'Phòng tiếp nhận SOS', exact: true });
  await expect(sosCard).toContainText('Trực sau lỗi');
  await expect(sosCard.getByRole('combobox')).toHaveCount(0);
  floors[0].active = false; await page.reload(); await expect(sosCard).toContainText('không còn khả dụng');
  floors[0].active = true;
  configured = 'missing'; await page.reload(); await expect(sosCard).toContainText('không còn khả dụng');
  configured = ''; await page.reload(); await expect(sosCard).toContainText('Chưa cấu hình');
  assert.ok(!writes.some(write => write.path.includes('/system-settings')));

  // Map changes remain drafts until publish. A different-map SOS is restored by BE.
  const target = rooms.find(room => room.roomId === 'r1'); target.active = true;
  const prior = rooms.find(room => room.roomId === 'r2'); prior.roomType = 'SOS'; prior.originalType = 'WARD'; configured = 'r2';
  const feature = (id, roomId, code, name, endpointId, x) => ({ id, type: 'ROOM', roomId, roomCode: code, roomName: name, label: name, roomType: 'GENERAL', endpointId, roomPublicVisible: false, color: '#3b82f6', lineWidthM: .02, fontSizeM: .2, points: [{ x, y: 1 }, { x: x + 2, y: 1 }, { x: x + 2, y: 3 }, { x, y: 3 }] });
  entry = { source, revision: 1, sourceChanged: false, draft: { schemaVersion: 1, features: [feature('a', 'r1', 'ROOM_01', 'Phòng khám', 'p1', 1), feature('b', null, 'ROOM_06', 'Phòng trên map', 'p2', 5)] }, published: null };
  await page.goto(base + '/admin/map?mapId=m1&stage=presentation');
  await page.locator('.mp-layers button').filter({ hasText: 'Phòng khám' }).click();
  await page.getByRole('combobox', { name: /^Loại phòng/ }).selectOption('SOS');
  await expect(page.getByRole('textbox', { name: /^Mã phòng/ })).toHaveValue('SOS_03');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu bản nháp');
  assert.equal(configured, 'r2');
  await page.locator('.mp-layers button').filter({ hasText: 'Phòng trên map' }).click();
  await page.getByRole('combobox', { name: /^Loại phòng/ }).selectOption('SOS');
  await expect(page.getByRole('combobox', { name: /^Loại phòng/ })).toHaveValue('GENERAL');
  await expect(page.getByRole('status')).toContainText('một phòng SOS');
  await page.locator('.mp-layers button').filter({ hasText: 'Phòng khám' }).click();
  await page.getByRole('button', { name: '⧉ Nhân bản', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /^Loại phòng/ })).toHaveValue('GENERAL');
  await expect(page.getByRole('combobox', { name: /^Phòng trong database/ })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: /^Endpoint của phòng/ })).toHaveValue('');
  await page.getByRole('button', { name: /Xóa Del/ }).click();
  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã áp dụng bản đồ');
  assert.equal(configured, 'r1'); assert.equal(prior.roomType, 'WARD');
  assert.equal(target.roomCode, 'SOS_03');
  assert.ok(entry.draft.features.find(feature => feature.id === 'b').roomId?.startsWith('map-created-'));
  // Publishing another SOS and then failing the refresh must not reapply on retry.
  await page.locator('.mp-layers button').filter({ hasText: 'Phòng khám' }).click();
  await page.getByRole('combobox', { name: /^Loại phòng/ }).selectOption('GENERAL');
  await page.locator('.mp-layers button').filter({ hasText: 'Phòng trên map' }).click();
  await page.getByRole('combobox', { name: /^Loại phòng/ }).selectOption('SOS');
  failReadAfterWrite = true;
  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã áp dụng, chưa tải lại được dữ liệu');
  const mapWrites = writes.length;
  await page.getByRole('button', { name: 'Áp dụng bản đồ', exact: true }).click();
  assert.equal(writes.length, mapWrites);
  await page.screenshot({ path: '.workstation-build/room-sos/map-desktop.png', fullPage: true });
  assert.ok(reads.some(path => path.includes('/rooms?') && path.includes('includeDeleted=true')));
  assert.deepEqual(errors, []);
  console.log('PASS: SOS creation/transfer/restoration/deactivation, duplicate submits/codes, save vs refresh failures, settings read-only, Map draft/publish/duplicate/one-SOS and mobile layout. All API requests mocked.');
} catch (error) {
  console.error(page.url(), errors, (await page.locator('body').innerText()).slice(-4500));
  await page.screenshot({ path: '.workstation-build/room-sos/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
