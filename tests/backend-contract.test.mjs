import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../src/features/api/backendContract.json' with { type: 'json' };
import { operations, buildRequest, prepareBody, prepareValue, requestSchema, initialValue, canUse } from '../src/features/api/contract.js';
import { resources, resourceFor, managedOperations } from '../src/features/api/workspaceCatalog.js';
const id = '11111111-1111-4111-8111-111111111111';

test('every human API has a UI resource or auth flow; device APIs stay separate', () => {
  assert.equal(Object.keys(operations).length, 207);
  assert.equal(snapshot.excluded.length, 37);
  for (const op of Object.values(operations)) {
    assert.ok(resourceFor(op) || managedOperations.has(op.key), op.key);
    assert.ok(!op.path.startsWith('/api/v1/pi/'));
    if (!op.public && !managedOperations.has(op.key)) assert.ok(op.roles.length, op.key);
  }
  for (const r of resources) assert.ok(operations[`GET ${r.root}`], r.id);
});
test('request builder encodes paths, whitelists filters and requires idempotency', () => {
  assert.throws(() => buildRequest('POST /api/v1/navigation-requests'), /chống gửi trùng/);
  const request = buildRequest('GET /api/v1/jobs/{id}', { path: { id: 'a/b' }, query: { unknown: 'ignored' } });
  assert.equal(request.url, '/api/v1/jobs/a%2Fb');
  assert.throws(() => buildRequest('GET /api/v1/jobs/{id}'), /Chưa chọn/);
  assert.equal(buildRequest('POST /api/v1/navigation-requests', { idempotencyKey: 'retry-1' }).headers['Idempotency-Key'], 'retry-1');
  assert.equal(buildRequest('GET /api/v1/public/floors').skipAuth, true);
});
test('role boundaries match backend, not UI assumptions', () => {
  assert.equal(canUse(operations['POST /api/v1/admin/staff'], 'STAFF'), false);
  assert.equal(canUse(operations['POST /api/v1/admin/staff'], 'ADMIN'), true);
  assert.equal(canUse(operations['GET /api/v1/staff/me'], 'ADMIN'), false);
  assert.equal(canUse(operations['GET /api/v1/workflows/published'], 'STAFF'), true);
  assert.equal(canUse(operations['GET /api/v1/jobs'], null), false);
});
test('ambiguous Swagger Create/Update names are resolved per Java DTO', () => {
  const staff = prepareBody('POST /api/v1/admin/staff', { username: 'nurse.demo', temporaryPassword: 'test-only-123', fullName: 'Điều dưỡng A', email: 'nurse@example.test', staffCode: 'NV01', mapName: 'drop-this' });
  assert.equal(staff.staffCode, 'NV01'); assert.ok(!('mapName' in staff));
  assert.ok(requestSchema('PUT /api/v1/admin/staff/{id}').properties.email);
  assert.ok(requestSchema('POST /api/v1/admin/shifts').properties.slots);
  assert.ok(requestSchema('POST /api/v1/delivery-requests').properties.items);
  assert.ok(requestSchema('POST /api/v1/mapping-jobs').properties.workflowId);
  assert.throws(() => prepareBody('POST /api/v1/admin/system-settings', { settingKey: 'test.config', settingValue: {}, dataType: 'OBJECT', category: 'test' }), /không được để trống/);
});
test('navigation target is required and unrelated target is omitted', () => {
  const input = { mapId: id, navigationMode: 'STANDARD', targetMode: 'ENDPOINT_GROUP' };
  assert.throws(() => prepareBody('POST /api/v1/navigation-requests', input), /Chọn nhóm/);
  const value = prepareBody('POST /api/v1/navigation-requests', { ...input, destinationGroupId: id, destinationEndpointId: id, priority: '0' });
  assert.equal(value.priority, 0); assert.equal(value.destinationGroupId, id); assert.ok(!('destinationEndpointId' in value));
});
test('typed form values preserve false/zero and reject invalid values', () => {
  assert.equal(prepareValue(false, { type: 'boolean' }, true), false);
  assert.equal(prepareValue('0', { type: 'integer' }), 0);
  assert.throws(() => prepareValue('2.5', { type: 'integer' }), /không hợp lệ/);
  assert.throws(() => prepareValue('x', { type: 'string', format: 'uuid' }), /hợp lệ/);
  assert.throws(() => prepareValue('{', { type: 'object' }), /JSON/);
  assert.throws(() => prepareValue(false, { type: 'boolean', const: true }, true), /xác nhận/);
  assert.equal(prepareValue('2026-10-19T08:00:00+07:00', { type: 'string', format: 'date-time' }), '2026-10-19T01:00:00.000Z');
  assert.equal(initialValue(requestSchema('POST /api/v1/delivery-requests')).requiresConfirmation, false);
});
