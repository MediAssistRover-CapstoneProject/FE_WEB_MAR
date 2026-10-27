import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from '../src/features/api/client.js';
import { createSession, clearSession, getSession } from '../src/features/auth/session.js';
const storage = new Map();
globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (k, v) => storage.set(k, v), removeItem: key => storage.delete(key) };
globalThis.localStorage = globalThis.sessionStorage;
globalThis.window = new EventTarget();
const originalFetch = globalThis.fetch;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('raw and blob requests accept image responses instead of requiring JSON', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(new Headers(options.headers).get('accept'), '*/*');
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } });
  };
  const raw = await apiRequest('/api/v1/jobs/test/mapping-preview.png', { responseType: 'response' });
  assert.equal(raw.headers.get('content-type'), 'image/png');
  const blob = await apiRequest('/api/v1/maps/test/image', { responseType: 'blob' });
  assert.equal(blob.type, 'image/png');
});
beforeEach(() => createSession({ account: { role: 'ADMIN' }, tokens: { accessToken: 'old', refreshToken: 'refresh-old' } }));
afterEach(() => { globalThis.fetch = originalFetch; clearSession(); });
test('parallel 401 responses refresh once, retry once, keep idempotency header', async () => {
  let refreshes = 0; const calls = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise(r => setTimeout(r, 20)); return json({ accessToken: 'new', refreshToken: 'refresh-new' }); }
    calls.push(options);
    return new Headers(options.headers).get('Authorization') === 'Bearer old' ? json({}, 401) : json({ ok: true });
  };
  const result = await Promise.all([apiRequest('/api/v1/jobs'), apiRequest('/api/v1/navigation-requests', { method: 'POST', body: { test: true }, headers: { 'Idempotency-Key': 'same-key' } })]);
  assert.equal(refreshes, 1); assert.equal(calls.length, 4);
  assert.ok(result.every(r => r.ok));
  assert.equal(new Headers(calls.findLast(r => r.method === 'POST').headers).get('Idempotency-Key'), 'same-key');
});
test('auth/me refreshes; wrong login and wrong current password do not end another session', async () => {
  let refreshes = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return json({ accessToken: 'new' }); }
    if (url.endsWith('/auth/me') && new Headers(options.headers).get('Authorization') === 'Bearer new') return json({ role: 'ADMIN' });
    return json({ message: 'Sai thông tin xác thực' }, 401);
  };
  assert.equal((await apiRequest('/api/v1/auth/me')).role, 'ADMIN');
  await assert.rejects(apiRequest('/api/v1/auth/login', { method: 'POST', skipAuth: true }), /Sai thông tin/);
  await assert.rejects(apiRequest('/api/v1/auth/change-password', { method: 'PUT' }), /Sai thông tin/);
  assert.equal(refreshes, 1); assert.ok(getSession());
});
test('invalid refresh expires session; temporary refresh failure keeps it', async () => {
  let expired = 0; const listener = () => expired++;
  window.addEventListener('mediassist-session-expired', listener);
  try {
    globalThis.fetch = async () => json({}, 401);
    await assert.rejects(apiRequest('/api/v1/jobs'));
    assert.equal(expired, 1); assert.equal(getSession(), null);
    createSession({ tokens: { accessToken: 'old', refreshToken: 'refresh-old' } });
    globalThis.fetch = async url => json({}, url.endsWith('/auth/refresh') ? 503 : 401);
    await assert.rejects(apiRequest('/api/v1/jobs'));
    assert.ok(getSession()); assert.equal(expired, 1);
  } finally { window.removeEventListener('mediassist-session-expired', listener); }
});
test('no recursive retry, no refresh on 403, cancellation stays cancellation', async () => {
  let count = 0;
  globalThis.fetch = async url => { count++; return url.endsWith('/auth/refresh') ? json({ accessToken: 'new' }) : json({}, 401); };
  await assert.rejects(apiRequest('/api/v1/jobs')); assert.equal(count, 3);
  count = 0; globalThis.fetch = async () => { count++; return json({}, 403); };
  await assert.rejects(apiRequest('/api/v1/jobs')); assert.equal(count, 1);
  globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError'); };
  await assert.rejects(apiRequest('/api/v1/jobs'), { name: 'AbortError' });
});
test('refresh completion cannot revive a logged-out session', async () => {
  globalThis.fetch = async url => { if (url.endsWith('/auth/refresh')) { clearSession(); return json({ accessToken: 'new' }); } return json({}, 401); };
  await assert.rejects(apiRequest('/api/v1/jobs')); assert.equal(getSession(), null);
});

test('lowercase console headers produce exactly one JSON Content-Type', async () => {
  globalThis.fetch = async (url, options) => {
    const headers = new Headers(options.headers);
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('authorization'), 'Bearer old');
    assert.equal(headers.get('idempotency-key'), 'request-1');
    assert.equal(options.body, '{"mapName":"test"}');
    return json({ ok: true });
  };
  await apiRequest('/api/v1/mapping-jobs', { method: 'POST', body: { mapName: 'test' }, headers: { 'content-type': 'application/json', authorization: 'Bearer placeholder', 'idempotency-key': 'request-1' } });
});
