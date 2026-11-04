import { useEffect, useRef, useState } from 'react';
import { getSession } from '../../../features/auth/session.js';
import { jobPath, post, readTracking, request, writeTracking } from '../../../features/robotOperations/api.js';
import { committedMapId, isOperator, MappingJog, movementBlock, receiptLabels, terminalJobs } from '../../../features/robotOperations/model.js';
import { ErrorNotice, Field, JobStatus, Picker, useCatalog } from './Shared.jsx';
import { mapPose } from '../../../features/robotOperations/mapPose.js';
import SavedMappingImage from './SavedMappingImage.jsx';
import MappingMapPanel from './MappingMapPanel.jsx';
import { autonomyBlock, MappingAutonomy, prepareMappingWorkflow } from '../../../features/robotOperations/mappingOperations.js';
import MappingRecoveryPanel from './MappingRecoveryPanel.jsx';

function SnapshotImage({ jobId, kind, enabled }) {
  const [frame, setFrame] = useState(null), [message, setMessage] = useState('Đang chờ ảnh từ Pi.');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (kind !== 'map' || !enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [kind, enabled]);
  useEffect(() => {
    setFrame(null); setMessage('Đang chờ ảnh từ Pi.');
    if (!enabled || !jobId) return;
    const controller = new AbortController(); let timer, objectUrl;
    const poll = async () => {
      try {
        const state = kind === 'map' ? await request(`${jobPath(jobId)}/mapping-session?includePreview=false`, { signal: controller.signal }) : null;
        const response = await request(`${jobPath(jobId)}/${kind === 'map' ? 'mapping-preview.png' : 'camera-preview.jpg'}`, { responseType: 'response', signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 204) { setFrame(null); setMessage('Chưa có ảnh mới hoặc ảnh đã quá 10 giây.'); }
        else {
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          const revision = response.headers.get('X-Frame-Revision');
          let paired = state;
          const encoded = kind === 'map' && response.headers.get('X-Map-Metadata');
          if (encoded) {
            try {
              // PNG and TF metadata from the same immutable BE frame. A second
              // session poll can otherwise advance to another map revision.
              const preview = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), character => character.charCodeAt(0))));
              paired = { ...state, preview: preview.mapping_session_id === state?.mapping_session_id && String(preview.revision) === String(revision) ? preview : null };
            } catch { paired = { ...state, preview: null }; }
          }
          setFrame({ url: objectUrl, captured: response.headers.get('X-Captured-At'), revision, state: paired });
          setMessage(`Nhận ảnh lúc ${new Date().toLocaleTimeString('vi-VN')}`);
        }
      } catch { if (!controller.signal.aborted) { setFrame(null); setMessage('Không tải được ảnh. Kiểm tra kết nối hoặc phiên quét.'); } }
      if (!controller.signal.aborted) timer = setTimeout(poll, kind === 'map' ? 1000 : 2000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [jobId, kind, enabled]);
  const position = kind === 'map' && frame ? mapPose(frame.state, frame.revision, now) : null;
  return <><div className={'ro-preview ' + (kind === 'map' ? 'map' : '')}>{frame ? <div className="ro-map-frame" key={frame.url}><img src={frame.url} alt={kind === 'map' ? 'Bản đồ đang quét từ robot' : 'Ảnh camera robot qua MQTT'} />{position?.x !== undefined && <svg className="ro-pose-overlay" viewBox={`0 0 ${position.width} ${position.height}`} role="img" aria-label="Vị trí và hướng robot trên bản đồ"><g transform={`translate(${position.x} ${position.y}) rotate(${position.angle})`}><circle r={position.radius} fill="#0879ee" fillOpacity=".7" stroke="white" strokeWidth="1"/><path d={`M ${position.radius * 1.8} 0 L ${position.radius * .3} ${-position.radius * .55} L ${position.radius * .3} ${position.radius * .55} Z`} fill="#ff7900" stroke="white" strokeWidth=".6"/></g></svg>}</div> : <p>{enabled ? message : 'Chưa có phiên quét đang kết nối.'}</p>}</div>{kind === 'map' && <div className="ro-pose-status"><strong>● Robot</strong><span>{position?.message || 'Chờ bản đồ và tọa độ từ robot.'}</span><small>Chấm xanh: vị trí · Mũi tên cam: hướng phía trước</small></div>}<small>{frame?.captured ? `Ảnh chụp lúc ${new Date(frame.captured).toLocaleString('vi-VN')}` : message}</small></>;
}

export const ROBOT_CAMERA_URL_KEY = 'mar.robotCameraUrl';

function MotionStatus({ session }) {
  let gate;
  try { gate = JSON.parse(session?.motionTelemetry?.gate?.value ?? 'null'); } catch { /* Await a valid sample. */ }
  const age = Date.now() - Date.parse(session?.motionObservedAt);
  const labels = {
    CLEAR: 'Đường điều khiển cho phép chuyển động', NO_LEASE: 'Robot đang dừng hoặc chờ lệnh',
    STALE_COMMAND: 'Robot chưa nhận được lệnh mới', SIDE_OBSTACLE: 'Robot dừng: có vật cản bên cạnh',
    REAR_OBSTACLE: 'Robot dừng: có vật cản phía sau', REVERSE_NOT_ENABLED: 'Pi chưa bật chế độ lùi',
    STALE_OR_INVALID_US100: 'Robot dừng: dữ liệu siêu âm chưa hợp lệ hoặc đã cũ',
    REAR_LIDAR_NOT_READY: 'LiDAR phía sau chưa sẵn sàng', REAR_LIDAR_TF_NOT_READY: 'Chưa xác định được hướng LiDAR phía sau',
    STALE_REAR_LIDAR: 'Dữ liệu LiDAR phía sau đã cũ', NOT_COMMISSIONED: 'Pi chưa bật cấu hình chuyển động',
  };
  return <p className="ro-help" role="status">{gate && Number.isFinite(age) && age >= -1000 && age < 10000
    ? (labels[gate.reason] || `Robot dừng hoặc giới hạn: ${gate.reason || 'chưa rõ nguyên nhân'}`)
    : 'Chưa có phản hồi chuyển động mới từ Pi.'}</p>;
}

function Camera({ jobId, enabled }) {
  const [stream, setStream] = useState(''), [message, setMessage] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  useEffect(() => {
    setMessage('');
    const saved = localStorage.getItem(ROBOT_CAMERA_URL_KEY) || import.meta.env.VITE_ROBOT_CAMERA_URL || '';
    setStreamUrl(saved);
    try {
      const value = new URL(saved);
      setStream(['http:', 'https:'].includes(value.protocol) && !value.username && !value.password && (location.protocol !== 'https:' || value.protocol === 'https:') ? value.href : '');
    } catch { setStream(''); }
  }, [jobId]);
  const connect = event => {
    event.preventDefault();
    try {
      const value = new URL(streamUrl.trim());
      if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password) throw Error('Nhập URL video HTTP hoặc HTTPS, không kèm tài khoản.');
      if (location.protocol === 'https:' && value.protocol !== 'https:') throw Error('Trang HTTPS cần nguồn video HTTPS.');
      setStream(value.href); setMessage('Đang kết nối video từ robot…');
      try { localStorage.setItem(ROBOT_CAMERA_URL_KEY, value.href); } catch { /* Video still works without persistence. */ }
    } catch (error) { setMessage(error instanceof TypeError ? 'URL video chưa hợp lệ.' : error.message); }
  };
  return <section className="ro-card"><h3>Camera robot <span className="ro-badge">{stream ? 'Video cùng mạng' : 'Ảnh MQTT'}</span></h3>
    {stream ? <div className="ro-preview"><img src={stream} alt="Video trực tiếp từ robot" onLoad={() => setMessage('Đã nhận hình từ nguồn video.')} onError={() => { setStream(''); setMessage('Không kết nối được video. Đã chuyển về ảnh MQTT.'); }} /></div> : <SnapshotImage jobId={jobId} kind="camera" enabled={enabled} />}
    {stream && <button type="button" onClick={() => { setStream(''); setMessage('Đã chuyển về ảnh MQTT.'); }}>Dùng ảnh MQTT</button>}
    {message && <p role="status">{message}</p>}
    <details className="ro-details"><summary>Kết nối video trực tiếp</summary><form onSubmit={connect}>
      <Field label="URL video từ robot"><input type="url" required value={streamUrl} onChange={event => setStreamUrl(event.target.value)} placeholder="http://IP_PI:8080/stream?topic=/ascamera/camera_publisher/rgb0/image&type=mjpeg" /></Field>
      <div className="ro-actions"><button type="submit">Xem video trực tiếp</button></div>
      <small>Máy này cần truy cập được Pi. Nếu video lỗi, camera tự chuyển về ảnh MQTT của phiên quét.</small>
    </form></details>
  </section>;
}

export default function LiveMapping({ onMapSaved, embedded = false }) {
  const operator = isOperator(getSession());
  const { catalog, loading, error: catalogError, reload } = useCatalog('MAPPING', operator);
  const [tracking, setTracking] = useState(() => readTracking('mapping'));
  const [robotId, setRobotId] = useState(() => readTracking('mapping')?.robotId || '');
  const [floorId, setFloorId] = useState(() => readTracking('mapping')?.floorId || ''), [workflowId, setWorkflowId] = useState(() => readTracking('mapping')?.workflowId || ''), [mapName, setMapName] = useState(() => readTracking('mapping')?.mapName || '');
  const [detail, setDetail] = useState(null), [session, setSession] = useState(null), [snapshot, setSnapshot] = useState(null);
  const [checkedAt, setCheckedAt] = useState(0), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [saving, setSaving] = useState(() => Boolean(readTracking('mapping')?.saving));
  const [receipt, setReceipt] = useState(null), [jogMessage, setJogMessage] = useState('Chưa gửi lệnh.');
  const [turnSpeed, setTurnSpeed] = useState('0.20');
  const [speed, setSpeed] = useState('0.05'), [seconds, setSeconds] = useState('4'), [recent, setRecent] = useState([]), [recentError, setRecentError] = useState(null);
  const [revision, setRevision] = useState(0), [uncertain, setUncertain] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState('180'), [autoReturn, setAutoReturn] = useState(false), [autoSave, setAutoSave] = useState(false), [autoMessage, setAutoMessage] = useState('Chờ phiên quét và cấu hình tự quét từ Pi.');
  const [prepareMessage, setPrepareMessage] = useState('');
  const current = useRef({}), mounted = useRef(true), writeLock = useRef(false), controlSequence = useRef(0), controlSessionId = useRef(crypto.randomUUID());
  const autonomy = useRef(null), autoSavePending = useRef(null), saveAction = useRef(null);
  const jobId = tracking?.jobId || '';
  current.current = { operator, detail, session, snapshot, checkedAt, saving, jobId };
  if (!autonomy.current) autonomy.current = new MappingAutonomy({
    allowed: (scope, ownedRunId) => {
      const state = current.current;
      if (!isOperator(getSession()) || scope.jobId !== state.jobId || scope.sessionId !== state.session?.mapping_session_id) return 'Phiên hoặc quyền điều khiển đã thay đổi.';
      return autonomyBlock(state, Date.now(), ownedRunId);
    },
    send: (options, scope) => {
      if (!isOperator(getSession())) return Promise.reject(Error('Cần đăng nhập ADMIN thật.'));
      return post(`${jobPath(scope.jobId)}/mapping-autonomy`, { mappingSessionId: scope.sessionId, autonomy: options, controlSessionId: controlSessionId.current, controlSequence: ++controlSequence.current, requestedAt: new Date().toISOString() }, { signal: AbortSignal.timeout(1200), retry: false, keepalive: options.action === 'STOP' });
    },
    onState: message => { if (mounted.current) setAutoMessage(message); },
    onFinish: scope => { autoSavePending.current = scope; void autonomy.current.stop('Pi đã kết thúc tự quét; đang trả quyền điều khiển trước khi yêu cầu lưu.').catch(() => {}); },
  });
  const jog = useRef(null);
  if (!jog.current) jog.current = new MappingJog({
    allowed: () => autonomy.current.active ? 'Đang tự quét; dừng tự chạy trước khi điều khiển tay.' : movementBlock({ ...current.current, operator: isOperator(getSession()) }),
    send: (x, z) => {
      const state = current.current;
      if (!isOperator(getSession()) || !state.jobId || !state.session?.mapping_session_id) return Promise.reject(Error('Chưa có quyền hoặc phiên quét.'));
      return post(`${jobPath(state.jobId)}/mapping-control`, { mappingSessionId: state.session.mapping_session_id, linearX: x, angularZ: z, durationMs: 900, controlSessionId: controlSessionId.current, controlSequence: ++controlSequence.current, requestedAt: new Date().toISOString() }, { signal: AbortSignal.timeout(1200), retry: false, keepalive: x === 0 && z === 0 });
    },
    onState: (message, value) => { if (mounted.current) { setJogMessage(message); if (value) setReceipt(value); } },
  });
  useEffect(() => {
    mounted.current = true;
    const stop = () => { if (jog.current.active) void jog.current.stop('Đã ngừng gia hạn vì rời điều khiển.').catch(() => {}); };
    const leave = () => { stop(); autoSavePending.current = null; if (autonomy.current.active) void autonomy.current.stop('Trang đã ẩn; đã ngừng gia hạn tự quét.').catch(() => {}); };
    const hidden = () => { if (document.hidden) leave(); };
    window.addEventListener('blur', stop); window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', hidden);
    return () => { leave(); mounted.current = false; window.removeEventListener('blur', stop); window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (!operator || !robotId) return;
    const controller = new AbortController();
    setRecentError(null); setRecent([]);
    request(`/api/v1/jobs?robotId=${encodeURIComponent(robotId)}&size=100`, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setRecent((data.content || []).filter(j => j.inputJson?.floor_id && j.inputJson?.map_name));
    }).catch(e => { if (!controller.signal.aborted) setRecentError(e); });
    return () => controller.abort();
  }, [operator, robotId, revision, jobId]);
  useEffect(() => {
    setDetail(null); setSession(null); setSnapshot(null); setCheckedAt(0); setReceipt(null);
    if (!operator || !robotId) return;
    const controller = new AbortController(); let timer;
    const poll = async () => {
      try {
        const [snap, info] = await Promise.all([
          request(`/api/v1/robots/${encodeURIComponent(robotId)}/snapshot`, { signal: controller.signal }),
          jobId ? request(jobPath(jobId), { signal: controller.signal }) : null,
        ]);
        let state = null, ack = null;
        if (jobId) {
          try { state = await request(`${jobPath(jobId)}/mapping-session?includePreview=false`, { signal: controller.signal }); }
          catch (e) { if (e.status !== 404) throw e; }
          const commandId = autonomy.current.receiptCommandId();
          if (state) ack = await request(`${jobPath(jobId)}/mapping-control${commandId ? '?commandId=' + encodeURIComponent(commandId) : ''}`, { signal: controller.signal });
        }
        if (controller.signal.aborted) return;
        const next = { ...current.current, detail: info, session: state, snapshot: snap, checkedAt: Date.now() };
        if (info && terminalJobs.has(info.job.status) && !state?.potentially_open) {
          next.saving = false; setSaving(false);
          writeTracking('mapping', { ...readTracking('mapping'), jobId, robotId, saving: false });
        }
        current.current = next;
        setSnapshot(snap); setDetail(info); setSession(state); setCheckedAt(next.checkedAt); setError(null);
        if (ack) { setReceipt(ack); jog.current.acknowledge(ack); autonomy.current.observeReceipt(ack); }
        autonomy.current.observe(state?.autonomy, { jobId, sessionId: state?.mapping_session_id });
        if (autonomy.current.active && autonomyBlock(next, Date.now(), autonomy.current.run?.runId)) void autonomy.current.stop('Trạng thái tự quét không còn hợp lệ; đã ngừng gia hạn.').catch(() => {});
        const queued = autoSavePending.current;
        if (queued && (queued.jobId !== jobId || queued.sessionId !== state?.mapping_session_id || terminalJobs.has(info?.job.status))) autoSavePending.current = null;
        else if (queued && !movementBlock({ ...next, manual: false }) && !writeLock.current) { autoSavePending.current = null; void saveAction.current?.(); }
        if (jog.current.active && movementBlock(next)) void jog.current.stop('Nhiệm vụ không còn cho phép di chuyển.').catch(() => {});
      } catch (e) {
        if (controller.signal.aborted) return;
        current.current.checkedAt = 0; setCheckedAt(0); setSnapshot(null); setError(e);
        if (jog.current.active) void jog.current.stop('Mất kết nối theo dõi. Đã ngừng gia hạn.').catch(() => {});
        if (autonomy.current.active) void autonomy.current.stop('Mất kết nối theo dõi; đã ngừng gia hạn tự quét.').catch(() => {});
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [operator, robotId, jobId, revision]);

  const track = value => {
    autoSavePending.current = null;
    if (autonomy.current.active) void autonomy.current.stop('Đã đổi nhiệm vụ; đã ngừng gia hạn tự quét.').catch(() => {});
    if (value?.jobId && value.jobId === tracking?.jobId) value = { ...tracking, ...value };
    current.current.checkedAt = 0;
    setCheckedAt(0); setDetail(null); setSession(null); setReceipt(null); setSaving(Boolean(value?.saving));
    if (value?.floorId) setFloorId(value.floorId);
    if (value?.workflowId) setWorkflowId(value.workflowId);
    if (value?.mapName) setMapName(value.mapName);
    setActionError(null);
    setTracking(value); writeTracking('mapping', value); setUncertain(false);
    if(value?.jobId)setSetupOpen(false);
  };
  const activeJob = jobId && (!detail || !terminalJobs.has(detail.job.status) || session?.potentially_open);
  const block = autonomy.current.active ? 'Đang tự quét; dừng tự chạy trước khi điều khiển tay.' : movementBlock(current.current);
  const saveBlock = autonomy.current.active ? 'Dừng tự quét trước khi lưu bản đồ.' : movementBlock({ ...current.current, manual: false });
  const ready = snapshot?.mqttConnected && snapshot?.heartbeatFresh && snapshot?.dispatchReady;
  const setupSummary=[catalog.robots.find(r=>r.robotId===robotId)?.robotName,catalog.floors.find(f=>f.floorId===floorId)?.floorName,mapName.trim()].filter(Boolean).join(' · ') || 'Chọn robot, tầng và tên bản đồ để bắt đầu';
  const create = async e => {
    e.preventDefault();
    if (writeLock.current || !operator || activeJob || !ready || uncertain) return;
    writeLock.current = true; setBusy(true); setActionError(null);
    try {
      const result = await post('/api/v1/mapping-jobs', { workflowId, robotId, floorId, mapName: mapName.trim() }, { retry: false });
      track({ jobId: result.jobId, robotId, floorId, workflowId, mapName: mapName.trim() });
    } catch (e) { setActionError(e); if (!e.status || e.name === 'TimeoutError' || e.status >= 500) setUncertain(true); setRevision(v => v + 1); }
    finally { writeLock.current = false; setBusy(false); }
  };
  const save = async (retrySave = false) => {
    if (writeLock.current || autonomy.current.active || movementBlock({ ...current.current, manual: false, saving: retrySave ? false : current.current.saving })) return;
    writeLock.current = true; setBusy(true); setActionError(null); setSaving(true); current.current.saving = true;
    const event = tracking?.saveEvent || { eventId: crypto.randomUUID(), eventType: 'MAPPING_SAVE_REQUESTED', correlationKey: session.mapping_session_id, occurredAt: new Date().toISOString(), data: {} };
    const next = { ...tracking, saving: true, saveEvent: event }; setTracking(next); writeTracking('mapping', next);
    try {
      await jog.current.stop();
      // An explicit retry reuses the entire event, including occurredAt, as BE
      // checks payload equality before accepting a duplicate eventId.
      await post(`${jobPath(jobId)}/events`, event, { retry: false });
    } catch (e) { setActionError(e); /* Keep controls locked until the server outcome is known. */ }
    finally { writeLock.current = false; if (mounted.current) { setBusy(false); setRevision(v => v + 1); } }
  };
  saveAction.current = () => save();
  const prepare = async () => {
    if (writeLock.current || activeJob || !operator) return;
    writeLock.current = true; setBusy(true); setActionError(null); setPrepareMessage('Đang kiểm tra quy trình quét trên BE…');
    try {
      const response = await fetch('/robot-console/mapping-workflow.json');
      if (!response.ok) throw Error('Không tải được mẫu quy trình quét.');
      const id = await prepareMappingWorkflow({ request, post, definition: await response.json() });
      setWorkflowId(id); reload(); setPrepareMessage('Quy trình quét và lưu map đã sẵn sàng. Thao tác này chưa tạo nhiệm vụ hoặc di chuyển robot.');
    } catch (e) { setActionError(e); setPrepareMessage('Chưa hoàn tất chuẩn bị quy trình. Tải lại danh mục trước khi thử lại.'); }
    finally { writeLock.current = false; if (mounted.current) setBusy(false); }
  };
  const startAutonomy = () => {
    if (busy || writeLock.current || jog.current.active || session?.autonomy?.control_selected) return;
    autoSavePending.current = null;
    try {
      const seconds = Number(autoSeconds), maximum = Math.min(600, Number(session?.autonomy?.profile_max_duration_sec) || 600);
      if (seconds > maximum) throw Error(`Cấu hình Pi chỉ cho tự quét tối đa ${maximum} giây.`);
      autonomy.current.start({ jobId, sessionId: session?.mapping_session_id }, seconds, session?.autonomy?.exploration_mode === 'frontier' ? false : autoReturn, autoSave);
    } catch (e) { setAutoMessage(e.message); }
  };
  const stopAutonomy = async () => {
    autoSavePending.current = null;
    try {
      if (!autonomy.current.run || autonomy.current.context?.jobId !== jobId || autonomy.current.context?.sessionId !== session?.mapping_session_id) {
        autonomy.current.context = { jobId, sessionId: session?.mapping_session_id };
        autonomy.current.run = { action: 'STOP', runId: session?.autonomy?.run_id || crypto.randomUUID(), maxDurationSec: 10, stopOnReturn: false, saveOnComplete: false };
      }
      await autonomy.current.stop();
      if (jog.current.active) await jog.current.stop();
    } catch (e) { setAutoMessage('Đã ngừng gia hạn; chưa xác nhận Pi dừng: ' + e.message); }
  };
  const handlers = (x, z) => ({
    onPointerDown: e => { if (e.button !== 0 || block || busy) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); try { jog.current.start(x, z, Number(seconds)); } catch (error) { setJogMessage(error.message); } },
    onPointerUp: () => { if (jog.current.active) void jog.current.stop().catch(() => {}); },
    onPointerCancel: () => { if (jog.current.active) void jog.current.stop().catch(() => {}); },
    onLostPointerCapture: () => { if (jog.current.active) void jog.current.stop().catch(() => {}); },
    onKeyDown: e => { if (![' ', 'Enter'].includes(e.key) || e.repeat || block || busy) return; e.preventDefault(); try { jog.current.start(x, z, Number(seconds)); } catch (error) { setJogMessage(error.message); } },
    onKeyUp: e => { if ([' ', 'Enter'].includes(e.key) && jog.current.active) void jog.current.stop().catch(() => {}); },
    onBlur: () => { if (jog.current.active) void jog.current.stop().catch(() => {}); },
    onContextMenu: e => e.preventDefault(),
  });
  const mapId = committedMapId(detail);
  const mapTitle = 'Bản đồ vật cản LiDAR' + (mapId ? ' · đã lưu' : terminalJobs.has(detail?.job.status) ? ' · phiên đã kết thúc' : session?.state === 'MAPPING' ? ' · đang quét' : jobId ? ' · đang chờ phiên quét' : '');
  const savedMapAction = detail?.job.status === 'SUCCEEDED' && mapId && onMapSaved ? <section className="ro-card ro-saved-map-action" role="status">
    <span className="ro-badge">Đã lưu map thành công</span>
    <h3>Sẵn sàng cấu hình bản đồ</h3>
    <p>Dùng map vừa quét để vẽ vùng hoạt động, sau đó đặt các điểm đích cho robot.</p>
    <button className="primary" onClick={() => onMapSaved(mapId)}>Vẽ Zone trên map này →</button>
  </section> : null;
  const autoReport = session?.autonomy, autoOwned = autonomy.current.active || !!autoReport?.control_selected;
  const autoBlock = autonomyBlock(current.current);
  const autonomyPanel = <section className="ro-card ro-autonomy-card" aria-label="Tự động quét bản đồ"><div className="ro-section-heading"><h3>Tự động quét bản đồ</h3><span className="ro-badge">{autoReport?.exploration_mode === 'frontier' ? 'Tìm vùng chưa quét' : 'Tránh vật cản'}</span></div>
    <p>Pi tự tìm đường theo cấu hình và LiDAR. Hết thời gian không có nghĩa đã quét hết bản đồ.</p>
    <Field label="Giới hạn tự quét (giây)"><input type="number" min="10" max={Math.min(600, Number(autoReport?.profile_max_duration_sec) || 600)} step="1" value={autoSeconds} disabled={autoOwned || busy} onChange={e => setAutoSeconds(e.target.value)} /></Field>
    <label className="ro-check"><input type="checkbox" checked={autoReport?.exploration_mode === 'frontier' ? false : autoReturn} disabled={autoOwned || busy || autoReport?.exploration_mode === 'frontier'} onChange={e => setAutoReturn(e.target.checked)} />Dừng khi quay về gần điểm đầu sau khi đã đi đủ quãng đường</label>
    <label className="ro-check"><input type="checkbox" checked={autoSave} disabled={autoOwned || busy} onChange={e => setAutoSave(e.target.checked)} />Lưu và kết thúc khi hoàn tất, hết thời gian hoặc quay về điểm đầu</label>
    <div className="ro-actions"><button type="button" className="primary" disabled={!!autoBlock || autoOwned || busy || jog.current.active} onClick={startAutonomy}>Bắt đầu tự quét</button><button type="button" disabled={!session?.potentially_open || busy} onClick={() => void stopAutonomy()}>Dừng tự quét</button></div>
    {autoBlock && <p className="ro-help">{autoBlock}</p>}<p role="status">{autoMessage}</p>
    {autoReport && <div className="ro-auto-report"><span>Trạng thái <strong>{({ IDLE: 'Chờ', RUNNING: 'Đang chạy', STOPPED: 'Đã dừng', COMPLETED: 'Hoàn tất', FAILED: 'Lỗi' })[autoReport.state] || autoReport.state || 'Đang cập nhật'}</strong></span><span>Thời gian <strong>{Number.isFinite(autoReport.elapsed_sec) ? Math.round(autoReport.elapsed_sec) + ' giây' : '—'}</strong></span><span>Quãng đường <strong>{Number.isFinite(autoReport.travel_m) ? autoReport.travel_m.toFixed(2) + ' m' : '—'}</strong></span><span>Độ phủ <strong>{autoReport.coverage_complete ? 'Đã xác nhận vùng tiếp cận được' : 'Chưa xác nhận hoàn tất'}</strong></span></div>}
    {autoReport?.control_selected && !autonomy.current.active && <p className="ro-help">Pi vẫn giữ quyền tự quét. Bấm Dừng tự quét và chờ phản hồi trước khi điều khiển tay.</p>}
    {autoReport && <details className="ro-details"><summary>Thông tin tự quét từ Pi</summary><pre>{JSON.stringify({ observedAt: session.motionObservedAt, ...autoReport }, null, 2)}</pre></details>}
  </section>;
  const drivePanel = <section className="ro-card ro-drive-card"><h3>Di chuyển khi quét</h3><p>Giữ nút để di chuyển, nhả để dừng. Tự dừng khi hết thời gian đã chọn.</p><div className="ro-fields"><Field label="Tốc độ tiến"><select value={speed} disabled={jog.current.active} onChange={e => setSpeed(e.target.value)}><option value="0.05">0,05 m/s</option><option value="0.08">0,08 m/s</option><option value="0.10">0,10 m/s</option><option value="0.15">0,15 m/s</option><option value="0.20">0,20 m/s</option><option value="0.25">0,25 m/s</option><option value="0.30">0,30 m/s</option></select></Field><Field label="Thời gian tối đa (giây)"><input type="number" min="0.4" max="10" step="0.2" value={seconds} disabled={jog.current.active} onChange={e => setSeconds(e.target.value)} /></Field></div>
    <Field label="Tốc độ quay"><select value={turnSpeed} disabled={jog.current.active} onChange={e => setTurnSpeed(e.target.value)}>{[0.20, 0.35, 0.45, 0.50, 0.80, 1.00].map(value => <option key={value} value={value.toFixed(2)}>{value.toFixed(2).replace('.', ',')} rad/s</option>)}</select></Field>
    <div className="ro-drive ro-drive-pad" aria-label="Điều khiển robot quét bản đồ">
      <button className="ro-forward" disabled={!!block || busy} {...handlers(Number(speed), 0)}>↑ Tiến</button>
      <button className="ro-left" disabled={!!block || busy} {...handlers(0, Number(turnSpeed))}>↶ Quay trái</button>
      <button className="stop" disabled={!session?.potentially_open} onClick={() => void jog.current.stop().catch(() => {})}>Dừng di chuyển</button>
      <button className="ro-right" disabled={!!block || busy} {...handlers(0, -Number(turnSpeed))}>Quay phải ↷</button>
      <button className="ro-backward" disabled={!!block || busy} {...handlers(-Number(speed), 0)}>↓ Lùi</button>
    </div>
    {block && <p className="ro-help">{block}</p>}<MotionStatus session={session}/><p role="status">{jogMessage}</p>{receipt && <p className="ro-status">{receiptLabels[receipt.status] || 'Đang cập nhật phản hồi'}</p>}<small>Quan sát camera khi di chuyển. Lùi cần profile Pi cho phép và LiDAR phía sau sẵn sàng. Tốc độ thực tế được giới hạn theo cấu hình Pi.</small>
    {receipt?.errorCode && <details><summary>Chi tiết phản hồi</summary><p>{receipt.errorCode}</p></details>}
    <div className="ro-actions"><button className="primary" disabled={!!saveBlock || busy || jog.current.active} onClick={() => save()}>Lưu bản đồ và kết thúc</button>{saving && tracking?.saveEvent && <button disabled={busy || !!movementBlock({ ...current.current, manual: false, saving: false })} onClick={() => save(true)}>Gửi lại yêu cầu lưu đã tạo</button>}</div>{saving && actionError && <p className="ro-help">Chưa xác nhận được yêu cầu lưu. Tải lại trạng thái; nếu phiên vẫn đang quét, có thể gửi lại cùng yêu cầu ở trên.</p>}<p className="ro-muted">Chờ máy chủ xác nhận hoàn tất. Pi cần được cấu hình tải bản đồ lên máy chủ.</p>
  </section>;
  return <section className={'ro-workspace' + (embedded ? ' ro-embedded' : '')} aria-label="Quét bằng robot thật">
    {!embedded && <header className="ro-card ro-hero"><div><span className="ro-badge">Robot thật · Dữ liệu máy chủ</span><h2>Quét bản đồ</h2><p>Chọn robot, theo dõi camera và điều khiển trong phiên quét.</p></div></header>}
    {!operator ? <p className="ro-help">Chỉ quản trị viên đăng nhập thật được tạo phiên quét và điều khiển robot.</p> : <>
      <ErrorNotice error={catalogError} />
      <details className="ro-card ro-setup" open={setupOpen} onToggle={event=>setSetupOpen(event.currentTarget.open)}>
        <summary className="ro-setup-summary"><span className="ro-setup-copy"><strong>Chi tiết quét map mới</strong><small title={setupSummary}>{setupSummary}</small></span><span className="ro-setup-toggle"><span>{setupOpen?'Ẩn chi tiết':'Hiện chi tiết'}</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg></span></summary>
        <div className="ro-setup-content"><p className="ro-setup-intro">Thiết lập thông tin phiên quét. Camera và bản đồ LiDAR cập nhật bên dưới.</p>{loading && <p role="status">Đang tải robot, tầng và quy trình…</p>}
        <form onSubmit={create}><fieldset disabled={busy || loading || Boolean(activeJob)}><div className="ro-fields">
          <Picker label="Robot" value={robotId} onChange={id => { track(null); setRobotId(id); }} items={catalog.robots} idKey="robotId" nameKey="robotName" empty="Chưa có robot trên máy chủ" />
          <Picker label="Tầng" value={floorId} onChange={setFloorId} items={catalog.floors} idKey="floorId" nameKey="floorName" empty="Chưa có tầng đang hoạt động" />
          <Field label="Tên bản đồ"><input required maxLength={160} value={mapName} onChange={e => setMapName(e.target.value)} /></Field>
          <Picker label="Quy trình quét đã phát hành" value={workflowId} onChange={setWorkflowId} items={catalog.workflows} idKey="workflowId" nameKey="workflowName" empty="Chưa có quy trình quét phù hợp" />
        </div></fieldset><div className="ro-actions"><button type="submit" className="primary" disabled={busy || loading || !!activeJob || !ready || snapshot?.robot?.status !== 'IDLE' || !robotId || !floorId || !workflowId || !mapName.trim() || uncertain}>Tạo nhiệm vụ quét</button>{robotId && <small>{ready ? (snapshot.robot?.status === 'IDLE' ? 'Robot sẵn sàng' : 'Robot đang có công việc hoặc chưa rảnh') : 'Chưa có Pi sẵn sàng kết nối'}</small>}</div></form>
        {!loading && (!catalog.robots.length || !catalog.floors.length || !catalog.workflows.length) && <p className="ro-help">Cần robot đã đăng ký, tầng đang hoạt động và quy trình quét đã phát hành. Kiểm tra mục Trạng thái robot, Danh mục bệnh viện và Quản lý quy trình.</p>}
        <div className="ro-actions"><button type="button" disabled={busy || !!activeJob} onClick={prepare}>Chuẩn bị quy trình quét và lưu</button></div>{prepareMessage && <p role="status">{prepareMessage}</p>}
        {uncertain && <p className="ro-error">Chưa xác nhận được việc tạo nhiệm vụ. Tải lại danh sách bên dưới và chọn nhiệm vụ đã tạo; không gửi lặp lại.</p>}
        <details className="ro-details"><summary>Tiếp tục phiên quét trước</summary><div className="ro-actions"><Field label="Tiếp tục theo dõi phiên quét"><select value={jobId} disabled={busy || jog.current.active || autoOwned} onChange={e => { const value = recent.find(j => j.jobId === e.target.value); if (value) track({ jobId: value.jobId, robotId, floorId: value.inputJson.floor_id, mapName: value.inputJson.map_name, workflowId: value.workflowId }); }}><option value="">Chọn phiên quét gần đây</option>{jobId && !recent.some(j => j.jobId === jobId) && <option value={jobId}>Phiên đang theo dõi</option>}{recent.map(j => <option key={j.jobId} value={j.jobId}>{j.inputJson.map_name} · {new Date(j.queuedAt).toLocaleString('vi-VN')}</option>)}</select></Field></div><ErrorNotice error={recentError} /></details>
        </div>
       </details>
      <ErrorNotice error={error} />
      <ErrorNotice error={actionError} />
      <div className="ro-actions ro-session-actions"><button disabled={busy || jog.current.active || autonomy.current.active} onClick={() => { reload(); setRevision(v => v + 1); }}>Tải lại trạng thái</button>{jobId && !activeJob && <button disabled={busy} onClick={() => {track(null);setSetupOpen(true);}}>Thiết lập phiên mới</button>}</div>
      <div className="ro-columns"><div className="ro-stack">{jobId&&<JobStatus detail={detail} session={session} saving={saving} />}<MappingMapPanel title={mapTitle}>{mapId ? <SavedMappingImage key={mapId} mapId={mapId} /> : detail?.job.status === 'SUCCEEDED' ? <p className="ro-help">Nhiệm vụ đã kết thúc nhưng chưa có mã bản đồ đăng ký. Kiểm tra bước COMMIT_MAP_ARTIFACT.</p> : <SnapshotImage jobId={jobId} kind="map" enabled={!!session && !!checkedAt && !error} />}<p className="ro-muted">Ảnh bản đồ do robot gửi về qua BE.</p></MappingMapPanel><MappingRecoveryPanel jobId={jobId} required={detail?.job.status === 'RECOVERY_REQUIRED'} busy={busy} stop={async () => { if (autonomy.current.active) await autonomy.current.stop(); if (jog.current.active) await jog.current.stop(); }} onRecovered={() => { autoSavePending.current = null; setSaving(false); setRevision(v => v + 1); }} /></div><aside className="ro-stack"><Camera jobId={jobId} enabled={!!session && !!checkedAt && !error} />{savedMapAction}{autonomyPanel}{drivePanel}</aside></div>
    </>}
  </section>;
}
