import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { deliveryDocument } from './fixtures/workflow-delivery-design.mjs';
import { toPayload } from '../src/features/workflows/designer/designerModel.js';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5186';
const { doc, stages } = deliveryDocument(), body = toPayload(doc);
const detail = {
  workflow: { ...body.workflow, workflowId: 'audit', startStepId: 'id-' + body.graph.startStepCode, status: 'DRAFT' },
  tasks: body.graph.tasks.map(t => ({ ...t, taskId: 'task-' + t.taskCode })),
  steps: body.graph.steps.map(s => ({ ...s, stepId: 'id-' + s.stepCode, stepTypeCode: s.stepType, taskId: 'task-' + s.taskCode, enabled: true })),
  transitions: body.graph.transitions.map((e, i) => ({ ...e, transitionId: 'edge-' + i, fromStepId: 'id-' + e.fromStepCode, toStepId: e.toStepCode ? 'id-' + e.toStepCode : null })),
};
await mkdir('.workstation-build/workflow-designer', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [], writes = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'step-audit', username: 'step-audit' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  if (req.method() !== 'GET') writes.push(path);
  const value = path === '/api/v1/admin/workflows/audit' ? detail : path === '/api/v1/admin/workflows' ? { content: [detail.workflow], last: true, totalPages: 1 } : { content: [], last: true, totalPages: 1 };
  return route.fulfill({ status: req.method() === 'GET' ? 200 : 500, contentType: 'application/json', body: JSON.stringify(value) });
});
async function select(id) {
  await page.getByRole('button', { name: 'Thông tin & biến', exact: true }).click();
  await page.locator(`.react-flow__node[data-id="${id}"] .wfd-node>strong`).click();
}
async function add(typeLabel) {
  await page.locator('.wfd-palette-list button').filter({ has: page.locator('strong', { hasText: new RegExp('^' + typeLabel + '$') }) }).click();
}
try {
  await page.goto(base + '/workflow?workflowId=audit');
  await expect(page.locator('.wfd-studio')).toBeVisible();
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  for (const ids of Object.values(stages)) for (const [index, producer, field] of [[2, 1, 'verified'], [5, 4, 'confirmed'], [7, 6, 'closed'], [10, 9, 'locked']]) {
    await select(ids[index]);
    await expect(page.getByLabel('Nguồn dữ liệu', { exact: true })).toHaveValue('output');
    await expect(page.getByLabel('Bước cung cấp dữ liệu', { exact: true })).toHaveValue(ids[producer]);
    await expect(page.getByLabel('Trường kết quả', { exact: true })).toHaveValue(field);
    await expect(page.getByLabel('Đường dẫn dữ liệu', { exact: true })).toHaveValue(`/outputs/${ids[producer]}/${field}`);
  }
  await page.screenshot({ path: '.workstation-build/workflow-designer/output-picker.png', fullPage: true });
  await select(stages.SENDER[1]);
  await expect(page.getByLabel('Nguồn Mục đích', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Mục đích', { exact: true })).toHaveValue('DELIVERY_SENDER');
  await expect(page.locator('.wfd-output-panel')).toContainText('verified');
  await select(stages.SENDER[3]);
  await expect(page.getByLabel('Bước xác thực cấp quyền', { exact: true })).toHaveValue(stages.SENDER[1]);
  assert.ok(!(await page.getByLabel('Bước xác thực cấp quyền', { exact: true }).locator('option').evaluateAll(opts => opts.map(o => o.value))).includes(stages.RECEIVER[1]));
  await page.getByLabel('Bước xác thực cấp quyền', { exact: true }).selectOption('');
  await page.getByLabel('Bước xác thực cấp quyền', { exact: true }).selectOption(stages.SENDER[1]);
  await page.screenshot({ path: '.workstation-build/workflow-designer/authorization-picker.png', fullPage: true });
  await select(stages.SENDER[4]);
  await expect(page.getByLabel('Biến cho Hàng hóa', { exact: true })).toHaveValue('items');
  await page.getByLabel('Nguồn Hàng hóa', { exact: true }).selectOption('fixed');
  await page.getByRole('button', { name: '+ Thêm hàng', exact: true }).click();
  await page.getByLabel('Mã hàng 1', { exact: true }).fill('HANG_001');
  await page.getByLabel('Số lượng 1', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.locator('.wfd-validation')).toContainText('Số lượng');
  assert.equal(writes.length, 0, 'invalid nested values must not be submitted');
  await page.getByLabel('Số lượng 1', { exact: true }).fill('1');
  await page.getByLabel('Nguồn Hàng hóa', { exact: true }).selectOption('input');
  await select(stages.SENDER[6]);
  await expect(page.getByLabel('Mẫu tương tác', { exact: true })).toHaveValue('CLOSE_SENDER');
  await expect(page.locator('.wfd-output-panel')).toContainText('closed');
  await page.getByLabel('Mẫu tương tác', { exact: true }).selectOption('VERIFY_SENDER');
  await expect(page.getByLabel('Mã lời nhắc', { exact: true })).toHaveValue('VERIFY_SENDER');
  await expect(page.locator('.wfd-output-panel')).toContainText('locked');
  await page.getByLabel('Mẫu tương tác', { exact: true }).selectOption('SPEAK');
  await page.getByLabel('Nội dung nói', { exact: true }).fill('Vui lòng đóng cửa ngăn hàng.');
  await page.getByLabel('Ngôn ngữ', { exact: true }).selectOption('vi');
  await expect(page.getByLabel('Vai trò yêu cầu', { exact: true })).toHaveCount(0);
  await add('Dịch vụ dữ liệu');
  await page.getByLabel('Dịch vụ', { exact: true }).selectOption('SELECT_TARGET');
  await expect(page.getByLabel('Danh sách điểm (JSON)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Câu hỏi', { exact: true })).toHaveCount(0);
  await expect(page.locator('.wfd-output-panel')).toContainText('data/has_target');
  await page.getByLabel('Dịch vụ', { exact: true }).selectOption('COMMIT_MAP_ARTIFACT');
  for (const label of ['Phiên quét', 'Tệp bản đồ', 'Tầng', 'Tên bản đồ']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  await add('Chờ');
  await page.getByLabel('Kiểu chờ', { exact: true }).selectOption('EVENT');
  await expect(page.getByLabel('Loại sự kiện', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Khóa liên kết sự kiện', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Thời gian chờ (giây)', { exact: true })).toHaveCount(0);
  await expect(page.locator('.wfd-output-panel')).toContainText('event/data');
  await add('Ghi ngữ cảnh');
  await page.getByRole('button', { name: '+ Thêm phép cập nhật', exact: true }).click();
  await page.getByLabel('Biến ngữ cảnh 1', { exact: true }).fill('delivered_count');
  await page.getByLabel('Phép cập nhật 1', { exact: true }).selectOption('SET');
  await page.getByLabel('Kiểu giá trị 1', { exact: true }).selectOption('number');
  await page.getByLabel('Giá trị 1', { exact: true }).fill('0');
  await expect(page.locator('.wfd-output-panel')).toContainText('updated/delivered_count');
  await add('Thông báo');
  await expect(page.getByLabel('Yêu cầu xác nhận', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Nhân viên', { exact: true })).toBeChecked();
  await add('Đọc cảm biến');
  await page.getByLabel('Loại quan sát', { exact: true }).selectOption('CROWD_DENSITY');
  await expect(page.getByLabel('Vùng', { exact: true })).toBeVisible();
  await expect(page.locator('.wfd-output-panel')).toContainText('metrics/count');
  await page.getByLabel('Loại quan sát', { exact: true }).selectOption('MAPPING');
  await expect(page.getByLabel('Thao tác quét', { exact: true })).toBeVisible();
  await page.getByLabel('Thao tác quét', { exact: true }).selectOption('SAVE');
  await expect(page.getByLabel('Tệp bản đồ', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log('PASS: actual confirmed/verified/closed/locked output selection, authorization builder, all 11 step field groups, nested item validation, speech, context and mobile layout.');
} catch (error) {
  await page.screenshot({ path: '.workstation-build/workflow-designer/step-config-failure.png', fullPage: true });
  console.error('Browser runtime errors:', errors);
  throw error;
} finally { await browser.close(); }
