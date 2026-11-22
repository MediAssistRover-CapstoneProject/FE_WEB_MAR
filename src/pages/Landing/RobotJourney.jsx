import { useEffect, useRef, useState } from 'react';
import robotImage from '../../assets/images/mentorpi-m1.png';
import './robotJourney.css';

function PauseIcon({ paused }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paused ? <path d="m9 5 11 7-11 7V5Z" /> : <><path d="M8 5v14M16 5v14" /></>}
  </svg>;
}

export default function RobotJourney() {
  const host = useRef(null), engine = useRef(null);
  const [renderer, setRenderer] = useState('loading');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pausedRef = useRef(paused);
  const [viewMode, setViewMode] = useState('overview');
  const [status, setStatus] = useState({ name: 'Phòng khám', stationIndex: 1, moving: true });
  useEffect(() => {
    let cancelled = false;
    import('./robotJourneyScene.js').then(({ createRobotJourney }) => {
      if (cancelled || !host.current) return;
      engine.current = createRobotJourney(host.current, {
        paused: pausedRef.current,
        onStatus: value => { if (!cancelled) setStatus(value); },
        onReady: () => { if (!cancelled) setRenderer('webgl'); },
        onUnavailable: () => { if (!cancelled) setRenderer('fallback'); },
      });
    }).catch(() => { if (!cancelled) setRenderer('fallback'); });
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null; };
  }, []);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (preference.matches) { pausedRef.current = true; engine.current?.setPaused(true); setPaused(true); }
    };
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);
  const toggle = () => {
    const next = !pausedRef.current; pausedRef.current = next;
    engine.current?.setPaused(next); setPaused(next);
  };
  const switchView = mode => {
    setViewMode(mode);
    engine.current?.setViewMode(mode);
  };
  return <figure className="lp-journey" data-renderer={renderer} aria-label="Hành trình mô phỏng của MediAssistRover">
    <div className="lp-journey-heading">
      <div><span className="lp-journey-eyebrow">MỘT HÀNH TRÌNH, NHIỀU KẾT NỐI</span><h2>Bệnh viện luôn chuyển động.</h2></div>
      <div className="lp-journey-modes" role="group" aria-label="Chế độ góc nhìn 3D">
        <button type="button" className={viewMode === 'overview' ? 'is-active' : ''} onClick={() => switchView('overview')} disabled={renderer !== 'webgl'}>Toàn cảnh</button>
        <button type="button" className={viewMode === 'follow' ? 'is-active' : ''} onClick={() => switchView('follow')} disabled={renderer !== 'webgl'}>Cận cảnh</button>
      </div>
    </div>
    <div className="lp-journey-viewport">
      <div className="lp-journey-canvas" ref={host} />
      {renderer !== 'webgl' && <div className="lp-journey-fallback">
        <img src={robotImage} alt="Robot MediAssistRover với bốn bánh mecanum, camera và LiDAR" />
        <span>{renderer === 'loading' ? 'Đang chuẩn bị hành trình…' : 'MediAssistRover · Kết nối các khoa phòng'}</span>
      </div>}
      <span className="lp-journey-floor">TẦNG 01 <span>/</span> MEDIASSIST HOSPITAL</span>
      {renderer === 'webgl' && <span className="lp-journey-hint">{viewMode === 'follow' ? 'Đang theo sát MentorPi M1' : 'Kéo để đổi góc nhìn'}</span>}
    </div>
    <figcaption className="lp-journey-footer">
      <div className="lp-journey-status"><span className={`lp-journey-indicator${paused ? ' is-paused' : ''}`} aria-hidden="true" />
        <div><small>{renderer === 'fallback' ? 'Robot dịch vụ bệnh viện' : paused ? 'Hành trình đang tạm dừng' : status.moving ? 'Di chuyển theo tuyến' : 'Đã đến điểm giao nhận'}</small>
          <span data-testid="journey-status">{renderer === 'fallback' ? 'Sẵn sàng cho mỗi chuyến đi' : status.name}</span></div>
      </div>
      <div className="lp-journey-controls">
        <button type="button" onClick={toggle} disabled={renderer !== 'webgl'} aria-label={paused ? 'Tiếp tục mô phỏng' : 'Tạm dừng mô phỏng'} title={paused ? 'Tiếp tục mô phỏng' : 'Tạm dừng mô phỏng'}><PauseIcon paused={paused} /></button>
        <button type="button" onClick={() => engine.current?.reset()} disabled={renderer !== 'webgl'} aria-label="Chạy lại hành trình" title="Chạy lại hành trình"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></svg></button>
      </div>
    </figcaption>
  </figure>;
}
