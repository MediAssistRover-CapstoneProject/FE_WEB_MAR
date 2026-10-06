import { clearSession, getRefreshToken, getSession, updateTokens } from '../auth/session.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');

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
  if (!response.ok || !body?.accessToken) {
    clearSession();
    return false;
  }
  updateTokens(body);
  return true;
}

export async function apiRequest(path, { method = 'GET', body, headers = {}, skipAuth = false, retry = true } = {}) {
  const session = getSession();
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (!skipAuth && session?.tokens?.accessToken) requestHeaders.Authorization = `Bearer ${session.tokens.accessToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the MediAssistRover API. Check VITE_API_BASE_URL and the backend service.', 0);
  }

  if (response.status === 401 && !skipAuth && retry && await refreshAccessToken()) {
    return apiRequest(path, { method, body, headers, skipAuth, retry: false });
  }

  const responseBody = await parseBody(response);
  if (!response.ok) throw new ApiError(errorMessage(responseBody, `Request failed (${response.status})`), response.status, responseBody);
  return responseBody;
}

export { API_BASE_URL };
