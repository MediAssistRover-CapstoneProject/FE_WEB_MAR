import { clearSession, getRefreshToken, getSession, updateTokens } from '../auth/session.js';

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? 'https://bemar-production.up.railway.app').trim().replace(/\/+$/, '');
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
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (!skipAuth && session?.tokens?.accessToken) requestHeaders.Authorization = `Bearer ${session.tokens.accessToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
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
