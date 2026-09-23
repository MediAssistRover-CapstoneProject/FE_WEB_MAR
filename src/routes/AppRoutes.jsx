import { Route, Routes, useNavigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout.jsx';
import LandingPage from '../pages/Landing/LandingPage.jsx';
import LoginPage from '../pages/Auth/LoginPage.jsx';
import RegisterPage from '../pages/Auth/RegisterPage.jsx';
import AdminApp from '../pages/Admin/AdminApp.jsx';
import WorkflowsPage from '../pages/Workflows/WorkflowsPage.jsx';

function LandingRoute() {
  const navigate = useNavigate();
  return <LandingPage onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />;
}

export default function AppRoutes() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<LandingRoute />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/admin" element={<AdminApp onLanding={() => window.location.assign('/')} />} /><Route path="/workflows" element={<WorkflowsPage />} /></Route></Routes>;
}
