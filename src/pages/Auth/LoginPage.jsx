import { useNavigate } from 'react-router-dom';
import AuthFlows from './AuthFlows.jsx';
import { createDemoSession, createSession, updateCurrentUser } from '../../features/auth/session.js';
import { getCurrentUser, login as loginWithApi } from '../../features/auth/authApi.js';
import { DEMO_USERNAME, loginWithMockApi } from '../../features/auth/mockAuthApi.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = async (credentials) => {
    if (credentials.username.toLowerCase() === DEMO_USERNAME) {
      createDemoSession(loginWithMockApi(credentials));
      navigate('/admin');
      return;
    }
    const tokens = await loginWithApi(credentials);
    createSession({ tokens });
    try {
      updateCurrentUser(await getCurrentUser());
    } catch {
      // A valid token is sufficient to enter the workspace; the next request retries with refresh.
    }
    navigate('/admin');
  };

  return <AuthFlows onHome={() => navigate('/')} onAuthenticated={login} />;
}
