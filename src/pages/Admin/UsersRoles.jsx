import { useEffect, useMemo, useRef, useState } from 'react';
import { getSession } from '../../features/auth/session.js';
import { callBackend, readCatalog } from '../../features/api/backendApi.js';
import { filterStaff, sortStaff, staffActions, staffDisplayName, staffError, staffStatus } from '../../features/admin/staffManagement.js';
import { StaffActionDialog, StaffForm } from './usersRoles/StaffDialogs.jsx';
import './usersRoles/usersRoles.css';

const PAGE_SIZE = 10;
const EMPTY_FILTERS = { search: '', department: '', status: '' };
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa ghi nhận';
const initials = value => String(value).trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toLocaleUpperCase('vi');
function Icon({ name = 'users' }) {
  const paths = {
    users: <><circle cx="9" cy="8" r="3" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 5a3 3 0 0 1 0 6m2 4a6 6 0 0 1 4 6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    inactive: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Badge({ member }) { const state = staffStatus(member); return <span className={`um-badge um-${state.tone}`}>{state.label}</span>; }

export default function UsersRoles() {
  const actor = getSession()?.account;
  if (actor?.role !== 'ADMIN') return <section className="um-page"><div className="um-empty"><Icon name="shield" /><h2>Chỉ quản trị viên được quản lý nhân viên</h2><p>Liên hệ quản trị viên nếu cần điều chỉnh hồ sơ hoặc tài khoản.</p></div></section>;
  return <StaffManagement actorId={actor.accountId} />;
}

function StaffManagement({ actorId }) {
  const [members, setMembers] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [loadedAt, setLoadedAt] = useState(null);
  const [revision, setRevision] = useState(0), [filters, setFilters] = useState(EMPTY_FILTERS), [page, setPage] = useState(0), [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState(''), [dialog, setDialog] = useState(null);
  const detailRef = useRef(null);
  const selectMember = id => { setSelectedId(id); if (window.matchMedia('(max-width:1150px)').matches) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const refresh = () => setRevision(v => v + 1);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    readCatalog('GET /api/v1/admin/staff', { signal: controller.signal }).then(rows => {
      if (controller.signal.aborted) return;
      const sorted = sortStaff(rows); setMembers(sorted); setLoadedAt(new Date().toISOString()); setError('');
      setSelectedId(previous => sorted.some(row => row.staffProfileId === previous) ? previous : sorted[0]?.staffProfileId || null);
    }).catch(cause => { if (!controller.signal.aborted) setError(staffError(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const filtered = useMemo(() => filterStaff(members || [], filters), [members, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), safePage = Math.min(page, pages - 1), visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const visibleIds = visible.map(member => member.staffProfileId).join(',');
  useEffect(() => { if (!visible.some(member => member.staffProfileId === selectedId)) setSelectedId(visible[0]?.staffProfileId || null); }, [visibleIds, selectedId]);
  useEffect(() => {
    const controller = new AbortController(); setDetailError(''); setDetail(null); setDetailLoading(!!selectedId);
    if (selectedId) callBackend('GET /api/v1/admin/staff/{id}', { path: { id: selectedId } }, { signal: controller.signal }).then(member => {
      if (!controller.signal.aborted) {
        setDetail({ id: selectedId, member });
        setMembers(previous => previous && sortStaff(previous.map(row => row.staffProfileId === member.staffProfileId ? member : row)));
      }
    }).catch(cause => { if (!controller.signal.aborted) setDetailError(staffError(cause)); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision]);
  const selected = detail?.id === selectedId ? detail.member : members?.find(member => member.staffProfileId === selectedId);
  const departments = [...new Set((members || []).map(member => member.departmentCode).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const changeFilter = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(0); };
  const saved = (member, message, created) => {
    setDialog(null); setNotice(message);
    const next = sortStaff([...(members || []).filter(row => row.staffProfileId !== member.staffProfileId), member]);
    setMembers(next); setSelectedId(member.staffProfileId); setDetail({ id: member.staffProfileId, member });
    if (created) { setFilters(EMPTY_FILTERS); setPage(Math.floor(next.findIndex(row => row.staffProfileId === member.staffProfileId) / PAGE_SIZE)); }
    refresh();
  };
  const canManage = !loading && !error && !detailLoading && !detailError;
  return <section className="um-page" aria-label="Quản lý nhân viên">
    <header className="um-hero"><div className="um-hero-title"><span className="um-hero-icon"><Icon /></span><div><span className="um-eyebrow">NHÂN SỰ & TÀI KHOẢN</span><h2>Quản lý nhân viên</h2><p>Quản lý hồ sơ, tài khoản đăng nhập và quyền truy cập của staff.</p></div></div><div className="um-header-actions"><button disabled={loading} onClick={refresh}><Icon name="refresh" />{loading && !members ? 'Đang tải…' : 'Tải lại'}</button><button className="um-primary" disabled={loading || !!error || members === null} onClick={() => setDialog({ kind: 'create' })}><Icon name="plus" />Thêm nhân viên</button></div></header>
    {error && <div className="um-notice um-error" role="alert"><span>{error}{members !== null && ' Đang giữ dữ liệu lần tải trước; hãy tải lại trước khi thao tác.'}</span><button onClick={refresh}>Thử lại</button></div>}
    {notice && <div className="um-notice um-success" role="status"><span>{notice}</span><button aria-label="Ẩn thông báo" onClick={() => setNotice('')}>×</button></div>}
    <div className="um-metrics" aria-label="Tổng quan toàn bộ nhân viên">{[
      { label: 'Tổng nhân viên', count: members?.length, icon: 'users', tone: 'blue' },
      { label: 'Đang hoạt động', count: members?.filter(m => staffStatus(m).key === 'ACTIVE').length, icon: 'check', tone: 'green' },
      { label: 'Đã khóa tài khoản', count: members?.filter(m => staffStatus(m).key === 'LOCKED').length, icon: 'lock', tone: 'amber' },
      { label: 'Ngừng hoạt động', count: members?.filter(m => staffStatus(m).key === 'INACTIVE').length, icon: 'inactive', tone: 'muted' },
    ].map(metric => <div className={`um-metric um-metric-${metric.tone}`} key={metric.label}><span><Icon name={metric.icon} /></span><div><strong>{metric.count ?? '—'}</strong><p>{metric.label}</p></div></div>)}</div>
    <div className="um-layout"><section className="um-panel um-directory" aria-label="Danh sách nhân viên">
      <div className="um-panel-head"><div><h3>Danh sách nhân viên</h3><p>Tra cứu hồ sơ và chọn nhân viên để quản lý tài khoản.</p></div><span className="um-result-count">{filtered.length} kết quả</span></div>
      <div className="um-filters"><label className="um-search"><span>Tìm kiếm</span><div><Icon name="search" /><input type="search" placeholder="Tên, mã nhân viên, tài khoản, email…" value={filters.search} onChange={e => changeFilter('search', e.target.value)} /></div></label><label><span>Khoa</span><select aria-label="Khoa" value={filters.department} onChange={e => changeFilter('department', e.target.value)}><option value="">Tất cả khoa</option>{departments.map(code => <option key={code} value={code}>{code}</option>)}</select></label><label><span>Trạng thái</span><select aria-label="Trạng thái" value={filters.status} onChange={e => changeFilter('status', e.target.value)}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="LOCKED">Đã khóa tài khoản</option><option value="INACTIVE">Ngừng hoạt động</option></select></label></div>
      <div className="um-data-age"><i className={error ? 'is-stale' : ''} /><span>{loadedAt ? `Cập nhật: ${stamp(loadedAt)}` : error ? 'Chưa nhận được danh sách nhân viên' : 'Đang tải danh sách nhân viên…'}</span>{Object.values(filters).some(Boolean) && <button className="um-text-button" onClick={() => { setFilters(EMPTY_FILTERS); setPage(0); }}>Xóa bộ lọc</button>}</div>
      {members === null ? <div className="um-empty" role="status"><Icon /><h4>{error ? 'Chưa tải được danh sách' : 'Đang tải nhân viên…'}</h4></div> : !filtered.length ? <div className="um-empty"><Icon name="search" /><h4>{members.length ? 'Không có nhân viên phù hợp' : 'Chưa có nhân viên'}</h4><p>{members.length ? 'Thử thay đổi từ khóa, khoa hoặc trạng thái.' : 'Thêm tài khoản staff đầu tiên để bắt đầu phân ca và vận hành.'}</p></div> : <div className="um-table-scroll"><table className="um-table"><thead><tr><th>Nhân viên</th><th>Tên đăng nhập</th><th>Khoa / Chức danh</th><th>Trạng thái</th><th><span className="um-sr-only">Chi tiết</span></th></tr></thead><tbody>{visible.map(member => <tr key={member.staffProfileId} data-staff-id={member.staffProfileId} className={selectedId === member.staffProfileId ? 'is-selected' : ''}>
        <td><button className="um-person-button" aria-pressed={selectedId === member.staffProfileId} onClick={() => selectMember(member.staffProfileId)}><span className="um-avatar">{initials(staffDisplayName(member))}</span><span><strong>{staffDisplayName(member)}</strong><small>{member.staffCode}</small><span className="um-person-email">{member.account?.email || 'Chưa có email'}</span></span></button></td>
        <td data-label="Tài khoản"><code>{member.account?.username || '—'}</code>{member.account?.mustChangePassword && <small className="um-password-hint">Cần đổi mật khẩu</small>}</td>
        <td data-label="Khoa / Chức danh"><strong className="um-department">{member.departmentCode || 'Chưa phân khoa'}</strong><small>{member.jobTitle || 'Chưa có chức danh'}</small></td>
        <td data-label="Trạng thái"><Badge member={member} /></td>
        <td><button className="um-row-open" aria-label={`Xem hồ sơ ${staffDisplayName(member)}`} onClick={() => selectMember(member.staffProfileId)}>→</button></td>
      </tr>)}</tbody></table></div>}
      {filtered.length > 0 && <footer className="um-pagination"><span>{safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} / {filtered.length} nhân viên</span><div><button aria-label="Trang trước" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>←</button><span>{safePage + 1}/{pages}</span><button aria-label="Trang sau" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>→</button></div></footer>}
    </section><aside className="um-detail-column"><section ref={detailRef} className="um-panel um-detail" aria-label="Hồ sơ nhân viên">
      <div className="um-panel-head"><h3>Hồ sơ nhân viên</h3>{selected && <span className="um-badge um-blue">Staff</span>}</div>
      {detailLoading ? <div className="um-empty" role="status">Đang tải hồ sơ…</div> : detailError ? <div className="um-detail-error"><p className="um-notice um-error" role="alert">{detailError}</p><button onClick={refresh}>Tải lại hồ sơ</button></div> : selected ? <StaffDetails member={selected} actorId={actorId} disabled={!canManage} onEdit={() => setDialog({ kind: 'edit', member: selected })} onAction={kind => setDialog({ kind, member: selected })} /> : <div className="um-empty"><Icon name="users" /><p>Chọn nhân viên để xem hồ sơ và các thao tác phù hợp.</p></div>}
    </section><section className="um-role-note"><Icon name="shield" /><div><strong>Vai trò Staff</strong><p>Thực hiện công việc trong phạm vi được phân công. Ca trực là một căn cứ xác định phạm vi làm việc theo phòng.</p><a href="/admin/staff-shifts">Quản lý ca trực →</a></div></section></aside></div>
    {dialog?.kind === 'create' || dialog?.kind === 'edit' ? <StaffForm member={dialog.member} actorId={actorId} onClose={() => setDialog(null)} onSaved={saved} onRefresh={refresh} /> : dialog ? <StaffActionDialog action={dialog} actorId={actorId} onClose={() => setDialog(null)} onSaved={saved} onRefresh={refresh} /> : null}
  </section>;
}

function StaffDetails({ member, actorId, disabled, onEdit, onAction }) {
  const a = member.account || {}, allowed = staffActions(member, actorId);
  return <><div className="um-profile"><span className="um-avatar um-avatar-large">{initials(staffDisplayName(member))}</span><h4>{staffDisplayName(member)}</h4><p>@{a.username || '—'}</p><Badge member={member} /></div>
    <dl className="um-facts">{[['Mã nhân viên', member.staffCode], ['Email', a.email], ['Điện thoại', a.phone], ['Mã khoa', member.departmentCode], ['Chức danh', member.jobTitle], ['Số máy lẻ', member.contactExtension]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    <div className="um-account-info"><h4>Thông tin đăng nhập</h4><dl><div><dt>Đăng nhập gần nhất</dt><dd>{stamp(a.lastLoginAt)}</dd></div><div><dt>Ngày tạo tài khoản</dt><dd>{stamp(a.createdAt)}</dd></div></dl>{a.mustChangePassword && <p className="um-change-password-note">Nhân viên cần đổi mật khẩu trong lần đăng nhập tiếp theo.</p>}</div>
    {staffStatus(member).key === 'INACTIVE' ? <p className="um-inactive-note">Nhân viên đã ngừng hoạt động. Hiện chưa có thao tác kích hoạt lại trên hệ thống.</p> : <div className="um-profile-actions">{allowed.edit && <button disabled={disabled} className="um-primary" onClick={onEdit}>Chỉnh sửa hồ sơ</button>}<div>{allowed.lock && <button disabled={disabled} onClick={() => onAction('lock')}>Khóa tài khoản</button>}{allowed.unlock && <button disabled={disabled} className="um-unlock" onClick={() => onAction('unlock')}>Mở khóa tài khoản</button>}{allowed.reset && <button disabled={disabled} onClick={() => onAction('reset')}>Đặt lại mật khẩu</button>}</div>{allowed.deactivate && <button disabled={disabled} className="um-text-button um-danger-text" onClick={() => onAction('deactivate')}>Ngừng hoạt động nhân viên</button>}</div>}
    <details className="um-technical"><summary>Mã tra cứu</summary><dl><div><dt>Mã tài khoản</dt><dd>{a.accountCode || '—'}</dd></div><div><dt>ID tài khoản</dt><dd>{a.accountId || '—'}</dd></div><div><dt>ID hồ sơ</dt><dd>{member.staffProfileId}</dd></div></dl></details>
  </>;
}
