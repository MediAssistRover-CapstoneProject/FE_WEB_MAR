import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resources } from '../src/features/api/workspaceCatalog.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
await context.addInitScript(() => { if (!sessionStorage.getItem('mediassist-rover.session')) sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'test-access' } })); });
const page = await context.newPage(), errors = [], writes = [], reads = [];
page.on('pageerror', e => errors.push(e.message));
let request = null, failRequest = true;
const staff = { staffProfileId: id(4), staffCode: 'NV01', account: { accountId: id(5), username: 'nurse', fullName: 'Nhân viên kiểm thử', email: 'nurse@example.test', role: 'STAFF' } };
const job = { jobId: id(9), jobCode: 'JOB01', status: 'RUNNING', selectedJobStepId: id(10) };
const cargo = [{ itemCode: 'MED01', quantity: 2 }];
const jobDetail = { job, steps: [{ jobStepId: id(10), status: 'RUNNING', stepTypeSnapshot: 'HANDLE_PAYLOAD', stepCodeSnapshot: 'LOAD', resolvedInputsJson: { items: cargo } }] };
const data = {
  maps: [{ mapId: id(1), mapName: 'Bản đồ thử nghiệm', floorId: id(6), status: 'ACTIVE' }],
  endpoints: [{ endpointId: id(2), endpointName: 'Quầy thuốc', mapId: id(1), active: true }],
  'endpoint-groups': [{ endpointGroupId: id(3), groupName: 'Nhóm kho thuốc', mapId: id(1), active: true }],
  'admin/staff': [staff],
  jobs: [job],
  'hospital-information': [{ hospitalInformationId: id(7), title: 'Bệnh viện A' }],
};
await page.route('**/api/v1/**', async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
  const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (method !== 'GET') {
    writes.push({ path, method, body: req.postDataJSON(), key: req.headers()['idempotency-key'] });
    if (path === '/api/v1/navigation-requests') {
      if (failRequest) { failRequest = false; return reply({ message: 'Vui lòng thử lại yêu cầu này' }, 409); }
      request = { serviceRequestId: id(8), requestCode: 'REQ01', status: 'DRAFT', ...req.postDataJSON() };
      return reply(request, 201);
    }
    return reply({ ...req.postDataJSON(), staffProfileId: id(4) });
  }
  reads.push(path + url.search);
  if (path === `/api/v1/admin/staff/${id(4)}`) return reply(staff);
  if (path === `/api/v1/jobs/${id(9)}`) return reply(jobDetail);
  if (path === `/api/v1/service-requests/${id(8)}`) return reply(request);
  if (path === '/api/v1/auth/me') return reply({ username: 'admin', role: 'ADMIN' });
  const name = path.replace('/api/v1/', '');
  const rows = name === 'service-requests' ? request ? [request] : [] : data[name] || [];
  return reply({ content: rows, totalElements: rows.length, totalPages: 1, last: true });
});
const go = async section => { await page.goto(`http://127.0.0.1:5173/admin?screen=${encodeURIComponent(section)}`); await page.locator(section === 'Patrol' ? '.patrol-workspace' : '.be-heading h2').first().waitFor(); };
try {
  await go('Missions');
  await page.getByRole('button', { name: 'Yêu cầu dẫn đường', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bản đồ *', { exact: true }).selectOption(id(1));
  await dialog.getByLabel('Chọn đích theo *', { exact: true }).selectOption('ENDPOINT_GROUP');
  await dialog.getByLabel('Nhóm điểm đến', { exact: true }).selectOption(id(3));
  await dialog.getByLabel('Chế độ dẫn đường *', { exact: true }).selectOption('STANDARD');
  await dialog.getByLabel('Độ ưu tiên', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByRole('alert').getByText('Vui lòng thử lại yêu cầu này').waitFor();
  assert.equal(await dialog.getByLabel('Nhóm điểm đến', { exact: true }).inputValue(), id(3));
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByText('Đã lưu thành công.', { exact: true }).waitFor();
  assert.equal(writes.length, 2); assert.equal(writes[0].key, writes[1].key); assert.ok(writes[0].key);
  assert.equal(writes[1].body.priority, 0); assert.equal(writes[1].body.destinationGroupId, id(3)); assert.ok(!('destinationEndpointId' in writes[1].body));
  await dialog.getByRole('button', { name: 'Hoàn tất' }).click();
  await page.locator('.be-records button').first().click();
  await page.getByRole('button', { name: 'Gửi xử lý', exact: true }).waitFor();

  await go('Users & Roles');
  await page.locator('.be-records button').filter({ hasText: 'Nhân viên kiểm thử' }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
  assert.equal(await dialog.getByLabel('Họ tên *', { exact: true }).inputValue(), 'Nhân viên kiểm thử');
  await dialog.getByLabel('Họ tên *', { exact: true }).fill('Nhân viên đã cập nhật');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByText('Đã lưu thành công.', { exact: true }).waitFor();
  const update = writes.at(-1);
  assert.equal(update.method, 'PUT'); assert.equal(update.path, `/api/v1/admin/staff/${id(4)}`);
  assert.equal(update.body.fullName, 'Nhân viên đã cập nhật'); assert.equal(update.body.email, staff.account.email);
  await dialog.getByRole('button', { name: 'Hoàn tất' }).click();

  await go('Live Operations');
  await page.locator('.be-records button').filter({ hasText: 'Công việc robot' }).click();
  await page.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByRole('alert').getByText('Vui lòng kiểm tra và xác nhận trước khi gửi.').waitFor();
  await dialog.getByLabel('Tôi đã kiểm tra hàng đúng danh sách').check();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByText('Đã lưu thành công.', { exact: true }).waitFor();
  assert.equal(writes.at(-1).path, `/api/v1/job-steps/${id(10)}/responses`);
  assert.equal(writes.at(-1).body.responseType, 'PAYLOAD_CONFIRMED');
  assert.deepEqual(writes.at(-1).body.data, { confirmed: true, items: cargo });
  assert.ok(writes.at(-1).key);
  await dialog.getByRole('button', { name: 'Hoàn tất' }).click();

  // A child collection can be created even before its first record exists.
  await go('Facility Management');
  await page.getByRole('navigation', { name: 'Danh mục chức năng' }).getByRole('button', { name: 'Bài hướng dẫn', exact: true }).click();
  await page.getByLabel('Bệnh viện *', { exact: true }).selectOption(id(7));
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click();
  assert.equal(await dialog.getByLabel('Bệnh viện *', { exact: true }).count(), 0);
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();

  // Smoke each role-appropriate resource, including empty collections.
  for (const section of new Set(resources.filter(r => !r.staffOnly).map(r => r.section))) {
    await go(section);
    // Patrol is now a local route designer, covered by patrol.browser.mjs.
    if (section === 'Patrol') {
      await page.locator('.patrol-workspace').waitFor();
      continue;
    }
    for (const r of resources.filter(r => r.section === section && !r.staffOnly)) {
      const tabs = page.getByRole('navigation', { name: 'Danh mục chức năng' });
      if (await tabs.count()) await tabs.getByRole('button', { name: r.title, exact: true }).click();
      await page.locator('.be-heading h2').filter({ hasText: r.title }).first().waitFor();
    }
  }
  await go('Missions');
  await mkdir('.workstation-build', { recursive: true });
  await page.screenshot({ path: '.workstation-build/backend-workspace.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'New workspace should not overflow on mobile');
  await page.getByRole('button', { name: 'Yêu cầu dẫn đường', exact: true }).click();
  assert.ok(await dialog.isVisible());
  await page.screenshot({ path: '.workstation-build/backend-form-mobile.png' });
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'staff', role: 'STAFF' }, tokens: { accessToken: 'test-access' } })));
  await page.goto('http://127.0.0.1:5173/admin?screen=Users%20%26%20Roles');
  await page.getByText('Tài khoản này không có quyền sử dụng mục này.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Tạo mới', exact: true }).count(), 0);
  await page.goto('http://127.0.0.1:5173/workflows');
  await page.waitForURL('**/admin?screen=Workflow%20Management');
  assert.deepEqual(errors, []);
  console.log('PASS: service request create/retry, staff update, parent-bound actions, all resource screens, role restrictions.');
} finally { await browser.close(); }
