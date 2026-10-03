import { useNavigate } from 'react-router-dom';
import AuthFlows from './AuthFlows.jsx';
import { createSession } from '../../features/auth/session.js';

export default function LoginPage() {
  const navigate = useNavigate();
  return <AuthFlows initial="Login" onHome={() => navigate('/')} onAuthenticated={() => { createSession(); navigate('/admin'); }} />;
}
