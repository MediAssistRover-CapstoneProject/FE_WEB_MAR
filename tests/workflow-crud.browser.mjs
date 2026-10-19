import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const workflowId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const stepId = '33333333-3333-4333-8333-333333333333';
let workflow = null;
let task = null;
let step = null;
let failCreate = true;
const calls = [];

const json = (route, value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });

try {
  await page.addInitScript(() => {
    sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'test-access' } }));
  });
  await page.route('**/api/v1/admin/workflows**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = request.postDataJSON?.() ?? null;
    calls.push({ method, path, body });

    if (path === '/api/v1/admin/workflows' && method === 'GET') return json(route, { content: workflow ? [workflow] : [], totalElements: workflow ? 1 : 0 });
    if (path === '/api/v1/admin/workflows' && method === 'POST') {
      if (failCreate) { failCreate = false; return json(route, { message: 'Lưu thất bại' }, 500); }
      workflow = { ...body, workflowId, status: 'DRAFT' };
      return json(route, workflow, 201);
    }
    if (path === `/api/v1/admin/workflows/${workflowId}` && method === 'GET') return json(route, { workflow, tasks: task ? [task] : [], steps: step ? [step] : [], transitions: [] });
    if (path === `/api/v1/admin/workflows/${workflowId}` && method === 'PUT') {
      workflow = { ...workflow, ...body };
      return json(route, workflow);
    }
    if (path === `/api/v1/admin/workflows/${workflowId}` && method === 'DELETE') {
      workflow = null; task = null; step = null;
      return route.fulfill({ status: 204 });
    }
    if (path === `/api/v1/admin/workflows/${workflowId}/tasks` && method === 'POST') {
      task = { ...body, taskId, workflowId };
      return json(route, task, 201);
    }
    if (path === `/api/v1/admin/workflows/${workflowId}/tasks/${taskId}` && method === 'PUT') {
      task = { ...task, ...body };
      return json(route, task);
    }
    if (path === `/api/v1/admin/workflows/${workflowId}/tasks/${taskId}` && method === 'DELETE') {
      task = null;
      return route.fulfill({ status: 204 });
    }
    if (path === `/api/v1/admin/workflows/${workflowId}/steps` && method === 'POST') {
      step = { ...body, stepId, workflowId };
      return json(route, step, 201);
    }
    if (path === `/api/v1/admin/workflows/${workflowId}/steps/${stepId}` && method === 'PUT') {
      step = { ...step, ...body };
      return json(route, step);
    }
    if (path === `/api/v1/admin/workflows/${workflowId}/steps/${stepId}` && method === 'DELETE') {
      step = null;
      return route.fulfill({ status: 204 });
    }
    return json(route, { message: `Unexpected ${method} ${path}` }, 500);
  });

  await page.goto('http://localhost:5173/workflows');
  await page.getByRole('button', { name: '+ Tạo quy trình' }).click();
  await page.getByLabel('Tên quy trình').fill('Quy trình kiểm thử');
  await page.getByLabel('Mô tả').fill('Có thể nhập mô tả');
  await page.getByRole('button', { name: 'Thêm tác vụ' }).click();
  assert.ok(await page.getByRole('button', { name: 'Lưu quy trình' }).isVisible(), 'Save must remain visible after adding a task');
  assert.ok(await page.getByRole('button', { name: 'Lưu quy trình' }).evaluate((button) => {
    const box = button.getBoundingClientRect();
    return box.top < window.innerHeight && box.bottom > 0;
  }), 'Save must remain inside the viewport after adding a task');
  await page.getByRole('button', { name: '+ Thêm bước' }).click();
  await page.locator('.type-modal-card > div button').filter({ hasText: 'MOVE' }).first().click();
  await page.locator('.inline-config-fields input').first().fill('map-1');
  await page.getByRole('button', { name: /Done/ }).click();
  await page.getByRole('button', { name: 'Lưu quy trình' }).click();
  await page.getByRole('alert').getByText('Lưu thất bại').waitFor();
  assert.equal(await page.getByLabel('Tên quy trình').inputValue(), 'Quy trình kiểm thử', 'Failed save must preserve editor input');
  await page.getByRole('button', { name: 'Lưu quy trình' }).click();
  await page.getByRole('status').getByText('Đã lưu quy trình vào máy chủ.').waitFor();
  assert.equal(workflow.workflowName, 'Quy trình kiểm thử');
  assert.equal(task.taskName, 'Tác vụ 1');
  assert.equal(step.stepTypeCode, 'MOVE');
  assert.equal(step.paramsJson.map_id, 'map-1');

  await page.getByRole('button', { name: 'Mở Quy trình kiểm thử' }).click();
  await page.getByLabel('Tên quy trình').fill('Quy trình đã sửa');
  await page.getByRole('button', { name: 'Lưu quy trình' }).click();
  await page.getByRole('status').getByText('Đã lưu quy trình vào máy chủ.').waitFor();
  assert.equal(workflow.workflowName, 'Quy trình đã sửa');
  assert.ok(calls.some((call) => call.method === 'PUT' && call.path === `/api/v1/admin/workflows/${workflowId}`));

  await page.getByRole('button', { name: 'Mở Quy trình đã sửa' }).click();
  await page.locator('.editor-side-button').first().click();
  await page.getByRole('button', { name: 'Xóa bước 1' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Xóa Tác vụ 1' }).click();
  await page.getByRole('button', { name: 'Lưu quy trình' }).click();
  await page.getByRole('status').getByText('Đã lưu quy trình vào máy chủ.').waitFor();
  assert.equal(step, null);
  assert.equal(task, null);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Xóa Quy trình đã sửa' }).click();
  await page.getByRole('status').getByText('Đã xóa bản nháp.').waitFor();
  assert.equal(workflow, null);
  console.log('PASS: workflow fields, task/step creation, save, edit, task/step deletion, and draft deletion use the API.');
} finally {
  await browser.close();
}
