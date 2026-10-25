import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout.jsx';
import LandingPage from '../pages/Landing/LandingPage.jsx';
import LoginPage from '../pages/Auth/LoginPage.jsx';
import RegisterPage from '../pages/Auth/RegisterPage.jsx';
import ChangePasswordPage from '../pages/Auth/ChangePasswordPage.jsx';
import AdminApp from '../pages/Admin/AdminApp.jsx';
import WorkflowsPage from '../pages/Workflows/WorkflowsPage.jsx';
import WorkstationsPage from '../pages/Workstations/WorkstationsPage.jsx';
import { useEffect, useState } from 'react';
import { getSession, hasSession } from '../features/auth/session.js';

function LandingRoute() {
  const navigate = useNavigate();
  return <LandingPage onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />;
}

function ProtectedRoute({ children, adminOnly = false, allowPasswordChange = false }) {
  const [authenticated, setAuthenticated] = useState(hasSession);
  useEffect(() => {
    const expired = () => setAuthenticated(false);
    window.addEventListener('mediassist-session-expired', expired);
    return () => window.removeEventListener('mediassist-session-expired', expired);
  }, []);
  if (!authenticated || !hasSession()) return <Navigate to="/login" replace />;
  if (getSession()?.tokens?.mustChangePassword && !allowPasswordChange) return <Navigate to="/change-password" replace />;
  if (adminOnly && getSession()?.account?.role !== 'ADMIN') return <Navigate to="/admin/workflow-catalog" replace />;
  return children;
}

export default function AppRoutes() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<LandingRoute />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/change-password" element={<ProtectedRoute allowPasswordChange><ChangePasswordPage /></ProtectedRoute>} /><Route path="/admin" element={<ProtectedRoute><AdminApp onLanding={() => window.location.assign('/')} /></ProtectedRoute>} /><Route path="/admin/:screenSlug" element={<ProtectedRoute><AdminApp onLanding={() => window.location.assign('/')} /></ProtectedRoute>} /><Route path="/workflow" element={<ProtectedRoute adminOnly><WorkflowsPage /></ProtectedRoute>} /><Route path="/workflows" element={<Navigate to="/workflow" replace />} /><Route path="/workstations" element={<ProtectedRoute><WorkstationsPage /></ProtectedRoute>} /></Route></Routes>;
}
