import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.WORKFLOW_TEST_URL || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage();
const workflows = Array.from({ length: 201 }, (_, index) => ({ workflowId: `wf-${index}`,
  workflowName: `Workflow ${index}`, workflowCode: `CODE_${index}`, versionNo: 1, rowVersion: 0, status: 'DRAFT' }));
const detail = index => ({ workflow: workflows[index], tasks: [], transitions: [], steps: [{
  stepId: `step-${index}`, stepCode: 'SAY', stepName: `Lời nói ${index}`, sequenceNo: 1, stepTypeCode: 'INTERACT',
  paramsJson: { action: 'SPEAK', data: { text: `Nội dung ${index}` } }, inputMappingJson: {},
}] });
const listRequests = [], detailRequests = [], cancelled = [], errors = [];
let failList = false, holdList = false;
const releases = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => cancelled.push(new URL(request.url()).pathname));
await page.addInitScript(() => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'loading-test' }, tokens: { accessToken: 'mock' } }));
});
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/')) return url.origin === new URL(base).origin ? route.continue() : route.abort();
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (path === '/api/v1/admin/workflows') {
    const index = Number(url.searchParams.get('page'));
    assert.equal(url.searchParams.get('size'), '100');
    listRequests.push(index);
    if (holdList) await new Promise(resolve => releases.push(resolve));
    if (failList) return json({ message: 'Danh sách tạm thời không khả dụng.' }, 503);
    return json({ content: workflows.slice(index * 100, (index + 1) * 100), totalPages: 3, last: index === 2 });
  }
  const match = path.match(/^\/api\/v1\/admin\/workflows\/wf-(\d+)$/);
  if (match) {
    const index = Number(match[1]); detailRequests.push(index);
    if (index === 0) await new Promise(resolve => releases.push(resolve));
    return json(detail(index));
  }
  if (path === '/api/v1/admin/speech-settings') return json({ voice: 'coral', speedMultiplier: 1.25, instructions: '', revision: 'test' });
  if (path === '/api/v1/pi/speech/status') return json({ tts: { enabled: false, configured: false } });
  return json({ content: [], last: true });
});
const workspace = page.getByRole('region', { name: 'Lời nói workflow', exact: true });
const picker = workspace.getByLabel('Workflow', { exact: true });
const releaseAll = () => { while (releases.length) releases.shift()(); };
try {
  await page.goto(base + '/admin/voice-scripts?tab=workflow-speech');
  await expect(picker).toBeEnabled();
  await expect(picker.locator('option')).toHaveCount(202);
  assert.deepEqual(listRequests, [0, 1, 2], 'StrictMode sends one list request per page');
  assert.deepEqual(detailRequests, [], '201 workflows require zero graph downloads to open the picker');

  await picker.selectOption('wf-150');
  await expect(workspace).toContainText('Nội dung 150');
  assert.deepEqual(detailRequests, [150]);

  await picker.selectOption('wf-0');
  await expect.poll(() => detailRequests.at(-1)).toBe(0);
  await picker.selectOption('wf-1');
  await expect(workspace).toContainText('Nội dung 1');
  await expect.poll(() => cancelled.includes('/api/v1/admin/workflows/wf-0')).toBe(true);
  releaseAll();
  await expect(workspace).not.toContainText('Nội dung 0');

  await picker.selectOption('wf-0');
  await expect.poll(() => detailRequests.filter(index => index === 0).length).toBe(2);
  const abortedBeforeLeave = cancelled.filter(path => path.endsWith('/wf-0')).length;
  await page.getByRole('button', { name: 'Giọng robot', exact: true }).click();
  await expect.poll(() => cancelled.filter(path => path.endsWith('/wf-0')).length).toBeGreaterThan(abortedBeforeLeave);
  releaseAll();

  // Opening a direct link loads its graph independently of a slow catalog.
  holdList = true;
  await page.goto(base + '/admin/voice-scripts?tab=workflow-speech&workflowId=wf-2');
  await expect(workspace).toContainText('Nội dung 2');
  await expect(picker).toBeDisabled();
  holdList = false; releaseAll();
  await expect(picker).toBeEnabled();

  // A list failure must remain visible even if the selected graph succeeds.
  failList = true;
  await workspace.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(workspace.getByRole('alert')).toContainText('Danh sách tạm thời không khả dụng.');
  await expect(workspace).toContainText('Nội dung 2');
  failList = false;
  await workspace.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(workspace.getByRole('alert')).toHaveCount(0);
  await expect(picker).toBeEnabled();

  // A stalled connection is bounded, and leaving cancels any pending list call.
  await page.clock.install();
  holdList = true;
  const listsBeforeTimeout = listRequests.length;
  await workspace.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect.poll(() => listRequests.length).toBeGreaterThan(listsBeforeTimeout);
  await page.clock.fastForward(20001);
  await expect(workspace.getByRole('alert')).toContainText('Tải danh sách workflow quá lâu');
  await expect(workspace.getByRole('button', { name: 'Tải lại', exact: true })).toBeEnabled();
  holdList = false; releaseAll();
  await workspace.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(picker).toBeEnabled();
  assert.deepEqual(errors, []);
  console.log('PASS 201-workflow catalog: 3 list requests, 0 eager graph requests; selected graph only, cancellation, independent loading, retry and timeout. All APIs mocked.');
} finally { releaseAll(); await browser.close(); }
