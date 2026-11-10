import { getSession } from '../../../features/auth/session.js';
import AlertsPage from './AlertsPage.jsx';
import AnalyticsPage from './AnalyticsPage.jsx';
import AuditPage from './AuditPage.jsx';
import HistoryPage from './HistoryPage.jsx';
import './monitoring.css';

export const monitoringSections = new Set(['Alerts', 'History & Replay', 'Analytics', 'Audit Logs']);
export default function MonitoringWorkspace({ section }) {
  const role = getSession()?.account?.role;
  if (!['ADMIN', 'STAFF'].includes(role) || section !== 'Alerts' && role !== 'ADMIN') return <p role="status">Tài khoản này không có quyền xem mục giám sát này.</p>;
  if (section === 'Alerts') return <AlertsPage />;
  if (section === 'Analytics') return <AnalyticsPage />;
  if (section === 'Audit Logs') return <AuditPage />;
  return <HistoryPage />;
}
