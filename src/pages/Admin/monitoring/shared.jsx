import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../liveOperations/OperationsIcon.jsx';
import RecordDetails, { displayValue } from '../backend/RecordDetails.jsx';
import { vi } from '../../../i18n/vi.js';
import { alertStates, severityLabels } from '../../../features/monitoring/monitoringModel.js';

export const stamp = value => value != null && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận';
export const number = (value, suffix = '') => typeof value === 'number' && Number.isFinite(value) ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)}${suffix}` : '—';
export function revealDetail(id, mobileOnly = false) {
  if (mobileOnly && window.innerWidth > 900) return;
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
}
export function Badge({ value, severity = false }) {
  const tone = ['CRITICAL', 'FAILED', 'RECOVERY_REQUIRED', 'ERROR'].includes(value) ? 'danger' : ['WARNING', 'OPEN', 'HIGH'].includes(value) ? 'warning' : ['SUCCEEDED', 'RESOLVED', 'CLOSED', 'LOW'].includes(value) ? 'success' : 'info';
  return <span className={`mw-badge mw-${tone}`}>{(severity ? severityLabels[value] : alertStates[value]) || vi(value || 'Chưa ghi nhận')}</span>;
}
export function Frame({ title, description, icon = 'activity', children, actions }) {
  return <section className="mw-page" aria-label={title}><header className="mw-banner"><div className="mw-heading"><span className="mw-heading-icon"><Icon name={icon} /></span><div><span className="mw-kicker">GIÁM SÁT HỆ THỐNG</span><h2>{title}</h2><p>{description}</p></div></div>{actions && <div className="mw-actions">{actions}</div>}</header>{children}</section>;
}
export function RefreshButton({ feed }) { return <button type="button" className="mw-button" disabled={feed.loading} onClick={feed.refresh}><Icon name="refresh" />{feed.loading && feed.value ? 'Đang cập nhật' : 'Tải lại'}</button>; }
export function FeedStatus({ feed, auto }) {
  return <div className="mw-feed"><span role="status"><i className={feed.stale ? 'is-stale' : ''} />{feed.loading ? (feed.value ? 'Đang cập nhật, giữ dữ liệu đang xem' : 'Đang tải dữ liệu…') : feed.receivedAt ? `Cập nhật: ${stamp(feed.receivedAt)}` : 'Chưa nhận dữ liệu'}{auto === false && ' · Tự cập nhật đang tắt'}</span>{feed.value && feed.stale && <span>Dữ liệu lần tải thành công trước</span>}</div>;
}
export function FeedError({ feed }) { return feed.error ? <div className="mw-notice mw-notice-error" role="alert"><Icon name="alert" /><div><strong>Chưa cập nhật được dữ liệu</strong><p>{vi(feed.error)}{feed.value ? ' Đang giữ lần tải thành công gần nhất.' : ''}</p></div><button className="mw-button" onClick={feed.refresh}>Thử lại</button></div> : null; }
export function Notice({ children, danger = false }) { return <div className={`mw-notice${danger ? ' mw-notice-error' : ''}`} role={danger ? 'alert' : 'status'}><Icon name={danger ? 'alert' : 'activity'} /><div>{children}</div></div>; }
export function Tabs({ items, active, onChange, label }) { return <nav className="mw-tabs" aria-label={label}>{items.map(([key, title]) => <button key={key} type="button" aria-pressed={key === active} onClick={() => onChange(key)}>{title}</button>)}</nav>; }
export function Field({ label, children, className = '' }) {
  const id = useId();
  return <div className={`mw-field ${className}`}><label htmlFor={id}>{label}</label>{Children.map(children, child => isValidElement(child) && ['input', 'select', 'textarea'].includes(child.type) ? cloneElement(child, { id }) : child)}</div>;
}
export function SelectField({ label, value, onChange, options, empty = 'Tất cả' }) { return <Field label={label}><select value={value || ''} onChange={event => onChange(event.target.value)}><option value="">{empty}</option>{options.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></Field>; }
export function DateFields({ value, onChange, required = false }) { return <><Field className="mw-date" label={`Từ ngày${required ? ' *' : ''}`}><input type="date" required={required} value={value.from || ''} max={value.to || undefined} onChange={event => onChange({ ...value, from: event.target.value })} /></Field><Field className="mw-date" label={`Đến ngày${required ? ' *' : ''}`}><input type="date" required={required} value={value.to || ''} min={value.from || undefined} onChange={event => onChange({ ...value, to: event.target.value })} /></Field></>; }
export function Filters({ children, onApply, onReset, error, note = 'Thời gian hiển thị theo giờ Việt Nam (GMT+7).' }) { return <form className="mw-filters" onSubmit={event => { event.preventDefault(); onApply(); }}><div className="mw-filter-fields">{children}</div><div className="mw-filter-bottom"><small>{note}</small><div className="mw-actions"><button type="button" className="mw-button" onClick={onReset}>Đặt lại</button><button className="mw-button mw-primary" type="submit">Áp dụng bộ lọc</button></div></div>{error && <p className="mw-form-error" role="alert">{error}</p>}</form>; }
export function Pager({ data, page, onChange, loading }) { return <footer className="mw-pagination"><span>{number(data?.totalElements)} kết quả · Trang {page + 1}{data?.totalPages ? ` / ${data.totalPages}` : ''}</span><div><button className="mw-button" disabled={!page || loading} onClick={() => onChange(page - 1)}>Trang trước</button><button className="mw-button" disabled={loading || !data || (data.totalPages != null ? page + 1 >= data.totalPages : data.content?.length < 20)} onClick={() => onChange(page + 1)}>Trang sau</button></div></footer>; }
export function Empty({ children = 'Chưa có dữ liệu phù hợp.', title = 'Chưa có kết quả' }) { return <div className="mw-empty"><span><Icon name="list" /></span><h3>{title}</h3><p>{children}</p></div>; }
export function Technical({ value }) { return <details className="mw-technical"><summary>Mã tham chiếu và thông tin kỹ thuật</summary><RecordDetails value={value} /></details>; }
export function Facts({ items }) { return <dl className="mw-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>; }
export function CatalogSelect({ label, value, onChange, rows = [], idKey, nameKey }) { return <SelectField label={label} value={value} onChange={onChange} options={rows.map(row => [row[idKey], row[nameKey] || row[idKey]])} />; }
export function RelatedJob({ jobId }) { return jobId ? <Link className="mw-link" to={`/admin/live-operations?jobId=${encodeURIComponent(jobId)}`}>Mở công việc liên quan →</Link> : null; }
export function Metrics({ items }) { return <div className="mw-metrics">{items.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>)}</div>; }
export function Modal({ title, children, onClose, busy }) {
  const ref = useRef(null), trigger = useRef(document.activeElement);
  useEffect(() => { const node = ref.current; node.showModal(); return () => { node.close(); trigger.current?.focus?.(); }; }, []);
  return <dialog className="mw-dialog" ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><header><h3>{title}</h3><button type="button" className="mw-button" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}>×</button></header>{children}</dialog>;
}
export { displayValue };
