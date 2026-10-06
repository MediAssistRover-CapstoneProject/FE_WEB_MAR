export default function AdminTopbar({ title, onChangePassword }) {
  return <header className="topbar"><h1>{title}</h1><div className="topbar-actions"><span className="online">MAR-01 &nbsp;•&nbsp; Online</span><span>72% Battery</span><button className="topbar-password" type="button" onClick={onChangePassword}>Change password</button></div></header>;
}
