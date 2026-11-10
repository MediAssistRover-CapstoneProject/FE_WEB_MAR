import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5198', output = '.workstation-build/monitoring-workspace';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
page.setDefaultTimeout(10000);
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const account = { accountId: id(1), username: 'admin', fullName: 'Quản trị viên', role: 'ADMIN' };
let responseAccount = account;
const robotId = id(2), workflowId = id(3), zoneId = id(4), mapId = id(5), jobId = id(6);
const now = () => new Date().toISOString();
const alerts = [
  { alertId: id(11), rowVersion: 1, notificationType: 'LOW_BATTERY', severity: 'WARNING', status: 'OPEN', message: 'Robot cần được đưa về vị trí sạc.', requireAck: true, ackPolicy: 'ANY', createdAt: now(), recipients: [{ accountId: account.accountId }] },
  { alertId: id(12), rowVersion: 1, notificationType: 'DELIVERY_ARRIVED', severity: 'INFO', status: 'OPEN', message: 'Robot đã đến phòng 305.', requireAck: false, createdAt: now(), recipients: [] },
  { alertId: id(13), rowVersion: 1, notificationType: 'WORKFLOW_FAILURE', severity: 'CRITICAL', status: 'OPEN', message: 'Công việc cần đối soát.', requireAck: true, createdAt: now(), dataJson: { job_id: jobId }, recipients: [{ accountId: account.accountId }] },
];
const auditRows = Array.from({ length: 45 }, (_, index) => ({ auditLogId: id(100 + index), accountId: index === 0 ? id(77) : index % 2 ? account.accountId : id(88), actorUsername: index === 0 ? 'other-admin' : index % 2 ? 'admin' : 'staff', actionCode: index % 2 ? 'TOKEN_REFRESHED' : 'WORKFLOW_PUBLISHED', entityType: index % 2 ? 'Account' : 'Workflow', entityId: workflowId, occurredAt: now(), beforeData: { status: 'DRAFT' }, afterData: { status: 'PUBLISHED' } }));
const detection = { detectionEventId: id(201), robotId, mapId, zoneId, eventType: 'SUSPECTED_FALL', confidenceScore: .92, xM: 2.2, yM: 3.1, locationBasis: 'OBJECT', evidenceRef: 'javascript:alert(1)', detectedAt: now() };
const job = { jobId, jobCode: 'JOB-MONITOR-01', workflowCode: 'DELIVERY-01', robotCode: 'MAR-01', status: 'SUCCEEDED', startedAt: now(), durationSeconds: 65 };
const reads = [], writes = [], errors = [];
let failAlerts = false, delayAlerts = 0;
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(account => { if (!localStorage.getItem('mediassist-rover.session')) localStorage.setItem('mediassist-rover.session', JSON.stringify({ account, tokens: { accessToken: 'fixture' } })); }, account);
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, query = Object.fromEntries(url.searchParams);
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const reply = (json, status = 200) => route.fulfill({ json, status });
  const list = rows => { const size = Number(query.size || 20), page = Number(query.page || 0); return reply({ content: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), last: (page + 1) * size >= rows.length }); };
  if (request.method() !== 'GET') {
    writes.push({ path, method: request.method() });
    const alert = alerts.find(row => path.includes(row.alertId));
    assert.ok(alert, 'only explicit alert mutations are permitted in this fixture');
    const action = path.split('/').at(-1), states = { acknowledge: ['OPEN', 'ACKNOWLEDGED'], resolve: ['ACKNOWLEDGED', 'RESOLVED'], close: ['RESOLVED', 'CLOSED'] };
    assert.equal(alert.status, states[action][0]); alert.status = states[action][1]; alert.rowVersion++;
    if (action === 'acknowledge') alert.recipients[0].acknowledgedAt = now();
    return reply(alert);
  }
  reads.push({ path, query });
  if (path === '/api/v1/auth/me') return reply(responseAccount);
  if (path === '/api/v1/alerts') {
    if (Number(query.size) === 20 && delayAlerts) await new Promise(resolve => setTimeout(resolve, delayAlerts));
    if (Number(query.size) === 20 && failAlerts) return reply({ message: 'Mất kết nối thử nghiệm' }, 503);
    return list(alerts.filter(row => (!query.status || row.status === query.status) && (!query.severity || row.severity === query.severity) && (!query.type || row.notificationType === query.type)));
  }
  const alert = alerts.find(row => path === `/api/v1/alerts/${row.alertId}`); if (alert) return reply(alert);
  if (path === '/api/v1/robots') return list([{ robotId, robotName: 'MAR-01', robotCode: 'MAR-01' }]);
  if (path === '/api/v1/maps') return list([{ mapId, mapName: 'Tầng 3' }]);
  if (path === '/api/v1/zones') return list([{ zoneId, zoneName: 'Khu khám bệnh' }]);
  if (path === '/api/v1/workflows/published') return reply([{ workflowId, workflowCode: 'DELIVERY-01', workflowName: 'Giao thuốc', versionNo: 1 }]);
  if (path === '/api/v1/admin/staff') return list([{ account: { accountId: id(88), username: 'staff', fullName: 'Nhân viên' } }]);
  if (path === '/api/v1/admin/audit-logs') return list(auditRows.filter(row => (!query.accountId || query.accountId === row.accountId) && (!query.actionCode || query.actionCode === row.actionCode) && (!query.entityType || query.entityType === row.entityType)));
  const audit = auditRows.find(row => path === `/api/v1/admin/audit-logs/${row.auditLogId}`); if (audit) return reply(audit);
  if (path === '/api/v1/admin/monitoring/detections') return list([detection]);
  if (path === `/api/v1/admin/monitoring/detections/${detection.detectionEventId}`) return reply(detection);
  if (path === '/api/v1/admin/reports/overview') return reply({ succeededJobs: 42, terminalJobs: 50, jobCompletionRatePercent: 84, openAlerts: 2, activeEmergencyIncidents: 0, generatedAt: now(), jobsByStatus: { SUCCEEDED: 42, FAILED: 8 }, robotsByStatus: { IDLE: 1 }, requestsByType: { DELIVERY: 50 } });
  if (path.startsWith('/api/v1/admin/reports/')) {
    assert.ok(query.from && query.to, 'reports always include the required applied range');
    if (path.endsWith('/export.csv')) return route.fulfill({ contentType: 'text/csv', body: 'jobCode,status\nJOB-MONITOR-01,SUCCEEDED' });
    if (path.endsWith('/jobs')) return list(query.status === 'FAILED' ? [] : [job]);
    if (path.endsWith('/analytics')) return reply({ generatedAt: now(), from: query.from, to: query.to, timezone: query.timezone, interval: query.interval, jobs: { total: 50, succeeded: 42, failed: 8, recoveryRequired: 0, successRatePercent: 84, averageDurationSeconds: 75, p95DurationSeconds: 120 }, timeline: [{ start: query.from, localLabel: 'Ngày 1', succeeded: 12, failed: 3, recoveryRequired: 0 }, { start: query.to, localLabel: 'Ngày 2', succeeded: 30, failed: 5, recoveryRequired: 0 }], jobsByWorkflow: [{ key: 'DELIVERY-01', label: 'Giao thuốc', total: 50, successRatePercent: 84 }], jobsByRobot: [{ key: 'MAR-01', label: 'MAR-01', total: 50, successRatePercent: 84 }], activityByMap: [], activityByZone: [], deliveries: { delivered: 42 }, emergencies: { averageAcknowledgementSeconds: 20 }, monitoring: { suspectedFalls: 1 } });
  }
  return list([]);
});
const screenshot = async name => { await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); };
const confirm = async () => { const dialog = page.getByRole('dialog'); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click(); };
try {
  await mkdir(output, { recursive: true });
  await page.goto(`${base}/admin/alerts`);
  await page.getByRole('button', { name: /Pin robot thấp/ }).click();
  const detail = page.getByRole('region', { name: 'Chi tiết cảnh báo', exact: true });
  await expect(detail.getByRole('button', { name: 'Tiếp nhận', exact: true })).toBeEnabled();
  await expect(detail.getByRole('button', { name: 'Xử lý xong', exact: true })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Đóng cảnh báo', exact: true })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Tiếp nhận', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Vui lòng kiểm tra');
  alerts[0].rowVersion++;
  await confirm();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('đã thay đổi');
  assert.equal(writes.length, 0, 'changed intent is never submitted');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  for (const action of ['Tiếp nhận', 'Xử lý xong', 'Đóng cảnh báo']) {
    await detail.getByRole('button', { name: action, exact: true }).click(); await confirm();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  assert.deepEqual(writes.map(row => row.path.split('/').at(-1)), ['acknowledge', 'resolve', 'close']);
  await page.getByRole('button', { name: /Robot đã đến điểm giao/ }).click();
  await expect(detail.getByText('Thông báo này không yêu cầu xác nhận tiếp nhận.')).toBeVisible();
  await expect(detail.locator('.mw-alert-actions button')).toHaveCount(0);
  await page.getByRole('button', { name: /Công việc cần xử lý lỗi/ }).click();
  await expect(detail.getByRole('link', { name: 'Mở công việc liên quan →' })).toHaveAttribute('href', `/admin/live-operations?jobId=${jobId}`);
  await expect(detail.locator('.mw-alert-actions button')).toHaveCount(0);
  const retained = await detail.getByRole('heading', { name: 'Công việc cần xử lý lỗi', exact: true }).elementHandle();
  delayAlerts = 450;
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  assert.ok(await retained.evaluate(node => node.isConnected), 'refresh retains the selected detail DOM');
  await expect(page.getByRole('button', { name: 'Tải lại', exact: true })).toBeEnabled();
  failAlerts = true;
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Mất kết nối thử nghiệm');
  await expect(page.getByRole('button', { name: /Robot đã đến điểm giao/ })).toBeVisible();
  await screenshot('alerts'); failAlerts = false; delayAlerts = 0;

  await page.goto(`${base}/admin/analytics?tab=analytics`);
  await expect(page.getByRole('img', { name: 'Số công việc thành công và thất bại theo thời gian' })).toBeVisible();
  await expect(page.getByText('Thiếu bộ lọc from.')).toHaveCount(0);
  await page.getByRole('button', { name: '30 ngày', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tải lại', exact: true })).toBeEnabled();
  const rangeQuery = reads.filter(row => row.path.endsWith('/reports/analytics')).at(-1).query;
  assert.equal(rangeQuery.timezone, 'Asia/Ho_Chi_Minh');
  await screenshot('analytics');
  await page.locator('.mw-breakdown').getByRole('button', { name: 'Giao thuốc →', exact: true }).click();
  await expect(page.getByRole('link', { name: job.jobCode })).toBeVisible();
  await page.getByLabel('Trạng thái công việc', { exact: true }).selectOption('FAILED');
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất CSV', exact: true }).click()]);
  let csv = reads.filter(row => row.path.endsWith('/jobs/export.csv')).at(-1).query;
  assert.equal(csv.workflowId, workflowId, 'backend workflow codes resolve to their exact filter UUID');
  assert.equal(csv.from, rangeQuery.from); assert.equal(csv.to, rangeQuery.to); assert.equal(csv.status, undefined, 'unapplied draft filters never leak into export');
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có công việc phù hợp', exact: true })).toBeVisible();
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất CSV', exact: true }).click()]);
  csv = reads.filter(row => row.path.endsWith('/jobs/export.csv')).at(-1).query;
  assert.equal(csv.status, 'FAILED'); await screenshot('job-report');

  await page.goto(`${base}/admin/audit-logs`);
  await expect(page.getByRole('table', { name: 'Nhật ký hoạt động hệ thống' })).toBeVisible();
  await expect(page.getByLabel('Người thực hiện', { exact: true }).getByRole('option', { name: 'other-admin', exact: true })).toHaveCount(1);
  await page.getByLabel('Người thực hiện', { exact: true }).selectOption(id(77));
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  assert.equal(reads.filter(row => row.path.endsWith('/audit-logs')).at(-1).query.accountId, id(77));
  await page.getByRole('table').getByRole('button').first().click();
  await expect(page.getByRole('region', { name: 'Chi tiết nhật ký kiểm toán', exact: true }).getByText('Trước thay đổi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Chi tiết nhật ký kiểm toán', exact: true })).toBeVisible();
  await screenshot('audit');

  await page.goto(`${base}/admin/history-replay?tab=crowd-density`);
  await expect(page.locator('.mw-page').getByRole('heading', { name: 'Lịch sử giám sát', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mật độ người', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Loại dữ liệu giám sát', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Nghi ngờ té ngã/ }).click();
  await expect(page.getByText('Vị trí đối tượng (m)', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Mở nguồn bằng chứng/ })).toHaveCount(0);
  await screenshot('history');
  for (const [route, name] of [['alerts', 'Cảnh báo'], ['analytics?tab=analytics', 'Phân tích vận hành'], ['audit-logs', 'Nhật ký kiểm toán'], ['history-replay', 'Lịch sử giám sát']]) {
    await page.goto(`${base}/admin/${route}`);
    await expect(page.locator('.mw-page').getByRole('heading', { name, exact: true })).toBeVisible();
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} fits ${width}px`);
      await screenshot(`${route.split('?')[0]}-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const protectedReads = reads.filter(row => row.path.includes('/audit-logs')).length;
  responseAccount = { ...account, role: 'STAFF' };
  await page.evaluate(() => { const session = JSON.parse(localStorage.getItem('mediassist-rover.session')); session.account.role = 'STAFF'; localStorage.setItem('mediassist-rover.session', JSON.stringify(session)); });
  await page.goto(`${base}/admin/audit-logs`);
  await expect(page.getByText('Tài khoản này không có quyền xem mục giám sát này.', { exact: true })).toBeVisible();
  assert.equal(reads.filter(row => row.path.includes('/audit-logs')).length, protectedReads, 'staff cannot trigger admin audit requests');
  const staffReadStart = reads.length;
  await page.goto(`${base}/admin/alerts`);
  await expect(page.locator('.mw-page').getByRole('heading', { name: 'Cảnh báo', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng quản trị' }).getByRole('button', { name: 'Nhật ký kiểm toán', exact: true })).toHaveCount(0);
  assert.ok(reads.slice(staffReadStart).filter(row => row.path === '/api/v1/alerts').every(row => row.query.size !== '1'), 'staff views do not read extra alerts only to build counters');
  assert.ok(reads.every(row => !/\/monitoring\/(crowd-density|heatmaps)(?:\/|$)/.test(row.path)), 'removed density views never request their APIs, including old tab URLs');
  assert.equal(writes.length, 3); assert.deepEqual(errors, []);
  console.log('PASS: four monitoring pages, lifecycle actions, changed-intent preflight, retained refresh/failure, default report dates, filtered CSV, admin/staff actor search, scoped roles, detection evidence and removed density routes and 390/1024/1440 layouts. All APIs mocked.');
} finally { await screenshot('last-state').catch(() => {}); await browser.close(); }
