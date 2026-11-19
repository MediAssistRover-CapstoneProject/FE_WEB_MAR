import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getIncident, actOnIncident, getIncidentLocation, getIncidentResponseRoute, getIncidentMediaSession, getIncidentRouting, retryIncidentRouting } from '../src/features/operations/emergencyApi.js';

const storage = new Map();
globalThis.localStorage = globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
storage.set('mediassist-rover.session', JSON.stringify({ account: { accountId: 'actor', role: 'ADMIN' }, tokens: { accessToken: 'fixture-only' } }));
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('routing preview is read-only and retry sends the incident version to the exact incident', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ path: new URL(url).pathname, ...options });
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  };
  const signal = new AbortController().signal;
  await getIncidentRouting('specific-id', signal);
  await retryIncidentRouting('specific-id', 7, signal);
  assert.equal(calls[0].path, '/api/v1/emergency-incidents/specific-id/routing');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[1].path, '/api/v1/emergency-incidents/specific-id/retry-routing');
  assert.equal(calls[1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].body), { rowVersion: 7 });
  assert.equal(calls.every(call => call.signal === signal), true);
});

test('incident lifecycle uses authenticated BE endpoints, optional note body and cancellable reads', async () => {
  const calls = [], signal = new AbortController().signal;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), ...options });
    assert.equal(options.headers.get('Authorization'), 'Bearer fixture-only');
    return new Response(JSON.stringify({ incidentId: 'incident' }), { headers: { 'Content-Type': 'application/json' } });
  };
  await getIncident('incident', signal);
  for (const action of ['acknowledge', 'start', 'confirm', 'resolve', 'close', 'false-alarm']) await actOnIncident('incident', action, { note: '  Kết quả thực tế  ', signal });
  await getIncidentLocation('incident', signal); await getIncidentResponseRoute('incident', signal); await getIncidentMediaSession('session', signal);
  assert.equal(calls[0].url.pathname, '/api/v1/emergency-incidents/incident');
  assert.equal(calls.every(call => call.signal === signal), true);
  for (const call of calls.filter(call => call.method === 'POST')) {
    const action = call.url.pathname.split('/').at(-1);
    assert.deepEqual(call.body && JSON.parse(call.body), ['resolve', 'false-alarm'].includes(action) ? { resolutionNote: 'Kết quả thực tế' } : undefined);
  }
  assert.deepEqual(calls.slice(-3).map(call => call.url.pathname), ['/api/v1/emergency-incidents/incident/location', '/api/v1/emergency-incidents/incident/response-route', '/api/v1/media-sessions/session']);
  assert.throws(() => actOnIncident('incident', 'invalid'), /không hợp lệ/);
});
