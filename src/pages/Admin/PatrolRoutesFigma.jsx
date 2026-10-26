import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { workflowApi } from '../../features/workflows/workflowApi.js';
import { loadAllPages } from '../../features/workflows/patrolWorkflowModel.js';
import { getDesign, localMapCatalog, localPatrolPlan, mergeLocalDesigns } from '../../features/workflows/localPatrolDesign.js';
import './patrol.css';

const GazeboPanel = lazy(() => import('./GazeboPanel.jsx'));

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
  const [viewMode, setViewMode] = useState('2d');
  const reset = () => {};

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
  const edit = () => navigate(workflowId ? '/workflow?workflowId=' + encodeURIComponent(workflowId) : '/workflow');


  return <section className="patrol-workspace patrol-deployment">
    <header className="patrol-banner"><div><h2>Tuần tra</h2><p>Chọn quy trình, xem các điểm trên bản đồ đã lưu và chạy thử hành trình.</p></div><div className="patrol-actions"><Button onClick={() => navigate('/workflow')}>Thiết kế quy trình</Button><Button onClick={() => { reset(); setRefresh(value => value + 1); }}>Tải lại</Button></div></header>
    {catalogError && <p className="patrol-notice" role="status">{catalogError}</p>}
    {error && <p className="patrol-notice is-error" role="alert">{error}</p>}
    <div className="patrol-deployment-layout">
      <section className="patrol-panel patrol-deployment-controls">
        <h3>Quy trình & điểm đi qua</h3>
        <label className="patrol-field">Quy trình tuần tra<select value={workflows.some(item => item.workflowId === workflowId) ? workflowId : ''} onChange={event => { reset(); const next = new URLSearchParams(search); if (event.target.value) next.set('workflowId', event.target.value); else next.delete('workflowId'); setSearch(next, { replace: true }); }}><option value="">Chọn tuyến tuần tra đã lưu</option>{workflows.map(item => <option key={item.workflowId} value={item.workflowId}>{item.workflowName} · v{item.versionNo}{item.localOnly ? '' : ' · Cần chọn điểm cục bộ'}</option>)}</select></label>
        {!workflows.length && <p>Chưa có quy trình tuần tra. Tạo quy trình với mục đích “Tuyến tuần tra”, chọn các điểm đích và lưu.</p>}
        <p className="patrol-map-note">Thứ tự lấy từ các bước MOVE trong Quy trình. Không tạo thêm bộ điểm đích riêng.</p>
        {detail && <Button onClick={edit}>Sửa điểm đích trong Quy trình →</Button>}
        <p className="patrol-map-note">Xuất phát tại vị trí robot đang được ROS định vị; chọn điểm đích trong các bước MOVE.</p>
        <h3>Thứ tự ghé thăm</h3>
        {loading ? <p role="status">Đang đọc quy trình…</p> : plan?.points.length ? <ol className="patrol-route-timeline">{plan.points.map(({ step, endpoint }, index) => <li key={step.stepId}><span>{index + 1}</span><div><strong>{endpoint?.name || 'Cần chọn lại điểm đích'}</strong><small>Di chuyển · {step.paramsJson?.max_speed_mps} m/s</small></div></li>)}</ol> : <p>Chọn quy trình để xem các điểm đi qua.</p>}
        <p className="patrol-map-note">Tuyến lưu trên thiết bị này. Chọn Gazebo để gửi các điểm MOVE tới bộ mô phỏng Docker.</p>
      </section>
      <section className="patrol-panel patrol-route-preview patrol-preview">
        <div className="patrol-view-heading"><h3>Xem trước hành trình</h3><div className="patrol-view-switch" role="group" aria-label="Chế độ xem hành trình"><Button aria-pressed={viewMode === '2d'} onClick={() => setViewMode('2d')}>Bản đồ 2D</Button><Button aria-pressed={viewMode === '3d'} onClick={() => setViewMode('3d')}>Mô phỏng 3D</Button><Button aria-pressed={viewMode === 'gazebo'} onClick={() => { reset(); setViewMode('gazebo'); }}>Gazebo</Button></div></div>
        <Suspense fallback={<p>Đang mở mô phỏng…</p>}><GazeboPanel key={workflowId} map={saved?.snapshot} plan={plan} viewMode={viewMode}/></Suspense>
      </section>
    </div>
  </section>;
}
