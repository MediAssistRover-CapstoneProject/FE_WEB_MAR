import { useEffect, useMemo, useRef, useState } from 'react';
import PatrolThreePreview from './PatrolThreePreview.jsx';
import './gazebo.css';
import { bridgeUrl, downloadGazeboMap, fromRosPoint, gazeboManifest, routeRequest } from '../../features/gazebo/gazeboModel.js';

const labels = { IDLE: 'Sẵn sàng', STARTING: 'Đang gửi điểm đích', RUNNING: 'Đang di chuyển', CANCELING: 'Đang yêu cầu dừng', CANCELED: 'Đã hủy hành trình', SUCCEEDED: 'Đã đến tất cả điểm đích', FAILED: 'Không hoàn thành hành trình' };

export default function GazeboPanel({ map, plan }) {
  const [address, setAddress] = useState(import.meta.env.VITE_GAZEBO_BRIDGE_URL || 'http://localhost:8765');
  const [token, setToken] = useState('');
  const [connection, setConnection] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingRun, setPendingRun] = useState(null);
  const active = useRef(null);
  const commandAbort = useRef(null);
  const runId = useRef(null);

  useEffect(() => {
    let current = true; setManifest(null);
    gazeboManifest(map).then(value => { if (current) setManifest(value); }).catch(cause => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, [map]);

  useEffect(() => {
    if (!connection || !manifest) { setState(null); setPendingRun(null); return; }
    let current = true, timer;
    const controller = new AbortController();
    active.current = connection; setState(null); setError(''); setBusy(false);
    const cancel = () => {
      if (runId.current) fetch(connection.url + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Simulation-Key': connection.token }, body: JSON.stringify({ runId: runId.current }), keepalive: true }).catch(() => {});
    };
    const poll = async () => {
      try {
        const response = await fetch(connection.url + '/state', { headers: { 'X-Simulation-Key': connection.token, 'X-Simulation-Run': runId.current || '' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2500)]) });
        const value = await response.json();
        if (!response.ok) throw Error(value.error || 'Cầu nối từ chối kết nối.');
        if (value.protocol !== 'mar-gazebo-v1' || value.simulation !== true) throw Error('Địa chỉ này không phải cầu nối Gazebo của dự án.');
        if (value.mapKey !== manifest.mapKey) throw Error('Bản đồ Gazebo khác bản đồ FE. Tải lại gói bản đồ và khởi động lại bộ mô phỏng.');
        if (current) { setState(value); setPendingRun(id => id === value.runId ? null : id); setError(''); }
      } catch (cause) {
        if (current) { setState(null); setError(cause.name === 'TimeoutError' ? 'Gazebo không phản hồi. Hành trình sẽ bị hủy khi hết thời gian kết nối.' : cause.message); cancel(); }
      } finally { if (current) timer = setTimeout(poll, 500); }
    };
    const hide = () => { if (document.hidden) { cancel(); setConnection(null); } };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', cancel);
    poll();
    return () => {
      current = false; clearTimeout(timer); controller.abort(); commandAbort.current?.abort(); cancel(); active.current = null; runId.current = null;
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', cancel);
    };
  }, [connection, manifest]);

  const execute = async (path, data) => {
    const selected = active.current; if (!selected) return;
    setBusy(true); setError('');
    const controller = new AbortController(); commandAbort.current = controller;
    try {
      const response = await fetch(selected.url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Simulation-Key': selected.token }, body: JSON.stringify(data), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Không gửi được yêu cầu.');
      // 202 only acknowledges receipt. Progress comes from Nav2 results.
      if (path === '/run') setState(value => value ? { ...value, status: 'STARTING' } : value);
    } catch (cause) { if (!controller.signal.aborted) { setError(cause.message); setPendingRun(null); } }
    finally { if (active.current === selected) setBusy(false); }
  };
  const moving = !!pendingRun || ['STARTING', 'RUNNING', 'CANCELING'].includes(state?.status);
  const pathKey = JSON.stringify(state?.path || []);
  const renderPlan = useMemo(() => ({ points: plan?.points || [], path: JSON.parse(pathKey).map(fromRosPoint).filter(Boolean) }), [plan, pathKey]);
  const pose = state?.poseFresh ? fromRosPoint(state.pose) : null;
  return <div className="gazebo-panel">
    <p className="patrol-notice">Gazebo chạy trong Ubuntu. Khung này hiển thị cùng mặt bằng và vị trí nhận từ ROS. Rover trên web là hình minh họa; mô hình vật lý trong bộ mẫu là TurtleBot3.</p>
    <details open={!connection} className="gazebo-setup"><summary>Kết nối bộ mô phỏng</summary>
      <label className="patrol-field">Địa chỉ Ubuntu<input type="url" value={address} disabled={!!connection} onChange={event => setAddress(event.target.value)} placeholder="http://IP_UBUNTU:8765" /></label>
      <label className="patrol-field">Mã kết nối hiện trong terminal Ubuntu<input type="password" autoComplete="off" value={token} disabled={!!connection} onChange={event => setToken(event.target.value)} /></label>
      <div className="patrol-actions"><button disabled={!!connection || !manifest || !token.trim()} onClick={() => { try { setConnection({ url: bridgeUrl(address.trim()), token: token.trim() }); } catch (cause) { setError(cause.message); } }}>Kết nối Gazebo</button><button disabled={!connection} onClick={() => setConnection(null)}>Ngắt kết nối</button><button onClick={() => downloadGazeboMap(map).catch(cause => setError(cause.message))}>Tải bản đồ cho Gazebo</button></div>
      <p className="patrol-map-note">Hướng dẫn cài và chạy: FE_WEB_MAR/gazebo/README.vi.md. Mã kết nối chỉ giữ trong trang này.</p>
    </details>
    {error && <p className="patrol-notice is-error" role="alert">{error}</p>}
    {!!plan?.issues?.length && <div className="patrol-notice is-error"><strong>Cần kiểm tra quy trình</strong><ul>{plan.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <div className={'patrol-readiness ' + (state?.ready ? 'is-ready' : '')} role="status"><strong>{state ? labels[state.status] || state.status : connection ? 'Đang chờ Gazebo' : 'Chưa kết nối Gazebo'}</strong><span>{state?.reason || (state?.ready ? 'Đã kết nối ROS và đúng phiên bản bản đồ.' : 'Mở Ubuntu, chạy bộ mô phỏng và cầu nối trước khi gửi quy trình.')}</span>{state?.message && <span>{state.message}</span>}</div>
    <PatrolThreePreview map={map} plan={renderPlan} position={pose} />
    <div className="patrol-simulation-summary"><div><small>Vị trí từ ROS</small><strong>{pose ? `${state.pose.x.toFixed(2)}, ${state.pose.y.toFixed(2)} m` : 'Chưa có vị trí mới'}</strong></div><div><small>Điểm đã hoàn thành</small><strong>{state?.completed || 0}/{state?.total || 0}</strong></div><div><small>Điểm đang đến</small><strong>{state?.targetName || '—'}</strong></div></div>
    <div className="patrol-actions"><button className="patrol-primary" disabled={!connection || !state?.ready || !plan?.valid || moving || busy} onClick={() => { try { const id = crypto.randomUUID(); const request = routeRequest(plan, manifest, id); runId.current = id; setPendingRun(id); execute('/run', request); } catch (cause) { setError(cause.message); } }}>Chạy quy trình trên Gazebo</button><button disabled={!connection || (!moving && !busy)} onClick={() => execute('/cancel', { runId: runId.current })}>Dừng hành trình Gazebo</button></div>
    <p className="patrol-map-note">Bắt đầu tại vị trí robot trong Gazebo. Nav2 tìm đường tới từng điểm MOVE. Tốc độ giới hạn bằng mức thấp nhất của bước và các vùng tốc độ. Đổi màn hình hoặc mất kết nối sẽ yêu cầu hủy hành trình.</p>
  </div>;
}
