import { useCallback, useEffect, useState } from 'react';
import './UsersRoles.css';
import { adminApi } from '../../features/admin/adminApi.js';

const roleCopy = { ADMIN: ['Administrator', 'Full workspace access'], STAFF: ['Staff', 'Operate assigned workspace functions'] };
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';

export default function UsersRoles() {
  const [members, setMembers] = useState([]); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { const page = await adminApi.listStaff({ size: 100 }); setMembers(page.content ?? []); setNotice(''); } catch (error) { setNotice(error.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const toggleLock = async (member) => { try { const account = member.account; await (account.status === 'LOCKED' ? adminApi.unlockAccount(account.accountId) : adminApi.lockAccount(account.accountId)); await load(); setNotice(`${account.username} updated.`); } catch (error) { setNotice(error.message); } };
  return <section className="users-roles"><div className="users-main"><header><b>Staff accounts</b><button onClick={load}>Refresh</button></header><table><thead><tr>{['User','Role','Status','Last Login','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{members.map((member) => { const account = member.account; const active = member.active && account.status === 'ACTIVE'; return <tr key={member.staffProfileId}><td><b>{account.fullName}</b><br />{account.email}</td><td>{roleCopy[account.role]?.[0] ?? account.role}</td><td className={active ? 'member-active' : ''}>{active ? 'Active' : account.status}</td><td>{formatDate(account.lastLoginAt)}</td><td><button className="member-edit" onClick={() => toggleLock(member)}>{account.status === 'LOCKED' ? 'Unlock' : 'Lock'}</button></td></tr>; })}</tbody></table>{loading && <p className="member-notice">Loading staff accounts…</p>}{!loading && members.length === 0 && <p className="member-notice">No staff accounts found.</p>}{notice && <p className="member-notice">{notice}</p>}</div><aside className="roles-panel"><b>Roles & permissions</b>{Object.values(roleCopy).map(([role, copy]) => <article key={role}><strong>{role}</strong><span>{copy}</span></article>)}</aside></section>;
}
