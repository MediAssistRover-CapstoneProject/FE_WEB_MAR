import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const output = '.workstation-build/live-operations';
await mkdir(output, { recursive: true });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
async function fixture() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'fixture-token' } })));
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const writes = [], reads = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = {
    job: { jobId: id(1), jobCode: 'JOB-UNDER-REVIEW', workflowId: id(5), robotId: id(2), status: 'RECOVERY_REQUIRED', beOrchestrated: true, schemaVersion: 3, rowVersion: 1, selectedJobStepId: id(3), queuedAt: '2026-11-02T03:00:00Z' },
    steps: [{ jobStepId: id(3), stepCodeSnapshot: 'MOVE_01', stepTypeSnapshot: 'MOVE', status: 'RECOVERY_REQUIRED', rowVersion: 1, executionSequenceNo: 1 }],
    evidence: { jobId: id(1), recoveryRequired: true, jobStepId: id(3), operationKey: 'operation-1', transportSessionId: id(4), commands: [{ commandId: id(6), jobStepId: id(3), commandType: 'EXECUTE_STEP', state: 'RECOVERY_REQUIRED', sendAttempts: 1, physicalStopConfirmed: true }], physicalUncertainty: { stopUnconfirmed: false, sessionOwned: true, heartbeatFresh: true, robotReportsIdle: true, activeOperationReported: false, mappingOpen: false } },
    history: [], failList: false,
  };
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (request.method() !== 'GET') { writes.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] }); return reply({ accepted: true }); }
    reads.push({ path, status: url.searchParams.get('status') });
    if (path === '/api/v1/auth/me') return reply({ username: 'admin', role: 'ADMIN' });
    if (path === '/api/v1/jobs') {
      if (state.failList) return reply({ message: 'List unavailable' }, 503);
      const rows = [state.job, ...state.history].filter(job => !url.searchParams.get('status') || job.status === url.searchParams.get('status'));
      return reply({ content: rows, totalElements: rows.length, totalPages: 1, last: true });
    }
    if (path.endsWith('/stream')) return reply({ message: 'Fixture stream offline' }, 503);
    if (path.endsWith('/operations/recovery')) return reply(state.evidence);
    if (path === `/api/v1/jobs/${id(1)}`) return reply({ job: state.job, steps: state.steps });
    const historical = state.history.find(job => path === `/api/v1/jobs/${job.jobId}`);
    if (historical) return reply({ job: historical, steps: [] });
    if (path === '/api/v1/workflows/published') return reply([{ workflowId: id(5), workflowName: 'Giao hàng đến phòng 305' }]);
    if (path === `/api/v1/robots/${id(2)}`) return reply({ robotId: id(2), robotName: 'MAR-01', status: 'ERROR', lastHeartbeatAt: new Date().toISOString() });
    if (path === '/api/v1/robots') return reply([{ robotId: id(2), robotName: 'MAR-01' }]);
    return reply({ content: [], totalPages: 0, last: true });
  });
  const start = async () => { await page.goto(`${base}/admin/live-operations`); await page.locator('.lo-groups').waitFor(); };
  const recovery = async () => { await page.locator('.lo-groups').getByRole('button', { name: /Cần xử lý/ }).click(); await page.getByRole('button', { name: 'Xử lý phục hồi', exact: true }).click(); await page.locator('.lo-recovery-actions').waitFor(); };
  return { context, page, state, writes, reads, errors, start, recovery };
}
try {
  const f = await fixture();
  f.state.evidence.transportSessionId = null;
  await f.start(); await f.recovery();
  assert.equal(await f.page.getByRole('button', { name: 'Đối soát lệnh robot', exact: true }).isDisabled(), true);
  await f.page.getByText(/Chưa có phiên kết nối để đối soát/).waitFor();
  await f.page.screenshot({ path: `${output}/recovery-blocked.png`, fullPage: true });
  f.state.evidence.transportSessionId = id(4);
  await f.page.getByRole('button', { name: 'Tải lại bằng chứng', exact: true }).click();
  await f.page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Đối soát lệnh robot')?.disabled);
  await f.page.getByRole('button', { name: 'Đối soát lệnh robot', exact: true }).click();
  const dialog = f.page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(await dialog.locator('input[type="text"]').count(), 0, 'operation/session IDs must never be manually entered');
  await dialog.getByLabel('Bằng chứng phục hồi').selectOption('PI_STOP_CONFIRMED');
  await dialog.getByLabel('Kết quả xử lý').selectOption('CONFIRM_CANCELLED');
  await dialog.getByLabel('Ghi chú kiểm tra').fill('Đã kiểm tra thực tế tại robot.');
  await dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await dialog.getByRole('alert').waitFor(); assert.equal(f.writes.length, 0);
  await dialog.getByRole('checkbox').check();
  f.state.evidence.transportSessionId = id(44);
  await dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'bằng chứng đã thay đổi' }).waitFor();
  assert.equal(f.writes.length, 0, 'changed recovery session must block a stale confirmation');
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  await f.page.getByRole('button', { name: 'Đối soát lệnh robot', exact: true }).click();
  await dialog.getByLabel('Bằng chứng phục hồi').selectOption('PI_STOP_CONFIRMED');
  await dialog.getByLabel('Kết quả xử lý').selectOption('CONFIRM_CANCELLED');
  await dialog.getByLabel('Ghi chú kiểm tra').fill('Đã đối chiếu phiên kết nối mới.');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].path, `/api/v1/jobs/${id(1)}/operations/${id(3)}/reconcile`);
  assert.equal(f.writes[0].body.commandId, id(6)); assert.equal(f.writes[0].body.transportSessionId, id(44)); assert.ok(f.writes[0].key);

  // Terminal transition while on recovery falls back to progress. History
  // navigation preserves this exact job even when it belongs on page two.
  f.state.history = Array.from({ length: 14 }, (_, index) => ({ jobId: id(100 + index), jobCode: `NEWER-${index}`, status: 'FAILED', queuedAt: '2026-11-03T04:00:00Z' }));
  f.state.job = { ...f.state.job, status: 'CANCELLED', rowVersion: 2 };
  await f.page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await f.page.getByRole('button', { name: 'Xem trong lịch sử', exact: true }).waitFor();
  await f.page.locator('.lo-progress').waitFor();
  assert.equal(await f.page.getByRole('button', { name: 'Xử lý phục hồi', exact: true }).count(), 0);
  await f.page.getByRole('button', { name: 'Xem trong lịch sử', exact: true }).click();
  await f.page.getByText('Trang 2/2', { exact: true }).waitFor();
  assert.match(await f.page.locator('.lo-detail-kicker').innerText(), /JOB-UNDER-REVIEW/);
  assert.equal(await f.page.locator('.lo-job-item.is-selected').count(), 1);
  assert.deepEqual(f.errors, []); await f.context.close();

  // No MQTT operation: BE-orchestrated recovery must use the generic API,
  // including rejection before any runtime steps have been created.
  const g = await fixture(); g.state.steps = []; g.state.job.selectedJobStepId = null; g.state.evidence.commands = [];
  await g.start(); await g.recovery();
  assert.equal(await g.page.getByRole('button', { name: 'Đối soát công việc', exact: true }).isEnabled(), true);
  await g.page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await g.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  assert.ok((await g.page.locator('.lo-detail-header h3').boundingBox()).width > 250, 'connection indicator must not squeeze the title into a narrow column');
  await g.page.screenshot({ path: `${output}/mobile-recovery-generic.png`, fullPage: true });
  await g.page.getByRole('button', { name: 'Đối soát công việc', exact: true }).click();
  const generic = g.page.getByRole('dialog');
  await generic.waitFor();
  await g.page.screenshot({ path: `${output}/mobile-recovery-dialog.png`, fullPage: true });
  await generic.getByLabel('Kết quả xử lý').selectOption('RESUME_AS_FAILED');
  await generic.getByLabel('Ghi chú kiểm tra').fill('Chưa phát sinh lệnh robot.');
  await generic.getByRole('checkbox').check();
  await generic.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await generic.waitFor({ state: 'hidden' });
  assert.equal(g.writes[0].path, `/api/v1/jobs/${id(1)}/reconcile`);
  assert.deepEqual(g.errors, []); await g.context.close();

  // Independent detail polling survives a failed global list and closed SSE.
  const h = await fixture();
  h.state.job = { ...h.state.job, status: 'RUNNING' };
  h.state.steps = [{ ...h.state.steps[0], status: 'RUNNING', stepTypeSnapshot: 'HANDLE_PAYLOAD', startedAt: new Date().toISOString(), timeoutSecSnapshot: 180, resolvedInputsJson: { items: [{ itemCode: 'A', quantity: 1 }] } }];
  await h.start(); await h.page.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).waitFor();
  await h.page.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).click();
  const confirm = h.page.getByRole('dialog'); await confirm.getByLabel('Tôi đã kiểm tra hàng đúng danh sách').check();
  h.state.job = { ...h.state.job, cancelCommandId: id(70), cancelRequestedAt: new Date().toISOString(), rowVersion: 2 };
  await confirm.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await confirm.getByRole('alert').waitFor(); assert.equal(h.writes.length, 0);
  await confirm.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  await h.page.getByText('Đang chờ hủy', { exact: true }).last().waitFor();
  assert.equal(await h.page.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).count(), 0);
  h.state.failList = true;
  const before = h.reads.filter(read => read.path === `/api/v1/jobs/${id(1)}`).length;
  await h.page.waitForTimeout(16000);
  assert.ok(h.reads.filter(read => read.path === `/api/v1/jobs/${id(1)}`).length > before);
  assert.ok(h.reads.some(read => read.path === '/api/v1/jobs' && read.status === 'RUNNING'), '15s polls should query open states, not the full history');
  assert.deepEqual(h.errors, []); assert.equal(h.writes.length, 0);
  await h.page.screenshot({ path: `${output}/cancellation-waiting.png`, fullPage: true });
  await h.context.close();
  console.log('PASS: recovery prerequisites and exact identities, session-change race, generic recovery, recovery-tab exit, page-two history selection, cancellation race, independent polling and mobile layout. All writes intercepted by fixtures.');
} finally { await browser.close(); }
