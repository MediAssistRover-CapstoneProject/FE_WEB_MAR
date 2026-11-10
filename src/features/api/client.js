import { clearSession, getRefreshToken, getSession, updateTokens } from '../auth/session.js';

const API_TARGET_KEY = 'mediassist-rover.api-target';
const SESSION_KEY = 'mediassist-rover.session';
const ACCESS_TOKEN_KEY = 'mediassist-rover.access-token';

export const SERVER_API_URL = (import.meta.env?.VITE_SERVER_API_BASE_URL || 'https://mediassistrover.duckdns.org').trim().replace(/\/+$/, '');
export const LOCAL_API_URL = (import.meta.env?.DEV && import.meta.env?.VITE_DEV_PROXY_TARGET ? '' : (import.meta.env?.VITE_LOCAL_API_BASE_URL || 'http://localhost:8080')).trim().replace(/\/+$/, '');

export function getApiTarget() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(API_TARGET_KEY) : null;
    if (saved === 'local' || saved === 'server') return saved;
  } catch { /* ignore storage errors */ }
  const envUrl = (import.meta.env?.VITE_API_BASE_URL ?? '').trim();
  if (envUrl.includes('duckdns.org') || envUrl.includes('railway.app')) return 'server';
  return 'local';
}

export function setApiTarget(nextTarget) {
  const target = nextTarget === 'server' ? 'server' : 'local';
  const current = getApiTarget();
  if (target === current) return;
  try {
    const currentSession = localStorage.getItem(SESSION_KEY);
    if (currentSession) {
      localStorage.setItem(`${SESSION_KEY}.${current}`, currentSession);
    } else {
      localStorage.removeItem(`${SESSION_KEY}.${current}`);
    }
    localStorage.setItem(API_TARGET_KEY, target);
    const restored = localStorage.getItem(`${SESSION_KEY}.${target}`);
    if (restored) {
      localStorage.setItem(SESSION_KEY, restored);
      const parsed = JSON.parse(restored);
      if (parsed?.tokens?.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, parsed.tokens.accessToken);
      else localStorage.removeItem(ACCESS_TOKEN_KEY);
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch { /* ignore storage errors */ }
  if (typeof window !== 'undefined') {
    const hasRestored = Boolean(localStorage.getItem(SESSION_KEY));
    if (!hasRestored && window.location.pathname.startsWith('/admin')) {
      window.location.assign('/login');
    } else {
      window.location.reload();
    }
  }
}

// Local development uses the backend configured in Be/BE_MAR/.env.
// Deployments override this through VITE_API_BASE_URL or the Admin API switcher.
const API_BASE_URL = getApiTarget() === 'server' ? SERVER_API_URL : LOCAL_API_URL;
let refreshing = null;

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function errorMessage(body, fallback) {
  if (typeof body === 'string') return body;
  return body?.message || body?.error || body?.detail || fallback;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, deviceInfo: navigator.userAgent }),
  });
  const body = await parseBody(response);
  if (!response.ok && ![401, 403].includes(response.status)) throw new ApiError('Máy chủ chưa thể gia hạn phiên. Vui lòng thử lại.', response.status);
  if (!response.ok || !body?.accessToken) return false;
  // Do not revive a logged-out session or overwrite a different login.
  if (getRefreshToken() !== refreshToken) return false;
  updateTokens(body);
  return true;
}

export async function apiRequest(path, { method = 'GET', body, headers = {}, skipAuth = false, retry = true, signal, responseType = 'json', keepalive = false } = {}) {
  const session = getSession();
  if (session?.mode === 'demo' && !skipAuth) {
    if (method !== 'GET' || responseType !== 'json' || path.includes('/export.')) {
      throw new ApiError('Tài khoản này không thể thực hiện thao tác trên máy chủ.', 403);
    }
    if (path.startsWith('/api/v1/admin/reports/overview')) {
      return {
        robotsByStatus: {}, succeededJobs: 0, terminalJobs: 0,
        jobCompletionRatePercent: 0, openAlerts: 0, activeEmergencyIncidents: 0,
      };
    }
    if (path.includes('/workflows/step-types') || path === '/api/v1/workflows/published') return [];
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 };
  }
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Accept')) requestHeaders.set('Accept', responseType === 'json' ? 'application/json' : '*/*');
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  if (multipart) requestHeaders.delete('Content-Type');
  else if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  if (!skipAuth && session?.tokens?.accessToken) requestHeaders.set('Authorization', `Bearer ${session.tokens.accessToken}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      signal,
      keepalive,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the MediAssistRover API. Check VITE_API_BASE_URL and the backend service.', 0);
  }

  const protectedResource = !path.startsWith('/api/v1/auth/') || path.split('?')[0] === '/api/v1/auth/me';
  if (response.status === 401 && !skipAuth && retry && protectedResource) {
    const latestToken = getSession()?.tokens?.accessToken;
    if (latestToken && latestToken !== session?.tokens?.accessToken) return apiRequest(path, { method, body, headers, skipAuth, retry: false, signal, responseType, keepalive });
    if (!refreshing) refreshing = refreshAccessToken().catch(() => { throw new ApiError('Không thể gia hạn phiên. Kiểm tra kết nối rồi thử lại.', 0); }).finally(() => { refreshing = null; });
    if (await refreshing) return apiRequest(path, { method, body, headers, skipAuth, retry: false, signal, responseType, keepalive });
  }
  if (response.status === 401 && !skipAuth && protectedResource && getSession()?.tokens?.accessToken === session?.tokens?.accessToken) {
    clearSession();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('mediassist-session-expired'));
  }
  if (response.ok && responseType === 'response') return response;
  if (response.ok && responseType === 'blob') return response.blob();
  const responseBody = await parseBody(response);
  if (!response.ok) throw new ApiError(errorMessage(responseBody, `Request failed (${response.status})`), response.status, responseBody);
  return responseBody;
}

export { API_BASE_URL };
