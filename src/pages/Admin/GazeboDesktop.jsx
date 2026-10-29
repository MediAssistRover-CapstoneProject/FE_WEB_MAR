import { useEffect, useRef, useState } from 'react';

const GAZEBO_URL = import.meta.env.VITE_GAZEBO_GUI_URL || 'http://localhost:6080/vnc.html?autoconnect=1&resize=scale';

export default function GazeboDesktop({ onStop, canStop }) {
  const host = useRef(null);
  const expand = useRef(null);
  const [wide, setWide] = useState(false);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [hint, setHint] = useState('Đang tải desktop Gazebo trong Docker…');

  useEffect(() => {
    setLoaded(false);
    setHint('Đang tải desktop Gazebo trong Docker…');
    const id = setTimeout(() => {
      setHint('Nếu màn hình trống: kiểm tra container mô phỏng (cổng 6080) và bấm "Kết nối lại".');
    }, 10000);
    return () => clearTimeout(id);
  }, [version]);

  useEffect(() => {
    if (!wide) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = e => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        setWide(false);
        expand.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', key);
    };
  }, [wide]);

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await host.current.requestFullscreen();
    } catch {
      setWide(true);
    }
  };

  return (
    <section ref={host} className={'gazebo-desktop' + (wide ? ' gazebo-desktop-expanded' : '')} aria-label="Màn hình mô phỏng Gazebo 3D">
      <div className="gazebo-desktop-bar">
        <div>
          <strong>Gazebo 3D Simulation</strong>
          <small>Mô phỏng robot và thế giới vật lý trực tiếp trong Docker</small>
        </div>

        <div className="gazebo-window-actions">
          <button disabled={!canStop} onClick={onStop}>Dừng hành trình</button>
          <button onClick={() => setVersion(v => v + 1)}>Kết nối lại</button>
          <button onClick={fullscreen}>Toàn màn hình</button>
          <button ref={expand} aria-expanded={wide} onClick={() => setWide(v => !v)}>
            {wide ? 'Thu lại' : 'Mở rộng'}
          </button>
          <a
            href={GAZEBO_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#243b55',
              border: '1px solid #69809c',
              color: '#60a5fa',
              textDecoration: 'none',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            Mở tab riêng ↗
          </a>
        </div>
      </div>

      {!loaded && <p role="status">{hint}</p>}

      <iframe
        key={version}
        title="Gazebo 3D trực tiếp"
        src={GAZEBO_URL}
        allow="fullscreen"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setHint('Không kết nối được Gazebo. Kiểm tra container mô phỏng.');
        }}
      />

      <p style={{ margin: 0, padding: '8px 14px', fontSize: '12px', color: '#94a3b8' }}>
        Trạng thái kết nối hiển thị trong noVNC. Nhấp vào màn hình mô phỏng để xoay và phóng to/thu nhỏ robot.
      </p>
    </section>
  );
}
