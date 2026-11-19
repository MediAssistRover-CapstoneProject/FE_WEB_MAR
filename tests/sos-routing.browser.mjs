import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://localhost:5173';
async function fixture(role = 'ADMIN') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const account = { accountId: 'actor', role, fullName: 'Admin test' };
  await context.addInitScript(account => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account, tokens: { accessToken: 'fixture-only' } })), account);
  const page = await context.newPage();
  const state = { reason: 'NO_ENDPOINT_ON_ACTIVE_MAP', fail: false, writes: [], reads: [], errors: [],
    row: { incidentId: 'incident', incidentType: 'SOS', status: 'OPEN', severity: 'CRITICAL', rowVersion: 3,
      sosRoutingStatus: 'ROOM_UNAVAILABLE', occurredAt: new Date().toISOString(), description: 'SOS test', mapId: 'bdf6503a-d38e-4bde-9a67-763e91668593' } };
  page.on('pageerror', error => state.errors.push(error.message));
  const snapshot = () => ({ incident: state.row, canRetry: !state.row.sosResponderAccountId,
    eligibility: { status: state.reason === 'READY' ? 'ASSIGNED' : 'ROOM_UNAVAILABLE', reason: state.reason, roomName: state.reason === 'READY' ? 'SOS_01' : 'SOS_04' } });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (req.method() !== 'GET') {
      state.writes.push(path);
      assert.equal(path, '/api/v1/emergency-incidents/incident/retry-routing');
      assert.deepEqual(req.postDataJSON(), { rowVersion: state.row.rowVersion });
      if (state.fail) return reply({ message: 'Ca trực đã thay đổi' }, 409);
      if (state.reason === 'READY') { state.row.sosResponderAccountId = 'staff'; state.row.sosRoutingStatus = 'ASSIGNED'; state.row.rowVersion++; }
      return reply(snapshot());
    }
    state.reads.push(path);
    if (path.endsWith('/routing')) return reply(snapshot());
    if (path === '/api/v1/emergency-incidents/incident') return reply(state.row);
    if (path === '/api/v1/auth/me') return reply(account);
    const paged = rows => ({ content: rows, totalElements: rows.length, totalPages: rows.length ? 1 : 0, last: true });
    if (path === '/api/v1/emergency-incidents') return reply(paged(!url.searchParams.get('status') || url.searchParams.get('status') === state.row.status ? [state.row] : []));
    if (path === '/api/v1/admin/staff') return reply(paged([{ account: { accountId: 'staff', fullName: 'Nhân viên trực SOS' } }]));
    return reply(paged([]));
  });
  await page.goto(base + '/admin/emergency-center');
  await page.locator('.ec-detail-header').waitFor();
  return { context, page, state };
}
try {
  const f = await fixture();
  const card = f.page.getByRole('region', { name: 'Kiểm tra điều phối SOS' });
  await expect(card).toContainText('SOS_04');
  await expect(card).toContainText('Phòng SOS chưa có điểm đang bật');
  assert.equal(f.state.writes.length, 0, 'Preview must not route an incident');
  f.state.fail = true;
  await card.getByRole('button', { name: 'Điều phối lại', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Ca trực đã thay đổi');
  await expect(card.getByRole('button', { name: 'Điều phối lại', exact: true })).toBeDisabled();
  f.state.fail = false; f.state.reason = 'READY';
  await card.getByRole('button', { name: 'Kiểm tra lại', exact: true }).click();
  await expect(card).toContainText('SOS_01');
  await expect(card).toContainText('đúng một nhân viên');
  await f.page.setViewportSize({ width: 390, height: 844 });
  await card.scrollIntoViewIfNeeded();
  await mkdir('.workstation-build/sos-routing', { recursive: true });
  await f.page.screenshot({ path: '.workstation-build/sos-routing/mobile.png', fullPage: true });
  assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await card.getByRole('button', { name: 'Điều phối lại', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(f.page.locator('.ec-info-card').first()).toContainText('Nhân viên trực SOS');
  assert.equal(f.state.writes.length, 2);
  assert.deepEqual(f.state.errors, []);
  await f.context.close();
  const s = await fixture('STAFF');
  await expect(s.page.getByRole('button', { name: 'Điều phối lại', exact: true })).toHaveCount(0);
  assert.equal(s.state.reads.some(path => path.endsWith('/routing')), false);
  assert.equal(s.state.writes.length, 0);
  assert.deepEqual(s.state.errors, []);
  await s.context.close();
  console.log('PASS: read-only diagnosis, inactive-map reason, conflict refresh, correct SOS room, assignment, staff permissions and mobile layout; all APIs mocked.');
} finally { await browser.close(); }
