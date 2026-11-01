import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const calls = [], errors = [];
let job = null, receipt = null, online = true, gate = 'CLEAR';
const workflow = (id, type) => ({ workflow: { workflowId: id, workflowName: type === 'MAPPING' ? 'Quét và lưu' : 'Thông báo chung', serviceType: type, schemaVersion: 3, status: 'PUBLISHED', acceptsNewJobs: true, definitionHash: 'fixture', versionNo: 1 }, steps: [{ enabled: true, stepTypeCode: 'INTERACT', paramsJson: { action: 'SPEAK' } }] });
const robot = { robotId: 'robot-1', robotName: 'Robot kiểm thử', status: 'IDLE' };
const detail = () => ({ job, steps: [{ jobStepId: 'wait', status: 'RUNNING', stepTypeSnapshot: 'WAIT', resolvedInputsJson: { event_type: 'MAPPING_SAVE_REQUESTED' } }] });
const motion = () => calls.filter(call => call.path.endsWith('/mapping-control') && call.method === 'POST');
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', username: 'fixture' }, tokens: { accessToken: 'fixture-only' } })));
await page.route('**/api/v1/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
  assert.equal(request.headers().authorization, 'Bearer fixture-only');
  const body = request.postDataJSON();
  calls.push({ path, method, body });
  const json = value => route.fulfill({ json: value });
  const paged = rows => json({ content: rows, last: true, totalPages: 1 });
  if (path.endsWith('/auth/me')) return json({ role: 'ADMIN', username: 'fixture' });
  if (path === '/api/v1/robots') return paged([robot]);
  if (path === '/api/v1/floors') return paged([{ floorId: 'floor-1', floorName: 'Tầng 1', active: true }]);
  if (path.endsWith('/published/all')) return json([workflow('map-workflow', 'MAPPING'), workflow('speech-workflow', 'SPEECH')]);
  if (path.endsWith('/snapshot')) return json({ robot, mqttConnected: online, heartbeatFresh: online, dispatchReady: online, activeJobId: job && job.status === 'RUNNING' ? job.jobId : null });
  if (path === '/api/v1/jobs') return paged(job ? [job] : []);
  if (path === '/api/v1/mapping-jobs') {
    job = { jobId: 'map-job', jobCode: 'JOB-TEST', status: 'RUNNING', selectedJobStepId: 'wait', workflowId: body.workflowId, inputJson: { floor_id: body.floorId, map_name: body.mapName }, queuedAt: new Date().toISOString() };
    return json({ jobId: job.jobId, jobCode: job.jobCode });
  }
  if (path === '/api/v1/jobs/map-job') return json(detail());
  if (path.endsWith('/mapping-session')) return json({ mapping_session_id: 'mapping-session-1', state: 'MAPPING', job_status: job.status, potentially_open: true, motionObservedAt: new Date().toISOString(), motionTelemetry: { gate: { value: JSON.stringify({ reason: gate }) } } });
  if (path.endsWith('/mapping-control')) {
    if (method === 'POST') receipt = { commandId: 'command-' + calls.length, status: 'PI_ACCEPTED' };
    return json(receipt);
  }
  if (path.endsWith('/mapping-preview.png') || path.endsWith('/camera-preview.jpg')) return route.fulfill({ status: 204 });
  if (path.endsWith('/events')) return json({ accepted: true });
  if (method === 'GET') return paged([]);
  throw Error('Unexpected mutation ' + method + ' ' + path);
});

const button = name => page.getByRole('button', { name, exact: true });
const waitForMotion = async count => {
  const deadline = Date.now() + 5000;
  while (motion().length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(motion().length >= count);
};
try {
  await mkdir('.workstation-build/workstation-control', { recursive: true });
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5175') + '/workstations?mode=mapping');
  await page.getByText('Chi tiết quét map mới', { exact: true }).click();
  await page.getByLabel('Robot', { exact: true }).selectOption('robot-1');
  await page.getByLabel('Tầng', { exact: true }).selectOption('floor-1');
  await page.getByLabel('Quy trình quét đã phát hành').selectOption('map-workflow');
  await page.getByLabel('Tên bản đồ', { exact: true }).fill('Map điều phối');
  assert.equal(calls.filter(call => call.method !== 'GET').length, 0, 'Loading and choosing do not send robot commands');
  await button('Tạo nhiệm vụ quét').click();
  await button('↑ Tiến').waitFor();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(node => node.textContent === '↑ Tiến').disabled);
  assert.deepEqual(calls.find(call => call.path.endsWith('/mapping-jobs')).body, { workflowId: 'map-workflow', robotId: 'robot-1', floorId: 'floor-1', mapName: 'Map điều phối' });

  await button('↑ Tiến').focus();
  await page.keyboard.down('Enter');
  await waitForMotion(1);
  assert.equal(motion()[0].body.linearX, .05);
  assert.equal(motion()[0].body.durationMs, 900);
  assert.equal(motion()[0].body.mappingSessionId, 'mapping-session-1');
  await page.keyboard.up('Enter');
  await waitForMotion(2);
  assert.equal(motion().at(-1).body.linearX, 0);
  assert.equal(motion().at(-1).body.angularZ, 0);
  assert.ok(motion().at(-1).body.controlSequence > motion()[0].body.controlSequence);

  gate = 'REAR_OBSTACLE';
  await page.getByText('Robot dừng: có vật cản phía sau', { exact: true }).waitFor();
  await page.getByText('Kết nối video trực tiếp', { exact: true }).click();
  await page.getByLabel('URL video từ robot').fill('ftp://robot/video');
  await button('Xem video trực tiếp').click();
  await page.getByText('Nhập URL video HTTP hoặc HTTPS, không kèm tài khoản.', { exact: true }).waitFor();

  const beforeSwitch = motion().length;
  await button('↓ Lùi').focus();
  await page.keyboard.down('Enter');
  await waitForMotion(beforeSwitch + 1);
  assert.equal(motion().at(-1).body.linearX, -.05);
  await button('Phát thông báo').evaluate(node => node.click());
  await page.keyboard.up('Enter');
  await waitForMotion(beforeSwitch + 2);
  assert.equal(motion().at(-1).body.linearX, 0, 'Switching modes sends stop');
  await page.getByLabel('Nội dung thông báo').waitFor();
  assert.match(page.url(), /mode=speech/);
  await page.reload();
  await page.getByLabel('Nội dung thông báo').waitFor();
  await button('Quét & điều khiển').click();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(node => node.textContent === '↑ Tiến').disabled);
  assert.equal(calls.filter(call => call.path.endsWith('/mapping-jobs')).length, 1, 'Returning resumes tracking without creating another job');
  online = false;
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).find(node => node.textContent === '↑ Tiến').disabled);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '.workstation-build/workstation-control/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '.workstation-build/workstation-control/desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Workstations: authenticated mapping, motion/stop, camera validation, Pi feedback, mode-switch stop, speech, resume, offline lock and mobile layout passed. All robot APIs mocked.');
} finally {
  await browser.close();
}
