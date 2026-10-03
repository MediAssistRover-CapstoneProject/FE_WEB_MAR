import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout.jsx';
import LandingPage from '../pages/Landing/LandingPage.jsx';
import LoginPage from '../pages/Auth/LoginPage.jsx';
import RegisterPage from '../pages/Auth/RegisterPage.jsx';
import AdminApp from '../pages/Admin/AdminApp.jsx';
import WorkflowsPage from '../pages/Workflows/WorkflowsPage.jsx';
import WorkstationsPage from '../pages/Workstations/WorkstationsPage.jsx';
import { hasSession } from '../features/auth/session.js';

function LandingRoute() {
  const navigate = useNavigate();
  return <LandingPage onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />;
}

function ProtectedRoute({ children }) {
  return hasSession() ? children : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<LandingRoute />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/admin" element={<ProtectedRoute><AdminApp onLanding={() => window.location.assign('/')} /></ProtectedRoute>} /><Route path="/workflows" element={<ProtectedRoute><WorkflowsPage /></ProtectedRoute>} /><Route path="/workstations" element={<ProtectedRoute><WorkstationsPage /></ProtectedRoute>} /></Route></Routes>;
}
