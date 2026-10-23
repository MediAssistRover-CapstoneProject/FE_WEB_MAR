import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { workflowApi } from '../../features/workflows/workflowApi.js';
import { loadAllPages } from '../../features/workflows/patrolWorkflowModel.js';
import { getDesign, localMapCatalog, localPatrolPlan, mergeLocalDesigns } from '../../features/workflows/localPatrolDesign.js';
import { samplePlan } from '../Workstations/mapDispatchModel.js';
import { formatDuration } from './patrolModel.js';
import LidarMap from './LidarMap.jsx';
import './patrol.css';

const Button = ({ children, primary, ...props }) => <button type="button" className={primary ? 'patrol-primary' : undefined} {...props}>{children}</button>;

export default function PatrolRoutesFigma() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const workflowId = search.get('workflowId') || '';
  const [workflows, setWorkflows] = useState([]);
  const [saved, setSaved] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [startId, setStartId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [simState, setSimState] = useState('ready');
  const [simSpeed, setSimSpeed] = useState(1);
  const reset = () => { setSimState('ready'); setElapsed(0); };

  useEffect(() => {
    const update = () => { reset(); setRefresh(value => value + 1); };
    window.addEventListener('storage', update);
    window.addEventListener('focus', update);
    window.addEventListener('mediassist-map-saved', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update); window.removeEventListener('mediassist-map-saved', update); };
  }, []);

  useEffect(() => {
    let current = true;
    setCatalogError('');
    const patrols = items => mergeLocalDesigns(items).filter(item => item.serviceType === 'PATROL' && item.status !== 'ARCHIVED');
    try {
      const catalog = localMapCatalog();
      setSaved(catalog.saved);
      setStartId(previous => catalog.endpoints.some(point => point.endpointId === previous) ? previous : catalog.endpoints.find(point => point.active && point.accessible)?.endpointId || '');
      setWorkflows(patrols([]));
    } catch (cause) { setCatalogError(cause.message); }
    loadAllPages(workflowApi.list).then(items => { if (current) setWorkflows(patrols(items)); })
      .catch(cause => { if (current) setCatalogError('Không tải được quy trình máy chủ. Bạn vẫn có thể dùng tuyến đã lưu trên thiết bị. ' + cause.message); });
    return () => { current = false; };
  }, [refresh]);

  useEffect(() => {
    let current = true;
    setDetail(null); reset(); setError(''); setLoading(!!workflowId);
    if (workflowId) getDesign(workflowId, workflowApi.get).then(value => {
      if (!current) return;
      if (value.workflow.serviceType !== 'PATROL') throw new Error('Quy trình này không phải tuyến tuần tra. Hãy chọn tuyến khác.');
      setDetail(value);
    }).catch(cause => { if (current) setError(cause.message || 'Không đọc được quy trình.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [workflowId, refresh]);

  const plan = useMemo(() => detail?.workflow.workflowId === workflowId ? localPatrolPlan(detail, saved, startId) : null, [detail, workflowId, saved, startId]);
  const runnable = !!plan?.valid && !loading;
  const done = runnable && simState !== 'ready' && elapsed >= plan.duration;
  const sample = runnable ? samplePlan(plan, elapsed) : null;
  const progress = runnable && plan.duration ? Math.min(1, elapsed / plan.duration) : done ? 1 : 0;
  const edit = () => navigate(workflowId ? '/workflows?workflowId=' + encodeURIComponent(workflowId) : '/workflows');

  useEffect(() => {
    if (!runnable || simState !== 'running' || done) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(); const delta = (now - previous) / 1000; previous = now;
      setElapsed(value => Math.min(plan.duration, value + delta * simSpeed));
    }, 50);
    return () => window.clearInterval(timer);
  }, [runnable, simState, done, plan?.duration, simSpeed]);

  return <section className="patrol-workspace patrol-deployment">
    <header className="patrol-banner"><div><h2>Tuần tra</h2><p>Chọn quy trình, xem các điểm trên bản đồ đã lưu và chạy thử hành trình.</p></div><div className="patrol-actions"><Button onClick={() => navigate('/workflows')}>Thiết kế quy trình</Button><Button onClick={() => { reset(); setRefresh(value => value + 1); }}>Tải lại</Button></div></header>
    {catalogError && <p className="patrol-notice" role="status">{catalogError}</p>}
    {error && <p className="patrol-notice is-error" role="alert">{error}</p>}
    <div className="patrol-deployment-layout">
      <section className="patrol-panel patrol-deployment-controls">
        <h3>Quy trình & điểm đi qua</h3>
        <label className="patrol-field">Quy trình tuần tra<select value={workflows.some(item => item.workflowId === workflowId) ? workflowId : ''} onChange={event => { reset(); const next = new URLSearchParams(search); if (event.target.value) next.set('workflowId', event.target.value); else next.delete('workflowId'); setSearch(next, { replace: true }); }}><option value="">Chọn tuyến tuần tra đã lưu</option>{workflows.map(item => <option key={item.workflowId} value={item.workflowId}>{item.workflowName} · v{item.versionNo}{item.localOnly ? '' : ' · Cần chọn điểm cục bộ'}</option>)}</select></label>
        {!workflows.length && <p>Chưa có quy trình tuần tra. Tạo quy trình với mục đích “Tuyến tuần tra”, chọn các điểm đích và lưu.</p>}
        <p className="patrol-map-note">Thứ tự lấy từ các bước MOVE trong Quy trình. Không tạo thêm bộ điểm đích riêng.</p>
        {detail && <Button onClick={edit}>Sửa điểm đích trong Quy trình →</Button>}
        <label className="patrol-field">Điểm xuất phát chạy thử<select value={startId} onChange={event => { reset(); setStartId(event.target.value); }}><option value="">Chọn điểm xuất phát</option>{saved?.snapshot.endpoints.map(point => <option key={point.id} value={point.id} disabled={point.enabled === false || point.accessible === false}>{point.name}</option>)}</select></label>
        <p className="patrol-map-note">Điểm xuất phát chỉ đặt vị trí robot mô phỏng; không thay đổi thứ tự MOVE.</p>
        <h3>Thứ tự ghé thăm</h3>
        {loading ? <p role="status">Đang đọc quy trình…</p> : plan?.points.length ? <ol className="patrol-route-timeline">{plan.points.map(({ step, endpoint }, index) => <li key={step.stepId}><span>{index + 1}</span><div><strong>{endpoint?.name || 'Cần chọn lại điểm đích'}</strong><small>Di chuyển · {step.paramsJson?.max_speed_mps} m/s</small></div></li>)}</ol> : <p>Chọn quy trình để xem các điểm đi qua.</p>}
        <p className="patrol-map-note">Tuyến lưu trên thiết bị này. Chạy thử không gửi lệnh robot và không tạo lịch chạy thật.</p>
      </section>
      <section className="patrol-panel patrol-route-preview patrol-preview">
        <h3>Xem trước hành trình</h3>
        <div className="patrol-summary"><div><small>Điểm tuần tra</small><strong>{plan?.points.length || 0} điểm</strong></div><div><small>Quãng đường ước tính</small><strong>{runnable ? plan.distance.toFixed(2) + ' m' : 'Chưa xác định'}</strong></div><div><small>Thời gian ước tính</small><strong>{runnable ? formatDuration(plan.duration) : 'Chưa xác định'}</strong></div></div>
        {plan?.issues.length > 0 && <div className="patrol-notice is-error" role="alert"><strong>Cần kiểm tra tuyến</strong><ul>{plan.issues.map(issue => <li key={issue}>{issue}</li>)}</ul><Button onClick={edit}>Chọn lại điểm trong Quy trình</Button></div>}
        {saved ? <LidarMap draft={saved.snapshot} stage="endpoint" simulation={runnable ? { path: plan.path, point: sample?.point || saved.snapshot.endpoints.find(point => point.id === startId) } : undefined} overlay={<g pointerEvents="none">{plan?.points.map(({ endpoint }, index) => endpoint && <g key={index} transform={'translate(' + endpoint.x + ' ' + (endpoint.y - 25 - index * 3) + ')'}><circle r="10" fill="#2563eb" stroke="white"/><text textAnchor="middle" y="4" fill="white" fontSize="12">{index + 1}</text></g>)}</g>} /> : <div className="patrol-empty"><h3>Chưa có bản đồ đã lưu</h3><p>Mở Bản đồ, lưu bản quét và các điểm đích để dùng chung với Điều phối và Tuần tra.</p><Button onClick={() => navigate('/admin?screen=Map+Studio')}>Mở Bản đồ</Button></div>}
        <div className="patrol-simulation-summary"><div><small>Trạng thái</small><strong>{done ? 'Hoàn tất mô phỏng' : { ready: 'Chưa chạy', running: 'Đang mô phỏng', paused: 'Đã tạm dừng' }[simState]}</strong></div><div><small>Điểm đang hướng đến</small><strong>{runnable ? plan.points[sample?.stopIndex ?? 0]?.endpoint?.name || '—' : '—'}</strong></div><div><small>Tiến độ</small><strong>{Math.round(progress * 100)}%</strong></div></div>
        <progress className="patrol-progress" value={progress} max="1" aria-label="Tiến độ mô phỏng" />
        <div className="patrol-actions"><Button primary disabled={!runnable || (simState === 'running' && !done)} onClick={() => { if (done) setElapsed(0); setSimState('running'); }}>{simState === 'paused' ? 'Tiếp tục mô phỏng' : 'Chạy mô phỏng'}</Button><Button disabled={simState !== 'running' || done} onClick={() => setSimState('paused')}>Tạm dừng</Button><Button disabled={!plan} onClick={reset}>Đặt lại</Button><label className="patrol-speed-label">Tốc độ xem<select value={simSpeed} onChange={event => setSimSpeed(Number(event.target.value))}>{[1, 2, 5].map(value => <option key={value} value={value}>{value}×</option>)}</select></label></div>
        <p className="patrol-map-note">Dùng lại bản đồ, vùng cấm và vùng giới hạn tốc độ đã lưu. Đường đi và thời gian là kết quả mô phỏng, chưa được kiểm chứng trên robot.</p>
      </section>
    </div>
  </section>;
}
