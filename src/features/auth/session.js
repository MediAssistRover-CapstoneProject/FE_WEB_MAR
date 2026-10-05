const SESSION_KEY = 'mediassist-rover.session';

// This is only a client-side route gate until the API supplies a real session.
export function createSession(account) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(account));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  return Boolean(sessionStorage.getItem(SESSION_KEY));
}
