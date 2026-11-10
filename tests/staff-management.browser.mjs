import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const output = '.workstation-build/staff-management'; await mkdir(output, { recursive: true });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
const imageFile = { name: 'staff.png', mimeType: 'image/png', buffer: imageBytes };
async function fixture(role = 'ADMIN', options = {}) {
  const account = { role, accountId: id(500), fullName: 'Quản trị kiểm thử' };
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(account => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account, tokens: { accessToken: 'test-only-token' } })), account);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const reads = [], writes = [], errors = [], uploads = [];
  page.on('pageerror', e => errors.push(e.message));
  const state = { failList: false, failDetail: false, failWrite: false, ...options, rows: Array.from({ length: 101 }, (_, i) => ({ staffProfileId: id(i + 1), staffCode: `NV${String(i + 1).padStart(3, '0')}`, departmentCode: i % 2 ? 'NOI' : 'NGOAI', jobTitle: 'Điều dưỡng', contactExtension: '101', active: ![2, 3].includes(i), account: { accountId: id(2001 + i), accountCode: `STF-${i + 1}`, fullName: i === 0 ? 'Đặng Thị Ánh' : `Nhân viên kiểm thử ${i + 1}`, username: i === 0 ? 'staff' : `staff.${i + 1}`, email: `staff${i + 1}@example.test`, phone: '0901234567', role: 'STAFF', status: i === 1 ? 'LOCKED' : i === 2 ? 'INACTIVE' : 'ACTIVE', mustChangePassword: i === 4, lastLoginAt: null, createdAt: '2026-11-01T01:00:00Z', updatedAt: '2026-11-01T01:00:00Z' } })) };
  await page.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/png', body: imageBytes }));
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: value == null ? '' : JSON.stringify(value) });
    if (path === '/api/v1/media' && req.method() === 'POST') {
      const body = req.postDataBuffer();
      assert.match(req.headers()['content-type'], /^multipart\/form-data; boundary=/);
      assert.equal(req.headers().authorization, 'Bearer test-only-token');
      assert.ok(body.includes(Buffer.from('name="file"; filename="staff.png"')));
      assert.ok(body.includes(imageBytes), 'multipart upload must include original image bytes');
      const url = `https://images.example.test/images/upload-${uploads.length + 1}.png`;
      uploads.push({ url });
      if (state.failUpload) return reply({ message: 'Kho ảnh tạm thời gián đoạn' }, 503);
      return reply({ objectKey: `images/upload-${uploads.length}.png`, url, mediaType: 'IMAGE', contentType: 'image/png', sizeBytes: imageBytes.length }, 201);
    }
    if (req.method() !== 'GET') {
      const body = req.postData() ? req.postDataJSON() : null; writes.push({ path, method: req.method(), body });
      if (state.failWrite) return reply({ message: 'Email already exists' }, 409);
      if (path === '/api/v1/admin/staff') {
        const row = { staffProfileId: id(990), staffCode: body.staffCode, departmentCode: body.departmentCode, jobTitle: body.jobTitle, contactExtension: body.contactExtension, url: body.url, active: true, account: { accountId: id(2990), username: body.username.toLowerCase(), fullName: body.fullName, email: body.email, phone: body.phone, role: 'STAFF', status: 'ACTIVE', mustChangePassword: true, updatedAt: '2026-11-03T01:00:00Z' } };
        state.rows.push(row); return reply(row, 201);
      }
      const row = state.rows.find(row => path.includes(row.staffProfileId) || path.includes(row.account.accountId));
      if (!row) return reply({ message: 'Missing fixture member' }, 404);
      if (req.method() === 'PUT') { for (const key of ['fullName', 'email', 'phone']) row.account[key] = body[key]; for (const key of ['staffCode', 'departmentCode', 'jobTitle', 'contactExtension', 'url']) row[key] = body[key]; return reply(row); }
      if (req.method() === 'DELETE') { row.active = false; row.account.status = 'INACTIVE'; return reply(null, 204); }
      if (path.endsWith('/reset-password')) { row.account.mustChangePassword = true; return reply(null, 204); }
      row.account.status = path.endsWith('/unlock') ? 'ACTIVE' : 'LOCKED'; return reply(row.account);
    }
    reads.push(path + url.search);
    if (path === '/api/v1/auth/me') return reply(account);
    if (path === '/api/v1/admin/staff') {
      if (state.failList) return reply({ message: 'Danh sách nhân viên tạm gián đoạn' }, 503);
      const page = Number(url.searchParams.get('page') || 0), size = Number(url.searchParams.get('size') || 20), rows = [...state.rows].sort((a, b) => a.staffCode.localeCompare(b.staffCode));
      return reply({ content: rows.slice(page * size, (page + 1) * size), totalPages: Math.ceil(rows.length / size), totalElements: rows.length, last: (page + 1) * size >= rows.length });
    }
    const row = state.rows.find(row => path === `/api/v1/admin/staff/${row.staffProfileId}`);
    if (row) return state.failDetail ? reply({ message: 'Không tải được hồ sơ kiểm thử' }, 503) : reply(row);
    return reply({ content: [], totalPages: 0, totalElements: 0, last: true });
  });
  const start = async () => { await page.goto(`${base}/admin/users-roles`); if (role === 'ADMIN') { await page.locator('.um-table').waitFor(); await page.locator('.um-profile').waitFor(); } };
  const row = n => page.locator(`[data-staff-id="${id(n)}"]`);
  const select = async n => { await row(n).getByRole('button', { name: /^Xem hồ sơ/ }).click(); await page.locator('.um-profile').waitFor(); };
  return { context, page, reads, writes, errors, uploads, state, start, row, select };
}
try {
  const f = await fixture(); await f.start();
  const detail = f.page.locator('.um-detail');
  assert.equal(await detail.getByText('Số máy lẻ', { exact: true }).count(), 0);
  assert.equal(await f.page.locator('.um-metric').first().locator('strong').innerText(), '101');
  assert.ok(f.reads.some(path => path.includes('page=1')), 'search must load all API pages');
  assert.equal(await f.row(1).locator('code').innerText(), 'staff', 'username must never be translated');
  assert.equal(await detail.getByRole('button', { name: 'Mở khóa tài khoản', exact: true }).count(), 0);
  await detail.getByRole('button', { name: 'Khóa tài khoản', exact: true }).waitFor();
  await f.page.screenshot({ path: `${output}/desktop-active.png`, fullPage: true });
  await f.page.getByLabel('Tìm kiếm', { exact: true }).fill('staff.101'); await f.row(101).waitFor();
  assert.equal(await f.page.locator('.um-table tbody tr').count(), 1);
  await f.page.getByLabel('Tìm kiếm', { exact: true }).fill('dang thi anh'); await f.row(1).waitFor();
  await f.page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await f.select(2); await detail.getByRole('button', { name: 'Mở khóa tài khoản', exact: true }).waitFor();
  assert.equal(await detail.getByRole('button', { name: 'Khóa tài khoản', exact: true }).count(), 0);
  await f.select(3); await detail.getByText('Nhân viên đã ngừng hoạt động.', { exact: false }).waitFor();
  assert.equal(await detail.locator('.um-profile-actions button').count(), 0);
  await f.select(4); assert.equal(await detail.locator('.um-profile-actions button').count(), 0, 'inactive profile cannot unlock active account');
  await f.select(1); await detail.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click();
  let dialog = f.page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click(); await dialog.getByRole('alert').waitFor(); assert.equal(f.writes.length, 0);
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes[0].path, `/api/v1/admin/accounts/${id(2001)}/lock`, 'account mutations use account ID');
  await detail.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click(); dialog = f.page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Nhập lại mật khẩu *').count(), 0);
  await dialog.getByLabel('Mật khẩu tạm thời mới *').fill('test-only-password'); await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(f.writes.at(-1).body, { newPassword: 'test-only-password' });
  assert.ok(f.writes.at(-1).path.endsWith('/reset-password')); assert.equal(f.state.rows[0].account.status, 'LOCKED');
  await detail.getByRole('button', { name: 'Mở khóa tài khoản', exact: true }).click(); dialog = f.page.getByRole('dialog'); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Mở khóa tài khoản', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await detail.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click(); dialog = f.page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Số máy lẻ', { exact: true }).count(), 0);
  await dialog.getByLabel('Ảnh nhân viên', { exact: true }).setInputFiles(imageFile);
  await dialog.getByRole('img', { name: 'Ảnh nhân viên xem trước' }).waitFor();
  await f.page.waitForFunction(() => document.querySelector('.um-image-preview img')?.naturalWidth > 0);
  assert.equal(f.uploads.length, 0, 'selecting a file must wait for save before uploading');
  await dialog.getByLabel('Chức danh', { exact: true }).fill('Điều dưỡng trưởng'); await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes.at(-1).body.url, f.uploads[0].url);
  assert.equal(await detail.locator('.um-avatar img').getAttribute('src'), f.uploads[0].url);
  assert.equal(f.writes.at(-1).path, `/api/v1/admin/staff/${id(1)}`); assert.ok(!('username' in f.writes.at(-1).body));
  await detail.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click(); dialog = f.page.getByRole('dialog');
  f.state.rows[0].account.status = 'LOCKED'; await dialog.getByRole('checkbox').check(); const count = f.writes.length;
  await dialog.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click(); await dialog.getByRole('alert').filter({ hasText: 'Tài khoản đã thay đổi' }).waitFor(); assert.equal(f.writes.length, count);
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  await detail.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click(); dialog = f.page.getByRole('dialog');
  assert.equal(await dialog.getByRole('img', { name: 'Ảnh nhân viên xem trước' }).getAttribute('src'), f.uploads[0].url);
  await dialog.getByLabel('Ảnh nhân viên', { exact: true }).setInputFiles(imageFile);
  f.state.rows[0].jobTitle = 'Đã thay đổi trên máy khác';
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await dialog.getByRole('alert').filter({ hasText: 'Hồ sơ đã thay đổi' }).waitFor(); assert.equal(f.writes.length, count);
  assert.equal(f.uploads.length, 1, 'stale edit must not upload its selected image');
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  await detail.getByRole('button', { name: 'Ngừng hoạt động nhân viên', exact: true }).click(); dialog = f.page.getByRole('dialog');
  assert.equal(await dialog.getByText('Hệ thống hiện chưa hỗ trợ kích hoạt lại', { exact: false }).count(), 0); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Ngừng hoạt động nhân viên', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes.at(-1).method, 'DELETE'); assert.equal(f.writes.at(-1).path, `/api/v1/admin/staff/${id(1)}`);
  await f.page.getByRole('button', { name: 'Thêm nhân viên', exact: true }).click(); dialog = f.page.getByRole('dialog');
  assert.equal(await dialog.getByRole('heading', { name: 'Tạo tài khoản nhân viên', exact: true }).count(), 1);
  assert.ok(!(await dialog.locator('.um-dialog-header').innerText()).includes('Đặng Thị Ánh'), 'new form must not inherit selected staff identity');
  assert.equal(await dialog.getByLabel('Nhập lại mật khẩu *').count(), 0);
  await dialog.getByLabel('Tên đăng nhập *').fill('new.staff'); await dialog.getByLabel('Mật khẩu tạm thời *').fill('test-only-password');
  await dialog.getByLabel('Họ và tên *').fill('Nhân viên mới'); await dialog.getByLabel('Mã nhân viên *').fill('NV102'); await dialog.getByLabel('Email *').fill('new@example.test');
  await dialog.getByLabel('Số điện thoại', { exact: true }).fill('0901234568'); await dialog.getByLabel('Mã khoa', { exact: true }).fill('NOI');
  await dialog.getByLabel('Chức danh', { exact: true }).fill('Điều dưỡng'); assert.equal(await dialog.getByLabel('Số máy lẻ', { exact: true }).count(), 0);
  await dialog.getByLabel('Ảnh nhân viên', { exact: true }).setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await dialog.getByRole('alert').filter({ hasText: 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP' }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Tạo tài khoản', exact: true }).isDisabled(), true);
  assert.equal(f.uploads.length, 1, 'invalid file must not be uploaded');
  await dialog.getByLabel('Ảnh nhân viên', { exact: true }).setInputFiles(imageFile);
  await dialog.getByRole('button', { name: 'Bỏ ảnh đã chọn', exact: true }).click();
  assert.equal(await dialog.getByRole('img', { name: 'Ảnh nhân viên xem trước' }).count(), 0);
  await dialog.getByLabel('Ảnh nhân viên', { exact: true }).setInputFiles(imageFile);
  await f.page.screenshot({ path: `${output}/create-dialog.png`, fullPage: true });
  f.state.failUpload = true; const writesBeforeUpload = f.writes.length;
  await dialog.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Không tải được ảnh' }).waitFor();
  assert.equal(f.writes.length, writesBeforeUpload, 'upload failure must prevent staff creation');
  assert.equal(await dialog.getByLabel('Ảnh nhân viên', { exact: true }).evaluate(input => input.files.length), 1);
  f.state.failUpload = false;
  f.state.failWrite = true; await dialog.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click(); await dialog.getByRole('alert').filter({ hasText: 'Email đã được sử dụng' }).waitFor();
  assert.equal(await dialog.getByLabel('Tên đăng nhập *').inputValue(), 'new.staff');
  const uploadCountAfterConflict = f.uploads.length;
  f.state.failWrite = false; await dialog.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await detail.getByText('@new.staff', { exact: true }).waitFor(); assert.ok(!(await f.page.locator('.um-notice.um-success').innerText()).includes('test-only-password'));
  assert.equal(f.writes.at(-1).path, '/api/v1/admin/staff'); assert.ok(!('role' in f.writes.at(-1).body));
  assert.equal(f.uploads.length, uploadCountAfterConflict, 'retry after staff conflict must reuse the uploaded URL');
  assert.deepEqual(f.writes.at(-1).body, { username: 'new.staff', temporaryPassword: 'test-only-password', fullName: 'Nhân viên mới', email: 'new@example.test', phone: '0901234568', staffCode: 'NV102', departmentCode: 'NOI', jobTitle: 'Điều dưỡng', url: f.uploads.at(-1).url });
  await detail.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click(); dialog = f.page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes.at(-1).body.url, f.uploads.at(-1).url, 'saving without a new file must preserve the existing image');
  assert.equal(f.uploads.length, uploadCountAfterConflict);
  f.state.failList = true; await f.page.getByRole('button', { name: 'Tải lại', exact: true }).click(); await f.page.getByRole('alert').filter({ hasText: 'Danh sách nhân viên tạm gián đoạn' }).waitFor();
  assert.ok(await f.page.locator('.um-table tbody tr').count()); assert.equal(await f.page.getByRole('button', { name: 'Thêm nhân viên' }).isDisabled(), true);
  f.state.failList = false; await f.page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await f.page.getByRole('alert').waitFor({ state: 'hidden' });
  await f.page.getByLabel('Trạng thái', { exact: true }).selectOption('LOCKED');
  assert.equal(await f.page.locator('.um-table tbody tr').count(), 1); await f.page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  f.state.failDetail = true; await f.row(5).getByRole('button', { name: /^Xem hồ sơ/ }).click();
  await detail.getByRole('alert').filter({ hasText: 'Không tải được hồ sơ kiểm thử' }).waitFor(); assert.equal(await detail.locator('.um-profile-actions button').count(), 0);
  f.state.failDetail = false; await detail.getByRole('button', { name: 'Tải lại hồ sơ' }).click(); await detail.locator('.um-profile').waitFor();
  for (const width of [1600, 1440, 1024, 768, 390]) { await f.page.setViewportSize({ width, height: 1000 }); assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`); if (width === 390) await f.page.screenshot({ path: `${output}/mobile.png`, fullPage: true }); }
  await f.row(2).getByRole('button', { name: /^Xem hồ sơ/ }).click(); await detail.locator('.um-profile').waitFor();
  await f.page.getByRole('button', { name: 'Thêm nhân viên', exact: true }).click(); dialog = f.page.getByRole('dialog');
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'mobile form must not overflow');
  await dialog.getByLabel('Ảnh nhân viên', { exact: true }).setInputFiles(imageFile);
  await dialog.getByLabel('Ảnh nhân viên', { exact: true }).scrollIntoViewIfNeeded();
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'mobile image chooser must not overflow');
  await f.page.screenshot({ path: `${output}/mobile-dialog.png`, fullPage: true }); await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  assert.deepEqual(f.errors, []); await f.context.close();

  const staff = await fixture('STAFF'); await staff.start(); await staff.page.getByRole('heading', { name: 'Chỉ quản trị viên được quản lý nhân viên' }).waitFor();
  assert.ok(!staff.reads.some(path => path.startsWith('/api/v1/admin/staff'))); assert.equal(staff.writes.length, 0); assert.deepEqual(staff.errors, []); await staff.context.close();
  console.log('Staff management passed: full-list search, raw usernames, role and state guards, CRUD, reset, stale data, failures and responsive UI.');
} finally { await browser.close(); }
