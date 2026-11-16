import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSession } from '../../features/auth/session.js';
import { API_BASE_URL } from '../../features/api/client.js';
import { allPatrolPages, patrolApi, patrolDispatchApi } from '../../features/patrol/patrolApi.js';
import { OPEN_PATROL_STATUSES, isPatrolWorkflow, jobStatus, newPatrolDispatch, patrolReadiness, patrolRoute, SENSING_OPTIONS } from '../../features/patrol/patrolModel.js';
import { allFacilityPages, facilityApi } from '../../features/facility/facilityApi.js';
import { resumeDispatch } from '../../features/workflows/dispatchModel.js';
import CreatePatrolRoute from './patrol/CreatePatrolRoute.jsx';
import PatrolMapPreview from './patrol/PatrolMapPreview.jsx';
import PatrolJobMonitor, { JobAction } from './patrol/PatrolJobMonitor.jsx';
import { Button, Empty, Icon, Modal } from './patrol/PatrolUi.jsx';
import './patrol/patrolWorkspace.css';

const blankCatalog = { workflows: [], robots: [], maps: [], endpoints: [], zones: [] };
const robotName = robot => robot?.robotName || robot?.robotCode || 'Chưa phân công';
const robotStatuses = { IDLE: 'Đang nghỉ', BUSY: 'Đang làm nhiệm vụ', OFFLINE: 'Mất kết nối', CHARGING: 'Đang sạc', ERROR: 'Cần kiểm tra', MAINTENANCE: 'Bảo trì' };
const time = value => value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Chưa cập nhật';
const roundLabel = route => route?.continuous ? 'Lặp liên tục' : `${route?.repeatCount ?? 1} vòng`;
function restoreAttempt(key) {
  try { const value = JSON.parse(sessionStorage.getItem(key)); return value?.code?.startsWith('PATROL_') && value.body?.scheduleCode === value.code && value.body.robotId && value.body.workflowId ? value : null; }
  catch { return null; }
}

// Reads never overlap and pause while the page is hidden.
function usePoll(load, deps, interval = 8000) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => {
    const controller = new AbortController(); let timer, running = false;
    setData(null); setError(''); setUpdatedAt(null);
    const tick = async () => {
      clearTimeout(timer);
      if (running || controller.signal.aborted || document.hidden) return;
      running = true;
      try { const value = await load(controller.signal); if (!controller.signal.aborted) { setData(value); setError(''); setUpdatedAt(Date.now()); } }
      catch (cause) { if (!controller.signal.aborted) setError(cause.message); }
      finally { running = false; if (!controller.signal.aborted) timer = setTimeout(tick, interval); }
    };
    tick(); document.addEventListener('visibilitychange', tick);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
  }, deps);
  return { data, error, updatedAt };
}

export default function PatrolRoutesFigma() {
  const session = getSession();
  if (session?.account?.role !== 'ADMIN') return <section className="pt-page"><Empty title="Quản lý tuần tra dành cho quản trị viên" action={<Link to="/admin/live-operations">Mở vận hành trực tiếp →</Link>}>Theo dõi các nhiệm vụ của bạn trong trang vận hành.</Empty></section>;
  return <PatrolWorkspace key={`${API_BASE_URL}:${session.account.accountId}`} session={session}/>;
}

function PatrolWorkspace({ session }) {
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false), [revision, setRevision] = useState(0);
  const [catalog, setCatalog] = useState(blankCatalog), [loading, setLoading] = useState(true), [catalogError, setCatalogError] = useState('');
  const [search, setSearch] = useState(''), [notice, setNotice] = useState('');
  const workflowId = params.get('workflowId') || '';
  const writable = session.mode !== 'demo';
  const refresh = () => setRevision(value => value + 1);
  const selectRoute = id => { const next = new URLSearchParams(params); next.set('workflowId', id); setParams(next, { replace: true }); };
  useEffect(() => {
    if (!params.has('view')) return;
    const next = new URLSearchParams(params);
    next.delete('view');
    setParams(next, { replace: true });
  }, [params, setParams]);
  useEffect(() => {
    const controller = new AbortController(); const options = { signal: controller.signal };
    setLoading(true); setCatalogError('');
    Promise.all([allPatrolPages(patrolApi.listWorkflows, options), allPatrolPages(patrolApi.listRobots, options), allFacilityPages(query => facilityApi.listMaps(query, options)), allFacilityPages(query => facilityApi.listEndpoints(query, options)), allFacilityPages(query => facilityApi.listZones(query, options))])
      .then(([workflows, robots, maps, endpoints, zones]) => {
        if (controller.signal.aborted) return;
        setCatalog({ workflows: workflows.filter(isPatrolWorkflow).sort((a, b) => Number(b.status === 'PUBLISHED') - Number(a.status === 'PUBLISHED') || (a.workflowName || '').localeCompare(b.workflowName || '', 'vi')), robots, maps, endpoints, zones });
      }).catch(cause => { if (!controller.signal.aborted) setCatalogError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => { if (!workflowId && catalog.workflows.length) selectRoute(catalog.workflows[0].workflowId); }, [catalog.workflows, workflowId]);
  const visibleRoutes = catalog.workflows.filter(workflow => `${workflow.workflowName} ${workflow.workflowCode}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return <section className="pt-page">
    <header className="pt-page-heading"><div><div className="pt-eyebrow">VẬN HÀNH ROBOT</div><h2>Quản lý tuần tra</h2><p>Thiết lập tuyến, phân công robot và theo dõi hành trình tại một nơi.</p></div><div className="pt-actions"><Button icon="refresh" onClick={refresh} disabled={loading}>Làm mới</Button><Button icon="plus" tone="primary" onClick={() => setCreating(true)} disabled={!writable || loading || !!catalogError}>Tạo tuyến tuần tra</Button></div></header>
    <div className="pt-section-nav"><span><Icon name="shield"/>Tuyến & điều phối</span><Link className="pt-text-link" to="/admin/live-operations">Vận hành trực tiếp <Icon name="arrow"/></Link></div>
    {!writable && <p className="pt-notice">Bạn đang ở chế độ xem thử. Đăng nhập tài khoản quản trị để tạo tuyến và điều khiển robot.</p>}
    {catalogError && <div className="pt-alert" role="alert"><strong>Chưa tải được dữ liệu tuần tra.</strong><span>{catalogError}</span><Button icon="refresh" onClick={refresh}>Thử lại</Button></div>}
    {notice && <div className="pt-success" role="status"><Icon name="check"/><span>{notice}</span><Button className="pt-icon-btn" icon="close" aria-label="Ẩn thông báo" onClick={() => setNotice('')}/></div>}
    <PatrolOperations catalog={catalog} loading={loading} catalogError={catalogError} workflowId={workflowId} selectRoute={selectRoute} visibleRoutes={visibleRoutes} search={search} setSearch={setSearch} revision={revision} refresh={refresh} writable={writable} session={session} setNotice={setNotice} onCreate={() => setCreating(true)}/>
    {creating && <CreatePatrolRoute catalog={catalog} onClose={() => { setCreating(false); refresh(); }} onCreated={id => { setCreating(false); selectRoute(id); refresh(); setNotice('Đã tạo và phát hành tuyến tuần tra. Chọn robot để điều phối.'); }}/ >}
  </section>;
}

function PatrolOperations({ catalog, loading, catalogError, workflowId, selectRoute, visibleRoutes, search, setSearch, revision, refresh, writable, session, setNotice, onCreate }) {
  const storageKey = `mediassist.patrol.dispatch.v1:${API_BASE_URL}:${session.account.accountId}`;
  const [attempt, setAttempt] = useState(() => restoreAttempt(storageKey));
  const [robotId, setRobotId] = useState(() => restoreAttempt(storageKey)?.body.robotId || '');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const [monitoredId, setMonitoredId] = useState(''), [jobAction, setJobAction] = useState(null);
  const actionLock = useRef(false), attemptRef = useRef(attempt);
  const workflowIds = useMemo(() => new Set(catalog.workflows.map(workflow => workflow.workflowId)), [catalog.workflows]);
  const workflowKey = [...workflowIds].sort().join(',');
  const jobsPoll = usePoll(async signal => {
    if (!workflowIds.size) return [];
    const groups = await Promise.all([...OPEN_PATROL_STATUSES].map(status => allPatrolPages((query, options) => patrolApi.listJobs({ ...query, status }, options), { signal })));
    return [...new Map(groups.flat().filter(job => workflowIds.has(job.workflowId)).map(job => [job.jobId, job])).values()].sort((a, b) => (b.queuedAt || '').localeCompare(a.queuedAt || ''));
  }, [workflowKey, revision]);
  const jobs = jobsPoll.data || [];
  const detailPoll = usePoll(signal => workflowId ? patrolApi.getWorkflow(workflowId, { signal }) : Promise.resolve(null), [workflowId, revision], 30000);
  const detail = detailPoll.data?.workflow?.workflowId === workflowId ? detailPoll.data : null;
  const route = useMemo(() => patrolRoute(detail, catalog.endpoints), [detail, catalog.endpoints]);
  const map = catalog.maps.find(item => item.mapId === route.mapId);
  const snapshotPoll = usePoll(signal => robotId ? patrolApi.getRobotSnapshot(robotId, { signal }) : Promise.resolve(null), [robotId, revision]);
  const snapshot = snapshotPoll.data;
  const robot = snapshot?.robot?.robotId === robotId ? snapshot.robot : catalog.robots.find(item => item.robotId === robotId);
  const readiness = patrolReadiness(robot, snapshot, route, { jobs });
  const blocked = readiness.blocked || !detail || !map || map.status !== 'ACTIVE' || !!catalogError || !!detailPoll.error || !!snapshotPoll.error || !!jobsPoll.error || !jobsPoll.updatedAt || !writable;
  const monitoredPoll = usePoll(signal => monitoredId ? patrolApi.getJob(monitoredId, { signal }) : Promise.resolve(null), [monitoredId, revision]);
  const monitored = monitoredPoll.data?.job?.jobId === monitoredId ? monitoredPoll.data : null;
  const attemptPoll = usePoll(signal => attempt?.scheduleId ? patrolApi.getSchedule(attempt.scheduleId, { signal }) : Promise.resolve(null), [attempt?.scheduleId, revision]);
  const observedAttempt = attemptPoll.data?.scheduleId === attempt?.scheduleId ? attemptPoll.data : null;
  const dispatchedJobPoll = usePoll(async signal => {
    if (!attempt?.scheduleId) return null;
    const items = await allPatrolPages((query, options) => patrolApi.listJobs({ ...query, workflowId: attempt.body.workflowId, robotId: attempt.body.robotId }, options), { signal });
    return items.find(item => item.scheduleId === attempt.scheduleId) || null;
  }, [attempt?.scheduleId, revision]);
  const saveAttempt = value => { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); attemptRef.current = value; setAttempt(value); };
  useEffect(() => { if (!monitoredId && jobs.length) setMonitoredId(jobs[0].jobId); }, [jobs, monitoredId]);
  useEffect(() => {
    if (!attempt?.scheduleId) return;
    const job = jobs.find(item => item.scheduleId === attempt.scheduleId) || dispatchedJobPoll.data;
    if (job?.scheduleId === attempt.scheduleId) { setMonitoredId(job.jobId); saveAttempt(null); setNotice(OPEN_PATROL_STATUSES.has(job.status) ? 'Robot đã có nhiệm vụ tuần tra. Theo dõi trạng thái thực tế bên dưới.' : `Lượt tuần tra đã được xử lý: ${jobStatus(job).label.toLocaleLowerCase('vi')}. Xem chi tiết bên dưới.`); }
  }, [jobs, attempt?.scheduleId, dispatchedJobPoll.data]);
  const dispatch = async () => {
    if (actionLock.current || (!attemptRef.current && blocked)) return;
    actionLock.current = true; setBusy(true); setActionError('');
    try {
      let pending = attemptRef.current;
      if (!pending) { pending = newPatrolDispatch(route.workflow, robotId, crypto.randomUUID()); saveAttempt(pending); }
      const result = await resumeDispatch(pending, patrolDispatchApi, saveAttempt);
      setReview(false); refresh(); setNotice(result.status === 'RETIRED' ? 'Lượt điều phối đã được xử lý. Hãy kiểm tra nhiệm vụ; lượt có thể bị bỏ qua nếu robot chưa đủ điều kiện.' : 'Đã gửi lượt tuần tra. Đang chờ hệ thống tạo và giao nhiệm vụ cho robot.');
    } catch (cause) { setActionError(`Chưa xác nhận được lượt điều phối. ${cause.message} Dùng “Kiểm tra lượt gửi” để kiểm tra cùng lượt, tránh tạo trùng.`); setReview(false); }
    finally { actionLock.current = false; setBusy(false); }
  };
  return <>
    <div className="pt-stats"><Stat icon="route" label="Tuyến đã phát hành" value={loading ? '—' : catalog.workflows.filter(item => item.status === 'PUBLISHED' && item.acceptsNewJobs).length} caption="Sẵn để chọn và phân công"/><Stat icon="robot" tone="green" label="Đang thực hiện" value={!jobsPoll.updatedAt ? '—' : jobs.filter(job => ['RUNNING', 'ACCEPTED'].includes(job.status) && !job.cancelRequestedAt).length} caption="Robot đã nhận nhiệm vụ"/><Stat icon="pause" tone="amber" label="Đang tạm treo" value={!jobsPoll.updatedAt ? '—' : jobs.filter(job => ['SUSPENDING', 'SUSPENDED'].includes(job.status)).length} caption="Giữ hành trình để tiếp tục"/></div>
    <div className="pt-workspace">
      <aside className="pt-card pt-library"><div className="pt-card-heading"><h3>Tuyến tuần tra</h3><span className="pt-count">{catalog.workflows.length}</span></div><label className="pt-search"><Icon name="search"/><input aria-label="Tìm tuyến tuần tra" placeholder="Tìm tên tuyến…" value={search} onChange={event => setSearch(event.target.value)}/></label><div className="pt-route-list">{loading && !catalog.workflows.length ? <p className="pt-loading" role="status">Đang tải danh sách tuyến…</p> : visibleRoutes.length ? visibleRoutes.map(workflow => <button type="button" className={`pt-route-card ${workflow.workflowId === workflowId ? 'is-selected' : ''}`} key={workflow.workflowId} aria-pressed={workflow.workflowId === workflowId} onClick={() => selectRoute(workflow.workflowId)}><div className="pt-route-card-top"><span className="pt-route-symbol"><Icon name="route"/></span><span className={`pt-badge ${workflow.status === 'PUBLISHED' && workflow.acceptsNewJobs ? 'pt-badge-green' : 'pt-badge-neutral'}`}>{workflow.status === 'PUBLISHED' ? workflow.acceptsNewJobs ? 'Đã phát hành' : 'Ngừng nhận việc' : workflow.status === 'ARCHIVED' ? 'Lưu trữ' : 'Bản nháp'}</span></div><strong>{workflow.workflowName}</strong><div className="pt-route-card-footer"><span>Phiên bản {workflow.versionNo}</span><Icon name="chevron"/></div></button>) : <Empty title={search ? 'Không tìm thấy tuyến' : 'Chưa có tuyến tuần tra'}>{search ? 'Thử tìm bằng một tên khác.' : 'Tạo tuyến và sắp xếp các điểm robot cần ghé.'}</Empty>}</div><Button icon="plus" className="pt-add-route" onClick={onCreate} disabled={!writable || loading || !!catalogError}>Thêm tuyến mới</Button><Link className="pt-library-link" to="/workflow">Mở trình thiết kế quy trình <Icon name="arrow"/></Link></aside>
      <section className="pt-card pt-route-detail"><div className="pt-card-heading"><div><span className="pt-eyebrow">TUYẾN ĐANG CHỌN</span><h3>{detail?.workflow.workflowName || 'Chi tiết hành trình'}</h3></div><span className="pt-soft-icon"><Icon name="map"/></span></div>{detailPoll.error && <p className="pt-alert" role="alert">Không tải được tuyến: {detailPoll.error}</p>}{workflowId && !detail && !detailPoll.error ? <p className="pt-loading" role="status">Đang đọc chi tiết hành trình…</p> : <><div className="pt-route-meta"><span><Icon name="map"/>{map?.mapName || 'Chưa xác định bản đồ'}</span><span><Icon name="loop"/>{roundLabel(route)}</span><span>{route.checkpoints.length} điểm đến</span></div><PatrolMapPreview map={map} points={route.checkpoints.map(point => point.endpoint || { endpointId: point.endpointId })} zones={catalog.zones}/><div className="pt-stop-heading"><h4>Thứ tự ghé thăm</h4><span>Xuất phát từ vị trí robot</span></div>{route.checkpoints.length ? <ol className="pt-checkpoints">{route.checkpoints.map((point, index) => <li key={point.stepId || index}><span className="pt-point-number">{index + 1}</span><div><strong>{point.endpoint?.endpointName || point.endpoint?.endpointCode || 'Điểm không còn khả dụng'}</strong><span>{SENSING_OPTIONS.find(option => option.value === point.sensingType)?.label || 'Di chuyển'}{point.windowSec ? ` · ${point.windowSec} giây` : ''}</span></div></li>)}</ol> : <p className="pt-muted">Chọn một tuyến để xem thứ tự các điểm.</p>}{route.issues.length > 0 && <div className="pt-notice">{route.issues.join(' ')}</div>}{detail && <Link className="pt-route-edit" to={`/workflow?workflowId=${encodeURIComponent(workflowId)}`}>Xem quy trình của tuyến <Icon name="arrow"/></Link>}</>}</section>
      <aside className="pt-card pt-dispatch"><div className="pt-card-heading"><div><span className="pt-eyebrow">PHÂN CÔNG THỰC HIỆN</span><h3>Điều phối robot</h3></div><span className="pt-soft-icon"><Icon name="robot"/></span></div><label className="pt-field">Robot tuần tra<select value={robotId} onChange={event => { setRobotId(event.target.value); setActionError(''); }} disabled={busy || !!attempt}><option value="">Chọn robot thực hiện</option>{catalog.robots.map(item => <option key={item.robotId} value={item.robotId}>{robotName(item)} · {robotStatuses[item.status] || item.status}</option>)}</select></label>{robot && <div className="pt-robot-info"><span className="pt-robot-avatar"><Icon name="robot"/></span><div><strong>{robotName(robot)}</strong><span>{robotStatuses[robot.status] || robot.status}{snapshot?.heartbeatFresh ? ' · Có kết nối' : ''}</span></div></div>}<dl className="pt-run-summary"><div><dt>Hành trình</dt><dd>{route.checkpoints.length} điểm / vòng</dd></div><div><dt>Chế độ chạy</dt><dd>{roundLabel(route)}</dd></div><div><dt>Thứ tự ưu tiên</dt><dd>Nhường việc khẩn cấp</dd></div></dl><div className={`pt-readiness ${!blocked ? 'is-ready' : ''}`}><Icon name={!blocked ? 'check' : 'info'}/><div><strong>{!blocked ? 'Có thể gửi điều phối' : 'Cần kiểm tra trước khi chạy'}</strong>{readiness.reasons.slice(0, 3).map(reason => <p key={reason}>{reason}</p>)}{map && map.status !== 'ACTIVE' && <p>Bản đồ của tuyến chưa được kích hoạt.</p>}{snapshotPoll.error && <p>Chưa tải được kết nối robot: {snapshotPoll.error}</p>}{jobsPoll.error && <p>Chưa kiểm tra được các nhiệm vụ đang chạy.</p>}{!blocked && <p>{readiness.note}</p>}</div></div><Button icon="play" tone="primary" className="pt-dispatch-button" disabled={blocked || busy || !!attempt} onClick={() => setReview(true)}>Bắt đầu tuần tra</Button><p className="pt-dispatch-note">Hệ thống xác nhận điều kiện robot trước khi bắt đầu. Mỗi lượt giữ nguyên tuyến và số vòng đã phát hành.</p><div className="pt-priority-note"><Icon name="shield"/><div><strong>Tự nhường nhiệm vụ ưu tiên</strong><p>Khi có SOS, yêu cầu hỗ trợ hoặc người gọi, robot tạm treo tuần tra. Xử lý xong, robot tiếp tục hành trình khi đủ điều kiện.</p></div></div></aside>
    </div>
    {attempt && <div className="pt-pending" role="status"><Icon name="clock"/><div><strong>Đang theo dõi lượt đã gửi</strong><p>{attempt.workflowName} · {robotName(catalog.robots.find(item => item.robotId === attempt.body.robotId))}</p><p>{observedAttempt?.status === 'RETIRED' ? 'Lượt đã xử lý. Nếu chưa xuất hiện nhiệm vụ, robot có thể chưa đủ điều kiện ở thời điểm điều phối.' : 'Hệ thống đang kiểm tra và giao nhiệm vụ. Chưa xác nhận robot đã bắt đầu.'}</p>{attemptPoll.error && <p>{attemptPoll.error}</p>}</div><div className="pt-actions"><Button icon="refresh" disabled={busy || !writable} onClick={dispatch}>Kiểm tra lượt gửi</Button>{observedAttempt?.status === 'RETIRED' && <Button disabled={busy} onClick={() => saveAttempt(null)}>Đóng lượt theo dõi</Button>}</div></div>}
    {actionError && <p className="pt-alert" role="alert">{actionError}</p>}
    <section className="pt-card pt-monitor"><div className="pt-card-heading"><div><span className="pt-eyebrow">GIÁM SÁT THỰC TẾ</span><h3>Hoạt động tuần tra <span className="pt-count">{jobs.length}</span></h3></div><span className="pt-update"><i className={jobsPoll.error ? 'is-error' : ''}/>{jobsPoll.error ? 'Chưa cập nhật được' : jobsPoll.updatedAt ? `Cập nhật ${time(jobsPoll.updatedAt)}` : 'Đang tải trạng thái'}</span></div>{jobsPoll.error && <p className="pt-alert" role="alert">Không cập nhật được nhiệm vụ: {jobsPoll.error}</p>}{jobs.length || monitored ? <div className="pt-monitor-layout"><div className="pt-job-list">{jobs.map(job => { const status = jobStatus(job); return <button type="button" key={job.jobId} onClick={() => setMonitoredId(job.jobId)} aria-pressed={monitoredId === job.jobId} className={monitoredId === job.jobId ? 'is-selected' : ''}><span className={`pt-badge pt-badge-${status.tone}`}>{job.cancelRequestedAt ? 'Đang yêu cầu kết thúc' : status.label}</span><strong>{catalog.workflows.find(item => item.workflowId === job.workflowId)?.workflowName || 'Tuần tra'}</strong><span>{robotName(catalog.robots.find(item => item.robotId === job.robotId))} · {time(job.startedAt || job.queuedAt)}</span></button>; })}{!jobs.length && <p className="pt-muted">Không còn tuần tra đang mở.</p>}</div><div className="pt-job-detail">{monitoredPoll.error && <p className="pt-alert" role="alert">Chưa cập nhật được chi tiết: {monitoredPoll.error}</p>}{monitored ? <PatrolJobMonitor detail={monitored} catalog={catalog} writable={writable && !monitoredPoll.error && !!monitoredPoll.updatedAt && Date.now() - monitoredPoll.updatedAt < 20000} onAction={kind => setJobAction({ kind, detail: monitored })}/> : <p className="pt-loading" role="status">Đang tải nhiệm vụ…</p>}</div></div> : jobsPoll.updatedAt ? <Empty icon="shield" title="Chưa có robot đang tuần tra">Chọn một tuyến và robot ở trên để bắt đầu. Các nhiệm vụ đang chạy hoặc tạm treo sẽ xuất hiện tại đây.</Empty> : <p className="pt-loading" role="status">Đang kiểm tra các nhiệm vụ tuần tra…</p>}</section>
    {review && <Modal title="Bắt đầu tuần tra?" subtitle="Kiểm tra phân công trước khi gửi tới robot." onClose={() => setReview(false)} busy={busy}><div className="pt-form-body"><dl className="pt-review-list"><div><dt>Tuyến tuần tra</dt><dd>{route.workflow?.workflowName}</dd></div><div><dt>Robot thực hiện</dt><dd>{robotName(robot)}</dd></div><div><dt>Bản đồ</dt><dd>{map?.mapName}</dd></div><div><dt>Hành trình</dt><dd>{route.checkpoints.length} điểm · {roundLabel(route)}</dd></div></dl><p className="pt-notice">Robot sẽ ưu tiên SOS và các nhiệm vụ khẩn cấp, sau đó tiếp tục tuần tra khi đủ điều kiện.</p></div><footer className="pt-dialog-footer"><Button disabled={busy} onClick={() => setReview(false)}>Quay lại</Button><Button icon="play" tone="primary" disabled={busy || blocked} onClick={dispatch}>{busy ? 'Đang gửi…' : 'Xác nhận bắt đầu'}</Button></footer></Modal>}
    {jobAction && <JobAction kind={jobAction.kind} detail={monitored?.job.jobId === jobAction.detail.job.jobId ? monitored : jobAction.detail} canAct={writable && !monitoredPoll.error && !!monitoredPoll.updatedAt && Date.now() - monitoredPoll.updatedAt < 20000} onClose={() => setJobAction(null)} onSaved={message => { setJobAction(null); setNotice(message); refresh(); }}/ >}
  </>;
}

function Stat({ icon, label, value, caption, tone = 'blue' }) {
  return <article className="pt-stat"><span className={`pt-stat-icon pt-tone-${tone}`}><Icon name={icon}/></span><div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></article>;
}
