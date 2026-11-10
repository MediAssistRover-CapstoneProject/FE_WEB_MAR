import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { callBackend } from '../../../features/api/backendApi.js';
import { vi } from '../../../i18n/vi.js';
import { breakdownTarget, dateQuery, isUuid, presetRange, REPORT_TIMEZONE } from '../../../features/monitoring/monitoringModel.js';
import { useMonitoringCatalogs, useMonitoringData } from '../../../features/monitoring/useMonitoringData.js';
import { Badge, CatalogSelect, DateFields, Empty, Facts, FeedError, FeedStatus, Filters, Frame, Metrics, Notice, Pager, RefreshButton, SelectField, Tabs, number, stamp } from './shared.jsx';

const tabs = [[ 'reports', 'Tổng quan vận hành' ], [ 'analytics', 'Phân tích theo thời gian' ], [ 'job-reports', 'Báo cáo công việc' ]];
const jobStates = { QUEUED: 'Chờ điều phối', ACCEPTED: 'Đã tiếp nhận', RUNNING: 'Đang thực hiện', SUCCEEDED: 'Thành công', FAILED: 'Thất bại', CANCELLED: 'Đã hủy', RECOVERY_REQUIRED: 'Cần phục hồi' };
const duration = value => typeof value === 'number' && Number.isFinite(value) ? value >= 60 ? number(value / 60, ' phút') : number(value, ' giây') : '—';
export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'reports';
  const [range, setRange] = useState(() => presetRange());
  const catalogs = useMonitoringCatalogs(['robots', 'workflows/published']);
  const drill = Object.fromEntries(['workflowId', 'robotId'].filter(key => isUuid(params.get(key))).map(key => [key, params.get(key)]));
  return <ReportView key={`${tab}:${JSON.stringify(drill)}`} tab={tab} initialRange={range} drill={drill} onRange={setRange} catalogs={catalogs} onTab={(next, filters = {}) => setParams({ tab: next, ...filters }, { replace: true })} />;
}
function ReportView({ tab, initialRange, drill, onRange, catalogs, onTab }) {
  const overview = tab === 'reports', jobs = tab === 'job-reports';
  const [draft, setDraft] = useState({ ...initialRange, interval: 'DAY', ...drill });
  const [applied, setApplied] = useState(() => dateQuery({ ...initialRange, ...(jobs ? drill : { interval: 'DAY', timezone: REPORT_TIMEZONE }) }, { required: true, report: true }));
  const [error, setError] = useState(''), [page, setPage] = useState(0), [exporting, setExporting] = useState(false), [message, setMessage] = useState('');
  const exportLock = useRef(false), exportController = useRef(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const query = overview ? {} : jobs ? { ...applied, page, size: 20 } : applied;
  const feed = useMonitoringData(`GET /api/v1/admin/reports/${overview ? 'overview' : jobs ? 'jobs' : 'analytics'}`, query);
  const apply = (value = draft) => { try {
    const next = jobs ? { from: value.from, to: value.to, workflowId: value.workflowId, robotId: value.robotId, status: value.status } : { from: value.from, to: value.to, interval: value.interval || 'DAY', timezone: REPORT_TIMEZONE };
    setApplied(dateQuery(next, { required: true, report: true })); onRange({ from: value.from, to: value.to }); setPage(0); setError(''); setMessage('');
  } catch (cause) { setError(cause.message); } };
  const preset = days => { const next = { ...draft, ...presetRange(days) }; setDraft(next); apply(next); };
  const reset = () => { const next = { ...presetRange(), interval: 'DAY' }; setDraft(next); apply(next); };
  const exportCsv = async () => {
    if (exportLock.current || feed.stale || feed.loading) return;
    exportLock.current = true; setExporting(true); setMessage('');
    const controller = new AbortController(); exportController.current = controller;
    try {
      const blob = await callBackend('GET /api/v1/admin/reports/jobs/export.csv', { query: { ...applied } }, { signal: controller.signal, responseType: 'blob', headers: { Accept: 'text/csv' } });
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bao-cao-cong-viec.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (!controller.signal.aborted) setMessage('Đã tải CSV theo bộ lọc đã áp dụng khi chọn xuất báo cáo.');
    } catch (cause) { if (!controller.signal.aborted) setError(vi(cause.message)); }
    finally { exportLock.current = false; if (!controller.signal.aborted) setExporting(false); }
  };
  return <Frame title="Phân tích vận hành" description="Đọc kết quả thực thi, xu hướng theo thời gian và tra cứu công việc phía sau số liệu." icon="activity" actions={<><RefreshButton feed={feed} />{jobs && <button type="button" className="mw-button mw-primary" disabled={exporting || feed.stale || feed.loading || !feed.value} onClick={exportCsv}>{exporting ? 'Đang xuất…' : 'Xuất CSV'}</button>}</>}>
    <Tabs label="Loại báo cáo" items={tabs} active={tab} onChange={onTab} />
    {overview ? <Notice>Tổng quan tính trên toàn bộ dữ liệu hệ thống. Chọn “Phân tích theo thời gian” để xem một khoảng ngày cụ thể.</Notice> : <Filters onApply={() => apply()} onReset={reset} error={error}>
      <div className="mw-presets" aria-label="Khoảng thời gian nhanh">{[[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày']].map(([days, title]) => <button key={days} type="button" className="mw-button" onClick={() => preset(days)}>{title}</button>)}</div>
      <DateFields value={draft} onChange={setDraft} required />
      {jobs ? <><CatalogSelect label="Robot" value={draft.robotId} onChange={robotId => setDraft({ ...draft, robotId })} rows={catalogs.values.robots} idKey="robotId" nameKey="robotName" /><CatalogSelect label="Quy trình" value={draft.workflowId} onChange={workflowId => setDraft({ ...draft, workflowId })} rows={catalogs.values['workflows/published']} idKey="workflowId" nameKey="workflowName" /><SelectField label="Trạng thái công việc" value={draft.status} onChange={status => setDraft({ ...draft, status })} options={Object.entries(jobStates)} /></> : <SelectField label="Gom số liệu theo" value={draft.interval} onChange={interval => setDraft({ ...draft, interval })} options={[[ 'DAY', 'Ngày' ], [ 'HOUR', 'Giờ' ]]} empty="Chọn cách thống kê" />}
    </Filters>}
    {!overview && <p className="mw-muted">Khoảng ngày đang áp dụng: {stamp(applied.from)} — {stamp(Date.parse(applied.to) - 1)} · Giờ Việt Nam</p>}
    {catalogs.warning && !overview && <Notice>{catalogs.warning}</Notice>}
    <FeedStatus feed={feed} /><FeedError feed={feed} />{message && <Notice>{message}</Notice>}
    {!feed.value ? <Empty title={feed.loading ? 'Đang tổng hợp số liệu…' : 'Chưa tải được báo cáo'}>Số liệu sẽ hiển thị sau khi máy chủ phản hồi.</Empty> : overview ? <Overview value={feed.value} /> : jobs ? <JobsReport value={feed.value} page={page} loading={feed.loading} onPage={setPage} /> : <AnalyticsReport value={feed.value} catalogs={catalogs.values} drill={filters => onTab('job-reports', filters)} />}
  </Frame>;
}
function Overview({ value }) {
  return <><Metrics items={[[ 'Công việc thành công', number(value.succeededJobs) ], [ 'Tỷ lệ thành công', number(value.jobCompletionRatePercent, '%'), 'Trên các công việc đã kết thúc' ], [ 'Cảnh báo đang mở', number(value.openAlerts) ], [ 'Sự cố đang xử lý', number(value.activeEmergencyIncidents) ]]} /><div className="mw-chart-grid mw-three-charts">{[[ 'Công việc theo trạng thái', value.jobsByStatus ], [ 'Robot theo trạng thái', value.robotsByStatus ], [ 'Yêu cầu theo loại', value.requestsByType ]].map(([title, values]) => <Breakdown key={title} title={title} entries={Object.entries(values || {}).map(([key, total]) => ({ key, label: vi(key), total }))} />)}</div></>;
}
function AnalyticsReport({ value, drill, catalogs }) {
  const jobs = value.jobs || {};
  return <><Metrics items={[[ 'Tổng công việc', number(jobs.total) ], [ 'Thành công', number(jobs.succeeded) ], [ 'Tỷ lệ thành công', number(jobs.successRatePercent, '%'), 'Trên tổng thành công, thất bại, đã hủy và cần phục hồi' ], [ 'Thời gian chạy trung bình', duration(jobs.averageDurationSeconds) ]]} />
    <section className="mw-card mw-chart"><div className="mw-detail-title"><h3>Kết quả theo thời gian</h3><span className="mw-muted">{value.interval === 'HOUR' ? 'Theo giờ' : 'Theo ngày'}</span></div><Timeline rows={value.timeline || []} /></section>
    <div className="mw-chart-grid"><Breakdown title="Công việc theo quy trình" entries={(value.jobsByWorkflow || []).map(row => ({ ...row, targetId: breakdownTarget(row, catalogs['workflows/published'], 'workflow') }))} onChoose={row => drill({ workflowId: row.targetId })} /><Breakdown title="Công việc theo robot" entries={(value.jobsByRobot || []).map(row => ({ ...row, targetId: breakdownTarget(row, catalogs.robots, 'robot') }))} onChoose={row => drill({ robotId: row.targetId })} /></div>
    <div className="mw-chart-grid"><Activity title="Hoạt động theo bản đồ" rows={value.activityByMap || []} /><Activity title="Hoạt động theo khu vực" rows={value.activityByZone || []} /></div>
    <section className="mw-card mw-detail"><h3>Chỉ số bổ sung trong khoảng thời gian</h3><Facts items={[[ 'Công việc thất bại', number(jobs.failed) ], [ 'Công việc cần phục hồi', number(jobs.recoveryRequired) ], [ 'Thời gian chạy P95', duration(jobs.p95DurationSeconds) ], [ 'Giao hàng hoàn tất', number(value.deliveries?.delivered) ], [ 'Tiếp nhận sự cố trung bình', duration(value.emergencies?.averageAcknowledgementSeconds) ], [ 'Sự kiện nghi ngờ té ngã', number(value.monitoring?.suspectedFalls) ]]} /></section>
  </>;
}
function Timeline({ rows }) {
  if (!rows.length) return <Empty title="Chưa có dữ liệu theo thời gian" />;
  const max = Math.max(1, ...rows.map(row => Math.max(row.succeeded || 0, row.failed || 0))), width = 900, height = 230, left = 40, plot = 840, step = plot / rows.length, bar = Math.max(.5, Math.min(14, step * .28));
  return <><div className="mw-chart-key"><span><i className="is-success" />Thành công</span><span><i className="is-danger" />Thất bại</span></div><div className="mw-chart-plot" role="region" aria-label="Biểu đồ theo thời gian" tabIndex={0}><svg className="mw-timeline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Số công việc thành công và thất bại theo thời gian"><line x1={left} x2="880" y1="185" y2="185" stroke="#dfe8f3" /><text x="7" y="22">{number(max)}</text><text x="20" y="189">0</text>{rows.map((row, index) => { const x = left + step * (index + .5), success = (row.succeeded || 0) / max * 160, failed = (row.failed || 0) / max * 160; return <g key={row.start || index}><title>{row.localLabel || stamp(row.start)} · Thành công: {row.succeeded || 0} · Thất bại: {row.failed || 0}</title><rect x={x - bar} y={185 - success} width={bar} height={success} rx="2" fill="#54ad96" /><rect x={x + 1} y={185 - failed} width={bar} height={failed} rx="2" fill="#e48591" />{(index % Math.max(1, Math.ceil(rows.length / 7)) === 0 || index === rows.length - 1) && <text x={x} y="211" textAnchor="middle">{row.localLabel || stamp(row.start).split(' ')[0]}</text>}</g>; })}</svg></div><details className="mw-technical"><summary>Xem số liệu của biểu đồ</summary><div className="mw-table-scroll"><table><thead><tr><th>Thời điểm</th><th>Thành công</th><th>Thất bại</th><th>Cần phục hồi</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.start || index}><td>{row.localLabel || stamp(row.start)}</td><td>{number(row.succeeded)}</td><td>{number(row.failed)}</td><td>{number(row.recoveryRequired)}</td></tr>)}</tbody></table></div></details></>;
}
function Breakdown({ title, entries, onChoose }) {
  const max = Math.max(1, ...entries.map(row => row.total || 0));
  return <section className="mw-card mw-chart"><h3>{title}</h3>{!entries.length ? <Empty title="Chưa có số liệu phù hợp" /> : <ul className="mw-breakdown">{entries.slice(0, 10).map((row, index) => <li key={row.key || index}><div>{onChoose && isUuid(row.targetId) ? <button type="button" className="mw-link" onClick={() => onChoose(row)}>{row.label || 'Chưa có tên'} →</button> : <span>{row.label || 'Chưa có tên'}</span>}<strong>{number(row.total)}</strong></div><div className="mw-bar"><i style={{ width: `${Math.max(0, row.total || 0) / max * 100}%` }} /></div>{row.successRatePercent != null && <small>Thành công: {number(row.successRatePercent, '%')}</small>}</li>)}</ul>}{entries.some(row => row.successRatePercent != null) && <p className="mw-muted" style={{ marginTop: 16 }}>Tỷ lệ của nhóm tính trên công việc thành công và thất bại.</p>}{entries.length > 10 && <p className="mw-muted">Hiển thị 10 nhóm đầu tiên.</p>}</section>;
}
function Activity({ title, rows }) {
  return <section className="mw-card mw-chart"><h3>{title}</h3>{!rows.length ? <Empty title="Chưa có ghi nhận trong khoảng ngày này" /> : <div className="mw-table-scroll"><table><thead><tr><th>Địa điểm</th><th>Phát hiện</th><th>Cảnh báo</th><th>Sự cố</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.key || index}><td>{row.label || 'Chưa có tên'}</td><td>{number(row.detectionEvents)}</td><td>{number(row.alerts)}</td><td>{number(row.emergencyIncidents)}</td></tr>)}</tbody></table></div>}</section>;
}
function JobsReport({ value, page, loading, onPage }) {
  const rows = value.content || [];
  return <section className="mw-card mw-jobs-table"><div className="mw-table-scroll"><table><caption className="mw-sr-only">Công việc theo bộ lọc báo cáo</caption><thead><tr><th>Công việc</th><th>Quy trình</th><th>Robot</th><th>Kết quả</th><th>Bắt đầu</th><th>Thời gian chạy</th></tr></thead><tbody>{rows.map(row => <tr key={row.jobId}><td><Link className="mw-link" to={`/admin/live-operations?jobId=${encodeURIComponent(row.jobId)}`}>{row.jobCode || row.jobId.slice(0, 8)}</Link></td><td>{row.workflowCode || '—'}</td><td>{row.robotCode || '—'}</td><td><Badge value={row.status} /></td><td>{stamp(row.startedAt)}</td><td>{duration(row.durationSeconds)}</td></tr>)}</tbody></table>{!rows.length && <Empty title="Chưa có công việc phù hợp">Thử khoảng ngày khác hoặc thay đổi robot, quy trình và trạng thái.</Empty>}</div><Pager data={value} page={page} loading={loading} onChange={onPage} /></section>;
}
