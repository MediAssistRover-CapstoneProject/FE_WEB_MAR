import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { callBackend, readCatalog } from '../../../features/api/backendApi.js';
import { getSession } from '../../../features/auth/session.js';
import { collectMediaReferences, listMedia, mediaKind, resolveMediaReference } from '../../../features/media/mediaApi.js';
import { INCIDENT_ACTIONS, INCIDENT_STATUSES, assertIncidentAction, incidentActions, incidentPresentation, incidentQuery, incidentTimeline, newerIncident } from '../../../features/operations/emergencyCenter.js';
import './emergencyCenter.css';

const ROOT = '/api/v1/emergency-incidents';
const PAGE_SIZE = 10;
const emptyFilters = { status: '', severity: '', type: '', mapId: '', from: '', to: '' };
const stamp = value => value != null && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Chưa ghi nhận';

function Icon({ name = 'shield' }) {
  const paths = {
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="M12 8v5m0 3v1" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    robot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Badge({ status }) {
  const info = INCIDENT_STATUSES[status] || { label: status || 'Chưa có trạng thái', tone: 'muted' };
  return <span className={`ec-badge ec-${info.tone}`}><i />{info.label}</span>;
}
function Severity({ value }) { return <span className={`ec-severity ${value === 'CRITICAL' ? 'is-critical' : ''}`}>{value === 'CRITICAL' ? 'Khẩn cấp' : value === 'WARNING' ? 'Cảnh báo' : 'Chưa rõ mức độ'}</span>; }
function useTick(auto, revision) {
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!auto) return; const timer = setInterval(() => { if (document.visibilityState === 'visible') setTick(value => value + 1); }, 15000); return () => clearInterval(timer); }, [auto]);
  return `${revision}:${tick}`;
}
function Freshness({ at, failed }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const stale = failed || !at || now - at >= 45000;
  return <span className={`ec-freshness ${stale ? 'is-stale' : ''}`} role="status"><i />{!at ? 'Chưa có dữ liệu' : stale ? `Dữ liệu có thể đã cũ · nhận lúc ${stamp(at)}` : `Đã nhận từ máy chủ lúc ${stamp(at)}`}</span>;
}

function MediaCard({ item, compact = false }) {
  const [failed, setFailed] = useState(false);
  const kind = item.mediaType || mediaKind(item.url || item.objectKey);
  return <article className={`ec-media-card ${compact ? 'is-compact' : ''}`}>
    <div className="ec-media-preview">{failed ? <span>Không tải được media</span> : kind === 'VIDEO'
      ? <video src={item.url} controls playsInline preload="metadata" onError={() => setFailed(true)}>Trình duyệt không hỗ trợ video.</video>
      : <img src={item.url} alt="Bằng chứng hình ảnh từ máy chủ" loading="lazy" onError={() => setFailed(true)} />}</div>
    <footer><span>{kind === 'VIDEO' ? 'Video' : 'Hình ảnh'}</span><a href={item.url} target="_blank" rel="noreferrer">Mở bản gốc</a></footer>
  </article>;
}

function MediaLibrary() {
  const [type, setType] = useState(''), [items, setItems] = useState([]), [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const request = useRef(null);
  const load = async (nextCursor = '', append = false) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try {
      const result = await listMedia({ mediaType: type, cursor: nextCursor, size: 12, signal: controller.signal });
      if (!Array.isArray(result?.content)) throw Error('Danh sách media không đúng định dạng.');
      setItems(previous => append ? [...previous, ...result.content] : result.content);
      setCursor(result.nextCursor || '');
    } catch (cause) { if (!controller.signal.aborted) setError(cause.message || 'Không tải được media.'); }
    finally { if (!controller.signal.aborted) setLoading(false); if (request.current === controller) request.current = null; }
  };
  useEffect(() => { load(); return () => request.current?.abort(); }, [type, revision]);
  return <section className="ec-media-library" aria-label="Thư viện hình ảnh và video">
    <header><div><h3>Hình ảnh & video từ máy chủ</h3><p>Dữ liệu media đã tải lên và đang được BE cung cấp cho giao diện.</p></div><button className="ec-button" onClick={() => setRevision(value => value + 1)} disabled={loading}><Icon name="refresh" />Tải lại</button></header>
    <div className="ec-media-tabs" role="group" aria-label="Loại media">{[['', 'Tất cả'], ['IMAGE', 'Hình ảnh'], ['VIDEO', 'Video']].map(([value, label]) => <button key={label} className={type === value ? 'is-active' : ''} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>)}</div>
    {error && <div className="ec-notice ec-error" role="alert"><span>{error}</span><button className="ec-text-button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>}
    {!items.length && loading ? <div className="ec-media-empty">Đang tải hình ảnh và video…</div> : !items.length ? <div className="ec-media-empty">Máy chủ chưa có media thuộc nhóm này.</div> : <div className="ec-media-grid">{items.map(item => <MediaCard key={item.objectKey} item={item} />)}</div>}
    {cursor && <button className="ec-button ec-media-more" disabled={loading} onClick={() => load(cursor, true)}>{loading ? 'Đang tải…' : 'Tải thêm media'}</button>}
  </section>;
}

function IncidentEvidence({ incident }) {
  const references = collectMediaReferences([incident.sourceEvidenceRef, incident.resolutionEvidence]);
  const signature = references.join('|');
  const [items, setItems] = useState([]), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setItems([]); setError('');
    if (!references.length) return () => controller.abort();
    Promise.allSettled(references.map(reference => resolveMediaReference(reference, { signal: controller.signal }))).then(results => {
      if (controller.signal.aborted) return;
      setItems(results.filter(result => result.status === 'fulfilled').map(result => result.value));
      if (results.some(result => result.status === 'rejected')) setError('Một số bằng chứng media không còn truy cập được.');
    });
    return () => controller.abort();
  }, [signature]);
  if (!references.length && !incident.resolutionNote) return null;
  return <section className="ec-evidence"><header><div><h4>Bằng chứng sự cố</h4><p>Ảnh và video được liên kết với bản ghi trong DB.</p></div></header>
    {incident.resolutionNote && <p className="ec-resolution-note"><strong>Kết quả xử lý:</strong> {incident.resolutionNote}</p>}
    {error && <p className="ec-inline-warning">{error}</p>}
    {references.length > 0 && !items.length && !error && <div className="ec-media-empty">Đang tải bằng chứng…</div>}
    {items.length > 0 && <div className="ec-media-grid ec-evidence-grid">{items.map((item, index) => <MediaCard compact key={`${item.objectKey || item.url}-${index}`} item={item} />)}</div>}
  </section>;
}

export default function EmergencyCenterPage() {
  const account = getSession()?.account || {};
  const monitoring = account.role !== 'STAFF';
  const [auto, setAuto] = useState(true), [revision, setRevision] = useState(0);
  const [catalogs, setCatalogs] = useState({ robots: [], maps: [], endpoints: [], staff: [] }), [catalogWarning, setCatalogWarning] = useState('');
  const [filters, setFilters] = useState(emptyFilters), [page, setPage] = useState(0);
  const [result, setResult] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [loadedAt, setLoadedAt] = useState(null);
  const [counts, setCounts] = useState(null), [countError, setCountError] = useState(false), [selectedId, setSelectedId] = useState(null), [toast, setToast] = useState('');
  const tick = useTick(auto, revision), filterSignature = JSON.stringify(filters);
  const readIdentity = `${filterSignature}:${page}`;
  const listRequest = useRef(null), countsRequest = useRef(null), knownIdentity = useRef(readIdentity);
  useEffect(() => () => { listRequest.current?.controller.abort(); countsRequest.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const sources = { robots: 'GET /api/v1/robots', maps: 'GET /api/v1/maps', endpoints: 'GET /api/v1/endpoints', ...(account.role === 'ADMIN' ? { staff: 'GET /api/v1/admin/staff' } : {}) };
    Promise.allSettled(Object.values(sources).map(key => readCatalog(key, { signal: controller.signal }))).then(results => {
      if (controller.signal.aborted) return;
      setCatalogs(previous => ({ ...previous, ...Object.fromEntries(Object.keys(sources).map((key, index) => [key, results[index].status === 'fulfilled' ? results[index].value : previous[key]])) }));
      setCatalogWarning(results.some(row => row.status === 'rejected') ? 'Một số tên vị trí hoặc người phụ trách chưa tải được. Tạm hiển thị mã tra cứu.' : '');
    });
    return () => controller.abort();
  }, [account.role]);
  useEffect(() => {
    if (countsRequest.current && !countsRequest.current.signal.aborted) return;
    const controller = new AbortController(); countsRequest.current = controller;
    Promise.allSettled(Object.keys(INCIDENT_STATUSES).map(status => callBackend(`GET ${ROOT}`, { query: { status, page: 0, size: 1 } }, { signal: controller.signal }))).then(results => {
      if (controller.signal.aborted) return;
      if (results.some(row => row.status === 'rejected')) { setCountError(true); return; }
      setCounts(Object.fromEntries(Object.keys(INCIDENT_STATUSES).map((key, index) => [key, results[index].value.totalElements]))); setCountError(false);
    }).finally(() => { if (countsRequest.current === controller) countsRequest.current = null; });
  }, [tick]);
  useEffect(() => {
    const identity = readIdentity;
    if (listRequest.current?.identity === identity && !listRequest.current.controller.signal.aborted) return;
    listRequest.current?.controller.abort();
    const controller = new AbortController(); listRequest.current = { identity, controller };
    if (knownIdentity.current !== identity) { knownIdentity.current = identity; setResult(null); setSelectedId(null); setLoadedAt(null); }
    setLoading(true);
    let query;
    try { query = incidentQuery(filters); } catch (cause) { setError(cause.message); setLoading(false); listRequest.current = null; return; }
    callBackend(`GET ${ROOT}`, { query: { ...query, page, size: PAGE_SIZE } }, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(value?.content)) throw Error('Danh sách sự cố không đúng định dạng.');
      if (page > 0 && value.totalPages <= page) { setPage(Math.max(0, value.totalPages - 1)); return; }
      setResult(value); setError(''); setLoadedAt(Date.now());
      setSelectedId(current => current || value.content[0]?.incidentId || null);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Không tải được sự cố.'); }).finally(() => { if (listRequest.current?.controller === controller) listRequest.current = null; if (!controller.signal.aborted) setLoading(false); });
  }, [tick, readIdentity]);
  const rows = result?.content || [];
  const updateFilter = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(0); };
  const resetFilters = () => { setFilters(emptyFilters); setPage(0); };
  const total = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : null;
  const metrics = [
    { label: 'Chờ tiếp nhận', value: counts?.OPEN, icon: 'shield', tone: 'danger' },
    { label: 'Đã nhận / đang xử lý', value: counts ? counts.ACKNOWLEDGED + counts.IN_PROGRESS : null, icon: 'user', tone: 'blue' },
    { label: 'Chờ đóng hồ sơ', value: counts?.RESOLVED, icon: 'clock', tone: 'amber' },
    { label: 'Đã đóng / báo động nhầm', value: counts ? counts.CLOSED + counts.FALSE_ALARM : null, icon: 'check', tone: 'green' },
  ];
  const hasFilters = Object.values(filters).some(Boolean);
  const refresh = () => setRevision(value => value + 1);
  return <section className="ec-page" aria-label="Xử lý sự cố khẩn cấp">
    <header className="ec-header"><div className="ec-title"><span className="ec-title-icon"><Icon /></span><div><h2>{monitoring ? 'Giám sát SOS' : 'Tiếp nhận & xử lý sự cố'}</h2><p>{monitoring ? 'Theo dõi sự cố, staff phụ trách và tiến trình xử lý.' : 'Theo dõi yêu cầu khẩn cấp, người phụ trách và kết quả xử lý.'}</p></div></div><div className="ec-header-actions"><label className="ec-auto"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />Tự cập nhật</label><button className="ec-button" onClick={refresh} disabled={loading}><Icon name="refresh" />Tải lại</button></div></header>
    {monitoring && <p className="ec-monitoring-note">Chế độ giám sát · Staff tiếp nhận và cập nhật kết quả xử lý SOS.</p>}
    <div className="ec-overview-caption"><span>Toàn bộ sự cố trong phạm vi tài khoản{total != null ? ` · ${total} sự cố` : ''}</span><span>{auto ? 'Làm mới mỗi 15 giây' : 'Tự cập nhật đang tắt'}</span></div>
    <div className="ec-metrics">{metrics.map(metric => <article key={metric.label} className={`ec-metric ec-${metric.tone}`}><div><span>{metric.label}</span><strong>{metric.value ?? '—'}</strong></div><span className="ec-metric-icon"><Icon name={metric.icon} /></span></article>)}</div>
    <MediaLibrary />
    {countError && <p className="ec-inline-warning" role="status">Chưa cập nhật được số liệu tổng quan. {counts ? 'Đang giữ số liệu lần trước.' : 'Số liệu sẽ hiện khi máy chủ kết nối lại.'}</p>}
    {catalogWarning && <p className="ec-inline-warning">{catalogWarning}</p>}
    {toast && <div className="ec-notice ec-success" role="status"><span>{toast}</span><button className="ec-text-button" onClick={() => setToast('')}>Đóng thông báo</button></div>}
    <section className="ec-filters" aria-label="Bộ lọc sự cố"><div className="ec-filter-main"><label>Trạng thái<select aria-label="Trạng thái sự cố" value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(INCIDENT_STATUSES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><label>Mức độ<select aria-label="Mức độ sự cố" value={filters.severity} onChange={event => updateFilter('severity', event.target.value)}><option value="">Tất cả mức độ</option><option value="CRITICAL">Khẩn cấp</option><option value="WARNING">Cảnh báo</option></select></label><label>Loại sự cố<select aria-label="Loại sự cố" value={filters.type} onChange={event => updateFilter('type', event.target.value)}><option value="">Tất cả loại</option><option value="SOS">Yêu cầu SOS</option><option value="SUSPECTED_FALL">Nghi ngờ có người ngã</option></select></label>{hasFilters && <button className="ec-text-button" onClick={resetFilters}>Xóa bộ lọc</button>}</div><details><summary>Lọc theo vị trí và thời gian</summary><div className="ec-filter-extra"><label>Bản đồ<select aria-label="Bản đồ sự cố" value={filters.mapId} onChange={event => updateFilter('mapId', event.target.value)}><option value="">Tất cả bản đồ</option>{catalogs.maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName || map.mapCode}</option>)}</select></label><label>Từ ngày<input type="date" aria-label="Từ ngày" value={filters.from} max={filters.to || undefined} onChange={event => updateFilter('from', event.target.value)} /></label><label>Đến ngày<input type="date" aria-label="Đến ngày" value={filters.to} min={filters.from || undefined} onChange={event => updateFilter('to', event.target.value)} /></label></div></details></section>
    {error && <div className="ec-notice ec-error" role="alert"><span>{error}{result && ' Đang giữ danh sách đã tải.'}</span><button className="ec-text-button" onClick={refresh}>Thử lại</button></div>}
    <div className="ec-layout"><aside className="ec-list-panel" aria-label="Danh sách sự cố"><header><div><h3>Danh sách sự cố</h3><p>{result ? `${result.totalElements} kết quả · mới nhất trước` : 'Đang kết nối máy chủ'}</p></div>{loading && result && <span className="ec-updating">Đang cập nhật</span>}</header><div className="ec-list-meta"><Freshness at={loadedAt} failed={!!error} /></div>
      <div className="ec-list">{!result && loading ? <div className="ec-empty" role="status">Đang tải sự cố…</div> : !rows.length ? <div className="ec-empty"><Icon name={error ? 'shield' : 'check'} /><strong>{error ? 'Chưa tải được danh sách' : hasFilters ? 'Không có sự cố phù hợp' : 'Chưa có sự cố được ghi nhận'}</strong><p>{error ? 'Kiểm tra kết nối và thử lại.' : hasFilters ? 'Thử thay đổi điều kiện lọc.' : 'Sự cố mới sẽ xuất hiện khi máy chủ ghi nhận.'}</p>{hasFilters && <button className="ec-button" onClick={resetFilters}>Xóa bộ lọc</button>}</div> : rows.map(incident => {
        const info = incidentPresentation(incident, catalogs, account);
        return <button key={incident.incidentId} className={`ec-incident ${incident.incidentId === selectedId ? 'is-selected' : ''} ${incident.severity === 'CRITICAL' && incident.status === 'OPEN' ? 'is-urgent' : ''}`} aria-pressed={incident.incidentId === selectedId} onClick={() => { setSelectedId(incident.incidentId); if (innerWidth <= 760) requestAnimationFrame(() => document.querySelector('.ec-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' })); }}><div className="ec-incident-top"><Severity value={incident.severity} /><small>#{incident.incidentId.slice(-6).toUpperCase()}</small></div><strong>{info.title}</strong><span className="ec-location"><Icon name="pin" />{info.endpoint}</span><span className="ec-location"><Icon name="robot" />{info.robot}</span><div className="ec-incident-bottom"><Badge status={incident.status} /><Icon name="arrow" /></div><time>{stamp(incident.occurredAt)}</time></button>;
      })}</div><footer className="ec-pagination"><button className="ec-button" aria-label="Trang sự cố trước" disabled={!page || loading} onClick={() => setPage(value => value - 1)}>←</button><span>Trang {page + 1}/{Math.max(1, result?.totalPages || 0)}</span><button className="ec-button" aria-label="Trang sự cố sau" disabled={loading || !result || page + 1 >= result.totalPages} onClick={() => setPage(value => value + 1)}>→</button></footer>
    </aside>{selectedId ? <IncidentDetail key={selectedId} id={selectedId} account={account} catalogs={catalogs} tick={tick} retained={!!result && !rows.some(row => row.incidentId === selectedId)} onSaved={value => { setToast(value); refresh(); }} /> : <section className="ec-detail ec-detail-empty"><span className="ec-empty-icon"><Icon /></span><h3>Chi tiết sự cố</h3><p>Chọn một sự cố để xem vị trí, tiến trình và thao tác tiếp theo.</p></section>}</div>
  </section>;
}

function IncidentDetail({ id, account, catalogs, tick, retained, onSaved }) {
  const [incident, setIncident] = useState(null), [error, setError] = useState(''), [at, setAt] = useState(null), [retry, setRetry] = useState(0), [dialog, setDialog] = useState(null);
  const request = useRef(null), current = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const accept = useCallback(value => { if (value?.incidentId !== id) throw Error('Chi tiết không khớp sự cố đang chọn.'); const next = newerIncident(current.current, value); current.current = next; setIncident(next); setError(''); setAt(Date.now()); return next; }, [id]);
  useEffect(() => {
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController(); request.current = controller;
    callBackend(`GET ${ROOT}/{id}`, { path: { id } }, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) accept(value); }).catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Không tải được chi tiết.'); }).finally(() => { if (request.current === controller) request.current = null; });
  }, [id, tick, retry, accept]);
  if (!incident) return <section className="ec-detail"><div className="ec-empty" role={error ? 'alert' : 'status'}>{error || 'Đang tải chi tiết…'}{error && <button className="ec-button" onClick={() => setRetry(value => value + 1)}>Thử lại</button>}</div></section>;
  const info = incidentPresentation(incident, catalogs, account), actions = incidentActions(incident, account), primary = actions.find(action => action !== 'false-alarm');
  const monitoring = account.role !== 'STAFF';
  const restricted = !monitoring && ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status) && !actions.length;
  const guidance = (monitoring ? { OPEN: 'Đang chờ staff tiếp nhận và xác minh tình huống thực tế.', ACKNOWLEDGED: 'Staff đã tiếp nhận. Theo dõi người phụ trách và các mốc xử lý bên dưới.', IN_PROGRESS: 'Staff đang xử lý sự cố. Kết quả sẽ cập nhật khi được máy chủ ghi nhận.', RESOLVED: 'Staff đã ghi nhận xử lý xong. Hồ sơ đang chờ được đóng.', CLOSED: 'Hồ sơ đã đóng. Có thể tiếp tục tra cứu thông tin.', FALSE_ALARM: 'Sự cố đã được xác nhận là báo động nhầm.' } : { OPEN: 'Cần người tiếp nhận và xác minh tình huống thực tế.', ACKNOWLEDGED: 'Đã có người tiếp nhận. Bắt đầu xử lý khi triển khai hỗ trợ.', IN_PROGRESS: 'Ghi nhận kết quả sau khi hoàn thành xử lý thực tế.', RESOLVED: 'Đã xử lý xong. Kiểm tra kết quả trước khi đóng hồ sơ.', CLOSED: 'Hồ sơ đã đóng. Có thể tiếp tục tra cứu thông tin.', FALSE_ALARM: 'Sự cố đã được xác nhận là báo động nhầm.' })[incident.status] || 'Kiểm tra thông tin sự cố từ máy chủ.';
  return <article className="ec-detail" aria-label="Chi tiết sự cố"><header className="ec-detail-header"><div><div className="ec-detail-kicker"><Severity value={incident.severity} /><Badge status={incident.status} /></div><h3>{info.title}</h3><p className="ec-reference">Mã tra cứu · {incident.incidentId.slice(-8).toUpperCase()}</p></div><span className={`ec-incident-symbol ${incident.severity === 'CRITICAL' ? 'is-critical' : ''}`}><Icon /></span></header>
    <Freshness at={at} failed={!!error} />
    {retained && <p className="ec-inline-warning">Đang giữ chi tiết đã chọn. Sự cố này không còn trong trang danh sách hiện tại.</p>}
    {error && <div className="ec-notice ec-error" role="alert"><span>{error} {monitoring ? 'Đang giữ chi tiết lần tải trước.' : 'Đang giữ chi tiết cũ; tạm khóa thao tác.'}</span><button className="ec-text-button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div>}
    <section className={`ec-next-step ${incident.status === 'OPEN' && incident.severity === 'CRITICAL' ? 'is-urgent' : ''}`}><div><strong>{INCIDENT_STATUSES[incident.status]?.label || incident.status}</strong><p>{restricted ? 'Sự cố do nhân viên khác tiếp nhận. Chỉ staff phụ trách có thể tiếp tục xử lý trên giao diện này.' : guidance}</p></div>{primary && <button className="ec-button ec-primary" disabled={!!error} onClick={() => setDialog({ action: primary, snapshot: incident })}>{INCIDENT_ACTIONS[primary].title}<Icon name="arrow" /></button>}</section>
    <section className="ec-description"><h4>Nội dung sự cố</h4><p>{incident.description || 'Máy chủ chưa ghi nhận mô tả.'}</p></section>
    <IncidentEvidence incident={incident} />
    <div className="ec-info-grid"><section className="ec-info-card"><h4><Icon name="pin" />Vị trí & nguồn ghi nhận</h4><dl><div><dt>Điểm xảy ra</dt><dd>{info.endpoint}</dd></div><div><dt>Bản đồ</dt><dd>{info.map}</dd></div><div><dt>Robot</dt><dd>{info.robot}</dd></div>{info.coordinates && <div><dt>Tọa độ X · Y</dt><dd>{info.coordinates}</dd></div>}</dl></section><section className="ec-info-card"><h4><Icon name="user" />Người phụ trách</h4><dl><div><dt>Tiếp nhận</dt><dd>{info.owner}</dd></div>{info.resolver && <div><dt>Xác nhận kết quả</dt><dd>{info.resolver}</dd></div>}<div><dt>Ghi nhận lúc</dt><dd>{stamp(incident.occurredAt)}</dd></div></dl></section></div>
    <section className="ec-timeline"><h4>Tiến trình xử lý</h4><p>Các mốc thời gian do máy chủ ghi nhận.</p><ol>{incidentTimeline(incident).map((item, index) => <li className={`${item.done ? 'is-done' : ''} ${item.current ? 'is-current' : ''}`} key={`${item.label}-${index}`}><span className="ec-timeline-dot">{item.done ? <Icon name="check" /> : <Icon name="clock" />}</span><div><strong>{item.label}</strong><time>{item.at ? stamp(item.at) : 'Chưa ghi nhận thời điểm'}</time></div></li>)}</ol></section>
    <div className="ec-detail-footer"><p>Việc xử lý sự cố và việc robot thực thi được theo dõi riêng.</p><Link to="/admin/live-operations">Mở vận hành trực tiếp <Icon name="arrow" /></Link>{actions.includes('false-alarm') && <button className="ec-text-button ec-false-alarm" disabled={!!error} onClick={() => setDialog({ action: 'false-alarm', snapshot: incident })}>Đánh dấu báo động nhầm</button>}</div>
    <details className="ec-technical"><summary>Mã tra cứu & thông tin kỹ thuật</summary><dl>{[['ID sự cố', incident.incidentId], ['ID robot', incident.robotId], ['ID bản đồ', incident.mapId], ['ID điểm', incident.endpointId], ['ID người tiếp nhận', incident.acknowledgedByAccountId], ['ID người xử lý', incident.resolvedByAccountId], ['Phiên bản bản ghi', incident.rowVersion]].filter(([, value]) => value != null).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></details>
    {dialog && !monitoring && <IncidentDialog {...dialog} account={account} accept={accept} latest={() => current.current} onClose={() => setDialog(null)} onSaved={value => { setDialog(null); onSaved(value); }} />}
  </article>;
}

function IncidentDialog({ action, snapshot, account, accept, latest, onClose, onSaved }) {
  const ref = useRef(null), lock = useRef(false), controller = useRef(null);
  const [busy, setBusy] = useState(false), [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false), [error, setError] = useState('');
  const config = INCIDENT_ACTIONS[action];
  useEffect(() => { const previousFocus = document.activeElement; ref.current?.showModal(); return () => { controller.current?.abort(); if (previousFocus?.isConnected) previousFocus.focus(); }; }, []);
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    if (!confirmed) { setError('Vui lòng kiểm tra thông tin và xác nhận thao tác.'); return; }
    if (config.note && !note.trim()) { setError('Vui lòng ghi rõ kết quả hoặc lý do xử lý.'); return; }
    lock.current = true; setBusy(true); controller.current = new AbortController();
    try {
      const received = await callBackend(`GET ${ROOT}/{id}`, { path: { id: snapshot.incidentId } }, { signal: controller.current.signal });
      const fresh = accept(received);
      assertIncidentAction(action, snapshot, fresh, account);
      assertIncidentAction(action, snapshot, latest() || fresh, account);
      const output = await callBackend(`POST ${ROOT}/{id}/${action}`, { path: { id: snapshot.incidentId }, ...(config.note ? { body: { resolutionNote: note.trim() } } : {}) }, { signal: controller.current.signal });
      accept(output); onSaved(`Đã thực hiện: ${config.title.toLowerCase()}.`);
    } catch (cause) { if (!controller.current.signal.aborted) setError(cause.message || 'Không thực hiện được thao tác.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <dialog className="ec-dialog" ref={ref} aria-label={config.title} onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}><header><div><small>XÁC NHẬN THAO TÁC</small><h3>{config.title}</h3></div><button type="button" className="ec-text-button" aria-label="Đóng biểu mẫu" disabled={busy} onClick={onClose}>Đóng</button></header><p>{config.description}</p><div className="ec-dialog-context"><Badge status={snapshot.status} /><span>#{snapshot.incidentId.slice(-8).toUpperCase()}</span></div><form onSubmit={submit}><fieldset disabled={busy}>{config.note && <label>Ghi chú xử lý<textarea aria-label="Ghi chú xử lý" value={note} onChange={event => setNote(event.target.value)} maxLength={4000} required placeholder="Nêu kết quả kiểm tra và cách xử lý thực tế…" /></label>}<label className="ec-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi đã kiểm tra sự cố và xác nhận thao tác này.</label></fieldset>{error && <p className="ec-notice ec-error" role="alert">{error}</p>}<footer><button className="ec-button" type="button" disabled={busy} onClick={onClose}>Quay lại</button><button className={`ec-button ${action === 'false-alarm' ? 'ec-destructive' : 'ec-primary'}`} disabled={busy} type="submit">{busy ? 'Đang kiểm tra và gửi…' : 'Xác nhận'}</button></footer></form></dialog>;
}
