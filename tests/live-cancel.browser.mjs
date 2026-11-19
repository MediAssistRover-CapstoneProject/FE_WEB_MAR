import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const base = process.env.TEST_BASE_URL || 'http://localhost:5173';
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
await mkdir('.workstation-build/live-cancel', { recursive: true });

async function fixture(recovery = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'test-only' } })));
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const state = { job: { jobId: id(1), jobCode: 'JOB-CANCEL-TEST', robotId: id(2), workflowId: id(3), status: 'RUNNING', rowVersion: 1, beOrchestrated: true, schemaVersion: 3, queuedAt: new Date().toISOString() }, failCancel: false };
  if (recovery) state.job.status = 'RECOVERY_REQUIRED';
  const writes = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const reply = (json, status = 200) => route.fulfill({ status, json });
    if (request.method() === 'POST') {
      writes.push({ path, body: request.postDataJSON() });
      assert.equal(path, `/api/v1/jobs/${id(1)}/cancel`);
      if (state.failCancel) return reply({ message: 'Test server error' }, 503);
      state.job = { ...state.job, cancelRequestedAt: new Date().toISOString(), cancelCommandId: id(6), rowVersion: 2 };
      if (recovery) state.job = { ...state.job, status: 'CANCELLED', stopStatus: 'PENDING', endedAt: new Date().toISOString() };
      return reply(state.job);
    }
    if (path === '/api/v1/auth/me') return reply({ username: 'admin', role: 'ADMIN' });
    if (path === '/api/v1/jobs') return reply({ content: [state.job], totalPages: 1, last: true });
    if (path === `/api/v1/jobs/${id(1)}`) return reply({ job: state.job, steps: [] });
    if (path.endsWith('/stream')) return reply({}, 503);
    if (path.endsWith('/failure-handling')) return reply({ message: 'Optional failure API unavailable' }, 404);
    if (path === '/api/v1/robots') return reply({ content: [{ robotId: id(2), robotName: 'MAR-01', status: 'BUSY' }], last: true });
    if (path.endsWith('/snapshot')) return reply({ observedAt: new Date().toISOString(), robot: { robotId: id(2), status: 'BUSY' }, activeJobId: id(1), mqttConnected: true, heartbeatFresh: true });
    if (path === `/api/v1/robots/${id(2)}`) return reply({ robotId: id(2), status: 'BUSY' });
    if (path === '/api/v1/workflows/published') return reply({ content: [{ workflowId: id(3), workflowName: 'Dẫn đường' }], last: true });
    return reply({ content: [], totalPages: 1, last: true });
  });
  await page.goto(`${base}/admin/live-operations${recovery ? `?jobId=${id(1)}` : ''}`);
  try {
    await page.locator(recovery ? '.lo-failure-handling' : '.rm-current-actions').getByRole('button', { name: 'Hủy job', exact: true }).waitFor();
  } catch (error) {
    await page.screenshot({ path: '.workstation-build/live-cancel/failure.png', fullPage: true });
    console.error(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 2500) }));
    throw error;
  }
  return { context, page, state, writes, errors };
}

try {
  const f = await fixture();
  await f.page.locator('.rm-current-actions').getByRole('button', { name: 'Hủy job', exact: true }).click();
  const dialog = f.page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(f.writes.length, 0, 'opening cancellation never sends a robot command');
  await dialog.getByRole('textbox').fill('Đổi nhiệm vụ theo yêu cầu của quản trị viên.');
  await dialog.getByRole('checkbox').check();
  f.state.failCancel = true;
  await dialog.locator('button[type="submit"]').click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(f.writes.length, 1);
  assert.equal(f.state.job.cancelRequestedAt, undefined, 'failed cancel does not pretend success');
  f.state.failCancel = false;
  await dialog.locator('button[type="submit"]').dblclick();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes.length, 2, 'double click shares one submission');
  assert.deepEqual(f.writes[1], { path: `/api/v1/jobs/${id(1)}/cancel`, body: { reason: 'Đổi nhiệm vụ theo yêu cầu của quản trị viên.' } });
  await f.page.getByText('Đang chờ máy chủ và robot xác nhận hủy', { exact: true }).waitFor();
  assert.equal(await f.page.locator('.rm-current-actions').getByRole('button', { name: 'Hủy job', exact: true }).count(), 0);
  assert.equal(f.state.job.status, 'RUNNING', 'cancellation request does not claim the robot has stopped');
  await f.page.screenshot({ path: '.workstation-build/live-cancel/pending.png', fullPage: true });
  assert.deepEqual(f.errors, []); await f.context.close();

  const g = await fixture();
  await g.page.locator('.rm-current-actions').getByRole('button', { name: 'Hủy job', exact: true }).click();
  const staleDialog = g.page.getByRole('dialog'); await staleDialog.waitFor();
  await staleDialog.getByRole('textbox').fill('Yêu cầu hủy công việc.'); await staleDialog.getByRole('checkbox').check();
  g.state.job = { ...g.state.job, status: 'SUCCEEDED', rowVersion: 3 };
  await staleDialog.locator('button[type="submit"]').click();
  await staleDialog.getByRole('alert').waitFor();
  assert.equal(g.writes.length, 0, 'fresh preflight blocks cancellation after terminal transition');
  assert.deepEqual(g.errors, []); await g.context.close();

  const h = await fixture(true);
  const panel = h.page.locator('.lo-failure-handling');
  await panel.getByRole('alert').filter({ hasText: 'BE chưa cung cấp' }).waitFor();
  assert.equal(await h.page.locator('.lo-detail').getByRole('button', { name: 'Hủy job', exact: true }).count(), 1);
  await panel.getByRole('button', { name: 'Hủy job', exact: true }).click();
  const recoveryDialog = h.page.getByRole('dialog'); await recoveryDialog.waitFor();
  assert.equal(h.writes.length, 0);
  await recoveryDialog.getByRole('textbox').fill('Đã kiểm tra robot, hủy công việc lỗi.');
  await recoveryDialog.getByRole('checkbox').check();
  h.state.failCancel = true;
  await recoveryDialog.locator('button[type="submit"]').click();
  await recoveryDialog.getByRole('alert').waitFor();
  assert.equal(h.state.job.status, 'RECOVERY_REQUIRED');
  h.state.failCancel = false;
  await recoveryDialog.locator('button[type="submit"]').dblclick();
  await recoveryDialog.waitFor({ state: 'hidden' });
  await h.page.locator('.lo-detail-kicker').getByText('Đã hủy', { exact: true }).waitFor();
  await h.page.getByRole('button', { name: 'Xem trong lịch sử', exact: true }).waitFor();
  assert.equal(await h.page.locator('.lo-detail').getByRole('button', { name: 'Hủy job', exact: true }).count(), 0);
  assert.equal(h.writes.length, 2);
  assert.deepEqual(h.writes[1], { path: `/api/v1/jobs/${id(1)}/cancel`, body: { reason: 'Đã kiểm tra robot, hủy công việc lỗi.' } });
  await h.page.getByRole('button', { name: 'Xem trong lịch sử', exact: true }).click();
  await h.page.locator('.lo-job-item.is-selected').getByText('Đã hủy', { exact: true }).waitFor();
  await h.page.screenshot({ path: '.workstation-build/live-cancel/recovery-cancelled.png', fullPage: true });
  assert.deepEqual(h.errors, []); await h.context.close();
  console.log('PASS: active/recovery cancel buttons, reason payload, failure API independence, error/retry, duplicate guard, pending/terminal status, history and stale preflight; all mutations mocked.');
} finally { await browser.close(); }
