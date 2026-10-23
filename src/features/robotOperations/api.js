import { apiRequest, API_BASE_URL } from '../api/client.js';
import { getSession } from '../auth/session.js';
import { eligibleWorkflows } from './model.js';

export const request = (path, options = {}) => apiRequest(path, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
export const post = (path, body, options = {}) => request(path, { method: 'POST', body, ...options });
export const jobPath = id => `/api/v1/jobs/${encodeURIComponent(id)}`;
export async function allRows(path, signal) {
  const rows = [];
  for (let page = 0; page < 1000; page++) {
    const data = await request(`${path}?page=${page}&size=100`, { signal });
    if (Array.isArray(data)) return data;
    if (!Array.isArray(data?.content)) throw Error('Danh mục không đúng định dạng.');
    rows.push(...data.content);
    if (data.last || page + 1 >= data.totalPages || data.content.length < 100) return rows;
  }
  throw Error('Danh mục quá lớn.');
}
export async function loadCatalog(type, signal) {
  const [robots, details, floors] = await Promise.all([
    allRows('/api/v1/robots', signal),
    request('/api/v1/admin/workflows/published/all', { signal }),
    type === 'MAPPING' ? allRows('/api/v1/floors', signal) : [],
  ]);
  if (!Array.isArray(details)) throw Error('Danh sách quy trình không đúng định dạng.');
  return { robots, workflows: eligibleWorkflows(details, type), floors: floors.filter(f => f.active) };
}
export function trackingKey(type) {
  const account = getSession()?.account;
  return `mediassist.live.${type}.${API_BASE_URL}.${account?.accountId || account?.username || ''}`;
}
export function readTracking(type) {
  try { return JSON.parse(sessionStorage.getItem(trackingKey(type)) || 'null'); } catch { return null; }
}
export function writeTracking(type, value) {
  try { sessionStorage.setItem(trackingKey(type), JSON.stringify(value)); } catch { /* Tracking is optional; no credentials stored here. */ }
}
