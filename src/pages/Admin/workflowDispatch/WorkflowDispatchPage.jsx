import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSession } from '../../../features/auth/session.js';
import { API_BASE_URL } from '../../../features/api/client.js';
import { allFacilityPages, facilityApi } from '../../../features/facility/facilityApi.js';
import { operationsApi } from '../../../features/operations/operationsApi.js';
import { newerJob, statusInfo } from '../../../features/operations/liveOperations.js';
import { workflowApi } from '../../../features/workflows/workflowApi.js';
import { dispatchApi } from '../../../features/workflows/dispatchApi.js';
import { dispatchInputErrors, dispatchVariables, newDispatch, resumeDispatch, serviceLabels, updateDispatchValue } from '../../../features/workflows/dispatchModel.js';
import DispatchInputs from './DispatchInputs.jsx';
import { JobDetail } from '../liveOperations/LiveOperationsPage.jsx';
import './workflowDispatch.css';

const emptyCatalog = { workflows: [], robots: [], maps: [], endpoints: [], rooms: [] };
const robotLabel = robot => robot?.robotName || robot?.robotCode || 'Chưa phân robot';
const robotStatus = { IDLE: 'Sẵn sàng', BUSY: 'Đang bận', OFFLINE: 'Mất kết nối', ERROR: 'Có lỗi', CHARGING: 'Đang sạc', MAINTENANCE: 'Bảo trì' };
function DispatchIcon({ name = 'workflow', className = '' }) {
  const paths = {
    workflow: <><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="15" y="15" width="6" height="6" rx="1.5" /><path d="M6 9v7a2 2 0 0 0 2 2h7M9 6h7a2 2 0 0 1 2 2v7" /></>,
    robot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    launch: <><path d="M14 4h6v6M20 4l-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9v1" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
    activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  };
  return <svg className={'wd-icon ' + className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.workflow}</svg>;
}
function restore(key) {
  try { const value = JSON.parse(sessionStorage.getItem(key)); return value?.code && value?.body?.workflowId && value?.body?.scheduleCode === value.code ? value : null; }
  catch { return null; }
}
function Badge({ status }) {
  const info = statusInfo(status);
  return <span className={'wd-badge wd-' + info.tone}>{info.label}</span>;
}

export default function WorkflowDispatchPage() {
  const session = getSession();
  if (session?.account?.role !== 'ADMIN') return <section className="wd-page"><h2>Điều phối quy trình</h2><p>Trang này dành cho quản trị viên.</p><Link to="/admin/live-operations">Mở vận hành trực tiếp</Link></section>;
  return <DispatchWorkspace key={API_BASE_URL + ':' + session.account.accountId} session={session} />;
}

function DispatchWorkspace({ session }) {
  const [params, setParams] = useSearchParams();
  const storageKey = `mediassist.workflow-dispatch.v1:${API_BASE_URL}:${session.account.accountId}`;
  const [attempt, setAttempt] = useState(() => restore(storageKey));
  const [workflowId, setWorkflowId] = useState(() => params.get('workflowId') || restore(storageKey)?.body.workflowId || '');
  const [catalog, setCatalog] = useState(emptyCatalog), [loading, setLoading] = useState(true), [catalogError, setCatalogError] = useState(''), [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('');
  const [inputs, setInputs] = useState({}), [rooms, setRooms] = useState({}), [jsonErrors, setJsonErrors] = useState({}), [errors, setErrors] = useState({});
  const [robotId, setRobotId] = useState(() => attempt?.body.robotId || ''), [priority, setPriority] = useState(() => attempt?.body.priority ?? 50), [search, setSearch] = useState(''), [service, setService] = useState('');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const [jobs, setJobs] = useState([]), [jobsError, setJobsError] = useState(''), [tracked, setTracked] = useState(null), [monitored, setMonitored] = useState(null), [receivedAt, setReceivedAt] = useState(null), [toast, setToast] = useState('');
  const lock = useRef(false), currentAttempt = useRef(attempt), mounted = useRef(true), inputWorkflowId = useRef('');
  const canDispatch = session.mode !== 'demo';
  const workflow = detail?.workflow;
  const variables = dispatchVariables(workflow);
  const robot = catalog.robots.find(item => item.robotId === robotId);
  const integrate = useCallback(snapshot => {
    setMonitored(previous => previous?.jobId === snapshot.job.jobId ? newerJob(previous, snapshot.job) : previous);
    setTracked(previous => previous?.jobId === snapshot.job.jobId ? newerJob(previous, snapshot.job) : previous);
    setJobs(previous => previous.map(job => job.jobId === snapshot.job.jobId ? newerJob(job, snapshot.job) : job));
  }, []);
  const operationSaved = useCallback(message => { setToast(message); setRevision(value => value + 1); }, []);
  const persist = value => {
    currentAttempt.current = value;
    if (mounted.current) setAttempt(value);
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey);
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const linkedId = params.get('workflowId') || '';
    if (!attempt && !lock.current && linkedId !== workflowId) setWorkflowId(linkedId);
  }, [params, attempt, workflowId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setCatalogError('');
    Promise.all([allFacilityPages(workflowApi.listPublished), allFacilityPages(workflowApi.listRobots), allFacilityPages(facilityApi.listMaps), allFacilityPages(facilityApi.listEndpoints), allFacilityPages(facilityApi.listRooms)])
      .then(([workflows, robots, maps, endpoints, rooms]) => { if (active) setCatalog({ workflows, robots, maps, endpoints, rooms }); })
      .catch(error => { if (active) setCatalogError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    let active = true;
    setDetail(null); setDetailError(''); setReview(false);
    if (inputWorkflowId.current !== workflowId) {
      inputWorkflowId.current = '';
      setInputs({}); setRooms({}); setJsonErrors({}); setErrors({});
    }
    if (!workflowId) { setDetailLoading(false); return; }
    setDetailLoading(true);
    dispatchApi.getWorkflow(workflowId).then(value => {
      if (!active) return;
      if (value?.workflow?.workflowId !== workflowId || value.workflow.status !== 'PUBLISHED' || value.workflow.acceptsNewJobs === false) throw new Error('Quy trình không còn nhận nhiệm vụ mới.');
      if (value.workflow.inputUiJson?.deliveryDraft?.runtimeReady === false) throw new Error(value.workflow.inputUiJson.deliveryDraft.notice || 'Quy trình giao hàng này chưa được tích hợp để chạy trên robot.');
      setDetail(value);
      if (inputWorkflowId.current !== workflowId) {
        const pending = currentAttempt.current;
        setInputs(structuredClone(pending?.body.workflowId === workflowId ? pending.body.inputTemplateJson : value.workflow.defaultInputsJson ?? {}));
        inputWorkflowId.current = workflowId;
      }
    }).catch(error => { if (active) setDetailError(error.message); }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [workflowId, revision]);

  useEffect(() => {
    let active = true, reading = false;
    async function refresh() {
      if (reading) return;
      reading = true;
      try {
        const response = await operationsApi.listJobs({ page: 0, size: 12 });
        if (!Array.isArray(response?.content)) throw new Error('Chưa đọc được danh sách nhiệm vụ.');
        if (!active) return;
        setJobs(previous => {
          const known = new Map(previous.map(job => [job.jobId, job]));
          return response.content.map(job => newerJob(known.get(job.jobId), job));
        });
        setReceivedAt(new Date()); setJobsError('');
        const pending = currentAttempt.current;
        if (pending?.scheduleId) {
          const matching = response.content.find(job => job.scheduleId === pending.scheduleId) || (await allFacilityPages(p => operationsApi.listJobs({ ...p, workflowId: pending.body.workflowId, from: pending.createdAt }))).find(job => job.scheduleId === pending.scheduleId);
          if (matching && active) {
            setTracked(previous => newerJob(previous, matching));
            setMonitored(previous => !previous || previous.scheduleId === pending.scheduleId ? newerJob(previous, matching) : previous);
          }
        }
      } catch (error) { if (active) setJobsError(error.message); }
      finally { reading = false; }
    }
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [revision, attempt?.scheduleId]);

  useEffect(() => {
    if (!review) return;
    const close = event => { if (event.key === 'Escape' && !lock.current) setReview(false); };
    const previous = document.activeElement;
    const dialog = document.getElementById('wd-review');
    const buttons = () => [...dialog.querySelectorAll('button:not(:disabled)')];
    const trap = event => {
      if (event.key !== 'Tab') return;
      const items = buttons(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    buttons()[0]?.focus(); document.addEventListener('keydown', close); dialog.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', close); dialog.removeEventListener('keydown', trap); previous?.focus(); };
  }, [review]);

  function selectWorkflow(id) {
    if (lock.current || attempt) return;
    setWorkflowId(id); setRobotId(''); setActionError('');
    const next = new URLSearchParams(params); next.set('workflowId', id); setParams(next, { replace: true });
  }
  function validate() {
    const next = { ...dispatchInputErrors(workflow, inputs, catalog) };
    Object.keys(jsonErrors).forEach(key => { if (jsonErrors[key] !== undefined) next[key] = 'JSON chưa hợp lệ.'; });
    if (robotId && (!robot || robot.status !== 'IDLE')) next.robot = 'Chọn robot đang sẵn sàng hoặc để máy chủ tự phân.';
    const maps = variables.filter(field => field.kind === 'map').map(field => inputs[field.key]).filter(Boolean);
    if (robotId && maps.length && maps.some(id => id !== robot.currentMapId)) next.robot = 'Robot ưu tiên cần ở cùng bản đồ với nhiệm vụ.';
    setErrors(next);
    return !Object.keys(next).length;
  }
  const update = (variable, value, raw) => {
    setInputs(previous => updateDispatchValue(workflow, previous, variable, value));
    setJsonErrors(previous => ({ ...previous, [variable.key]: raw })); setErrors({});
    if (variable.kind === 'map') setRooms({});
  };
  async function submit() {
    if (lock.current || !canDispatch || getSession()?.account?.role !== 'ADMIN') return;
    if (!currentAttempt.current && (!workflow || !validate())) { setReview(false); return; }
    lock.current = true; setBusy(true); setActionError('');
    try {
      let value = currentAttempt.current;
      if (!value) {
        value = newDispatch(workflow, robotId, inputs, priority, crypto.randomUUID());
        persist(value); // Persist identity before any write, including before an uncertain response.
      }
      await resumeDispatch(value, dispatchApi, persist);
      if (mounted.current) { setReview(false); setRevision(previous => previous + 1); }
    } catch (error) { if (mounted.current) setActionError(error.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function abandon() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setActionError('');
    try {
      const value = currentAttempt.current;
      const schedule = value.scheduleId ? await dispatchApi.get(value.scheduleId) : await dispatchApi.find(value.code);
      if (schedule && schedule.status !== 'PAUSED') throw new Error('Lượt này đã được kích hoạt. Theo dõi nhiệm vụ trước khi tạo lượt mới.');
      if (schedule) await operationsApi.retireSchedule(schedule.scheduleId);
      persist(null); setReview(false);
    } catch (error) { if (mounted.current) setActionError(error.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function nextDispatch() {
    if (lock.current) return;
    try { persist(null); setTracked(null); setMonitored(null); setActionError(''); setReview(false); setRevision(value => value + 1); }
    catch (error) { setActionError(error.message); }
  }
  const visible = catalog.workflows.filter(item => (!service || item.serviceType === service) && `${item.workflowName} ${item.workflowCode}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  const submitted = attempt && ['ACTIVE', 'RETIRED'].includes(attempt.status);
  const disabled = busy || !!attempt;
  const jobLink = job => '/admin/live-operations?jobId=' + encodeURIComponent(job.jobId);
  const renderValue = (variable, value) => variable.kind === 'map' ? catalog.maps.find(item => item.mapId === value)?.mapName || value : variable.kind === 'endpoint' ? catalog.endpoints.find(item => item.endpointId === value)?.endpointName || value : typeof value === 'boolean' ? value ? 'Có' : 'Không' : typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'Chưa nhập');

  return <section className="wd-page">
    <header className="wd-heading"><div className="wd-heading-copy"><span className="wd-eyebrow"><DispatchIcon />TRUNG TÂM ĐIỀU PHỐI</span><h2>Gọi quy trình.<br /><span>Giao việc cho robot.</span></h2><p>Chọn quy trình đã phát hành, điền thông tin và theo dõi từng lượt thực hiện.</p></div><div className="wd-actions"><Link className="wd-button" to="/admin/live-operations"><DispatchIcon name="activity" />Vận hành trực tiếp ↗</Link><button className="wd-button" disabled={busy || !!attempt && !submitted} onClick={() => setRevision(value => value + 1)}><DispatchIcon name="refresh" />Làm mới</button></div></header>
    <div className="wd-stats"><div className="wd-stat-card"><span className="wd-stat-icon"><DispatchIcon /></span><div><span>Quy trình có thể gọi</span><strong>{catalog.workflows.length}</strong></div><small className="wd-stat-caption">Đã phát hành</small></div><div className="wd-stat-card"><span className="wd-stat-icon wd-stat-icon-green"><DispatchIcon name="robot" /></span><div><span>Robot sẵn sàng</span><strong>{catalog.robots.filter(item => item.status === 'IDLE').length}<small> / {catalog.robots.length}</small></strong></div><small className="wd-stat-caption"><i />Có thể nhận việc</small></div><div className="wd-process"><span>BA BƯỚC ĐỂ BẮT ĐẦU</span><div><span><b>1</b>Chọn</span><DispatchIcon name="arrow" /><span><b>2</b>Cấu hình</span><DispatchIcon name="arrow" /><span><b>3</b>Chạy</span></div></div></div>
    {catalogError && <div className="wd-error" role="alert">Không tải được danh mục: {catalogError} <button className="wd-button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>}
    {!canDispatch && <p className="wd-error" role="alert">Đăng nhập tài khoản quản trị viên để điều phối robot.</p>}
    {attempt && <section className="wd-pending" aria-label="Lượt điều phối hiện tại"><div><span className="wd-eyebrow">{tracked ? 'NHIỆM VỤ ĐÃ TẠO' : submitted ? 'ĐÃ GỬI ĐIỀU PHỐI' : 'YÊU CẦU CHƯA HOÀN TẤT'}</span><h3>{attempt.workflowName}</h3><p>{tracked ? `${tracked.jobCode} · ${robotLabel(catalog.robots.find(item => item.robotId === tracked.robotId))}` : submitted ? 'Máy chủ đã nhận lượt chạy. Đang chờ nhiệm vụ xuất hiện trong hàng đợi.' : 'Yêu cầu được giữ lại để kiểm tra và tiếp tục cùng một lượt chạy.'}</p>{tracked && <Badge status={tracked.status} />}</div><div className="wd-actions">{tracked && <Link className="wd-button primary" to={jobLink(tracked)}>Theo dõi & điều khiển ↗</Link>}{submitted || tracked ? <button className="wd-button" disabled={busy} onClick={nextDispatch}>Tạo lượt điều phối mới</button> : <><button className="wd-button primary" disabled={busy || !canDispatch} onClick={submit}>{busy ? 'Đang kiểm tra…' : 'Tiếp tục yêu cầu này'}</button><button className="wd-button" disabled={busy || !canDispatch} onClick={abandon}>Hủy lượt chưa chạy</button></>}</div></section>}
    {actionError && <div className="wd-error" role="alert">{actionError}</div>}
    {toast && <p className="wd-operation-toast" role="status">{toast}</p>}
    {monitored && <section id="wd-monitor" className="lo-page wd-inline-monitor" aria-label="Điều khiển nhiệm vụ tại đây"><div className="wd-monitor-title"><h3><DispatchIcon name="activity" />Theo dõi & điều khiển nhiệm vụ</h3><Link to={jobLink(monitored)}>Mở vận hành đầy đủ ↗</Link></div><JobDetail key={monitored.jobId} job={monitored} catalogs={{ ...catalog, requests: [] }} role="ADMIN" auto manualRevision={revision} integrate={integrate} onSaved={operationSaved} /></section>}
    <div className="wd-layout">
      <aside className="wd-panel wd-library" aria-label="Chọn quy trình"><div className="wd-panel-title"><span className="wd-step">01</span><div><h3>Chọn quy trình</h3><p>Thư viện sẵn sàng thực hiện</p></div><span className="wd-count">{visible.length}</span></div><div className="wd-search-wrap"><DispatchIcon name="search" /><input className="wd-search" aria-label="Tìm quy trình" placeholder="Tìm quy trình…" value={search} onChange={event => setSearch(event.target.value)} /></div><select className="wd-search" aria-label="Loại quy trình" value={service} onChange={event => setService(event.target.value)}><option value="">Tất cả loại quy trình</option>{[...new Set(catalog.workflows.map(item => item.serviceType))].map(type => <option value={type} key={type}>{serviceLabels[type] || type}</option>)}</select>
        {loading && <p role="status">Đang tải quy trình…</p>}{!loading && !catalogError && !visible.length && <div className="wd-empty"><strong>{search || service ? 'Không tìm thấy quy trình' : 'Chưa có quy trình đã phát hành'}</strong><p>Phát hành quy trình trong trang thiết kế để gọi tại đây.</p><Link to="/workflow">Mở thiết kế quy trình ↗</Link></div>}
        <div className="wd-workflow-list">{visible.map(item => <button className={'wd-workflow-card' + (item.workflowId === workflowId ? ' selected' : '')} key={item.workflowId} aria-pressed={item.workflowId === workflowId} disabled={disabled || loading || !!catalogError} onClick={() => selectWorkflow(item.workflowId)}><span className="wd-card-top"><span className="wd-card-symbol"><DispatchIcon name={item.serviceType === 'ROBOT_TEST' ? 'robot' : 'workflow'} /></span><span className="wd-card-type">{serviceLabels[item.serviceType] || item.serviceType}</span><span className="wd-card-version">v{item.versionNo}</span><span className="wd-card-check">{item.workflowId === workflowId && <DispatchIcon name="check" />}</span></span><strong>{item.workflowName}</strong><p>{item.description || 'Chọn để cấu hình lượt chạy.'}</p><span className="wd-card-footer"><small>{item.workflowCode}</small><span><i />Đã phát hành</span></span></button>)}</div>
      </aside>
      <section className="wd-panel wd-config" aria-label="Cấu hình nhiệm vụ"><div className="wd-panel-title"><span className="wd-step">02</span><div><h3>Cấu hình nhiệm vụ</h3><p>Chuẩn bị thông tin cho lượt chạy mới</p></div><span className="wd-panel-symbol"><DispatchIcon name="robot" /></span></div>{detailLoading ? <p role="status">Đang tải đầu vào quy trình…</p> : detailError ? <div className="wd-error" role="alert">{detailError}<button className="wd-button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : workflow ? <>
        <div className="wd-selected-title"><span className="wd-selected-icon"><DispatchIcon /></span><div><span className="wd-selected-meta">{serviceLabels[workflow.serviceType] || workflow.serviceType} <i /> Phiên bản {workflow.versionNo}</span><h3>{workflow.workflowName}</h3><p>{workflow.description}</p></div></div>
        <div className="wd-assignment"><label>Robot ưu tiên<select aria-label="Robot ưu tiên" value={robotId} disabled={disabled || loading || !!catalogError} onChange={event => { setRobotId(event.target.value); setErrors({}); }}><option value="">Tự động phân robot</option>{catalog.robots.map(item => <option value={item.robotId} key={item.robotId} disabled={item.status !== 'IDLE'}>{robotLabel(item)} · {robotStatus[item.status] || item.status}</option>)}</select></label><label>Mức ưu tiên<select aria-label="Mức ưu tiên" value={priority} disabled={disabled} onChange={event => setPriority(Number(event.target.value))}><option value={25}>Thấp</option><option value={50}>Bình thường</option><option value={75}>Cao</option></select></label></div>
        <p className="wd-assignment-note"><DispatchIcon name="info" /><span>Máy chủ kiểm tra khả dụng và phân robot khi chạy. Robot ưu tiên có thể được thay bằng robot khác nếu không đáp ứng điều kiện.</span></p>{errors.robot && <p role="alert" className="wd-field-error">{errors.robot}</p>}
        <div className="wd-fields-heading"><h4>Thông tin cho lượt chạy</h4><span>* Trường bắt buộc</span></div><DispatchInputs workflow={workflow} values={inputs} rooms={rooms} setRooms={setRooms} catalog={catalog} errors={errors} jsonErrors={jsonErrors} onChange={update} disabled={disabled || loading || !!catalogError} />
        <footer className="wd-form-footer"><p><DispatchIcon name="info" />Mỗi lần xác nhận tạo một lượt chạy quy trình.</p><button className="wd-button primary" disabled={disabled || loading || !!catalogError || !canDispatch} onClick={() => { setActionError(''); if (validate()) setReview(true); }}>Xem lại & điều phối →</button></footer>
      </> : <div className="wd-empty wd-start"><span className="wd-empty-symbol"><DispatchIcon /></span><span className="wd-empty-caption">SẴN SÀNG KHI BẠN CẦN</span><h3>Bắt đầu từ một quy trình</h3><p>Chọn giao hàng, di chuyển hoặc bất kỳ quy trình đã phát hành ở danh sách bên trái.</p><span className="wd-empty-direction"><DispatchIcon name="arrow" />Chọn một quy trình để tiếp tục</span></div>}</section>
    </div>
    <section className="wd-panel wd-recent" aria-label="Nhiệm vụ gần đây"><div className="wd-panel-title"><div><h3>Nhiệm vụ gần đây</h3><p>{receivedAt ? 'Cập nhật lúc ' + receivedAt.toLocaleTimeString('vi-VN') + ' · Tự làm mới mỗi 5 giây' : 'Đang tải nhiệm vụ…'}</p></div><Link to="/admin/live-operations">Xem tất cả ↗</Link></div>{jobsError && <p role="alert" className="wd-error">Chưa cập nhật được nhiệm vụ: {jobsError}</p>}<div className="wd-job-list">{jobs.map(job => <button className="wd-job" key={job.jobId} onClick={() => { setMonitored(job); setToast(''); document.getElementById('wd-monitor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><div><strong>{catalog.workflows.find(item => item.workflowId === job.workflowId)?.workflowName || job.jobCode}</strong><small>{job.jobCode} · {robotLabel(catalog.robots.find(item => item.robotId === job.robotId))}</small></div><Badge status={job.status} /><span aria-hidden="true">↑</span></button>)}</div>{receivedAt && !jobs.length && <p className="wd-muted">Chưa có nhiệm vụ. Lượt điều phối mới sẽ xuất hiện tại đây khi máy chủ tạo nhiệm vụ.</p>}</section>
    {review && workflow && <div className="wd-modal-backdrop"><section className="wd-modal" id="wd-review" role="dialog" aria-modal="true" aria-labelledby="wd-review-title"><span className="wd-eyebrow">03 / XÁC NHẬN ĐIỀU PHỐI</span><h2 id="wd-review-title">{workflow.workflowName}</h2><p>Kiểm tra thông tin trước khi giao nhiệm vụ cho robot.</p><dl><dt>Robot ưu tiên</dt><dd>{robot ? robotLabel(robot) : 'Máy chủ tự phân'}</dd><dt>Ưu tiên</dt><dd>{priority === 75 ? 'Cao' : priority === 25 ? 'Thấp' : 'Bình thường'}</dd>{variables.filter(variable => inputs[variable.key] !== undefined).map(variable => <div className="wd-review-row" key={variable.key}><dt>{variable.label}</dt><dd>{renderValue(variable, inputs[variable.key])}</dd></div>)}</dl><p className="wd-muted">Sau khi gửi, mở nhiệm vụ để theo dõi, xác nhận bước hoặc yêu cầu hủy.</p>{actionError && <p role="alert" className="wd-error">{actionError}</p>}<footer><button className="wd-button" disabled={busy || !!attempt} onClick={() => setReview(false)}>Quay lại</button><button className="wd-button primary" disabled={busy || !canDispatch || !!attempt} onClick={submit}>{busy ? 'Đang gửi…' : 'Xác nhận điều phối'}</button>{attempt && !busy && <button className="wd-button" onClick={() => setReview(false)}>Xem trạng thái yêu cầu</button>}</footer></section></div>}
  </section>;
}
