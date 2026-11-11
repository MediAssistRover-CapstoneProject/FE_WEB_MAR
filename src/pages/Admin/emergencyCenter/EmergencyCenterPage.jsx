import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { callBackend, readCatalog } from '../../../features/api/backendApi.js';
import { getSession } from '../../../features/auth/session.js';
import { collectMediaReferences, mediaKind, resolveMediaReference } from '../../../features/media/mediaApi.js';
import { INCIDENT_ACTIONS, INCIDENT_STATUSES, assertIncidentAction, incidentActions, incidentPresentation, incidentQuery, incidentTimeline, newerIncident } from '../../../features/operations/emergencyCenter.js';
import { ACTIVE_INCIDENT_STATUSES, HISTORY_INCIDENT_STATUSES, WAIT_WARNING_MINUTES, SOS_ROUTING_LABELS, filterActiveIncidents, hasIncidentResponder, incidentOverdue, loadIncidentHistory } from '../../../features/operations/emergencyCenter.js';
import { IncidentMap, IncidentRobot } from './IncidentContext.jsx';
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

  return <section className="ec-evidence"><header><div><h4>Bằng chứng sự cố</h4><p>Ảnh và video được đính kèm riêng cho sự cố này.</p></div></header>
    {!references.length && <div className="ec-evidence-empty"><Icon name="shield" /><span>Chưa có ảnh hoặc video đính kèm sự cố.</span></div>}
    {incident.resolutionNote && <p className="ec-resolution-note"><strong>Kết quả xử lý:</strong> {incident.resolutionNote}</p>}
    {error && <p className="ec-inline-warning">{error}</p>}
    {references.length > 0 && !items.length && !error && <div className="ec-media-empty">Đang tải bằng chứng…</div>}
    {items.length > 0 && <div className="ec-media-grid ec-evidence-grid">{items.map((item, index) => <MediaCard compact key={`${item.objectKey || item.url}-${index}`} item={item} />)}</div>}
  </section>;
}

function elapsed(value, now = Date.now()) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Chưa rõ thời điểm';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  return minutes < 1 ? 'Vừa ghi nhận' : minutes < 60 ? `${minutes} phút trước` : minutes < 1440 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút trước` : `${Math.floor(minutes / 1440)} ngày trước`;
}

export default function EmergencyCenterPage() {
  const account = getSession()?.account || {}, monitoring = account.role !== 'STAFF';
  const [auto, setAuto] = useState(true), [revision, setRevision] = useState(0);
  const [catalogs, setCatalogs] = useState({ robots: [], maps: [], endpoints: [], staff: [] }), [catalogWarning, setCatalogWarning] = useState('');
  const [tab, setTab] = useState('active'), [quick, setQuick] = useState(''), [filters, setFilters] = useState(emptyFilters), [page, setPage] = useState(0);
  const [active, setActive] = useState(null), [activeError, setActiveError] = useState(''), [activeAt, setActiveAt] = useState(null), [activeLoading, setActiveLoading] = useState(true);
  const [history, setHistory] = useState(null), [historyError, setHistoryError] = useState(''), [historyLoading, setHistoryLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null), [toast, setToast] = useState(''), [sound, setSound] = useState(false);
  const audio = useRef(null), knownIds = useRef(null), soundEnabled = useRef(false);
  const tick = useTick(auto, revision), signature = JSON.stringify(filters), historyIdentity = `${signature}:${page}`;
  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);
  const toggleSound = async () => {
    if (sound) { soundEnabled.current = false; setSound(false); return; }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Error('Trình duyệt không hỗ trợ âm báo.');
      audio.current ||= new Audio(); await audio.current.resume(); soundEnabled.current = true; setSound(true);
    } catch { setToast('Không bật được âm báo. Hãy cho phép âm thanh trên trình duyệt.'); }
  };
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
    const controller = new AbortController(); setActiveLoading(true);
    Promise.all(ACTIVE_INCIDENT_STATUSES.map(status => readCatalog(`GET ${ROOT}`, { query: { status }, signal: controller.signal }))).then(groups => {
      if (controller.signal.aborted) return;
      const unique = new Map();
      groups.flat().forEach(row => unique.set(row.incidentId, newerIncident(unique.get(row.incidentId), row)));
      const rows = [...unique.values()], ids = new Set(rows.map(row => row.incidentId));
      if (knownIds.current && rows.some(row => row.status === 'OPEN' && !knownIds.current.has(row.incidentId)) && soundEnabled.current && audio.current?.state === 'running') {
        const oscillator = audio.current.createOscillator(), gain = audio.current.createGain(), start = audio.current.currentTime;
        oscillator.connect(gain); gain.connect(audio.current.destination); oscillator.frequency.value = 740;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.12, start + .03); gain.gain.exponentialRampToValueAtTime(.001, start + .65);
        oscillator.start(); oscillator.stop(start + .7); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
      knownIds.current = ids; setActive(rows); setActiveAt(Date.now()); setActiveError('');
    }).catch(cause => { if (!controller.signal.aborted) setActiveError(cause.message || 'Không tải được sự cố đang diễn ra.'); }).finally(() => { if (!controller.signal.aborted) setActiveLoading(false); });
    return () => controller.abort();
  }, [tick]);
  useEffect(() => {
    if (tab !== 'history') return;
    const controller = new AbortController(); setHistoryLoading(true); setHistoryError('');
    loadIncidentHistory(query => callBackend(`GET ${ROOT}`, { query }, { signal: controller.signal }), filters, page, PAGE_SIZE).then(value => {
      if (controller.signal.aborted) return;
      if (page > 0 && page >= value.totalPages) { setPage(Math.max(0, value.totalPages - 1)); return; }
      setHistory({ ...value, identity: historyIdentity, at: Date.now() });
    }).catch(cause => { if (!controller.signal.aborted) setHistoryError(cause.message || 'Không tải được lịch sử sự cố.'); }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [tick, tab, historyIdentity]);
  let filtered = [], filterError = '';
  try { filtered = filterActiveIncidents(active || [], filters, quick); } catch (cause) { filterError = cause.message; }
  const result = tab === 'active' ? active && { content: filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), totalElements: filtered.length, totalPages: Math.ceil(filtered.length / PAGE_SIZE), at: activeAt } : history?.identity === historyIdentity ? history : null;
  const rows = result?.content || [], loading = tab === 'active' ? activeLoading : historyLoading, error = filterError || (tab === 'active' ? activeError : historyError);
  const rowIds = rows.map(row => row.incidentId).join(',');
  useEffect(() => { if (result) setSelectedId(current => current || rows[0]?.incidentId || null); }, [rowIds, !!result, tab, signature, quick, page, selectedId]);
  useEffect(() => { if (tab === 'active' && active && page > 0 && page >= Math.ceil(filtered.length / PAGE_SIZE)) setPage(Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)); }, [tab, active, page, filtered.length]);
  const changeScope = update => { update(); setPage(0); setSelectedId(null); };
  const updateFilter = (key, value) => changeScope(() => setFilters(previous => ({ ...previous, [key]: value })));
  const resetFilters = () => changeScope(() => { setFilters(emptyFilters); setQuick(''); });
  const changeTab = value => changeScope(() => { setTab(value); setFilters(emptyFilters); setQuick(''); });
  const selectQuick = key => changeScope(() => { setTab('active'); setQuick(quick === key && tab === 'active' ? '' : key); setFilters(emptyFilters); });
  const metrics = [
    { key: 'open', label: 'Chưa tiếp nhận', value: active?.filter(row => row.status === 'OPEN').length, caption: 'Cần xác minh tình huống', icon: 'shield', tone: 'danger' },
    { key: 'handling', label: 'Đang hỗ trợ', value: active?.filter(row => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(row.status)).length, caption: 'Đã nhận hoặc đang xử lý', icon: 'user', tone: 'blue' },
    { key: 'unassigned', label: 'Chưa có người phụ trách', value: active?.filter(row => !hasIncidentResponder(row) && row.status !== 'RESOLVED').length, caption: 'Cần kiểm tra ca trực', icon: 'user', tone: 'amber' },
    { key: 'overdue', label: `Chờ trên ${WAIT_WARNING_MINUTES} phút`, value: active?.filter(row => incidentOverdue(row)).length, caption: 'Chưa được tiếp nhận', icon: 'clock', tone: 'danger' },
  ];
  const hasFilters = quick || Object.values(filters).some(Boolean), refresh = () => setRevision(value => value + 1);
  return <section className="ec-page" aria-label="Xử lý sự cố khẩn cấp">
    <header className="ec-header"><div className="ec-title"><span className="ec-title-icon"><Icon /></span><div><span className="ec-eyebrow">TRUNG TÂM ĐIỀU PHỐI</span><h2>{monitoring ? 'Giám sát SOS' : 'Tiếp nhận & xử lý sự cố'}</h2><p>Theo dõi tình huống khẩn cấp, vị trí và người đang hỗ trợ.</p></div></div><div className="ec-header-actions"><button className={`ec-button ${sound ? 'is-enabled' : ''}`} aria-pressed={sound} onClick={toggleSound}>{sound ? '♪ Âm báo đang bật' : '♪ Bật âm báo'}</button><button className="ec-button" onClick={refresh} disabled={loading}><Icon name="refresh" />Tải lại</button></div></header>
    <div className="ec-status-bar"><p>{monitoring ? 'Chế độ giám sát · Staff tiếp nhận và cập nhật kết quả xử lý SOS.' : 'Tiếp nhận đúng sự cố, xác minh thực tế và ghi nhận kết quả hỗ trợ.'}</p><label className="ec-auto"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />Tự cập nhật · 15 giây</label></div>
    <div className="ec-metrics" aria-label="Tổng quan sự cố đang diễn ra">{metrics.map(metric => <button key={metric.key} className={`ec-metric ec-${metric.tone} ${tab === 'active' && quick === metric.key ? 'is-active' : ''}`} aria-pressed={tab === 'active' && quick === metric.key} onClick={() => selectQuick(metric.key)}><div><span>{metric.label}</span><strong>{metric.value ?? '—'}</strong><small>{metric.caption}</small></div><span className="ec-metric-icon"><Icon name={metric.icon} /></span></button>)}</div>
    {activeError && <p className="ec-inline-warning" role="status">Tổng quan chưa cập nhật được. {active ? 'Đang giữ số liệu lần trước.' : 'Chưa có số liệu từ máy chủ.'}</p>}
    {catalogWarning && <p className="ec-inline-warning">{catalogWarning}</p>}
    {toast && <div className="ec-notice ec-success" role="status"><span>{toast}</span><button className="ec-text-button" onClick={() => setToast('')}>Đóng thông báo</button></div>}
    <nav className="ec-tabs" aria-label="Nhóm sự cố"><button aria-current={tab === 'active' ? 'page' : undefined} className={tab === 'active' ? 'is-active' : ''} onClick={() => changeTab('active')}>Đang diễn ra {active && <span>{active.length}</span>}</button><button aria-current={tab === 'history' ? 'page' : undefined} className={tab === 'history' ? 'is-active' : ''} onClick={() => changeTab('history')}>Lịch sử</button><span className="ec-tab-hint">{tab === 'active' ? 'Ưu tiên ca chờ tiếp nhận và chờ lâu' : 'Hồ sơ đã đóng và báo động nhầm'}</span></nav>
    <section className="ec-filters" aria-label="Bộ lọc sự cố"><div className="ec-filter-main"><label>Trạng thái<select aria-label="Trạng thái sự cố" value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="">Tất cả trạng thái</option>{(tab === 'active' ? ACTIVE_INCIDENT_STATUSES : HISTORY_INCIDENT_STATUSES).map(key => <option key={key} value={key}>{INCIDENT_STATUSES[key].label}</option>)}</select></label><label>Nguồn cảnh báo<select aria-label="Loại sự cố" value={filters.type} onChange={event => updateFilter('type', event.target.value)}><option value="">Tất cả nguồn</option><option value="SOS">Yêu cầu SOS</option><option value="SUSPECTED_FALL">Nghi ngờ té ngã</option></select></label><label>Mức độ<select aria-label="Mức độ sự cố" value={filters.severity} onChange={event => updateFilter('severity', event.target.value)}><option value="">Tất cả mức độ</option><option value="CRITICAL">Khẩn cấp</option><option value="WARNING">Cảnh báo</option></select></label><details className="ec-extra-filters"><summary>Vị trí & thời gian</summary><div className="ec-filter-extra"><label>Bản đồ<select aria-label="Bản đồ sự cố" value={filters.mapId} onChange={event => updateFilter('mapId', event.target.value)}><option value="">Tất cả bản đồ</option>{catalogs.maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName || map.mapCode}</option>)}</select></label><label>Từ ngày<input type="date" aria-label="Từ ngày" value={filters.from} max={filters.to || undefined} onChange={event => updateFilter('from', event.target.value)} /></label><label>Đến ngày<input type="date" aria-label="Đến ngày" value={filters.to} min={filters.from || undefined} onChange={event => updateFilter('to', event.target.value)} /></label></div></details>{hasFilters && <button className="ec-text-button" onClick={resetFilters}>Xóa bộ lọc</button>}</div>{quick && <div className="ec-quick-filter">Đang lọc: <strong>{metrics.find(row => row.key === quick)?.label}</strong><button className="ec-text-button" onClick={() => changeScope(() => setQuick(''))} aria-label="Bỏ lọc nhanh">×</button></div>}</section>
    {error && <div className="ec-notice ec-error" role="alert"><span>{error}{result && ' Đang giữ danh sách đã tải.'}</span><button className="ec-text-button" onClick={refresh}>Thử lại</button></div>}
    <div className="ec-layout"><aside className="ec-list-panel" aria-label="Danh sách sự cố"><header><div><h3>{tab === 'active' ? 'Sự cố cần theo dõi' : 'Lịch sử sự cố'}</h3><p>{result ? `${result.totalElements} sự cố${hasFilters ? ' phù hợp' : ''}` : 'Đang kết nối máy chủ'}</p></div>{loading && result && <span className="ec-updating">Đang cập nhật</span>}</header><div className="ec-list-meta"><Freshness at={result?.at} failed={!!error} /></div>
      <div className="ec-list">{!result && loading ? <div className="ec-empty" role="status">Đang tải sự cố…</div> : !rows.length ? <div className="ec-empty"><Icon name={error ? 'shield' : 'check'} /><strong>{error ? 'Chưa tải được danh sách' : hasFilters ? 'Không có sự cố phù hợp' : tab === 'active' ? 'Không có SOS đang diễn ra' : 'Chưa có hồ sơ trong lịch sử'}</strong><p>{error ? 'Kiểm tra kết nối và thử lại.' : hasFilters ? 'Thử thay đổi điều kiện lọc.' : 'Sự cố sẽ xuất hiện khi máy chủ ghi nhận.'}</p>{hasFilters && <button className="ec-button" onClick={resetFilters}>Xóa bộ lọc</button>}</div> : rows.map(incident => {
        const info = incidentPresentation(incident, catalogs, account), overdue = incidentOverdue(incident);
        return <button key={incident.incidentId} data-incident-id={incident.incidentId} className={`ec-incident ${incident.incidentId === selectedId ? 'is-selected' : ''} ${incident.status === 'OPEN' ? 'is-urgent' : ''}`} aria-pressed={incident.incidentId === selectedId} onClick={() => { setSelectedId(incident.incidentId); if (innerWidth <= 760) requestAnimationFrame(() => document.querySelector('.ec-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' })); }}><div className="ec-incident-top"><span className={`ec-source ${incident.incidentType === 'SUSPECTED_FALL' ? 'is-fall' : ''}`}>{incident.incidentType === 'SUSPECTED_FALL' ? 'Phát hiện té ngã' : 'Yêu cầu SOS'}</span><Severity value={incident.severity} /></div><strong>{info.endpoint}</strong><span className="ec-location"><Icon name="pin" />{info.map}</span><span className="ec-location"><Icon name="user" />{incident.acknowledgedByAccountId ? info.owner : info.responder || 'Chưa có người phụ trách'}</span><div className="ec-incident-bottom"><Badge status={incident.status} /><span className={overdue ? 'ec-wait is-overdue' : 'ec-wait'}><Icon name="clock" />{elapsed(incident.occurredAt)}</span></div><div className="ec-incident-meta"><span><Icon name="robot" />{info.robot}</span><small>#{incident.incidentId.slice(-6).toUpperCase()}</small></div></button>;
      })}</div><footer className="ec-pagination"><button className="ec-button" aria-label="Trang sự cố trước" disabled={!page || loading} onClick={() => { setPage(value => value - 1); setSelectedId(null); }}>←</button><span>Trang {page + 1}/{Math.max(1, result?.totalPages || 0)}</span><button className="ec-button" aria-label="Trang sự cố sau" disabled={loading || !result || page + 1 >= result.totalPages} onClick={() => { setPage(value => value + 1); setSelectedId(null); }}>→</button></footer>
    </aside>{selectedId ? <IncidentDetail key={selectedId} id={selectedId} account={account} catalogs={catalogs} tick={tick} retained={!!result && !rows.some(row => row.incidentId === selectedId)} onSaved={value => { setToast(value); refresh(); }} /> : <section className="ec-detail ec-detail-empty"><span className="ec-empty-icon"><Icon /></span><h3>{!loading && !rows.length && !error ? 'Không có sự cố cần hiển thị' : 'Chi tiết sự cố'}</h3><p>Chọn một sự cố để xem vị trí, người phụ trách và tiến trình hỗ trợ.</p></section>}</div>
    <p className="ec-page-footnote">Số liệu tổng quan gồm các sự cố đang diễn ra trong phạm vi tài khoản. Mốc 5 phút dùng để nhắc theo dõi. Âm báo chỉ phát khi trang nhận được SOS mới và không thay cho việc tiếp nhận.</p>
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
    {incident.incidentType === 'SUSPECTED_FALL' && ['OPEN', 'ACKNOWLEDGED'].includes(incident.status) && <div className="ec-fall-notice"><Icon name="shield" /><div><strong>Phát hiện nghi ngờ té ngã · Cần xác minh</strong><p>Cảnh báo phát hiện tự động. Kiểm tra bằng chứng và tình huống thực tế trước khi kết luận.</p></div></div>}
    <div className="ec-detail-section-title"><span>01</span><h4>Tình huống & vị trí</h4></div>
    <section className="ec-description"><h4>Nội dung sự cố</h4><p>{incident.description || 'Máy chủ chưa ghi nhận mô tả.'}</p><time>Ghi nhận lúc {stamp(incident.occurredAt)}</time></section>
    <IncidentMap incident={incident} info={info} />
    <IncidentEvidence incident={incident} />
    <div className="ec-detail-section-title"><span>02</span><h4>Điều phối hỗ trợ</h4></div>
    <div className="ec-info-grid"><section className="ec-info-card"><h4><Icon name="user" />Người phụ trách</h4><dl><div><dt>Nhân viên được điều phối</dt><dd>{info.responder || 'Chưa ghi nhận phân công'}</dd></div><div><dt>Đã tiếp nhận</dt><dd>{info.owner}</dd></div>{info.resolver && <div><dt>Xác nhận kết quả</dt><dd>{info.resolver}</dd></div>}</dl>{incident.sosRoutingStatus && <p className={`ec-routing ${incident.sosRoutingStatus === 'ASSIGNED' ? '' : 'is-warning'}`}>{SOS_ROUTING_LABELS[incident.sosRoutingStatus] || 'Chưa xác định kết quả điều phối'}</p>}</section><IncidentRobot incident={incident} info={info} tick={tick} /></div>
    <div className="ec-detail-section-title"><span>03</span><h4>Tiến trình & kết quả</h4></div>
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
