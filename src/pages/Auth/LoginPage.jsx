import { useNavigate } from 'react-router-dom';
import AuthFlows from './AuthFlows.jsx';
import { createSession } from '../../features/auth/session.js';
import { loginWithMockApi } from '../../features/auth/mockAuthApi.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = async (credentials) => {
    const account = await loginWithMockApi(credentials);
    createSession(account);
    navigate('/admin');
  };

  return <AuthFlows initial="Login" onHome={() => navigate('/')} onAuthenticated={login} />;
}
