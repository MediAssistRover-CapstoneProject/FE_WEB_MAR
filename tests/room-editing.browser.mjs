import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ tokens: { accessToken: 'test-token' }, account: { accountId: 'admin', role: 'ADMIN', fullName: 'Quản trị viên thử nghiệm' } })));
const page = await context.newPage(), errors = [], writes = [], reads = [];
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
const map = { mapId: 'm1', floorId: 'f1', mapName: 'Bản đồ tầng 1', mapCode: 'M1', versionNo: 1, status: 'ACTIVE', widthM: 20, heightM: 10, resolutionMPerPixel: .05, originXM: 0, originYM: 0, originYawRad: 0 };
const room = { roomId: 'r1', floorId: 'f1', roomCode: 'ROOM_01', roomName: 'Phòng khám Nội', roomType: 'EXAMINATION', departmentCode: 'INTERNAL_MEDICINE', description: 'Khám nội tổng quát', defaultEndpointGroupId: 'g1', active: true, publicVisible: true };
const point = (id, roomId, mapId = 'm1') => ({ endpointId: id, mapId, roomId, zoneId: null, endpointCode: id.toUpperCase(), endpointName: 'Điểm ' + id, endpointType: 'WAYPOINT', xM: 2, yM: 3, yawRad: .25, active: true, accessible: true, publicVisible: true, description: 'Mô tả điểm' });
const state = {
  rooms: [room, ...Array.from({ length: 99 }, (_, i) => ({ ...room, roomId: 'other-' + i, floorId: 'f2', roomCode: 'OTHER_' + i, roomName: 'Phòng tầng khác ' + i })), { ...room, roomId: 'r2', roomCode: 'ROOM_02', roomName: 'Kho dược nội bộ', roomType: 'PHARMACY', defaultEndpointGroupId: null, active: false, publicVisible: false }],
  endpoints: [...Array.from({ length: 100 }, (_, i) => point('foreign-' + i, null, 'm2')), point('p1', 'r1'), point('p2', null), point('p3', 'other-1'), point('p4', null), { ...point('p5', null), active: false }],
  maps: [map, { ...map, mapId: 'm2', floorId: 'f2', mapName: 'Bản đồ tầng 2' }],
  floors: [{ floorId: 'f1', floorName: 'Tầng 1', floorCode: 'T1', active: true }, { floorId: 'f2', floorName: 'Tầng 2', floorCode: 'T2', active: true }],
  'endpoint-groups': [{ endpointGroupId: 'g1', mapId: 'm1', groupName: 'Nhóm nhận hàng', active: true }],
  zones: [{ zoneId: 'z1', mapId: 'm1', zoneName: 'Khu cửa phòng', active: true }, { zoneId: 'z2', mapId: 'm2', zoneName: 'Vùng tầng khác', active: true }], 'hospital-information': [],
};
let rejectRoom = false, rejectPoint = false, rejectDetach = false, knownFree = true, failRead = false;
let roomReadGate = null;
await context.route(url => url.pathname.startsWith('/api/'), async route => {
  const req = route.request(), url = new URL(req.url()), parts = url.pathname.split('/').filter(Boolean), resource = parts[2], method = req.method();
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (method === 'GET') {
    reads.push(url.pathname + url.search);
    if (resource === 'rooms' && roomReadGate) await roomReadGate;
    if (resource === 'rooms' && failRead) return reply({ message: 'Danh mục tạm thời không khả dụng' }, 503);
    if (url.pathname.endsWith('/image-metadata')) return reply({ map_id: parts[3], width_px: 400, height_px: 200, resolution_m_per_pixel: .05, origin_x_m: 0, origin_y_m: 0, origin_yaw_rad: 0, navigation_reload_safe: true });
    if (url.pathname.endsWith('/image.png')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64') });
    const rows = state[resource] || [], page = Number(url.searchParams.get('page') || 0), size = Number(url.searchParams.get('size') || 100);
    return reply({ content: rows.slice(page * size, (page + 1) * size), totalPages: Math.ceil(rows.length / size), last: (page + 1) * size >= rows.length });
  }
  const body = req.postDataJSON(); writes.push({ path: url.pathname, method, body });
  if (parts[4] === 'validate-navigation-point') return reply({ mapId: parts[3], knownFree });
  if (resource === 'rooms') {
    if (rejectRoom) return reply({ message: 'Room code already exists' }, 409);
    const result = { ...body, roomId: parts[3] }; state.rooms = state.rooms.map(room => room.roomId === result.roomId ? result : room); return reply(result);
  }
  if (resource === 'endpoints') {
    if (rejectPoint || (rejectDetach && body.roomId === null)) return reply({ message: 'Không thể lưu điểm lúc này' }, 503);
    if (['activate', 'deactivate'].includes(parts[4])) {
      assert.equal(method, 'POST'); assert.ok(body.reason?.length >= 5);
      const result = { ...state.endpoints.find(point => point.endpointId === parts[3]), active: parts[4] === 'activate' };
      state.endpoints = state.endpoints.map(point => point.endpointId === result.endpointId ? result : point);
      return reply(result);
    }
    const result = { ...body, endpointId: parts[3] }; state.endpoints = state.endpoints.map(point => point.endpointId === result.endpointId ? result : point); return reply(result);
  }
  throw Error('Unexpected write ' + url.pathname);
});

await mkdir('.workstation-build/rooms', { recursive: true });
const detail = page.getByRole('article', { name: 'Chi tiết phòng', exact: true });
const roomList = page.getByRole('complementary', { name: 'Danh sách phòng quản trị' });
try {
  let releaseRooms;
  roomReadGate = new Promise(resolve => { releaseRooms = resolve; });
  await page.goto((process.env.TEST_URL || 'http://localhost:5173') + '/admin/facility');
  const roomBadge = page.getByRole('button', { name: /Danh sách phòng/ }).locator('span');
  await expect(roomBadge).toHaveText('…');
  assert.ok(!reads.some(path => path.startsWith('/api/v1/endpoints')), 'Summary loads without opening the endpoint editor');
  releaseRooms(); roomReadGate = null;
  await expect(roomBadge).toHaveText('101');
  await page.getByRole('button', { name: /Danh sách tầng/ }).click();
  await expect(roomBadge).toHaveText('101');
  roomReadGate = new Promise(resolve => { releaseRooms = resolve; });
  await page.getByRole('button', { name: /Danh sách phòng/ }).click();
  await page.getByRole('status').filter({ hasText: 'Đang tải phòng và điểm đến' }).waitFor();
  await expect(roomBadge).toHaveText('101');
  releaseRooms(); roomReadGate = null;
  await detail.getByRole('heading', { name: 'Phòng khám Nội', exact: true }).waitFor();
  assert.deepEqual(errors, []); assert.equal(writes.length, 0);
  assert.ok(reads.some(path => path.includes('rooms?') && path.includes('page=1')));
  assert.ok(reads.some(path => path.includes('endpoints?') && path.includes('page=1')));
  assert.ok(reads.some(path => path.includes('rooms?') && path.includes('includeDeleted=true')));
  await page.getByLabel('Lọc tầng', { exact: true }).selectOption('f1');
  assert.equal(await roomList.locator('.lo-job-item').count(), 2);
  await roomList.getByRole('button', { name: /Kho dược nội bộ/ }).waitFor();
  await page.getByLabel('Lọc trạng thái phòng').selectOption('unlinked');
  assert.equal(await roomList.locator('.lo-job-item').count(), 1);
  await page.getByLabel('Lọc trạng thái phòng').selectOption('');

  // The real room and Map routes expose the same endpoint field definitions.
  await detail.getByRole('button', { name: 'Chỉnh sửa điểm', exact: true }).click();
  const fields = root => root.locator('.ep-fields').locator('input,select').evaluateAll(elements => elements.map(element => ({
    name: element.getAttribute('aria-label') || element.closest('label')?.textContent.trim(), type: element.type, required: element.required,
  })));
  const roomFields = await fields(detail);
  await detail.getByText('Cài đặt điểm và liên kết', { exact: true }).click();
  assert.equal(await detail.getByLabel('Phòng liên kết', { exact: true }).isDisabled(), true);
  assert.equal(await detail.getByLabel('Phòng liên kết', { exact: true }).inputValue(), 'r1');
  assert.equal(await detail.getByLabel('Vùng liên kết', { exact: true }).locator('option[value="z2"]').count(), 0);
  const mapPage = await context.newPage();
  mapPage.on('pageerror', error => errors.push(error.message));
  await mapPage.goto((process.env.TEST_URL || 'http://localhost:5173') + '/admin/map?mapId=m1&stage=endpoint');
  await mapPage.getByLabel('Điểm đã lưu', { exact: true }).selectOption('p1');
  assert.deepEqual(await fields(mapPage), roomFields, 'Both edit screens share labels, field types and required constraints');
  await mapPage.close();
  await detail.getByRole('form', { name: 'Chỉnh sửa điểm đến' }).getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();

  await detail.getByRole('button', { name: 'Chỉnh sửa phòng', exact: true }).click();
  const form = detail.getByRole('form', { name: 'Chỉnh sửa thông tin phòng' });
  await form.getByLabel('Tên phòng', { exact: true }).fill('Phòng Nội tổng hợp');
  await form.getByLabel('Loại phòng', { exact: true }).selectOption('GENERAL');
  await form.getByLabel('Khoa phụ trách').selectOption('CARDIOLOGY');
  await form.getByLabel('Mô tả phòng').fill('Nhận hàng tại cửa chính.');
  await form.getByLabel('Công khai cho người dùng tra cứu').uncheck();
  page.once('dialog', dialog => dialog.dismiss());
  await roomList.getByRole('button', { name: /Kho dược nội bộ/ }).click();
  assert.equal(await form.getByLabel('Tên phòng', { exact: true }).inputValue(), 'Phòng Nội tổng hợp');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /Danh sách tầng/ }).click();
  assert.equal(await form.isVisible(), true);
  rejectRoom = true;
  await form.getByRole('button', { name: 'Lưu thông tin phòng' }).click();
  await page.getByRole('alert').filter({ hasText: 'HTTP 409' }).waitFor();
  assert.equal(await form.getByLabel('Tên phòng', { exact: true }).inputValue(), 'Phòng Nội tổng hợp');
  rejectRoom = false;
  await form.getByRole('button', { name: 'Lưu thông tin phòng' }).click();
  await detail.getByRole('heading', { name: 'Phòng Nội tổng hợp', exact: true }).waitFor();
  const savedRoom = state.rooms.find(room => room.roomId === 'r1');
  assert.equal(savedRoom.defaultEndpointGroupId, 'g1'); assert.equal(savedRoom.floorId, 'f1');
  assert.equal(savedRoom.publicVisible, false); assert.equal(savedRoom.roomType, 'GENERAL');

  await detail.getByRole('button', { name: 'Chỉnh sửa điểm', exact: true }).click();
  const pointForm = detail.getByRole('form', { name: 'Chỉnh sửa điểm đến' });
  const lifecycle = detail.getByRole('region', { name: 'Trạng thái điểm đích' });
  rejectPoint = true;
  await lifecycle.getByRole('button', { name: 'Ngừng sử dụng điểm', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'HTTP 503' }).waitFor();
  assert.equal(state.endpoints.find(point => point.endpointId === 'p1').active, true);
  rejectPoint = false;
  await lifecycle.getByRole('button', { name: 'Ngừng sử dụng điểm', exact: true }).click();
  await lifecycle.getByRole('button', { name: 'Kích hoạt lại điểm', exact: true }).waitFor();
  assert.equal(state.endpoints.find(point => point.endpointId === 'p1').active, false);
  await lifecycle.getByRole('button', { name: 'Kích hoạt lại điểm', exact: true }).click();
  await lifecycle.getByRole('button', { name: 'Ngừng sử dụng điểm', exact: true }).waitFor();
  await pointForm.getByLabel('Tên điểm', { exact: true }).fill('Cửa chính phòng Nội');
  assert.equal(await lifecycle.getByRole('button', { name: 'Ngừng sử dụng điểm', exact: true }).isDisabled(), true);
  await pointForm.getByText('Cài đặt điểm và liên kết', { exact: true }).click();
  await pointForm.getByLabel('Vùng liên kết', { exact: true }).selectOption('z1');
  await pointForm.getByLabel('Mô tả', { exact: true }).fill('Nhận hàng ở cửa chính.');
  knownFree = false;
  const before = writes.filter(write => write.method === 'PUT' && write.path.includes('/endpoints/')).length;
  await pointForm.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'chưa xác nhận' }).waitFor();
  assert.equal(writes.filter(write => write.method === 'PUT' && write.path.includes('/endpoints/')).length, before);
  knownFree = true; rejectPoint = true;
  await pointForm.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'HTTP 503' }).waitFor();
  assert.equal(await pointForm.getByLabel('Tên điểm', { exact: true }).inputValue(), 'Cửa chính phòng Nội');
  rejectPoint = false;
  await pointForm.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await detail.locator('.rw-point-card strong').filter({ hasText: 'Cửa chính phòng Nội' }).waitFor();
  const savedPoint = state.endpoints.find(point => point.endpointId === 'p1');
  assert.equal(savedPoint.xM, 2); assert.equal(savedPoint.yM, 3); assert.equal(savedPoint.yawRad, .25); assert.equal(savedPoint.roomId, 'r1');
  assert.equal(savedPoint.zoneId, 'z1'); assert.equal(savedPoint.description, 'Nhận hàng ở cửa chính.');

  await detail.getByRole('button', { name: 'Đổi sang điểm khác' }).click();
  const linkForm = detail.getByRole('form', { name: 'Chọn điểm cho phòng' });
  const select = linkForm.getByLabel('Chọn endpoint mới');
  assert.equal(await select.locator('option[value="p3"]').evaluate(option => option.disabled), true);
  assert.equal(await select.locator('option[value="p5"]').evaluate(option => option.disabled), true);
  assert.equal(await select.locator('option[value^="foreign"]').count(), 0);
  await select.selectOption('p2');
  await linkForm.getByRole('button', { name: 'Lưu liên kết điểm' }).click();
  await detail.locator('.rw-point-card strong').filter({ hasText: 'Điểm p2' }).waitFor();
  assert.equal(state.endpoints.find(point => point.endpointId === 'p1').roomId, null);
  assert.equal(state.endpoints.find(point => point.endpointId === 'p2').roomId, 'r1');

  // Partial replacement keeps the successful attach visible and reports the failed detach.
  await detail.getByRole('button', { name: 'Đổi sang điểm khác' }).click();
  await select.selectOption('p4'); rejectDetach = true;
  await linkForm.getByRole('button', { name: 'Lưu liên kết điểm' }).click();
  await page.getByRole('alert').filter({ hasText: 'Đã gắn điểm' }).waitFor();
  assert.equal(state.endpoints.find(point => point.endpointId === 'p4').roomId, 'r1');
  assert.equal(state.endpoints.find(point => point.endpointId === 'p2').roomId, 'r1');
  rejectDetach = false;
  await detail.getByRole('button', { name: 'Bỏ liên kết', exact: true }).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await detail.getByRole('button', { name: 'Bỏ liên kết', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Đã bỏ liên kết' }).waitFor();
  assert.equal(state.endpoints.find(point => point.endpointId === 'p4').roomId, null);

  // An inactive, private, unlinked room is still editable and can be reactivated.
  await roomList.getByRole('button', { name: /Kho dược nội bộ/ }).click();
  await detail.getByRole('button', { name: 'Chỉnh sửa phòng', exact: true }).click();
  await form.getByLabel('Phòng hoạt động', { exact: true }).check();
  await form.getByRole('button', { name: 'Lưu thông tin phòng' }).click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu thông tin phòng' }).waitFor();
  assert.equal(state.rooms.find(room => room.roomId === 'r2').active, true);
  await detail.getByRole('button', { name: '+ Gắn thêm điểm', exact: true }).click();
  await select.selectOption('p1');
  await linkForm.getByRole('button', { name: 'Lưu liên kết điểm' }).click();
  await detail.locator('.rw-point-card strong').filter({ hasText: 'Cửa chính phòng Nội' }).waitFor();
  assert.equal(state.endpoints.find(point => point.endpointId === 'p1').roomId, 'r2');
  // Coordinates and heading edits use the existing free-cell validation.
  await detail.getByRole('button', { name: 'Chỉnh sửa điểm', exact: true }).click();
  await pointForm.getByLabel('X (m)', { exact: true }).fill('4.5');
  await pointForm.getByLabel('Hướng đến (độ)', { exact: true }).fill('90');
  await pointForm.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu điểm đến' }).waitFor();
  assert.equal(state.endpoints.find(point => point.endpointId === 'p1').xM, 4.5);
  assert.equal(state.endpoints.find(point => point.endpointId === 'p1').yawRad, Math.PI / 2);

  await detail.getByRole('button', { name: 'Chỉnh sửa điểm', exact: true }).click();
  await pointForm.getByText('Cài đặt điểm và liên kết', { exact: true }).click();
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Endpoint fields do not overflow at ' + width);
    await page.screenshot({ path: `.workstation-build/rooms/endpoint-fields-${width}.png`, fullPage: true });
  }
  await pointForm.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();

  await detail.getByRole('button', { name: 'Chỉnh sửa phòng', exact: true }).click();
  for (const [width, height] of [[1440, 1000], [1024, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow at ' + width);
    await page.screenshot({ path: `.workstation-build/rooms/room-edit-${width}.png`, fullPage: true });
  }
  await form.getByRole('button', { name: 'Hủy chỉnh sửa' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  failRead = true;
  await page.getByRole('button', { name: 'Tải lại phòng', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Không tải được danh mục' }).waitFor();
  await expect(roomBadge).toHaveText('101');
  assert.equal(await page.getByRole('button', { name: 'Chỉnh sửa phòng', exact: true }).count(), 0);
  failRead = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await detail.getByRole('heading', { name: 'Kho dược nội bộ', exact: true }).waitFor();
  failRead = true;
  await page.goto((process.env.TEST_URL || 'http://localhost:5173') + '/admin/facility');
  await expect(roomBadge).toHaveText('—');
  failRead = false; state.rooms = [];
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(roomBadge).toHaveText('0');
  assert.deepEqual(errors, []);
  console.log('Room browser checks passed: eager counts, loading/error/empty counts, tab switching, pagination, room/endpoint editing and responsive layout.');
} catch (error) {
  console.error('Browser failure:', page.url(), errors, (await page.locator('body').innerText()).slice(-3500));
  await page.screenshot({ path: '.workstation-build/rooms/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
