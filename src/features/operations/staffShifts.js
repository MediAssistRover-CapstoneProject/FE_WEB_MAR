export const SHIFT_ZONE = 'Asia/Ho_Chi_Minh';
export const DAY_MS = 86400000;
export const HOUR_MS = 3600000;
export const SHIFT_STATUSES = { PLANNED: 'Đã lên lịch', ACTIVE: 'Đang trực', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy' };
export const dayKey = value => new Intl.DateTimeFormat('sv-SE', { timeZone: SHIFT_ZONE }).format(new Date(value));
export const dayStart = day => Date.parse(`${day}T00:00:00+07:00`);
export const timeLabel = value => new Intl.DateTimeFormat('vi-VN', { timeZone: SHIFT_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const dateLabel = value => new Intl.DateTimeFormat('vi-VN', { timeZone: SHIFT_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const overlaps = (a, b, start, end) => Date.parse(a) < end && Date.parse(b) > start;
export const shiftsOnDay = (shifts, day) => shifts.filter(s => overlaps(s.startsAt, s.endsAt, dayStart(day), dayStart(day) + DAY_MS));
export const effectiveShift = (shift, now) => shift.status === 'ACTIVE' && Date.parse(shift.startsAt) <= now && Date.parse(shift.endsAt) > now;

export function shiftState(shift, now) {
  if (shift.status === 'PLANNED' && Date.parse(shift.endsAt) <= now) return { label: 'Quá giờ · chưa bắt đầu', tone: 'warning' };
  if (shift.status === 'PLANNED' && Date.parse(shift.startsAt) <= now) return { label: 'Đến giờ · chưa bắt đầu', tone: 'warning' };
  if (shift.status === 'ACTIVE' && Date.parse(shift.endsAt) <= now) return { label: 'Hết giờ · cần kết thúc', tone: 'warning' };
  if (shift.status === 'ACTIVE' && Date.parse(shift.startsAt) > now) return { label: 'Đã kích hoạt · chưa đến giờ', tone: 'warning' };
  return { label: SHIFT_STATUSES[shift.status] || shift.status, tone: { PLANNED: 'blue', ACTIVE: 'green', COMPLETED: 'violet', CANCELLED: 'muted' }[shift.status] || 'muted' };
}

export function shiftActions(shift, now) {
  if (shift.status === 'PLANNED') return { edit: Date.parse(shift.endsAt) > now, start: Date.parse(shift.startsAt) <= now && Date.parse(shift.endsAt) > now, cancel: true, complete: false };
  return { edit: false, start: false, cancel: shift.status === 'ACTIVE', complete: shift.status === 'ACTIVE' && Date.parse(shift.startsAt) <= now };
}

export function displayBlocks(day, hours = 6) {
  const start = dayStart(day);
  const length = [4, 6, 8, 12].includes(hours) ? hours : 6;
  return Array.from({ length: 24 / length }, (_, index) => ({
    name: length === 6 ? ['Đêm', 'Sáng', 'Chiều', 'Tối'][index] : `Khung ${index + 1}`,
    start: start + index * length * HOUR_MS,
    end: start + (index + 1) * length * HOUR_MS,
  }));
}

// Assignment periods are independent of the coverage display scale.
export function fixedShiftPeriods(day) {
  return displayBlocks(day, 6).map(period => ({ ...period, name: `Ca ${period.name.toLocaleLowerCase('vi')}`, startsAt: new Date(period.start).toISOString(), endsAt: new Date(period.end).toISOString() }));
}

export function isFixedShiftPeriod(shift) {
  if (!Number.isFinite(Date.parse(shift.startsAt)) || !Number.isFinite(Date.parse(shift.endsAt))) return false;
  return fixedShiftPeriods(dayKey(shift.startsAt)).some(period => period.start === Date.parse(shift.startsAt) && period.end === Date.parse(shift.endsAt));
}

// Union intervals: multiple staff covering the same room must not inflate coverage.
export function roomCoverage(shifts, roomId, start, end, now = Date.now()) {
  const periods = shifts.filter(s => s.roomId === roomId && ['PLANNED', 'ACTIVE', 'COMPLETED'].includes(s.status) && overlaps(s.startsAt, s.endsAt, start, end))
    .map(s => {
      const from = Date.parse(s.startsAt), to = Date.parse(s.endsAt), updated = Date.parse(s.updatedAt);
      // Terminal shifts have no further edits in the current API; updatedAt is
      // the transition time. Ignore invalid legacy timestamps outside the shift.
      const completedEnd = s.status === 'COMPLETED' ? Math.min(to, now, Number.isFinite(updated) && updated >= from ? updated : to) : to;
      return [Math.max(start, from), Math.min(end, completedEnd)];
    }).filter(([from, to]) => from < to).sort((a, b) => a[0] - b[0]);
  let cursor = start;
  const gaps = [];
  for (const [from, to] of periods) {
    if (from > cursor) gaps.push({ start: cursor, end: from });
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) gaps.push({ start: cursor, end });
  const missing = gaps.reduce((sum, gap) => sum + gap.end - gap.start, 0);
  return { gaps, coveredMs: end - start - missing, ratio: (end - start - missing) / (end - start), state: missing === 0 ? 'full' : missing === end - start ? 'empty' : 'partial' };
}

export function shiftFingerprint(shift) {
  return JSON.stringify([shift.shiftId, shift.updatedAt, shift.status, shift.staffProfileId, shift.roomId, shift.shiftName, shift.startsAt, shift.endsAt, shift.note, shift.slots]);
}

export function validateShift(body, shifts, original, now) {
  const start = Date.parse(body.startsAt), end = Date.parse(body.endsAt);
  if (!body.staffProfileId || !body.roomId || !body.shiftName.trim()) return 'Chọn người trực, phòng và nhập tên ca.';
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'Giờ kết thúc phải sau giờ bắt đầu.';
  if (end <= now) return 'Không thể lưu ca đã kết thúc. Hãy chọn lại thời gian.';
  if (!original && !isFixedShiftPeriod(body)) return 'Ca phân mới phải đúng khung giờ cố định. Hãy chọn lại ca trực.';
  if (original && (start !== Date.parse(original.startsAt) || end !== Date.parse(original.endsAt) || body.shiftName !== original.shiftName)) return 'Khi điều chỉnh phân công, tên ca và giờ trực phải giữ nguyên theo ca đã lưu.';
  if (shifts.some(s => s.shiftId !== original?.shiftId && s.staffProfileId === body.staffProfileId && s.status !== 'CANCELLED' && overlaps(s.startsAt, s.endsAt, start, end))) return 'Nhân viên đã có ca trùng giờ. Hãy chọn người hoặc thời gian khác.';
  const slots = [...body.slots].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const sequences = new Set();
  let previousEnd = start;
  for (const slot of slots) {
    const from = Date.parse(slot.startsAt), to = Date.parse(slot.endsAt);
    if (!Number.isInteger(slot.sequenceNo) || slot.sequenceNo < 1 || sequences.has(slot.sequenceNo)) return 'Thứ tự khung giờ con phải là số nguyên dương và không trùng nhau.';
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || from < start || to > end) return 'Mỗi khung giờ con phải nằm trong ca và có giờ kết thúc sau giờ bắt đầu.';
    if (from < previousEnd) return 'Các khung giờ con không được trùng nhau.';
    sequences.add(slot.sequenceNo); previousEnd = to;
  }
  return '';
}
