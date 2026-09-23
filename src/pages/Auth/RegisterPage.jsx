import { useNavigate } from 'react-router-dom';
import AuthFlows from './AuthFlows.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  return <AuthFlows initial="Register" onHome={() => navigate('/')} />;
}
