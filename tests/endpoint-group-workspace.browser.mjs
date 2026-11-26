import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://localhost:5173';
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
await context.addInitScript(() => sessionStorage.setItem('mediassist-rover.session', JSON.stringify({
  tokens: { accessToken: 'fixture' }, account: { role: 'ADMIN' },
})));
const page = await context.newPage();
const reads = [], writes = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const maps = ['a', 'b'].map(mapId => ({
  mapId, floorId: 'floor', mapName: 'Bản đồ ' + mapId, status: mapId === 'a' ? 'ACTIVE' : 'DRAFT',
  versionNo: 1, widthM: 10, heightM: 10, resolutionMPerPixel: 0.1,
}));
const rooms = ['reception', 'hall'].map(id => ({
  roomId: id, roomCode: id.toUpperCase(), roomName: id === 'reception' ? 'Lễ tân' : 'Hành lang', floorId: 'floor', active: true,
}));
const point = (id, name, roomId, mapId = 'a') => ({
  endpointId: id, endpointCode: id.toUpperCase(), endpointName: name, roomId, mapId, active: true,
  accessible: true, publicVisible: false, endpointType: 'WAYPOINT', xM: 1, yM: 2, yawRad: 0,
});
const endpoints = [
  point('inside', 'Điểm trong phòng', 'reception'), point('outside', 'Điểm ngoài cửa', 'reception'),
  point('hallway', 'Điểm hành lang', 'hall'), point('foreign', 'Điểm trên bản đồ B', 'reception', 'b'),
  { ...point('blocked', 'Điểm không tiếp cận', 'reception'), accessible: false },
];
const group = (id, name, mapId) => ({
  endpointGroupId: id, groupName: name, groupCode: id.toUpperCase(), mapId, active: true,
  selectionPolicy: 'PRIORITY', allowFallback: false, description: '', roomId: null, fallbackRadiusM: 0.75,
});
const groups = Array.from({ length: 100 }, (_, index) => group('foreign-' + index, 'Nhóm bản đồ B ' + index, 'b'));
groups.push(group('seed', 'Nhóm ban đầu', 'a'), group('second', 'Nhóm thứ hai', 'a'));
const members = groups.map(row => ({
  endpointGroupId: row.endpointGroupId, endpointId: row.mapId === 'a' ? 'inside' : 'foreign',
  mapId: row.mapId, sequenceNo: 1, active: true,
}));
let rejectMemberEdit = false, delaySecondDetail;
await context.route('**/api/v1/**', async route => {
  const req = route.request(), method = req.method(), url = new URL(req.url());
  const [, , , resource, id, action] = url.pathname.split('/');
  const reply = (value, status = 200) => route.fulfill({ status, json: value });
  if (method === 'GET') {
    reads.push(url);
    if (resource === 'auth') return reply({ role: 'ADMIN' });
    if (action === 'image-metadata') return reply({
      map_id: id, width_px: 100, height_px: 100, resolution_m_per_pixel: 0.1, origin_x_m: 0,
      origin_y_m: 0, origin_yaw_rad: 0, navigation_reload_safe: true,
    });
    if (action === 'image.png') return route.fulfill({ contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64') });
    const withInactive = url.searchParams.get('includeDeleted') === 'true';
    const visibleGroups = groups.filter(row => row.active || withInactive);
    if (resource === 'endpoint-groups' && id) {
      if (id === 'second' && delaySecondDetail) await delaySecondDetail;
      const row = visibleGroups.find(item => item.endpointGroupId === id);
      return row ? reply(row) : reply({ message: 'Group not found' }, 404);
    }
    const rows = { maps, rooms, endpoints, 'endpoint-groups': visibleGroups, 'endpoint-group-members': members }[resource] || [];
    const pageNo = Number(url.searchParams.get('page')), size = Number(url.searchParams.get('size')) || 100;
    const totalPages = Math.ceil(rows.length / size);
    return reply({ content: rows.slice(pageNo * size, (pageNo + 1) * size), number: pageNo, last: pageNo + 1 >= totalPages, totalPages });
  }

  const body = req.postDataJSON();
  writes.push({ method, path: url.pathname, body });
  if (resource === 'endpoint-groups') {
    if (method === 'POST' && id === 'room-pair') {
      const row = { ...group('pair', body.groupName, body.mapId), groupCode: body.groupCode, roomId: body.roomId,
        allowFallback: true, fallbackRadiusM: body.fallbackRadiusM };
      groups.push(row);
      for (const [index, endpointId] of [body.primaryEndpointId, body.fallbackEndpointId].entries()) {
        members.push({ endpointGroupId: 'pair', endpointId, mapId: body.mapId, sequenceNo: index + 1, active: true });
      }
      return reply(row, 201);
    }
    if (method === 'POST' && !id) {
      const row = { ...group('created', body.groupName, body.mapId), ...body };
      groups.push(row);
      return reply(row, 201);
    }
    const row = groups.find(item => item.endpointGroupId === id);
    if (row && method === 'PUT' && !action) return reply(Object.assign(row, body));
    if (row && method === 'POST' && ['activate', 'deactivate'].includes(action)) {
      return reply(Object.assign(row, { active: action === 'activate' }));
    }
  }
  if (resource === 'endpoint-group-members') {
    if (method === 'POST' && !id) {
      const row = { ...body, mapId: 'a' };
      members.push(row);
      return reply(row, 201);
    }
    const row = members.find(item => item.endpointGroupId === id && item.endpointId === action);
    if (row && method === 'PUT') {
      if (rejectMemberEdit) {
        rejectMemberEdit = false;
        return reply({ message: 'Sequence number already exists in this group' }, 409);
      }
      return reply(Object.assign(row, body));
    }
    if (row && method === 'DELETE') {
      row.active = false;
      return id === 'pair' ? route.fulfill({ status: 204 }) : reply(row);
    }
  }
  errors.push('Unexpected request ' + method + ' ' + url.pathname);
  return reply({ message: 'Unexpected request' }, 400);
});

const region = page.getByRole('region', { name: 'Quản lý nhóm điểm đích' });
const button = (scope, name) => scope.getByRole('button', { name, exact: typeof name === 'string' });
const form = name => page.getByRole('dialog').getByRole('form', { name, exact: true });
const lastWrite = (method, path) => {
  assert.equal(writes.at(-1)?.method, method);
  assert.equal(writes.at(-1)?.path, '/api/v1/' + path);
  return writes.at(-1).body;
};
const openGroups = async () => {
  await page.goto(base + '/admin/map?mapId=a&stage=endpoint');
  await button(page, 'Nhóm điểm đích').click();
  await expect(region).toBeVisible();
};
const confirmChange = async reason => {
  const reasonField = page.getByLabel(/Lý do/);
  await reasonField.fill(reason);
  await button(page, 'Xác nhận').click();
  await expect(reasonField).toHaveCount(0);
};
try {
  await openGroups();
  assert.equal(new URL(page.url()).searchParams.get('endpointTab'), 'group');
  await page.reload();
  await expect(region).toBeVisible();
  await button(region, /Nhóm ban đầu/).click();
  await expect(region.getByText('Điểm trong phòng', { exact: true })).toBeVisible();
  await expect(region.getByText(/Nhóm bản đồ B|Điểm trên bản đồ B/)).toHaveCount(0);
  assert.ok(reads.some(url => url.pathname.endsWith('/endpoint-groups/seed')));
  for (const resource of ['endpoint-groups', 'endpoint-group-members']) {
    assert.ok(reads.some(url => url.pathname.endsWith('/' + resource) && url.searchParams.get('page') === '1' && url.searchParams.get('size') === '100'));
  }
  assert.deepEqual(writes, []);
  let releaseDetail;
  delaySecondDetail = new Promise(resolve => { releaseDetail = resolve; });
  const pendingDetail = page.waitForRequest(req => new URL(req.url()).pathname.endsWith('/endpoint-groups/second'));
  await button(region, /Nhóm thứ hai/).click();
  await pendingDetail;
  await button(region, /Nhóm ban đầu/).click();
  await expect(region.getByText('Điểm trong phòng', { exact: true })).toBeVisible();
  releaseDetail();
  await expect(region.getByRole('heading', { name: 'Nhóm ban đầu', exact: true })).toBeVisible();

  await button(region, 'Tạo nhóm').click();
  const groupForm = form('Thông tin nhóm');
  await groupForm.getByLabel('Mã nhóm').fill('HALL');
  await groupForm.getByLabel('Tên nhóm').fill('Nhóm hành lang');
  await button(groupForm, 'Lưu nhóm').click();
  await expect(button(region, /Nhóm hành lang/)).toBeVisible();
  assert.equal(lastWrite('POST', 'endpoint-groups').mapId, 'a');
  await button(region, 'Chỉnh sửa nhóm').click();
  await groupForm.getByLabel('Tên nhóm').fill('Nhóm hành lang phía đông');
  await button(groupForm, 'Lưu nhóm').click();
  await expect(button(region, /Nhóm hành lang phía đông/)).toBeVisible();
  assert.equal(lastWrite('PUT', 'endpoint-groups/created').groupName, 'Nhóm hành lang phía đông');

  await button(region, 'Thêm thành viên').click();
  const memberForm = form('Thành viên nhóm');
  const choices = memberForm.getByLabel('Điểm đích', { exact: true });
  await expect(choices.locator('option[value="foreign"]')).toHaveCount(0);
  await choices.selectOption('hallway');
  await button(memberForm, 'Lưu thành viên').click();
  const memberRow = region.getByRole('row', { name: /Điểm hành lang/ });
  await expect(memberRow).toBeVisible();
  assert.deepEqual(lastWrite('POST', 'endpoint-group-members'), {
    endpointGroupId: 'created', endpointId: 'hallway', sequenceNo: 1, active: true,
  });
  await button(region, 'Chỉnh sửa').click();
  await memberForm.getByLabel('Thứ tự ưu tiên').fill('2');
  rejectMemberEdit = true;
  await button(memberForm, 'Lưu thành viên').click();
  await expect(memberForm.getByRole('alert')).toBeVisible();
  assert.equal(members.find(item => item.endpointGroupId === 'created').sequenceNo, 1);
  await button(memberForm, 'Lưu thành viên').click();
  await expect(memberForm).toHaveCount(0);
  await expect(memberRow.getByRole('cell', { name: '2', exact: true })).toBeVisible();
  assert.equal(lastWrite('PUT', 'endpoint-group-members/created/hallway').sequenceNo, 2);
  await button(region, 'Tắt thành viên').click();
  await confirmChange('Tạm đóng lối đi.');
  assert.equal(lastWrite('DELETE', 'endpoint-group-members/created/hallway').reason, 'Tạm đóng lối đi.');
  await expect(memberRow).toContainText('Đã tắt');
  await button(region, 'Chỉnh sửa').click();
  await memberForm.getByLabel('Thành viên hoạt động').check();
  await button(memberForm, 'Lưu thành viên').click();
  await expect(memberForm).toHaveCount(0);
  assert.equal(lastWrite('PUT', 'endpoint-group-members/created/hallway').active, true);
  await expect(memberRow).toContainText('Đang bật');

  await button(region, 'Tắt nhóm').click();
  await confirmChange('Tạm dừng phục vụ.');
  assert.equal(lastWrite('POST', 'endpoint-groups/created/deactivate').reason, 'Tạm dừng phục vụ.');
  await openGroups();
  await region.getByLabel('Lọc trạng thái nhóm').selectOption('inactive');
  await region.getByLabel('Tìm nhóm').fill('hanh lang');
  await expect(button(region, /Nhóm ban đầu/)).toHaveCount(0);
  await button(region, /Nhóm hành lang phía đông/).click();
  await button(region, 'Bật nhóm').click();
  await confirmChange('Phục vụ trở lại.');
  assert.equal(lastWrite('POST', 'endpoint-groups/created/activate').reason, 'Phục vụ trở lại.');
  await region.getByLabel('Lọc trạng thái nhóm').selectOption('all');
  await expect(button(region, 'Tắt nhóm')).toBeVisible();

  await button(region, 'Tạo cặp điểm cho phòng').click();
  const pair = form('Cặp điểm cho phòng');
  const roomField = pair.getByLabel('Phòng', { exact: true });
  await roomField.selectOption('hall');
  await expect(button(pair, 'Tạo cặp điểm')).toBeDisabled();
  await roomField.selectOption('reception');
  const primary = pair.getByLabel('Điểm chính', { exact: true }), fallback = pair.getByLabel('Điểm dự phòng', { exact: true });
  for (const id of ['foreign', 'hallway', 'blocked']) await expect(primary.locator('option[value="' + id + '"]')).toHaveCount(0);
  await primary.selectOption('inside');
  await expect(fallback.locator('option[value="inside"]')).toHaveJSProperty('disabled', true);
  await fallback.selectOption('outside');
  await pair.getByLabel('Mã nhóm').fill('HALL');
  await expect(button(pair, 'Tạo cặp điểm')).toBeDisabled();
  await pair.getByLabel('Mã nhóm').fill('CAP_LE_TAN');
  await pair.getByLabel('Tên nhóm').fill('Cặp điểm lễ tân');
  await pair.getByLabel('Bán kính dự phòng (m)').fill('1.25');
  await pair.getByLabel('Dùng làm nhóm mặc định của phòng').check();
  const priorWrites = writes.length;
  await button(pair, 'Tạo cặp điểm').click();
  await expect(region.getByText('Điểm trong phòng', { exact: true })).toBeVisible();
  await expect(region.getByText('Điểm ngoài cửa', { exact: true })).toBeVisible();
  assert.equal(writes.length, priorWrites + 1, 'A room pair and both members are created in one request');
  assert.deepEqual(lastWrite('POST', 'endpoint-groups/room-pair'), {
    mapId: 'a', roomId: 'reception', primaryEndpointId: 'inside', fallbackEndpointId: 'outside',
    groupCode: 'CAP_LE_TAN', groupName: 'Cặp điểm lễ tân', fallbackRadiusM: 1.25, setAsRoomDefault: true,
  });
  await mkdir('.workstation-build/group-qa', { recursive: true });
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await region.screenshot({ path: '.workstation-build/group-qa/groups-' + width + '.png' });
  }
  const fallbackRow = region.getByRole('row', { name: /Điểm ngoài cửa/ });
  await expect(fallbackRow).toContainText('Điểm dự phòng');
  await button(fallbackRow, 'Tắt thành viên').click();
  await confirmChange('Tạm đóng cửa phụ.');
  await expect(fallbackRow).toContainText('Đã tắt');
  await expect(region.getByText(/Để sử dụng cặp điểm/)).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: map-scoped group list, details, create, edit, lifecycle, members, conflict retry and room pair on /admin/map. APIs mocked.');
} finally {
  await browser.close();
}
