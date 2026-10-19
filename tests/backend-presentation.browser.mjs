import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', fullName: 'System Administrator', role: 'ADMIN' }, tokens: { accessToken: 'test-only' } })));
const page = await context.newPage(), errors = [], reads = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const date = '2026-10-19T15:30:00Z';
const policies = ['alert_recipient', 'alert', 'emergency_incident', 'detection_event', 'job_event', 'robot_status_history', 'robot_location_history', 'crowd_density_record', 'heatmap_record', 'audit_log'].map(dataset => ({ dataset, retentionDays: 365, mode: 'DISABLED' }));
const setting = { systemSettingId: id(1), settingKey: 'operations.robot_offline_threshold_seconds', settingValue: { value: 30 }, dataType: 'NUMBER', category: 'OPERATIONS', description: 'Seconds without heartbeat before a robot is marked OFFLINE', publicSetting: false, updatedAt: date };
const audit = Array.from({ length: 20 }, (_, n) => ({ auditLogId: id(n + 10), actionCode: n % 2 ? 'SYSTEM_SETTING_UPDATED' : 'LOGIN_SUCCEEDED', actorUsername: 'admin', entityType: n % 2 ? 'SystemSetting' : 'Account', occurredAt: date }));
const overview = { generatedAt: date, jobsByStatus: { SUCCEEDED: 2, CANCELLED: 5, RECOVERY_REQUIRED: 1 }, robotsByStatus: { OFFLINE: 1 }, requestsByType: { DELIVERY: 6, AUTO_CHARGING: 2 }, succeededJobs: 2, terminalJobs: 8, jobCompletionRatePercent: 25, openAlerts: 0, activeEmergencyIncidents: 0 };
const job = { jobId: id(2), jobCode: 'JOB-6EBE76D51CAC45B284A5', workflowId: id(3), status: 'SUCCEEDED', queuedAt: date };
await page.route('**/api/v1/**', async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  const reply = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  const list = content => reply({ content, totalElements: content.length, totalPages: 1, last: true });
  if (req.method() !== 'GET') {
    writes.push({ path, body: req.postDataJSON() });
    return reply({ ...setting, ...req.postDataJSON() });
  }
  reads.push(path + url.search);
  if (path === '/api/v1/auth/me') return reply({ username: 'admin', fullName: 'System Administrator', role: 'ADMIN' });
  if (path === '/api/v1/admin/audit-logs') return list(audit);
  if (path === '/api/v1/admin/system-settings') return list([setting]);
  if (path === '/api/v1/admin/operations/retention/policies') return reply(policies);
  if (path === `/api/v1/admin/system-settings/${id(1)}`) return reply(setting);
  if (path === '/api/v1/admin/reports/overview') return reply(overview);
  if (path === `/api/v1/admin/workflows/${id(3)}`) return reply({ workflow: { workflowId: id(3), workflowName: 'Giao thuốc đến phòng bệnh' } });
  if (path === '/api/v1/jobs') return list([job]);
  if (path === '/api/v1/robots') return list([{ robotId: id(5), robotName: 'MediAssist Rover', status: 'OFFLINE' }]);
  if (path === '/api/v1/service-requests') return list([{ serviceRequestId: id(6), requestCode: 'REQ-1234567890ABCDEF', requestType: 'DELIVERY', status: 'RECOVERY_REQUIRED', requestedAt: date }]);
  return list([]);
});
const go = section => page.goto(`http://127.0.0.1:5173/admin?screen=${encodeURIComponent(section)}`);
const screenshot = name => page.screenshot({ path: `.workstation-build/presentation-${name}.png`, fullPage: true });
try {
  await mkdir('.workstation-build', { recursive: true });
  await go('Audit Logs');
  await page.locator('.be-records button').nth(19).waitFor({ state: 'attached' });
  assert.match(await page.locator('.be-records').innerText(), /Đăng nhập thành công/);
  assert.ok(!await page.locator('.be-records').innerText().then(text => text.includes('Bản ghi')));
  assert.ok(await page.locator('.be-records').evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight <= 650));
  await screenshot('audit');

  await go('System Settings');
  await page.locator('.be-records button').first().click();
  await page.locator('.be-record-detail').getByText('30 giây', { exact: true }).waitFor();
  assert.equal(await page.locator('.be-record-detail').getByText('Số', { exact: true }).count(), 1);
  assert.equal(await page.locator('.be-record-detail').getByText(setting.description, { exact: true }).count(), 0);
  await screenshot('settings');
  await page.locator('.be-technical > summary').click();
  assert.ok(await page.getByText(setting.settingKey, { exact: true }).isVisible());
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByText('Đã lưu thành công.', { exact: true }).waitFor();
  assert.equal(writes.at(-1).path, `/api/v1/admin/system-settings/${id(1)}`);
  assert.equal(writes.at(-1).body.dataType, 'NUMBER');
  assert.deepEqual(writes.at(-1).body.settingValue, { value: 30 });
  await dialog.getByRole('button', { name: 'Hoàn tất', exact: true }).click();

  await page.getByRole('navigation', { name: 'Danh mục chức năng' }).getByRole('button', { name: 'Lưu trữ dữ liệu', exact: true }).click();
  await page.getByText('10 chính sách lưu trữ', { exact: true }).waitFor();
  const titles = await page.locator('.be-records strong').allTextContents();
  assert.equal(new Set(titles).size, 10);
  assert.ok(titles.every(title => title !== 'Bản ghi' && !title.includes('_')));
  assert.equal(await page.locator('.be-list-head').getByText('Trang 1', { exact: true }).count(), 0);
  await page.locator('.be-records button').filter({ hasText: 'Nhật ký kiểm toán' }).click();
  await page.locator('.be-record-detail h3').getByText('Nhật ký kiểm toán', { exact: true }).waitFor();
  await screenshot('retention');

  await go('Missions');
  await page.locator('.be-filter > summary').click();
  const status = page.locator('.be-filter').getByLabel('Trạng thái', { exact: true });
  await status.selectOption('RECOVERY_REQUIRED');
  assert.equal(await status.locator('option:checked').innerText(), 'Cần phục hồi');
  const filtered = page.waitForRequest(req => new URL(req.url()).pathname === '/api/v1/service-requests' && new URL(req.url()).searchParams.get('status') === 'RECOVERY_REQUIRED');
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
  await filtered;
  await page.getByText('1 đang áp dụng', { exact: true }).waitFor();
  await page.locator('.be-records button').first().waitFor();
  await screenshot('filters');
  const unfiltered = page.waitForRequest(req => new URL(req.url()).pathname === '/api/v1/service-requests' && !new URL(req.url()).searchParams.has('status'));
  await page.getByRole('button', { name: 'Đặt lại', exact: true }).click();
  await unfiltered;
  assert.equal(await status.inputValue(), '');

  await go('Analytics');
  await page.locator('.be-report-metrics strong').first().waitFor();
  assert.equal(await page.locator('.be-report-metrics strong').nth(1).innerText(), '25%');
  assert.ok(!await page.locator('.be-report').innerText().then(text => /jobsByStatus|generated At|RECOVERY_REQUIRED/.test(text)));
  await screenshot('analytics');

  await go('Dashboard');
  await page.locator('.be-dashboard-list').getByText('Giao thuốc đến phòng bệnh', { exact: true }).waitFor();
  assert.ok(!await page.locator('.be-dashboard').innerText().then(text => text.includes('JOB-')));
  await screenshot('dashboard');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const section of ['Dashboard', 'Analytics', 'System Settings', 'Missions']) {
    await go(section);
    await page.locator('.be-workspace').first().waitFor();
    if (section === 'Missions') await page.locator('.be-filter > summary').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${section} should fit mobile`);
  }
  await screenshot('mobile');
  assert.deepEqual(errors, []);
  console.log('PASS: localized audit/settings/reports/dashboard, raw setting lookup & update, filter wire values/reset, bounded list, mobile layout.');
} finally { await browser.close(); }
