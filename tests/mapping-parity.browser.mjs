import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { role: 'ADMIN', username: 'mapping-test' }, tokens: { accessToken: 'fixture-only' } }));
  const key = 'mediassist.live.MAPPING';
  // The actual account/API-scoped key is populated once the FE helper loads.
  window.mappingFixture = { jobId: 'job', robotId: 'robot', floorId: 'floor', workflowId: 'workflow', mapName: 'Map fixture' };
});
let jobStatus = 'RUNNING', report = { available: true, state: 'IDLE', control_selected: false, exploration_mode: 'reactive', profile_max_duration_sec: 600 };
let rejectStart = false, canRecover = false, recovered = false, command = 0, stopDelay = false, recoveryFailure = true;
const writes = [], errors = [], receipts = new Map();
await context.route('**/api/v1/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname, method = req.method();
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  const body = method === 'POST' ? req.postDataJSON() : null;
  if (body) writes.push({ path, body, headers: req.headers() });
  if (path === '/api/v1/auth/me') return json({ username: 'mapping-test', role: 'ADMIN' });
  if (path === '/api/v1/robots') return json({ content: [{ robotId: 'robot', robotName: 'Robot fixture', status: 'BUSY' }], last: true });
  if (path === '/api/v1/floors') return json({ content: [{ floorId: 'floor', floorName: 'Tầng fixture', active: true }], last: true });
  if (path.endsWith('/published/all')) return json([{ workflow: { workflowId: 'workflow', workflowCode: 'WF_MAPPING', workflowName: 'Quét fixture', serviceType: 'MAPPING', schemaVersion: 3, status: 'PUBLISHED', acceptsNewJobs: true, definitionHash: 'hash' }, steps: [] }]);
  if (path.endsWith('/snapshot')) return json({ mqttConnected: !recovered, heartbeatFresh: !recovered, dispatchReady: !recovered, robot: { robotId: 'robot', status: 'BUSY' } });
  const job = { jobId: 'job', robotId: 'robot', workflowId: 'workflow', status: jobStatus, selectedJobStepId: 'wait', inputJson: { floor_id: 'floor', map_name: 'Map fixture' } };
  if (path === '/api/v1/jobs') return json({ content: [job], last: true });
  if (path === '/api/v1/jobs/job') return json({ job, steps: [{ jobStepId: 'wait', status: 'RUNNING', stepTypeSnapshot: 'WAIT', resolvedInputsJson: { event_type: 'MAPPING_SAVE_REQUESTED' } }] });
  if (path.endsWith('/mapping-session')) return json({ mapping_session_id: 'session', state: 'MAPPING', potentially_open: !recovered, job_status: jobStatus, motionObservedAt: new Date().toISOString(), autonomy: report });
  if (path.endsWith('/mapping-preview.png') || path.endsWith('/camera-preview.jpg')) return route.fulfill({ status: 204 });
  if (path.endsWith('/mapping-control')) {
    if (method === 'POST') return json({ commandId: 'manual', status: 'PI_ACCEPTED' }, 202);
    const id = new URL(req.url()).searchParams.get('commandId');
    return id && receipts.has(id) ? json(receipts.get(id)) : route.fulfill({ status: 204 });
  }
  if (path.endsWith('/mapping-autonomy')) {
    const a = body.autonomy, receipt = { commandId: 'auto-' + ++command, status: rejectStart && a.action === 'START' ? 'PI_REJECTED' : 'PI_ACCEPTED' };
    receipts.set(receipt.commandId, receipt);
    if (a.action === 'START' && !rejectStart) report = { ...report, run_id: a.runId, state: 'RUNNING', control_selected: true, finished: false, reason: 'RUNNING' };
    if (a.action === 'STOP') {
      if (stopDelay) await new Promise(resolve => setTimeout(resolve, 250));
      report = { ...report, state: 'STOPPED', control_selected: false };
    }
    return json(receipt, 202);
  }
  if (path.endsWith('/events')) return json({ accepted: true });
  if (path.endsWith('/mapping-recovery')) {
    if (method === 'POST') { if (recoveryFailure) { recoveryFailure = false; return json({ message: 'Uncertain response' }, 503); } recovered = true; jobStatus = 'CANCELLED'; return json({ status: 'CANCELLED' }); }
    return json({ jobId: 'job', selectedUnsentStop: true, canReconcile: canRecover, jobStepId: 'wait', transportSessionId: 'transport', blockers: canRecover ? [] : ['PI_STOP_NOT_CONFIRMED'] });
  }
  return json({ message: `Unexpected API ${method} ${path}` }, 404);
});
const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
const button = name => page.getByRole('button', { name, exact: true });
const wait = async condition => { const until = Date.now() + 12000; while (!await condition()) { if (Date.now() > until) throw Error('Timed out waiting for fixture state'); await page.waitForTimeout(80); } };
const autoWrites = action => writes.filter(w => w.path.endsWith('/mapping-autonomy') && w.body.autonomy.action === action);
try {
  await mkdir('.workstation-build/mapping-parity', { recursive: true });
  await page.goto(`${base}/admin/map?stage=scan`);
  await page.evaluate(async () => {
    const { writeTracking } = await import('/src/features/robotOperations/api.js'); writeTracking('mapping', window.mappingFixture);
  });
  await page.reload();
  await wait(async () => !await button('Bắt đầu tự quét').isDisabled()); assert.equal(writes.length, 0, 'Page load must not issue robot commands');
  await button('Bắt đầu tự quét').click(); await wait(() => autoWrites('RENEW').length >= 1);
  assert.equal(await button('↑ Tiến').isDisabled(), true); assert.equal(await button('Lưu bản đồ và kết thúc').isDisabled(), true);
  await button('Dừng tự quét').click(); await wait(async () => !await button('↑ Tiến').isDisabled());
  assert.equal(autoWrites('START')[0].body.mappingSessionId, 'session');
  assert.equal(autoWrites('RENEW')[0].body.autonomy.runId, autoWrites('START')[0].body.autonomy.runId);
  await page.screenshot({ path: '.workstation-build/mapping-parity/desktop.png', fullPage: true });
  rejectStart = true; const renewBefore = autoWrites('RENEW').length, stopBefore = autoWrites('STOP').length;
  await button('Bắt đầu tự quét').click(); await wait(() => autoWrites('STOP').length > stopBefore); await page.waitForTimeout(450);
  assert.equal(autoWrites('RENEW').length, renewBefore); await wait(async () => !await button('↑ Tiến').isDisabled()); rejectStart = false;
  await button('Bắt đầu tự quét').click(); await wait(() => report.control_selected);
  const beforeLeave = autoWrites('STOP').length; await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await wait(() => autoWrites('STOP').length > beforeLeave);
  await wait(async () => !await button('Bắt đầu tự quét').isDisabled());
  await page.getByLabel('Lưu và kết thúc khi hoàn tất, hết thời gian hoặc quay về điểm đầu').check();
  await button('Bắt đầu tự quét').click(); await wait(() => report.control_selected);
  stopDelay = true; report = { ...report, finished: true, reason: 'TIME_LIMIT', elapsed_sec: 10 };
  await wait(() => writes.some(w => w.path.endsWith('/events')));
  const saveIndex = writes.findIndex(w => w.path.endsWith('/events')), lastStop = writes.findLastIndex(w => w.path.endsWith('/mapping-autonomy') && w.body.autonomy.action === 'STOP');
  assert.ok(lastStop < saveIndex); assert.equal(report.control_selected, false, 'Save waits for Pi to release autonomous control');
  jobStatus = 'RECOVERY_REQUIRED'; report = { ...report, control_selected: false };
  await page.reload(); await page.getByText('Phục hồi phiên quét', { exact: false }).last().waitFor();
  await button('Kiểm tra bằng chứng phục hồi').click(); await page.getByText(/PI_STOP_NOT_CONFIRMED/).first().waitFor();
  assert.equal(await button('Đối soát và đóng nhiệm vụ').count(), 0); assert.equal(writes.filter(w => w.path.endsWith('/mapping-recovery')).length, 0);
  canRecover = true; await button('Kiểm tra bằng chứng phục hồi').click(); await button('Đối soát và đóng nhiệm vụ').waitFor(); assert.equal(await button('Đối soát và đóng nhiệm vụ').isDisabled(), true);
  await page.getByLabel('Tôi đã kiểm tra robot đứng yên và xem bằng chứng dừng bên dưới.').check(); await button('Đối soát và đóng nhiệm vụ').click();
  await button('Gửi lại cùng yêu cầu đối soát').waitFor();
  assert.equal(await button('Kiểm tra bằng chứng phục hồi').isDisabled(), true, 'An uncertain outcome cannot replace the idempotency key');
  assert.equal(await page.getByLabel('Ghi chú phục hồi').isDisabled(), true);
  await button('Gửi lại cùng yêu cầu đối soát').click();
  await wait(() => recovered); const recovery = writes.find(w => w.path.endsWith('/mapping-recovery'));
  assert.equal(recovery.body.outcome, 'CONFIRM_CANCELLED'); assert.equal(recovery.body.confirmedStopped, true); assert.ok(recovery.headers['idempotency-key']);
  const retry = writes.filter(w => w.path.endsWith('/mapping-recovery'))[1]; assert.deepEqual(retry.body, recovery.body); assert.equal(retry.headers['idempotency-key'], recovery.headers['idempotency-key']);
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.workstation-build/mapping-parity/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assert.deepEqual(errors, []);
  console.log('PASS mapping parity browser: no auto writes, START/RENEW/STOP, Pi rejection, pagehide STOP, stopped-before-save, evidence gating, recovery uncertain retry identity and mobile. All APIs intercepted.');
} catch (error) { console.error(errors, (await page.locator('body').innerText()).slice(-6000)); await page.screenshot({ path: '.workstation-build/mapping-parity/failure.png', fullPage: true }); throw error; }
finally { await browser.close(); }
