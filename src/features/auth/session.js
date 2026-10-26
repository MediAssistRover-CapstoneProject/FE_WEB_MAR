const SESSION_KEY = 'mediassist-rover.session';
const ACCESS_TOKEN_KEY = 'mediassist-rover.access-token';

function read(storage) {
  try {
    return JSON.parse(storage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function persist(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session?.tokens?.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, session.tokens.accessToken);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getSession() {
  const saved = read(localStorage);
  if (saved) return saved;

  // Migrate sessions created before persistent local authentication was introduced.
  const legacy = read(sessionStorage);
  if (!legacy) return null;
  try { persist(legacy); sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be unavailable. */ }
  return legacy;
}

export function createSession({ account = null, tokens }) {
  persist({ account, tokens });
}

export function createDemoSession(account) {
  persist({ mode: 'demo', account });
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
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  const session = getSession();
  return session?.mode === 'demo' || Boolean(session?.tokens?.accessToken);
}

export function getRefreshToken() {
  return getSession()?.tokens?.refreshToken ?? null;
}
