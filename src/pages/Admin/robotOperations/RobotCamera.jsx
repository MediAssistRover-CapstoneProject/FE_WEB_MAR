import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession } from '../../../features/auth/session.js';
import { acquireRobotCamera, configuredCameraUrl } from '../../../features/media/robotCameraClient.js';
import './robotCamera.css';

export default function RobotCamera({ robotId, variant = 'monitor', fallback = null }) {
  const container = useRef(null), video = useRef(null), lease = useRef(null);
  const [paused, setPaused] = useState(false), [playing, setPlaying] = useState(false), [stale, setStale] = useState(false), [playBlocked, setPlayBlocked] = useState(false);
  const [state, setState] = useState({ robotId, phase: 'connecting', track: null, message: 'Đang kết nối camera robot…' });
  const [legacy, setLegacy] = useState(configuredCameraUrl), [legacyFailed, setLegacyFailed] = useState(false);
  const session = getSession(), account = session?.account;
  const authorized = session?.mode !== 'demo' && !!session?.tokens?.accessToken && !!account?.accountId && ['ADMIN', 'STAFF'].includes(account.role);
  const current = state.robotId === robotId ? state : { phase: 'connecting', track: null, message: 'Đang kết nối camera robot…' };
  useEffect(() => {
    setState({ robotId, phase: 'connecting', track: null, message: 'Đang kết nối camera robot…' });
    if (!robotId || paused || !authorized) return;
    const active = acquireRobotCamera(robotId, { accountId: account.accountId, role: account.role }, value => setState({ ...value, robotId }));
    lease.current = active;
    return () => { active.release(); if (lease.current === active) lease.current = null; };
  }, [robotId, paused, authorized, account?.accountId, account?.role]);
  useEffect(() => {
    const update = () => { setLegacy(configuredCameraUrl()); setLegacyFailed(false); };
    window.addEventListener('storage', update); window.addEventListener('mediassist-camera-settings', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('mediassist-camera-settings', update); };
  }, []);
  useEffect(() => {
    const track = current.track, element = video.current;
    setPlaying(false); setStale(false); setPlayBlocked(false);
    if (!track || !element || paused) return;
    let alive = true, frameHandle, lastFrame = 0, previousTime = -1;
    track.attach(element);
    element.play().catch(() => { if (alive) setPlayBlocked(true); });
    const frame = () => {
      if (!alive) return;
      lastFrame = performance.now(); setPlaying(true); setPlayBlocked(false);
      frameHandle = element.requestVideoFrameCallback(frame);
    };
    if (element.requestVideoFrameCallback) frameHandle = element.requestVideoFrameCallback(frame);
    const timer = setInterval(() => {
      if (!element.requestVideoFrameCallback && element.currentTime !== previousTime && element.readyState >= 2) {
        previousTime = element.currentTime; lastFrame = performance.now(); setPlaying(true);
      }
      setStale(lastFrame > 0 && performance.now() - lastFrame > 5000);
    }, 1000);
    return () => {
      alive = false; clearInterval(timer);
      if (frameHandle !== undefined) element.cancelVideoFrameCallback?.(frameHandle);
      track.detach(element); element.srcObject = null;
    };
  }, [current.track, paused]);
  const canFallback = !paused && robotId && ['unavailable', 'error'].includes(current.phase);
  const useLegacy = canFallback && legacy && !legacyFailed;
  const live = !paused && playing && !stale && current.phase === 'live';
  const message = !robotId ? 'Chọn robot để xem camera.' : paused ? 'Đã ngừng xem camera.'
    : !authorized ? 'Đăng nhập tài khoản có quyền để xem camera robot.'
    : stale ? 'Camera chưa có khung hình mới. Đang chờ robot gửi lại.'
    : current.phase === 'live' && !playing ? 'Đang chờ khung hình đầu tiên từ camera…' : current.message;
  return <section className={`rc-camera-card ${variant === 'mapping' ? 'ro-card' : 'rm-card'}`} ref={container} aria-label="Camera robot">
    <header className="rc-heading"><h3>Camera robot</h3><span className={live ? 'rc-live' : 'rc-waiting'}>{paused ? 'Đã ngừng xem' : live ? 'Trực tiếp' : useLegacy ? 'Video dự phòng' : 'Đang chờ'}</span><button type="button" aria-label="Phóng lớn camera" onClick={() => container.current?.requestFullscreen?.().catch(() => {})}>⛶</button></header>
    <div className="rc-video">
      <video ref={video} autoPlay muted playsInline aria-label="Camera trực tiếp của robot" hidden={!current.track || paused} />
      {useLegacy && <img src={legacy} alt="Nguồn video dự phòng đã cấu hình" onError={() => setLegacyFailed(true)} />}
      {!live && !useLegacy && <div className="rc-placeholder" role="status"><span aria-hidden="true">▣</span><p>{message}</p>{playBlocked && <button onClick={() => video.current?.play().then(() => setPlayBlocked(false)).catch(() => setPlayBlocked(true))}>Phát camera</button>}</div>}
    </div>
    {canFallback && !useLegacy && fallback && <div className="rc-fallback">{fallback}</div>}
    <footer><small>{live ? 'Camera từ robot đang chọn' : message}</small><div>{robotId && authorized && <><button type="button" disabled={current.phase === 'connecting' && !paused} onClick={() => { if (paused) setPaused(false); else lease.current?.retry(); }}>{paused ? 'Mở camera' : 'Kết nối lại'}</button>{!paused && <button type="button" onClick={() => setPaused(true)}>Ngừng xem</button>}</>}</div></footer>
    {canFallback && <details className="rc-options"><summary>Nguồn video dự phòng</summary><p>Camera trực tiếp tự kết nối qua máy chủ. Có thể cấu hình URL riêng khi cần xem video cùng mạng với Pi.</p><Link to="/admin/system-settings?tab=robot-camera">Cài đặt nguồn video dự phòng →</Link></details>}
  </section>;
}
