import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const base = process.env.TEST_BASE_URL || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function session(page, role) {
  await page.addInitScript(role => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { accountId: 'fixture', role }, tokens: { accessToken: 'fixture' } })), role);
}
async function noSimulation(page) {
  await expect(page.getByText('Mô phỏng mức pin', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /mô phỏng|Chạy thử trên robot thật|Kết thúc test/i })).toHaveCount(0);
}
try {
  for (const role of ['ADMIN', 'STAFF']) {
    const page = await browser.newPage(); let streams = 0, alertReads = 0, policyReads = 0, batteryReads = 0;
    const errors = [], robots = [{ robotId: 'r1', robotCode: 'Online robot', status: 'IDLE', batteryPercent: 65 }, { robotId: 'r2', robotCode: 'Offline robot', status: 'OFFLINE', batteryPercent: 40 }];
    page.on('pageerror', error => errors.push(error.message));
    if (role === 'ADMIN') await page.clock.install();
    await session(page, role);
    await page.route('**/api/v1/**', async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname;
      assert.equal(req.method(), 'GET', 'Reading must not actuate a robot');
      assert.ok(!path.endsWith('/battery-policy/test'), 'Removed simulation must not call its API');
      if (path.endsWith('/notifications/events')) {
        streams++; assert.equal(role, 'STAFF');
        await new Promise(resolve => setTimeout(resolve, 400));
        return route.fulfill({ contentType: 'text/event-stream', body: 'event: alerts\ndata: [{"alertId":"low-1"}]\n\n' });
      }
      if (path === '/api/v1/robots') return route.fulfill({ json: { content: robots } });
      if (/^\/api\/v1\/robots\/r[12]$/.test(path)) return route.fulfill({ json: robots[path.endsWith('r2') ? 1 : 0] });
      if (path.endsWith('/battery')) {
        batteryReads++;
        return route.fulfill({ json: { robotId: path.includes('/r2/') ? 'r2' : 'r1', batteryPercent: path.includes('/r2/') ? null : 72, voltageV: 12.2, fresh: !path.includes('/r2/'), estimateStatus: path.includes('/r2/') ? 'STALE' : 'ESTIMATED', capturedAt: '2026-11-26T06:00:00Z' } });
      }
      if (path.endsWith('/battery-policy')) { policyReads++; return route.fulfill({ status: 404, json: { message: 'API endpoint not found' } }); }
      if (path.endsWith('/chargers')) return route.fulfill({ status: 404, json: { message: 'API endpoint not found' } });
      if (path === '/api/v1/alerts') { alertReads++; return route.fulfill({ json: { totalElements: 1, content: [{ alertId: 'low-1', message: 'Robot cần kiểm tra pin' }] } }); }
      return route.fulfill({ json: { content: [] } });
    });
    await page.goto(`${base}/admin/robots?tab=battery`);
    await expect(page.locator('.bp-percent')).toHaveText('72%');
    await expect(page.getByText('12.2 V', { exact: true })).toBeVisible();
    await expect(page.locator('.bp-state')).toHaveText('Chưa hỗ trợ trên máy chủ');
    await expect(page.getByText('Chưa cập nhật được chính sách về sạc', { exact: true })).toHaveCount(0);
    await expect(page.locator('.bp-error')).toHaveCount(0);
    await noSimulation(page);
    if (role === 'STAFF') { await expect.poll(() => alertReads).toBeGreaterThanOrEqual(2); assert.ok(streams > 0); await expect(page.getByRole('button', { name: 'Yêu cầu về sạc', exact: true })).toHaveCount(0); }
    else {
      assert.equal(streams, 0);
      const previousReads = policyReads, previousBatteryReads = batteryReads;
      await page.clock.fastForward(11000);
      await expect.poll(() => batteryReads).toBeGreaterThan(previousBatteryReads);
      assert.equal(policyReads, previousReads, 'Do not repeatedly poll an absent API');
      await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
      await expect.poll(() => policyReads).toBeGreaterThan(previousReads);
    }
    await page.getByLabel('Chọn robot', { exact: true }).selectOption('r2');
    await expect(page.locator('.bp-percent')).toHaveText('40%');
    await expect(page.getByText('Lần ghi nhận cuối · Robot ngoại tuyến')).toBeVisible();
    assert.deepEqual(errors, []); await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), writes = [], errors = [];
  let failPolicy = false;
  let policy = { robotId: 'r1', state: 'NORMAL', measuredPercent: 65, measuredFresh: true, lowThreshold: 10, criticalThreshold: 5, rearmThreshold: 15 };
  page.on('pageerror', error => errors.push(error.message));
  await session(page, 'ADMIN');
  await page.route('**/api/v1/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    assert.ok(!path.endsWith('/battery-policy/test'));
    if (req.method() !== 'GET') {
      writes.push({ path, body: req.postDataJSON() });
      assert.ok(path.endsWith('/return-to-charger'));
      policy = { ...policy, state: 'RETURN_REQUESTED' }; return route.fulfill({ json: policy });
    }
    const robot = { robotId: 'r1', robotCode: 'Robot kiểm thử', status: 'IDLE', batteryPercent: 65 };
    if (path === '/api/v1/robots') return route.fulfill({ json: { content: [robot] } });
    if (path === '/api/v1/robots/r1') return route.fulfill({ json: robot });
    if (path.endsWith('/chargers')) return route.fulfill({ json: [{ endpointId: 'c1', endpointCode: 'C1', endpointName: 'Điểm sạc 1' }] });
    if (path.endsWith('/battery-policy')) return route.fulfill(failPolicy ? { status: 500, json: { message: 'DB unavailable' } } : { json: policy });
    if (path.endsWith('/battery')) return route.fulfill({ json: { robotId: 'r1', batteryPercent: 65, fresh: true, voltageV: 12.2 } });
    return route.fulfill({ json: { content: [], totalElements: 0 } });
  });
  await page.goto(`${base}/admin/robots?tab=battery`);
  await expect(page.locator('.bp-percent')).toHaveText('65%');
  await noSimulation(page);
  await page.getByLabel('Chọn điểm sạc', { exact: true }).selectOption('c1');
  await page.getByRole('button', { name: 'Yêu cầu về sạc', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Hủy', exact: true }).click(); assert.equal(writes.length, 0);
  await page.getByRole('button', { name: 'Yêu cầu về sạc', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.locator('.bp-state')).toHaveText('Đã yêu cầu về sạc'); assert.deepEqual(writes[0].body, { endpointId: 'c1' });
  failPolicy = true;
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(page.getByText(/Máy chủ trả HTTP 500/)).toBeVisible();
  await expect(page.locator('.bp-percent')).toHaveText('65%');
  await expect(page.locator('.bp-state')).toHaveText('Đã yêu cầu về sạc');
  await expect(page.getByRole('button', { name: 'Yêu cầu về sạc', exact: true })).toBeDisabled();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'D:/test/battery-policy-no-simulation.png', fullPage: true }); await page.close();
  console.log('PASS: removed simulation UI/API, absent-route diagnosis, independent real/offline battery, no repeated 404 polling, explicit retry, staff SSE, return confirmation, retained data on HTTP 500, responsive layout. APIs mocked.');
} finally { await browser.close(); }
