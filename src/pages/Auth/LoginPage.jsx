import { useNavigate } from 'react-router-dom';
import AuthFlows from './AuthFlows.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  return <AuthFlows initial="Login" onHome={() => navigate('/')} onAuthenticated={() => navigate('/admin')} />;
}
