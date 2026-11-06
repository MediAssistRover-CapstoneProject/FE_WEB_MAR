import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5189';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(10000);
const mapId = '11111111-1111-4111-8111-111111111111', otherMapId = '33333333-3333-4333-8333-333333333333', endpointId = '22222222-2222-4222-8222-222222222222';
const workflow = { workflowId: 'wf-delivery', workflowName: 'Giao hàng giữa hai điểm', workflowCode: 'DELIVERY_A_B', versionNo: 3, status: 'PUBLISHED', acceptsNewJobs: true, serviceType: 'DELIVERY', description: 'Nhận hàng tại quầy và giao đến điểm đã chọn.', inputSchemaJson: { type: 'object', properties: { map_id: { type: 'string' }, destination: { type: 'string' }, note: { type: 'string' }, confirmed: { type: 'boolean' } }, required: ['map_id', 'destination', 'confirmed'] }, inputUiJson: { fields: { map_id: { kind: 'map', label: 'Bản đồ' }, destination: { kind: 'endpoint', mapVariable: 'map_id', label: 'Điểm giao hàng' }, note: { label: 'Ghi chú' }, confirmed: { label: 'Cho phép thông báo' } } }, defaultInputsJson: { confirmed: false } };
const robots = [{ robotId: 'robot-1', robotName: 'MAR-01', status: 'IDLE', currentMapId: mapId }, { robotId: 'robot-2', robotName: 'MAR-02', status: 'BUSY', currentMapId: mapId }];
const writes = [], pageErrors = [];
let schedule = null, job = null, loseCreateResponse = false, failJobs = false, failCatalog = false, blockedActivation = false, activationRelease;
const paged = content => ({ content, last: true, totalPages: 1 });
page.on('pageerror', error => pageErrors.push(error.message));
await page.addInitScript(() => {
  if (!localStorage.getItem('mediassist-rover.session')) localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'dispatch-test' }, tokens: { accessToken: 'mock' } }));
});
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (method !== 'GET') writes.push({ path, method, body: req.postDataJSON() });
  if (path === '/api/v1/workflows/published') return respond(failCatalog ? { message: 'Catalog unavailable' } : paged([workflow]), failCatalog ? 503 : 200);
  if (path === '/api/v1/workflows/published/wf-delivery') return respond({ workflow, steps: [], tasks: [], transitions: [] });
  if (path === '/api/v1/robots') return respond(paged(robots));
  if (path === '/api/v1/robots/robot-1') return respond(robots[0]);
  if (path === '/api/v1/maps') return respond(paged([{ mapId, mapName: 'Tầng 1', status: 'ACTIVE' }, { mapId: otherMapId, mapName: 'Tầng 2', status: 'ACTIVE' }]));
  if (path === '/api/v1/endpoints') return respond(paged([{ endpointId, mapId, endpointName: 'Quầy nhận hàng', endpointCode: 'EP-01', active: true, accessible: true }]));
  if (path === '/api/v1/rooms') return respond(paged([]));
  if (path === '/api/v1/jobs') return respond(failJobs ? { message: 'Jobs unavailable' } : paged(job ? [job] : []), failJobs ? 503 : 200);
  if (path === '/api/v1/jobs/job-1') return respond({ job, tasks: [], steps: [{ jobStepId: 'step-1', stepCodeSnapshot: 'MOVE_TO_DESTINATION', status: 'RUNNING' }] });
  if (path === '/api/v1/jobs/job-1/cancel') { job = { ...job, cancelRequestedAt: new Date().toISOString(), cancelCommandId: 'cancel-1' }; return respond(job); }
  if (path === '/api/v1/schedules' && method === 'GET') return respond(paged(schedule ? [schedule] : []));
  if (path === '/api/v1/schedules' && method === 'POST') {
    schedule = { ...req.postDataJSON(), scheduleId: 'schedule-1', status: 'PAUSED' };
    if (loseCreateResponse) { loseCreateResponse = false; return route.abort('failed'); }
    return respond(schedule, 201);
  }
  if (path === '/api/v1/schedules/schedule-1') return respond(schedule);
  if (path === '/api/v1/schedules/schedule-1/activate') {
    if (blockedActivation) await new Promise(resolve => { activationRelease = resolve; });
    schedule.status = 'ACTIVE';
    job = { jobId: 'job-1', scheduleId: schedule.scheduleId, workflowId: workflow.workflowId, robotId: 'robot-1', jobCode: 'JOB-DISPATCH-01', status: 'RUNNING', queuedAt: new Date().toISOString() };
    return respond(schedule);
  }
  return respond(paged([]));
});
try {
  await mkdir('.workstation-build/workflow-dispatch', { recursive: true });
  await page.goto(base + '/admin/workflow-dispatch');
  await expect(page.getByRole('button', { name: 'Điều phối quy trình', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: /Giao hàng giữa hai điểm/ }).click();
  await expect(page.getByLabel('Điểm giao hàng *')).toBeDisabled();
  assert.equal(writes.length, 0);
  await page.getByRole('button', { name: 'Xem lại & điều phối →' }).click();
  await expect(page.getByText('Bắt buộc nhập', { exact: true })).toHaveCount(2);
  assert.equal(writes.length, 0);
  await page.getByLabel('Bản đồ *', { exact: true }).selectOption(mapId);
  await page.getByLabel('Điểm giao hàng *', { exact: true }).selectOption(endpointId);
  await page.getByLabel('Bản đồ *', { exact: true }).selectOption(otherMapId);
  await expect(page.getByLabel('Điểm giao hàng *')).toHaveValue('');
  await page.getByLabel('Bản đồ *', { exact: true }).selectOption(mapId);
  await page.getByLabel('Điểm giao hàng *', { exact: true }).selectOption(endpointId);
  await page.getByLabel('Robot ưu tiên', { exact: true }).selectOption('robot-1');
  await page.getByLabel('Ghi chú', { exact: true }).fill('Giao tại quầy tiếp nhận');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: 'Cấu hình nhiệm vụ', exact: true }).screenshot({ path: '.workstation-build/workflow-dispatch/mobile-form.png' });
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `No horizontal overflow at ${width}px`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.workstation-build/workflow-dispatch/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Xem lại & điều phối →' }).click();
  await expect(page.getByRole('dialog')).toContainText('Quầy nhận hàng');
  await expect(page.getByRole('dialog')).toContainText('Không');
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  assert.equal(writes.length, 0);
  await page.getByRole('button', { name: 'Xem lại & điều phối →' }).click();
  loseCreateResponse = true;
  await page.getByRole('button', { name: 'Xác nhận điều phối', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xem trạng thái yêu cầu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem trạng thái yêu cầu', exact: true }).click();
  assert.equal(writes.filter(item => item.path === '/api/v1/schedules').length, 1);
  const snapshot = writes[0].body;
  assert.equal(snapshot.inputTemplateJson.confirmed, false);
  assert.equal(snapshot.robotId, 'robot-1');
  assert.equal(snapshot.scheduleType, 'ONCE');
  assert.equal(snapshot.misfirePolicy, 'FIRE_ONCE');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Tiếp tục yêu cầu này', exact: true })).toBeVisible();
  blockedActivation = true;
  await page.getByRole('button', { name: 'Tiếp tục yêu cầu này', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang kiểm tra…', exact: true })).toBeDisabled();
  await expect.poll(() => !!activationRelease, { timeout: 5000 }).toBe(true);
  activationRelease();
  await expect(page.getByRole('link', { name: 'Theo dõi & điều khiển ↗' })).toBeVisible();
  assert.equal(writes.filter(item => item.path === '/api/v1/schedules').length, 1);
  assert.equal(writes.filter(item => item.path.endsWith('/activate')).length, 1);
  await expect(page.getByRole('link', { name: 'Theo dõi & điều khiển ↗' })).toHaveAttribute('href', '/admin/live-operations?jobId=job-1');
  await expect(page.getByText('MOVE_TO_DESTINATION', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Điều khiển nhiệm vụ tại đây' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yêu cầu hủy', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Điều khiển nhiệm vụ tại đây' }).screenshot({ path: '.workstation-build/workflow-dispatch/inline-control.png' });
  const beforeControl = writes.length;
  await page.getByRole('button', { name: 'Yêu cầu hủy', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Yêu cầu hủy công việc', exact: true })).toBeVisible();
  assert.equal(writes.length, beforeControl);
  await page.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  await page.getByRole('button', { name: 'Yêu cầu hủy', exact: true }).click();
  const cancelDialog = page.getByRole('dialog', { name: 'Yêu cầu hủy công việc', exact: true });
  await cancelDialog.getByRole('textbox').fill('Dừng lượt thử điều phối');
  await cancelDialog.getByRole('checkbox').check();
  await cancelDialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByText('Đã gửi yêu cầu hủy. Đang chờ máy chủ xử lý.', { exact: true })).toBeVisible();
  assert.equal(writes.filter(item => item.path.endsWith('/cancel')).length, 1);
  assert.equal(writes.at(-1).body.reason, 'Dừng lượt thử điều phối');
  failJobs = true;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByText(/Chưa cập nhật được nhiệm vụ: Jobs unavailable/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Theo dõi & điều khiển ↗' })).toBeVisible();
  failJobs = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.workstation-build/workflow-dispatch/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.getByRole('button', { name: 'Tạo lượt điều phối mới', exact: true }).click();
  failCatalog = true;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByText(/Không tải được danh mục: Catalog unavailable/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem lại & điều phối →' })).toBeDisabled();
  await page.evaluate(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'STAFF', accountId: 'staff-test' }, tokens: { accessToken: 'mock' } })));
  await page.reload();
  await expect(page.getByText('Trang này dành cho quản trị viên.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Điều phối quy trình', exact: true })).toHaveCount(0);
  assert.deepEqual(pageErrors, []);
  console.log('PASS: workflow inputs, map changes, review, interrupted request recovery, single activation, inline job control and cancellation, stale data, responsive layout and admin access; all APIs mocked.');
} finally { await browser.close(); }
