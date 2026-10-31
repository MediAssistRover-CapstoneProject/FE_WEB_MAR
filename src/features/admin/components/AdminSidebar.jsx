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

const iconPaths = {
  Overview: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  Operations: <><path d="M3 12h4l3-7 4 14 3-7h4"/></>,
  'Map & Navigation': <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16M15 5v16"/></>,
  Robot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M2 11v5M22 11v5M8 16h8"/><path d="M8 11h.01M16 11h.01" strokeWidth="3" strokeLinecap="round"/></>,
  Monitoring: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 11l3-3 3 3 4-4"/></>,
  Automation: <><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M6 9v7a2 2 0 0 0 2 2h7M9 6h7a2 2 0 0 1 2 2v7"/></>,
  Administration: <><path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></>,
  account: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
  logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M9 12h12m-4-4 4 4-4 4"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
};

function SidebarIcon({ name, className = '' }) {
  return <svg className={'sidebar-icon '+className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{iconPaths[name]}</svg>;
}

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
  useEffect(() => {
    if (!mobileOpen) return;
    const close = event => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobileOpen]);

  const select = item => {
    setMobileOpen(false);
    if (item === 'Workflows') navigate(role === 'ADMIN' ? '/workflow' : pathForScreen('Workflow Management'));
    else onSelect(item);
  };

  return <>
    <button type="button" className="sidebar-mobile-toggle" aria-label="Mở menu" aria-controls="admin-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><SidebarIcon name="menu"/></button>
    {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}
    <aside id="admin-navigation" className={`sidebar mediassist-sidebar${mobileOpen ? ' is-open' : ''}`}>
      <div className="brand"><div className="sidebar-brand-mark"><SidebarIcon name="Robot"/></div><div className="sidebar-brand-copy"><strong>{vi('MediAssistRover')}</strong><span>{vi('ADMIN CONTROL CENTER')}</span></div>
        <button type="button" className="sidebar-mobile-close" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}><SidebarIcon name="close"/></button>
      </div>
      <div className="sidebar-nav-caption">Điều hướng</div>
      <nav aria-label="Điều hướng quản trị">{groups.map(([group, items], index) => {
        const open = expanded === group;
        const current = items.includes(active);
        const panelId = `sidebar-group-${index}`;
        return <section key={group} className={current ? 'current-group' : ''}>
          <h3><button type="button" className="sidebar-group-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setExpanded(open ? null : group)}>
            <SidebarIcon name={group}/><span className="sidebar-group-label">{vi(group)}</span><span className="sidebar-chevron" aria-hidden="true" />
          </button></h3>
          {open && <div id={panelId} className="sidebar-group-items">{items.map(item => <button type="button" key={item} className={active === item ? 'nav-item active' : 'nav-item'} aria-current={active === item ? 'page' : undefined} onClick={() => select(item)}>{menuLabels[item] || screenTitles[item] || vi(item)}</button>)}</div>}
        </section>;
      })}</nav>
      <div className="sidebar-footer">
        <button type="button" className={active === 'My Account' ? 'sidebar-account active' : 'sidebar-account'} aria-label="Tài khoản của tôi" aria-current={active === 'My Account' ? 'page' : undefined} onClick={() => select('My Account')}><span className="sidebar-account-icon"><SidebarIcon name="account"/></span><span className="sidebar-account-copy"><strong>Tài khoản của tôi</strong><small>{role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</small></span><span className="sidebar-account-arrow" aria-hidden="true">›</span></button>
        <button className="logout-button" type="button" onClick={onLogout}><SidebarIcon name="logout"/>{vi('Log out')}</button>
      </div>
    </aside>
  </>;
}
