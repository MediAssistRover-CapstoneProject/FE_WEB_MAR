import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const base = process.env.TEST_URL || 'http://localhost:5173';
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN' }, tokens: { accessToken: 'fixture' } })));
const errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
const room = (id, name, active = true) => ({ roomId: id, roomCode: id.toUpperCase(), roomName: name, floorId: 'f', roomType: 'GENERAL', departmentCode: 'OUTPATIENT', active, publicVisible: true });
const map = (id, status) => ({ mapId: id, mapCode: id, mapName: `Bản đồ ${id}`, floorId: 'f', versionNo: 1, status, widthM: 10, heightM: 10 });
const endpoint = (id, roomId, mapId) => ({ endpointId: id, endpointName: id, endpointCode: id, endpointType: 'WAYPOINT', mapId, roomId, active: true, accessible: true, publicVisible: true, xM: 1, yM: 1, yawRad: 0 });
const state = {
  rooms: [room('old', 'Phòng map cũ'), room('new', 'Phòng map mới'), room('new2', 'Phòng thứ hai map mới'), room('shared', 'Phòng dùng chung'), room('disabled', 'Phòng đã tắt', false), room('unlinked', 'Phòng chưa gắn bản đồ')],
  maps: [map('a', 'ACTIVE'), map('b', 'INACTIVE')], floors: [{ floorId: 'f', floorCode: 'F1', floorName: 'Tầng 1', active: true }],
  endpoints: [endpoint('old-point', 'old', 'a'), endpoint('new-point', 'new', 'b'), endpoint('new-point2', 'new2', 'b'), endpoint('shared-a', 'shared', 'a'), endpoint('shared-b', 'shared', 'b'), endpoint('shared-b2', 'shared', 'b'), endpoint('shared-b3', 'shared', 'b'), endpoint('disabled-point', 'disabled', 'b')],
};
await page.route('**/api/v1/**', async route => {
  const req = route.request(), parts = new URL(req.url()).pathname.split('/').filter(Boolean), resource = parts[2];
  const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (req.method() !== 'GET') {
    writes.push({ resource, id: parts[3], action: parts[4] });
    assert.equal(resource, 'maps'); assert.equal(parts[4], 'activate');
    state.maps = state.maps.map(map => ({ ...map, status: map.mapId === parts[3] ? 'ACTIVE' : 'INACTIVE' }));
    return reply(state.maps.find(map => map.mapId === parts[3]));
  }
  if (resource === 'auth') return reply({ role: 'ADMIN' });
  if (parts[4] === 'image-metadata') return reply({ map_id: parts[3], width_px: 100, height_px: 100, resolution_m_per_pixel: .1, origin_x_m: 0, origin_y_m: 0, origin_yaw_rad: 0 });
  if (parts[4] === 'image.png') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64') });
  return reply({ content: state[resource] || [], last: true, totalPages: 1 });
});
const list = page.getByRole('complementary', { name: 'Danh sách phòng quản trị' });
const detail = page.getByRole('article', { name: 'Chi tiết phòng', exact: true });
const activate = id => page.evaluate(async id => {
  const { facilityApi } = await import('/src/features/facility/facilityApi.js');
  await facilityApi.activateMap(id);
  window.dispatchEvent(new Event('focus'));
}, id);

try {
  const badge = page.getByRole('button', { name: /Danh sách phòng/ }).locator('span');
  const roomMetric = page.locator('.lo-metric').filter({ has: page.getByText('Phòng đang hoạt động', { exact: true }) }).locator('strong');
  await page.goto(base + '/admin/facility');
  await expect(badge).toHaveText('2');
  await expect(roomMetric).toHaveText('2');
  await expect(page.getByText('Phòng trong danh mục', { exact: true })).toHaveCount(0);
  await mkdir('.workstation-build/room-map-availability', { recursive: true });
  await page.screenshot({ path: '.workstation-build/room-map-availability/hospital-header-count.png', fullPage: true });
  await page.getByRole('button', { name: /Danh sách tầng/ }).click();
  await expect(badge).toHaveText('2');
  await expect(roomMetric).toHaveText('2');
  await page.getByRole('button', { name: /Danh sách phòng/ }).click();
  await expect(page.getByLabel('Lọc trạng thái phòng')).toHaveValue('active');
  await expect(list.locator('.lo-job-item')).toHaveCount(2);
  await expect(roomMetric).toHaveText('2');
  await expect(list).toContainText('Phòng map cũ');
  await expect(list).not.toContainText('Phòng map mới');
  const sharedRoom = list.getByRole('button', { name: /Phòng dùng chung/ });
  const oldRoom = list.getByRole('button', { name: /Phòng map cũ/ });
  const mapSelect = detail.getByLabel('Bản đồ của phòng');
  const detailCount = detail.locator('.rw-points .rw-section-heading .lo-badge');
  await sharedRoom.click();
  await expect(mapSelect).toHaveValue('a');
  await expect(sharedRoom.getByText('1 điểm', { exact: true })).toBeVisible();
  await expect(detailCount).toHaveText('1 điểm trên map');
  await mapSelect.selectOption('b');
  await expect(sharedRoom.getByText('3 điểm', { exact: true })).toBeVisible();
  await expect(oldRoom.getByText('0 điểm', { exact: true })).toBeVisible();
  await expect(detailCount).toHaveText('3 điểm trên map');
  await mapSelect.selectOption('a');
  await expect(sharedRoom.getByText('1 điểm', { exact: true })).toBeVisible();
  await oldRoom.click();
  await activate('b');
  await expect(list).toContainText('Phòng map mới');
  await expect(list).not.toContainText('Phòng map cũ');
  await expect(list).toContainText('Phòng dùng chung');
  await expect(list).not.toContainText('Phòng đã tắt');
  await expect(list.locator('.lo-job-item')).toHaveCount(3);
  await expect(badge).toHaveText('3');
  await expect(roomMetric).toHaveText('3');
  await expect(page.locator('.lo-total')).toHaveText('3 phòng đang hoạt động');
  await expect(detail.getByRole('heading', { name: 'Phòng map mới', exact: true })).toBeVisible();
  await page.getByLabel('Lọc trạng thái phòng').selectOption('inactive');
  await expect(list.locator('.lo-job-item')).toHaveCount(3);
  await list.getByRole('button', { name: /Phòng map cũ/ }).click();
  await expect(detail.locator('.lo-detail-kicker')).toContainText('Không hoạt động');
  await expect(detail.getByLabel('Bản đồ của phòng')).toHaveValue('a');
  await page.getByLabel('Lọc trạng thái phòng').selectOption('');
  await expect(list.locator('.lo-job-item')).toHaveCount(6);
  await expect(badge).toHaveText('3');
  await expect(roomMetric).toHaveText('3');
  await list.getByRole('button', { name: /Phòng map mới/ }).click();
  await detail.getByRole('button', { name: 'Chỉnh sửa phòng', exact: true }).click();
  await detail.getByLabel('Tên phòng', { exact: true }).fill('Tên chưa lưu');
  await activate('a');
  await expect(detail.getByLabel('Tên phòng', { exact: true })).toHaveValue('Tên chưa lưu');
  const confirmation1 = page.getByRole('dialog', { name: 'Xác nhận thao tác' }).waitFor().then(async () => {  await page.getByRole('dialog', { name: 'Xác nhận thao tác' }).getByRole('button', { name: 'Xác nhận', exact: true }).click(); });
  await detail.getByRole('button', { name: 'Hủy chỉnh sửa', exact: true }).click();
  await confirmation1;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByLabel('Lọc trạng thái phòng').selectOption('active');
  await expect(list).toContainText('Phòng map cũ');
  await expect(list).not.toContainText('Phòng map mới');
  await expect(list.locator('.lo-job-item')).toHaveCount(2);
  await expect(badge).toHaveText('2');
  await expect(roomMetric).toHaveText('2');
  await mkdir('.workstation-build/room-map-availability', { recursive: true });
  await page.screenshot({ path: '.workstation-build/room-map-availability/active-map-rooms.png', fullPage: true });
  assert.equal(state.rooms.find(room => room.roomId === 'disabled').active, false);
  assert.equal(writes.length, 2);
  assert.deepEqual(errors, []);
  console.log('PASS: active-map room default, map switches in both directions, inactive/all filters, shared/manual-disabled rooms, linked-map selection and unsaved edit preservation. All APIs mocked.');
} finally { await browser.close(); }
