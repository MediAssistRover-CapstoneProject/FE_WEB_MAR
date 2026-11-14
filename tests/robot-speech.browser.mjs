import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.ROBOT_SPEECH_TEST_URL || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let profile = { voice: 'coral', speedMultiplier: 1.25, instructions: 'Nói tiếng Việt tự nhiên.', revision: 'v1' };
let loadFail = false, saveFail = false, ttsDisabled = false, pending = 1, ttsFail = false;
const requests = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', accountId: 'speech-test' }, tokens: { accessToken: 'mock' } }));
  window.__plays = 0;
  HTMLMediaElement.prototype.play = function () { window.__plays++; return Promise.resolve(); };
});
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/v1/')) return url.origin === new URL(base).origin ? route.continue() : route.abort();
  requests.push({ path, method: request.method(), body: request.postDataJSON(), authorization: request.headers().authorization });
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (path === '/api/v1/admin/speech-settings') {
    if (request.method() === 'GET') return loadFail ? json({ message: 'Không tải được cấu hình.' }, 503) : json(profile);
    if (saveFail) return json({ message: 'Không lưu được cấu hình.' }, 503);
    profile = { ...request.postDataJSON(), revision: 'v2' };
    return json(profile);
  }
  if (path === '/api/v1/pi/speech/status') return json({ tts: { enabled: !ttsDisabled, configured: true }, stt: { enabled: false } });
  if (path === '/api/v1/pi/speech/synthesize') {
    if (ttsFail) return json({ state: 'FAILED', code: 'TTS_PROVIDER_QUOTA' }, 503);
    if (pending-- > 0) return json({ state: 'PENDING', code: 'TTS_GENERATING' }, 202);
    // A short valid PCM WAV; playback is stubbed so this test makes no sound.
    const wav = Buffer.alloc(364); wav.write('RIFF'); wav.writeUInt32LE(356, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(320, 40);
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
  }
  if (path === '/api/v1/admin/workflows') return json({ content: [], last: true });
  if (path === '/api/v1/admin/knowledge/documents') return json([]);
  return json({ content: [], last: true });
});

const panel = page.getByRole('region', { name: 'Giọng robot', exact: true });
const save = panel.getByRole('button', { name: 'Lưu giọng robot', exact: true });
const preview = panel.getByRole('button', { name: 'Nghe thử giọng robot', exact: true });
const reload = panel.getByRole('button', { name: 'Tải lại cấu hình', exact: true });
const syntheses = () => requests.filter(item => item.path.endsWith('/synthesize'));
try {
  await page.goto(base + '/admin/voice-scripts?tab=robot-voice&workflowId=4ed399d1-9ace-46f3-b9d0-cbd96b330a8e');
  await expect(panel.getByRole('combobox', { name: 'Giọng robot', exact: true })).toHaveValue('coral');
  await expect(panel.getByLabel('Tốc độ nói (lần)')).toHaveValue('1.25');
  await expect(save).toBeDisabled();
  assert.ok(!requests.some(item => item.path.includes('/assistant/voice')), 'default page loads robot configuration');
  assert.ok(!requests.some(item => item.path.includes('/workflows')), 'robot profile does not load the workflow carried in the URL');
  await mkdir('.workstation-build/robot-speech', { recursive: true });
  await page.screenshot({ path: '.workstation-build/robot-speech/initial.png', fullPage: true });
  await panel.getByRole('slider', { name: 'Điều chỉnh tốc độ nói' }).focus();
  await page.keyboard.press('Home');
  await expect(panel.getByLabel('Tốc độ nói (lần)')).toHaveValue('0.25');
  await page.keyboard.press('End');
  await expect(panel.getByLabel('Tốc độ nói (lần)')).toHaveValue('4');
  await panel.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(panel.getByLabel('Tốc độ nói (lần)')).toHaveValue('1.25');
  await expect(save).toBeDisabled();
  assert.equal(requests.filter(item => item.method === 'PUT').length, 0, 'slider and undo remain local until save');

  await panel.getByRole('combobox', { name: 'Giọng robot', exact: true }).selectOption('cedar');
  await panel.getByLabel('Tốc độ nói (lần)').fill('1.4');
  await panel.getByLabel('Hướng dẫn cách đọc').fill('Đọc rõ ràng, thân thiện.');
  await expect(panel.locator('.rv-stage-profile strong')).toHaveText('coral');
  await expect(preview).toBeDisabled();
  await expect(panel).toContainText('Lưu thay đổi giọng robot trước khi nghe thử.');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Lời nói workflow', exact: true }).click();
  await expect(panel).toBeVisible();
  await save.click();
  await expect(panel).toContainText('Đã lưu giọng robot.');
  await expect(panel.locator('.rv-stage-profile strong')).toHaveText('cedar');
  const write = requests.find(item => item.method === 'PUT');
  assert.deepEqual(write.body, { voice: 'cedar', speedMultiplier: 1.4, instructions: 'Đọc rõ ràng, thân thiện.' });
  assert.equal(write.authorization, 'Bearer mock');

  await panel.getByLabel('Nội dung nghe thử').fill('Xin chào bệnh viện.');
  await preview.click();
  await expect(panel.getByLabel('Âm thanh giọng robot')).toHaveAttribute('src', /^blob:/);
  assert.equal(syntheses().length, 2, '202 response is polled until audio is ready');
  assert.deepEqual(syntheses()[0].body, { text: 'Xin chào bệnh viện.', languageCode: 'vi', speedWpm: 150 });
  assert.equal(await page.evaluate(() => window.__plays), 1);
  await page.screenshot({ path: '.workstation-build/robot-speech/audio-ready.png', fullPage: true });
  await panel.getByRole('button', { name: 'Dừng nghe', exact: true }).click();
  await expect(panel.getByLabel('Âm thanh giọng robot')).not.toHaveAttribute('src', /.+/);

  pending = 100;
  await preview.click();
  await expect(panel).toContainText('Đang tạo âm thanh nghe thử');
  await panel.getByRole('button', { name: 'Dừng nghe', exact: true }).click();
  await expect(preview).toBeEnabled();
  const stopped = syntheses().length;
  await page.waitForTimeout(1200);
  assert.equal(syntheses().length, stopped, 'stop cancels polling');
  assert.equal(await page.evaluate(() => window.__plays), 1);

  ttsFail = true;
  await preview.click();
  await expect(panel.getByRole('alert')).toContainText('hết hạn mức');
  ttsFail = false;
  await panel.getByLabel('Tốc độ nói (lần)').fill('0.1');
  await expect(save).toBeDisabled();
  await panel.getByLabel('Tốc độ nói (lần)').fill('1.5');
  saveFail = true;
  await save.click();
  await expect(panel.getByRole('alert')).toContainText('Không lưu được cấu hình.');
  await expect(panel.getByLabel('Tốc độ nói (lần)')).toHaveValue('1.5');
  await expect(preview).toBeDisabled();
  saveFail = false;
  await save.click();
  await expect(save).toBeDisabled();

  ttsDisabled = true;
  await reload.click();
  await expect(panel).toContainText('Máy chủ chưa bật giọng nói robot.');
  await expect(preview).toBeDisabled();
  await panel.getByRole('combobox', { name: 'Giọng robot', exact: true }).selectOption('nova');
  await save.click();
  await expect(save).toBeDisabled();

  await mkdir('.workstation-build/robot-speech', { recursive: true });
  await page.screenshot({ path: '.workstation-build/robot-speech/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '.workstation-build/robot-speech/mobile.png', fullPage: true });
  for (const width of [320, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `layout fits ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  loadFail = true;
  await page.reload();
  await expect(panel.getByRole('alert')).toContainText('Không tải được cấu hình.');
  await expect(panel).not.toContainText('Đang tải cấu hình giọng robot');
  loadFail = false; ttsDisabled = false;
  await reload.click();
  await expect(panel.getByRole('combobox', { name: 'Giọng robot', exact: true })).toHaveValue('nova');
  await expect(preview).toBeEnabled();
  await page.getByRole('button', { name: 'Lời nói workflow', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lời nói workflow', exact: true })).toBeVisible();
  await page.goto(base + '/admin/voice-scripts?tab=ai-voice');
  await expect(panel.getByRole('combobox', { name: 'Giọng robot', exact: true })).toHaveValue('nova');
  assert.ok(!requests.some(item => item.path.includes('/assistant/voice')), 'old voice links also use the robot API');
  await page.goto(base + '/admin/voice-scripts?tab=ai-faq');
  await expect(page).toHaveURL(/tab=robot-voice/);
  await expect(panel).toBeVisible();
  await expect(page.getByRole('button', { name: 'FAQ trả lời nhanh', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dữ liệu AI', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kho dữ liệu AI', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Quản lý FAQ bệnh viện' })).toHaveCount(0);
  assert.ok(!requests.some(item => item.path.includes('/assistant/faqs')), 'removed feature never loads its API');
  assert.deepEqual(errors, []);
  console.log('PASS robot speech settings API, exact save payload, WAV polling, cancellation, errors, retries, tab navigation, removed feature URLs and mobile layout. All APIs mocked.');
} finally { await browser.close(); }
