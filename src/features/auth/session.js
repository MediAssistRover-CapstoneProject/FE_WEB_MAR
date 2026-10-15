const SESSION_KEY = 'mediassist-rover.session';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    clearSession();
    return null;
  }
}

export function createSession({ account = null, tokens }) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ account, tokens }));
}

export function createDemoSession(account) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mode: 'demo', account }));
}

export function isDemoSession() {
  return getSession()?.mode === 'demo';
}

export function updateTokens(tokens) {
  const session = getSession();
  if (session) createSession({ account: session.account, tokens: { ...session.tokens, ...tokens } });
}

export function updateCurrentUser(account) {
  const session = getSession();
  if (session) createSession({ account, tokens: session.tokens });
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  const session = getSession();
  return session?.mode === 'demo' || Boolean(session?.tokens?.accessToken);
}

export function getRefreshToken() {
  return getSession()?.tokens?.refreshToken ?? null;
}
