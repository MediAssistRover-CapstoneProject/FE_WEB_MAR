import { apiRequest, API_BASE_URL } from '../api/client.js';
import { getSession } from '../auth/session.js';
import { RobotCameraConnection } from './robotCamera.js';

export const ROBOT_CAMERA_URL_KEY = 'mar.robotCameraUrl';
const connections = new Map(), closing = new Map();
const request = (path, options = {}) => apiRequest(path, { ...options,
  signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });

// Share a viewer between panels. A short grace period also avoids creating and
// ending two sessions during React StrictMode's setup/cleanup/setup cycle.
export function acquireRobotCamera(robotId, account, listener) {
  const key = JSON.stringify([API_BASE_URL, account.accountId, robotId]);
  let entry = connections.get(key);
  if (!entry) {
    const actorRequest = (path, options) => {
      if (getSession()?.account?.accountId !== account.accountId) return Promise.reject(Object.assign(Error('Account changed'), { status: 403 }));
      return request(path, options);
    };
    const connection = new RobotCameraConnection({ robotId, account, request: actorRequest, loadSdk: () => import('livekit-client') });
    entry = { connection, count: 0, timer: null }; connections.set(key, entry);
    const before = closing.get(key) || Promise.resolve();
    before.finally(() => { if (connections.get(key) === entry) connection.start(); });
  }
  clearTimeout(entry.timer); entry.count++;
  const unsubscribe = entry.connection.subscribe(listener);
  return { retry: () => entry.connection.retry(), release: () => {
    unsubscribe(); entry.count--;
    if (!entry.count) entry.timer = setTimeout(() => {
      if (entry.count || connections.get(key) !== entry) return;
      connections.delete(key);
      const done = entry.connection.stop(); closing.set(key, done);
      done.finally(() => { if (closing.get(key) === done) closing.delete(key); });
    }, 300);
  } };
}

if (typeof window !== 'undefined') {
  const stop = () => {
    for (const [key, entry] of connections) {
      clearTimeout(entry.timer); connections.delete(key);
      const done = entry.connection.stop({ keepalive: true }); closing.set(key, done);
      done.finally(() => { if (closing.get(key) === done) closing.delete(key); });
    }
  };
  window.addEventListener('pagehide', stop);
  window.addEventListener('mediassist-session-expired', stop);
}

export function configuredCameraUrl() {
  try {
    const saved = localStorage.getItem(ROBOT_CAMERA_URL_KEY) || import.meta.env.VITE_ROBOT_CAMERA_URL || '';
    const url = new URL(saved);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      && !(location.protocol === 'https:' && url.protocol !== 'https:') ? url.href : '';
  } catch { return ''; }
}
