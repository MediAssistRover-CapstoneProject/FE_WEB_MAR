import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { deliveryDocument } from './fixtures/workflow-delivery-design.mjs';
import { toPayload } from '../src/features/workflows/designer/designerModel.js';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5186';
const payload = toPayload(deliveryDocument().doc);
const workflowId = '33333333-3333-4333-8333-333333333333';
function detail(body) {
  return {
    workflow: { ...body.workflow, workflowId, startStepId: 'id-' + body.graph.startStepCode, status: 'DRAFT' },
    tasks: body.graph.tasks.map(t => ({ ...t, taskId: 'task-' + t.taskCode })),
    steps: body.graph.steps.map(s => ({ ...s, stepId: 'id-' + s.stepCode, stepTypeCode: s.stepType, taskId: 'task-' + s.taskCode, enabled: true })),
    transitions: body.graph.transitions.map((e, i) => ({ ...e, transitionId: 'edge-' + i, fromStepId: 'id-' + e.fromStepCode, toStepId: e.toStepCode ? 'id-' + e.toStepCode : null })),
  };
}
let saved = detail(payload);
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', dialog => dialog.accept());
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'qr-draft-test' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const respond = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (request.method() !== 'GET') writes.push({ path, method: request.method(), body: request.postDataJSON() });
  if (path === '/api/v1/admin/workflows') return respond({ content: [saved.workflow], last: true, totalPages: 1 });
  if (path === `/api/v1/admin/workflows/${workflowId}` && request.method() === 'GET') return respond(saved);
  if (path === `/api/v1/admin/workflows/${workflowId}` && request.method() === 'PUT') { saved.workflow = { ...saved.workflow, ...request.postDataJSON(), status: 'DRAFT' }; return respond(saved.workflow); }
  if (path === `/api/v1/admin/workflows/${workflowId}/graph`) { saved = detail({ workflow: saved.workflow, graph: request.postDataJSON() }); return respond(saved); }
  if (path === `/api/v1/admin/workflows/${workflowId}/validate`) { saved.workflow.status = 'VALIDATED'; return respond({ status: 'VALIDATED', definitionHash: 'test-hash', warnings: [] }); }
  return respond({ content: [], last: true, totalPages: 1 });
});
try {
  await page.goto(`${base}/workflow?workflowId=${workflowId}`);
  await expect(page.locator('.wfd-node-top small', { hasText: 'CHECK_CONDITION' })).toHaveCount(8);
  await page.getByRole('button', { name: 'Mẫu giao hàng QR', exact: true }).click();
  await expect(page.locator('.wfd-node-top small').filter({ hasText: /^(MOVE|AUTHENTICATE|CONTROL_HARDWARE|INTERACT)$/ })).toHaveCount(10);
  await expect(page.locator('.wfd-node-top small', { hasText: 'CHECK_CONDITION' })).toHaveCount(0);
  await expect(page.locator('.wfd-node-top small', { hasText: 'HANDLE_PAYLOAD' })).toHaveCount(0);
  await expect(page.locator('.wfd-banner.warning')).toContainText('chưa sẵn sàng chạy');
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('Đã lưu đầy đủ');
  assert.equal(saved.steps.length, 10);
  assert.equal(saved.workflow.workflowId, workflowId);
  assert.equal(saved.workflow.inputUiJson.deliveryDraft.runtimeReady, false);
  assert.deepEqual(saved.steps.filter(s => s.stepType === 'AUTHENTICATE').map(s => s.paramsJson.method), ['QR_CODE', 'QR_CODE']);
  assert.deepEqual(saved.steps.filter(s => s.stepType === 'INTERACT').map(s => s.paramsJson.prompt_key), ['REQUEST_CLOSE_SENDER', 'REQUEST_CLOSE_RECEIVER']);
  assert.equal(saved.transitions.filter(t => t.outcome === 'FAILURE').length, 10);
  assert.equal(saved.transitions.filter(t => t.outcome === 'TIMEOUT').length, 10);
  assert.deepEqual(saved.transitions.filter(t => t.conditionJson).map(t => t.conditionJson.path), ['/result/verified', '/result/confirmed', '/result/verified', '/result/confirmed']);
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('BE đã kiểm tra cấu trúc');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator('.wfd-node-top small').filter({ hasText: /^(MOVE|AUTHENTICATE|CONTROL_HARDWARE|INTERACT)$/ })).toHaveCount(10);
  await expect(page.locator('.wfd-banner.warning')).toContainText('chưa sẵn sàng chạy');
  assert.ok(!writes.some(w => /publish|job-steps|\/jobs(?:\/|$)|qr-verifications/.test(w.path)));
  assert.deepEqual(errors, []);
  console.log('PASS: existing demo rebuilt, saved and restored as a guarded 10-step QR draft; no runtime calls.');
} finally { await browser.close(); }
