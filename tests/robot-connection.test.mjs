import assert from 'node:assert/strict';
import test from 'node:test';
import { robotConnection } from '../src/features/operations/robotConnection.js';

const receivedAt = 100000;
const snapshot = { mqttConnected: true, heartbeatFresh: true, heartbeatAgeSeconds: 2 };
const state = (elapsed, changes = {}) => robotConnection({ snapshot, receivedAt, now: receivedAt + elapsed, ...changes });

test('a temporary UI error or a 5-second gap does not override a valid heartbeat lease', () => {
  assert.equal(state(0).connected, true);
  assert.equal(state(5500, { error: 'Snapshot timed out' }).connected, true);
  assert.equal(state(12999).connected, true);
});

test('the display expires at the backend heartbeat deadline, including age already reported by the server', () => {
  assert.equal(state(13000).phase, 'syncing');
  assert.equal(state(14000).label, 'Đang kiểm tra kết nối');
  assert.equal(state(1001, { snapshot: { ...snapshot, heartbeatAgeSeconds: 14 } }).connected, false);
});

test('a newly confirmed offline MQTT session or expired heartbeat is shown immediately', () => {
  assert.equal(state(0, { snapshot: { ...snapshot, mqttConnected: false } }).phase, 'disconnected');
  assert.equal(state(0, { snapshot: { ...snapshot, heartbeatFresh: false } }).phase, 'disconnected');
  assert.equal(state(0, { snapshot: { ...snapshot, mqttConnected: false, sessionFailureReason: 'SESSION_CLOSED' } }).detail, 'SESSION_CLOSED');
});

test('UI transport loss means synchronization is unknown instead of claiming robot MQTT disconnected', () => {
  assert.equal(state(15000).phase, 'syncing');
  assert.equal(state(20000, { snapshot: { ...snapshot, mqttConnected: false } }).phase, 'syncing');
  assert.equal(state(20000).connected, false);
});

test('waits for the first observation and cannot stay online after a browser clock reversal', () => {
  assert.equal(state(0, { snapshot: null }).phase, 'waiting');
  assert.equal(state(-1000).phase, 'syncing');
  assert.equal(state(0, { now: NaN }).phase, 'syncing');
});

test('a browser/server clock difference does not change a received connection observation', () => {
  assert.equal(state(1000, { snapshot: { ...snapshot, observedAt: '2000-01-01T00:00:00Z' } }).connected, true);
});

test('older backend payloads without heartbeat age still have a bounded display lease', () => {
  const withoutAge = { mqttConnected: true, heartbeatFresh: true };
  assert.equal(state(14999, { snapshot: withoutAge }).connected, true);
  assert.equal(state(15000, { snapshot: withoutAge }).connected, false);
  assert.equal(state(0, { snapshot: { ...snapshot, heartbeatAgeSeconds: NaN } }).connected, false);
});
