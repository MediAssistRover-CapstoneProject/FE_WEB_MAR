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
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'fixture-token' } })));
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [], writes = [], reads = [];
page.on('pageerror', error => errors.push(error.message));
const template = { workflowId: id(100), robotId: id(200), serviceRequestId: id(300), priority: 50, rowVersion: 1, beOrchestrated: true, schemaVersion: 3, queuedAt: '2026-11-03T03:00:00Z', inputJson: { destinationEndpointId: id(400) } };
const running = { ...template, jobId: id(1), jobCode: 'JOB-RUNNING', status: 'RUNNING', selectedJobStepId: id(500), startedAt: '2026-11-03T03:01:00Z' };
const queued = { ...template, jobId: id(2), jobCode: 'JOB-QUEUED', status: 'QUEUED', robotId: null, queuedAt: '2026-11-03T02:00:00Z' };
const recovery = { ...template, jobId: id(3), jobCode: 'JOB-RECOVERY', status: 'RECOVERY_REQUIRED' };
const history = Array.from({ length: 14 }, (_, index) => ({ ...template, jobId: id(index + 10), jobCode: `JOB-HISTORY-${index}`, status: index ? 'SUCCEEDED' : 'FAILED', queuedAt: `2026-11-02T${String(20 - index).padStart(2, '0')}:00:00Z`, endedAt: '2026-11-02T21:00:00Z' }));
let jobs = [running, queued, recovery, ...history], failList = false, failEvents = false, eventDelay = 0, slowDetail = false, streamed = null;
const step = { jobStepId: id(500), stepCodeSnapshot: 'LOAD_MEDICINE', stepTypeSnapshot: 'HANDLE_PAYLOAD', status: 'RUNNING', attemptNo: 1, executionSequenceNo: 1, timeoutSecSnapshot: 180, startedAt: new Date().toISOString(), resolvedInputsJson: { endpoint_id: id(400), diagnostic: { token: 'PRIVATE_FIXTURE_TOKEN' }, items: [{ itemCode: 'MED01', quantity: 2 }] }, errorDetailsJson: { debug: 'INTERNAL_DIAGNOSTIC_ONLY' } };
const detailFor = job => ({ job, steps: job.status === 'FAILED' ? [{ ...step, startedAt: '2026-11-03T03:01:00Z', endedAt: '2026-11-03T03:01:22Z', stepCodeSnapshot: 'MOVE_03', stepTypeSnapshot: 'MOVE', status: 'FAILED', errorCode: 'ENDPOINT_DRIFT_DURING_ALIGNMENT' }] : [{ ...step, ...(job.status === 'SUCCEEDED' ? { startedAt: '2026-11-03T03:01:00Z', endedAt: '2026-11-03T03:01:22Z', resultJson: { data: { reached: true, internal: 'INTERNAL_DIAGNOSTIC_ONLY' } } } : {}), status: job.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'RUNNING' }] });
const paged = (rows, url) => { const size = Number(url.searchParams.get('size') || 100), index = Number(url.searchParams.get('page') || 0); return { content: rows.slice(index * size, (index + 1) * size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), number: index, last: (index + 1) * size >= rows.length }; };
await page.route('**/api/v1/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (request.method() !== 'GET') { writes.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] }); return reply({ accepted: true }); }
  reads.push(path);
  if (path === '/api/v1/auth/me') return reply({ username: 'admin', role: 'ADMIN' });
  if (path === '/api/v1/jobs') return failList ? reply({ message: 'Mất kết nối thử nghiệm' }, 503) : reply(paged(jobs, url));
  if (path === '/api/v1/robots') return reply(paged([{ robotId: id(200), robotName: 'MAR-01', status: 'BUSY' }, { robotId: id(201), robotName: 'MAR-02', status: 'IDLE' }], url));
  if (path === '/api/v1/workflows/published') return reply([{ workflowId: id(100), workflowName: 'Giao thuốc đến phòng 305' }]);
  if (path === '/api/v1/service-requests') return reply(paged([{ serviceRequestId: id(300), requestCode: 'REQ-305', requestType: 'DELIVERY' }], url));
  if (path === '/api/v1/endpoints') return reply(paged([{ endpointId: id(400), endpointName: 'Phòng 305' }], url));
  if (path === '/api/v1/admin/staff') return reply(paged([], url));
  if (path.endsWith('/events')) {
    if (eventDelay) await new Promise(resolve => setTimeout(resolve, eventDelay));
    if (failEvents) return reply({ message: 'Nhật ký đang gián đoạn' }, 503);
    return reply(paged(Array.from({ length: 21 }, (_, index) => ({ jobEventId: id(600 + index), eventType: index ? 'STEP_STARTED' : 'UNTRANSLATED_PI_EVENT', occurredAt: '2026-11-03T03:00:00Z', previousStatus: 'PENDING', newStatus: 'RUNNING' })), url));
  }
  if (path.endsWith('/operations/recovery')) return reply({ jobId: recovery.jobId, physicalUncertainty: { stopUnconfirmed: false, heartbeatFresh: false, robotReportsIdle: false }, commands: [], recoveryRequired: true });
  const job = jobs.find(item => path.includes(item.jobId));
  if (job && path.endsWith('/stream')) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `event: job-state\ndata: ${JSON.stringify(detailFor(streamed?.jobId === job.jobId ? streamed : job))}\n\n` });
  if (job) {
    if (slowDetail && job.jobId === queued.jobId) await new Promise(resolve => setTimeout(resolve, 600));
    return reply(detailFor(job));
  }
  return reply(paged([], url));
});

try {
  await page.goto(`${base}/admin/live-operations`);
  await page.locator('.lo-explorer > summary').click();
  const screen = page.getByRole('region', { name: 'Theo dõi công việc robot', exact: true });
  await screen.getByRole('heading', { name: 'Giao thuốc đến phòng 305', exact: true }).waitFor();
  assert.equal(await screen.getByLabel('Tự cập nhật', { exact: true }).isChecked(), true);
  await page.waitForFunction(() => document.querySelector('.lo-live-status')?.textContent?.includes('theo dõi') || document.querySelector('.lo-live-status')?.textContent?.includes('gián đoạn'));
  assert.ok(reads.some(path => path.endsWith('/stream')));
  await page.screenshot({ path: `${output}/desktop-active.png`, fullPage: true });

  // Mutations are explicit, typed and remain unchecked until a human confirms.
  await screen.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(writes.length, 0);
  await dialog.getByLabel('Tôi đã kiểm tra hàng đúng danh sách').check();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, `/api/v1/job-steps/${id(500)}/responses`);
  assert.equal(writes[0].body.responseType, 'PAYLOAD_CONFIRMED');
  assert.ok(writes[0].key);

  // Queued assignment lists only available robots, and opening the form writes nothing.
  await screen.locator('.lo-job-item').filter({ hasText: 'QUEUED' }).click();
  await screen.getByRole('button', { name: 'Phân robot', exact: true }).click();
  await dialog.getByRole('combobox').waitFor();
  assert.equal(await dialog.getByRole('option', { name: 'MAR-01', exact: true }).count(), 0);
  assert.equal(await dialog.getByRole('option', { name: 'MAR-02', exact: true }).count(), 1);
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  assert.equal(writes.length, 1);

  // A cancellation receipt is not displayed as a completed cancellation.
  running.cancelCommandId = id(900); running.cancelRequestedAt = '2026-11-03T03:05:00Z'; running.rowVersion = 2;
  await screen.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await screen.locator('.lo-job-item').filter({ hasText: 'UNNING' }).click();
  await screen.getByText(/Đã gửi yêu cầu hủy. Chờ kết quả từ máy chủ và robot/).waitFor();
  assert.equal(await screen.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).count(), 0);
  assert.equal(await screen.getByRole('button', { name: 'Yêu cầu hủy', exact: true }).count(), 0);
  assert.match(await screen.locator('.lo-detail-kicker').textContent(), /Đang thực hiện/);
  delete running.cancelCommandId; delete running.cancelRequestedAt; running.rowVersion = 3;

  // Completed jobs show useful failures, no cancellation or assignment.
  await screen.getByRole('navigation', { name: 'Nhóm công việc' }).getByRole('button', { name: /Lịch sử/ }).click();
  await screen.locator('.lo-problem').getByText('Robot báo lệch khỏi điểm đích trong lúc căn chỉnh vị trí.', { exact: true }).waitFor();
  assert.equal(await screen.getByRole('button', { name: 'Yêu cầu hủy', exact: true }).count(), 0);
  assert.equal(await screen.getByRole('button', { name: 'Phân nhân viên', exact: true }).count(), 0);
  assert.equal(await screen.getByRole('button', { name: 'Đối soát công việc', exact: true }).count(), 0);
  assert.equal(await screen.getByRole('button', { name: 'Phiên quét', exact: true }).count(), 0);
  assert.equal(await screen.locator('.lo-problem code').count(), 0);
  assert.ok(!(await screen.locator('.lo-problem').innerText()).includes('MOVE_03'));
  assert.ok(!(await screen.locator('.lo-problem').innerText()).includes('ENDPOINT_DRIFT_DURING_ALIGNMENT'));
  await screen.getByRole('button', { name: 'Thông tin kỹ thuật', exact: true }).click();
  const technical = screen.getByRole('region', { name: 'Tra cứu kỹ thuật', exact: true });
  await technical.getByRole('heading', { name: 'Mã tra cứu', exact: true }).waitFor();
  await technical.getByRole('heading', { name: 'Chẩn đoán lỗi', exact: true }).waitFor();
  await technical.getByText('ENDPOINT_DRIFT_DURING_ALIGNMENT', { exact: true }).waitFor();
  assert.equal(await technical.getByText('Dữ liệu công việc đầy đủ', { exact: true }).count(), 0);
  assert.equal(await technical.locator('pre').count(), 0, 'JSON stays unmounted while collapsed');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await technical.getByRole('button', { name: 'Sao chép ID công việc', exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), history[0].jobId);
  await technical.locator('summary').filter({ hasText: 'Thông số thực thi' }).click();
  await technical.getByText('Độ ưu tiên', { exact: true }).waitFor();
  await technical.locator('summary').filter({ hasText: 'Dữ liệu đầu vào và kết quả' }).click();
  await technical.getByLabel('Phạm vi dữ liệu', { exact: true }).selectOption(id(500));
  await technical.locator('pre').filter({ hasText: 'endpoint_id' }).waitFor();
  const jsonText = await technical.locator('pre').allTextContents();
  assert.ok(jsonText.join('').includes('[REDACTED]'));
  assert.ok(!jsonText.join('').includes('PRIVATE_FIXTURE_TOKEN'));
  await page.screenshot({ path: `${output}/desktop-technical.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.screenshot({ path: `${output}/mobile-technical.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screen.getByRole('button', { name: 'Xem bước lỗi', exact: true }).click();
  await screen.locator('.lo-readable-facts').getByText('22 giây', { exact: true }).waitFor();
  assert.equal(await screen.locator('.lo-steps > li').first().locator('details').getAttribute('open'), '');
  assert.equal(await screen.locator('.lo-readable-facts').getByText('Giới hạn chờ', { exact: true }).count(), 0);
  assert.equal(await screen.locator('.lo-steps').getByText('Thứ tự thực hiện', { exact: true }).count(), 0);
  assert.ok(!(await screen.locator('.lo-steps').innerText()).includes('INTERNAL_DIAGNOSTIC_ONLY'));
  await page.screenshot({ path: `${output}/desktop-failed.png`, fullPage: true });
  await screen.locator('.lo-job-item').nth(1).click();
  await screen.getByText('JOB-HISTORY-1', { exact: true }).waitFor();
  await screen.locator('.lo-steps').getByText('Thông tin bước', { exact: true }).click();
  await screen.locator('.lo-readable-facts').getByText('Robot báo đã đến điểm đích', { exact: true }).waitFor();
  assert.equal(await screen.locator('.lo-readable-facts').getByText('Nguyên nhân lỗi', { exact: true }).count(), 0);
  assert.equal(await screen.locator('.lo-readable-facts').getByText('Số lần thử', { exact: true }).count(), 0);
  assert.ok(!(await screen.locator('.lo-steps').innerText()).includes('INTERNAL_DIAGNOSTIC_ONLY'));
  await screen.locator('.lo-job-item').first().click();
  await screen.getByText('JOB-HISTORY-0', { exact: true }).waitFor();
  await screen.getByRole('button', { name: 'Trang công việc sau', exact: true }).click();
  await screen.getByText('Trang 2/2', { exact: true }).waitFor();
  await screen.getByRole('button', { name: 'Trang công việc trước', exact: true }).click();

  // Journals load directly, paginate in human-facing page numbers and recover from errors.
  await screen.getByRole('button', { name: 'Nhật ký sự kiện', exact: true }).click();
  await screen.locator('.lo-event-list > li').first().waitFor();
  assert.equal(await screen.locator('.lo-event-list > li').count(), 20);
  await screen.locator('.lo-events').getByText('Cập nhật thực thi', { exact: true }).waitFor();
  assert.ok(!(await screen.locator('.lo-event-list').innerText()).includes('C?p nh?t th?c thi'));

  // Reading a finished job must not restart the journal on the global 15s tick.
  const timeline = await screen.locator('.lo-event-list').elementHandle();
  await screen.locator('.lo-event-list > li').first().locator('summary').first().click();
  const eventReads = () => reads.filter(path => path.endsWith('/events')).length;
  const beforePoll = eventReads();
  await page.waitForTimeout(16000);
  assert.equal(eventReads(), beforePoll, 'finished journals must not refetch on automatic job polling');
  assert.equal(await timeline.evaluate(element => element.isConnected), true);
  assert.equal(await screen.locator('.lo-event-list > li').first().locator('details').first().getAttribute('open'), '');

  // Slow background refresh keeps the timeline and expanded details mounted,
  // and another refresh tick cannot cancel/restart the same in-flight request.
  eventDelay = 700;
  const eventResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/events'));
  const eventRequest = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/events'));
  await screen.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await eventRequest;
  assert.equal(await timeline.evaluate(element => element.isConnected), true);
  assert.equal(await screen.getByText('Đang tải nhật ký…', { exact: true }).count(), 0);
  await screen.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(eventReads(), beforePoll + 1, 'concurrent refreshes must share the in-flight request');
  await eventResponse;
  await page.waitForTimeout(100);
  assert.equal(await timeline.evaluate(element => element.isConnected), true);
  assert.equal(await screen.locator('.lo-event-list > li').first().locator('details').first().getAttribute('open'), '');
  eventDelay = 0;
  failEvents = true;
  await screen.getByRole('button', { name: 'Cập nhật nhật ký', exact: true }).click();
  await screen.getByText('Đang giữ nhật ký đã tải để bạn tiếp tục đọc.', { exact: true }).waitFor();
  assert.equal(await timeline.evaluate(element => element.isConnected), true);
  assert.equal(await screen.locator('.lo-event-list > li').count(), 20);
  failEvents = false;
  await screen.locator('.lo-events').getByRole('button', { name: 'Thử lại', exact: true }).click();
  await screen.getByText('Đang giữ nhật ký đã tải để bạn tiếp tục đọc.', { exact: true }).waitFor({ state: 'hidden' });

  await screen.locator('.lo-events').getByRole('button', { name: 'Sau', exact: true }).click();
  await screen.getByText('Trang 2/2', { exact: true }).waitFor();
  assert.equal(await screen.locator('.lo-event-list > li').count(), 1);
  failEvents = true;
  await screen.locator('.lo-events').getByRole('button', { name: 'Trước', exact: true }).click();
  await screen.getByText('Nhật ký đang gián đoạn', { exact: true }).waitFor();
  failEvents = false;
  await screen.locator('.lo-events').getByRole('button', { name: 'Thử lại', exact: true }).click();
  await screen.locator('.lo-event-list > li').first().waitFor();

  // Recovery is separated from finished failure history.
  await screen.getByRole('navigation', { name: 'Nhóm công việc' }).getByRole('button', { name: /Cần xử lý/ }).click();
  await screen.getByRole('button', { name: 'Xử lý phục hồi', exact: true }).click();
  await screen.getByRole('button', { name: 'Đối soát công việc', exact: true }).waitFor();
  assert.equal(await screen.getByRole('button', { name: 'Yêu cầu hủy', exact: true }).count(), 0);
  assert.equal(await screen.getByRole('button', { name: 'Đối soát lệnh robot', exact: true }).count(), 0);
  await page.screenshot({ path: `${output}/desktop-recovery.png`, fullPage: true });

  // Late responses from a previous selection cannot replace the current job.
  await screen.getByRole('navigation', { name: 'Nhóm công việc' }).getByRole('button', { name: /Đang hoạt động/ }).click();
  slowDetail = true;
  await screen.locator('.lo-job-item').filter({ hasText: 'QUEUED' }).click();
  await screen.locator('.lo-job-item').filter({ hasText: 'UNNING' }).click();
  await page.waitForTimeout(800);
  assert.match(await screen.locator('.lo-detail-kicker').textContent(), /JOB-RUNNING/);
  slowDetail = false;

  // A new streamed state wins over a stale REST response, and changes the list group.
  streamed = { ...running, status: 'RECOVERY_REQUIRED', rowVersion: 9 };
  await screen.getByLabel('Tự cập nhật', { exact: true }).uncheck();
  await screen.getByLabel('Tự cập nhật', { exact: true }).check();
  await page.waitForFunction(() => ![...document.querySelectorAll('.lo-job-item')].some(item => item.textContent.includes('UNNING')));
  await screen.getByRole('navigation', { name: 'Nhóm công việc' }).getByRole('button', { name: /Cần xử lý/ }).click();
  await screen.locator('.lo-job-item').filter({ hasText: 'UNNING' }).click();
  await screen.getByRole('button', { name: 'Xử lý phục hồi', exact: true }).waitFor();

  // Read failures keep the last successful list and explicitly mark it as stale.
  failList = true;
  await screen.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await screen.getByText(/Dữ liệu bên dưới là lần tải thành công gần nhất/).waitFor();
  failList = false;
  await screen.getByRole('button', { name: 'Thử lại', exact: true }).first().click();
  await screen.getByText('Không thể làm mới công việc', { exact: true }).waitFor({ state: 'hidden' });

  await page.setViewportSize({ width: 390, height: 844 });
  await screen.getByRole('navigation', { name: 'Nhóm công việc' }).getByRole('button', { name: /Lịch sử/ }).click();
  await screen.locator('.lo-problem').getByText('Robot báo lệch khỏi điểm đích trong lúc căn chỉnh vị trí.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'mobile layout must not overflow horizontally');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/mobile-history.png`, fullPage: true });

  await page.setViewportSize({ width: 1024, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'tablet layout must not overflow horizontally');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/tablet-history.png`, fullPage: true });

  // Empty groups explain the state and provide history rather than a wall of controls.
  jobs = [...history]; streamed = null;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screen.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await screen.getByRole('navigation', { name: 'Nhóm công việc' }).getByRole('button', { name: /Đang hoạt động/ }).click();
  await screen.getByRole('heading', { name: 'Hiện không có công việc đang hoạt động', exact: true }).waitFor();
  await screen.getByRole('button', { name: 'Xem lịch sử', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/desktop-empty-active.png`, fullPage: true });

  // Staff can confirm their current step, but cannot assign robots or staff.
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('mediassist-rover.session'));
    session.account.role = 'STAFF'; localStorage.setItem('mediassist-rover.session', JSON.stringify(session));
  });
  // This phase follows the streamed recovery version 9; stale versions must not win.
  running.rowVersion = 10;
  jobs = [running, queued];
  await screen.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await screen.getByRole('button', { name: 'Xác nhận bước hiện tại', exact: true }).waitFor();
  assert.equal(await screen.getByRole('button', { name: 'Phân nhân viên', exact: true }).count(), 0);
  await screen.locator('.lo-job-item').filter({ hasText: 'QUEUED' }).click();
  await screen.locator('.lo-detail-kicker').filter({ hasText: 'JOB-QUEUED' }).waitFor();
  assert.equal(await screen.getByRole('button', { name: 'Phân robot', exact: true }).count(), 0);
  failList = true;
  await page.reload();
  await page.locator('.lo-explorer > summary').click();
  await screen.getByRole('heading', { name: 'Chưa tải được danh sách công việc', exact: true }).waitFor();
  assert.equal(await screen.getByRole('heading', { name: 'Hiện không có công việc đang hoạt động', exact: true }).count(), 0);
  failList = false;
  await screen.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await screen.locator('.lo-job-item').first().waitFor();
  assert.equal(writes.length, 1, 'all other UI checks must remain read-only');
  assert.deepEqual(errors, []);
  console.log('PASS: tabs, terminal actions, confirmation, event pagination/error, recovery, selection races, SSE sync, stale REST, data failures, empty states and 390/1024/1440 layouts.');
} finally {
  await page.screenshot({ path: `${output}/last-state.png`, fullPage: true }).catch(() => {});
  await browser.close();
}
