import assert from 'node:assert/strict';
import test from 'node:test';
import { alertSignature, auditActors, availableAlertActions, breakdownTarget, dateQuery, evidenceUrl, localDay, newerAlert, presetRange } from '../src/features/monitoring/monitoringModel.js';

const admin = { account: { accountId: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'fixture' } };
const staff = { account: { accountId: 'staff', role: 'STAFF' }, tokens: { accessToken: 'fixture' } };
const alert = { alertId: 'alert', status: 'OPEN', rowVersion: 1, requireAck: true, recipients: [{ accountId: 'admin' }] };
test('report presets respect the Vietnamese calendar across UTC midnight and leap days', () => {
  assert.equal(localDay(new Date('2026-11-10T18:00:00Z')), '2026-11-11');
  assert.deepEqual(presetRange(7, new Date('2026-11-10T18:00:00Z')), { from: '2026-11-05', to: '2026-11-11' });
  assert.deepEqual(presetRange(1, new Date('2024-02-28T18:00:00Z')), { from: '2024-02-29', to: '2024-02-29' });
});
test('date filters include complete local days and never send blank optional filters', () => {
  assert.deepEqual(dateQuery({ from: '2026-11-11', to: '2026-11-11', status: '' }, { required: true }), { from: '2026-11-10T17:00:00.000Z', to: '2026-11-11T16:59:59.999Z' });
  assert.deepEqual(dateQuery({ from: '', to: '', type: '' }), {});
  assert.throws(() => dateQuery({}, { required: true }), /chọn đủ/);
  assert.throws(() => dateQuery({ from: '2026-11-12', to: '2026-11-11' }), /kết thúc/);
  assert.throws(() => dateQuery({ from: '2026-02-30' }), /chưa hợp lệ/);
  assert.throws(() => dateQuery({ from: '2026-14-11' }), /chưa hợp lệ/);
});
test('report ranges enforce backend limits before requesting analytics', () => {
  assert.throws(() => dateQuery({ from: '2025-01-01', to: '2026-11-11' }, { report: true }), /366/);
  assert.throws(() => dateQuery({ from: '2026-01-01', to: '2026-02-02', interval: 'HOUR' }, { report: true }), /31 ngày/);
  assert.equal(dateQuery({ from: '2026-01-01', to: '2026-01-31', interval: 'HOUR' }, { report: true }).interval, 'HOUR');
});
test('report ranges use an exclusive next-day boundary so the final millisecond is included', () => {
  const query = dateQuery({ from: '2026-11-11', to: '2026-11-11' }, { report: true, required: true });
  assert.equal(query.to, '2026-11-11T17:00:00.000Z');
  assert.ok(Date.parse('2026-11-11T16:59:59.999Z') < Date.parse(query.to));
});
test('alert actions follow OPEN -> ACKNOWLEDGED -> RESOLVED -> CLOSED', () => {
  assert.deepEqual(availableAlertActions(alert, admin), ['acknowledge']);
  assert.deepEqual(availableAlertActions({ ...alert, status: 'ACKNOWLEDGED', recipients: [{ accountId: 'admin', acknowledgedAt: '2026-11-11T00:00:00Z' }] }, admin), ['resolve']);
  assert.deepEqual(availableAlertActions({ ...alert, status: 'RESOLVED' }, admin), ['close']);
  assert.deepEqual(availableAlertActions({ ...alert, status: 'CLOSED' }, admin), []);
  assert.deepEqual(availableAlertActions({ ...alert, requireAck: false }, admin), []);
});
test('acknowledgements require the correct role, recipient and an unexpired window', () => {
  assert.deepEqual(availableAlertActions(alert, { ...admin, account: { ...admin.account, accountId: 'someone-else' } }), []);
  assert.deepEqual(availableAlertActions(alert, { ...admin, mode: 'demo' }), []);
  assert.deepEqual(availableAlertActions(alert, { ...admin, account: { role: 'ADMIN' } }), []);
  assert.deepEqual(availableAlertActions(alert, { ...admin, account: { accountId: 'admin', role: 'PATIENT' } }), []);
  assert.deepEqual(availableAlertActions({ ...alert, expiresAt: '2026-11-11T00:00:00Z' }, admin, null, Date.parse('2026-11-11T00:01:00Z')), []);
  assert.deepEqual(availableAlertActions(alert, staff), ['acknowledge'], 'staff access is scoped again by the backend');
});
test('incident prerequisites and workflow recovery cannot be bypassed through alert buttons', () => {
  const linked = { ...alert, incidentId: 'incident', status: 'ACKNOWLEDGED', recipients: [] };
  assert.deepEqual(availableAlertActions(linked, admin), []);
  assert.deepEqual(availableAlertActions(linked, admin, { incidentId: 'other', status: 'CLOSED' }), []);
  assert.deepEqual(availableAlertActions(linked, admin, { incidentId: 'incident', status: 'OPEN' }), []);
  assert.deepEqual(availableAlertActions(linked, admin, { incidentId: 'incident', status: 'RESOLVED' }), ['resolve']);
  assert.deepEqual(availableAlertActions({ ...linked, status: 'RESOLVED' }, admin, { incidentId: 'incident', status: 'RESOLVED' }), []);
  assert.deepEqual(availableAlertActions({ ...linked, status: 'RESOLVED' }, admin, { incidentId: 'incident', status: 'CLOSED' }), ['close']);
  assert.deepEqual(availableAlertActions({ ...alert, notificationType: 'WORKFLOW_FAILURE' }, admin), []);
});
test('unassigned routed SOS preserves the explicit admin triage exception', () => {
  const sos = { ...alert, incidentId: 'incident', recipients: [], expiresAt: '2026-01-01T00:00:00Z' };
  assert.deepEqual(availableAlertActions(sos, admin, { incidentId: 'incident', sosRoutingStatus: 'NO_ACTIVE_SHIFT', sosResponderAccountId: null }), ['acknowledge']);
  assert.deepEqual(availableAlertActions(sos, admin, { incidentId: 'incident', sosRoutingStatus: 'ASSIGNED', sosResponderAccountId: 'staff' }), []);
});
test('newer alert versions and frozen intent protect against stale reads and changed recipients', () => {
  const newer = { ...alert, rowVersion: 3, status: 'ACKNOWLEDGED' };
  assert.equal(newerAlert(newer, alert), newer);
  assert.notEqual(alertSignature(alert), alertSignature({ ...alert, recipients: [{ accountId: 'other' }] }));
  assert.notEqual(alertSignature(alert), alertSignature({ ...alert, expiresAt: '2026-01-01T00:00:00Z' }));
});
test('audit actors include the current admin and observed admins as well as staff across pages', () => {
  const first = auditActors([], [{ accountId: 'staff', actorUsername: 'Nurse' }, { accountId: 'other-admin', actorUsername: 'Manager' }], admin.account);
  const next = auditActors(first, [{ accountId: 'third-admin', actorUsername: 'Director' }], admin.account);
  assert.deepEqual(new Set(next.map(row => row.accountId)), new Set(['admin', 'staff', 'other-admin', 'third-admin']));
});
test('evidence references never become executable or credential-bearing links', () => {
  assert.equal(evidenceUrl('/media/evidence.png', 'https://api.example.test'), 'https://api.example.test/media/evidence.png');
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,test', '//evil.test/image.png', 'opaque-evidence-id', 'https://user:secret@example.test/image.png']) assert.equal(evidenceUrl(value, 'https://api.example.test'), null);
});
test('report drill-down resolves backend codes to exact IDs and workflow versions', () => {
  const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222';
  const versions = [{ workflowId: first, workflowCode: 'DELIVERY', versionNo: 1 }, { workflowId: second, workflowCode: 'DELIVERY', versionNo: 2 }];
  assert.equal(breakdownTarget({ key: 'DELIVERY', label: 'Delivery v1' }, versions, 'workflow'), first);
  assert.equal(breakdownTarget({ key: 'DELIVERY', label: 'Delivery' }, versions, 'workflow'), null);
  assert.equal(breakdownTarget({ key: 'MAR-01' }, [{ robotCode: 'MAR-01', robotId: first }], 'robot'), first);
  assert.equal(breakdownTarget({ key: 'UNASSIGNED' }, [], 'robot'), null);
});
