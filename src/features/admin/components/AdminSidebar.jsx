import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vi } from '../../../i18n/vi.js';
import { navigationGroups } from '../navigation.js';
import { getSession } from '../../auth/session.js';
import { screenTitles } from '../../api/workspaceCatalog.js';
import { pathForScreen } from '../screenRoutes.js';
import './AdminSidebar.css';

const adminOnly = new Set(['Users & Roles', 'System Settings', 'Audit Logs', 'Analytics', 'Crowd Heatmap', 'History & Replay']);
const menuLabels = {
  Workflows: 'Thiết kế quy trình',
  'Workflow Management': 'Danh mục quy trình',
};

export default function AdminSidebar({ active, onSelect, onLogout }) {
  const navigate = useNavigate();
  const role = getSession()?.account?.role;
  const groups = navigationGroups
    .map(([group, items]) => [group, items.filter(item => item !== 'My Account' && (role === 'ADMIN' || !adminOnly.has(item)))])
    .filter(([, items]) => items.length);
  const activeGroup = active === 'My Account' ? null : groups.find(([, items]) => items.includes(active))?.[0] ?? groups[0]?.[0];
  const [expanded, setExpanded] = useState(activeGroup);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setExpanded(activeGroup); setMobileOpen(false); }, [activeGroup]);

  const select = item => {
    setMobileOpen(false);
    if (item === 'Workflows') navigate(role === 'ADMIN' ? '/workflow' : pathForScreen('Workflow Management'));
    else onSelect(item);
  };

  return <>
    <button type="button" className="sidebar-mobile-toggle" aria-label="Mở menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>☰</button>
    {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar mediassist-sidebar${mobileOpen ? ' is-open' : ''}`}>
      <div className="brand">{vi('MediAssistRover')}<span>{vi('ADMIN CONTROL CENTER')}</span>
        <button type="button" className="sidebar-mobile-close" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}>×</button>
      </div>
      <nav aria-label="Điều hướng quản trị">{groups.map(([group, items], index) => {
        const open = expanded === group;
        const current = items.includes(active);
        const panelId = `sidebar-group-${index}`;
        return <section key={group} className={current ? 'current-group' : ''}>
          <h3><button type="button" className="sidebar-group-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setExpanded(open ? null : group)}>
            <span>{vi(group)}</span><span className="sidebar-chevron" aria-hidden="true" />
          </button></h3>
          {open && <div id={panelId} className="sidebar-group-items">{items.map(item => <button type="button" key={item} className={active === item ? 'nav-item active' : 'nav-item'} aria-current={active === item ? 'page' : undefined} onClick={() => select(item)}>{menuLabels[item] || screenTitles[item] || vi(item)}</button>)}</div>}
        </section>;
      })}</nav>
      <div className="sidebar-footer">
        <button type="button" className={active === 'My Account' ? 'sidebar-account active' : 'sidebar-account'} aria-current={active === 'My Account' ? 'page' : undefined} onClick={() => select('My Account')}>Tài khoản của tôi</button>
        <button className="logout-button" type="button" onClick={onLogout}>{vi('Log out')}</button>
      </div>
    </aside>
  </>;
}
