import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getSession } from '../../features/auth/session.js';
import { API_BASE_URL } from '../../features/api/client.js';
import { allPatrolPages, loadPatrolWorkflows, patrolApi } from '../../features/patrol/patrolApi.js';
import { OPEN_PATROL_STATUSES, isPatrolWorkflow, jobStatus, jobStopPending, patrolReadiness, patrolRoute, patrolTemplateCount } from '../../features/patrol/patrolModel.js';
import { allFacilityPages, facilityApi } from '../../features/facility/facilityApi.js';
import { dispatchFixedPatrol } from '../../features/patrol/dispatchFixedPatrol.js';
import CreatePatrolRoute, { readPatrolRun } from './patrol/CreatePatrolRoute.jsx';
import PublishPatrolRoute from './patrol/PublishPatrolRoute.jsx';
import MonitoringRequests from './patrol/MonitoringRequests.jsx';
import { JobAction } from './patrol/PatrolJobMonitor.jsx';
import PatrolQueuePanel from './patrol/PatrolQueuePanel.jsx';
import { DispatchPanel, PatrolSchedules, RouteLibrary, RouteMapPanel } from './patrol/PatrolPlanningPanels.jsx';
import { Button, Empty, Icon, Modal } from './patrol/PatrolUi.jsx';
import './patrol/patrolWorkspace.css';
import './patrol/patrolRedesign.css';

const blankCatalog = { workflows: [], published: [], templates: [], robots: [], maps: [], endpoints: [], zones: [], groups: [], members: [], rooms: [] };
const views = [
  { id: 'routes', label: 'Tuyến tuần tra', icon: 'route', description: 'Chọn tuyến đã lưu để giao robot hoặc lập lịch tuần tra.' },
  { id: 'schedules', label: 'Lịch tuần tra', icon: 'calendar', description: 'Xem thời điểm chạy, kích hoạt hoặc tạm dừng lịch đã lưu.' },
  { id: 'queue', label: 'Hàng đợi', icon: 'robot', description: 'Theo dõi tiến độ robot và xử lý các lượt tuần tra.' },
];
const robotName = robot => robot?.robotName || robot?.robotCode || 'Chưa phân công';
const roundLabel = route => route?.continuous ? 'Lặp liên tục' : `${route?.repeatCount ?? 1} vòng`;
function restoreAttempt(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key));
    if (value?.kind === 'job' && value.key?.startsWith('PATROL_') && value.workflowId && value.body?.robotId) return value;
    return value?.code?.startsWith('PATROL_') && value.body?.scheduleCode === value.code && value.body.robotId && value.body.workflowId ? value : null;
  }
  catch { return null; }
}

// Reads never overlap and pause while the page is hidden.
function usePoll(load, deps, interval = 8000, enabled = true) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => {
    setData(null); setError(''); setUpdatedAt(null);
    if (!enabled) return;
    const controller = new AbortController(); let timer, running = false;
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
  }, [...deps, enabled]);
  return { data, error, updatedAt };
}

export default function PatrolRoutesFigma() {
  const session = getSession();
  if (session?.account?.role !== 'ADMIN') return <section className="pt-page"><Empty title="Quản lý tuần tra dành cho quản trị viên" action={<Link to="/admin/live-operations">Mở vận hành trực tiếp →</Link>}>Theo dõi các nhiệm vụ của bạn trong trang vận hành.</Empty></section>;
  return <PatrolWorkspace key={`${API_BASE_URL}:${session.account.accountId}`} session={session}/>;
}

function PatrolWorkspace({ session }) {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const [creating, setCreating] = useState(null), [revision, setRevision] = useState(0);
  const [catalog, setCatalog] = useState(blankCatalog), [loading, setLoading] = useState(true), [routeError, setRouteError] = useState('');
  const [loadingResources, setLoadingResources] = useState(true), [resourceError, setResourceError] = useState('');
  const [search, setSearch] = useState(''), [mapFilter, setMapFilter] = useState(''), [notice, setNotice] = useState('');
  const templateStorageKey = `mediassist.patrol.template-run.v1:${API_BASE_URL}:${session.account.accountId}`;
  const [pendingTemplate, setPendingTemplate] = useState(() => readPatrolRun(templateStorageKey));
  const [createdJobId, setCreatedJobId] = useState('');
  const requestedId = params.get('workflowId') || '';
  const requestedView = params.get('view');
  const activeView = views.find(item => item.id === (requestedView || (hash === '#patrol-queue' ? 'queue' : 'routes'))) || views[0];
  const view = activeView.id;
  const writable = session.mode !== 'demo';
  const refresh = () => setRevision(value => value + 1);

  function locationFor(nextView, id = requestedId) {
    const next = new URLSearchParams(params);
    if (nextView === 'routes') next.delete('view'); else next.set('view', nextView);
    if (id) next.set('workflowId', id); else next.delete('workflowId');
    return next;
  }
  const selectRoute = id => setParams(locationFor('routes', id), { replace: true });
  useEffect(() => {
    if (requestedView && !views.some(item => item.id === requestedView)) {
      const next = new URLSearchParams(params);
      next.delete('view'); setParams(next, { replace: true });
    }
  }, [params, requestedView, setParams]);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setLoading(true); setRouteError(''); setLoadingResources(true); setResourceError('');
    loadPatrolWorkflows(options, writable).then(routes => {
      if (controller.signal.aborted) return;
      if (routes.metadataMissing) setMapFilter('');
      setCatalog(previous => ({ ...previous, ...routes }));
    }).catch(error => { if (!controller.signal.aborted) setRouteError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    const resources = [
      ['robots', 'robot', allPatrolPages(patrolApi.listRobots, options)],
      ['maps', 'bản đồ', allFacilityPages(query => facilityApi.listMaps(query, options))],
      ['endpoints', 'điểm đến', allFacilityPages(query => facilityApi.listEndpoints(query, options))],
      ['zones', 'vùng kiểm tra', allFacilityPages(query => facilityApi.listZones(query, options))],
      ['groups', 'nhóm điểm', allFacilityPages(query => facilityApi.listEndpointGroups(query, options))],
      ['members', 'thành viên nhóm điểm', allFacilityPages(query => facilityApi.listEndpointGroupMembers(query, options))],
      ['rooms', 'phòng', allFacilityPages(query => facilityApi.listRooms({ ...query, includeDeleted: true }, options))],
    ];
    Promise.allSettled(resources.map(([, , request]) => request)).then(results => {
      if (controller.signal.aborted) return;
      const data = {}, missing = [];
      results.forEach((result, index) => {
        const [key, label] = resources[index];
        data[key] = result.status === 'fulfilled' ? result.value : [];
        if (result.status === 'rejected') missing.push(label);
      });
      setCatalog(previous => ({ ...previous, ...data }));
      if (missing.length) setResourceError(`Chưa tải được dữ liệu ${missing.join(', ')}.`);
      setLoadingResources(false);
    });
    return () => controller.abort();
  }, [revision, writable]);

  const query = search.trim().toLocaleLowerCase('vi');
  const visibleRoutes = catalog.published.filter(workflow => {
    const mapId = workflow.defaultInputsJson?.map_id;
    return (!mapFilter || patrolTemplateCount(workflow) || mapId === mapFilter)
      && `${workflow.workflowName} ${workflow.workflowCode || ''}`.toLocaleLowerCase('vi').includes(query);
  });
  const missingRoute = !!requestedId && !query && !mapFilter && !loading && !routeError
    && !catalog.published.some(item => item.workflowId === requestedId);
  const selected = visibleRoutes.find(item => item.workflowId === requestedId) || ((!requestedId || query || mapFilter) && visibleRoutes[0]);
  const workflowId = !routeError && selected ? selected.workflowId : '';
  useEffect(() => {
    if (view !== 'routes' || loading || !workflowId || requestedId === workflowId) return;
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('workflowId', workflowId);
      return next;
    }, { replace: true });
  }, [view, loading, workflowId, requestedId, setParams]);
  const clearFilters = () => { setSearch(''); setMapFilter(''); };
  const closeForm = () => { setCreating(null); setPendingTemplate(readPatrolRun(templateStorageKey)); refresh(); };
  const onCreated = result => {
    setLoading(true); closeForm(); clearFilters();
    setParams(locationFor(result.jobId ? 'queue' : result.scheduleId ? 'schedules' : 'routes', result.workflowId));
    if (result.jobId) setCreatedJobId(result.jobId);
    setNotice(result.message);
  };
  const library = <RouteLibrary catalog={catalog} loading={loading} error={routeError} workflows={visibleRoutes} workflowId={workflowId}
    selectRoute={selectRoute} mapFilter={mapFilter} changeMap={setMapFilter} search={search} setSearch={setSearch}
    clearFilters={clearFilters} writable={writable} preparing={loading || loadingResources} onRefresh={refresh} onCreate={() => setCreating({ kind: 'publish' })}/>;

  return <section className="pt-page pt-command-center">
    <header className="pt-workspace-heading">
      <div><h2>Quản lý tuần tra</h2><p>{activeView.description}</p></div>
      <Button icon="refresh" aria-label="Làm mới" title="Làm mới" onClick={refresh} disabled={loading || loadingResources}>Làm mới</Button>
    </header>
    <nav className="pt-workspace-nav" aria-label="Điều hướng tuần tra">{views.map(item =>
      <Link key={item.id} to={{ search: locationFor(item.id).toString() }} aria-current={view === item.id ? 'page' : undefined}>
        <Icon name={item.icon}/>{item.label}
      </Link>
    )}</nav>
    {!writable && <p className="pt-notice">Bạn đang ở chế độ xem thử. Đăng nhập tài khoản quản trị để tạo tuyến và điều khiển robot.</p>}
    {resourceError && <div className="pt-notice" role="status"><span>{resourceError}</span> <Button onClick={refresh}>Tải lại danh mục</Button></div>}
    {routeError && view !== 'routes' && <div className="pt-alert" role="alert">Chưa tải được danh sách tuyến tuần tra. <Button onClick={refresh}>Thử lại</Button></div>}
    {notice && <div className="pt-success" role="status"><Icon name="check"/><span>{notice}</span><Button className="pt-icon-btn" icon="close" aria-label="Ẩn thông báo" onClick={() => setNotice('')}/></div>}
    {pendingTemplate && <div className="pt-pending" role="status"><div><strong>Lượt tuần tra đang chờ xác nhận</strong><p>{pendingTemplate.workflowName}</p></div>
      <Button disabled={!writable} icon="refresh" onClick={() => setCreating({ kind: 'template', count: pendingTemplate.draft.checkpointCount, templateId: pendingTemplate.workflowId })}>Kiểm tra lượt đã gửi</Button>
    </div>}
    <PatrolOperations catalog={catalog} view={view} library={library} missingRoute={missingRoute} loading={loading || loadingResources}
      catalogError={routeError || resourceError} workflowId={workflowId} revision={revision} refresh={refresh} writable={writable} session={session}
      setNotice={setNotice} openQueue={() => setParams(locationFor('queue', workflowId || requestedId))}
      pendingTemplate={pendingTemplate} onConfigure={(count, templateId) => setCreating({ kind: 'template', count, templateId })}
      onSchedule={(route, robotId) => setCreating({ kind: 'schedule', route, robotId })} createdJobId={createdJobId}/>
    {creating?.kind === 'publish' && <PublishPatrolRoute catalog={catalog} onClose={closeForm} onCreated={onCreated}/>}
    {(creating?.kind === 'template' || creating?.kind === 'schedule') && <CreatePatrolRoute catalog={catalog} fixedRoute={creating.route} templateId={creating.templateId} initialRobotId={creating.robotId} initialCount={creating.count} storageKey={creating.route ? `${templateStorageKey}:${creating.route.workflow.workflowId}` : templateStorageKey} onClose={closeForm} onCreated={onCreated}/>}
  </section>;
}

function PatrolOperations({ catalog, view, library, missingRoute, loading, catalogError, workflowId, revision, refresh, writable, session, setNotice, openQueue, pendingTemplate, onConfigure, onSchedule, createdJobId }) {
  const storageKey = `mediassist.patrol.dispatch.v1:${API_BASE_URL}:${session.account.accountId}`;
  const [attempt, setAttempt] = useState(() => restoreAttempt(storageKey));
  const [robotId, setRobotId] = useState(() => restoreAttempt(storageKey)?.body.robotId || '');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const [retiredSchedules, setRetiredSchedules] = useState(false);
  const [monitoredId, setMonitoredId] = useState(''), [jobAction, setJobAction] = useState(null), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const actionLock = useRef(false), attemptRef = useRef(attempt);
  const workflowIds = useMemo(() => new Set(catalog.workflows.map(workflow => workflow.workflowId)), [catalog.workflows]);
  const workflowKey = [...workflowIds].sort().join(',');
  const jobsPoll = usePoll(async signal => {
    if (!workflowIds.size) return [];
    const groups = await Promise.all([...OPEN_PATROL_STATUSES, 'CANCELLED'].map(status => allPatrolPages((query, options) => patrolApi.listJobs({ ...query, status, includeDeleted: true }, options), { signal })));
    return [...new Map(groups.flat().filter(job => workflowIds.has(job.workflowId) && (OPEN_PATROL_STATUSES.has(job.status) || jobStopPending(job))).map(job => [job.jobId, job])).values()].sort((a, b) => (a.queuedAt || '').localeCompare(b.queuedAt || ''));
  }, [workflowKey, revision], 8000, view === 'queue' || (view === 'routes' && !!workflowId) || !!attempt);
  const jobs = jobsPoll.data || [];
  const historyPoll = usePoll(async signal => {
    if (!workflowIds.size) return [];
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const groups = await Promise.all(['SUCCEEDED', 'FAILED', 'CANCELLED'].map(status => allPatrolPages((query, options) => patrolApi.listJobs({ ...query, status, from, includeDeleted: true }, options), { signal })));
    return groups.flat().filter(job => workflowIds.has(job.workflowId)).sort((a, b) => (b.endedAt || b.queuedAt || '').localeCompare(a.endedAt || a.queuedAt || '')).slice(0, 100);
  }, [workflowKey, revision], 30000, view === 'queue');
  const detailPoll = usePoll(async signal => {
    const result = await patrolApi.getWorkflow(workflowId, { signal });
    if (result?.workflow?.workflowId !== workflowId) throw new Error('Máy chủ trả về chi tiết không khớp với tuyến đã chọn.');
    return result;
  }, [workflowId, revision], 30000, view === 'routes' && !!workflowId);
  const detail = detailPoll.data?.workflow?.workflowId === workflowId ? detailPoll.data : null;
  const route = useMemo(() => patrolRoute(detail, catalog.endpoints, undefined, catalog), [detail, catalog]);
  const schedulesPoll = usePoll(async signal => {
    if (!workflowIds.size) return [];
    const rows = await allPatrolPages((params, options) => patrolApi.listSchedules(
      retiredSchedules ? { ...params, status: 'RETIRED', includeDeleted: true } : params, options,
    ), { signal });
    return rows.filter(schedule => workflowIds.has(schedule.workflowId));
  }, [workflowKey, revision, retiredSchedules], 15000, view === 'schedules');
  const map = catalog.maps.find(item => item.mapId === route.mapId);
  const monitoredPoll = usePoll(signal => patrolApi.getJob(monitoredId, { signal }), [monitoredId, revision], 8000, !!monitoredId && view !== 'schedules');
  const monitored = monitoredPoll.data?.job?.jobId === monitoredId ? monitoredPoll.data : null;
  const viewRobotId = robotId || monitored?.job?.robotId;
  const snapshotPoll = usePoll(signal => patrolApi.getRobotSnapshot(viewRobotId, { signal }), [viewRobotId, revision], 8000, view === 'routes' && !!workflowId && !!viewRobotId);
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
  useEffect(() => { if (createdJobId) setMonitoredId(createdJobId); }, [createdJobId]);
  useEffect(() => {
    if (!attempt?.scheduleId) return;
    const job = jobs.find(item => item.scheduleId === attempt.scheduleId) || dispatchedJobPoll.data;
    if (job?.scheduleId === attempt.scheduleId) { setMonitoredId(job.jobId); saveAttempt(null); setNotice(OPEN_PATROL_STATUSES.has(job.status) ? 'Robot đã có nhiệm vụ tuần tra. Theo dõi trạng thái trong hàng đợi.' : `Lượt tuần tra đã được xử lý: ${jobStatus(job).label.toLocaleLowerCase('vi')}. Xem chi tiết trong hàng đợi.`); }
  }, [jobs, attempt?.scheduleId, dispatchedJobPoll.data]);
  const dispatch = async () => {
    if (actionLock.current || (!attemptRef.current && blocked)) return;
    actionLock.current = true; setBusy(true); setActionError('');
    try {
      const result = await dispatchFixedPatrol(attemptRef.current, { workflow: route.workflow, robotId, mapId: route.mapId, navigationSessionId: snapshot?.navigationSession?.sessionId }, saveAttempt);
      if (result.jobId) {
        setMonitoredId(result.jobId); saveAttempt(null); setReview(false); refresh(); openQueue();
        setNotice('Đã tạo nhiệm vụ tuần tra. Bạn có thể theo dõi robot trong hàng đợi.');
        return;
      }
      setReview(false); refresh(); setNotice(result.status === 'RETIRED' ? 'Lượt điều phối đã được xử lý. Hãy kiểm tra nhiệm vụ; lượt có thể bị bỏ qua nếu robot chưa đủ điều kiện.' : 'Đã gửi lượt tuần tra. Đang chờ hệ thống tạo và giao nhiệm vụ cho robot.');
    } catch (cause) { setActionError(`${cause.message}${attemptRef.current ? ' Dùng “Kiểm tra lượt gửi” để kiểm tra cùng lượt.' : ''}`); setReview(false); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const listedMonitored = jobs.find(job => job.jobId === monitoredId) || historyPoll.data?.find(job => job.jobId === monitoredId);
  const detailBehind = monitored && listedMonitored && Number(listedMonitored.rowVersion) > Number(monitored.job.rowVersion);
  const detailError = monitoredPoll.error || (detailBehind ? 'Trạng thái lượt vừa thay đổi. Đang đồng bộ lại chi tiết mới nhất.' : '');
  const controlFresh = writable && !jobsPoll.error && !!jobsPoll.updatedAt && now - jobsPoll.updatedAt < 20000 && !detailError && !!monitoredPoll.updatedAt && now - monitoredPoll.updatedAt < 20000;
  const targetEndpointId = monitored?.job.workflowId === workflowId && monitored.job.robotId === viewRobotId ? monitored.patrol?.targetEndpointId : undefined;
  return <>
    {view === 'routes' && <>
      {library}
      {missingRoute && <div className="pt-alert" role="alert">Không tìm thấy tuyến đã phát hành từ liên kết này. Chọn một tuyến trong danh sách để tiếp tục.</div>}
      {workflowId && <div className="pt-workspace pt-planning-workspace">
        <RouteMapPanel workflowId={workflowId} detail={detail} route={route} map={map} catalog={catalog} error={detailPoll.error} loading={!detail} snapshot={snapshotPoll.error && snapshot ? { ...snapshot, heartbeatFresh: false } : snapshot} robot={snapshot?.robot || robot} targetEndpointId={targetEndpointId} onRefresh={refresh}/>
        {isPatrolWorkflow(detail?.workflow) && route.managed && route.published && !detailPoll.error && <DispatchPanel catalog={catalog} route={route} map={map} robotId={robotId} onRobotChange={id => { setRobotId(id); setActionError(''); }} robot={robot} snapshot={snapshot} blocked={blocked} reasons={reasons} busy={busy} pending={!!attempt || (route.template && !!pendingTemplate)} onReview={() => setReview(true)} onConfigure={() => onConfigure(route.checkpointCount, workflowId)} onSchedule={() => onSchedule(route, robotId)} writable={writable && !loading && !catalogError} updatedAt={robotId ? snapshotPoll.updatedAt : null}/>}
      </div>}
    </>}
    {attempt && <div className="pt-pending" role="status"><span className="pt-pending-icon"><Icon name="clock"/></span><div><strong>{observedAttempt?.status === 'RETIRED' ? 'Lượt gửi đã được xử lý' : 'Đang xác nhận lượt gửi'}</strong><p>{attempt.workflowName} · {robotName(catalog.robots.find(item => item.robotId === attempt.body.robotId))}</p><p>{observedAttempt?.status === 'RETIRED' ? 'Chưa xác nhận được nhiệm vụ tương ứng. Lượt có thể bị bỏ qua nếu robot chưa đủ điều kiện; kiểm tra hàng đợi trước khi gửi lượt mới.' : 'Đang chờ hệ thống tạo nhiệm vụ. Chưa xác nhận robot đã bắt đầu.'}</p>{(attemptPoll.error || dispatchedJobPoll.error) && <p>{attemptPoll.error || dispatchedJobPoll.error}</p>}</div><div className="pt-actions"><Button icon="refresh" disabled={busy || !writable} onClick={dispatch}>Kiểm tra lượt gửi</Button>{observedAttempt?.status === 'RETIRED' && <Button disabled={busy} onClick={() => saveAttempt(null)}>Đóng lượt theo dõi</Button>}</div></div>}
    {actionError && <p className="pt-alert" role="alert">{actionError}</p>}
    {view === 'schedules' && <PatrolSchedules loading={loading || !schedulesPoll.updatedAt && !schedulesPoll.error} schedules={schedulesPoll.data || []} catalog={catalog} error={schedulesPoll.error} writable={writable}
      retired={retiredSchedules} onViewChange={setRetiredSchedules} onRefresh={refresh} onNotice={setNotice}/>}
    {view === 'queue' && <>
    <PatrolQueuePanel jobs={jobs} historyJobs={historyPoll.data || []} loading={!jobsPoll.updatedAt && !jobsPoll.error} error={jobsPoll.error} historyLoading={!historyPoll.updatedAt && !historyPoll.error} historyError={historyPoll.error} updatedAt={jobsPoll.updatedAt} catalog={catalog} selectedId={monitoredId} detail={monitored} detailError={detailError} writable={controlFresh} onSelect={setMonitoredId} onAction={kind => setJobAction({ kind, detail: monitored })} onRefresh={refresh}/>
    <p className="pt-history-note">Lịch sử hiển thị tối đa 100 lượt trong 7 ngày gần nhất. <Link to="/admin/live-operations">Mở vận hành trực tiếp</Link></p>
    <MonitoringRequests writable={writable} revision={revision}/>
    </>}
    {review && <Modal title="Bắt đầu tuần tra?" subtitle="Kiểm tra bản đồ và robot trước khi đưa lượt vào hàng đợi." onClose={() => setReview(false)} busy={busy}><div className="pt-form-body"><dl className="pt-review-list"><div><dt>Tuyến tuần tra</dt><dd>{route.workflow?.workflowName}</dd></div><div><dt>Robot thực hiện</dt><dd>{robotName(robot)}</dd></div><div><dt>Bản đồ</dt><dd>{map?.mapName}</dd></div><div><dt>Hành trình</dt><dd>{route.checkpoints.length} điểm · {roundLabel(route)}</dd></div></dl><p className="pt-notice">Robot ưu tiên SOS và nhiệm vụ khẩn cấp. Lượt chỉ được tính đang chạy sau khi robot nhận và thực hiện.</p>{blocked && <p className="pt-alert" role="status">Điều kiện robot hoặc tuyến đã thay đổi. Quay lại để kiểm tra trạng thái mới nhất.</p>}</div><footer className="pt-dialog-footer"><Button disabled={busy} onClick={() => setReview(false)}>Quay lại</Button><Button icon="play" tone="primary" disabled={busy || blocked} onClick={dispatch}>{busy ? 'Đang gửi…' : 'Xác nhận bắt đầu'}</Button></footer></Modal>}
    {jobAction && <JobAction kind={jobAction.kind} detail={monitored?.job.jobId === jobAction.detail.job.jobId ? monitored : jobAction.detail} canAct={controlFresh && monitored?.job.jobId === jobAction.detail.job.jobId} onClose={() => setJobAction(null)} onSaved={message => { setJobAction(null); setNotice(message); refresh(); }}/ >}
  </>;
}
