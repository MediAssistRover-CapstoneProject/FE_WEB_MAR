import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const output = '.workstation-build/emergency-center'; await mkdir(output, { recursive: true });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
async function fixture(account = { role: 'STAFF', accountId: id(50), fullName: 'Nhân viên trực kiểm thử' }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(account => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account, tokens: { accessToken: 'fixture-token' } })), account);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = [], writes = [], reads = [];
  page.on('pageerror', error => errors.push(error.message));
  const statuses = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'FALSE_ALARM'];
  const state = { failList: false, failDetail: false, failCatalogs: false, slowId: null, rows: statuses.map((status, index) => ({ incidentId: id(index + 1), status, incidentType: index % 2 ? 'SUSPECTED_FALL' : 'SOS', severity: index % 2 ? 'WARNING' : 'CRITICAL', description: `Nội dung kiểm tra sự cố ${index + 1}.`, robotId: id(20), mapId: id(21), endpointId: id(22), xM: 0, yM: 0, occurredAt: '2026-11-03T03:00:00Z', acknowledgedByAccountId: index ? id(50) : null, acknowledgedAt: index ? '2026-11-03T03:02:00Z' : null, resolvedAt: index >= 3 ? '2026-11-03T03:10:00Z' : null, closedAt: index >= 4 ? '2026-11-03T03:15:00Z' : null, rowVersion: 1 })) };
  const paged = (rows, url) => { const page = Number(url.searchParams.get('page') || 0), size = Number(url.searchParams.get('size') || 10); return { content: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), last: (page + 1) * size >= rows.length }; };
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (request.method() !== 'GET') {
      writes.push({ path, body: request.postData() ? request.postDataJSON() : null });
      const row = state.rows.find(row => path.includes(row.incidentId));
      if (!row) return reply({ message: 'Missing fixture incident' }, 404);
      const action = path.split('/').at(-1);
      const next = { acknowledge: 'ACKNOWLEDGED', start: 'IN_PROGRESS', resolve: 'RESOLVED', close: 'CLOSED', 'false-alarm': 'FALSE_ALARM' }[action];
      row.status = next; row.rowVersion++; row.acknowledgedByAccountId = account.accountId;
      return reply(row);
    }
    reads.push(path + url.search);
    if (path === '/api/v1/auth/me') return reply(account);
    if (path === '/api/v1/emergency-incidents') {
      if (state.failList) return reply({ message: 'Không tải được danh sách thử nghiệm' }, 503);
      const rows = state.rows.filter(row => ['status', 'severity'].every(key => !url.searchParams.get(key) || row[key] === url.searchParams.get(key)) && (!url.searchParams.get('type') || row.incidentType === url.searchParams.get('type')));
      return reply(paged(rows, url));
    }
    const row = state.rows.find(row => path === `/api/v1/emergency-incidents/${row.incidentId}`);
    if (row) {
      const snapshot = structuredClone(row);
      if (state.slowId === row.incidentId) await new Promise(resolve => setTimeout(resolve, 700));
      return state.failDetail ? reply({ message: 'Chi tiết đang gián đoạn' }, 503) : reply(snapshot);
    }
    if (state.failCatalogs && ['/api/v1/robots', '/api/v1/maps', '/api/v1/endpoints', '/api/v1/admin/staff'].includes(path)) return reply({ message: 'Danh mục gián đoạn' }, 503);
    if (path === '/api/v1/robots') return reply(paged([{ robotId: id(20), robotName: 'MAR-01' }], url));
    if (path === '/api/v1/maps') return reply(paged([{ mapId: id(21), mapName: 'Tầng 1 · Khu điều trị' }], url));
    if (path === '/api/v1/endpoints') return reply(paged([{ endpointId: id(22), endpointName: 'Sảnh tiếp đón' }], url));
    if (path === '/api/v1/admin/staff') return reply(paged([{ account: { accountId: id(50), fullName: 'Nhân viên trực' } }], url));
    return reply(paged([], url));
  });
  const start = async () => { await page.goto(`${base}/admin/emergency-center`); await page.locator('.ec-incident').first().waitFor(); await page.locator('.ec-detail-header').waitFor(); };
  return { context, page, state, errors, writes, reads, start };
}
try {
  const admin = await fixture({ role: 'ADMIN', accountId: id(50), fullName: 'Quản trị viên kiểm thử' }); await admin.start();
  assert.equal(await admin.page.locator('.ec-header h2').innerText(), 'Giám sát SOS');
  await admin.page.getByRole('button', { name: 'Giám sát SOS', exact: true }).waitFor();
  await admin.page.getByText('Chế độ giám sát · Staff tiếp nhận và cập nhật kết quả xử lý SOS.', { exact: true }).waitFor();
  for (let index = 0; index < 6; index++) {
    await admin.page.locator('.ec-incident').nth(index).click();
    await admin.page.locator('.ec-description').getByText(`Nội dung kiểm tra sự cố ${index + 1}.`, { exact: true }).waitFor();
    assert.equal(await admin.page.locator('.ec-next-step button, .ec-false-alarm').count(), 0, 'admin must have no incident mutation controls in any state');
    assert.equal(await admin.page.getByRole('dialog').count(), 0);
  }
  assert.equal(admin.writes.length, 0);
  await admin.page.locator('.ec-incident').first().click();
  await admin.page.getByText('Đang chờ staff tiếp nhận và xác minh tình huống thực tế.', { exact: true }).waitFor();
  await admin.page.screenshot({ path: `${output}/admin-monitoring.png`, fullPage: true });
  assert.deepEqual(admin.errors, []); await admin.context.close();

  const f = await fixture(); await f.start();
  await f.page.getByRole('button', { name: 'Tiếp nhận sự cố', exact: true }).waitFor();
  assert.equal(await f.page.getByRole('button', { name: 'Xác nhận xử lý xong', exact: true }).count(), 0);
  await f.page.getByText('Sảnh tiếp đón', { exact: true }).last().waitFor();
  assert.equal(await f.page.locator('.ec-metric').count(), 4);
  assert.ok(!(await f.page.locator('.ec-freshness').first().innerText()).includes('lúc Chưa ghi nhận'));
  assert.equal(await f.page.locator('.ec-technical').getAttribute('open'), null);
  await f.page.screenshot({ path: `${output}/desktop-open.png`, fullPage: true });
  await f.page.getByRole('button', { name: 'Tiếp nhận sự cố', exact: true }).click();
  const dialog = f.page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByRole('alert').waitFor(); assert.equal(f.writes.length, 0);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await f.page.getByRole('button', { name: 'Bắt đầu xử lý', exact: true }).waitFor();
  assert.equal(f.writes.length, 1);
  assert.equal(await f.page.locator('.ec-incident.is-selected').count(), 1, 'successful action preserves the selected incident');

  // A state change while confirming must never submit a stale action.
  await f.page.getByRole('button', { name: 'Bắt đầu xử lý', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  f.state.rows[0].status = 'IN_PROGRESS'; f.state.rows[0].rowVersion++;
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Sự cố đã thay đổi' }).waitFor();
  assert.equal(f.writes.length, 1);
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  await f.page.getByRole('button', { name: 'Xác nhận xử lý xong', exact: true }).click();
  assert.equal(await dialog.getByLabel('Ghi chú xử lý').inputValue(), '');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  assert.equal(f.writes.length, 1, 'empty resolution note cannot be submitted');
  await dialog.getByLabel('Ghi chú xử lý').fill('Đã kiểm tra và hoàn thành hỗ trợ thực tế.');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await f.page.getByRole('button', { name: 'Đóng hồ sơ', exact: true }).waitFor();
  assert.equal(f.writes[1].body.resolutionNote, 'Đã kiểm tra và hoàn thành hỗ trợ thực tế.');

  await f.page.getByLabel('Trạng thái sự cố').selectOption('CLOSED');
  await f.page.locator('.ec-detail-kicker').getByText('Đã đóng', { exact: true }).waitFor();
  assert.equal(await f.page.getByRole('button', { name: 'Đóng hồ sơ', exact: true }).count(), 0);
  assert.equal(await f.page.getByRole('button', { name: 'Đánh dấu báo động nhầm', exact: true }).count(), 0);
  assert.ok(f.reads.some(read => read.includes('status=CLOSED') && read.includes('size=10')));
  await f.page.screenshot({ path: `${output}/desktop-closed.png`, fullPage: true });

  // Read errors preserve details and disable writes. Lists use true server pagination.
  f.state.failDetail = true; f.state.failList = true;
  await f.page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await f.page.getByRole('alert').filter({ hasText: 'Chi tiết đang gián đoạn' }).waitFor();
  assert.equal(await f.page.locator('.ec-detail-header').count(), 1);
  assert.equal(await f.page.locator('.ec-incident').count(), 1);
  f.state.failDetail = false; f.state.failList = false;
  await f.page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await f.page.getByLabel('Trạng thái sự cố').selectOption('');
  await f.page.locator('.ec-incident').nth(5).waitFor();
  f.state.slowId = id(2);
  await f.page.locator('.ec-incident').nth(1).click(); await f.page.locator('.ec-incident').nth(2).click();
  await f.page.getByRole('button', { name: 'Xác nhận xử lý xong', exact: true }).waitFor();
  await f.page.waitForTimeout(800);
  assert.match(await f.page.locator('.ec-reference').innerText(), /11111111/);
  assert.equal(await f.page.locator('.ec-description').getByText('Nội dung kiểm tra sự cố 3.', { exact: true }).count(), 1);
  await f.page.screenshot({ path: `${output}/desktop-in-progress.png`, fullPage: true });
  for (const width of [1024, 390]) {
    await f.page.setViewportSize({ width, height: 900 });
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `no overflow at ${width}px`);
    assert.ok((await f.page.locator('.ec-detail-header h3').boundingBox()).width > 180);
    await f.page.screenshot({ path: `${output}/layout-${width}.png`, fullPage: true });
  }
  await f.page.locator('.ec-technical summary').click();
  const timeline = await f.page.locator('.ec-timeline').elementHandle();
  const detailReads = f.reads.filter(read => read === `/api/v1/emergency-incidents/${id(3)}`).length;
  await f.page.waitForTimeout(16000);
  assert.ok(f.reads.filter(read => read === `/api/v1/emergency-incidents/${id(3)}`).length > detailReads, 'selected detail refreshes without user interaction');
  assert.equal(await timeline.evaluate(element => element.isConnected), true, 'background refresh preserves readable content');
  assert.equal(await f.page.locator('.ec-technical').getAttribute('open'), '');
  assert.equal(await f.page.getByText('Đang tải chi tiết…', { exact: true }).count(), 0);
  assert.deepEqual(f.errors, []); await f.context.close();

  const g = await fixture({ role: 'STAFF', accountId: id(70), fullName: 'Nhân viên khác' }); await g.start();
  await g.page.locator('.ec-incident').nth(1).click();
  await g.page.getByText(/Sự cố do nhân viên khác tiếp nhận/).waitFor();
  assert.equal(await g.page.getByRole('button', { name: 'Bắt đầu xử lý', exact: true }).count(), 0);
  assert.equal(g.reads.some(read => read.startsWith('/api/v1/admin/staff')), false);
  assert.equal(g.writes.length, 0); assert.deepEqual(g.errors, []); await g.context.close();

  const h = await fixture(); h.state.rows = [];
  await h.page.goto(`${base}/admin/emergency-center`);
  await h.page.getByText('Chưa có sự cố được ghi nhận', { exact: true }).waitFor();
  await h.page.getByText('Chọn một sự cố để xem vị trí, tiến trình và thao tác tiếp theo.', { exact: true }).waitFor();
  assert.equal(h.writes.length, 0); assert.deepEqual(h.errors, []); await h.context.close();

  const p = await fixture();
  const first = p.state.rows[0];
  p.state.rows = Array.from({ length: 21 }, (_, index) => ({ ...first, incidentId: id(100 + index), description: `Sự cố phân trang ${index + 1}` }));
  await p.start();
  await p.page.getByRole('button', { name: 'Trang sự cố sau' }).click();
  await p.page.getByText('Trang 2/3', { exact: true }).waitFor();
  await p.page.locator('.ec-description').getByText('Sự cố phân trang 11', { exact: true }).waitFor();
  assert.equal(await p.page.locator('.ec-incident').count(), 10);
  await p.page.getByRole('button', { name: 'Đánh dấu báo động nhầm' }).click();
  const alarm = p.page.getByRole('dialog');
  await alarm.getByText(/xử lý hủy yêu cầu\/công việc liên quan/).waitFor();
  await alarm.getByLabel('Ghi chú xử lý').fill('Đã kiểm tra, đây là báo động nhầm.');
  await alarm.getByRole('checkbox').check();
  await alarm.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await alarm.waitFor({ state: 'hidden' });
  assert.equal(p.writes.length, 1); assert.ok(p.writes[0].path.endsWith('/false-alarm'));
  assert.deepEqual(p.errors, []); await p.context.close();
  console.log('PASS: admin monitoring has no mutations in all six states; staff lifecycle, stale-state rejection, required notes, terminal read-only, refresh/errors, filtering, pagination, ownership and 1440/1024/390 layouts. All writes intercepted by fixtures.');
} finally { await browser.close(); }
