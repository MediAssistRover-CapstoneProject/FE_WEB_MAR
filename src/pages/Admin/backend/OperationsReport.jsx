import { fieldLabel } from '../../../features/api/workspaceCatalog.js';
import { displayValue } from './RecordDetails.jsx';

export default function OperationsReport({ value }) {
  const metrics = ['succeededJobs', 'jobCompletionRatePercent', 'openAlerts', 'activeEmergencyIncidents'];
  return <section className="be-report" aria-label="Số liệu vận hành">
    <div className="be-report-meta"><span>Tổng hợp từ hoạt động hệ thống</span>{value.generatedAt && <span>Cập nhật: {displayValue(value.generatedAt)}</span>}</div>
    <div className="be-report-metrics">{metrics.map(key => <article key={key}><span>{fieldLabel(key).replace(' (%)', '')}</span><strong>{value[key] == null ? '—' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value[key])}${key.endsWith('Percent') ? '%' : ''}`}</strong></article>)}</div>
    {value.terminalJobs != null && <p className="be-muted">Đã có {value.terminalJobs} công việc kết thúc.</p>}
    <div className="be-report-groups">{['jobsByStatus', 'robotsByStatus', 'requestsByType'].map(key => {
      const entries = Object.entries(value[key] || {}).filter(([, count]) => typeof count === 'number');
      const total = entries.reduce((sum, [, count]) => sum + count, 0);
      return <article className="be-card" key={key}><h3>{fieldLabel(key)}</h3>{entries.length ? <ul className="be-report-breakdown">{entries.map(([label, count]) => <li key={label}><div><span>{displayValue(label)}</span><strong>{count.toLocaleString('vi-VN')}</strong></div><div className="be-report-bar" aria-hidden="true"><span style={{ width: `${total > 0 ? count / total * 100 : 0}%` }} /></div></li>)}</ul> : <p className="be-empty">Chưa có dữ liệu thống kê.</p>}</article>;
    })}</div>
  </section>;
}
