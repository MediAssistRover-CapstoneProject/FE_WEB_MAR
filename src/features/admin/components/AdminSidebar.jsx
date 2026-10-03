import { useNavigate } from 'react-router-dom';
import { navigationGroups } from '../navigation.js';

export default function AdminSidebar({ active, onSelect, onLogout }) {
  const navigate = useNavigate();

  return <aside className="sidebar"><div className="brand">MediAssistRover<span>ADMIN CONTROL CENTER</span></div><nav>{navigationGroups.map(([group, items]) => <section key={group}><h3>{group}</h3>{items.map((item) => <button className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => item === 'Workflows' ? navigate('/workflows') : onSelect(item)} key={item}>{item}</button>)}</section>)}</nav><div className="sidebar-footer"><span>1 Robot Managed</span><b>MAR-01 <i /> Online</b><button className="logout-button" type="button" onClick={onLogout}><i>↪</i> Log out</button></div></aside>;
}
