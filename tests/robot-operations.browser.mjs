import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { if (!sessionStorage.getItem('mediassist-rover.session')) sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', username: 'test' }, tokens: { accessToken: 'test-only' } })); });
let job = null, speechJob = null, receipt = null, mappingOpen = false, ready = true, failPoll = false, camera = false, pendingTts = 0, ttsFailure = false, emptyCatalog = false, rejectMotion = false, forbidCatalog = false, saveFailure = true;
const writes = [], errors = [];
const workflow = (id, type) => ({ workflow: { workflowId: id, workflowName: type === 'MAPPING' ? 'Quét và lưu' : 'Thông báo chung', serviceType: type, schemaVersion: 3, status: 'PUBLISHED', acceptsNewJobs: true, definitionHash: 'fixture', versionNo: 1 }, steps: [{ enabled: true, stepTypeCode: 'INTERACT', paramsJson: { action: 'SPEAK' } }] });
const robot = () => ({ robotId: 'robot-1', robotName: 'Robot thử nghiệm', status: job && ['RUNNING', 'QUEUED', 'RECOVERY_REQUIRED'].includes(job.status) ? 'BUSY' : 'IDLE' });
const detail = () => ({ job, tasks: [{ jobTaskId: 'task', taskNameSnapshot: 'Quét và lưu bản đồ' }], steps: [{ jobStepId: 'wait', jobTaskId: 'task', status: 'RUNNING', stepTypeSnapshot: 'WAIT', resolvedInputsJson: { event_type: 'MAPPING_SAVE_REQUESTED' } }, ...(job?.status === 'SUCCEEDED' ? [{ jobStepId: 'commit', jobTaskId: 'task', status: 'SUCCEEDED', resolvedInputsJson: { service_key: 'COMMIT_MAP_ARTIFACT' }, resultJson: { data: { map_id: 'server-map' } } }] : [])] });
await context.route('**/api/v1/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname, method = req.method();
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  if (method === 'POST') writes.push({ path, body: req.postDataJSON(), at: Date.now(), headers: req.headers() });
  if (path === '/api/v1/auth/me') return json({ role: 'ADMIN', username: 'test' });
  if (path === '/api/v1/robots') return forbidCatalog ? json({ message: 'Forbidden' }, 403) : json({ content: emptyCatalog ? [] : [robot()], last: true });
  if (path === '/api/v1/floors') return json({ content: emptyCatalog ? [] : [{ floorId: 'floor-1', floorName: 'Tầng 1', active: true }], last: true });
  if (path.endsWith('/published/all')) return json(emptyCatalog ? [] : [workflow('map-workflow', 'MAPPING'), workflow('speech-workflow', 'SPEECH'), { workflow: { ...workflow('wrong', 'MAPPING').workflow, schemaVersion: 2 } }]);
  if (path.endsWith('/snapshot')) {
    if (failPoll) return route.abort();
    return json({ robot: robot(), mqttConnected: ready, heartbeatFresh: ready, dispatchReady: ready, activeJobId: job && ['RUNNING', 'QUEUED', 'RECOVERY_REQUIRED'].includes(job.status) ? 'map-job' : null });
  }
  if (path === '/api/v1/jobs') return json({ content: [job, speechJob].filter(Boolean), last: true });
  if (path === '/api/v1/mapping-jobs') { job = { ...req.postDataJSON(), jobId: 'map-job', jobCode: 'JOB-TEST', status: 'QUEUED', queuedAt: new Date().toISOString(), inputJson: { floor_id: 'floor-1', map_name: req.postDataJSON().mapName }, selectedJobStepId: 'wait' }; return json({ jobId: 'map-job', jobCode: 'JOB-TEST' }); }
  if (path === '/api/v1/jobs/map-job') return json(detail());
  if (path.endsWith('/mapping-session')) return mappingOpen ? json({ mapping_session_id: 'session-1', state: job.status === 'SUCCEEDED' ? 'CLOSED' : 'MAPPING', job_status: job.status, potentially_open: job.status !== 'SUCCEEDED' }) : json({ message: 'Job has no mapping session' }, 404);
  if (path.endsWith('/mapping-control')) {
    if (method === 'POST') { receipt = { commandId: `command-${writes.length}`, status: rejectMotion && req.postDataJSON().linearX ? 'PI_REJECTED' : 'PI_ACCEPTED' }; return json(receipt, 202); }
    return receipt ? json(receipt) : route.fulfill({ status: 204 });
  }
  if (path.endsWith('/events') && method === 'POST') { if (saveFailure) { saveFailure = false; return json({ message: 'Temporary failure' }, 503); } return json({ accepted: true }); }
  if (path.endsWith('.jpg') || path.endsWith('.png')) return camera ? route.fulfill({ status: 200, contentType: 'image/png', headers: { 'X-Captured-At': new Date().toISOString(), 'X-Frame-Revision': '3', 'Access-Control-Expose-Headers': 'X-Captured-At, X-Frame-Revision' }, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64') }) : route.fulfill({ status: 204 });
  if (path === '/api/v1/pi/speech/prepare') return ttsFailure ? json({ message: 'TTS_DISABLED' }, 503) : json({ state: pendingTts++ === 0 ? 'PENDING' : 'READY' });
  if (path === '/api/v1/speech-jobs') { speechJob = { jobId: 'speech-job', status: 'QUEUED', robotId: 'robot-1', queuedAt: new Date().toISOString(), inputJson: { speech_text: req.postDataJSON().text } }; return json({ jobId: 'speech-job' }, 201); }
  if (path === '/api/v1/jobs/speech-job') return json({ job: speechJob, steps: [] });
  if (path === '/api/v1/maps') return json({ content: [{ mapId: 'server-map', mapName: 'Bản đồ kiểm thử', status: 'DRAFT', widthM: 10, heightM: 10, originXM: 0, originYM: 0, resolutionMPerPixel: .05 }], last: true });
  if (method !== 'GET') throw Error(`Unexpected write ${method} ${path}`);
  return json({ content: [], last: true });
});
const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
const btn = name => page.getByRole('button', { name, exact: true });
const waitUntil = async check => { for (let i = 0; i < 60; i++) { if (await check()) return; await page.waitForTimeout(100); } throw Error('Condition timed out'); };
const hold = async (name, ms = 720) => { await btn(name).hover(); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); await page.waitForTimeout(100); };
try {
  await mkdir('.workstation-build/robot-operations', { recursive: true });
  await page.goto(`${base}/admin?screen=Map+Studio`);
  await page.getByLabel('Robot', { exact: true }).selectOption('robot-1');
  await page.getByLabel('Tầng', { exact: true }).selectOption('floor-1');
  await page.getByLabel('Quy trình quét đã phát hành').selectOption('map-workflow');
  assert.equal(await page.getByLabel('Quy trình quét đã phát hành').locator('option').count(), 2);
  await page.getByLabel('Tên bản đồ', { exact: true }).fill('Bản đồ kiểm thử');
  await waitUntil(async () => !(await btn('Tạo nhiệm vụ quét').isDisabled()));
  await btn('Tạo nhiệm vụ quét').click();
  await page.getByText('Đang chờ robot', { exact: true }).waitFor();
  assert.equal(await btn('↑ Tiến').isDisabled(), true);
  assert.equal(writes.filter(w => w.path.endsWith('/mapping-jobs')).length, 1);
  assert.deepEqual(writes[0].body, { workflowId: 'map-workflow', robotId: 'robot-1', floorId: 'floor-1', mapName: 'Bản đồ kiểm thử' });
  job.status = 'RUNNING'; mappingOpen = true;
  await waitUntil(async () => !(await btn('↑ Tiến').isDisabled()));
  await page.getByText('Chưa có ảnh mới hoặc ảnh đã quá 10 giây.').first().waitFor();
  camera = true;
  await page.getByAltText('Ảnh camera robot qua MQTT').waitFor();
  await hold('↑ Tiến');
  const commands = writes.filter(w => w.path.endsWith('/mapping-control'));
  assert.ok(commands.length >= 3); assert.equal(commands.at(-1).body.linearX, 0);
  for (const c of commands) { assert.equal(c.body.durationMs, 600); assert.ok(c.body.controlSessionId); assert.ok(c.body.requestedAt); assert.ok(c.headers.authorization === 'Bearer test-only'); }
  for (let i = 1; i < commands.length; i++) { assert.ok(commands[i].body.controlSequence > commands[i-1].body.controlSequence); if (commands[i].body.linearX) assert.ok(commands[i].at - commands[i-1].at >= 250); }
  await page.screenshot({ path: '.workstation-build/robot-operations/mapping-desktop.png', fullPage: true });
  // Focus loss and disconnected polling both stop renewal.
  await btn('↑ Tiến').hover(); await page.mouse.down(); await page.waitForTimeout(350); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
  await waitUntil(() => writes.at(-1).body.linearX === 0);
  await btn('↑ Tiến').hover(); await page.mouse.down(); failPoll = true; await waitUntil(async () => await btn('↑ Tiến').isDisabled()); await page.mouse.up();
  await waitUntil(() => writes.at(-1).body.linearX === 0);
  failPoll = false; ready = false; await btn('Tải lại trạng thái').click(); await page.waitForTimeout(1200); assert.equal(await btn('↑ Tiến').isDisabled(), true);
  ready = true; await waitUntil(async () => !(await btn('↑ Tiến').isDisabled()));
  rejectMotion = true; await hold('↑ Tiến', 400); await page.waitForTimeout(350); assert.equal(writes.at(-1).body.linearX, 0); rejectMotion = false;
  job.status = 'RECOVERY_REQUIRED'; await waitUntil(async () => await btn('↑ Tiến').isDisabled()); await page.getByText('Cần khôi phục', { exact: true }).waitFor();
  job.status = 'RUNNING'; await waitUntil(async () => !(await btn('↑ Tiến').isDisabled()));
  await page.reload(); await waitUntil(async () => !(await btn('↑ Tiến').isDisabled()));
  await btn('Lưu bản đồ và kết thúc').click(); await page.getByText('Đang lưu và kết thúc', { exact: true }).waitFor();
  assert.equal(await btn('↑ Tiến').isDisabled(), true);
  const saved = writes.find(w => w.path.endsWith('/events')); assert.equal(saved.body.eventType, 'MAPPING_SAVE_REQUESTED'); assert.equal(saved.body.correlationKey, 'session-1');
  await waitUntil(async () => !(await btn('Gửi lại yêu cầu lưu đã tạo').isDisabled())); await btn('Gửi lại yêu cầu lưu đã tạo').click();
  await waitUntil(() => writes.filter(w => w.path.endsWith('/events')).length === 2);
  assert.deepEqual(writes.filter(w => w.path.endsWith('/events'))[1].body, saved.body, 'Save retry must preserve event ID AND timestamp');
  assert.equal(await btn('Cấu hình vùng trên bản đồ đã lưu').count(), 0);
  job.status = 'SUCCEEDED'; await btn('Cấu hình vùng trên bản đồ đã lưu').waitFor(); await btn('Cấu hình vùng trên bản đồ đã lưu').click();
  await waitUntil(async () => await page.getByLabel('Bản đồ BE', { exact: true }).inputValue() === 'server-map');
  // Speech is in Automation; no duplication in scan.
  await page.goto(`${base}/admin?screen=Voice+%26+Scripts`);
  await page.getByLabel('Robot phát thông báo').selectOption('robot-1');
  await page.getByLabel('Quy trình phát loa đã phát hành').selectOption('speech-workflow');
  await page.getByLabel('Nội dung thông báo').fill('Xin chào, đây là thông báo thử nghiệm.');
  await waitUntil(async () => !(await btn('Gửi thông báo tới robot').isDisabled()));
  await btn('Gửi thông báo tới robot').click(); await page.getByText('Đang chuẩn bị giọng đọc…', { exact: true }).waitFor();
  await btn('Dừng chuẩn bị').click(); await page.getByText('Đã dừng chuẩn bị. Chưa gửi nhiệm vụ phát loa.').waitFor();
  assert.equal(writes.filter(w => w.path.endsWith('/speech-jobs')).length, 0);
  pendingTts = 0;
  await btn('Gửi thông báo tới robot').click();
  await waitUntil(() => writes.some(w => w.path === '/api/v1/speech-jobs'));
  assert.ok(writes.filter(w => w.path.endsWith('/speech/prepare')).length >= 2);
  assert.equal(writes.filter(w => w.path.endsWith('/speech-jobs')).length, 1);
  speechJob.status = 'SUCCEEDED'; await page.getByText('Hoàn tất', { exact: true }).waitFor();
  await page.screenshot({ path: '.workstation-build/robot-operations/speech-desktop.png', fullPage: true });
  ttsFailure = true; await waitUntil(async () => !(await btn('Gửi thông báo tới robot').isDisabled())); await btn('Gửi thông báo tới robot').click(); await page.getByRole('alert').waitFor(); assert.equal(writes.filter(w => w.path.endsWith('/speech-jobs')).length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.workstation-build/robot-operations/speech-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.goto(`${base}/admin?screen=Map+Studio`); await page.getByRole('heading', { name: 'Quét bản đồ', exact: true }).waitFor();
  await page.screenshot({ path: '.workstation-build/robot-operations/mapping-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  // Explicit simulation mode makes zero robot writes.
  const beforeDemo = writes.length; await btn('Mô phỏng · Trình duyệt').click(); await hold('Giữ để robot tiến thẳng'); assert.equal(writes.length, beforeDemo);
  assert.equal(await page.getByRole('button', { name: 'Giữ để robot lùi', exact: true }).count(), 0);
  // UI permission guard, then empty catalog and server permission rejection.
  await page.evaluate(() => sessionStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'test', role: 'STAFF' }, tokens: { accessToken: 'test-only' } })));
  await page.reload(); await page.getByText('Chỉ quản trị viên đăng nhập thật được tạo phiên quét và điều khiển robot.', { exact: false }).waitFor();
  assert.equal(await btn('Tạo nhiệm vụ quét').count(), 0);
  await page.evaluate(() => { sessionStorage.clear(); }); emptyCatalog = true;
  await page.reload(); await page.getByText('Cần robot đã đăng ký, tầng đang hoạt động và quy trình quét đã phát hành.', { exact: false }).waitFor();
  assert.equal(await btn('Tạo nhiệm vụ quét').isDisabled(), true);
  forbidCatalog = true; await btn('Tải lại trạng thái').click(); await page.getByRole('alert').getByText('Tài khoản không có quyền thực hiện thao tác này.').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: mapping lifecycle, payloads, pulse pacing/release, blur, offline, Pi rejection, recovery, reload, save handoff, speech pending/ready/failure, mobile, demo isolation, permissions and empty catalog. All API writes intercepted.');
} catch (error) {
  console.error('PAGE ERRORS', errors, 'URL', page.url(), (await page.locator('body').innerText()).slice(0, 4000));
  await page.screenshot({ path: '.workstation-build/robot-operations/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
