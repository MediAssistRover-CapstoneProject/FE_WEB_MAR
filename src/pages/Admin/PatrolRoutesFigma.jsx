import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSession } from '../../features/auth/session.js';
import { API_BASE_URL } from '../../features/api/client.js';
import { allPatrolPages, patrolApi, patrolDispatchApi } from '../../features/patrol/patrolApi.js';
import { OPEN_PATROL_STATUSES, isPatrolWorkflow, jobStatus, jobStopPending, newPatrolDispatch, patrolReadiness, patrolRoute } from '../../features/patrol/patrolModel.js';
import { allFacilityPages, facilityApi } from '../../features/facility/facilityApi.js';
import { resumeDispatch } from '../../features/workflows/dispatchModel.js';
import CreatePatrolRoute from './patrol/CreatePatrolRoute.jsx';
import { JobAction } from './patrol/PatrolJobMonitor.jsx';
import PatrolQueuePanel from './patrol/PatrolQueuePanel.jsx';
import { DispatchPanel, RouteLibrary, RouteMapPanel } from './patrol/PatrolPlanningPanels.jsx';
import { Button, Empty, Icon, Modal } from './patrol/PatrolUi.jsx';
import './patrol/patrolWorkspace.css';
import './patrol/patrolRedesign.css';

const blankCatalog = { workflows: [], robots: [], maps: [], endpoints: [], zones: [] };
const robotName = robot => robot?.robotName || robot?.robotCode || 'Chưa phân công';
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
    tick(); document.addEventListener('visibilitychange', tick); window.addEventListener('focus', tick);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
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
  const [search, setSearch] = useState(''), [mapFilter, setMapFilter] = useState(''), [notice, setNotice] = useState('');
  const workflowId = params.get('workflowId') || '';
  const writable = session.mode !== 'demo';
  const refresh = () => setRevision(value => value + 1);
  const selectRoute = id => { const next = new URLSearchParams(params); if (id) next.set('workflowId', id); else next.delete('workflowId'); setParams(next, { replace: true }); };
  useEffect(() => {
    if (!params.has('view')) return;
    const next = new URLSearchParams(params);
    next.delete('view');
    setParams(next, { replace: true });
  }, [params, setParams]);
  useEffect(() => {
    const controller = new AbortController(); const options = { signal: controller.signal };
    setLoading(true); setCatalogError('');
    Promise.all([allPatrolPages((query, config) => patrolApi.listWorkflows({ ...query, includeDeleted: true }, config), options), allPatrolPages(patrolApi.listRobots, options), allFacilityPages(query => facilityApi.listMaps(query, options)), allFacilityPages(query => facilityApi.listEndpoints(query, options)), allFacilityPages(query => facilityApi.listZones(query, options))])
      .then(([workflows, robots, maps, endpoints, zones]) => {
        if (controller.signal.aborted) return;
        setCatalog({ workflows: workflows.filter(isPatrolWorkflow).sort((a, b) => Number(b.status === 'PUBLISHED') - Number(a.status === 'PUBLISHED') || (a.workflowName || '').localeCompare(b.workflowName || '', 'vi')), robots, maps, endpoints, zones });
      }).catch(cause => { if (!controller.signal.aborted) setCatalogError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => { if (!workflowId && !mapFilter && catalog.workflows.length) selectRoute(catalog.workflows[0].workflowId); }, [catalog.workflows, workflowId, mapFilter]);
  const changeMap = id => {
    setMapFilter(id);
    if (id && catalog.workflows.find(item => item.workflowId === workflowId)?.defaultInputsJson?.map_id !== id) selectRoute(catalog.workflows.find(item => item.defaultInputsJson?.map_id === id)?.workflowId || '');
  };
  const visibleRoutes = catalog.workflows.filter(workflow => (!mapFilter || workflow.defaultInputsJson?.map_id === mapFilter) && `${workflow.workflowName} ${workflow.workflowCode}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  return <section className="pt-page pt-command-center">
    <header className="pt-page-heading"><div><div className="pt-eyebrow">VẬN HÀNH ROBOT</div><h2>Trung tâm tuần tra</h2><p>Chọn tuyến trên bản đồ, giao robot và theo dõi từng lượt thực hiện.</p></div><div className="pt-actions"><a className="pt-btn pt-queue-jump" href="#patrol-queue"><Icon name="clock"/>Hàng đợi</a><Button icon="refresh" onClick={refresh} disabled={loading}>Làm mới</Button><Button icon="plus" tone="primary" onClick={() => setCreating(true)} disabled={!writable || loading || !!catalogError}>Tạo tuyến tuần tra</Button></div></header>
    {!writable && <p className="pt-notice">Bạn đang ở chế độ xem thử. Đăng nhập tài khoản quản trị để tạo tuyến và điều khiển robot.</p>}
    {catalogError && <div className="pt-alert" role="alert"><strong>Chưa tải được dữ liệu tuần tra.</strong><span>{catalogError}</span><Button icon="refresh" onClick={refresh}>Thử lại</Button></div>}
    {notice && <div className="pt-success" role="status"><Icon name="check"/><span>{notice}</span><Button className="pt-icon-btn" icon="close" aria-label="Ẩn thông báo" onClick={() => setNotice('')}/></div>}
    <PatrolOperations catalog={catalog} loading={loading} catalogError={catalogError} workflowId={workflowId} selectRoute={selectRoute} visibleRoutes={visibleRoutes} mapFilter={mapFilter} changeMap={changeMap} search={search} setSearch={setSearch} revision={revision} refresh={refresh} writable={writable} session={session} setNotice={setNotice} onCreate={() => setCreating(true)}/>
    {creating && <CreatePatrolRoute catalog={catalog} onClose={() => { setCreating(false); refresh(); }} onCreated={id => { setCreating(false); setMapFilter(''); selectRoute(id); refresh(); setNotice('Đã tạo và phát hành tuyến tuần tra. Chọn robot để điều phối.'); }}/ >}
  </section>;
}

function PatrolOperations({ catalog, loading, catalogError, workflowId, selectRoute, visibleRoutes, mapFilter, changeMap, search, setSearch, revision, refresh, writable, session, setNotice, onCreate }) {
  const storageKey = `mediassist.patrol.dispatch.v1:${API_BASE_URL}:${session.account.accountId}`;
  const [attempt, setAttempt] = useState(() => restoreAttempt(storageKey));
  const [robotId, setRobotId] = useState(() => restoreAttempt(storageKey)?.body.robotId || '');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const [monitoredId, setMonitoredId] = useState(''), [jobAction, setJobAction] = useState(null), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const actionLock = useRef(false), attemptRef = useRef(attempt);
  const workflowIds = useMemo(() => new Set(catalog.workflows.map(workflow => workflow.workflowId)), [catalog.workflows]);
  const workflowKey = [...workflowIds].sort().join(',');
  const jobsPoll = usePoll(async signal => {
    if (!workflowIds.size) return [];
    const groups = await Promise.all([...OPEN_PATROL_STATUSES, 'CANCELLED'].map(status => allPatrolPages((query, options) => patrolApi.listJobs({ ...query, status, includeDeleted: true }, options), { signal })));
    return [...new Map(groups.flat().filter(job => workflowIds.has(job.workflowId) && (OPEN_PATROL_STATUSES.has(job.status) || jobStopPending(job))).map(job => [job.jobId, job])).values()].sort((a, b) => (a.queuedAt || '').localeCompare(b.queuedAt || ''));
  }, [workflowKey, revision]);
  const jobs = jobsPoll.data || [];
  const historyPoll = usePoll(async signal => {
    if (!workflowIds.size) return [];
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const groups = await Promise.all(['SUCCEEDED', 'FAILED', 'CANCELLED'].map(status => allPatrolPages((query, options) => patrolApi.listJobs({ ...query, status, from, includeDeleted: true }, options), { signal })));
    return groups.flat().filter(job => workflowIds.has(job.workflowId)).sort((a, b) => (b.endedAt || b.queuedAt || '').localeCompare(a.endedAt || a.queuedAt || '')).slice(0, 100);
  }, [workflowKey, revision], 30000);
  const detailPoll = usePoll(signal => workflowId ? patrolApi.getWorkflow(workflowId, { signal }) : Promise.resolve(null), [workflowId, revision], 30000);
  const detail = detailPoll.data?.workflow?.workflowId === workflowId ? detailPoll.data : null;
  const route = useMemo(() => patrolRoute(detail, catalog.endpoints), [detail, catalog.endpoints]);
  const map = catalog.maps.find(item => item.mapId === route.mapId);
  const monitoredPoll = usePoll(signal => monitoredId ? patrolApi.getJob(monitoredId, { signal }) : Promise.resolve(null), [monitoredId, revision]);
  const monitored = monitoredPoll.data?.job?.jobId === monitoredId ? monitoredPoll.data : null;
  const viewRobotId = robotId || monitored?.job?.robotId;
  const snapshotPoll = usePoll(signal => viewRobotId ? patrolApi.getRobotSnapshot(viewRobotId, { signal }) : Promise.resolve(null), [viewRobotId, revision]);
  const snapshot = snapshotPoll.data;
  const robot = snapshot?.robot?.robotId === robotId ? snapshot.robot : catalog.robots.find(item => item.robotId === robotId);
  const readiness = patrolReadiness(robot, snapshot, route, { jobs, now });
  const dataIssues = [loading && 'Đang cập nhật danh mục bản đồ và robot.', !detail && 'Chọn tuyến có chi tiết hợp lệ.', !map && detail && 'Chưa tìm thấy bản đồ của tuyến.', map && map.status !== 'ACTIVE' && 'Bản đồ của tuyến chưa được kích hoạt.', catalogError && 'Chưa tải đủ danh mục. Làm mới để tiếp tục.', detailPoll.error && `Chưa đọc được tuyến: ${detailPoll.error}`, snapshotPoll.error && `Chưa cập nhật được robot: ${snapshotPoll.error}`, jobsPoll.error && 'Chưa kiểm tra được hàng đợi hiện tại.', (!jobsPoll.updatedAt || now - jobsPoll.updatedAt > 20000) && 'Đang chờ dữ liệu hàng đợi mới.', !writable && 'Chế độ xem thử không gửi lệnh tới robot.'].filter(Boolean);
  const blocked = readiness.blocked || dataIssues.length > 0;
  const reasons = [...new Set([...readiness.reasons, ...dataIssues])];
  const attemptPoll = usePoll(signal => attempt?.scheduleId ? patrolApi.getSchedule(attempt.scheduleId, { signal }) : Promise.resolve(null), [attempt?.scheduleId, revision]);
  const observedAttempt = attemptPoll.data?.scheduleId === attempt?.scheduleId ? attemptPoll.data : null;
  const dispatchedJobPoll = usePoll(async signal => {
    if (!attempt?.scheduleId) return null;
    const items = await allPatrolPages((query, options) => patrolApi.listJobs({ ...query, workflowId: attempt.body.workflowId, robotId: attempt.body.robotId, includeDeleted: true }, options), { signal });
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
  const listedMonitored = jobs.find(job => job.jobId === monitoredId) || historyPoll.data?.find(job => job.jobId === monitoredId);
  const detailBehind = monitored && listedMonitored && Number(listedMonitored.rowVersion) > Number(monitored.job.rowVersion);
  const detailError = monitoredPoll.error || (detailBehind ? 'Trạng thái lượt vừa thay đổi. Đang đồng bộ lại chi tiết mới nhất.' : '');
  const controlFresh = writable && !jobsPoll.error && !!jobsPoll.updatedAt && now - jobsPoll.updatedAt < 20000 && !detailError && !!monitoredPoll.updatedAt && now - monitoredPoll.updatedAt < 20000;
  const targetEndpointId = monitored?.job.workflowId === workflowId && monitored.job.robotId === viewRobotId ? monitored.patrol?.targetEndpointId : undefined;
  return <>
    <div className="pt-stats">
      <Stat icon="route" label="Tuyến sẵn sàng" value={loading ? '—' : catalog.workflows.filter(item => item.status === 'PUBLISHED' && item.acceptsNewJobs).length} caption="Đã phát hành, nhận việc mới"/>
      <Stat icon="clock" label="Chờ robot" value={!jobsPoll.updatedAt ? '—' : jobs.filter(job => ['QUEUED', 'ACCEPTED'].includes(job.status)).length} caption="Đã tạo nhiệm vụ thực tế"/>
      <Stat icon="robot" tone="green" label="Đang tuần tra" value={!jobsPoll.updatedAt ? '—' : jobs.filter(job => job.status === 'RUNNING' && !job.cancelRequestedAt).length} caption="Robot đang thực hiện"/>
      <Stat icon="pause" tone="amber" label="Tạm dừng / cần kiểm tra" value={!jobsPoll.updatedAt ? '—' : jobs.filter(job => ['SUSPENDING', 'SUSPENDED', 'RECOVERY_REQUIRED'].includes(job.status) || jobStopPending(job)).length} caption="Giữ tiến độ và lý do dừng"/>
    </div>
    <RouteLibrary catalog={catalog} loading={loading} error={catalogError} workflows={visibleRoutes} workflowId={workflowId} selectRoute={selectRoute} mapFilter={mapFilter} changeMap={changeMap} search={search} setSearch={setSearch} writable={writable} onCreate={onCreate}/>
    <div className="pt-workspace pt-planning-workspace">
      <RouteMapPanel workflowId={workflowId} detail={detail} route={route} map={map} catalog={catalog} error={detailPoll.error} loading={!detail} snapshot={snapshotPoll.error && snapshot ? { ...snapshot, heartbeatFresh: false } : snapshot} robot={snapshot?.robot || robot} targetEndpointId={targetEndpointId} onRefresh={refresh}/>
      <DispatchPanel catalog={catalog} route={route} map={map} robotId={robotId} onRobotChange={id => { setRobotId(id); setActionError(''); }} robot={robot} snapshot={snapshot} blocked={blocked} reasons={reasons} busy={busy} pending={!!attempt} onReview={() => setReview(true)} updatedAt={robotId ? snapshotPoll.updatedAt : null}/>
    </div>
    {attempt && <div className="pt-pending" role="status"><span className="pt-pending-icon"><Icon name="clock"/></span><div><strong>{observedAttempt?.status === 'RETIRED' ? 'Lượt gửi đã được xử lý' : 'Đang xác nhận lượt gửi'}</strong><p>{attempt.workflowName} · {robotName(catalog.robots.find(item => item.robotId === attempt.body.robotId))}</p><p>{observedAttempt?.status === 'RETIRED' ? 'Chưa xác nhận được nhiệm vụ tương ứng. Lượt có thể bị bỏ qua nếu robot chưa đủ điều kiện; kiểm tra hàng đợi trước khi gửi lượt mới.' : 'Đang chờ hệ thống tạo nhiệm vụ. Chưa xác nhận robot đã bắt đầu.'}</p>{(attemptPoll.error || dispatchedJobPoll.error) && <p>{attemptPoll.error || dispatchedJobPoll.error}</p>}</div><div className="pt-actions"><Button icon="refresh" disabled={busy || !writable} onClick={dispatch}>Kiểm tra lượt gửi</Button>{observedAttempt?.status === 'RETIRED' && <Button disabled={busy} onClick={() => saveAttempt(null)}>Đóng lượt theo dõi</Button>}</div></div>}
    {actionError && <p className="pt-alert" role="alert">{actionError}</p>}
    <PatrolQueuePanel jobs={jobs} historyJobs={historyPoll.data || []} loading={!jobsPoll.updatedAt && !jobsPoll.error} error={jobsPoll.error} historyLoading={!historyPoll.updatedAt && !historyPoll.error} historyError={historyPoll.error} updatedAt={jobsPoll.updatedAt} catalog={catalog} selectedId={monitoredId} detail={monitored} detailError={detailError} writable={controlFresh} onSelect={setMonitoredId} onAction={kind => setJobAction({ kind, detail: monitored })} onRefresh={refresh}/>
    <p className="pt-history-note">Lịch sử hiển thị tối đa 100 lượt trong 7 ngày gần nhất. <Link to="/admin/live-operations">Mở vận hành trực tiếp</Link></p>
    {review && <Modal title="Bắt đầu tuần tra?" subtitle="Kiểm tra bản đồ và robot trước khi đưa lượt vào hàng đợi." onClose={() => setReview(false)} busy={busy}><div className="pt-form-body"><dl className="pt-review-list"><div><dt>Tuyến tuần tra</dt><dd>{route.workflow?.workflowName}</dd></div><div><dt>Robot thực hiện</dt><dd>{robotName(robot)}</dd></div><div><dt>Bản đồ</dt><dd>{map?.mapName}</dd></div><div><dt>Hành trình</dt><dd>{route.checkpoints.length} điểm · {roundLabel(route)}</dd></div></dl><p className="pt-notice">Robot ưu tiên SOS và nhiệm vụ khẩn cấp. Lượt chỉ được tính đang chạy sau khi robot nhận và thực hiện.</p>{blocked && <p className="pt-alert" role="status">Điều kiện robot hoặc tuyến đã thay đổi. Quay lại để kiểm tra trạng thái mới nhất.</p>}</div><footer className="pt-dialog-footer"><Button disabled={busy} onClick={() => setReview(false)}>Quay lại</Button><Button icon="play" tone="primary" disabled={busy || blocked} onClick={dispatch}>{busy ? 'Đang gửi…' : 'Xác nhận bắt đầu'}</Button></footer></Modal>}
    {jobAction && <JobAction kind={jobAction.kind} detail={monitored?.job.jobId === jobAction.detail.job.jobId ? monitored : jobAction.detail} canAct={controlFresh && monitored?.job.jobId === jobAction.detail.job.jobId} onClose={() => setJobAction(null)} onSaved={message => { setJobAction(null); setNotice(message); refresh(); }}/ >}
  </>;
}

function Stat({ icon, label, value, caption, tone = 'blue' }) {
  return <article className="pt-stat"><span className={`pt-stat-icon pt-tone-${tone}`}><Icon name={icon}/></span><div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></article>;
}
