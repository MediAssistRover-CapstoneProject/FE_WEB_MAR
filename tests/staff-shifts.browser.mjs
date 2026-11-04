import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const output = '.workstation-build/staff-shifts'; await mkdir(output, { recursive: true });
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const instant = (day, hour) => new Date(Date.parse(`2026-11-${String(day).padStart(2, '0')}T00:00:00+07:00`) + hour * 3600000).toISOString();
async function fixture(role = 'ADMIN', options = {}) {
  const account = { role, accountId: id(50), fullName: 'Nhân viên kiểm thử' };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/London' });
  await context.addInitScript(account => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account, tokens: { accessToken: 'fixture-token' } })), account);
  const page = await context.newPage(); page.setDefaultTimeout(8000); await page.clock.setFixedTime(new Date('2026-11-03T03:00:00Z'));
  const errors = [], reads = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  const row = (n, status, from, to, extra = {}) => ({ shiftId: id(n), shiftCode: `SHIFT-${n}`, shiftName: `Ca kiểm thử ${n}`, staffProfileId: id(20 + n), staffCode: `STAFF-${n}`, roomId: id(10), roomCode: 'P01', status, startsAt: instant(3, from), endsAt: instant(3, to), note: 'Ghi chú ban đầu', slots: [], updatedAt: '2026-11-02T00:00:00Z', ...extra });
  const state = { failList: false, failCatalogs: false, failWrite: false, ...options, rows: [row(1, 'PLANNED', 8, 12), row(2, 'ACTIVE', 9, 17, { roomId: id(11) }), row(3, 'PLANNED', 0, 6), row(4, 'COMPLETED', 0, 6, { roomId: id(11) }), row(5, 'CANCELLED', 6, 12), row(6, 'PLANNED', 22, 30), row(7, 'PLANNED', 8, 12, { startsAt: instant(4, 8), endsAt: instant(4, 12), slots: [{ slotId: id(70), sequenceNo: 1, startsAt: instant(4, 8), endsAt: instant(4, 12), status: 'AVAILABLE', note: 'Giữ khung giờ đã có' }] })] };
  const staff = Array.from({ length: 9 }, (_, n) => ({ staffProfileId: id(21 + n), staffCode: `STAFF-${n + 1}`, active: n !== 8, account: { fullName: `Nhân viên ${n + 1}`, status: 'ACTIVE' } }));
  const rooms = [{ roomId: id(10), roomName: 'Phòng tiếp nhận', roomCode: 'P01', active: true }, { roomId: id(11), roomName: 'Phòng điều trị', roomCode: 'P02', active: true }];
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    const list = rows => reply({ content: rows, totalPages: 1, totalElements: rows.length, last: true });
    if (request.method() !== 'GET') {
      const body = request.postDataJSON(); writes.push({ path, body, method: request.method() });
      if (state.failWrite) return reply({ message: 'Không cập nhật được ca kiểm thử' }, 409);
      if (path === '/api/v1/admin/shifts') { const saved = { ...body, shiftId: id(99), status: 'PLANNED', updatedAt: '2026-11-03T03:00:00Z' }; state.rows.push(saved); return reply(saved, 201); }
      const shift = state.rows.find(r => path.includes(r.shiftId));
      if (!shift) return reply({ message: 'Missing shift' }, 404);
      Object.assign(shift, body, { updatedAt: '2026-11-03T03:00:00Z' }); return reply(shift);
    }
    reads.push(path);
    if (path === '/api/v1/auth/me') return reply(account);
    if (['/api/v1/admin/shifts', '/api/v1/staff/shifts'].includes(path)) return state.failList ? reply({ message: 'Lịch trực tạm gián đoạn' }, 503) : list(state.rows);
    const shift = state.rows.find(r => path === `/api/v1/admin/shifts/${r.shiftId}`);
    if (shift) return reply(shift);
    if (['/api/v1/admin/staff', '/api/v1/rooms'].includes(path) && state.failCatalogs) return reply({ message: 'Danh mục tạm gián đoạn' }, 503);
    if (path === '/api/v1/admin/staff') return list(staff);
    if (path === '/api/v1/rooms') return list(rooms);
    return list([]);
  });
  const start = async () => { await page.goto(`${base}/admin/staff-shifts`); await page.locator('.ss-shift').first().waitFor(); await page.getByLabel('Tự đồng bộ mỗi 30 giây').uncheck(); if (role === 'ADMIN' && !state.failCatalogs) await page.getByRole('button', { name: 'Phân ca', exact: true }).waitFor({ state: 'visible' }); };
  const card = n => page.locator(`[data-shift-id="${id(n)}"]`);
  return { page, context, state, errors, reads, writes, start, card };
}
try {
  const f = await fixture(); await f.start();
  assert.equal(await f.page.locator('.ss-shift').count(), 6, 'each shift must appear once');
  assert.equal(await f.card(3).getByRole('button', { name: 'Bắt đầu trực' }).count(), 0, 'expired shifts cannot start');
  await f.card(1).getByRole('button', { name: 'Bắt đầu trực' }).waitFor();
  await f.page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await f.page.getByRole('tab', { name: 'Độ phủ phòng' }).click();
  const coverage = f.page.locator('.ss-room-coverage').filter({ hasText: 'Phòng tiếp nhận' });
  await coverage.locator('summary').click();
  assert.equal(await coverage.locator('.ss-coverage-cell.is-partial').count(), 2);
  await coverage.getByText('Chưa phân · 06:00–08:00', { exact: false }).waitFor();
  assert.equal(await coverage.locator('.ss-gap').filter({ hasText: '06:00–08:00' }).getByRole('button').count(), 0, 'past gaps cannot create shifts');
  await f.page.screenshot({ path: `${output}/coverage.png`, fullPage: true });
  await f.page.getByLabel('Khung hiển thị').selectOption('8');
  assert.equal(await coverage.locator('.ss-coverage-cell').count(), 3);
  await f.page.getByRole('tab', { name: 'Danh sách ca' }).click();
  await f.card(1).getByRole('button', { name: 'Bắt đầu trực' }).click();
  let dialog = f.page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Bắt đầu ca trực', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes[0].body.status, 'ACTIVE');
  await f.card(1).getByRole('button', { name: 'Kết thúc ca' }).click();
  dialog = f.page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Kết thúc ca trực', exact: true }).click();
  await dialog.getByRole('alert').waitFor(); assert.equal(f.writes.length, 1, 'early completion requires a reason');
  await dialog.getByLabel('Lý do *').fill('Đã bàn giao trực cho người thay thế.');
  await dialog.getByRole('button', { name: 'Kết thúc ca trực', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.match(f.writes[1].body.note, /Ghi chú ban đầu/); assert.match(f.writes[1].body.note, /bàn giao/);
  await f.card(3).getByRole('button', { name: 'Hủy ca', exact: true }).click();
  dialog = f.page.getByRole('dialog'); await dialog.getByLabel('Lý do *').fill('Ca chưa thực hiện, điều chỉnh lại lịch.');
  await dialog.getByRole('button', { name: 'Hủy ca trực', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes[2].body.status, 'CANCELLED');
  await f.page.getByRole('tab', { name: 'Danh sách ca' }).focus();
  await f.page.keyboard.press('ArrowRight');
  assert.equal(await f.page.getByRole('tab', { name: 'Độ phủ phòng' }).getAttribute('aria-selected'), 'true');
  await coverage.locator('summary').click();
  assert.equal(await coverage.locator('.ss-coverage-cell.is-empty').count(), 1, 'cancelled shifts leave the 00:00–08:00 block uncovered');
  await coverage.getByText('Chưa phân · 10:00–16:00', { exact: false }).waitFor();
  await f.page.getByRole('tab', { name: 'Độ phủ phòng' }).focus();
  await f.page.keyboard.press('ArrowLeft');
  // Server state changes between opening a dialog and submitting it.
  await f.card(6).getByRole('button', { name: 'Hủy ca', exact: true }).click();
  f.state.rows.find(r => r.shiftId === id(6)).status = 'CANCELLED';
  dialog = f.page.getByRole('dialog'); await dialog.getByLabel('Lý do *').fill('Kiểm tra cập nhật đồng thời.');
  await dialog.getByRole('button', { name: 'Hủy ca trực', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Ca trực đã thay đổi' }).waitFor(); assert.equal(f.writes.length, 3);
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  // Editing assignment must not alter legacy times, name, or existing slots.
  await f.page.getByRole('button', { name: '2026-11-04, 1 ca trực', exact: true }).click();
  await f.card(7).getByRole('button', { name: 'Chỉnh sửa', exact: true }).click(); dialog = f.page.getByRole('dialog');
  assert.equal(await dialog.locator('input[type="datetime-local"]').count(), 0);
  assert.equal(await dialog.getByLabel('Tên ca *').count(), 0);
  assert.match(await dialog.getByLabel('Thời gian cố định của ca').innerText(), /08:00/);
  await dialog.getByLabel('Ghi chú bàn giao').fill('Điều chỉnh phân công, giữ nguyên khung giờ.');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes.at(-1).body.slots[0].note, 'Giữ khung giờ đã có'); assert.equal(f.writes.at(-1).body.endsAt, instant(4, 12));
  assert.equal(f.writes.at(-1).body.startsAt, instant(4, 8)); assert.equal(f.writes.at(-1).body.shiftName, 'Ca kiểm thử 7');
  await f.card(7).getByRole('button', { name: 'Chỉnh sửa', exact: true }).click(); dialog = f.page.getByRole('dialog');
  f.state.rows.find(r => r.shiftId === id(7)).note = 'Nội dung đã đổi trên máy khác';
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Ca trực đã thay đổi' }).waitFor(); assert.equal(f.writes.length, 4);
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  // Coverage scale is 8h, but gap assignment must still use fixed 6h ca.
  await f.page.getByRole('tab', { name: 'Độ phủ phòng' }).click();
  await coverage.locator('summary').click();
  await coverage.locator('.ss-gap').filter({ hasText: '12:00–16:00' }).getByRole('button', { name: 'Phân bổ sung' }).click();
  dialog = f.page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Ca trực *').inputValue(), instant(4, 12));
  assert.match(await dialog.getByLabel('Thời gian cố định của ca').innerText(), /18:00/);
  assert.equal(await dialog.getByLabel('Phòng phụ trách *').inputValue(), id(10));
  await dialog.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  await f.page.getByRole('tab', { name: 'Danh sách ca' }).click();
  // New assignment chooses a ca, never free-form names or times.
  await f.page.getByRole('button', { name: 'Phân ca', exact: true }).click(); dialog = f.page.getByRole('dialog');
  await dialog.getByLabel('Nhân viên trực *').selectOption(id(28)); await dialog.getByLabel('Phòng phụ trách *').selectOption(id(11));
  assert.equal(await dialog.locator('input[type="datetime-local"]').count(), 0);
  assert.equal(await dialog.getByLabel('Tên ca *').count(), 0);
  assert.equal(await dialog.getByLabel('Ca trực *').locator('option').count(), 4);
  await dialog.getByLabel('Ca trực *').selectOption(instant(4, 18));
  await f.page.screenshot({ path: `${output}/create-dialog.png`, fullPage: true });
  await f.page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'create dialog must not overflow on mobile');
  await f.page.screenshot({ path: `${output}/mobile-dialog.png`, fullPage: true });
  await f.page.setViewportSize({ width: 1440, height: 1000 });
  f.state.failWrite = true;
  await dialog.getByRole('button', { name: 'Lưu ca trực' }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Không cập nhật được ca kiểm thử' }).waitFor();
  assert.equal(await dialog.getByLabel('Ca trực *').inputValue(), instant(4, 18), 'failed save preserves the selected ca');
  f.state.failWrite = false;
  await dialog.getByRole('button', { name: 'Lưu ca trực' }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(f.writes.at(-1).method, 'POST'); assert.match(f.writes.at(-1).body.shiftCode, /^SHIFT-/);
  assert.equal(f.writes.at(-1).body.shiftName, 'Ca tối'); assert.equal(f.writes.at(-1).body.startsAt, instant(4, 18)); assert.equal(f.writes.at(-1).body.endsAt, instant(5, 0));
  await f.page.getByLabel('Tìm kiếm', { exact: true }).fill('Ca tối'); assert.equal(await f.page.locator('.ss-shift').count(), 1);
  await f.page.getByLabel('Tìm kiếm', { exact: true }).fill('');
  f.state.failList = true; await f.page.getByRole('button', { name: 'Tải lại', exact: true }).click(); await f.page.getByRole('alert').filter({ hasText: 'Lịch trực tạm gián đoạn' }).waitFor();
  assert.ok(await f.page.locator('.ss-shift').count() > 0); assert.equal(await f.page.getByRole('button', { name: 'Phân ca', exact: true }).isDisabled(), true);
  f.state.failList = false; await f.page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await f.page.getByRole('alert').waitFor({ state: 'hidden' });
  for (const width of [1440, 1024, 768, 390]) {
    await f.page.setViewportSize({ width, height: 1000 });
    assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
    if (width === 390) await f.page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  }
  assert.deepEqual(f.errors, []); await f.context.close();

  const staff = await fixture('STAFF'); await staff.start();
  assert.equal(await staff.page.getByRole('button', { name: 'Phân ca', exact: true }).count(), 0);
  assert.equal(await staff.page.locator('.ss-shift-actions').count(), 0);
  assert.equal(await staff.page.getByRole('tab', { name: 'Độ phủ phòng' }).count(), 0);
  await staff.card(1).getByRole('button', { name: 'Xem chi tiết →', exact: true }).click();
  await staff.page.getByRole('dialog').getByText('STAFF-1', { exact: true }).waitFor();
  assert.ok(!staff.reads.some(path => path.startsWith('/api/v1/admin/'))); assert.equal(staff.writes.length, 0); assert.deepEqual(staff.errors, []); await staff.context.close();

  const degraded = await fixture('ADMIN', { failCatalogs: true }); await degraded.start();
  await degraded.page.getByText('Chưa tải đủ danh mục nhân viên/phòng.', { exact: false }).waitFor();
  assert.equal(await degraded.page.locator('.ss-shift').count(), 6); assert.equal(await degraded.page.getByRole('button', { name: 'Phân ca', exact: true }).isDisabled(), true);
  assert.deepEqual(degraded.errors, []); await degraded.context.close();
  console.log('Staff shifts: lifecycle, stale actions, coverage, timezone, slot preservation, create/edit, roles, failures and responsive UI passed.');
} finally { await browser.close(); }
