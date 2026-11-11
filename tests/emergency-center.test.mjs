import test from 'node:test';
import assert from 'node:assert/strict';
import { incidentActions, assertIncidentAction, incidentPresentation, incidentQuery, incidentTimeline, newerIncident, prioritizeIncidents, filterActiveIncidents, incidentOverdue, loadIncidentHistory } from '../src/features/operations/emergencyCenter.js';

test('incident actions follow the BE state machine, including false alarms', () => {
  const account = { role: 'STAFF', accountId: 'owner' };
  const expected = { OPEN: ['acknowledge', 'false-alarm'], ACKNOWLEDGED: ['start', 'false-alarm'], IN_PROGRESS: ['resolve'], RESOLVED: ['close'], CLOSED: [], FALSE_ALARM: [] };
  for (const [status, actions] of Object.entries(expected)) assert.deepEqual(incidentActions({ status, acknowledgedByAccountId: 'owner' }, account), actions);
  assert.deepEqual(incidentActions({ status: 'OPEN' }, { role: 'DEVICE' }), []);
  assert.deepEqual(incidentActions({ status: 'UNKNOWN' }, account), []);
});

test('admin monitors every incident state without reception or handling actions', () => {
  const admin = { role: 'ADMIN', accountId: 'admin' };
  for (const status of ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'FALSE_ALARM']) {
    const incident = { incidentId: 'i', status, acknowledgedByAccountId: 'admin', rowVersion: 1 };
    assert.deepEqual(incidentActions(incident, admin), []);
    for (const action of ['acknowledge', 'start', 'resolve', 'close', 'false-alarm']) assert.throws(() => assertIncidentAction(action, incident, incident, admin), /không còn quyền/);
  }
});

test('staff cannot start or resolve another staff member’s incident', () => {
  const other = { role: 'STAFF', accountId: 'other' }, owner = { role: 'STAFF', accountId: 'owner' };
  for (const status of ['ACKNOWLEDGED', 'IN_PROGRESS']) {
    const incident = { status, acknowledgedByAccountId: 'owner' };
    assert.deepEqual(incidentActions(incident, other), []);
    assert.ok(incidentActions(incident, owner).length);
    assert.deepEqual(incidentActions(incident, { role: 'STAFF' }), []);
  }
  assert.deepEqual(incidentActions({ status: 'RESOLVED', acknowledgedByAccountId: 'owner' }, other), ['close']);
});

test('preflight rejects changed state, identity, ownership or record version', () => {
  const incident = { incidentId: 'i', status: 'IN_PROGRESS', rowVersion: 2, acknowledgedByAccountId: 'owner' };
  const owner = { role: 'STAFF', accountId: 'owner' };
  assert.doesNotThrow(() => assertIncidentAction('resolve', incident, incident, owner));
  for (const change of [{ incidentId: 'other' }, { status: 'CLOSED' }, { rowVersion: 3 }, { acknowledgedByAccountId: 'other' }]) assert.throws(() => assertIncidentAction('resolve', incident, { ...incident, ...change }, owner), /đã thay đổi/);
  assert.equal(newerIncident(incident, { ...incident, rowVersion: 1 }), incident);
});

test('presentation uses catalog names, preserves zero coordinates and has clear missing-data fallbacks', () => {
  const incident = { incidentType: 'SOS', robotId: 'r', mapId: 'm', endpointId: 'e', acknowledgedByAccountId: 's', xM: 0, yM: 0 };
  const catalogs = { robots: [{ robotId: 'r', robotName: 'MAR-01' }], maps: [{ mapId: 'm', mapName: 'Tầng 1' }], endpoints: [{ endpointId: 'e', endpointName: 'Sảnh' }], staff: [{ account: { accountId: 's', fullName: 'Nhân viên trực' } }] };
  const info = incidentPresentation(incident, catalogs);
  assert.equal(info.title, 'Yêu cầu hỗ trợ khẩn cấp'); assert.equal(info.robot, 'MAR-01'); assert.equal(info.map, 'Tầng 1'); assert.equal(info.endpoint, 'Sảnh'); assert.equal(info.owner, 'Nhân viên trực'); assert.equal(info.coordinates, '0 m · 0 m');
  assert.equal(incidentPresentation(incident, {}, { accountId: 's', fullName: 'Người đang đăng nhập' }).owner, 'Người đang đăng nhập');
  assert.equal(incidentPresentation({}).coordinates, null);
  assert.equal(incidentPresentation({}).owner, 'Chưa có người tiếp nhận');
});

test('timeline does not invent a handling start timestamp or completion', () => {
  const incident = { status: 'IN_PROGRESS', occurredAt: '2026-11-03T03:00:00Z', acknowledgedAt: '2026-11-03T03:01:00Z' };
  const timeline = incidentTimeline(incident);
  assert.equal(timeline.at(-1).label, 'Đang xử lý'); assert.equal(timeline.at(-1).at, undefined); assert.equal(timeline.at(-1).done, false);
  assert.equal(incidentTimeline({ status: 'FALSE_ALARM', resolvedAt: 't', closedAt: 't' }).some(row => row.label === 'Xác nhận báo động nhầm'), true);
});

test('date filters cover the full local day and reject reversed ranges', () => {
  const query = incidentQuery({ status: 'OPEN', severity: 'CRITICAL', from: '2026-11-03', to: '2026-11-03' });
  assert.equal(query.from, new Date(2026, 10, 3, 0, 0, 0).toISOString());
  assert.equal(query.to, new Date(2026, 10, 3, 23, 59, 59, 999).toISOString());
  assert.throws(() => incidentQuery({ from: '2026-11-04', to: '2026-11-03' }), /Ngày kết thúc/);
});

test('routing identifies the designated responder and blocks another staff account', () => {
  const row = { status: 'OPEN', sosResponderAccountId: 'duty', sosRoutingStatus: 'ASSIGNED' };
  assert.deepEqual(incidentActions(row, { role: 'STAFF', accountId: 'other' }), []);
  assert.deepEqual(incidentActions(row, { role: 'STAFF', accountId: 'duty' }), ['acknowledge', 'false-alarm']);
  assert.deepEqual(incidentActions({ ...row, sosResponderAccountId: null, sosRoutingStatus: 'NO_ACTIVE_SHIFT' }, { role: 'STAFF', accountId: 'duty' }), []);
  assert.equal(incidentPresentation(row, { staff: [{ account: { accountId: 'duty', fullName: 'Nhân viên trực' } }] }).responder, 'Nhân viên trực');
});

test('queue prioritizes waiting incidents, uses reception time for overdue, and filters assigned responders correctly', () => {
  const now = Date.parse('2026-11-11T08:00:00Z');
  const rows = [
    { incidentId: 'handled', status: 'IN_PROGRESS', occurredAt: '2026-11-11T07:00:00Z', acknowledgedByAccountId: 's', severity: 'CRITICAL' },
    { incidentId: 'recent', status: 'OPEN', occurredAt: '2026-11-11T07:59:00Z', sosResponderAccountId: 's', severity: 'CRITICAL' },
    { incidentId: 'old', status: 'OPEN', occurredAt: '2026-11-11T07:50:00Z', severity: 'WARNING', incidentType: 'SUSPECTED_FALL' },
    { incidentId: 'done', status: 'RESOLVED', occurredAt: '2026-11-11T07:40:00Z' },
  ];
  assert.deepEqual(prioritizeIncidents(rows, now).map(row => row.incidentId), ['old', 'recent', 'handled', 'done']);
  assert.equal(incidentOverdue(rows[0], now), false);
  assert.equal(incidentOverdue({ status: 'OPEN', occurredAt: 'invalid' }, now), false);
  assert.deepEqual(filterActiveIncidents(rows, {}, 'unassigned', now).map(row => row.incidentId), ['old']);
  assert.deepEqual(filterActiveIncidents(rows, { type: 'SOS' }, 'overdue', now), []);
  assert.deepEqual(filterActiveIncidents(rows, { type: 'SUSPECTED_FALL' }, 'overdue', now).map(row => row.incidentId), ['old']);
});

test('history merges separate BE status streams into globally ordered pages and exact totals', async () => {
  const rows = Array.from({ length: 39 }, (_, index) => ({ incidentId: String(index), status: index % 3 ? 'CLOSED' : 'FALSE_ALARM', occurredAt: new Date(Date.UTC(2026, 10, 11, 0, index)).toISOString() })).reverse();
  const queries = [];
  const fetchPage = async query => {
    queries.push(query);
    const filtered = rows.filter(row => row.status === query.status);
    return { content: filtered.slice(query.page * query.size, (query.page + 1) * query.size), totalPages: Math.ceil(filtered.length / query.size), totalElements: filtered.length };
  };
  const result = await loadIncidentHistory(fetchPage, {}, 2);
  assert.deepEqual(result.content, rows.slice(20, 30));
  assert.equal(result.totalElements, 39); assert.equal(result.totalPages, 4);
  assert.ok(queries.every(query => ['CLOSED', 'FALSE_ALARM'].includes(query.status) && query.size === 10));
  const closed = await loadIncidentHistory(fetchPage, { status: 'CLOSED' }, 0);
  assert.equal(closed.totalElements, 26); assert.ok(closed.content.every(row => row.status === 'CLOSED'));
  await assert.rejects(() => loadIncidentHistory(async () => ({ content: null }), {}, 0), /không đúng định dạng/);
});
