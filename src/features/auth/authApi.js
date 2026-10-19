import { apiRequest } from '../api/client.js';

export function login(credentials) {
  return apiRequest('/api/v1/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: { username: credentials.username, password: credentials.password, deviceInfo: navigator.userAgent },
  });
}

export function getCurrentUser() {
  return apiRequest('/api/v1/auth/me');
}

export function logout(refreshToken) {
  return apiRequest('/api/v1/auth/logout', { method: 'POST', skipAuth: true, body: { refreshToken } });
}

export function changePassword(body) {
  return apiRequest('/api/v1/auth/change-password', { method: 'PUT', body });
}
