import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5187';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
const id = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
await page.addInitScript(() => { if (!localStorage.getItem('mediassist-rover.session')) localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', username: 'settings-test', accountId: 'admin' }, tokens: { accessToken: 'fixture' } })); });
const errors = [], calls = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
let conflict = false, failSettings = false;
const settings = [
  { systemSettingId: id(1), settingKey: 'operations.robot_offline_threshold_seconds', settingValue: { value: 30 }, dataType: 'NUMBER', category: 'OPERATIONS', description: 'Backend description', publicSetting: false },
  { systemSettingId: id(2), settingKey: 'retention.alert_days', settingValue: { value: 1095 }, dataType: 'NUMBER', category: 'RETENTION', publicSetting: false },
  { systemSettingId: id(3), settingKey: 'retention.execution_enabled', settingValue: { value: true }, dataType: 'BOOLEAN', category: 'RETENTION', publicSetting: false },
  { systemSettingId: id(4), settingKey: 'retention.default_mode', settingValue: { value: 'ARCHIVE' }, dataType: 'STRING', category: 'RETENTION', publicSetting: false },
  { systemSettingId: id(5), settingKey: 'custom.technical-setting', settingValue: { value: { internal: true } }, dataType: 'OBJECT', category: 'CUSTOM', publicSetting: false },
];
const datasets = ['alert_recipient', 'alert', 'emergency_incident', 'detection_event', 'job_event', 'robot_status_history', 'robot_location_history', 'crowd_density_record', 'heatmap_record', 'audit_log'];
const status = { observedAt: new Date().toISOString(), rollout: { mode: 'DRAINING', dispatchHalted: false, revision: 7 }, mqttEnabled: true, brokerConnected: true, dispatchConfigured: true, dispatchEffective: true, legacyJobsBlockingCutover: 0, robots: [{ robotId: id(6), handshakeAccepted: true, handshakeAcked: true, dispatchReady: true, heartbeatAgeSeconds: 2 }], unpublished: { count: 1 }, inbox: { count: 2 }, eventAcks: { count: 0 }, recoveryJobs: 0, workflows: [] };
const policies = () => datasets.map(dataset => ({ dataset, retentionDays: ['alert', 'alert_recipient'].includes(dataset) ? settings.find(row => row.settingKey === 'retention.alert_days').settingValue.value : 365, mode: 'ARCHIVE' }));
await page.route('**/api/v1/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  calls.push(`${method} ${path}${url.search}`);
  const json = (value, status = 200) => route.fulfill({ status, json: value });
  const list = content => json({ content, totalPages: 1, last: true });
  assert.equal(request.headers().authorization, 'Bearer fixture');
  if (method === 'GET') {
    if (path === '/api/v1/admin/system-settings') return failSettings ? json({ message: 'Không tải được cấu hình thử nghiệm' }, 503) : list(settings);
    if (path === '/api/v1/rooms') return list([{ roomId: id(7), roomName: 'Phòng trực trung tâm', active: true }, { roomId: id(8), roomName: 'Phòng đã đóng', active: false }]);
    if (path === '/api/v1/robots') return list([{ robotId: id(6), robotName: 'MAR-01' }]);
    if (path === '/api/v1/admin/mqtt-rollout') { assert.equal(url.search, ''); return json(status); }
    if (path.endsWith('/retention/policies')) { assert.equal(url.search, ''); return json(policies()); }
    return list([]);
  }
  const body = request.postData() ? request.postDataJSON() : undefined;
  writes.push({ path: path + url.search, method, body });
  if (path.startsWith('/api/v1/admin/system-settings')) {
    assert.ok(body.settingValue && Object.hasOwn(body.settingValue, 'value'));
    if (method === 'PUT') {
      const row = settings.find(row => path.endsWith(row.systemSettingId)); assert.ok(row);
      Object.assign(row, body); return json(row);
    }
    assert.equal(method, 'POST');
    assert.ok(body.settingKey); const row = { ...body, systemSettingId: id(9) }; settings.push(row); return json(row, 201);
  }
  if (path === '/api/v1/admin/mqtt-rollout') {
    assert.equal(method, 'PUT'); assert.equal(body.expectedRevision, status.rollout.revision);
    if (conflict) { conflict = false; status.rollout.revision++; return json({ message: 'revision changed' }, 409); }
    assert.ok(body.note.trim()); status.rollout = { ...body, revision: status.rollout.revision + 1 }; status.dispatchEffective = !body.dispatchHalted; return json(status.rollout);
  }
  assert.equal(path, '/api/v1/admin/operations/retention/runs');
  assert.equal(method, 'POST'); assert.equal(body, undefined);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  return json({ dryRun, executionEnabled: settings.find(row => row.settingKey === 'retention.execution_enabled').settingValue.value, completedAt: new Date().toISOString(), datasets: policies().map(policy => ({ ...policy, eligible: 15, archived: dryRun ? 0 : 15, deleted: dryRun ? 0 : 15 })) });
});
const button = name => page.getByRole('button', { name, exact: true });
const form = name => page.getByRole('form', { name, exact: true });
const snapshot = async name => page.screenshot({ path: `.workstation-build/system-settings/${name}.png`, fullPage: true });
await mkdir('.workstation-build/system-settings', { recursive: true });
try {
  await page.goto(`${base}/admin/system-settings`);
  const offline = form('Thời gian báo robot mất kết nối');
  await expect(offline.getByRole('spinbutton')).toHaveValue('30');
  await expect(page.locator('code').getByText('custom.technical-setting', { exact: true })).not.toBeVisible();
  assert.equal(writes.length, 0, 'Reading settings never changes backend state');
  await snapshot('general-desktop');
  await offline.getByRole('spinbutton').fill('5'); await offline.getByRole('button', { name: 'Lưu', exact: true }).click();
  assert.equal(writes.length, 0, 'Out-of-range offline threshold cannot be submitted');
  await offline.getByRole('spinbutton').fill('60');
  await offline.evaluate(node => { node.requestSubmit(); node.requestSubmit(); });
  await expect(offline.getByRole('status')).toHaveText('Đã lưu cấu hình.');
  assert.equal(writes.length, 1, 'Duplicate submissions must not send duplicate writes');
  assert.deepEqual(writes[0].body, { settingValue: { value: 60 }, dataType: 'NUMBER', category: 'OPERATIONS', description: 'Backend description', publicSetting: false });
  const sos = form('Phòng tiếp nhận SOS');
  await expect(sos.locator('option').filter({ hasText: 'Phòng đã đóng' })).toBeDisabled();
  await sos.getByRole('combobox').selectOption(id(7)); await sos.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sos.getByRole('status')).toBeVisible();
  assert.equal(writes[1].method, 'POST'); assert.equal(writes[1].body.settingKey, 'sos.monitoring-room-id');
  await button('Chẩn đoán MQTT').click();
  await expect(page.getByRole('cell', { name: 'MAR-01', exact: true })).toBeVisible();
  await expect(page.getByLabel('Lý do thay đổi')).not.toBeVisible();
  await snapshot('mqtt-desktop');
  await page.getByText('Điều khiển điều phối', { exact: false }).click();
  await page.getByLabel('Tạm ngừng phát lệnh mới').check();
  await page.getByLabel('Lý do thay đổi').fill('Bảo trì kết nối');
  conflict = true;
  await button('Lưu điều phối').click();
  await expect(page.getByRole('alert')).toContainText('Cấu hình đã được thay đổi ở nơi khác');
  await page.getByLabel('Tạm ngừng phát lệnh mới').check();
  await page.getByLabel('Lý do thay đổi').fill('Bảo trì sau khi tải lại');
  await button('Lưu điều phối').click();
  await expect(page.getByRole('status')).toContainText('Đã cập nhật điều phối MQTT.');
  assert.equal(writes.at(-1).body.expectedRevision, 8);
  await page.getByText('Chuyển chế độ tương thích', { exact: true }).click();
  await expect(page.getByLabel('Chế độ vận hành').locator('option[value="LEGACY_COMPATIBLE"]')).toHaveAttribute('disabled', '');
  await button('Lưu trữ dữ liệu').click();
  await expect(page.getByRole('row')).toHaveCount(11);
  await expect(page.getByText('10 nhóm dữ liệu', { exact: true })).toBeVisible();
  await expect(button('Thực hiện xử lý')).toHaveCount(0);
  await snapshot('retention-desktop');
  await page.getByRole('row').filter({ hasText: 'Người nhận cảnh báo' }).getByRole('button').click();
  const days = form('Thời hạn lưu');
  await days.getByRole('spinbutton').fill('730'); await days.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Người nhận cảnh báo' })).toContainText('730 ngày');
  assert.equal(writes.at(-1).path, `/api/v1/admin/system-settings/${id(2)}`);
  assert.deepEqual(writes.at(-1).body.settingValue, { value: 730 });
  await button('Chạy xem trước').click();
  await expect(page.getByText('Kết quả xem trước', { exact: true })).toBeVisible();
  assert.equal(writes.at(-1).path, '/api/v1/admin/operations/retention/runs?dryRun=true');
  await expect(button('Thực hiện xử lý')).toBeDisabled();
  await days.getByRole('spinbutton').fill('731'); await days.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Người nhận cảnh báo' })).toContainText('731 ngày');
  await expect(page.getByText('Kết quả xem trước', { exact: true })).toHaveCount(0);
  await expect(button('Thực hiện xử lý')).toHaveCount(0);
  await button('Chạy xem trước').click();
  await expect(page.getByText('Kết quả xem trước', { exact: true })).toBeVisible();
  await page.getByLabel('Tôi đã kiểm tra kết quả và xác nhận xử lý dữ liệu hết hạn.').check();
  await button('Thực hiện xử lý').click();
  await expect(page.getByText('Kết quả xử lý', { exact: true })).toBeVisible();
  assert.equal(writes.at(-1).path, '/api/v1/admin/operations/retention/runs?dryRun=false');
  await page.goto(`${base}/admin/system-settings?tab=robot-camera`);
  await expect(page.locator('.sys-panel-heading h2')).toHaveText('Vận hành chung');
  await expect(page.getByRole('navigation', { name: 'Danh mục chức năng' }).getByRole('button')).toHaveCount(3);
  await expect(button('Nguồn camera')).toHaveCount(0);
  await expect(page.getByLabel('URL video dự phòng từ robot')).toHaveCount(0);
  for (const width of [1100, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [tab, name] of [['settings', 'general'], ['mqtt', 'mqtt'], ['retention', 'retention']]) {
      await page.goto(`${base}/admin/system-settings?tab=${tab}`);
      await expect(page.locator('.sys-panel-heading h2')).toBeVisible();
      await expect(page.getByText('Đang tải cấu hình…', { exact: true })).toHaveCount(0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} must fit at ${width}px`);
      if (width === 390) await snapshot(`${name}-mobile`);
    }
  }
  failSettings = true;
  await page.goto(`${base}/admin/system-settings`);
  await expect(page.getByRole('alert')).toContainText('Không tải được cấu hình thử nghiệm');
  await expect(offline).toHaveCount(0);
  failSettings = false; await button('Tải lại').click();
  await expect(offline.getByRole('spinbutton')).toHaveValue('60');
  await page.evaluate(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'STAFF', username: 'staff' }, tokens: { accessToken: 'fixture' } })));
  const settingsReads = calls.filter(call => call.includes('/admin/system-settings')).length;
  await page.goto(`${base}/admin/system-settings`);
  await expect(page.getByRole('alert')).toContainText('Đăng nhập tài khoản quản trị viên');
  assert.equal(calls.filter(call => call.includes('/admin/system-settings')).length, settingsReads);
  await page.evaluate(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ mode: 'demo', account: { role: 'ADMIN', username: 'demo' } })));
  await page.goto(`${base}/admin/system-settings`);
  await expect(page.getByRole('alert')).toContainText('Đăng nhập tài khoản quản trị viên');
  assert.equal(calls.filter(call => call.includes('/admin/system-settings')).length, settingsReads);
  assert.deepEqual(errors, []);
  console.log('PASS: controller methods/payloads, bounds, SOS selection, MQTT revision conflict, retention policy keys and preview/execute gating, removed fallback-camera settings, load failure recovery, all tabs at 1500/1100/768/390px. All APIs mocked.');
} catch (error) {
  console.log(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('body *')].map(element => ({ tag: element.tagName, class: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width), scrollWidth: element.scrollWidth })).filter(item => item.right > innerWidth + 1).slice(0, 35) })));
  await snapshot('failure'); throw error;
} finally { await browser.close(); }
