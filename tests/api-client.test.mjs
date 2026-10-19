import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from '../src/features/api/client.js';
import { createSession, clearSession, getSession } from '../src/features/auth/session.js';
const storage = new Map();
globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (k, v) => storage.set(k, v), removeItem: key => storage.delete(key) };
globalThis.window = new EventTarget();
const originalFetch = globalThis.fetch;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => createSession({ account: { role: 'ADMIN' }, tokens: { accessToken: 'old', refreshToken: 'refresh-old' } }));
afterEach(() => { globalThis.fetch = originalFetch; clearSession(); });
test('parallel 401 responses refresh once, retry once, keep idempotency header', async () => {
  let refreshes = 0; const calls = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise(r => setTimeout(r, 20)); return json({ accessToken: 'new', refreshToken: 'refresh-new' }); }
    calls.push(options);
    return options.headers.Authorization === 'Bearer old' ? json({}, 401) : json({ ok: true });
  };
  const result = await Promise.all([apiRequest('/api/v1/jobs'), apiRequest('/api/v1/navigation-requests', { method: 'POST', body: { test: true }, headers: { 'Idempotency-Key': 'same-key' } })]);
  assert.equal(refreshes, 1); assert.equal(calls.length, 4);
  assert.ok(result.every(r => r.ok));
  assert.equal(calls.findLast(r => r.method === 'POST').headers['Idempotency-Key'], 'same-key');
});
test('auth/me refreshes; wrong login and wrong current password do not end another session', async () => {
  let refreshes = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return json({ accessToken: 'new' }); }
    if (url.endsWith('/auth/me') && options.headers.Authorization === 'Bearer new') return json({ role: 'ADMIN' });
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
