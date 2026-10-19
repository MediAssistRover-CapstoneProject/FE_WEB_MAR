import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession } from '../../../features/auth/session.js';
import { callBackend } from '../../../features/api/backendApi.js';
import { recordTitle, recordTimestamp, statusTone } from '../../../features/api/workspaceCatalog.js';
import { displayValue } from './RecordDetails.jsx';
import './backend.css';
import './dashboard.css';
import './presentation.css';

const sources = [
  { id: 'robots', title: 'Robot', path: '/api/v1/robots', screen: 'Robot Status', link: 'Xem tất cả robot', empty: 'Chưa có robot nào.' },
  { id: 'jobs', title: 'Công việc gần đây', path: '/api/v1/jobs', screen: 'Live Operations', link: 'Xem công việc', empty: 'Chưa có công việc gần đây.' },
  { id: 'alerts', title: 'Cảnh báo', path: '/api/v1/alerts', screen: 'Alerts', link: 'Xem cảnh báo', empty: 'Không có cảnh báo nào.' },
];

const metrics = [
  { key: 'succeededJobs', label: 'Công việc thành công', symbol: '✓', tone: 'success' },
  { key: 'jobCompletionRatePercent', label: 'Tỷ lệ hoàn tất', symbol: '%', tone: 'primary', percent: true },
  { key: 'openAlerts', label: 'Cảnh báo đang mở', symbol: '!', tone: 'warning' },
  { key: 'activeEmergencyIncidents', label: 'Sự cố đang xử lý', symbol: '+', tone: 'danger' },
];

export default function BackendDashboard() {
  const [data, setData] = useState({}), [errors, setErrors] = useState({}), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const admin = getSession()?.account?.role === 'ADMIN';
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setErrors({}); setData({});
    const requests = admin ? [...sources, { id: 'overview', path: '/api/v1/admin/reports/overview' }] : sources;
    Promise.all(requests.map(async source => {
      try {
        let result = await callBackend(`GET ${source.path}`, { query: { page: 0, size: 5 } }, { signal: controller.signal });
        if (source.id === 'jobs') {
          const rows = result?.content || (Array.isArray(result) ? result : []);
          const workflowIds = [...new Set(rows.map(row => row.workflowId).filter(Boolean))];
          const names = new Map(await Promise.all(workflowIds.map(async id => {
            try {
              const detail = await callBackend(admin ? 'GET /api/v1/admin/workflows/{id}' : 'GET /api/v1/workflows/published/{id}', { path: { id } }, { signal: controller.signal });
              return [id, detail?.workflow?.workflowName || detail?.workflowName];
            } catch { return [id, undefined]; }
          })));
          const namedRows = rows.map(row => ({ ...row, workflowName: row.workflowName || names.get(row.workflowId) }));
          result = Array.isArray(result) ? namedRows : { ...result, content: namedRows };
        }
        if (!controller.signal.aborted) setData(prev => ({ ...prev, [source.id]: result }));
      } catch (e) { if (!controller.signal.aborted) setErrors(prev => ({ ...prev, [source.id]: e.message })); }
    })).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, revision]);
  const overview = data.overview;
  return <section className="be-workspace be-dashboard" aria-label="Tổng quan vận hành">
    <header className="be-dashboard-intro">
      <div><h2>Tổng quan vận hành</h2><p>Theo dõi robot, công việc và cảnh báo tại một nơi.</p></div>
      <button type="button" className="be-dashboard-refresh" disabled={loading} onClick={() => setRevision(v => v + 1)}><span aria-hidden="true">↻</span> Tải lại</button>
    </header>
    {loading && <p role="status" className="be-dashboard-loading">Đang tải dữ liệu…</p>}
    {errors.overview && <p role="alert" className="be-error">Không tải được tổng quan: {errors.overview}</p>}
    {overview && <div className="be-dashboard-metrics" aria-label="Số liệu tổng quan">{metrics.map(metric => {
      const value = overview[metric.key];
      const numericPercent = Number(value);
      return <article className={`be-dashboard-metric be-dashboard-metric--${Number(value) > 0 ? metric.tone : 'primary'}`} key={metric.key}>
        <div className="be-dashboard-metric-top"><span>{metric.label}</span><span className="be-dashboard-metric-symbol" aria-hidden="true">{metric.symbol}</span></div>
        <strong>{value == null ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}${metric.percent ? '%' : ''}`}</strong>
        {metric.percent && Number.isFinite(numericPercent) && <div className="be-dashboard-progress" role="progressbar" aria-label="Tỷ lệ hoàn tất" aria-valuenow={numericPercent} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${Math.max(0, Math.min(100, numericPercent))}%` }} /></div>}
      </article>;
    })}</div>}
    <div className="be-dashboard-grid">{sources.map(source => {
      const rows = data[source.id]?.content || (Array.isArray(data[source.id]) ? data[source.id] : []);
      return <article className={`be-dashboard-panel be-dashboard-panel--${source.id}`} key={source.id}>
        <header className="be-dashboard-panel-header"><div className="be-dashboard-panel-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{source.id === 'robots' ? <><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/></> : source.id === 'jobs' ? <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6M8 12l3 3 5-6"/></> : <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>}</svg></div><div><h3>{source.title}</h3><p>{rows.length ? `${rows.length} ${source.id === 'robots' ? 'robot trong danh sách' : source.id === 'jobs' ? 'công việc gần nhất' : 'cảnh báo gần nhất'}` : 'Thông tin hiện tại'}</p></div></header>
        {errors[source.id] ? <p role="alert" className="be-error">{errors[source.id]}</p> : rows.length ? <ul className="be-dashboard-list">{rows.map((row, i) => <li key={row.jobId || row.robotId || row.alertId || i}><div className="be-dashboard-row-copy"><strong title={recordTitle(row)}>{recordTitle(row)}</strong>{source.id !== 'robots' && recordTimestamp(row) && <small>{displayValue(recordTimestamp(row))}</small>}{row.batteryPercent != null && <small>Pin {row.batteryPercent}%</small>}</div>{(row.status || row.severity) && <span className={`be-dashboard-status be-tone-${statusTone(row.status || row.severity)}`}>{displayValue(row.status || row.severity)}</span>}</li>)}</ul> : !loading && <p className="be-dashboard-empty">{source.empty}</p>}
        <Link className="be-dashboard-link" to={`/admin?screen=${encodeURIComponent(source.screen)}`}>{source.link}<span aria-hidden="true">→</span></Link>
      </article>;
    })}</div>
  </section>;
}
