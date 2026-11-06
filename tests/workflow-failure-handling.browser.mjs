import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { graphDetail } from './fixtures/workflow-happy-path.mjs';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5186';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const writes = [], errors = [];
let readFailure = false, release = null;
let state = { enabled: true, failure: { caseId: 'case-1', jobId: 'fixture-job', stepName: 'Di chuyển A', errorCode: 'MOVE_FAILED', status: 'OPEN', acknowledgeDeadline: '2026-11-06T01:02:00Z', resolutionDeadline: '2026-11-06T01:10:00Z', canAcknowledge: true, canEscalate: true } };
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'failure-test' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (method !== 'GET') writes.push({ path, method, body: req.postData() ? req.postDataJSON() : null });
  if (path === '/api/v1/admin/workflows/graph') return respond(graphDetail(req.postDataJSON(), 'saved'));
  if (path === '/api/v1/jobs') return respond({ content: [{ jobId: 'fixture-job', jobCode: 'JOB-FAILURE', status: 'RECOVERY_REQUIRED', beOrchestrated: true, schemaVersion: 3, rowVersion: 1, queuedAt: '2026-11-06T01:00:00Z' }], last: true });
  if (path === '/api/v1/jobs/fixture-job') return respond({ job: { jobId: 'fixture-job', jobCode: 'JOB-FAILURE', status: 'RECOVERY_REQUIRED', beOrchestrated: true, schemaVersion: 3, rowVersion: 1, queuedAt: '2026-11-06T01:00:00Z' }, tasks: [], steps: [] });
  if (path === '/api/v1/alerts') return respond({ content: [{ alertId: 'alert-1', notificationType: 'WORKFLOW_FAILURE', severity: 'WARNING', status: 'ACKNOWLEDGED', message: 'MOVE_FAILED · cần xử lý job', requireAck: true, dataJson: { job_id: 'fixture-job' }, createdAt: '2026-11-06T01:00:00Z' }], last: true });
  if (path === '/api/v1/alerts/alert-1') return respond({ alertId: 'alert-1', notificationType: 'WORKFLOW_FAILURE', severity: 'WARNING', status: 'ACKNOWLEDGED', message: 'MOVE_FAILED · cần xử lý job', requireAck: true, dataJson: { job_id: 'fixture-job' }, createdAt: '2026-11-06T01:00:00Z' });
  if (path.endsWith('/failure-handling') && method === 'GET') return readFailure ? respond({ message: 'Failure service unavailable' }, 503) : respond(state);
  if (path.endsWith('/failure-handling/acknowledge')) {
    await new Promise(resolve => { release = resolve; });
    state = { enabled: true, failure: { ...state.failure, status: 'ACKNOWLEDGED', handlerAccountId: 'staff-1', handlerName: 'Nhân viên 1' } };
    return respond(state);
  }
  if (path.endsWith('/failure-handling/escalate')) {
    state = { enabled: true, failure: { ...state.failure, status: 'ESCALATED', escalatedAt: '2026-11-06T01:03:00Z', handlerAccountId: null, handlerName: null, note: req.postDataJSON().note, canAcknowledge: false, canEscalate: false } };
    return respond(state);
  }
  if (method === 'GET') return respond({ content: [], last: true });
  return respond({ message: 'Unexpected write' }, 500);
});
try {
  await page.goto(base + '/workflow');
  await page.getByRole('button', { name: '＋ Tạo quy trình', exact: true }).first().click();
  await expect(page.getByLabel('Dừng luồng và báo Staff / Admin')).toBeChecked();
  await page.getByLabel('Thời hạn tiếp nhận lỗi (giây)', { exact: true }).fill('90');
  await page.getByLabel('Thời hạn xử lý sau khi tiếp nhận (giây)', { exact: true }).fill('300');
  await page.getByLabel('Báo Admin ngay khi có lỗi').check();
  await page.locator('.wfd-palette-list button').filter({ has: page.locator('strong', { hasText: /^Chờ$/ }) }).click();
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu đầy đủ');
  const policy = writes[0].body.workflow.inputUiJson.failureHandling;
  assert.deepEqual(policy, { version: 1, enabled: true, acknowledgeTimeoutSec: 90, resolutionTimeoutSec: 300, notifyAdminImmediately: true });
  await page.getByRole('button', { name: 'Thông tin & biến', exact: true }).click();
  await page.getByLabel('Thời hạn tiếp nhận lỗi (giây)', { exact: true }).fill('0');
  const before = writes.length;
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.locator('.wfd-validation')).toContainText('Thời hạn tiếp nhận');
  assert.equal(writes.length, before);
  await page.goto(base + '/tests/workflow-failure-handling.fixture.html');
  const panel = page.getByLabel('Tiếp nhận và chuyển cấp lỗi');
  await expect(panel).toContainText('MOVE_FAILED');
  await expect(panel.getByRole('button', { name: 'Không xử lý được · Chuyển Admin', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Tiếp nhận xử lý lỗi', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Tiếp nhận xử lý lỗi', exact: true })).toBeDisabled();
  await expect.poll(() => writes.filter(w => w.path.endsWith('/acknowledge')).length).toBe(1);
  release();
  await expect(panel).toContainText('Người tiếp nhận: Nhân viên 1');
  await panel.getByLabel('Lý do chuyển Admin').fill('Đã kiểm tra nhưng cần Admin hỗ trợ định vị.');
  await panel.getByRole('button', { name: 'Không xử lý được · Chuyển Admin', exact: true }).click();
  await expect(panel).toContainText('Đã chuyển Admin hỗ trợ');
  assert.equal(writes.find(w => w.path.endsWith('/escalate')).body.note, 'Đã kiểm tra nhưng cần Admin hỗ trợ định vị.');
  await expect(panel.getByRole('button', { name: 'Tiếp nhận xử lý lỗi', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Kiểm tra để kết thúc job', exact: true }).click();
  await expect(page.getByText('Xác minh bằng chứng dừng trước khi kết thúc job', { exact: true })).toBeVisible();
  readFailure = true;
  await page.getByRole('button', { name: 'Làm mới hồ sơ', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Failure service unavailable');
  readFailure = false;
  await page.goto(base + '/admin/alerts');
  await page.locator('.be-records button').first().click();
  const jobLink = page.getByRole('link', { name: 'Mở công việc để tiếp nhận hoặc chuyển Admin →', exact: true });
  await expect(jobLink).toHaveAttribute('href', '/admin/live-operations?jobId=fixture-job');
  await expect(page.locator('.be-record-detail .be-actions button')).toHaveCount(0);
  await jobLink.click();
  await expect(page.locator('.lo-explorer')).toHaveAttribute('open', '');
  await expect(page.locator('.lo-detail').getByLabel('Tiếp nhận và chuyển cấp lỗi')).toContainText('Đã chuyển Admin hỗ trợ');
  await mkdir('.workstation-build/workflow-failure-handling', { recursive: true });
  await page.screenshot({ path: '.workstation-build/workflow-failure-handling/job-case.png', fullPage: true });
  assert.ok(!writes.some(w => /reconcile|cancel|resume|\/jobs$/.test(w.path)));
  assert.deepEqual(errors, []);
  console.log('PASS: failure policy editor and invalid deadline guard, durable case UI, single pending acknowledgement, manual escalation, backend failure handling and separate evidence-based closure; all APIs mocked.');
} finally { await browser.close(); }
