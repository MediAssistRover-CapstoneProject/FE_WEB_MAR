import { useState } from 'react';

export default function SimulationCamera() {
  const [url, setUrl] = useState(import.meta.env.VITE_ROBOT_CAMERA_URL || '');
  const [source, setSource] = useState(null);
  const [status, setStatus] = useState('');
  const [loaded, setLoaded] = useState(false);

  function connect(event) {
    event.preventDefault();
    try {
      const parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      setLoaded(false);
      setStatus('Đang kết nối camera…');
      setSource({ url: parsed.href, key: Date.now() });
    } catch {
      setStatus('Nhập URL HTTP hoặc HTTPS của luồng camera.');
    }
  }

  return <>
    <div className="ls-camera">
      {source && <img key={source.key} src={source.url}
        alt="Camera phía trước robot thật"
        style={{ objectFit: 'contain', visibility: loaded ? 'visible' : 'hidden' }}
        onLoad={() => { if (source) { setLoaded(true); setStatus('Đã nhận hình từ camera robot.'); } }}
        onError={() => { if (source) { setLoaded(false); setStatus('Không tải được camera. Kiểm tra URL, nguồn phát và kết nối mạng tới robot.'); } }} />}
      {!loaded && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, color: '#cbd5e1', textAlign: 'center' }}>
        <strong>{source ? 'Chưa nhận được hình camera' : 'Chưa kết nối camera'}</strong>
        <span style={{ fontSize: 11 }}>{source ? 'Kiểm tra nguồn phát và trạng thái kết nối bên dưới.' : 'Nhập URL bên dưới để xem camera robot thật.'}</span>
      </div>}
      {loaded && <span className="ls-camera-badge live">CAMERA ROBOT</span>}
    </div>
    <form onSubmit={connect} style={{ marginTop: 12 }}>
      <label className="ls-field" style={{ display: 'grid', gap: 6 }}>URL camera robot
        <input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="http://IP_ROBOT:8080/stream" style={{ width: '100%', minWidth: 0, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
      </label>
      <div className="ls-actions">
        <button className="ls-btn primary" type="submit">{source ? 'Kết nối lại' : 'Kết nối camera'}</button>
        {source && <button className="ls-btn" type="button" onClick={() => { setSource(null); setLoaded(false); setStatus('Đã ngắt camera.'); }}>Ngắt kết nối</button>}
      </div>
    </form>
    {status && <p role="status">{status}</p>}
    <p>Dùng URL luồng MJPEG hoặc ảnh trực tiếp qua HTTP/HTTPS, máy mở web cần truy cập được robot. Camera này hiển thị hình thật; bản đồ và điều khiển vẫn ở chế độ mô phỏng.</p>
  </>;
}
