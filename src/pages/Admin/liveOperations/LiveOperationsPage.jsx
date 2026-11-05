import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { callBackend, readCatalog, watchJob } from '../../../features/api/backendApi.js';
import { canUse, operations } from '../../../features/api/contract.js';
import { getSession } from '../../../features/auth/session.js';
import { readOpenJobs } from '../../../features/operations/liveOperationsData.js';
import { resources } from '../../../features/api/workspaceCatalog.js';
import { vi } from '../../../i18n/vi.js';
import { ACTIVE_STATUSES, JOB_GROUPS, TERMINAL_STATUSES, allowedJobActions, assertJobAction, confirmationBlock, dataFreshness, filterJobs, jobPresentation, jobProblem, mergeJobDetail, newerJob, operationSummary, selectedStep, statusInfo } from '../../../features/operations/liveOperations.js';
import { OperationDialog } from '../backend/BackendWorkspace.jsx';
import RecordDetails from '../backend/RecordDetails.jsx';
import { EventDetails, StepDetails } from './OperationDetails.jsx';
import JobTechnicalPanel from './JobTechnicalPanel.jsx';
import RecoveryPanel from './RecoveryPanel.jsx';
import './liveOperations.css';
import RobotMonitor from './RobotMonitor.jsx';

const jobResource = resources.find(resource => resource.id === 'jobs');
const PAGE_SIZE = 12;
const emptyCatalogs = { robots: [], workflows: [], requests: [], endpoints: [] };
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Chưa ghi nhận';
const clock = value => value ? new Date(value).toLocaleTimeString('vi-VN') : '—';
const label = value => vi(value || 'Chưa ghi nhận');
const stepTitle = step => label(step.stepTypeSnapshot || step.stepCodeSnapshot);
const eventTitles = { JOB_CREATED: 'Công việc được tạo', JOB_QUEUED: 'Đưa vào hàng đợi', JOB_STARTED: 'Bắt đầu công việc', JOB_SUCCEEDED: 'Công việc hoàn tất', JOB_FAILED: 'Công việc thất bại', JOB_CANCELLED: 'Công việc đã hủy', CANCEL_REQUESTED: 'Đã yêu cầu hủy', STEP_STARTED: 'Bắt đầu bước', STEP_SUCCEEDED: 'Bước hoàn tất', STEP_FAILED: 'Bước thất bại', STEP_SELECTED: 'Chọn bước thực thi', JOB_RECONCILED: 'Đã đối soát công việc', RECOVERY_REQUIRED: 'Cần đối soát phục hồi' };

function Icon({ name = 'activity', ...props }) {
  const paths = {
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    robot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="m12 3 10 18H2Z" /><path d="M12 9v4m0 3v1" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    list: <path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.activity}</svg>;
}

function Badge({ status }) {
  const info = statusInfo(status);
  return <span className={`lo-badge lo-${info.tone}`}><i />{info.label}</span>;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  return now;
}

function useRefreshTick(auto, revision) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') setTick(value => value + 1); }, 15000);
    return () => clearInterval(timer);
  }, [auto]);
  return `${revision}:${tick}`;
}

function Freshness({ receivedAt, failed, auto, title }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const { ageSeconds, stale } = dataFreshness(receivedAt, now, failed);
  return <div className={`lo-data-age ${stale || !auto ? 'is-stale' : ''}`} role="status"><i /><span>{title} · {stale ? 'Dữ liệu chưa cập nhật' : 'Đã nhận từ máy chủ'}{ageSeconds != null && ` · ${ageSeconds < 60 ? `${ageSeconds} giây` : `${Math.floor(ageSeconds / 60)} phút`} trước`}{!auto && ' · Tự cập nhật đang tắt'}</span></div>;
}

function RobotContact({ robotId, refreshTick }) {
  const [robot, setRobot] = useState(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    setRobot(null); setFailed(false);
  }, [robotId]);
  useEffect(() => {
    if (!robotId) return;
    const controller = new AbortController();
    callBackend('GET /api/v1/robots/{id}', { path: { id: robotId } }, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setRobot(value); setFailed(false); } }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [robotId, refreshTick]);
  if (!robotId) return null;
  return <p className="lo-robot-contact">{failed ? 'Chưa cập nhật được thông tin kết nối robot.' : robot?.status ? `Robot theo máy chủ: ${vi(robot.status)}.` : 'Chưa có trạng thái kết nối robot.'} {robot?.lastHeartbeatAt ? `Heartbeat cuối: ${stamp(robot.lastHeartbeatAt)}.` : 'Chưa có thời điểm heartbeat.'} Mất cập nhật không xác nhận robot đã dừng.</p>;
}

export default function LiveOperationsPage() {
  const role = getSession()?.account?.role;
  const [explore, setExplore] = useState(false);
  const [jobs, setJobs] = useState([]), [catalogs, setCatalogs] = useState(emptyCatalogs);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [catalogWarning, setCatalogWarning] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null), [auto, setAuto] = useState(true), [revision, setRevision] = useState(0);
  const [group, setGroup] = useState('active'), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [robotId, setRobotId] = useState(''), [page, setPage] = useState(0);
  const [workflowId, setWorkflowId] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [selectedId, setSelectedId] = useState(null), [toast, setToast] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const knownJobs = useRef(jobs), lastFullLoad = useRef(0);
  knownJobs.current = jobs;
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const sources = { robots: 'GET /api/v1/robots', workflows: 'GET /api/v1/workflows/published', requests: 'GET /api/v1/service-requests', endpoints: 'GET /api/v1/endpoints' };
    Promise.allSettled(Object.values(sources).map(key => readCatalog(key, { signal: controller.signal }))).then(results => {
      if (controller.signal.aborted) return;
      setCatalogs(previous => Object.fromEntries(Object.keys(sources).map((key, index) => [key, results[index].status === 'fulfilled' ? results[index].value : previous[key]])));
      setCatalogWarning(results.some(result => result.status === 'rejected') ? 'Một số tên robot, quy trình hoặc điểm đến chưa tải được. Công việc vẫn được hiển thị theo mã.' : '');
    });
    return () => controller.abort();
  }, [catalogRevision]);

  useEffect(() => {
    const controller = new AbortController(); let timer;
    const load = async (first = false) => {
      if (first) setLoading(true);
      try {
        const full = first || Date.now() - lastFullLoad.current >= 60000;
        const next = full ? await readCatalog('GET /api/v1/jobs', { signal: controller.signal }) : await readOpenJobs(knownJobs.current, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setJobs(previous => {
          const known = new Map(previous.map(job => [job.jobId, job]));
          return next.map(job => newerJob(known.get(job.jobId), job));
        });
        setLoadError(''); setUpdatedAt(Date.now());
        if (full) { lastFullLoad.current = Date.now(); setHistoryUpdatedAt(Date.now()); }
      } catch (error) { if (!controller.signal.aborted) setLoadError(error.message || 'Không tải được công việc.'); }
      finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (auto) timer = setTimeout(() => { if (document.visibilityState === 'visible') load(); else timer = setTimeout(() => load(), 15000); }, 15000);
        }
      }
    };
    load(true);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision, auto]);

  const integrate = useCallback(detail => {
    if (!detail?.job?.jobId) return;
    setJobs(previous => previous.map(job => job.jobId === detail.job.jobId ? newerJob(job, detail.job) : job));
  }, []);
  const filtered = useMemo(() => filterJobs(jobs, { group, search, status, robotId, workflowId, from, to }, catalogs), [jobs, group, search, status, robotId, workflowId, from, to, catalogs]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const selectionContext = JSON.stringify({ group, search, status, robotId, workflowId, from, to, page });
  const lastSelectionContext = useRef(selectionContext);
  const requestedSelection = useRef(null);
  useEffect(() => {
    if (requestedSelection.current) {
      lastSelectionContext.current = selectionContext;
      setSelectedId(requestedSelection.current); requestedSelection.current = null;
    } else if (lastSelectionContext.current !== selectionContext) {
      lastSelectionContext.current = selectionContext; setSelectedId(visible[0]?.jobId || null);
    } else if (!selectedId && visible.length) setSelectedId(visible[0].jobId);
  }, [filtered, selectionContext, selectedId]);
  const selected = jobs.find(job => job.jobId === selectedId);
  const retained = selected && !visible.some(job => job.jobId === selectedId);
  const chooseGroup = (next, nextStatus = '') => { setGroup(next); setStatus(nextStatus); setPage(0); setToast(''); };
  const showJob = job => {
    const target = JOB_GROUPS.find(item => item.statuses.includes(job.status));
    if (!target) return;
    const targetJobs = filterJobs(jobs, { group: target.id }, catalogs);
    requestedSelection.current = job.jobId;
    setGroup(target.id); setSearch(''); setStatus(''); setRobotId(''); setWorkflowId(''); setFrom(''); setTo('');
    setPage(Math.max(0, Math.floor(targetJobs.findIndex(item => item.jobId === job.jobId) / PAGE_SIZE)));
    setSelectedId(job.jobId); setToast('');
  };
  const counts = Object.fromEntries(JOB_GROUPS.map(item => [item.id, jobs.filter(job => item.statuses.includes(job.status)).length]));
  const metrics = [
    { label: 'Đang hoạt động', count: counts.active, icon: 'activity', tone: 'blue', group: 'active' },
    { label: 'Chờ điều phối', count: jobs.filter(job => job.status === 'QUEUED').length, icon: 'time', tone: 'amber', group: 'active', status: 'QUEUED' },
    { label: 'Cần xử lý', count: counts.attention, icon: 'alert', tone: 'red', group: 'attention' },
    { label: 'Đã kết thúc', count: counts.history, icon: 'check', tone: 'green', group: 'history' },
  ];
  const resetFilters = () => { setSearch(''); setStatus(''); setRobotId(''); setWorkflowId(''); setFrom(''); setTo(''); setPage(0); };
  const hasFilters = !!(search || status || robotId || workflowId || from || to);
  const refresh = () => { setRevision(value => value + 1); setCatalogRevision(value => value + 1); };
  const recent = filterJobs(jobs, { group: 'history' }, catalogs).slice(0, 3);

  return <section className="lo-page" aria-label="Theo dõi công việc robot">
    <header className="lo-header"><div className="lo-page-title"><span className="lo-title-icon"><Icon /></span><div><h2>Theo dõi công việc</h2><p>Tiến trình robot, kết quả thực thi và các việc cần can thiệp.</p></div></div><div className="lo-header-actions"><label className="lo-auto"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} /><span>Tự cập nhật</span></label><button className="lo-button" onClick={refresh} disabled={loading}><Icon name="refresh" className={loading ? 'lo-spin' : ''} />Làm mới</button></div></header>
    <div className="lo-sync" role="status"><span className={`lo-connection ${loadError ? 'lo-offline' : ''}`} />{loadError ? 'Chưa cập nhật được dữ liệu' : loading && !updatedAt ? 'Đang kết nối…' : auto ? 'Việc đang mở: mỗi 15 giây · Toàn bộ lịch sử: mỗi 60 giây' : 'Đã tạm dừng tự cập nhật'}{updatedAt && <span>Cập nhật lúc {clock(updatedAt)}</span>}{group === 'history' && historyUpdatedAt && <span>Lịch sử tải lúc {clock(historyUpdatedAt)}</span>}</div>
    <Freshness receivedAt={updatedAt} failed={!!loadError} auto={auto} title="Danh sách công việc" />
    <RobotMonitor jobs={jobs} catalogs={catalogs} auto={auto} revision={revision} onOpen={job => { showJob(job); setExplore(true); requestAnimationFrame(() => document.getElementById("lo-explorer")?.scrollIntoView({ block: "start", behavior: "smooth" })); }} />
    <details className="lo-explorer" id="lo-explorer" open={explore} onToggle={event => setExplore(event.currentTarget.open)}><summary>Chi tiết công việc, lịch sử và xử lý</summary>
    <div className="lo-metrics">{metrics.map(metric => <button key={metric.label} className={`lo-metric lo-metric-${metric.tone}`} onClick={() => chooseGroup(metric.group, metric.status || '')}><span><span className="lo-metric-label">{metric.label}</span><strong>{updatedAt ? metric.count : '—'}</strong></span><span className="lo-metric-icon"><Icon name={metric.icon} /></span></button>)}</div>
    {loadError && <div className="lo-notice lo-notice-error" role="alert"><Icon name="alert" /><div><strong>Không thể làm mới công việc</strong><p>{loadError}{updatedAt ? ' Dữ liệu bên dưới là lần tải thành công gần nhất.' : ''}</p></div><button className="lo-button" onClick={refresh}>Thử lại</button></div>}
    {catalogWarning && <div className="lo-notice lo-notice-warning"><Icon name="alert" /><p>{catalogWarning}</p><button className="lo-text-button" onClick={() => setCatalogRevision(value => value + 1)}>Tải lại tên</button></div>}
    {toast && <div className="lo-notice lo-notice-success" role="status"><Icon name="check" /><p>{toast}</p><button className="lo-text-button" onClick={() => setToast('')}>Đóng</button></div>}
    <div className="lo-board">
      <div className="lo-board-controls">
      <div className="lo-board-toolbar"><nav className="lo-groups" aria-label="Nhóm công việc">{JOB_GROUPS.map(item => <button key={item.id} aria-pressed={group === item.id} className={group === item.id ? 'is-active' : ''} onClick={() => chooseGroup(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}</nav><span className="lo-total">{jobs.length} công việc</span></div>
      <div className="lo-filters"><label className="lo-search"><Icon name="search" /><input aria-label="Tìm công việc" placeholder="Tìm nhiệm vụ, mã công việc, robot…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label><select aria-label="Lọc trạng thái công việc" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="">Tất cả trạng thái</option>{JOB_GROUPS.find(item => item.id === group).statuses.map(value => <option key={value} value={value}>{statusInfo(value).label}</option>)}</select><select aria-label="Lọc robot" value={robotId} onChange={event => { setRobotId(event.target.value); setPage(0); }}><option value="">Tất cả robot</option>{catalogs.robots.map(robot => <option key={robot.robotId} value={robot.robotId}>{robot.robotName || robot.robotCode || robot.robotId}</option>)}</select>{hasFilters && <button className="lo-text-button" onClick={resetFilters}>Xóa bộ lọc</button>}</div>
      <details className="lo-advanced-filters"><summary>Lọc thêm theo quy trình và ngày{(workflowId || from || to) && <span>Đang áp dụng</span>}</summary><div><label>Quy trình<select value={workflowId} onChange={event => { setWorkflowId(event.target.value); setPage(0); }}><option value="">Tất cả quy trình</option>{catalogs.workflows.map(workflow => <option key={workflow.workflowId} value={workflow.workflowId}>{workflow.workflowName || workflow.workflowCode || workflow.workflowId}</option>)}</select></label><label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(0); }} /></label><label>Đến ngày<input type="date" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(0); }} /></label></div>{from && to && from > to && <p role="alert">Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.</p>}</details>
      </div>
      {loadError && !updatedAt ? <div className="lo-empty"><span className="lo-empty-icon"><Icon name="alert" /></span><h3>Chưa tải được danh sách công việc</h3><p>Kiểm tra kết nối và thử lại để xem trạng thái thực tế.</p></div> : loading && !updatedAt ? <div className="lo-loading" role="status"><span className="lo-spinner" />Đang tải công việc…</div> : !filtered.length && !selected ? <div className="lo-empty-board"><div className="lo-empty"><span className="lo-empty-icon"><Icon name={group === 'attention' ? 'check' : 'list'} /></span><h3>{hasFilters ? 'Không có công việc phù hợp' : group === 'active' ? 'Hiện không có công việc đang hoạt động' : group === 'attention' ? 'Không có công việc cần xử lý' : 'Chưa có lịch sử công việc'}</h3><p>{hasFilters ? 'Thử đổi điều kiện tìm kiếm hoặc xóa bộ lọc.' : group === 'active' ? 'Các công việc mới sẽ xuất hiện khi yêu cầu được gửi xử lý hoặc lịch tự động được kích hoạt.' : group === 'attention' ? 'Các công việc cần đối soát sau gián đoạn sẽ xuất hiện tại đây.' : 'Các công việc thành công, thất bại và đã hủy sẽ được lưu tại đây.'}</p>{hasFilters ? <button className="lo-button" onClick={resetFilters}>Xóa bộ lọc</button> : group === 'active' ? <Link className="lo-button lo-primary" to="/admin/missions">Mở nhiệm vụ</Link> : null}</div>{group !== 'history' && recent.length > 0 && !hasFilters && <section className="lo-recent"><header><h3>Lần thực thi gần đây</h3><button className="lo-text-button" onClick={() => chooseGroup('history')}>Xem lịch sử <Icon name="arrow" /></button></header><div>{recent.map(job => <button className="lo-recent-item" key={job.jobId} onClick={() => showJob(job)}><strong>{jobPresentation(job, catalogs).title}</strong><Badge status={job.status} /><small>{stamp(job.queuedAt)} · {job.jobCode?.slice(-6)}</small></button>)}</div></section>}</div> : <div className="lo-layout"><aside className="lo-job-list" aria-label="Danh sách công việc"><header><strong>{filtered.length} công việc</strong><span>Trang {safePage + 1}/{totalPages}</span></header><div className="lo-job-items">{!visible.length && <p className="lo-list-empty">{group === 'active' ? 'Không còn công việc đang hoạt động.' : 'Không có công việc trong nhóm đang chọn.'}</p>}{visible.map(job => {
        const info = jobPresentation(job, catalogs);
        return <button key={job.jobId} className={`lo-job-item ${job.jobId === selectedId ? 'is-selected' : ''}`} aria-pressed={job.jobId === selectedId} onClick={() => { setSelectedId(job.jobId); if (window.innerWidth <= 760) requestAnimationFrame(() => document.querySelector('.lo-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' })); }}><div className="lo-job-item-top"><Badge status={job.status} /><span>{job.jobCode?.slice(-6)}</span></div><strong>{info.title}</strong>{(job.cancelRequestedAt || job.cancelCommandId) && !TERMINAL_STATUSES.includes(job.status) && <span className="lo-card-attention">Đang chờ hủy</span>}<span className="lo-job-robot"><Icon name="robot" />{info.robot}</span>{info.target && <span className="lo-job-target"><Icon name="pin" />{info.target}</span>}<div className="lo-job-item-bottom"><time>{stamp(job.queuedAt)}</time><Icon name="arrow" /></div></button>;
      })}</div><footer className="lo-pagination"><button className="lo-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Trang công việc trước">←</button><span>{filtered.length ? safePage * PAGE_SIZE + 1 : 0}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}</span><button className="lo-button" disabled={safePage + 1 >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Trang công việc sau">→</button></footer></aside>{selected && <JobDetail key={selected.jobId} job={selected} catalogs={catalogs} role={role} auto={auto} retained={retained} onShowGroup={() => showJob(selected)} manualRevision={revision} integrate={integrate} onSaved={message => { setToast(message); setRevision(value => value + 1); }} />}</div>}
    </div>
    </details>
  </section>;
}

function JobDetail({ job: listJob, catalogs, role, auto, retained, onShowGroup, manualRevision, integrate, onSaved }) {
  const [detail, setDetail] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('progress'), [liveStatus, setLiveStatus] = useState(''), [action, setAction] = useState(null), [retry, setRetry] = useState(0);
  const [revealStep, setRevealStep] = useState(null);
  const [receivedAt, setReceivedAt] = useState(null), [opening, setOpening] = useState(false), [actionError, setActionError] = useState('');
  const openingLock = useRef(false), actionController = useRef(null), streamGeneration = useRef(0);
  useEffect(() => () => actionController.current?.abort(), []);
  useEffect(() => {
    if (!revealStep || tab !== 'progress') return;
    const element = document.getElementById(`lo-step-${listJob.jobId}-${revealStep.id}`);
    const details = element?.querySelector('details');
    if (details) details.open = true;
    element?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    details?.querySelector('summary')?.focus({ preventScroll: true });
  }, [revealStep, tab, listJob.jobId]);
  const current = useRef(null);
  const detailRequest = useRef(null);
  const pendingDetailRefresh = useRef(false);
  const job = newerJob(detail?.job, listJob);
  const isTerminal = TERMINAL_STATUSES.includes(job.status);
  const refreshTick = useRefreshTick(auto && !isTerminal, manualRevision);
  const now = useNow();
  useEffect(() => () => detailRequest.current?.abort(), []);
  const accept = useCallback(next => {
    if (!next?.job || next.job.jobId !== listJob.jobId) return;
    const merged = mergeJobDetail(current.current, next);
    current.current = merged; setDetail(merged); integrate(merged);
    setReceivedAt(Date.now()); setError('');
    return merged;
  }, [listJob.jobId, integrate]);
  useEffect(() => {
    if (detailRequest.current && !detailRequest.current.signal.aborted) { pendingDetailRefresh.current = true; return; }
    const controller = new AbortController(), generation = streamGeneration.current;
    detailRequest.current = controller;
    callBackend('GET /api/v1/jobs/{id}', { path: { id: listJob.jobId } }, { signal: controller.signal }).then(next => {
      // A stream snapshot received after this REST request started is newer
      // evidence, including for task fields without individual versions.
      if (!controller.signal.aborted && generation === streamGeneration.current) accept(next);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Không tải được chi tiết.'); }).finally(() => {
      if (detailRequest.current === controller) detailRequest.current = null;
      if (!controller.signal.aborted) { setLoading(false); if (pendingDetailRefresh.current) { pendingDetailRefresh.current = false; setRetry(value => value + 1); } }
    });
  }, [listJob.jobId, listJob.rowVersion, listJob.status, refreshTick, retry, accept]);
  useEffect(() => {
    if (!auto || isTerminal) { setLiveStatus(''); return; }
    const controller = new AbortController(); let timer, failures = 0;
    const connect = async () => {
      setLiveStatus('Đang kết nối trực tiếp…');
      try {
        await watchJob(listJob.jobId, { signal: controller.signal, onEvent: event => {
          if (controller.signal.aborted || event.type !== 'job-state') return;
          streamGeneration.current += 1; accept(event.data); failures = 0; setLiveStatus('Đang theo dõi trực tiếp');
        } });
      } catch { /* REST refresh continues while the stream reconnects. */ }
      if (!controller.signal.aborted) {
        setLiveStatus('Kết nối trực tiếp gián đoạn · vẫn làm mới mỗi 15 giây');
        timer = setTimeout(connect, Math.min(30000, 3000 * 2 ** Math.min(failures++, 4)));
      }
    };
    connect();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [auto, isTerminal, listJob.jobId, accept]);
  const info = jobPresentation(job, catalogs), step = selectedStep(detail), permissions = allowedJobActions(job, role, step, now), problem = jobProblem(detail && { ...detail, job });
  const summary = operationSummary(job, step, now);
  const confirmationIssue = job.status === 'RUNNING' && step?.status === 'RUNNING' && ['AUTHENTICATE', 'HANDLE_PAYLOAD', 'INTERACT'].includes(step.stepTypeSnapshot) && step.resolvedInputsJson?.action !== 'SPEAK' ? confirmationBlock(job, role, step, now) : '';
  const activeTab = tab === 'recovery' && !permissions.recover ? 'progress' : tab;
  useEffect(() => { if (tab === 'recovery' && !permissions.recover) setTab('progress'); }, [tab, permissions.recover]);
  const steps = [...(detail?.steps || [])].sort((a, b) => (a.executionSequenceNo || 0) - (b.executionSequenceNo || 0));
  const completed = steps.filter(item => item.status === 'SUCCEEDED').length;
  const open = async (key, title, description) => {
    const op = operations[key];
    if (!canUse(op, role) || openingLock.current) return;
    openingLock.current = true; setOpening(true); setActionError('');
    const controller = new AbortController(); actionController.current = controller;
    try {
      const fresh = await callBackend('GET /api/v1/jobs/{id}', { path: { id: job.jobId } }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const merged = accept(fresh);
      assertJobAction(key, { ...detail, job }, merged, role);
      let robotChoices;
      if (key.endsWith('/assign-robot')) {
        const [robots, currentJobs] = await Promise.all([readCatalog('GET /api/v1/robots', { signal: controller.signal }), readCatalog('GET /api/v1/jobs', { signal: controller.signal })]);
        if (controller.signal.aborted) return;
        const occupied = new Set(currentJobs.filter(other => other.jobId !== job.jobId && [...ACTIVE_STATUSES, 'RECOVERY_REQUIRED'].includes(other.status)).map(other => other.robotId));
        robotChoices = { robotId: robots.filter(robot => robot.status === 'IDLE' && !occupied.has(robot.robotId)).map(robot => ({ value: robot.robotId, label: robot.robotName || robot.robotCode || robot.robotId })) };
      }
      if (!controller.signal.aborted) setAction({ op, title, description, snapshot: current.current, choiceOverrides: robotChoices });
    } catch (cause) { if (!controller.signal.aborted) setActionError(cause.message || 'Không kiểm tra được trạng thái mới. Chưa gửi thao tác.'); }
    finally { if (!controller.signal.aborted) setOpening(false); openingLock.current = false; }
  };
  const beforeSubmit = async ({ body }) => {
    const fresh = await callBackend('GET /api/v1/jobs/{id}', { path: { id: job.jobId } });
    const merged = accept(fresh);
    assertJobAction(action.op.key, action.snapshot, merged, role);
    if (action.op.path.endsWith('/assign-robot')) {
      const [robot, currentJobs] = await Promise.all([
        callBackend('GET /api/v1/robots/{id}', { path: { id: body.robotId } }),
        readCatalog('GET /api/v1/jobs'),
      ]);
      const occupied = currentJobs.some(other => other.jobId !== job.jobId && other.robotId === body.robotId && [...ACTIVE_STATUSES, 'RECOVERY_REQUIRED'].includes(other.status));
      if (robot.robotId !== body.robotId || robot.status !== 'IDLE' || occupied) throw Error('Robot không còn rảnh. Đóng biểu mẫu và tải lại danh sách robot.');
      assertJobAction(action.op.key, action.snapshot, current.current, role);
    }
  };
  return <article className="lo-detail" aria-label="Chi tiết công việc">
    <header className="lo-detail-header"><div><div className="lo-detail-kicker"><Badge status={job.status} /><span>{job.jobCode || job.jobId}</span></div><h3>{info.title}</h3><p><Icon name="robot" />{info.robot}{info.target && <><span className="lo-separator">→</span><Icon name="pin" />{info.target}</>}</p></div>{liveStatus && <span className="lo-live-status" role="status"><i />{liveStatus}</span>}</header>
    <Freshness receivedAt={receivedAt} failed={!!error} auto={auto} title="Chi tiết công việc" />
    <RobotContact key={job.robotId || 'unassigned'} robotId={job.robotId} refreshTick={refreshTick} />
    {retained && <div className="lo-notice lo-notice-success" role="status"><p>Công việc đã đổi trạng thái sang {statusInfo(job.status).label.toLowerCase()}. Đang giữ chi tiết để bạn tiếp tục xem.</p><button className="lo-text-button" onClick={onShowGroup}>{isTerminal ? 'Xem trong lịch sử' : 'Mở nhóm hiện tại'}</button></div>}
    {opening && <p className="lo-action-check" role="status">Đang kiểm tra trạng thái mới trước khi mở thao tác…</p>}
    {actionError && <div className="lo-notice lo-notice-error" role="alert"><p>{actionError}</p><button className="lo-text-button" onClick={() => setActionError('')}>Đóng</button></div>}
    {error && <div className="lo-notice lo-notice-error" role="alert"><p>Không cập nhật được chi tiết: {error} Các thao tác tạm khóa.</p><button className="lo-text-button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div>}
    {loading ? <div className="lo-loading" role="status"><span className="lo-spinner" />Đang tải chi tiết…</div> : detail && <>
      {problem && <section className={`lo-problem ${problem.recovery ? 'lo-problem-attention' : 'lo-problem-compact'}`}><Icon name="alert" /><div><strong>{problem.recovery ? 'Cần xác minh trước khi tiếp tục điều phối' : 'Công việc thất bại'}</strong><p>{problem.stepNumber && <span className="lo-failure-step">Bước {problem.stepNumber} · {problem.stepName}: </span>}<span>{problem.message}</span></p>{problem.recovery && <p>Kiểm tra robot và bằng chứng dừng trước khi đối soát. Đối soát không tự chạy lại công việc.</p>}{problem.stepId && <button className="lo-text-button lo-view-failed-step" onClick={() => { setTab('progress'); setRevealStep({ id: problem.stepId }); }}>Xem bước lỗi <span aria-hidden="true">→</span></button>}</div></section>}
      {summary && <section className={`lo-execution-status lo-execution-${summary.tone}`}><strong>{summary.title}</strong><p>{summary.message}</p>{summary.elapsed && <small>Đã chờ / thực hiện: {summary.elapsed}{summary.timeout && ` · Thời gian chờ của bước: ${summary.timeout}`}</small>}</section>}
      {confirmationIssue && !(job.cancelRequestedAt || job.cancelCommandId) && <p className="lo-confirmation-block" role="status">{confirmationIssue}</p>}
      <dl className="lo-job-facts"><div><dt>Quy trình</dt><dd>{info.workflow}</dd></div><div><dt>Yêu cầu liên quan</dt><dd>{info.requestCode || (job.serviceRequestId ? job.serviceRequestId.slice(0, 8) : 'Không có')}</dd></div><div><dt>Vào hàng đợi</dt><dd>{stamp(job.queuedAt)}</dd></div><div><dt>{isTerminal ? 'Kết thúc' : 'Bắt đầu'}</dt><dd>{stamp(isTerminal ? job.endedAt : job.startedAt)}</dd></div></dl>
      <div className="lo-detail-actions">{permissions.confirmStep && <button className="lo-button lo-primary" disabled={!!error} onClick={() => open(step.stepTypeSnapshot === 'AUTHENTICATE' ? 'POST /api/v1/jobs/{jobId}/auth-verifications' : 'POST /api/v1/job-steps/{id}/responses', 'Xác nhận bước hiện tại', 'Chỉ xác nhận sau khi đã thực hiện và kiểm tra yêu cầu của bước.')}>Xác nhận bước hiện tại</button>}{permissions.assignRobot && <button className="lo-button" disabled={!!error} onClick={() => open('POST /api/v1/jobs/{id}/assign-robot', 'Phân robot', 'Chọn robot đang rảnh. Máy chủ sẽ kiểm tra khả năng và điều kiện tiếp nhận quy trình.') }><Icon name="robot" />{job.robotId ? 'Đổi robot' : 'Phân robot'}</button>}{permissions.assignStaff && <button className="lo-button" disabled={!!error} onClick={() => open('POST /api/v1/jobs/{id}/assign-staff', 'Phân nhân viên', 'Chọn nhân viên phụ trách công việc này.')}>Phân nhân viên</button>}{permissions.cancel && <button className="lo-button lo-danger" disabled={!!error} onClick={() => open('POST /api/v1/jobs/{id}/cancel', 'Yêu cầu hủy công việc', 'Đây là yêu cầu hủy, không phải xác nhận robot đã dừng. Trạng thái sẽ cập nhật sau khi máy chủ xử lý.')}>Yêu cầu hủy</button>}{isTerminal && <span className="lo-terminal-note"><Icon name="check" />Công việc đã kết thúc · chỉ xem kết quả và nhật ký</span>}</div>
      {permissions.confirmStep && <div className="lo-instruction"><strong>Bước đang chờ bạn xác nhận</strong><p>{step.resolvedInputsJson?.message || step.resolvedInputsJson?.text || step.resolvedInputsJson?.prompt_key || step.stepCodeSnapshot}</p>{step.resolvedInputsJson?.items && <RecordDetails value={step.resolvedInputsJson.items} />}</div>}
      <nav className="lo-detail-tabs" aria-label="Nội dung công việc">{[['progress', 'Tiến trình'], ['events', 'Nhật ký sự kiện'], ...(permissions.recover ? [['recovery', 'Xử lý phục hồi']] : []), ['technical', 'Thông tin kỹ thuật']].map(([id, title]) => <button key={id} className={activeTab === id ? 'is-active' : ''} aria-pressed={activeTab === id} onClick={() => setTab(id)}>{title}</button>)}</nav>
      {activeTab === 'progress' && <section className="lo-progress"><header><div><h4>Các bước đã ghi nhận</h4><p>{steps.length ? `${completed}/${steps.length} lượt bước thành công${step && !isTerminal ? ` · Hiện tại: ${stepTitle(step)}` : ''}` : 'Chưa có bước thực thi.'}</p></div></header>{steps.length > 0 && <>
        <div className="lo-step-counts" aria-label="Thống kê lượt bước">{[
          ['Thành công', steps.filter(item => item.status === 'SUCCEEDED').length],
          ['Đang thực hiện', steps.filter(item => ['RUNNING', 'RETRYING'].includes(item.status)).length],
          ['Chưa thực hiện', steps.filter(item => item.status === 'PENDING').length],
          ['Lỗi / quá hạn', steps.filter(item => ['FAILED', 'TIMED_OUT', 'RECOVERY_REQUIRED'].includes(item.status)).length],
        ].map(([title, count]) => <div key={title}><strong>{count}</strong><span>{title}</span></div>)}</div>
        <p className="lo-progress-caption">Số lượt bước đã ghi nhận, gồm cả lần thử lại; không biểu thị phần trăm hoàn thành quy trình.</p>
        <ol className="lo-steps">{steps.map((item, index) => <li id={`lo-step-${job.jobId}-${item.jobStepId}`} key={item.jobStepId || index} className={`lo-step lo-step-${statusInfo(item.status).tone} ${item.jobStepId === job.selectedJobStepId && !isTerminal ? 'is-current' : ''}`}><span className="lo-step-number">{item.status === 'SUCCEEDED' ? <Icon name="check" /> : index + 1}</span><div><div className="lo-step-heading"><strong>{stepTitle(item)}</strong><Badge status={item.status} /></div><small>{[item.attemptNo > 1 ? `Lần thử ${item.attemptNo}` : null, item.startedAt ? stamp(item.startedAt) : null].filter(Boolean).join(' · ')}</small><details><summary>Thông tin bước</summary><StepDetails step={item} catalogs={catalogs} /></details></div></li>)}</ol></>}</section>}
      {activeTab === 'events' && <JobEvents jobId={job.jobId} steps={steps} revision={isTerminal ? manualRevision : refreshTick} />}
      {activeTab === 'recovery' && permissions.recover && <RecoveryPanel detail={{ ...detail, job }} refreshTick={refreshTick} onDetail={accept} getLatestDetail={() => current.current} onSaved={onSaved} role={role} disabled={!!error} />}
      {activeTab === 'technical' && <JobTechnicalPanel detail={{ ...detail, job }} catalogs={catalogs} />}
    </>}
    {action && <OperationDialog key={action.op.key} {...action} resource={jobResource} row={action.snapshot} role={role} bindings={{ id: job.jobId, jobId: job.jobId }} beforeSubmit={beforeSubmit} onClose={() => setAction(null)} onSaved={() => { const message = action.op.path.endsWith('/cancel') ? 'Đã gửi yêu cầu hủy. Đang chờ máy chủ xử lý.' : `Đã gửi thao tác: ${action.title}.`; setAction(null); onSaved(message); }} />}
  </article>;
}

function JobEvents({ jobId, revision, steps }) {
  const [page, setPage] = useState(0), [snapshot, setSnapshot] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const saved = useRef(null), inFlight = useRef(null);
  const identity = `${jobId}:${page}`;
  const load = useCallback(async () => {
    // Polling and manual refresh share one request. A slow response must be
    // allowed to finish instead of being aborted by the next refresh tick.
    if (inFlight.current?.identity === identity && !inFlight.current.controller.signal.aborted) return;
    const request = { identity, controller: new AbortController() };
    inFlight.current = request;
    if (saved.current?.identity !== identity) { setLoading(true); setError(''); }
    try {
      const value = await callBackend('GET /api/v1/jobs/{id}/events', { path: { id: jobId }, query: { page, size: 20 } }, { signal: request.controller.signal });
      if (request.controller.signal.aborted) return;
      const next = { identity, value };
      saved.current = next;
      setSnapshot(previous => previous?.identity === identity && JSON.stringify(previous.value) === JSON.stringify(value) ? previous : next);
      setError('');
    } catch (cause) {
      if (!request.controller.signal.aborted) setError(cause.message || 'Không cập nhật được nhật ký.');
    } finally {
      if (inFlight.current === request) { inFlight.current = null; if (!request.controller.signal.aborted) setLoading(false); }
    }
  }, [jobId, page, identity]);
  useEffect(() => {
    load();
    return () => { if (inFlight.current?.identity === identity) inFlight.current.controller.abort(); };
  }, [load, identity]);
  useEffect(() => { load(); }, [revision, load]);
  const hasPage = snapshot?.identity === identity;
  const result = hasPage ? snapshot.value : null;
  const events = Array.isArray(result) ? result : result?.content || [];
  return <section className="lo-events">
    <header><div><h4>Nhật ký thực thi</h4><p>Theo thứ tự xảy ra · thời gian trên thiết bị của bạn</p></div><div><span>{result?.totalElements ?? events.length} sự kiện</span><button className="lo-text-button" onClick={load} disabled={loading}>Cập nhật nhật ký</button></div></header>
    {error && <div className="lo-notice lo-notice-error" role="alert"><div><p>{error}</p>{hasPage && <small>Đang giữ nhật ký đã tải để bạn tiếp tục đọc.</small>}</div><button className="lo-text-button" onClick={load}>Thử lại</button></div>}
    {!hasPage ? !error && <p role="status">Đang tải nhật ký…</p> : !events.length ? <p className="lo-muted">Chưa có sự kiện được ghi nhận cho công việc này.</p> : <ol className="lo-event-list">{events.map((event, index) => <li key={event.jobEventId || index}><span className="lo-event-dot" /><div><time>{stamp(event.occurredAt || event.receivedAt)}</time><strong>{eventTitles[event.eventType] || (vi(event.eventType) !== event.eventType ? vi(event.eventType) : 'Cập nhật thực thi')}</strong>{(event.previousStatus || event.newStatus) && <p>{label(event.previousStatus || 'Bắt đầu')} → {label(event.newStatus || 'Không đổi trạng thái')}</p>}{(event.eventDataJson?.reason || event.eventDataJson?.message) && <p>{event.eventDataJson.reason || event.eventDataJson.message}</p>}<details><summary>Chi tiết sự kiện</summary><EventDetails event={event} steps={steps} /></details></div></li>)}</ol>}
    {(result?.totalPages || 0) > 1 && <footer className="lo-pagination"><button className="lo-button" disabled={!page || loading} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page + 1}/{result.totalPages}</span><button className="lo-button" disabled={loading || page + 1 >= result.totalPages} onClick={() => setPage(value => value + 1)}>Sau</button></footer>}
  </section>;
}
