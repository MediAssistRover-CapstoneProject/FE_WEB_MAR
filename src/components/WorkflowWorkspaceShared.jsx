import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../features/admin/components/AdminSidebar.jsx';
import { pathForScreen } from '../features/admin/screenRoutes.js';
import { clearSession } from '../features/auth/session.js';
import { vi } from '../i18n/vi.js';
import './workflowWorkspaceShared.css';

export function Sidebar() {
  const navigate = useNavigate();
  return <AdminSidebar active="Workflows" onSelect={screen => navigate(pathForScreen(screen))} onLogout={() => { clearSession(); navigate('/'); }} />;
}
export function MarButton({ children, variant = 'primary', className = '', onClick, disabled = false }) {
  return <button className={`wf-button ${variant} ${className}`} type="button" onClick={onClick} disabled={disabled}>{vi(children)}</button>;
}
