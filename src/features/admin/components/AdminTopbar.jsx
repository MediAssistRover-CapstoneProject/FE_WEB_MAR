import { vi } from '../../../i18n/vi.js';
export default function AdminTopbar({ title }) {
  return <header className="topbar"><h1>{vi(title)}</h1><div className="topbar-actions"><span className="online">{vi("MAR-01 &nbsp;•&nbsp; Online")}</span><span>{vi("72% Battery")}</span></div></header>;
}
