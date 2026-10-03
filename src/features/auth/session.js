const SESSION_KEY = 'mediassist-rover.session';

// This is only a client-side route gate until the API supplies a real session.
export function createSession() {
  sessionStorage.setItem(SESSION_KEY, 'active');
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  return sessionStorage.getItem(SESSION_KEY) === 'active';
}
