import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, HOUR_MS, dayKey, dayStart, displayBlocks, effectiveShift, fixedShiftPeriods, isFixedShiftPeriod, roomCoverage, shiftActions, shiftState, shiftsOnDay, validateShift } from '../src/features/operations/staffShifts.js';
const day = '2026-11-03', start = dayStart(day), now = start + 10 * HOUR_MS;
const shift = (from, to, extra = {}) => ({ shiftId: 'a', staffProfileId: 'staff', roomId: 'room', shiftName: 'Ca trực', status: 'PLANNED', startsAt: new Date(start + from * HOUR_MS).toISOString(), endsAt: new Date(start + to * HOUR_MS).toISOString(), slots: [], ...extra });

test('coverage reports missing hours for a partly staffed block', () => {
  const coverage = roomCoverage([shift(8, 12)], 'room', start + 6 * HOUR_MS, start + 12 * HOUR_MS);
  assert.equal(coverage.state, 'partial');
  assert.deepEqual(coverage.gaps, [{ start: start + 6 * HOUR_MS, end: start + 8 * HOUR_MS }]);
});
test('coverage merges overlapping and touching staff intervals, ignores cancelled and other rooms', () => {
  const coverage = roomCoverage([shift(6, 9), shift(8, 10, { shiftId: 'b' }), shift(10, 12, { shiftId: 'c' }), shift(0, 24, { status: 'CANCELLED' }), shift(0, 24, { roomId: 'other' })], 'room', start + 6 * HOUR_MS, start + 12 * HOUR_MS);
  assert.equal(coverage.state, 'full'); assert.equal(coverage.coveredMs, 6 * HOUR_MS); assert.deepEqual(coverage.gaps, []);
  assert.equal(roomCoverage([shift(0, 24, { status: 'CANCELLED' })], 'room', start, start + DAY_MS).state, 'empty');
});
test('overnight shifts appear once per overlapping day; midnight boundary belongs only to next interval', () => {
  const rows = [shift(22, 30)];
  assert.equal(shiftsOnDay(rows, day).length, 1); assert.equal(shiftsOnDay(rows, '2026-11-04').length, 1);
  assert.equal(shiftsOnDay([shift(0, 24)], '2026-11-04').length, 0);
  assert.deepEqual(roomCoverage(rows, 'room', start + DAY_MS, start + 30 * HOUR_MS).gaps, []);
});
test('ending a shift early leaves the remaining hours uncovered', () => {
  const row = shift(8, 12, { status: 'COMPLETED', updatedAt: new Date(now).toISOString() });
  const coverage = roomCoverage([row], 'room', start + 8 * HOUR_MS, start + 12 * HOUR_MS, now);
  assert.deepEqual(coverage.gaps, [{ start: now, end: start + 12 * HOUR_MS }]);
});
test('only an active shift inside its actual period counts as on duty', () => {
  assert.equal(effectiveShift(shift(8, 12, { status: 'ACTIVE' }), now), true);
  for (const row of [shift(8, 12), shift(12, 18, { status: 'ACTIVE' }), shift(0, 6, { status: 'ACTIVE' })]) assert.equal(effectiveShift(row, now), false);
  assert.equal(shiftState(shift(0, 6), now).tone, 'warning');
  assert.equal(shiftState(shift(0, 6, { status: 'ACTIVE' }), now).label, 'Hết giờ · cần kết thúc');
});
test('actions respect time and lifecycle, including ending an active overnight shift started yesterday', () => {
  assert.equal(shiftActions(shift(12, 18), now).start, false);
  assert.equal(shiftActions(shift(8, 12), now).start, true);
  assert.equal(shiftActions(shift(0, 6), now).edit, false);
  assert.equal(shiftActions(shift(-2, 11, { status: 'ACTIVE' }), now).complete, true);
  assert.equal(shiftActions(shift(12, 18, { status: 'ACTIVE' }), now).complete, false);
  assert.deepEqual(shiftActions(shift(0, 6, { status: 'COMPLETED' }), now), { edit: false, start: false, cancel: false, complete: false });
});
test('assignment periods are fixed in UTC+7 and independent of display hours', () => {
  const periods = fixedShiftPeriods(day);
  assert.equal(periods.length, 4);
  assert.equal(periods[2].name, 'Ca chiều');
  assert.equal(periods[2].startsAt, '2026-11-03T05:00:00.000Z');
  assert.equal(periods[2].endsAt, '2026-11-03T11:00:00.000Z');
  assert.equal(periods[3].end, start + DAY_MS);
  assert.equal(isFixedShiftPeriod(shift(6, 12)), true);
  assert.equal(isFixedShiftPeriod(shift(8, 12)), false);
  assert.equal(isFixedShiftPeriod(shift(18, 25)), false);
  assert.equal(dayKey('2026-11-03T18:00:00Z'), '2026-11-04');
});
test('new assignments use the whole fixed period, including an ongoing ca; expired ca cannot be assigned', () => {
  assert.match(validateShift(shift(0, 6), [], null, now), /đã kết thúc/);
  assert.match(validateShift(shift(8, 12), [], null, now), /khung giờ cố định/);
  assert.equal(validateShift(shift(6, 12), [], null, now), '');
  assert.equal(validateShift(shift(12, 18), [], null, now), '');
});
test('editing assignment preserves legacy times and names exactly', () => {
  assert.equal(validateShift(shift(8, 12), [], shift(8, 12), now), '');
  assert.match(validateShift(shift(9, 12), [], shift(8, 12), now), /giữ nguyên/);
  assert.match(validateShift(shift(8, 13), [], shift(8, 12), now), /giữ nguyên/);
  assert.match(validateShift(shift(8, 12, { shiftName: 'Ca khác' }), [], shift(8, 12), now), /giữ nguyên/);
});
test('staff overlap is blocked, adjacent or cancelled shifts do not block', () => {
  assert.match(validateShift(shift(12, 18), [shift(14, 20, { shiftId: 'b' })], null, now), /trùng giờ/);
  assert.equal(validateShift(shift(12, 18), [shift(18, 24, { shiftId: 'b' })], null, now), '');
  assert.equal(validateShift(shift(12, 18), [shift(14, 20, { shiftId: 'b', status: 'CANCELLED' })], null, now), '');
});
test('slots must remain inside fixed shifts, with unique sequence and no overlap', () => {
  const row = shift(12, 18), slot = { sequenceNo: 1, status: 'AVAILABLE', startsAt: row.startsAt, endsAt: row.endsAt };
  assert.equal(validateShift({ ...row, slots: [slot] }, [], null, now), '');
  assert.match(validateShift({ ...row, slots: [{ ...slot, endsAt: shift(12, 19).endsAt }] }, [], null, now), /nằm trong ca/);
  assert.match(validateShift({ ...row, slots: [slot, slot] }, [], null, now), /không trùng nhau/);
  assert.match(validateShift({ ...row, slots: [slot, { ...slot, sequenceNo: 2 }] }, [], null, now), /không được trùng/);
});
test('changing display blocks does not affect real shifts', () => {
  assert.equal(displayBlocks(day, 6).length, 4); assert.equal(displayBlocks(day, 8).length, 3);
  assert.equal(displayBlocks(day, 5).length, 4);
  assert.equal(displayBlocks(day, 12).at(-1).end, start + DAY_MS);
});
