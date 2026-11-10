import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStaff, passwordError, sortStaff, staffActions, staffDisplayName, staffFingerprint, staffStatus } from '../src/features/admin/staffManagement.js';
const member = (overrides = {}) => ({ staffProfileId: 'profile', staffCode: 'NV01', departmentCode: 'NOI', jobTitle: 'Điều dưỡng', active: true, account: { accountId: 'staff-account', fullName: 'Đặng Thị Ánh', username: 'staff', email: 'staff@example.test', role: 'STAFF', status: 'ACTIVE' }, ...overrides });
test('account actions follow status, staff profile and actor role boundaries', () => {
  const active = member();
  assert.deepEqual(staffActions(active, 'admin'), { edit: true, lock: true, unlock: false, reset: true, deactivate: true });
  const locked = member({ account: { ...active.account, status: 'LOCKED' } });
  assert.equal(staffActions(locked, 'admin').lock, false); assert.equal(staffActions(locked, 'admin').unlock, true);
  for (const row of [member({ active: false }), member({ account: { ...active.account, status: 'INACTIVE' } }), member({ account: { ...active.account, role: 'ADMIN' } })]) assert.ok(Object.values(staffActions(row, 'admin')).every(v => !v));
  assert.ok(Object.values(staffActions(active, 'staff-account')).every(v => !v));
});
test('inactive profile takes precedence over account status', () => {
  assert.equal(staffStatus(member({ active: false })).key, 'INACTIVE');
  assert.equal(staffStatus(member({ account: { status: 'LOCKED' } })).key, 'LOCKED');
  assert.equal(staffStatus({}).key, 'UNKNOWN');
});
test('search matches Vietnamese names without accents, and combines with department/status', () => {
  const rows = [member(), member({ staffProfileId: 'other', departmentCode: 'NGOAI', account: { ...member().account, username: 'nurse', fullName: 'Trần Minh', status: 'LOCKED' } })];
  assert.equal(filterStaff(rows, { search: 'dang thi anh' }).length, 1);
  assert.equal(filterStaff(rows, { search: 'STAFF@example.test', department: 'NOI', status: 'ACTIVE' }).length, 1);
  assert.equal(filterStaff(rows, { search: 'dang', department: 'NGOAI' }).length, 0);
  assert.equal(filterStaff(rows, { status: 'LOCKED' })[0].staffProfileId, 'other');
});
test('user-entered values are preserved; sorting is natural by staff code', () => {
  assert.equal(staffDisplayName(member({ account: { username: 'staff' } })), 'staff');
  const rows = [member({ staffCode: 'NV10' }), member({ staffCode: 'NV2' })];
  assert.deepEqual(sortStaff(rows).map(r => r.staffCode), ['NV2', 'NV10']);
  assert.equal(rows[0].staffCode, 'NV10');
});
test('password length and bcrypt byte limit are checked without altering the password', () => {
  assert.equal(passwordError(' valid-password '), '');
  assert.match(passwordError('short'), /8/);
  const multibyte = 'ắ'.repeat(25); assert.match(passwordError(multibyte), /72 byte/);
});
test('fingerprint detects changes that must invalidate an open edit or account action', () => {
  const row = member();
  assert.notEqual(staffFingerprint(row), staffFingerprint({ ...row, active: false }));
  assert.notEqual(staffFingerprint(row), staffFingerprint({ ...row, account: { ...row.account, status: 'LOCKED' } }));
  assert.notEqual(staffFingerprint(row), staffFingerprint({ ...row, departmentCode: 'NEW' }));
  assert.notEqual(staffFingerprint(row), staffFingerprint({ ...row, url: 'https://images.example.test/images/new.jpg' }));
});
