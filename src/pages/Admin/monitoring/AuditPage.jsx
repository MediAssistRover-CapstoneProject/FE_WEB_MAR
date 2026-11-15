import { useEffect, useState } from 'react';
import { getSession } from '../../../features/auth/session.js';
import { vi } from '../../../i18n/vi.js';
import { auditActors, dateQuery, isUuid, presetRange } from '../../../features/monitoring/monitoringModel.js';
import { useMonitoringCatalogs, useMonitoringData } from '../../../features/monitoring/useMonitoringData.js';
import RecordDetails from '../backend/RecordDetails.jsx';
import Icon from '../liveOperations/OperationsIcon.jsx';
import { DateFields, Empty, FeedError, FeedStatus, Field, Pager, RefreshButton, revealDetail, SelectField, Technical, stamp, number } from './shared.jsx';
import './audit.css';

const commonActions = ['LOGIN_SUCCEEDED', 'LOGOUT', 'TOKEN_REFRESHED', 'JOB_CREATED', 'JOB_CANCELLED', 'ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED', 'ALERT_CLOSED', 'WORKFLOW_CREATED', 'WORKFLOW_PUBLISHED', 'MAP_ACTIVATED'];
const commonEntities = ['Account', 'Job', 'Workflow', 'Robot', 'Map', 'Alert', 'EmergencyIncident', 'Shift', 'SystemSetting'];
const filterKeys = ['actionCode', 'entityType', 'accountId', 'from', 'to'];

function AuditIcon({ name, ...props }) {
  const paths = {
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 4a4 4 0 0 1 0 8m3 4a6 6 0 0 1 3 5" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

function timePart(value, date = false) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Chưa ghi nhận';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', ...(date ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) }).format(new Date(value));
}

function actionTone(code = '') {
  if (/(CANCEL|DELET|FAIL|REJECT)|(?:^|_)LOCKED(?:_|$)/.test(code)) return 'rose';
  if (/^(LOGIN|LOGOUT|TOKEN|PASSWORD|AUTH|QR_)/.test(code)) return 'blue';
  if (/(?:^|_)(PUBLISHED|ACTIVATED|CONFIRMED|RESOLVED|SUCCEEDED)(?:_|$)/.test(code)) return 'green';
  if (/^WORKFLOW/.test(code)) return 'violet';
  return 'slate';
}

function Actor({ item }) {
  const name = item.actorUsername || 'Hệ thống';
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <div className="au-actor"><span className={`au-avatar${!item.accountId ? ' au-avatar-system' : ''}`} aria-hidden="true">{item.accountId ? initials : <Icon name="activity" />}</span><span><strong>{name}</strong><small>{item.accountId ? 'Tài khoản người dùng' : 'Tác vụ hệ thống'}</small></span></div>;
}

export default function AuditPage() {
  const [draft, setDraft] = useState({}), [applied, setApplied] = useState({}), [appliedFilters, setAppliedFilters] = useState({});
  const [error, setError] = useState(''), [page, setPage] = useState(0), [selectedId, setSelectedId] = useState(null);
  const [actors, setActors] = useState([]), [codes, setCodes] = useState({ actions: commonActions, entities: commonEntities }), [customActor, setCustomActor] = useState(false);
  const feed = useMonitoringData('GET /api/v1/admin/audit-logs', { ...applied, page, size: 20 });
  const detail = useMonitoringData('GET /api/v1/admin/audit-logs/{auditLogId}', {}, { path: { auditLogId: selectedId }, enabled: !!selectedId });
  const catalogs = useMonitoringCatalogs(['admin/staff']);
  const rows = feed.value?.content || [], account = getSession()?.account;

  useEffect(() => {
    const staff = (catalogs.values['admin/staff'] || []).map(item => ({ accountId: item.account?.accountId, actorUsername: item.account?.fullName || item.account?.username }));
    setActors(previous => auditActors(previous, [...staff, ...(feed.value?.content || [])], account));
    setCodes(previous => ({ actions: [...new Set([...previous.actions, ...(feed.value?.content || []).map(item => item.actionCode).filter(Boolean)])], entities: [...new Set([...previous.entities, ...(feed.value?.content || []).map(item => item.entityType).filter(Boolean)])] }));
  }, [feed.value, catalogs.values, account?.accountId]);

  const row = detail.value?.auditLogId === selectedId ? detail.value : null;
  const apply = (values = draft) => {
    try {
      if (values.accountId && !isUuid(values.accountId)) throw Error('Mã tài khoản phải là UUID hợp lệ.');
      setApplied(dateQuery(values)); setAppliedFilters({ ...values }); setDraft({ ...values });
      setPage(0); setSelectedId(null); setError('');
    } catch (cause) { setError(cause.message); }
  };
  const reset = () => { setDraft({}); setApplied({}); setAppliedFilters({}); setPage(0); setSelectedId(null); setCustomActor(false); setError(''); };
  const removeFilter = key => {
    const next = { ...appliedFilters };
    if (key === 'date') { delete next.from; delete next.to; } else delete next[key];
    if (key === 'accountId') setCustomActor(false);
    apply(next);
  };
  const chips = [
    appliedFilters.actionCode && ['actionCode', vi(appliedFilters.actionCode)],
    appliedFilters.entityType && ['entityType', vi(appliedFilters.entityType)],
    appliedFilters.accountId && ['accountId', actors.find(actor => actor.accountId === appliedFilters.accountId)?.actorUsername || appliedFilters.accountId],
    (appliedFilters.from || appliedFilters.to) && ['date', `${appliedFilters.from ? timePart(`${appliedFilters.from}T00:00:00+07:00`, true) : 'Từ đầu'} → ${appliedFilters.to ? timePart(`${appliedFilters.to}T00:00:00+07:00`, true) : 'Hiện tại'}`],
  ].filter(Boolean);
  const pending = filterKeys.some(key => (draft[key] || '') !== (appliedFilters[key] || ''));
  const latest = rows.filter(item => item.occurredAt && Number.isFinite(Date.parse(item.occurredAt))).reduce((value, item) => !value || Date.parse(item.occurredAt) > Date.parse(value) ? item.occurredAt : value, null);
  const actorCount = new Set(rows.filter(item => item.accountId).map(item => item.accountId)).size;

  return <section className="mw-page au-page" aria-label="Nhật ký kiểm toán">
    <header className="au-header">
      <div><span className="au-eyebrow"><span />GIÁM SÁT HỆ THỐNG</span><h2>Nhật ký kiểm toán</h2><p>Theo dõi hoạt động, truy vết thay đổi và đối chiếu dữ liệu trong hệ thống.</p></div>
      <div className="au-header-actions"><span className="au-readonly"><AuditIcon name="shield" />Chỉ đọc</span><RefreshButton feed={{ ...feed, refresh: () => { feed.refresh(); detail.refresh(); } }} /></div>
    </header>

    <div className="au-summary" aria-label="Tổng quan nhật ký">
      <article><span className="au-stat-icon au-blue"><Icon name="list" /></span><div><span>Tổng bản ghi</span><strong>{number(feed.value?.totalElements)}</strong><small>{chips.length ? 'Theo bộ lọc đang áp dụng' : 'Toàn bộ nhật ký hệ thống'}</small></div></article>
      <article><span className="au-stat-icon au-violet"><AuditIcon name="users" /></span><div><span>Tài khoản hoạt động</span><strong>{feed.value ? number(actorCount) : '—'}</strong><small>Trong {rows.length} bản ghi đang xem</small></div></article>
      <article><span className="au-stat-icon au-green"><Icon name="time" /></span><div><span>Hoạt động gần nhất</span><strong className="au-stat-time">{latest ? timePart(latest) : '—'}</strong><small>{latest ? `${timePart(latest, true)} · Trong trang đang xem` : 'Chưa ghi nhận hoạt động'}</small></div></article>
    </div>

    <form className="au-filter-card" onSubmit={event => { event.preventDefault(); apply(); }}>
      <div className="au-panel-heading"><div className="au-section-title"><AuditIcon name="filter" /><h3>Bộ lọc tra cứu</h3>{chips.length > 0 && <span className="au-count">{chips.length}</span>}</div><div className="au-date-presets" aria-label="Chọn nhanh thời gian">{[[0, 'Toàn bộ'], [7, '7 ngày qua'], [30, '30 ngày qua']].map(([days, label]) => {
        const range = days ? presetRange(days) : { from: '', to: '' };
        return <button key={days} type="button" aria-pressed={(draft.from || '') === range.from && (draft.to || '') === range.to} onClick={() => setDraft({ ...draft, ...range })}>{label}</button>;
      })}</div></div>
      <div className="au-filter-grid">
        <SelectField label="Hành động" value={draft.actionCode} onChange={actionCode => setDraft({ ...draft, actionCode })} options={codes.actions.map(value => [value, vi(value)])} empty="Tất cả hành động" />
        <SelectField label="Đối tượng" value={draft.entityType} onChange={entityType => setDraft({ ...draft, entityType })} options={codes.entities.map(value => [value, vi(value)])} empty="Tất cả đối tượng" />
        <SelectField label="Người thực hiện" value={customActor ? '__custom__' : draft.accountId} onChange={value => { setCustomActor(value === '__custom__'); setDraft({ ...draft, accountId: value === '__custom__' ? '' : value }); }} options={[...actors.map(item => [item.accountId, item.actorUsername]), ['__custom__', 'Nhập mã tài khoản khác…']]} empty="Tất cả tài khoản" />
        <DateFields value={draft} onChange={setDraft} />
        {customActor && <Field className="au-custom-actor" label="Mã tài khoản"><input value={draft.accountId || ''} onChange={event => setDraft({ ...draft, accountId: event.target.value.trim() })} placeholder="UUID tài khoản Admin hoặc Staff" /></Field>}
      </div>
      <details className="au-advanced"><summary>Tra cứu nâng cao <Icon name="chevron" /></summary><div><Field label="Mã hành động"><input value={draft.actionCode || ''} onChange={event => setDraft({ ...draft, actionCode: event.target.value.trim() })} placeholder="Nhập mã hành động khác" /></Field><Field label="Loại đối tượng"><input value={draft.entityType || ''} onChange={event => setDraft({ ...draft, entityType: event.target.value.trim() })} placeholder="Nhập loại đối tượng khác" /></Field></div><p>Có thể chọn tài khoản đã tải hoặc nhập mã tài khoản khác ở mục Người thực hiện.</p></details>
      <div className="au-filter-footer"><span className={pending ? 'au-pending' : ''}><Icon name="time" />{pending ? 'Có thay đổi chưa áp dụng' : 'Thời gian theo giờ Việt Nam (GMT+7)'}</span><div className="mw-actions"><button type="button" className="mw-button" onClick={reset}>Đặt lại</button><button className="mw-button mw-primary" type="submit"><Icon name="search" />Áp dụng bộ lọc</button></div></div>
      {error && <p className="mw-form-error" role="alert">{error}</p>}
    </form>

    <FeedError feed={feed} />
    <section className="mw-card au-log-card" aria-label="Danh sách nhật ký">
      <div className="au-table-heading"><div className="au-section-title"><h3>Lịch sử hoạt động</h3>{feed.value && <span className="au-count">{number(feed.value.totalElements)}</span>}</div><FeedStatus feed={feed} /></div>
      {chips.length > 0 && <div className="au-applied" aria-label="Bộ lọc đang áp dụng"><span>Đang lọc:</span>{chips.map(([key, label]) => <button type="button" key={key} onClick={() => removeFilter(key)} aria-label={`Bỏ bộ lọc: ${label}`}>{label}<AuditIcon name="close" /></button>)}<button type="button" className="au-clear-filters" onClick={reset}>Xóa bộ lọc</button></div>}
      <div className="mw-table-scroll au-table-scroll" aria-busy={feed.loading}>
        <table><caption className="mw-sr-only">Nhật ký hoạt động hệ thống</caption><thead><tr><th scope="col">Thời điểm</th><th scope="col">Người thực hiện</th><th scope="col">Hành động</th><th scope="col">Đối tượng</th><th scope="col"><span className="mw-sr-only">Chi tiết</span></th></tr></thead><tbody>{rows.map(item => <tr key={item.auditLogId} className={selectedId === item.auditLogId ? 'is-selected' : ''}>
          <td><time dateTime={item.occurredAt || undefined} title={stamp(item.occurredAt)}><strong>{timePart(item.occurredAt)}</strong><small>{timePart(item.occurredAt, true)}</small></time></td>
          <td><Actor item={item} /></td>
          <td><span className={`au-action au-${actionTone(item.actionCode)}`}><i />{vi(item.actionCode || 'Chưa ghi nhận')}</span></td>
          <td><span className="au-entity">{vi(item.entityType || 'Chưa ghi nhận')}</span></td>
          <td><button type="button" className="au-open-detail" aria-label={`Xem chi tiết: ${vi(item.actionCode || 'hoạt động')}`} aria-pressed={selectedId === item.auditLogId} aria-controls="mw-audit-detail" onClick={() => { setSelectedId(item.auditLogId); revealDetail('mw-audit-detail'); }}>Chi tiết<Icon name="arrow" /></button></td>
        </tr>)}</tbody></table>
        {!rows.length && feed.loading && <div className="au-loading" role="status"><Icon name="refresh" /><span>Đang tải nhật ký hoạt động…</span></div>}
        {!rows.length && !feed.loading && (feed.error ? <Empty title="Chưa tải được nhật ký">Bấm Thử lại để kết nối và tải dữ liệu.</Empty> : <Empty title="Chưa có hoạt động phù hợp">Thử thay đổi hành động, tài khoản hoặc khoảng thời gian tra cứu.</Empty>)}
      </div>
      <Pager data={feed.value} page={page} loading={feed.loading} onChange={value => { setPage(value); setSelectedId(null); }} />
    </section>

    {selectedId && <section className="mw-card mw-audit-detail au-detail" id="mw-audit-detail" aria-label="Chi tiết nhật ký kiểm toán">
      <div className="mw-detail-title"><div className="au-detail-heading"><span className="au-detail-icon"><Icon name="list" /></span><div><span className="au-eyebrow">ĐỐI CHIẾU DỮ LIỆU</span><h3>Chi tiết hoạt động</h3></div></div><button type="button" className="mw-button au-close-detail" onClick={() => setSelectedId(null)}><AuditIcon name="close" />Đóng chi tiết</button></div>
      <FeedError feed={detail} />
      {!row ? <p role="status" className="au-detail-loading">{detail.error ? 'Chưa tải được chi tiết. Vui lòng thử lại.' : 'Đang tải chi tiết…'}</p> : <>
        <div className="au-detail-facts"><div><span>Người thực hiện</span><Actor item={row} /></div><div><span>Hành động</span><strong className={`au-action au-${actionTone(row.actionCode)}`}><i />{vi(row.actionCode || 'Chưa ghi nhận')}</strong></div><div><span>Đối tượng</span><strong>{vi(row.entityType || 'Chưa ghi nhận')}</strong></div><div><span>Thời điểm</span><strong>{stamp(row.occurredAt)}</strong></div></div>
        <div className="mw-audit-changes au-changes"><article><div className="au-change-heading"><span className="au-change-mark">−</span><h4>Trước thay đổi</h4></div><div className="au-change-body">{row.beforeData ? <RecordDetails value={row.beforeData} /> : <div className="au-no-change"><Icon name="list" /><p>Không có dữ liệu trước thay đổi.</p></div>}</div></article><article><div className="au-change-heading"><span className="au-change-mark">+</span><h4>Sau thay đổi</h4></div><div className="au-change-body">{row.afterData ? <RecordDetails value={row.afterData} /> : <div className="au-no-change"><Icon name="list" /><p>Không có dữ liệu sau thay đổi.</p></div>}</div></article></div>
        <Technical value={{ auditLogId: row.auditLogId, accountId: row.accountId, entityId: row.entityId, correlationId: row.correlationId, ipAddress: row.ipAddress, userAgent: row.userAgent }} />
      </>}
    </section>}
    <footer className="au-footnote"><AuditIcon name="shield" /><p>Nhật ký chỉ dùng để tra cứu. Để thay đổi dữ liệu, truy cập chức năng quản lý tương ứng.</p></footer>
  </section>;
}
