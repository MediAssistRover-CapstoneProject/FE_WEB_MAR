import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.WORKFLOW_TEST_URL || 'http://127.0.0.1:5186';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], writes = [], reads = [];
let fail = false, slow = false;
const workflow = { workflowId: 'delivery-v1', workflowCode: 'DELIVERY', workflowName: 'Giao thuốc',
  status: 'PUBLISHED', versionNo: 1, rowVersion: 4, acceptsNewJobs: true };
const step = (stepCode, sequenceNo, stepName, text, extra = {}) => ({ stepId: 'id-' + stepCode, taskId: 'delivery',
  stepCode, sequenceNo, stepName, stepTypeCode: 'INTERACT', enabled: true,
  paramsJson: { action: 'SPEAK', prompt_key: stepCode, data: { text, language_code: 'vi', volume: 0 } }, inputMappingJson: {}, ...extra });
const detail = { workflow, tasks: [{ taskId: 'delivery', taskName: 'Giao hàng' }], transitions: [], steps: [
  step('ARRIVE', 2, 'Đến phòng bệnh', 'Thuốc đã đến phòng bệnh.'),
  step('PICKUP', 1, 'Nhận thuốc', 'Vui lòng đặt thuốc vào ngăn.'),
  step('BOUND', 3, 'Đọc thông báo động', 'Fallback', { inputMappingJson: { data: { text: { $ref: '/inputs/message' }, volume: 70 } } }),
  step('ALL_BOUND', 4, 'Đọc dữ liệu liên kết', 'Fallback', { inputMappingJson: { data: { $ref: '/inputs/speech' } } }),
] };
const draft = structuredClone(detail);
draft.workflow = { ...workflow, workflowId: 'draft', workflowName: 'Bản nháp giao thuốc', workflowCode: 'DRAFT_DELIVERY', status: 'DRAFT' };
const empty = { ...structuredClone(draft), workflow: { ...draft.workflow, workflowId: 'empty', workflowName: 'Quy trình chờ' }, steps: [] };
const confirm = { ...structuredClone(empty), workflow: { ...empty.workflow, workflowId: 'confirm', workflowName: 'Xác nhận giao hàng' },
  steps: [step('CONFIRM', 1, 'Xác nhận', 'Vui lòng xác nhận', { paramsJson: { action: 'CONFIRM' } })] };
const overridden = { ...structuredClone(empty), workflow: { ...empty.workflow, workflowId: 'overridden', workflowName: 'Hành động đã đổi' },
  steps: [step('OVERRIDE', 1, 'Tương tác', 'Nội dung cũ', { inputMappingJson: { action: 'DISPLAY' } })] };
const documents = new Map([[workflow.workflowId, detail], ['draft', draft], ['empty', empty], ['confirm', confirm], ['overridden', overridden]]);
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'speech-test' }, tokens: { accessToken: 'mock' } }));
  window.__speech = [];
  Object.defineProperty(window, 'speechSynthesis', { value: { cancel() {}, getVoices: () => [],
    speak(value) { window.__speech.push({ text: value.text, volume: value.volume, rate: value.rate }); value.onend?.(); },
    addEventListener() {}, removeEventListener() {} } });
});
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === base ? route.continue() : route.abort();
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (path === '/api/v1/admin/workflows') return json({ content: [...documents.values()].map(item => item.workflow), last: true });
  const match = path.match(/^\/api\/v1\/admin\/workflows\/([^/]+)(\/speech)?$/);
  if (match) {
    const [, id, speech] = match;
    if (!speech) { reads.push(id); return json(documents.get(id)); }
    const body = request.postDataJSON(); writes.push({ id, body });
    if (fail) return json({ message: 'Bước đã được người khác chỉnh sửa.' }, 409);
    if (slow) await new Promise(resolve => setTimeout(resolve, 300));
    const saved = structuredClone(documents.get(id));
    for (const change of body.steps) {
      const item = saved.steps.find(value => value.stepCode === change.stepCode);
      (Object.hasOwn(item.inputMappingJson, 'data') ? item.inputMappingJson : item.paramsJson).data = change.data;
    }
    saved.workflow.rowVersion += 1;
    if (saved.workflow.status === 'PUBLISHED') {
      saved.workflow.versionNo += 1;
      saved.workflow.workflowId = 'delivery-v' + saved.workflow.versionNo;
    } else saved.workflow.status = body.publish ? 'PUBLISHED' : 'DRAFT';
    documents.set(saved.workflow.workflowId, saved);
    return json(saved);
  }
  return json({ content: [], last: true });
});
const workspace = page.getByRole('region', { name: 'Lời nói workflow', exact: true });
const card = name => workspace.locator('.ws-step').filter({ has: page.getByRole('heading', { name, exact: true }) });
try {
  await page.goto(base + '/admin/voice-scripts?tab=workflow-speech');
  await expect(workspace).toContainText('Chọn workflow để xem');
  await expect(page.getByLabel('Workflow', { exact: true })).toBeEnabled();
  assert.deepEqual(await page.getByLabel('Workflow', { exact: true }).locator('option').evaluateAll(items => items.map(item => item.value)),
    ['', 'delivery-v1', 'draft', 'empty', 'confirm', 'overridden']);
  assert.deepEqual(reads, [], 'opening the picker does not download any workflow graphs');
  await mkdir('.workstation-build/workflow-speech', { recursive: true });
  await page.screenshot({ path: '.workstation-build/workflow-speech/empty.png', fullPage: true });
  await page.getByLabel('Tìm workflow').fill('Quy trình chờ');
  await expect(page.getByLabel('Workflow', { exact: true }).locator('option')).toHaveCount(2);
  await page.getByLabel('Tìm workflow').fill('');
  await page.getByLabel('Workflow', { exact: true }).selectOption('delivery-v1');
  await expect(workspace.locator('.ws-step h4').first()).toHaveText('Nhận thuốc');
  assert.deepEqual(reads, ['delivery-v1'], 'selection downloads only that workflow graph');
  await card('Nhận thuốc').getByRole('button', { name: 'Nghe thử trên máy' }).click();
  assert.equal((await page.evaluate(() => window.__speech))[0].volume, 0);
  await card('Đến phòng bệnh').getByRole('button', { name: 'Sửa lời nói' }).click();
  await card('Đến phòng bệnh').getByLabel('Nội dung nói').fill('Xin mời nhận thuốc.');
  await card('Đến phòng bệnh').getByLabel('Âm lượng').fill('101');
  await expect(page.getByRole('button', { name: 'Lưu và áp dụng', exact: true })).toBeDisabled();
  await card('Đến phòng bệnh').getByLabel('Âm lượng').fill('80');
  await card('Đến phòng bệnh').getByLabel('Tốc độ đọc (từ/phút)').fill('170');
  await card('Nhận thuốc').getByRole('button', { name: 'Sửa lời nói' }).click();
  await card('Nhận thuốc').getByLabel('Nội dung nói').fill('Đặt thuốc vào ngăn rồi xác nhận.');
  await page.getByLabel('Tìm bước hoặc lời nói').fill('Đến phòng');
  await expect(workspace.locator('.ws-step')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Lưu và áp dụng', exact: true })).toBeEnabled();
  await page.getByLabel('Tìm bước hoặc lời nói').fill('');
  await page.screenshot({ path: '.workstation-build/workflow-speech/editing.png', fullPage: true });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'FAQ trả lời nhanh', exact: true }).click();
  await expect(workspace).toBeVisible();
  fail = true;
  await page.getByRole('button', { name: 'Lưu và áp dụng', exact: true }).click();
  await expect(workspace.getByRole('alert')).toContainText('vẫn được giữ');
  await expect(card('Nhận thuốc').getByLabel('Nội dung nói')).toHaveValue('Đặt thuốc vào ngăn rồi xác nhận.');
  fail = false; slow = true;
  await page.getByRole('button', { name: 'Lưu và áp dụng', exact: true }).dblclick({ force: true });
  await expect(workspace.getByRole('status')).toContainText('Đã phát hành phiên bản 2');
  await expect(page).toHaveURL(/workflowId=delivery-v2/);
  await expect(page.getByLabel('Workflow', { exact: true })).toHaveValue('delivery-v2');
  assert.equal(writes.length, 2, 'double click submits one successful request');
  assert.equal(writes[1].body.steps.length, 2);
  assert.equal(writes[1].body.expectedRowVersion, 4);
  assert.equal(writes[1].body.publish, true);
  assert.deepEqual(reads, ['delivery-v1'], 'saving reuses the returned graph without another GET');
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(card('Đến phòng bệnh')).toContainText('Xin mời nhận thuốc.');
  await expect(card('Đọc dữ liệu liên kết').getByRole('button', { name: 'Sửa lời nói' })).toBeDisabled();
  await card('Đọc thông báo động').getByRole('button', { name: 'Sửa lời nói' }).click();
  await expect(card('Đọc thông báo động')).toContainText('Đang lấy từ biến');
  await card('Đọc thông báo động').getByLabel('Âm lượng').fill('60');
  await card('Đọc thông báo động').getByRole('button', { name: 'Hoàn tác bước này' }).click();
  await expect(page.getByRole('button', { name: 'Lưu và áp dụng', exact: true })).toBeDisabled();
  await mkdir('.workstation-build/workflow-speech', { recursive: true });
  await page.screenshot({ path: '.workstation-build/workflow-speech/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '.workstation-build/workflow-speech/mobile.png', fullPage: true });
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `layout fits ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Workflow', { exact: true }).selectOption('draft');
  await page.evaluate(async () => {
    const { newDocument, fingerprint } = await import('/src/features/workflows/designer/designerModel.js');
    const { designerStorageKey, writeDraft } = await import('/src/features/workflows/designer/designerStorage.js');
    const { API_BASE_URL } = await import('/src/features/api/client.js');
    const document = newDocument(); document.workflow.workflowId = 'draft';
    const key = designerStorageKey(API_BASE_URL, { accountId: 'speech-test' });
    writeDraft(localStorage, key, { document, syncFingerprint: fingerprint(document) });
    window.__designerStorageKey = key;
  });
  await card('Nhận thuốc').getByRole('button', { name: 'Sửa lời nói' }).click();
  await card('Nhận thuốc').getByLabel('Nội dung nói').fill('Nội dung bản nháp.');
  await page.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click();
  await expect(workspace.getByRole('status')).toContainText('Đã lưu lời nói vào bản nháp');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(window.__designerStorageKey)).drafts.length), 0);
  assert.equal(writes.at(-1).body.publish, false);
  await page.goto(base + '/admin/voice-scripts?tab=workflow-speech&workflowId=empty');
  await expect(workspace).toContainText('chưa có bước phát lời nói');
  await expect(workspace.locator('.ws-step')).toHaveCount(0);
  await expect(page.getByLabel('Workflow', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Workflow', { exact: true }).locator('option[value="empty"]')).toHaveCount(1);
  documents.clear();
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(workspace).toContainText('Chưa có workflow trên máy chủ.');
  // Keep the selected workflow as a fallback option even if it leaves the list.
  await expect(page.getByLabel('Workflow', { exact: true }).locator('option')).toHaveCount(2);
  assert.deepEqual(errors, []);
  console.log('PASS workflow speech editing, preview, multi-step save, conflicts, version selection, draft saving, bound fields and mobile layout. All APIs mocked.');
} catch (error) {
  await mkdir('.workstation-build/workflow-speech', { recursive: true });
  await page.screenshot({ path: '.workstation-build/workflow-speech/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
