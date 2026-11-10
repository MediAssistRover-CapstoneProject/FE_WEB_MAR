import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession } from '../../../features/auth/session.js';
import { callBackend } from '../../../features/api/backendApi.js';
import { vi } from '../../../i18n/vi.js';
import { alertSignature, alertStates, availableAlertActions, dateQuery, newerAlert, notificationLabels, severityLabels } from '../../../features/monitoring/monitoringModel.js';
import { useMonitoringData } from '../../../features/monitoring/useMonitoringData.js';
import { Badge, DateFields, Empty, Facts, FeedError, FeedStatus, Field, Filters, Frame, Metrics, Modal, Notice, Pager, RefreshButton, revealDetail, RelatedJob, SelectField, Tabs, Technical, number, stamp } from './shared.jsx';

const actionLabels = { acknowledge: 'Tiếp nhận', resolve: 'Xử lý xong', close: 'Đóng cảnh báo' };
const titleFor = alert => notificationLabels[alert?.notificationType] || vi(alert?.notificationType || 'Cảnh báo hệ thống');
export default function AlertsPage() {
  const [status, setStatus] = useState('OPEN'), [auto, setAuto] = useState(true), [page, setPage] = useState(0);
  const [draft, setDraft] = useState({}), [applied, setApplied] = useState({}), [filterError, setFilterError] = useState('');
  const [selectedId, setSelectedId] = useState(null), [intent, setIntent] = useState(null), [message, setMessage] = useState('');
  const session = getSession();
  const list = useMonitoringData('GET /api/v1/alerts', { ...applied, ...(status ? { status } : {}), page, size: 20 }, { auto });
  const openCount = useMonitoringData('GET /api/v1/alerts', { status: 'OPEN', page: 0, size: 1 }, { auto, enabled: session?.account?.role === 'ADMIN' });
  const criticalCount = useMonitoringData('GET /api/v1/alerts', { status: 'OPEN', severity: 'CRITICAL', page: 0, size: 1 }, { auto, enabled: session?.account?.role === 'ADMIN' });
  const detail = useMonitoringData('GET /api/v1/alerts/{id}', {}, { path: { id: selectedId }, enabled: !!selectedId, auto, merge: newerAlert });
  const alert = detail.value?.alertId === selectedId ? detail.value : null;
  const incident = useMonitoringData('GET /api/v1/emergency-incidents/{id}', {}, { path: { id: alert?.incidentId }, enabled: !!alert?.incidentId, auto });
  const incidentData = incident.value?.incidentId === alert?.incidentId && !incident.stale ? incident.value : null;
  const actions = availableAlertActions(alert, session, incidentData);
  const rows = list.value?.content || [];
  const apply = () => { try { setApplied(dateQuery(draft)); setPage(0); setSelectedId(null); setFilterError(''); } catch (error) { setFilterError(error.message); } };
  const reset = () => { setDraft({}); setApplied({}); setPage(0); setSelectedId(null); setFilterError(''); };
  const refresh = () => { list.refresh(); detail.refresh(); incident.refresh(); openCount.refresh(); criticalCount.refresh(); };
  return <Frame title="Cảnh báo" description="Theo dõi thông báo mới, ưu tiên tình huống khẩn cấp và xử lý theo trạng thái." icon="alert" actions={<><label className="mw-auto"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />Tự cập nhật</label><RefreshButton feed={{ ...list, refresh }} /></>}>
    <Metrics items={session?.account?.role === 'ADMIN' ? [
      ['Đang mở', openCount.stale ? '—' : number(openCount.value?.totalElements), 'Trong phạm vi tài khoản'],
      ['Khẩn cấp đang mở', criticalCount.stale ? '—' : number(criticalCount.value?.totalElements), 'Trong phạm vi tài khoản'],
      ['Phù hợp bộ lọc', number(list.value?.totalElements), 'Tổng số kết quả của danh sách'],
    ] : [
      ['Phù hợp bộ lọc', number(list.value?.totalElements), 'Trong phạm vi tài khoản'],
      ['Khẩn cấp trên trang này', number(rows.filter(item => item.severity === 'CRITICAL').length), 'Số lượng trong trang đang xem'],
      ['Cần xác nhận trên trang này', number(rows.filter(item => item.requireAck && item.status === 'OPEN').length), 'Số lượng trong trang đang xem'],
    ]} />
    <Filters onApply={apply} onReset={reset} error={filterError}>
      <SelectField label="Mức độ" value={draft.severity} onChange={severity => setDraft({ ...draft, severity })} options={Object.entries(severityLabels)} />
      <Field label="Loại thông báo"><input list="mw-notification-types" value={draft.type || ''} onChange={event => setDraft({ ...draft, type: event.target.value })} placeholder="Tất cả loại thông báo" /><datalist id="mw-notification-types">{Object.entries(notificationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</datalist></Field>
      <DateFields value={draft} onChange={setDraft} />
    </Filters>
    <Tabs label="Trạng thái cảnh báo" active={status} items={[[ '', 'Tất cả' ], ...Object.entries(alertStates)]} onChange={value => { setStatus(value); setPage(0); setSelectedId(null); }} />
    <FeedStatus feed={list} auto={auto} /><FeedError feed={list} />
    {message && <Notice>{message}</Notice>}
    <div className="mw-split"><section className="mw-card mw-list" aria-label="Danh sách cảnh báo">
      {!rows.length && !list.loading && <Empty title="Chưa có cảnh báo phù hợp">Thay đổi trạng thái hoặc bộ lọc để tra cứu các thông báo khác.</Empty>}
      <div className="mw-alert-list">{rows.map(item => <button type="button" key={item.alertId} className={`mw-alert-row${item.alertId === selectedId ? ' is-selected' : ''}`} aria-pressed={item.alertId === selectedId} onClick={() => { setSelectedId(item.alertId); setMessage(''); revealDetail('mw-alert-detail', true); }}><div className="mw-row-top"><Badge value={item.severity} severity /><time>{stamp(item.createdAt)}</time></div><strong>{titleFor(item)}</strong><p>{item.message || 'Chưa có mô tả'}</p><div className="mw-row-bottom"><Badge value={item.status} /><span>{item.incidentId ? 'Có sự cố liên quan' : item.jobStepId ? 'Liên quan công việc' : 'Thông báo hệ thống'}</span></div></button>)}</div>
      <Pager data={list.value} page={page} loading={list.loading} onChange={value => { setPage(value); setSelectedId(null); }} />
    </section><section className="mw-card mw-detail" id="mw-alert-detail" aria-label="Chi tiết cảnh báo">
      {!selectedId ? <Empty title="Chọn một cảnh báo">Nội dung, đối tượng liên quan và thao tác phù hợp sẽ hiển thị tại đây.</Empty> : <><FeedError feed={detail} />{!alert ? <p role="status">Đang tải chi tiết…</p> : <>
        <div className="mw-detail-top"><Badge value={alert.severity} severity /><Badge value={alert.status} /></div><h3>{titleFor(alert)}</h3><p className="mw-message">{alert.message || 'Chưa có mô tả'}</p>
        <FeedStatus feed={detail} auto={auto} />
        {alert.notificationType === 'WORKFLOW_FAILURE' && <Notice>Tiếp nhận và phục hồi tại công việc liên quan. Cảnh báo này được đóng theo kết quả đối soát công việc.</Notice>}
        {!alert.requireAck && alert.status === 'OPEN' && <Notice>Thông báo này không yêu cầu xác nhận tiếp nhận.</Notice>}
        {alert.expiresAt && Date.parse(alert.expiresAt) <= Date.now() && <Notice>Thời hạn xác nhận đã hết. Kiểm tra công việc hoặc sự cố liên quan trước khi xử lý.</Notice>}
        {alert.incidentId && <><Notice>Trạng thái cảnh báo phụ thuộc vào sự cố liên quan. Xử lý sự cố trước khi xác nhận hoàn tất hoặc đóng cảnh báo.</Notice><Link className="mw-link" to={`/admin/emergency-center?incidentId=${encodeURIComponent(alert.incidentId)}`}>Mở sự cố liên quan →</Link></>}
        <RelatedJob jobId={alert.dataJson?.job_id || alert.dataJson?.jobId} />
        {actions.length > 0 && <div className="mw-actions mw-alert-actions">{actions.map(action => <button key={action} type="button" className="mw-button mw-primary" disabled={detail.stale || detail.loading || !!intent} onClick={() => setIntent({ action, alert, accountId: session.account.accountId, role: session.account.role })}>{actionLabels[action]}</button>)}</div>}
        {!actions.length && alert.requireAck && alert.status === 'OPEN' && !alert.incidentId && alert.notificationType !== 'WORKFLOW_FAILURE' && <p className="mw-muted">Chỉ tài khoản nhận cảnh báo hoặc nhân viên có quyền phù hợp mới có thể tiếp nhận.</p>}
        <Facts items={[[ 'Tạo lúc', stamp(alert.createdAt) ], [ 'Hết hạn xác nhận', alert.expiresAt ? stamp(alert.expiresAt) : 'Không đặt thời hạn' ], [ 'Yêu cầu xác nhận', alert.requireAck ? 'Có' : 'Không' ], [ 'Chính sách xác nhận', alert.ackPolicy === 'ALL' ? 'Tất cả người nhận' : 'Một người nhận phù hợp' ]]} />
        <Technical value={alert} />
      </>}</>}
    </section></div>
    {intent && <AlertAction intent={intent} onClose={() => setIntent(null)} onFresh={value => detail.accept(value)} onSaved={value => { detail.accept(value); setIntent(null); setMessage(`Máy chủ đã ghi nhận thao tác. Trạng thái hiện tại: ${alertStates[value.status] || vi(value.status)}.`); refresh(); }} />}
  </Frame>;
}

function AlertAction({ intent, onClose, onFresh, onSaved }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [changed, setChanged] = useState(false), [checked, setChecked] = useState(false);
  const lock = useRef(false);
  const submit = async event => {
    event.preventDefault(); if (lock.current || changed) return;
    if (!checked) { setError('Vui lòng kiểm tra và xác nhận trước khi gửi.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const fresh = await callBackend('GET /api/v1/alerts/{id}', { path: { id: intent.alert.alertId } });
      onFresh(fresh);
      if (alertSignature(fresh) !== alertSignature(intent.alert)) { setChanged(true); throw Error('Cảnh báo đã thay đổi. Đóng biểu mẫu, kiểm tra trạng thái mới và mở lại thao tác.'); }
      const incident = fresh.incidentId ? await callBackend('GET /api/v1/emergency-incidents/{id}', { path: { id: fresh.incidentId } }) : null;
      const current = getSession();
      if (current?.account?.accountId !== intent.accountId || current?.account?.role !== intent.role || !availableAlertActions(fresh, current, incident).includes(intent.action)) { setChanged(true); throw Error('Điều kiện hoặc quyền xử lý đã thay đổi. Vui lòng kiểm tra lại cảnh báo.'); }
      const result = await callBackend(`POST /api/v1/alerts/{id}/${intent.action}`, { path: { id: fresh.alertId } });
      if (result?.alertId !== fresh.alertId || !result.status) throw Error('Chưa nhận được trạng thái xác nhận từ máy chủ. Tải lại cảnh báo trước khi thử lại.');
      onSaved(result);
    } catch (cause) { setError(vi(cause.message)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal title={actionLabels[intent.action]} onClose={onClose} busy={busy}><form onSubmit={submit}><p>{titleFor(intent.alert)}</p><p className="mw-message">{intent.alert.message}</p><p className="mw-muted">{intent.action === 'acknowledge' ? 'Xác nhận tiếp nhận có thể hoàn tất bước thông báo đang chờ trong quy trình.' : 'Máy chủ sẽ kiểm tra trạng thái cảnh báo và sự cố liên quan trước khi ghi nhận.'}</p><label className="mw-confirm"><input type="checkbox" checked={checked} disabled={busy || changed} onChange={event => setChecked(event.target.checked)} />Tôi đã kiểm tra nội dung và xác nhận thao tác này</label>{error && <p className="mw-form-error" role="alert">{error}</p>}<footer className="mw-actions"><button className="mw-button" type="button" disabled={busy} onClick={onClose}>Đóng biểu mẫu</button><button className="mw-button mw-primary" disabled={busy || changed} type="submit">{busy ? 'Đang gửi…' : 'Xác nhận'}</button></footer></form></Modal>;
}
