import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { createDraft, saveMap, STORAGE_KEY } from '../src/pages/Admin/mapStudioModel.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const draft = saveMap({ ...createDraft(), scan: { status: 'complete', progress: 100 }, endpoints: [
  { id: 'a', name: 'Sảnh tiếp đón', x: 580, y: 330, type: 'PARK', enabled: true },
  { id: 'b', name: 'Phòng thuốc', x: 720, y: 330, type: 'WAYPOINT', enabled: true },
] }, '2026-10-24T00:00:00Z');
await context.addInitScript(({ draft, key }) => {
  localStorage.setItem(key, JSON.stringify(draft));
  sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ tokens: { accessToken: 'test-only' }, account: { role: 'ADMIN', fullName: 'Quản trị kiểm thử' } }));
}, { draft, key: STORAGE_KEY });
const page = await context.newPage(), errors = [], writes = [], reads = [];
page.on('pageerror', error => errors.push(error.message));
let fail = false, empty = false;
const hospital = { hospitalInformationId: '11111111-1111-4111-8111-111111111111', title: 'Hướng dẫn khám bệnh', content: 'Đến quầy tiếp đón để đăng ký.\nMang theo giấy tờ và hồ sơ khám trước đó.', infoCategory: 'GENERAL', languageCode: 'vi', status: 'PUBLISHED', publicVisible: true, updatedAt: '2026-10-24T03:00:00Z' };
const request = { serviceRequestId: '22222222-1111-4111-8111-111111111111', requestCode: 'REQ-2026-101', requestType: 'DELIVERY', status: 'IN_PROGRESS', priority: 3, requestNote: 'Giao thuốc đến phòng trực', requestedAt: '2026-10-24T03:01:00Z' };
const job = { jobId: '33333333-1111-4111-8111-111111111111', jobCode: 'JOB-101', status: 'RUNNING', serviceType: 'DELIVERY' };
await page.route('**/api/v1/**', async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  const reply = (json, status = 200) => route.fulfill({ status, json });
  const list = content => reply({ content, totalElements: content.length, totalPages: 1, last: true });
  if (req.method() !== 'GET') { writes.push({ path, body: req.postDataJSON() }); return reply({ ...hospital, ...req.postDataJSON() }); }
  reads.push(url);
  if (path === '/api/v1/auth/me') return reply({ fullName: 'Quản trị kiểm thử', role: 'ADMIN' });
  if (fail && path === '/api/v1/service-requests') return reply({ message: 'Máy chủ kiểm thử tạm ngừng' }, 503);
  if (path.endsWith('/hospital-information')) return list(empty ? [] : [hospital]);
  if (path.endsWith('/hospital-information/' + hospital.hospitalInformationId)) return reply(hospital);
  if (path === '/api/v1/service-requests') return list(empty ? [] : [request]);
  if (path.endsWith('/service-requests/' + request.serviceRequestId)) return reply(request);
  if (path === '/api/v1/jobs') return list([job]);
  if (path.endsWith('/jobs/' + job.jobId)) return reply({ job, steps: [{ jobStepId: 's1', executionSequenceNo: 1, stepCodeSnapshot: 'Đến quầy thuốc', stepTypeSnapshot: 'MOVE', status: 'SUCCEEDED', attemptNo: 1 }, { jobStepId: 's2', executionSequenceNo: 2, stepCodeSnapshot: 'Đến phòng trực', stepTypeSnapshot: 'MOVE', status: 'RUNNING', attemptNo: 1 }] });
  return list([]);
});
const go = section => page.goto('http://127.0.0.1:5175/admin?screen=' + encodeURIComponent(section));
const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await mkdir('.workstation-build/workspace-ux', { recursive: true });
try {
  await go('Facility Management');
  await page.locator('.be-records button').first().click();
  await page.getByRole('region', { name: 'Tóm tắt bản ghi' }).getByText(hospital.content, { exact: true }).waitFor();
  assert.equal(await page.locator('.be-catalog-navigation').getByText('Không gian', { exact: true }).count(), 1);
  assert.match(await page.locator('.be-source-strip').innerText(), /Đã nhận dữ liệu.*localhost:8080/s);
  assert.equal(await page.locator('.be-full-record').getAttribute('open'), null);
  await page.screenshot({ path: '.workstation-build/workspace-ux/facility.png', fullPage: true });
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Danh mục chức năng' }).getByRole('button', { name: 'Bài hướng dẫn', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Tạo mới', exact: true }).isDisabled(), true);
  await go('Public Catalog');
  await page.locator('.be-records button').first().click();
  await page.locator('.be-readable-content').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Tạo mới', exact: true }).count(), 0);
  await page.screenshot({ path: '.workstation-build/workspace-ux/public.png', fullPage: true });
  empty = true; await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await page.getByRole('heading', { name: 'Danh mục chưa có dữ liệu' }).waitFor();
  empty = false;
  await go('Missions');
  await page.locator('.be-records button').first().click();
  await page.getByRole('region', { name: 'Tóm tắt bản ghi' }).getByText(request.requestNote, { exact: true }).waitFor();
  await page.locator('.be-filter>summary').click();
  await page.locator('.be-filter').getByLabel('Trạng thái', { exact: true }).selectOption('IN_PROGRESS');
  empty = true; await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
  await page.getByText('Không có kết quả khớp bộ lọc', { exact: true }).waitFor();
  assert.ok(reads.some(url => url.searchParams.get('status') === 'IN_PROGRESS'));
  empty = false; await page.getByRole('button', { name: 'Xóa điều kiện lọc', exact: true }).click();
  await page.locator('.be-records button').first().waitFor();
  fail = true; await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Máy chủ kiểm thử' }).waitFor();
  assert.equal(await page.getByText('Danh mục chưa có dữ liệu', { exact: true }).count(), 0);
  fail = false; await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await page.locator('.be-records button').first().waitFor();
  await page.screenshot({ path: '.workstation-build/workspace-ux/missions.png', fullPage: true });
  await go('Live Operations');
  await page.locator('.be-records button').first().click();
  await page.getByText('Các bước thực thi · 2', { exact: true }).waitFor();
  assert.equal(await page.locator('.be-job-progress li').count(), 2);
  await page.screenshot({ path: '.workstation-build/workspace-ux/jobs.png', fullPage: true });
  for (const section of ['Missions', 'Facility Management', 'Public Catalog']) {
    await page.setViewportSize({ width: 390, height: 844 }); await go(section);
    await page.locator('.be-records button').first().click();
    await page.locator('.be-record-summary').waitFor(); await noOverflow();
    await page.screenshot({ path: `.workstation-build/workspace-ux/mobile-${section.replaceAll(' ', '-')}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:5175/workstations');
  await page.getByLabel('Điểm tiếp theo', { exact: true }).selectOption('b');
  await page.getByRole('button', { name: '+ Thêm điểm dừng', exact: true }).click();
  await page.getByRole('button', { name: 'Chạy mô phỏng', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const elapsed = await page.getByTestId('dispatch-clock').getAttribute('data-elapsed');
  await page.getByRole('button', { name: 'Mô phỏng 3D', exact: true }).click();
  await page.locator('.patrol-three-scene canvas').waitFor();
  assert.equal(await page.getByTestId('dispatch-clock').getAttribute('data-elapsed'), elapsed);
  await page.screenshot({ path: '.workstation-build/workspace-ux/dispatch-3d.png', fullPage: true });
  await page.getByRole('button', { name: 'Bản đồ 2D', exact: true }).click();
  assert.equal(await page.getByTestId('dispatch-clock').getAttribute('data-elapsed'), elapsed);
  await page.getByRole('button', { name: 'Mô phỏng 3D', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
  await page.screenshot({ path: '.workstation-build/workspace-ux/mobile-dispatch.png', fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log('PASS: API source and timestamps, grouped catalogs, readable content, forms, filters, empty/error distinction, job steps, mobile, Dispatch 2D/3D retains progress. All API responses mocked; no server changes.');
} finally { await browser.close(); }
