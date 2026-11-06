import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { newDocument, fromDetail } from '../src/features/workflows/designer/designerModel.js';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5186';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [], writes = [], documents = new Map();
page.on('pageerror', e => errors.push(e.message));
for (const status of ['DRAFT', 'VALIDATED', 'PUBLISHED', 'ARCHIVED']) {
  const workflow = { ...newDocument().workflow, workflowId: status, workflowName: `Workflow ${status}`, workflowCode: status, status };
  documents.set(status, { workflow, tasks: [], steps: [], transitions: [] });
}
const drafts = ['PUBLISHED', 'PUBLISHED', 'DRAFT'].map((id, index) => ({ document: { ...fromDetail(documents.get(id)), localId: `local-${index}` } }));
const local = newDocument(); local.workflow.workflowName = 'Local only';
drafts.push({ document: local });
await page.addInitScript(({ drafts }) => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'delete-test' }, tokens: { accessToken: 'mock' } }));
  window.__deleteDraftSeed = drafts;
}, { drafts });
let failure = null, releaseDelete = null;
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (request.method() !== 'GET') writes.push({ method: request.method(), path });
  if (path === '/api/v1/admin/workflows') return json({ content: [...documents.values()].map(d => d.workflow), last: true });
  const match = path.match(/^\/api\/v1\/admin\/workflows\/([^/]+)(\/force)?$/);
  if (match) {
    const [, id, force] = match;
    if (request.method() === 'GET') return json(documents.get(id));
    if (request.method() === 'DELETE' && force) {
      if (failure) return json({ message: failure.message }, failure.status);
      if (releaseDelete) await new Promise(resolve => { releaseDelete = resolve; });
      documents.delete(id);
      return json({ workflowId: id, deletedJobs: 2, deletedSchedules: 1 });
    }
  }
  if (request.method() === 'GET') return json({ content: [], last: true });
  return json({ message: 'Unexpected write' }, 500);
});
const card = name => page.locator('.wfd-library-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
const dialog = page.getByRole('dialog');
const draftValues = () => page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => k.startsWith('mediassist.workflow-designer.v1:'));
  return key ? JSON.parse(localStorage.getItem(key)).drafts : [];
});
try {
  await page.goto(base + '/workflow');
  await expect(card('Workflow PUBLISHED')).toBeVisible();
  // Create the storage key using the actual application configuration, then seed device drafts.
  await page.getByRole('button', { name: '＋ Tạo quy trình', exact: true }).first().click();
  await page.getByRole('button', { name: 'Lưu trên thiết bị', exact: true }).click();
  await page.getByRole('button', { name: '← Thư viện', exact: true }).click();
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage).filter(k => k.startsWith('mediassist.workflow-designer.v1:'))) localStorage.setItem(key, JSON.stringify({ version: 1, drafts: window.__deleteDraftSeed }));
  });
  await page.reload();
  await expect(card('Local only')).toBeVisible();
  // Cancellation and Escape never send a request.
  await card('Workflow VALIDATED').getByRole('button', { name: 'Xóa quy trình', exact: true }).click();
  await expect(dialog).toContainText('lịch sử nhiệm vụ');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  assert.equal(writes.length, 0);
  // A server denial keeps both the remote definition and every device draft.
  await card('Workflow PUBLISHED').first().getByRole('button', { name: 'Xóa quy trình', exact: true }).click();
  const before = await draftValues();
  for (const status of [409, 403, 500]) {
    failure = { status, message: status === 409 ? 'Workflow has active Jobs (QUEUED, ACCEPTED or RUNNING)' : `Delete failed ${status}` };
    await dialog.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText(failure.message);
    assert.deepEqual(await draftValues(), before);
    assert.ok(documents.has('PUBLISHED'));
  }
  failure = null; releaseDelete = true;
  const pendingStart = writes.length;
  await dialog.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Đang xóa…', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  assert.equal(writes.length, pendingStart + 1);
  releaseDelete(); releaseDelete = null;
  await expect(dialog).toHaveCount(0);
  await expect(card('Workflow PUBLISHED')).toHaveCount(0);
  assert.equal((await draftValues()).filter(d => d.document.workflow.workflowId === 'PUBLISHED').length, 0);
  // All remote states expose permanent deletion, including drafts with a device copy.
  for (const status of ['DRAFT', 'VALIDATED', 'ARCHIVED']) {
    await card(`Workflow ${status}`).getByRole('button', { name: 'Xóa quy trình', exact: true }).click();
    await dialog.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
    await expect(card(`Workflow ${status}`)).toHaveCount(0);
  }
  // An unsaved editor deletes locally, clears its URL/editor and never resurrects via autosave.
  const previousWrites = writes.length;
  await card('Local only').getByRole('button', { name: 'Mở quy trình', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa bản thiết bị', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xóa bản thiết bị', exact: true }).click();
  await expect(page.locator('.wfd-studio')).toHaveCount(0);
  await page.reload();
  await expect(card('Local only')).toHaveCount(0);
  assert.equal(writes.length, previousWrites);
  // Deleting from a deep-linked server editor clears workflowId and its device drafts.
  documents.set('DEEP', { workflow: { ...newDocument().workflow, workflowId: 'DEEP', workflowName: 'Deep workflow', status: 'DRAFT' }, tasks: [], steps: [], transitions: [] });
  await page.goto(base + '/workflow?workflowId=DEEP');
  await expect(page.locator('.wfd-studio')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu trên thiết bị', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa quy trình', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
  await expect(page.locator('.wfd-studio')).toHaveCount(0);
  await expect(page).toHaveURL(base + '/workflow');
  await page.reload();
  await expect(card('Deep workflow')).toHaveCount(0);
  assert.equal((await draftValues()).length, 0);
  assert.ok(writes.every(w => w.method === 'DELETE' && w.path.endsWith('/force')));
  assert.deepEqual(errors, []);
  console.log('PASS: workflow delete across all statuses, synced drafts, cancellation, pending guard, server errors, local-only removal and deep-linked editor cleanup; all APIs mocked.');
} finally { await browser.close(); }
