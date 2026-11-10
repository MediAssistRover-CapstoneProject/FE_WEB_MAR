import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../../features/api/client.js';
import { readCatalog, callBackend } from '../../../features/api/backendApi.js';
import { request } from '../../../features/robotOperations/api.js';
import { loadSavedMap } from '../../../features/robotOperations/savedMap.js';
import { freshMonitorPose, imagePoint, matchingPlan } from '../../../features/operations/monitorGeometry.js';
import { matchingPresentation, presentationViewport } from '../../../features/operations/monitorPresentation.js';
import MapPresentationCanvas from '../MapPresentationCanvas.jsx';
import { jobPresentation, selectedStep, statusInfo } from '../../../features/operations/liveOperations.js';
import { vi } from '../../../i18n/vi.js';
import './robotMonitor.css';

const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận';
const cameraKey = 'mar.robotCameraUrl';

function useRobotSnapshot(robotId, enabled, revision) {
  const [state, setState] = useState({ snapshot: null, error: '', receivedAt: null });
  useEffect(() => {
    setState({ snapshot: null, error: '', receivedAt: null });
    if (!robotId) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const snapshot = await request('/api/v1/robots/' + encodeURIComponent(robotId) + '/snapshot', { signal: controller.signal });
        if (!snapshot?.robot || snapshot.robot.robotId !== robotId) throw Error('Chưa có snapshot hợp lệ của robot.');
        if (!controller.signal.aborted) setState({ snapshot, error: '', receivedAt: Date.now() });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, error: error.message }));
      }
      if (!controller.signal.aborted && enabled) timer = setTimeout(poll, 3000);
    };
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [robotId, enabled, revision]);
  return state;
}

function RobotMap({ snapshot, job, endpoints, fresh, revision, auto }) {
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
        if (!controller.signal.aborted) { setMaps([]); setCatalogError(cause.message); }
      }
      if (!controller.signal.aborted && auto) timer = setTimeout(load, 60000);
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision, auto]);
  const [saved, setSaved] = useState(null), [error, setError] = useState('');
  const [presentation, setPresentation] = useState(null), [presentationNotice, setPresentationNotice] = useState('');
  const [retry, setRetry] = useState(0), [zoom, setZoom] = useState(1), [follow, setFollow] = useState(false);
  const [trail, setTrail] = useState([]);
  useEffect(() => {
    setSaved(null); setError(''); setZoom(1);
    if (!mapId) return;
    const controller = new AbortController();
    let url;
    loadSavedMap(mapId, request, controller.signal).then(({ blob, metadata }) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setSaved({ url, metadata });
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [mapId, retry, revision]);
  useEffect(() => {
    setPresentation(null); setPresentationNotice('Đang kiểm tra giao diện bản đồ đã áp dụng…');
    if (!mapId) return;
    const controller = new AbortController();
    let timer, sequence = 0;
    const load = async () => {
      clearTimeout(timer);
      const current = ++sequence;
      try {
        const value = await request(`/api/v1/maps/${encodeURIComponent(mapId)}/presentation/published`, { signal: controller.signal });
        if (!controller.signal.aborted && current === sequence) { setPresentation(value); setPresentationNotice(''); }
      } catch (cause) {
        if (!controller.signal.aborted && current === sequence) {
          setPresentation(null);
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
  useEffect(() => { setTrail([]); }, [mapId, job?.jobId]);
  const currentPose = fresh ? freshMonitorPose(snapshot) : null;
  const pose = currentPose?.mapId === mapId ? currentPose : null;
  useEffect(() => {
    if (!pose || !job || snapshot.activeJobId !== job.jobId || pose.jobId && pose.jobId !== job.jobId) return;
    setTrail(previous => {
      if (previous.at(-1)?.locationId === pose.locationId) return previous;
      const last = previous.at(-1);
      // A gap is drawn as a break, never as an inferred straight path.
      const gap = !last || Date.parse(pose.capturedAt) - Date.parse(last.capturedAt) > 10000;
      return [...previous, { ...pose, gap }].slice(-600);
    });
  }, [pose?.locationId, mapId, job?.jobId]);
  const meta = saved?.metadata;
  const position = pose && imagePoint(pose, meta);
  const plan = fresh ? matchingPlan(snapshot, meta, job) : null;
  const planPoints = plan?.points.map(point => imagePoint(point, meta));
  const validPlan = planPoints?.length > 1 && planPoints.every(Boolean);
  const endpointId = plan?.endpointId || job?.inputJson?.destinationEndpointId || job?.inputJson?.endpointId;
  const endpoint = endpoints.find(item => item.endpointId === endpointId && item.mapId === mapId);
  const destination = endpoint && imagePoint(endpoint, meta);
  const width = meta?.width_px || 1, height = meta?.height_px || 1;
  const radius = Math.max(width, height) * .014;
  const viewWidth = width / zoom, viewHeight = height / zoom;
  const center = follow && position ? position : { x: width / 2, y: height / 2 };
  const left = Math.max(0, Math.min(width - viewWidth, center.x - viewWidth / 2));
  const top = Math.max(0, Math.min(height - viewHeight, center.y - viewHeight / 2));
  let trailPath = '';
  trail.forEach(point => {
    const pixel = imagePoint(point, meta);
    if (pixel) trailPath += (point.gap || !trailPath ? 'M' : 'L') + pixel.x + ',' + pixel.y + ' ';
  });
  const published = matchingPresentation(presentation, meta);
  const presentationView = published && presentationViewport(published, zoom, follow ? position : null);
  const overlay = <g className="rm-navigation-overlay">
    {trailPath && <path className="rm-trail" d={trailPath} fill="none" stroke="#16a34a" strokeWidth={radius * .35} />}
    {validPlan && <polyline className="rm-plan" points={planPoints.map(point => point.x + ',' + point.y).join(' ')} fill="none" stroke="#2563eb" strokeWidth={radius * .35} strokeDasharray={radius + ' ' + radius * .6} />}
    {destination && <g className="rm-destination" transform={`translate(${destination.x} ${destination.y})`}><circle r={radius} fill="#f59e0b" stroke="white" strokeWidth={radius * .2} /><title>Điểm đến</title></g>}
    {position && <g className="rm-position" transform={`translate(${position.x} ${position.y}) rotate(${-(pose.yawRad - meta.origin_yaw_rad) * 180 / Math.PI})`}>
      <circle r={radius * 1.3} fill="#2563eb" stroke="white" strokeWidth={radius * .2} /><path d={`M ${radius * 2.2} 0 L 0 ${-radius * .7} L 0 ${radius * .7} Z`} fill="white" />
    </g>}
  </g>;
  return <section className="rm-card rm-map">
    <header><div><h3>Bản đồ trực tiếp</h3><small>{activeMap ? activeMap.mapName + ' · Đang hoạt động · v' + activeMap.versionNo : 'Chưa chọn bản đồ đang hoạt động'}</small></div><div className="rm-tools">      {maps.length > 1 && <select aria-label="Bản đồ đang hoạt động" value={mapId || ''} onChange={event => setChosenMapId(event.target.value)}><option value="">Chọn bản đồ</option>{maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName}</option>)}</select>}
      <button type="button" aria-pressed={follow} disabled={!position} onClick={() => { setFollow(!follow); setZoom(value => Math.max(value, 2)); }}>Theo robot</button>
      <button type="button" aria-label="Thu nhỏ bản đồ" disabled={!saved || zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}>−</button>
      <button type="button" aria-label="Phóng to bản đồ" disabled={!saved || zoom >= 5} onClick={() => setZoom(value => Math.min(5, value + .5))}>+</button>
    </div></header>
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
    <div className="rm-legend"><span><i className="rm-green" />Vệt vị trí đã nhận</span><span><i className="rm-blue" />Đường dự kiến</span><span>● Điểm đến</span></div>
    <p className="rm-caption">{position ? 'Vị trí robot đang cập nhật.' : 'Chưa có vị trí robot còn hiệu lực trên bản đồ này.'} {validPlan ? 'Đường dự kiến của bước hiện tại.' : 'Chờ cập nhật đường đi.'} Vệt vị trí được ghi nhận từ khi mở trang.</p>
  </section>;
}

function RobotCamera() {
  const container = useRef(null);
  const [url, setUrl] = useState(() => localStorage.getItem(cameraKey) || import.meta.env.VITE_ROBOT_CAMERA_URL || '');
  const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => { setLoaded(false); setFailed(false); setUrl(localStorage.getItem(cameraKey) || import.meta.env.VITE_ROBOT_CAMERA_URL || ''); };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  useEffect(() => {
    if (!url || loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(timer);
  }, [url, loaded, failed, revision]);
  let source = '';
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !(location.protocol === 'https:' && parsed.protocol === 'http:')) source = parsed.href;
  } catch { /* Missing or invalid configuration is shown in the camera panel. */ }
  return <section className="rm-card" ref={container}>
    <header><h3>Camera robot</h3><button type="button" aria-label="Phóng lớn camera" onClick={() => container.current?.requestFullscreen?.().catch(() => {})}>⛶</button></header>
    <div className="rm-camera">
      {source && !failed && <img key={revision + source} src={source} alt="Video từ camera robot đã cấu hình" onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setFailed(true); }} />}
      {(!source || !loaded || failed) && <div className="rm-placeholder"><span>▣</span><p>{failed ? 'Chưa kết nối được camera.' : source ? 'Đang kết nối camera…' : 'Chưa cấu hình nguồn camera.'}</p><Link to="/admin/system-settings?tab=robot-camera">Cấu hình camera →</Link></div>}
    </div>
    <footer><small>{loaded && !failed ? 'Nguồn video trực tiếp · Chưa có thời điểm từng khung hình' : 'Camera cần truy cập được từ trình duyệt.'}</small>{source && <button onClick={() => { setFailed(false); setLoaded(false); setRevision(n => n + 1); }}>Kết nối lại</button>}</footer>
  </section>;
}

export default function RobotMonitor({ jobs, catalogs, auto, revision, onOpen }) {
  const robotId = catalogs.robots[0]?.robotId;
  const { snapshot, error, receivedAt } = useRobotSnapshot(robotId, auto, revision);
  const [now, setNow] = useState(Date.now()), [tab, setTab] = useState('queue');
  const [schedules, setSchedules] = useState([]), [scheduleError, setScheduleError] = useState('');
  const [detail, setDetail] = useState(null);
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
  const current = active.find(job => job.jobId === snapshot?.activeJobId) || active[0];
  useEffect(() => {
    setDetail(null);
    if (!current?.jobId) return;
    const controller = new AbortController();
    callBackend('GET /api/v1/jobs/{id}', { path: { id: current.jobId } }, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(() => {});
    return () => controller.abort();
  }, [current?.jobId, current?.rowVersion, snapshot?.selectedJobStepId, revision]);
  const robot = snapshot?.robot || catalogs.robots[0];
  const fresh = !error && now - receivedAt <= 10000;
  const connected = fresh && snapshot?.mqttConnected && snapshot?.heartbeatFresh;
  const waiting = jobs.filter(job => job.status === 'QUEUED' && (!job.robotId || job.robotId === robotId))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || Date.parse(a.queuedAt) - Date.parse(b.queuedAt));
  const upcoming = schedules.filter(item => item.status === 'ACTIVE' && (!item.robotId || item.robotId === robotId) && item.nextRunAt && Date.parse(item.nextRunAt) >= now)
    .sort((a, b) => Date.parse(a.nextRunAt) - Date.parse(b.nextRunAt));
  const rows = tab === 'running' ? active : waiting;
  const info = current && jobPresentation(current, catalogs);
  const step = detail && selectedStep(detail);
  return <div className="rm-monitor">
    <div className="rm-robot-bar"><strong>♧ {[robot?.robotName, robot?.robotCode].find(value => value?.trim() && value.trim().toLowerCase() !== 'string') || 'Robot'}</strong><span className={'rm-pill ' + (connected ? 'is-good' : '')}>{connected ? vi(robot?.status) : 'Chưa có kết nối mới'}</span><span>{connected ? '● Đã kết nối' : '○ Chờ tín hiệu robot'}</span><small>{receivedAt ? 'Cập nhật lúc ' + new Date(receivedAt).toLocaleTimeString('vi-VN') : 'Đang chờ dữ liệu'}</small></div>
    {error && <p className="lo-notice lo-notice-warning" role="status">{error}</p>}
    <div className="rm-layout"><div className="rm-left">
      <RobotMap snapshot={snapshot} job={current} endpoints={catalogs.endpoints} fresh={fresh} revision={revision} auto={auto} />
      <section className="rm-card rm-queue"><header><h3>Danh sách công việc</h3></header>
        <nav aria-label="Hàng đợi của robot">{[['running', 'Đang thực hiện', active.length], ['queue', 'Chờ thực hiện', waiting.length], ['scheduled', 'Theo lịch', upcoming.length]].map(([key, title, count]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{title} <b>{count}</b></button>)}</nav>
        <p className="rm-caption">{tab === 'queue' ? 'Sắp theo ưu tiên và thời điểm vào hàng đợi. Máy chủ quyết định công việc đủ điều kiện chạy tiếp.' : tab === 'scheduled' ? 'Thời điểm kích hoạt kế tiếp từ lịch trên máy chủ.' : 'Công việc đang được robot tiếp nhận hoặc thực hiện.'}</p>
        {tab === 'scheduled' ? <>{scheduleError && <p role="alert">{scheduleError}</p>}{!upcoming.length && !scheduleError && <p className="rm-caption">Chưa có lịch chạy tiếp theo.</p>}{upcoming.map(item => <div className="rm-queue-row" key={item.scheduleId}><strong>{item.scheduleName?.trim().toLowerCase() === 'string' ? 'Lịch công việc' : item.scheduleName}</strong><span>{dateTime(item.nextRunAt)}</span><Link to="/admin/patrol">Xem lịch →</Link></div>)}</> : <>
          {!rows.length && <p className="rm-caption">{tab === 'queue' ? 'Chưa có công việc chờ thực hiện.' : 'Robot chưa có công việc đang thực hiện.'}</p>}
          {rows.map((job, index) => { const entry = jobPresentation(job, catalogs); return <button className="rm-queue-row" key={job.jobId} onClick={() => onOpen(job)}><span className="rm-order" title="Thứ tự hiển thị">{index + 1}</span><strong>{entry.title}</strong><span>{entry.target || 'Chưa có điểm đến'}</span><span className="rm-pill">{job.status === 'QUEUED' ? 'Chờ thực hiện' : statusInfo(job.status).label}</span><span aria-hidden="true">›</span></button>; })}
        </>}
      </section>
    </div><aside className="rm-right"><RobotCamera /><section className="rm-card rm-current">
      <header><h3>Nhiệm vụ hiện tại</h3>{current && <span className="rm-pill is-good">{statusInfo(current.status).label}</span>}</header>
      {current ? <><strong className="rm-mission-title">{info.title}</strong><p>{info.target || 'Chưa có điểm đến'}</p><small>{current.jobCode}</small>
        <ol>{(detail?.steps || []).slice().sort((a, b) => a.executionSequenceNo - b.executionSequenceNo).map(item => <li key={item.jobStepId} className={item.status === 'SUCCEEDED' ? 'is-done' : item.jobStepId === step?.jobStepId ? 'is-current' : ''}><strong>{vi(item.stepTypeSnapshot)}</strong><small>{statusInfo(item.status).label}</small></li>)}</ol>
        {!detail && <p className="rm-caption">Chưa cập nhật được tiến trình chi tiết.</p>}
        <button className="lo-button lo-primary" onClick={() => onOpen(current)}>Xem tiến trình và thao tác</button>
      </> : <div className="rm-placeholder"><span>✓</span><p>Chưa có nhiệm vụ đang thực hiện.</p></div>}
    </section></aside></div>
  </div>;
}
