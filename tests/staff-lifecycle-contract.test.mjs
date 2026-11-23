import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, prepareBody, operations, canUse } from '../src/features/api/contract.js';
test('staff reads explicitly include deactivated profiles', () => {
  for (const key of ['GET /api/v1/admin/staff', 'GET /api/v1/admin/staff/{id}']) {
    assert.match(buildRequest(key, { path: { id: 'staff-id' }, query: { includeDeleted: true } }).url, /includeDeleted=true/);
  }
});
test('restore uses the admin lifecycle endpoint with a validated audit reason', () => {
  const key = 'POST /api/v1/admin/staff/{id}/restore';
  assert.equal(canUse(operations[key], 'ADMIN'), true);
  assert.equal(canUse(operations[key], 'STAFF'), false);
  assert.deepEqual(prepareBody(key, { reason: 'Trở lại làm việc' }), { reason: 'Trở lại làm việc' });
  assert.throws(() => prepareBody(key, { reason: 'abc' }));
  assert.equal(buildRequest(key, { path: { id: 'staff-id' }, body: { reason: 'Trở lại làm việc' } }).url, '/api/v1/admin/staff/staff-id/restore');
});
