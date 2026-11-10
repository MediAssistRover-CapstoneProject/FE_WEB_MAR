import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const id = number => `${String(number).padStart(8, '0')}-1111-4111-8111-111111111111`;
const fixture = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'fixture-token' } })));
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [], writes = [], reads = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = {
    job: { jobId: id(1), jobCode: 'JOB-RELIABLE', status: 'RUNNING', beOrchestrated: true, schemaVersion: 3, rowVersion: 5, robotId: id(2), selectedJobStepId: id(3), queuedAt: '2026-11-03T03:00:00Z' },
    steps: [{ jobStepId: id(3), rowVersion: 8, executionSequenceNo: 1, stepTypeSnapshot: 'HANDLE_PAYLOAD', startedAt: new Date().toISOString(), timeoutSecSnapshot: 180, status: 'RUNNING', attemptNo: 1, stepCodeSnapshot: 'LOAD', resolvedInputsJson: { items: [{ itemCode: 'A', quantity: 1 }] } }],
    robotStatus: 'IDLE', failDetails: false, failRobots: false, stream: false, slowInitial: false,
  };
  let detailReads = 0;
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    const robot = { robotId: id(2), robotName: 'MAR-01', status: state.robotStatus, lastHeartbeatAt: '2026-11-03T02:59:00Z' };
    if (request.method() !== 'GET') { writes.push({ path, body: request.postDataJSON() }); return reply({ accepted: true }); }
    reads.push(path);
    if (path === '/api/v1/auth/me') return reply({ username: 'admin', role: 'ADMIN' });
    if (path === '/api/v1/jobs') return reply({ content: [state.job], totalPages: 1, totalElements: 1, last: true });
    if (path === `/api/v1/jobs/${id(1)}`) {
      const snapshot = structuredClone({ job: state.job, steps: state.steps });
      const initial = detailReads++ === 0;
      if (initial && state.slowInitial) {
        snapshot.steps[0].status = 'PENDING'; snapshot.steps[0].rowVersion = 7;
        await new Promise(resolve => setTimeout(resolve, 700));
      }
      return state.failDetails ? reply({ message: 'Không liên lạc được máy chủ' }, 503) : reply(snapshot);
    }
    if (path.endsWith('/stream')) return state.stream
      ? route.fulfill({ status: 200, contentType: 'text/event-stream', body: `event: job-state\ndata: ${JSON.stringify({ job: state.job, steps: state.steps })}\n\n` })
      : reply({ message: 'Stream unavailable' }, 503);
    if (path === `/api/v1/robots/${id(2)}`) return state.failRobots ? reply({ message: 'Robot lookup failed' }, 503) : reply(robot);
    if (path === '/api/v1/robots') return state.failRobots ? reply({ message: 'Robot lookup failed' }, 503) : reply({ content: [robot], totalPages: 1, last: true });
    return reply({ content: [], totalPages: 0, totalElements: 0, last: true });
  });
  const start = async () => {
    await page.goto(`${base}/admin/live-operations`);
    await page.locator('.lo-explorer > summary').click();
    await page.locator('.lo-step').waitFor();
  };
  return { context, page, state, writes, reads, errors, start };
};

try {
  // Job rowVersion can stay unchanged while an individual step advances.
  const f = await fixture();
  f.state.stream = true; f.state.slowInitial = true;
  await f.start();
  assert.equal(await f.page.locator('.lo-step-running').count(), 1, 'old REST response must not overwrite the streamed step');
  await f.page.waitForTimeout(900);
  assert.equal(await f.page.locator('.lo-step-running').count(), 1);
  await f.page.getByLabel('Tự cập nhật', { exact: true }).uncheck();

  // On completion, keep the selected detail without moving the user's tab.
  f.state.job = { ...f.state.job, status: 'SUCCEEDED', rowVersion: 9 };
  f.state.steps[0] = { ...f.state.steps[0], status: 'SUCCEEDED', rowVersion: 9 };
  await f.page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await f.page.getByRole('button', { name: 'Xem trong lịch sử', exact: true }).waitFor();
  assert.equal(await f.page.locator('.lo-detail').count(), 1);
  assert.match(await f.page.locator('.lo-groups .is-active').innerText(), /Đang hoạt động/);
  assert.match(await f.page.locator('.lo-detail-kicker').innerText(), /Thành công/);
  assert.equal(await f.page.getByRole('button', { name: 'Yêu cầu hủy', exact: true }).count(), 0);
  await f.page.getByRole('button', { name: 'Xem trong lịch sử', exact: true }).click();
  await f.page.waitForFunction(() => document.querySelector('.lo-groups .is-active')?.textContent.includes('Lịch sử'));
  assert.deepEqual(f.errors, []); assert.equal(f.writes.length, 0);
  await f.context.close();

  // Freeze what the operator confirmed, then revalidate before the POST.
  const g = await fixture(); await g.start();
  await g.page.getByLabel('Tự cập nhật', { exact: true }).uncheck();
  await g.page.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).click();
  const dialog = g.page.getByRole('dialog'); await dialog.waitFor();
  await dialog.getByLabel('Tôi đã kiểm tra hàng đúng danh sách').check();
  g.state.job = { ...g.state.job, selectedJobStepId: id(4), rowVersion: 6 };
  g.state.steps = [{ ...g.state.steps[0], jobStepId: id(4), stepCodeSnapshot: 'UNLOAD', rowVersion: 1, resolvedInputsJson: { items: [{ itemCode: 'B', quantity: 1 }] } }];
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Bước hoặc yêu cầu xác nhận đã thay đổi' }).waitFor();
  assert.equal(g.writes.length, 0, 'changed step must never receive the old confirmation');
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();

  // Network failure keeps the old job status and clearly marks its freshness.
  g.state.failDetails = true;
  await g.page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await g.page.locator('.lo-detail .lo-data-age.is-stale').waitFor();
  assert.match(await g.page.locator('.lo-detail-kicker').innerText(), /Đang thực hiện/);
  assert.equal(g.writes.length, 0);
  assert.deepEqual(g.errors, []); await g.context.close();

  // Refresh robot availability at form-open and immediately before submission.
  const h = await fixture();
  h.state.job = { ...h.state.job, status: 'QUEUED', robotId: null, selectedJobStepId: null };
  await h.start(); await h.page.getByLabel('Tự cập nhật', { exact: true }).uncheck();
  h.state.robotStatus = 'BUSY';
  await h.page.getByRole('button', { name: 'Phân robot', exact: true }).click();
  const assignment = h.page.getByRole('dialog'); await assignment.waitFor();
  assert.equal(await assignment.getByRole('option', { name: 'MAR-01', exact: true }).count(), 0, 'busy robot from refreshed catalog must be excluded');
  await assignment.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  h.state.robotStatus = 'IDLE';
  await h.page.getByRole('button', { name: 'Phân robot', exact: true }).click();
  await assignment.getByRole('combobox').selectOption(id(2));
  h.state.robotStatus = 'BUSY';
  await assignment.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await assignment.getByRole('alert').filter({ hasText: 'Robot không còn rảnh' }).waitFor();
  assert.equal(h.writes.length, 0, 'robot becoming busy while the dialog is open must block submission');
  await assignment.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  h.state.failDetails = true;
  await h.page.getByRole('button', { name: 'Phân robot', exact: true }).click();
  await h.page.getByRole('alert').filter({ hasText: 'Không liên lạc được máy chủ' }).waitFor();
  assert.equal(await assignment.count(), 0, 'no unchecked form opens if preflight fails');
  assert.equal(h.writes.length, 0); assert.deepEqual(h.errors, []);
  await h.context.close();
  console.log('PASS: step-level synchronization, pinned completion, failed reads, frozen confirmations, fresh robot choices and submission-time validation. No robot commands sent.');
} finally { await browser.close(); }
