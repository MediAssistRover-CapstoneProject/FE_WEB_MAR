import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readCatalog } from '../../../features/api/backendApi.js';
import { request } from '../../../features/robotOperations/api.js';
import { loadSavedMap } from '../../../features/robotOperations/savedMap.js';
import { imagePoint, matchingPlan, monitorPoseScope, monitorPoseView } from '../../../features/operations/monitorGeometry.js';
import { matchingPresentation, presentationViewport } from '../../../features/operations/monitorPresentation.js';
import MapPresentationCanvas from '../MapPresentationCanvas.jsx';
import { dataFreshness, jobPresentation, newerJob, selectedStep, statusInfo } from '../../../features/operations/liveOperations.js';
import { vi } from '../../../i18n/vi.js';
import RobotCamera from '../robotOperations/RobotCamera.jsx';
import { useJobFeed } from '../../../features/operations/useJobFeed.js';
import { useRobotRealtime } from '../../../features/operations/useRobotRealtime.js';
import MissionProgress from './MissionProgress.jsx';
import './robotMonitor.css';

const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận';

function RobotMap({ snapshot, livePose, job, endpoints, fresh, revision, auto, stepDetail }) {
  const [maps, setMaps] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [chosenMapId, setChosenMapId] = useState('');
  const robotMapId = snapshot?.robot?.currentMapId;
  const activeMap = maps.find(map => map.mapId === chosenMapId)
    || maps.find(map => map.mapId === robotMapId)
    || (maps.length === 1 ? maps[0] : null);
  const mapId = activeMap?.mapId;
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const load = async () => {
      try {
        const rows = await readCatalog('GET /api/v1/maps', { signal: controller.signal, query: { status: 'ACTIVE' } });
        if (!controller.signal.aborted) {
          setMaps(rows.filter(map => map.status === 'ACTIVE'));
          setCatalogError('');
        }
      } catch (cause) {
        if (!controller.signal.aborted) { setCatalogError(cause.message); }
      }
      if (!controller.signal.aborted && auto) timer = setTimeout(load, 60000);
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision, auto]);
  const [saved, setSaved] = useState(null), [error, setError] = useState('');
  const [presentation, setPresentation] = useState(null), [presentationNotice, setPresentationNotice] = useState('');
  const [retry, setRetry] = useState(0), [zoom, setZoom] = useState(1), [follow, setFollow] = useState(false);
  const remembered = useRef(null), followCenter = useRef(null);
  useEffect(() => { setZoom(1); remembered.current = null; followCenter.current = null; }, [mapId]);
  useEffect(() => {
    setSaved(previous => previous?.mapId === mapId ? previous : null); setError('');
    if (!mapId) return;
    const controller = new AbortController();
    loadSavedMap(mapId, request, controller.signal).then(({ blob, metadata }) => {
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      setSaved(previous => {
        if (previous?.mapId === mapId && previous.metadata.asset_hash === metadata.asset_hash) { URL.revokeObjectURL(url); return previous; }
        return { mapId, url, metadata };
      });
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [mapId, retry, revision]);
  useEffect(() => { const url = saved?.url; return () => { if (url) URL.revokeObjectURL(url); }; }, [saved?.url]);
  useEffect(() => {
    setPresentation(previous => previous?.source?.mapId === mapId ? previous : null); setPresentationNotice('Đang kiểm tra giao diện bản đồ đã áp dụng…');
    if (!mapId) return;
    const controller = new AbortController();
    let timer, sequence = 0;
    const load = async () => {
      clearTimeout(timer);
      const current = ++sequence;
      try {
        const value = await request(`/api/v1/maps/${encodeURIComponent(mapId)}/presentation/published`, { signal: controller.signal });
        if (!controller.signal.aborted && current === sequence) { setPresentation(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value); setPresentationNotice(''); }
      } catch (cause) {
        if (!controller.signal.aborted && current === sequence) {
          if ([404, 409].includes(cause.status)) setPresentation(null);
          setPresentationNotice(cause.status === 404 ? 'Chưa có giao diện đã áp dụng. Đang hiển thị map gốc.'
            : cause.status === 409 ? 'Giao diện đã cũ so với map gốc. Đang hiển thị map gốc.'
            : 'Chưa tải được giao diện đã áp dụng. Đang hiển thị map gốc.');
        }
      }
      if (!controller.signal.aborted && current === sequence && auto) timer = setTimeout(load, 60000);
    };
    load();
    const onFocus = () => { if (!controller.signal.aborted) load(); };
    window.addEventListener('focus', onFocus);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [mapId, retry, revision, auto]);
  const meta = saved && saved.mapId === mapId ? saved.metadata : null;
  const view = monitorPoseView(remembered.current, { snapshot, livePose, metadata: meta, job, fresh });
  remembered.current = view.memory;
  const pose = view.live ? view.pose : null;
  const displayPose = view.pose;
  const position = pose && imagePoint(pose, meta);
  const displayPosition = displayPose && imagePoint(displayPose, meta);
  const plan = fresh ? matchingPlan(snapshot, meta, job) : null;
  const planPoints = plan?.points.map(point => imagePoint(point, meta));
  const validPlan = planPoints?.length > 1 && planPoints.every(Boolean);
  const endpointId = plan?.endpointId || job?.inputJson?.destinationEndpointId || job?.inputJson?.endpointId;
  const endpoint = endpoints.find(item => item.endpointId === endpointId && item.mapId === mapId);
  const destination = endpoint && imagePoint(endpoint, meta);
  const width = meta?.width_px || 1, height = meta?.height_px || 1;
  const radius = Math.max(width, height) * .014;
  const viewWidth = width / zoom, viewHeight = height / zoom;
  const centerScope = monitorPoseScope(snapshot, meta, job);
  if (followCenter.current?.scope !== centerScope) followCenter.current = null;
  if (displayPosition) followCenter.current = { scope: centerScope, position: displayPosition };
  const center = follow && followCenter.current ? followCenter.current.position : { x: width / 2, y: height / 2 };
  const left = Math.max(0, Math.min(width - viewWidth, center.x - viewWidth / 2));
  const top = Math.max(0, Math.min(height - viewHeight, center.y - viewHeight / 2));
  const published = matchingPresentation(presentation, meta);
  const presentationView = published && presentationViewport(published, zoom, follow ? followCenter.current?.position : null);
  const overlay = <g className="rm-navigation-overlay">
    {validPlan && <polyline className="rm-plan" points={planPoints.map(point => point.x + ',' + point.y).join(' ')} fill="none" stroke="#2563eb" strokeWidth={radius * .35} strokeDasharray={radius + ' ' + radius * .6} />}
    {destination && <g className="rm-destination" transform={`translate(${destination.x} ${destination.y})`}><circle r={radius} fill="#f59e0b" stroke="white" strokeWidth={radius * .2} /><title>Điểm đến</title></g>}
    {displayPosition && <g className={view.live ? "rm-position" : "rm-position-stale"} transform={`translate(${displayPosition.x} ${displayPosition.y}) rotate(${-(displayPose.yawRad - meta.origin_yaw_rad) * 180 / Math.PI})`}>
      <title>{view.live ? "Vị trí robot hiện tại" : "Vị trí ghi nhận gần nhất · không còn trực tiếp"}</title><circle r={radius * 1.3} fill={view.live ? "#2563eb" : "#94a3b8"} stroke="white" strokeWidth={radius * .2} /><path d={`M ${radius * 2.2} 0 L 0 ${-radius * .7} L 0 ${radius * .7} Z`} fill="white" />
    </g>}
  </g>;
  return <section className="rm-card rm-map">
    <header><div><h3>Bản đồ trực tiếp</h3><small>{activeMap ? activeMap.mapName + ' · Đang hoạt động · v' + activeMap.versionNo : 'Chưa chọn bản đồ đang hoạt động'}</small></div><div className="rm-tools">      {maps.length > 1 && <select aria-label="Bản đồ đang hoạt động" value={mapId || ''} onChange={event => setChosenMapId(event.target.value)}><option value="">Chọn bản đồ</option>{maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName}</option>)}</select>}
      <button type="button" aria-pressed={follow} disabled={!position} onClick={() => { setFollow(!follow); setZoom(value => Math.max(value, 2)); }}>Theo robot</button>
      <button type="button" aria-label="Thu nhỏ bản đồ" disabled={!saved || zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}>−</button>
      <button type="button" aria-label="Phóng to bản đồ" disabled={!saved || zoom >= 5} onClick={() => setZoom(value => Math.min(5, value + .5))}>+</button>
    </div></header>
    {stepDetail}
    <div className="rm-map-canvas" data-map-view={published ? 'published' : 'original'}>
      {saved && published ? <MapPresentationCanvas source={published.source} document={published.document} preview
        imageUrl={saved.url} opacity={published.document.features.length ? 0 : 1}
        viewBox={[presentationView.x, presentationView.y, presentationView.width, presentationView.height].join(' ')}
        role="img" aria-label="Bản đồ đã chỉnh sửa, vị trí robot và lộ trình từ máy chủ">
        <g transform={`scale(${published.source.widthM / width} ${published.source.heightM / height})`}>{overlay}</g>
      </MapPresentationCanvas> : saved ? <svg viewBox={[left, top, viewWidth, viewHeight].join(' ')} role="img" aria-label="Bản đồ, vị trí robot và lộ trình từ máy chủ">
        <image href={saved.url} width={width} height={height} />
        {overlay}
      </svg> : <div className="rm-placeholder"><span>⌖</span><p>{error || catalogError || (mapId ? 'Đang tải ảnh bản đồ…' : maps.length > 1 ? 'Chọn bản đồ đang hoạt động để theo dõi.' : 'Chưa có bản đồ đang hoạt động trên máy chủ.')}</p>{error && <button onClick={() => setRetry(n => n + 1)}>Tải lại bản đồ</button>}</div>}
    </div>
    {saved && <p className="rm-caption rm-presentation-status" role="status">{published ? 'Đang dùng giao diện bản đồ đã áp dụng.' : presentationNotice || 'Giao diện không khớp phiên bản map này. Đang hiển thị map gốc.'} {!published && mapId && <Link to={`/admin/map?mapId=${encodeURIComponent(mapId)}&stage=presentation`}>Mở chỉnh sửa và áp dụng bản đồ →</Link>}</p>}
    <div className="rm-legend"><span><i className="rm-blue" />Đường dự kiến</span><span>● Điểm đến</span></div>
    <p className="rm-caption">{position ? 'Vị trí robot đang cập nhật.' : displayPosition ? `Vị trí gần nhất lúc ${new Date(displayPose.capturedAt).toLocaleTimeString('vi-VN')} · ${Math.floor(view.ageMs / 1000)} giây trước; chưa có vị trí trực tiếp.` : 'Chưa có vị trí robot còn hiệu lực trên bản đồ này.'} {validPlan ? 'Đường dự kiến của bước hiện tại.' : 'Chờ cập nhật đường đi.'}</p>
  </section>;
}

export default function RobotMonitor({ jobs, catalogs, auto, revision, onOpen }) {
  const robotId = catalogs.robots[0]?.robotId;
  const { snapshot, livePose, error, receivedAt } = useRobotRealtime(robotId, auto, revision);
  const [now, setNow] = useState(Date.now()), [tab, setTab] = useState('queue');
  const [schedules, setSchedules] = useState([]), [scheduleError, setScheduleError] = useState('');

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const load = async () => {
      try {
        const rows = await readCatalog('GET /api/v1/schedules', { signal: controller.signal });
        if (!controller.signal.aborted) { setSchedules(rows); setScheduleError(''); }
      } catch (cause) {
        if (!controller.signal.aborted) setScheduleError(cause.message);
      }
      if (!controller.signal.aborted && auto) timer = setTimeout(load, 60000);
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision, auto]);
  const active = jobs.filter(job => ['RUNNING', 'ACCEPTED'].includes(job.status) && job.robotId === robotId);
  const rememberedJob = useRef(null);
  // Keep the last result visible until another job takes over; isolate by robot.
  const previous = rememberedJob.current?.robotId === robotId ? rememberedJob.current : null;
  const observedJob = active.find(job => job.jobId === snapshot?.activeJobId) || active[0]
    || jobs.find(job => job.robotId === robotId && job.status === 'RECOVERY_REQUIRED')
    || (previous && (jobs.find(job => job.jobId === previous.jobId) || previous));
  const { detail, error: detailError, receivedAt: detailReceivedAt } = useJobFeed(observedJob && snapshot?.activeJobId === observedJob.jobId
    ? { ...observedJob, selectedJobStepId: snapshot.selectedJobStepId || observedJob.selectedJobStepId } : observedJob, auto, revision);
  const current = detail?.job && detail.job.jobId === observedJob?.jobId ? newerJob(observedJob, detail.job) : observedJob;
  rememberedJob.current = current;
  const robot = snapshot?.robot || catalogs.robots[0];
  const observedAge = Date.now() - Date.parse(snapshot?.observedAt);
  const fresh = !error && receivedAt > 0 && Date.now() - receivedAt <= 5000
    && (!snapshot?.observedAt || Number.isFinite(observedAge) && observedAge >= -1000 && observedAge <= 5000);
  const connected = fresh && snapshot?.mqttConnected && snapshot?.heartbeatFresh;
  const waiting = jobs.filter(job => job.status === 'QUEUED' && (!job.robotId || job.robotId === robotId))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || Date.parse(a.queuedAt) - Date.parse(b.queuedAt));
  const upcoming = schedules.filter(item => item.status === 'ACTIVE' && (!item.robotId || item.robotId === robotId) && item.nextRunAt && Date.parse(item.nextRunAt) >= now)
    .sort((a, b) => Date.parse(a.nextRunAt) - Date.parse(b.nextRunAt));
  const rows = tab === 'running' ? active : waiting;
  return <div className="rm-monitor">
    <div className="rm-robot-bar"><strong>♧ {[robot?.robotName, robot?.robotCode].find(value => value?.trim() && value.trim().toLowerCase() !== 'string') || 'Robot'}</strong><span className={'rm-pill ' + (connected ? 'is-good' : '')}>{connected ? vi(robot?.status) : 'Chưa có kết nối mới'}</span><span>{connected ? '● Đã kết nối' : '○ Chờ tín hiệu robot'}</span><small>{receivedAt ? 'Cập nhật lúc ' + new Date(receivedAt).toLocaleTimeString('vi-VN') : 'Đang chờ dữ liệu'}</small></div>
    {error && <p className="lo-notice lo-notice-warning" role="status">{error}</p>}
    <div className="rm-layout"><div className="rm-left">
      <RobotMap snapshot={snapshot} livePose={livePose} job={current} endpoints={catalogs.endpoints} fresh={fresh} revision={revision} auto={auto}
        stepDetail={<MissionProgress current={current} detail={detail} catalogs={catalogs} stale={dataFreshness(detailReceivedAt, now, !!detailError).stale} connected={!!connected} auto={auto} />} />
      <section className="rm-card rm-queue"><header><h3>Danh sách công việc</h3></header>
        <nav aria-label="Hàng đợi của robot">{[['running', 'Đang thực hiện', active.length], ['queue', 'Chờ thực hiện', waiting.length], ['scheduled', 'Theo lịch', upcoming.length]].map(([key, title, count]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{title} <b>{count}</b></button>)}</nav>
        <p className="rm-caption">{tab === 'queue' ? 'Sắp theo ưu tiên và thời điểm vào hàng đợi. Máy chủ quyết định công việc đủ điều kiện chạy tiếp.' : tab === 'scheduled' ? 'Thời điểm kích hoạt kế tiếp từ lịch trên máy chủ.' : 'Công việc đang được robot tiếp nhận hoặc thực hiện.'}</p>
        {tab === 'scheduled' ? <>{scheduleError && <p role="alert">{scheduleError}</p>}{!upcoming.length && !scheduleError && <p className="rm-caption">Chưa có lịch chạy tiếp theo.</p>}{upcoming.map(item => <div className="rm-queue-row" key={item.scheduleId}><strong>{item.scheduleName?.trim().toLowerCase() === 'string' ? 'Lịch công việc' : item.scheduleName}</strong><span>{dateTime(item.nextRunAt)}</span><Link to="/admin/patrol">Xem lịch →</Link></div>)}</> : <>
          {!rows.length && <p className="rm-caption">{tab === 'queue' ? 'Chưa có công việc chờ thực hiện.' : 'Robot chưa có công việc đang thực hiện.'}</p>}
          {rows.map((job, index) => { const entry = jobPresentation(job, catalogs); return <button className="rm-queue-row" key={job.jobId} onClick={() => onOpen(job)}><span className="rm-order" title="Thứ tự hiển thị">{index + 1}</span><strong>{entry.title}</strong><span>{entry.target || 'Chưa có điểm đến'}</span><span className="rm-pill">{job.status === 'QUEUED' ? 'Chờ thực hiện' : statusInfo(job.status).label}</span><span aria-hidden="true">›</span></button>; })}
        </>}
      </section>
    </div><aside className="rm-right"><RobotCamera key={robotId} robotId={robotId} /><CurrentMission current={current} catalogs={catalogs} detail={detail} error={detailError} onOpen={onOpen} /></aside></div>
  </div>;
}

const CurrentMission = memo(function CurrentMission({ current, catalogs, detail, error: detailError, onOpen }) {
  const info = current && jobPresentation(current, catalogs), step = detail && selectedStep(detail);
  return <section className="rm-card rm-current">
      <header><h3>Nhiệm vụ hiện tại</h3>{current && <span className="rm-pill is-good">{statusInfo(current.status).label}</span>}</header>
      {current ? <><strong className="rm-mission-title">{info.title}</strong><p>{info.target || 'Chưa có điểm đến'}</p><small>{current.jobCode}</small>
        <ol>{(detail?.steps || []).slice().sort((a, b) => a.executionSequenceNo - b.executionSequenceNo).map(item => <li key={item.jobStepId} className={item.status === 'SUCCEEDED' ? 'is-done' : item.jobStepId === step?.jobStepId ? 'is-current' : ''}><strong>{vi(item.stepTypeSnapshot)}</strong><small>{statusInfo(item.status).label}</small></li>)}</ol>
        {detailError && <p className="rm-caption" role="status">Chưa cập nhật được tiến trình mới; đang giữ lần ghi nhận gần nhất.</p>}{!detail && <p className="rm-caption">Đang tải tiến trình chi tiết…</p>}
        <button className="lo-button lo-primary" onClick={() => onOpen(current)}>Xem tiến trình và thao tác</button>
      </> : <div className="rm-placeholder"><span>✓</span><p>Chưa có nhiệm vụ đang thực hiện.</p></div>}
    </section>;
});
