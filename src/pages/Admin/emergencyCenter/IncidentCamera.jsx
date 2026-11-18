import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../../features/api/client.js';
import { getSession } from '../../../features/auth/session.js';
import { IncidentCameraConnection, activeFallReview } from '../../../features/media/incidentCamera.js';
import { canReviewIncident, isFallIncident } from '../../../features/operations/emergencyCenter.js';

function RemoteTrack({ track, audio = false, onFresh }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    let alive = true, frameHandle, lastFrame = 0, previousTime = -1, fresh = false;
    const updateFresh = value => { if (fresh !== value) { fresh = value; onFresh?.(value); } };
    track.attach(element);
    element.play().catch(() => {});
    const frame = () => {
      if (!alive) return;
      lastFrame = performance.now(); updateFresh(true);
      frameHandle = element.requestVideoFrameCallback(frame);
    };
    if (!audio && element.requestVideoFrameCallback) frameHandle = element.requestVideoFrameCallback(frame);
    const timer = !audio && setInterval(() => {
      if (!element.requestVideoFrameCallback && element.currentTime !== previousTime && element.readyState >= 2) {
        previousTime = element.currentTime; lastFrame = performance.now(); updateFresh(true);
      }
      if (lastFrame && performance.now() - lastFrame > 5000) updateFresh(false);
    }, 1000);
    return () => {
      alive = false; clearInterval(timer);
      if (frameHandle !== undefined) element.cancelVideoFrameCallback?.(frameHandle);
      track.detach(element); element.srcObject = null;
    };
  }, [track, audio, onFresh]);
  return audio ? <audio ref={ref} autoPlay controls aria-label="Âm thanh từ robot" />
    : <video ref={ref} autoPlay playsInline muted aria-label="Camera trực tiếp của sự cố" />;
}

export default function IncidentCamera({ incident, account, onChange }) {
  const [enabled, setEnabled] = useState(false), [attempt, setAttempt] = useState(0), [media, setMedia] = useState(null);
  const connection = useRef(null), change = useRef(onChange); change.current = onChange;
  const videoFresh = useCallback(value => connection.current?.emit({ videoFresh: value }), []);
  const fall = isFallIncident(incident), allowed = canReviewIncident(incident, account);
  const active = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status);
  useEffect(() => {
    if (!enabled || !allowed || !active) { setMedia(null); change.current(null); return; }
    const request = (path, options = {}) => {
      if (getSession()?.account?.accountId !== account.accountId) return Promise.reject(Error('Tài khoản đăng nhập đã thay đổi.'));
      const timeout = AbortSignal.timeout(15000);
      return apiRequest(path, { ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout });
    };
    const camera = new IncidentCameraConnection({ incident, account, request, loadSdk: () => import('livekit-client'),
      onChange: value => { setMedia(value); change.current(value); } });
    connection.current = camera; camera.start();
    const stop = () => camera.stop();
    window.addEventListener('pagehide', stop); window.addEventListener('mediassist-session-expired', stop);
    return () => { window.removeEventListener('pagehide', stop); window.removeEventListener('mediassist-session-expired', stop); connection.current = null; change.current(null); camera.stop(); };
  }, [enabled, attempt, incident.incidentId, incident.robotId, account.accountId, allowed, active]);
  const ready = activeFallReview(media, incident, account);
  return <section className="ec-camera" aria-label={fall ? 'Camera xác minh té ngã' : 'Cuộc gọi hỗ trợ SOS'}>
    <header><div><span className="ec-eyebrow">{fall ? 'XÁC MINH TÌNH HUỐNG' : 'KẾT NỐI HỖ TRỢ'}</span><h4>{fall ? 'Camera xác minh té ngã' : 'Cuộc gọi hỗ trợ SOS'}</h4></div><span className={`ec-camera-state ${ready || !fall && media?.phase === 'live' && media.videoFresh ? 'is-live' : ''}`}><i />{ready || !fall && media?.phase === 'live' && media.videoFresh ? 'Trực tiếp' : 'Chưa có hình trực tiếp'}</span></header>
    <div className="ec-camera-view">{media?.track ? <><RemoteTrack track={media.track} onFresh={videoFresh} />{(!media.videoFresh || media.phase !== 'live') && <div className="ec-camera-overlay" role="status">Chưa có khung hình mới. Tạm khóa xác nhận.</div>}</> : <div className="ec-camera-placeholder"><span aria-hidden="true">◉</span><strong>{!active ? 'Sự cố đã kết thúc' : !allowed ? 'Phiên camera dành cho người có quyền xử lý' : enabled ? media?.message || 'Đang kết nối camera…' : fall ? 'Mở camera để kiểm tra dấu hiệu nghi té ngã' : 'Kết nối với robot để hỗ trợ người gọi'}</strong><p>{fall ? 'Hình trực tiếp phản ánh tình huống hiện tại. Ảnh và clip lúc phát hiện nằm trong phần bằng chứng.' : 'Camera và âm thanh sẽ được kết nối khi bạn mở phiên hỗ trợ.'}</p></div>}</div>
    <div className="ec-camera-controls">{active && allowed && <>{!enabled ? <button className="ec-button ec-primary" onClick={() => setEnabled(true)}>{fall ? 'Mở camera xác minh' : 'Kết nối hỗ trợ SOS'}</button> : <><button className="ec-button" onClick={() => setEnabled(false)}>Ngắt camera</button>{['error', 'ended'].includes(media?.phase) && <button className="ec-button ec-primary" onClick={() => setAttempt(value => value + 1)}>Kết nối lại</button>}{!fall && media?.track && <button className={`ec-button ${media?.micEnabled ? 'is-enabled' : ''}`} aria-pressed={media?.micEnabled || false} onClick={() => connection.current?.toggleMicrophone()}>{media?.micEnabled ? 'Tắt micro' : 'Bật micro trao đổi'}</button>}</>}</>}
      {enabled && <p role="status">{media?.message || 'Đang kết nối camera…'}</p>}
    </div>
    {media?.audioTracks?.map(track => <RemoteTrack key={track.sid} track={track} audio />)}
    {fall && active && <p className="ec-camera-guidance">{ready ? 'Camera đã kết nối. Sau khi kiểm tra, bạn có thể xác nhận cần hỗ trợ.' : 'Chỉ xác nhận khi camera của đúng sự cố đã kết nối. Nếu không xem được, giữ cảnh báo và kiểm tra trực tiếp.'}</p>}
  </section>;
}
