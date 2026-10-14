import { vi } from '../../../i18n/vi.js';
import { useNavigate } from 'react-router-dom';
import { navigationGroups } from '../navigation.js';

export default function AdminSidebar({ active, onSelect, onLogout }) {
  const navigate = useNavigate();

  return <aside className="sidebar"><div className="brand">{vi("MediAssistRover")}<span>{vi("ADMIN CONTROL CENTER")}</span></div><nav>{vi(navigationGroups.map(([group, items]) => <section key={group}><h3>{vi(group)}</h3>{vi(items.map((item) => <button className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => item === 'Workflows' ? navigate('/workflows') : onSelect(item)} key={item}>{vi(item)}</button>))}</section>))}</nav><div className="sidebar-footer"><span>{vi("1 Robot Managed")}</span><b>{vi("MAR-01 ")}<i />{vi(" Online")}</b><button className="logout-button" type="button" onClick={onLogout}>{vi("Log out")}</button></div></aside>;
}
