import { useEffect, useState } from 'react';
import { getSession } from '../../../features/auth/session.js';
import { vi } from '../../../i18n/vi.js';
import { auditActors, dateQuery, isUuid } from '../../../features/monitoring/monitoringModel.js';
import { useMonitoringCatalogs, useMonitoringData } from '../../../features/monitoring/useMonitoringData.js';
import RecordDetails from '../backend/RecordDetails.jsx';
import { DateFields, Empty, Facts, FeedError, FeedStatus, Field, Filters, Frame, Notice, Pager, RefreshButton, revealDetail, SelectField, Technical, stamp } from './shared.jsx';

const commonActions = ['LOGIN_SUCCEEDED', 'LOGOUT', 'TOKEN_REFRESHED', 'JOB_CREATED', 'JOB_CANCELLED', 'ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED', 'ALERT_CLOSED', 'WORKFLOW_CREATED', 'WORKFLOW_PUBLISHED', 'MAP_ACTIVATED'];
const commonEntities = ['Account', 'Job', 'Workflow', 'Robot', 'Map', 'Alert', 'EmergencyIncident', 'Shift', 'SystemSetting'];
export default function AuditPage() {
  const [draft, setDraft] = useState({}), [applied, setApplied] = useState({}), [error, setError] = useState(''), [page, setPage] = useState(0), [selectedId, setSelectedId] = useState(null);
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
  const apply = () => { try { if (draft.accountId && !isUuid(draft.accountId)) throw Error('Mã tài khoản phải là UUID hợp lệ.'); setApplied(dateQuery(draft)); setPage(0); setSelectedId(null); setError(''); } catch (cause) { setError(cause.message); } };
  const reset = () => { setDraft({}); setApplied({}); setPage(0); setSelectedId(null); setCustomActor(false); setError(''); };
  return <Frame title="Nhật ký kiểm toán" description="Tra cứu người thực hiện, thời điểm và nội dung thay đổi trong hệ thống." icon="list" actions={<RefreshButton feed={{ ...feed, refresh: () => { feed.refresh(); detail.refresh(); } }} />}>
    <Filters onApply={apply} onReset={reset} error={error}>
      <SelectField label="Hành động" value={draft.actionCode} onChange={actionCode => setDraft({ ...draft, actionCode })} options={codes.actions.map(value => [value, vi(value) === value ? value : vi(value)])} />
      <SelectField label="Đối tượng" value={draft.entityType} onChange={entityType => setDraft({ ...draft, entityType })} options={codes.entities.map(value => [value, vi(value)])} />
      <SelectField label="Người thực hiện" value={customActor ? '__custom__' : draft.accountId} onChange={value => { setCustomActor(value === '__custom__'); setDraft({ ...draft, accountId: value === '__custom__' ? '' : value }); }} options={[...actors.map(item => [item.accountId, item.actorUsername]), ['__custom__', 'Nhập mã tài khoản khác…']]} />
      {customActor && <Field label="Mã tài khoản"><input value={draft.accountId || ''} onChange={event => setDraft({ ...draft, accountId: event.target.value.trim() })} placeholder="UUID tài khoản Admin hoặc Staff" /></Field>}
      <DateFields value={draft} onChange={setDraft} />
      <details className="mw-code-filters"><summary>Lọc bằng mã nghiệp vụ khác</summary><Field label="Mã hành động"><input value={draft.actionCode || ''} onChange={event => setDraft({ ...draft, actionCode: event.target.value.trim() })} /></Field><Field label="Loại đối tượng"><input value={draft.entityType || ''} onChange={event => setDraft({ ...draft, entityType: event.target.value.trim() })} /></Field></details>
    </Filters>
    <p className="mw-muted">Người thực hiện gồm tài khoản hiện tại, nhân viên và các tài khoản xuất hiện trong nhật ký đã tải. Có thể nhập UUID để tra cứu tài khoản khác.</p>
    <FeedStatus feed={feed} /><FeedError feed={feed} />
    <section className="mw-card mw-audit-table"><div className="mw-table-scroll"><table><caption className="mw-sr-only">Nhật ký hoạt động hệ thống</caption><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>{rows.map(item => <tr key={item.auditLogId} className={selectedId === item.auditLogId ? 'is-selected' : ''}><td><time>{stamp(item.occurredAt)}</time></td><td>{item.actorUsername || 'Hệ thống'}</td><td><button type="button" className="mw-table-action" aria-pressed={selectedId === item.auditLogId} onClick={() => { setSelectedId(item.auditLogId); revealDetail('mw-audit-detail'); }}>{vi(item.actionCode)}</button></td><td>{vi(item.entityType)}</td></tr>)}</tbody></table>{!rows.length && !feed.loading && <Empty title="Chưa có hoạt động phù hợp">Thay đổi người thực hiện, hành động hoặc khoảng thời gian để tiếp tục tra cứu.</Empty>}</div><Pager data={feed.value} page={page} loading={feed.loading} onChange={value => { setPage(value); setSelectedId(null); }} /></section>
    {selectedId && <section className="mw-card mw-audit-detail" id="mw-audit-detail" aria-label="Chi tiết nhật ký kiểm toán"><div className="mw-detail-title"><h3>Chi tiết hoạt động</h3><button className="mw-button" onClick={() => setSelectedId(null)}>Đóng chi tiết</button></div><FeedError feed={detail} />{!row ? <p role="status">Đang tải chi tiết…</p> : <><Facts items={[[ 'Người thực hiện', row.actorUsername || 'Hệ thống' ], [ 'Hành động', vi(row.actionCode) ], [ 'Đối tượng', vi(row.entityType) ], [ 'Thời điểm', stamp(row.occurredAt) ]]} /><div className="mw-audit-changes"><article><h4>Trước thay đổi</h4>{row.beforeData ? <RecordDetails value={row.beforeData} /> : <p className="mw-muted">Không có dữ liệu trước thay đổi.</p>}</article><article><h4>Sau thay đổi</h4>{row.afterData ? <RecordDetails value={row.afterData} /> : <p className="mw-muted">Không có dữ liệu sau thay đổi.</p>}</article></div><Technical value={{ auditLogId: row.auditLogId, accountId: row.accountId, entityId: row.entityId, correlationId: row.correlationId, ipAddress: row.ipAddress, userAgent: row.userAgent }} /></>}</section>}
    <Notice>Nhật ký chỉ dùng để tra cứu. Việc thay đổi dữ liệu thực hiện tại chức năng quản lý tương ứng.</Notice>
  </Frame>;
}
