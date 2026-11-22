import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readCatalog } from '../../../features/api/backendApi.js';
import { request } from '../../../features/robotOperations/api.js';
import { loadSavedMap } from '../../../features/robotOperations/savedMap.js';
import { imagePoint, matchingPlan, monitorPoseScope, monitorPoseView } from '../../../features/operations/monitorGeometry.js';
import { matchingPresentation, presentationViewport } from '../../../features/operations/monitorPresentation.js';
import MapPresentationCanvas from '../MapPresentationCanvas.jsx';
import { polygonPoints } from '../FacilityGeometryPreview.jsx';
import { allowedJobActions, dataFreshness, jobPresentation, newerJob, selectedStep, statusInfo } from '../../../features/operations/liveOperations.js';
import { vi } from '../../../i18n/vi.js';
import RobotCamera from '../robotOperations/RobotCamera.jsx';
import { useJobFeed } from '../../../features/operations/useJobFeed.js';
import { useRobotRealtime } from '../../../features/operations/useRobotRealtime.js';
import { robotConnection } from '../../../features/operations/robotConnection.js';
import MissionProgress from './MissionProgress.jsx';
import OperationsIcon from './OperationsIcon.jsx';
import RobotBattery from './RobotBattery.jsx';
import MapRobotMarker from '../../../components/MapRobotMarker.jsx';
import './robotMonitor.css';

const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận';
const LiveMap3D = lazy(() => import('./LiveMap3D.jsx'));

function RobotMap({ snapshot, livePose, job, endpoints, fresh, revision, auto, stepDetail, serverClockOffsetMs }) {
  const [maps, setMaps] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [chosenMapId, setChosenMapId] = useState('');
  const [viewMode, setViewMode] = useState('2d');
  const robotMapId = snapshot?.robot?.currentMapId;
  const activeMap = maps.find(map => map.mapId === chosenMapId)
    || maps.find(map => map.mapId === robotMapId)
    || (maps.length === 1 ? maps[0] : null);
  const mapId = activeMap?.mapId;
  const assetHash = activeMap?.assetHash;
  const mapVersion = activeMap?.versionNo;
  const [zoneData, setZoneData] = useState(null);
  const [showPoints, setShowPoints] = useState(true);
  const [showZones, setShowZones] = useState(true);
  useEffect(() => {
    if (!mapId || viewMode !== '3d') return;
    const controller = new AbortController();
    let timer;
    const load = async () => {
      try {
        const rows = await readCatalog('GET /api/v1/zones', { signal: controller.signal });
        if (!controller.signal.aborted) setZoneData({ mapId, rows });
      } catch {
        if (!controller.signal.aborted) setZoneData({ mapId, error: true });
      }
      if (!controller.signal.aborted && auto) timer = setTimeout(load, 60000);
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [viewMode, mapId, assetHash, revision, auto]);
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
  const [loaded, setSaved] = useState(null), [error, setError] = useState('');
  const saved = loaded?.mapId === mapId && (!assetHash || loaded?.metadata.asset_hash === assetHash) ? loaded : null;
  const [presentation, setPresentation] = useState(null), [presentationNotice, setPresentationNotice] = useState('');
  const [retry, setRetry] = useState(0), [zoom, setZoom] = useState(1), [follow, setFollow] = useState(false);
  const remembered = useRef(null), followCenter = useRef(null);
  useEffect(() => { setZoom(1); remembered.current = null; followCenter.current = null; }, [mapId]);
  useEffect(() => {
    setSaved(previous => previous?.mapId === mapId && (!assetHash || previous.metadata.asset_hash === assetHash) ? previous : null); setError('');
    if (!mapId) return;
    const controller = new AbortController();
    loadSavedMap(mapId, request, controller.signal).then(({ blob, metadata }) => {
      if (controller.signal.aborted) return;
      if (assetHash && metadata.asset_hash !== assetHash) throw new Error('Phiên bản ảnh bản đồ chưa khớp danh sách. Hãy tải lại trang.');
      const url = URL.createObjectURL(blob);
      setSaved(previous => {
        if (previous?.mapId === mapId && previous.metadata.asset_hash === metadata.asset_hash) { URL.revokeObjectURL(url); return previous; }
        return { mapId, url, metadata };
      });
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [mapId, assetHash, mapVersion, retry, revision]);
  useEffect(() => { const url = loaded?.url; return () => { if (url) URL.revokeObjectURL(url); }; }, [loaded?.url]);
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
  const mapPoints = useMemo(() => showPoints && meta ? endpoints
    .filter(item => item.mapId === mapId && item.active !== false)
    .map(item => ({ point: imagePoint(item, meta), name: item.endpointName || item.endpointCode }))
    .filter(item => item.point) : [], [endpoints, mapId, meta, showPoints]);
  const mapZones = useMemo(() => showZones && meta && zoneData?.mapId === mapId ? (zoneData.rows || [])
    .filter(item => item.mapId === mapId && item.active !== false)
    .map(item => ({
      type: item.zoneType,
      points: polygonPoints(item.polygonJson).map(([xM, yM]) => imagePoint({ xM, yM }, meta)),
    }))
    .filter(item => item.points.length >= 3 && item.points.every(Boolean)) : [], [mapId, meta, showZones, zoneData]);
  const clientNow = Date.now();
  const view = monitorPoseView(remembered.current, { snapshot, livePose, metadata: meta, job, fresh, now: clientNow, serverNow: clientNow + (serverClockOffsetMs ?? 0) });
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
      <title>{view.live ? "Vị trí robot hiện tại" : "Vị trí ghi nhận gần nhất · không còn trực tiếp"}</title>
      <MapRobotMarker length={radius * 2.8} live={view.live} />
    </g>}
  </g>;
  return <section className="rm-card rm-map">
    <header><div className="rm-card-title"><span className="rm-card-icon"><OperationsIcon name="map" /></span><div><h3>Bản đồ trực tiếp</h3><small>{activeMap ? activeMap.mapName + ' · Đang hoạt động · v' + activeMap.versionNo : 'Chưa chọn bản đồ đang hoạt động'}</small></div></div><div className="rm-tools">{maps.length > 1 && <select aria-label="Bản đồ đang hoạt động" value={mapId || ''} onChange={event => setChosenMapId(event.target.value)}><option value="">Chọn bản đồ</option>{maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName}</option>)}</select>}
      <div className="rm-view-switch" role="group" aria-label="Chế độ bản đồ">
        <button type="button" aria-pressed={viewMode === '2d'} onClick={() => setViewMode('2d')}>2D</button>
        <button type="button" aria-pressed={viewMode === '3d'} onClick={() => setViewMode('3d')}>3D</button>
      </div>
      {viewMode === '3d' && <div className="rm-view-switch" role="group" aria-label="Lớp bản đồ 3D">
        <button type="button" aria-pressed={showPoints} onClick={() => setShowPoints(value => !value)}>Điểm</button>
        <button type="button" aria-pressed={showZones} onClick={() => setShowZones(value => !value)}>Vùng</button>
      </div>}
      {viewMode === '2d' && <><button type="button" aria-pressed={follow} disabled={!position} onClick={() => { setFollow(!follow); setZoom(value => Math.max(value, 2)); }}>Theo robot</button>
      <button type="button" aria-label="Thu nhỏ bản đồ" disabled={!saved || zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}>−</button>
      <button type="button" aria-label="Phóng to bản đồ" disabled={!saved || zoom >= 5} onClick={() => setZoom(value => Math.min(5, value + .5))}>+</button></>}
    </div></header>
    {stepDetail}
    <div className="rm-map-canvas" data-map-view={viewMode === '3d' ? '3d' : published ? 'published' : 'original'}>
      {saved && viewMode === '3d' ? <Suspense fallback={<p role="status">Đang tải trình xem 3D…</p>}>
        <LiveMap3D asset={saved} position={displayPosition} heading={displayPose?.yawRad - meta.origin_yaw_rad}
          live={view.live} path={validPlan ? planPoints : null} destination={destination} endpoints={mapPoints} zones={mapZones} />
      </Suspense> : saved && published ? <MapPresentationCanvas source={published.source} document={published.document} preview
        imageUrl={saved.url} opacity={published.document.features.length ? 0 : 1}
        viewBox={[presentationView.x, presentationView.y, presentationView.width, presentationView.height].join(' ')}
        role="img" aria-label="Bản đồ đã chỉnh sửa, vị trí robot và lộ trình từ máy chủ">
        <g transform={`scale(${published.source.widthM / width} ${published.source.heightM / height})`}>{overlay}</g>
      </MapPresentationCanvas> : saved ? <svg viewBox={[left, top, viewWidth, viewHeight].join(' ')} role="img" aria-label="Bản đồ, vị trí robot và lộ trình từ máy chủ">
        <image href={saved.url} width={width} height={height} />
        {overlay}
      </svg> : <div className="rm-placeholder"><span>⌖</span><p>{error || catalogError || (mapId ? 'Đang tải ảnh bản đồ…' : maps.length > 1 ? 'Chọn bản đồ đang hoạt động để theo dõi.' : 'Chưa có bản đồ đang hoạt động trên máy chủ.')}</p>{error && <button onClick={() => setRetry(n => n + 1)}>Tải lại bản đồ</button>}</div>}
    </div>
    {viewMode === '3d' && showZones && zoneData?.mapId === mapId && zoneData?.error &&
      <p className="rm-caption" role="status">Chưa tải được vùng trên bản đồ. Hãy bấm Làm mới để thử lại.</p>}
    {saved && viewMode === '3d' && <p className="rm-caption">Mặt bằng 3D từ ảnh gốc. Chiều cao vật cản minh họa 1,2 m. Kéo để xoay, cuộn để thu phóng.</p>}
    {saved && viewMode === '2d' && <p className="rm-caption rm-presentation-status" role="status">{published ? 'Đang dùng giao diện bản đồ đã áp dụng.' : presentationNotice || 'Giao diện không khớp phiên bản map này. Đang hiển thị map gốc.'} {!published && mapId && <Link to={`/admin/map?mapId=${encodeURIComponent(mapId)}&stage=presentation`}>Mở chỉnh sửa và áp dụng bản đồ →</Link>}</p>}
    <div className="rm-legend"><span><i className="rm-blue" />Đường dự kiến</span><span>● Điểm đến</span></div>
    <p className="rm-caption rm-pose-caption">
      <span title={position ? 'Vị trí robot đang cập nhật.' : displayPosition ? 'Đang giữ vị trí ghi nhận gần nhất; chưa có vị trí trực tiếp.' : 'Chưa có vị trí robot còn hiệu lực trên bản đồ này.'}>{position ? 'Vị trí robot đang cập nhật.' : displayPosition ? `Vị trí gần nhất lúc ${new Date(displayPose.capturedAt).toLocaleTimeString('vi-VN')} · ${Math.floor(view.ageMs / 1000)} giây trước` : 'Chưa có vị trí robot trên bản đồ này.'}</span>
      <span>{validPlan ? 'Đường dự kiến của bước hiện tại.' : 'Chờ cập nhật đường đi.'}</span>
    </p>
  </section>;
}

export default function RobotMonitor({ jobs, catalogs, auto, revision, onOpen, onCancel, role }) {
  const robotId = catalogs.robots[0]?.robotId;
  const { snapshot, livePose, error, receivedAt, serverClockOffsetMs } = useRobotRealtime(robotId, auto, revision);
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
  const clientNow = Date.now();
  const observedAge = clientNow + (serverClockOffsetMs ?? 0) - Date.parse(snapshot?.observedAt);
  const fresh = !error && receivedAt > 0 && clientNow - receivedAt <= 5000
    && (!snapshot?.observedAt || Number.isFinite(observedAge) && observedAge >= -1000 && observedAge <= 5000);
  const connected = fresh && snapshot?.mqttConnected && snapshot?.heartbeatFresh;
  // The interval only triggers a repaint; its cached tick can predate a newly
  // received snapshot and must not make that observation appear to be future data.
  const connection = robotConnection({ snapshot, receivedAt, now: clientNow });
  const waiting = jobs.filter(job => job.status === 'QUEUED' && (!job.robotId || job.robotId === robotId))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || Date.parse(a.queuedAt) - Date.parse(b.queuedAt));
  const upcoming = schedules.filter(item => item.status === 'ACTIVE' && (!item.robotId || item.robotId === robotId) && item.nextRunAt && Date.parse(item.nextRunAt) >= now)
    .sort((a, b) => Date.parse(a.nextRunAt) - Date.parse(b.nextRunAt));
  const rows = tab === 'running' ? active : waiting;
  return <div className="rm-monitor">
    <div className={`rm-robot-bar is-${connection.phase}`}>
      <div className="rm-robot-identity"><span className="rm-robot-avatar"><OperationsIcon name="robot" /></span><div><small>ROBOT ĐANG THEO DÕI</small><div className="rm-robot-name"><strong>{[robot?.robotName, robot?.robotCode].find(value => value?.trim() && value.trim().toLowerCase() !== 'string') || 'Robot'}</strong><span className={'rm-pill ' + (connection.connected ? 'is-good' : '')}>{connection.connected ? vi(robot?.status) : connection.phase === 'syncing' ? 'Đang đồng bộ' : 'Chưa có kết nối mới'}</span></div></div></div>
      <div className="rm-robot-telemetry"><div title={connection.detail + (error ? ` ${error}` : '')}><OperationsIcon name="signal" /><span><small>Kết nối</small><strong>{connection.label}</strong></span></div><RobotBattery key={robotId} robotId={robotId} auto={auto} revision={revision} now={now} /><div className="rm-robot-updated"><OperationsIcon name="time" /><span><small>Lần nhận gần nhất</small><strong>{receivedAt ? new Date(receivedAt).toLocaleTimeString('vi-VN') : 'Đang chờ dữ liệu'}</strong></span></div></div>
    </div>
    <div className="rm-layout"><div className="rm-left">
      <RobotMap snapshot={snapshot} livePose={livePose} job={current} endpoints={catalogs.endpoints} fresh={connection.connected} revision={revision} auto={auto} serverClockOffsetMs={serverClockOffsetMs}
        stepDetail={<MissionProgress current={current} detail={detail} catalogs={catalogs} stale={dataFreshness(detailReceivedAt, now, !!detailError).stale} connected={!!connected} auto={auto} />} />
    </div><aside className="rm-right"><RobotCamera key={robotId} robotId={robotId} placeholderIcon={<OperationsIcon name="camera" />} /><CurrentMission role={role} onCancel={onCancel} current={current} catalogs={catalogs} detail={detail} error={detailError} onOpen={onOpen} /></aside></div>
      <section className="rm-card rm-queue"><header><div className="rm-card-title"><span className="rm-card-icon"><OperationsIcon name="list" /></span><div><h3>Danh sách công việc</h3><small>Các lượt chạy của robot đang theo dõi</small></div></div><span className="rm-card-count">{tab === 'scheduled' ? upcoming.length : rows.length} công việc</span></header>
        <nav aria-label="Hàng đợi của robot">{[['running', 'Đang thực hiện', active.length], ['queue', 'Chờ thực hiện', waiting.length], ['scheduled', 'Theo lịch', upcoming.length]].map(([key, title, count]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{title} <b>{count}</b></button>)}</nav>
        <p className="rm-caption">{tab === 'queue' ? 'Sắp theo ưu tiên và thời điểm vào hàng đợi. Máy chủ quyết định công việc đủ điều kiện chạy tiếp.' : tab === 'scheduled' ? 'Thời điểm kích hoạt kế tiếp từ lịch trên máy chủ.' : 'Công việc đang được robot tiếp nhận hoặc thực hiện.'}</p>
        {tab === 'scheduled' ? <>{scheduleError && <p role="alert">{scheduleError}</p>}{!upcoming.length && !scheduleError && <p className="rm-caption">Chưa có lịch chạy tiếp theo.</p>}{upcoming.map(item => <div className="rm-queue-row" key={item.scheduleId}><strong>{item.scheduleName?.trim().toLowerCase() === 'string' ? 'Lịch công việc' : item.scheduleName}</strong><span>{dateTime(item.nextRunAt)}</span><Link to="/admin/patrol">Xem lịch →</Link></div>)}</> : <>
          {!rows.length && <div className="rm-queue-empty"><span><OperationsIcon name="list" /></span><div><strong>{tab === 'queue' ? 'Chưa có công việc chờ thực hiện.' : 'Robot chưa có công việc đang thực hiện.'}</strong><p>Các công việc mới sẽ xuất hiện tại đây.</p></div></div>}
          {rows.map((job, index) => { const entry = jobPresentation(job, catalogs); return <button className="rm-queue-row" key={job.jobId} onClick={() => onOpen(job)}><span className="rm-order" title="Thứ tự hiển thị">{index + 1}</span><strong>{entry.title}</strong><span>{entry.target || 'Chưa có điểm đến'}</span><span className="rm-pill">{job.status === 'QUEUED' ? 'Chờ thực hiện' : statusInfo(job.status).label}</span><span aria-hidden="true">›</span></button>; })}
        </>}
      </section>
  </div>;
}

const CurrentMission = memo(function CurrentMission({ current, catalogs, detail, error: detailError, onOpen, onCancel, role }) {
  const info = current && jobPresentation(current, catalogs), step = detail && selectedStep(detail);
  const canCancel = current && allowedJobActions(current, role, step).cancel;
  const pendingCancel = current && !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(current.status) && (current.cancelRequestedAt || current.cancelCommandId);
  return <section className="rm-card rm-current">
      <header><div className="rm-card-title"><span className="rm-card-icon"><OperationsIcon name="activity" /></span><h3>Nhiệm vụ hiện tại</h3></div>{current && <span className={`rm-pill is-${statusInfo(current.status).tone}`}>{statusInfo(current.status).label}</span>}</header>
      <div className="rm-mission-body" role="region" aria-label="Nội dung nhiệm vụ hiện tại" tabIndex={current ? 0 : undefined}>
      {current ? <><strong className="rm-mission-title">{info.title}</strong><p>{info.target || 'Chưa có điểm đến'}</p><small>{current.jobCode}</small>
        <ol>{(detail?.steps || []).slice().sort((a, b) => a.executionSequenceNo - b.executionSequenceNo).map(item => <li key={item.jobStepId} className={item.status === 'SUCCEEDED' ? 'is-done' : item.jobStepId === step?.jobStepId ? 'is-current' : ''}><strong>{vi(item.stepTypeSnapshot)}</strong><small>{statusInfo(item.status).label}</small></li>)}</ol>
        {detailError && <p className="rm-caption" role="status">Chưa cập nhật được tiến trình mới; đang giữ lần ghi nhận gần nhất.</p>}{!detail && <p className="rm-caption">Đang tải tiến trình chi tiết…</p>}
      </> : <div className="rm-placeholder rm-mission-empty"><span><OperationsIcon name="robot" /></span><strong>Chưa có nhiệm vụ đang thực hiện.</strong><p>Theo dõi công việc mới của robot tại đây.</p></div>}
      </div>
      {current && <div className="rm-current-actions">
        <button className="lo-button lo-primary" onClick={() => onOpen(current)}>Xem tiến trình và thao tác</button>
        {canCancel && <button className="lo-button lo-danger" disabled={!!detailError} onClick={() => onCancel(current)}><OperationsIcon name="cancel" />Hủy job</button>}
        {pendingCancel && <span className="rm-cancel-pending" role="status">Đang chờ máy chủ và robot xác nhận hủy</span>}
      </div>}
    </section>;
});
