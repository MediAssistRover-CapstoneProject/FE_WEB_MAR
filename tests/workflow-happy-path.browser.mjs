import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { connect, toPayload } from '../src/features/workflows/designer/designerModel.js';
import { graphDetail, happyPathDocument } from './fixtures/workflow-happy-path.mjs';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5186';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [], writes = [], documents = new Map();
page.on('pageerror', e => errors.push(e.message));
const document = happyPathDocument(), payload = toPayload(document);
documents.set('happy', graphDetail(payload, 'happy'));
const legacy = structuredClone(payload); delete legacy.workflow.inputUiJson.designer.automaticErrorRoutes;
documents.set('legacy', graphDetail(legacy, 'legacy'));
let custom = happyPathDocument();
custom.nodes.push({ id: 'custom-stop', type: 'workflow', position: { x: 650, y: 450 }, data: { kind: 'terminal', name: 'Xử lý riêng', terminalStatus: 'FAILED' } });
custom = connect(custom, { source: custom.nodes.find(n => n.data.kind === 'step').id, target: 'custom-stop', sourceHandle: 'FAILURE' });
documents.set('custom', graphDetail(toPayload(custom), 'custom'));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'happy-path-test' }, tokens: { accessToken: 'mock' } })));
await page.route('**/*', route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (method !== 'GET') writes.push({ path, method, body: request.postDataJSON() });
  if (path === '/api/v1/admin/workflows') return json({ content: [...documents.values()].map(d => d.workflow), last: true });
  const match = path.match(/^\/api\/v1\/admin\/workflows\/([^/]+)(\/graph)?$/);
  if (match) {
    const [, id, graph] = match, detail = documents.get(id);
    if (method === 'GET') return json(detail);
    if (method === 'PUT' && !graph) { detail.workflow = { ...detail.workflow, ...request.postDataJSON() }; return json(detail.workflow); }
    if (method === 'PUT' && graph) { const saved = graphDetail({ workflow: detail.workflow, graph: request.postDataJSON() }, id); documents.set(id, saved); return json(saved); }
  }
  if (method === 'GET') return json({ content: [], last: true });
  return json({ message: 'Unexpected write' }, 500);
});
const errorPorts = () => page.locator('.react-flow__handle.source[data-handleid="FAILURE"], .react-flow__handle.source[data-handleid="TIMEOUT"]');
try {
  await page.goto(base + '/workflow?workflowId=happy');
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await expect(errorPorts()).toHaveCount(0);
  await expect(page.locator('.wfd-node-error-policy')).toHaveCount(2);
  await expect(page.locator('.wfd-node-error-policy').first()).toHaveText('Lỗi / Hết giờ: báo lỗi và dừng');
  await page.locator('.react-flow__node').filter({ has: page.locator('.wfd-node-top small', { hasText: /^WAIT$/ }) }).first().locator('strong').click();
  await expect(page.getByLabel('Thực thi và xử lý sự cố')).toContainText('Không cần nối dây');
  await page.getByRole('button', { name: 'Nhánh lỗi nâng cao', exact: true }).click();
  await expect(errorPorts()).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await page.getByRole('button', { name: 'Nhánh lỗi nâng cao', exact: true }).click();
  await expect(errorPorts()).toHaveCount(0);
  await page.getByRole('button', { name: 'Lưu lên máy chủ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu đầy đủ');
  const saved = writes.find(w => w.path.endsWith('/graph')).body;
  assert.equal(saved.transitions.filter(t => ['FAILURE', 'TIMEOUT'].includes(t.outcome)).length, 4);
  assert.ok(saved.transitions.filter(t => t.outcome !== 'SUCCESS').every(t => t.toStepCode === null && t.terminalStatus === 'RECOVERY_REQUIRED'));
  await page.getByRole('button', { name: '← Thư viện', exact: true }).click();
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('mediassist.workflow-designer.v1:')) localStorage.removeItem(key); });
  await page.goto(base + '/workflow?workflowId=happy');
  await expect(errorPorts()).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await expect(page.locator('.wfd-node.terminal')).toHaveCount(1);
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  await mkdir('.workstation-build/workflow-designer', { recursive: true });
  await page.screenshot({ path: '.workstation-build/workflow-designer/happy-path.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(errorPorts()).toHaveCount(0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(base + '/workflow?workflowId=legacy');
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await expect(errorPorts()).toHaveCount(0);
  await page.goto(base + '/workflow?workflowId=custom');
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  await expect(errorPorts()).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Nhánh lỗi nâng cao', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Nhánh lỗi nâng cao', exact: true }).click();
  await expect(errorPorts()).toHaveCount(4);
  await page.getByRole('button', { name: 'Nhánh lỗi nâng cao', exact: true }).click();
  await expect(errorPorts()).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  assert.deepEqual(errors, []);
  console.log('PASS: success-only canvas, inline stop policies, optional error ports, complete backend routes, clean server reload, legacy auto routes, custom recovery paths and mobile layout; all APIs mocked.');
} finally { await browser.close(); }
