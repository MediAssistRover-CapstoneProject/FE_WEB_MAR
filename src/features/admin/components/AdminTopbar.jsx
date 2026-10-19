import { vi } from '../../../i18n/vi.js';
import { getSession } from '../../auth/session.js';
export default function AdminTopbar({ title }) {
  const account = getSession()?.account;
  return <header className="topbar"><h1>{vi(title)}</h1><div className="topbar-actions"><span>{vi(account?.fullName || account?.username)}</span><span>{account?.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</span></div></header>;
}
