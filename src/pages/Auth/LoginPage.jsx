import { useNavigate } from 'react-router-dom';
import AuthFlows from './AuthFlows.jsx';
import { createSession, updateCurrentUser } from '../../features/auth/session.js';
import { getCurrentUser, login as loginWithApi } from '../../features/auth/authApi.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = async (credentials) => {
    const tokens = await loginWithApi(credentials);
    createSession({ tokens });
    try {
      updateCurrentUser(await getCurrentUser());
    } catch {
      // A valid token is sufficient to enter the workspace; the next request retries with refresh.
    }
    navigate('/admin');
  };

  return <AuthFlows initial="Login" onHome={() => navigate('/')} onAuthenticated={login} />;
}
