import { useEffect, useMemo, useRef, useState } from 'react';
import { getSession, clearSession } from '../../../features/auth/session.js';
import { callBackend, watchJob } from '../../../features/api/backendApi.js';
import { operations, canUse, requestSchema, initialValue, prepareBody, prepareValue } from '../../../features/api/contract.js';
import { resources, resourceOperations, actionLabel, recordTitle, recordTimestamp, recordStatus, settingDisplayValue, statusTone, fieldLabel, screenTitles } from '../../../features/api/workspaceCatalog.js';
import { vi } from '../../../i18n/vi.js';
import SchemaFields from './SchemaFields.jsx';
import RecordDetails, { displayValue } from './RecordDetails.jsx';
import ListFilters from './ListFilters.jsx';
import OperationsReport from './OperationsReport.jsx';
import FacilityCatalogEditor from '../FacilityCatalogEditor.jsx';
import './backend.css';
import './presentation.css';

export const backendScreens = new Set([...resources.map(r => r.section), 'Charging']);
const unwrap = value => ({ ...value?.account, ...value?.request, ...value?.workflow, ...value?.job, ...value });
const paths = op => op.parameters.filter(p => p.in === 'path');
const filters = op => op.parameters.filter(p => p.in === 'query' && !['page', 'size'].includes(p.name));
const queryParams = op => op.parameters.filter(p => p.in === 'query');
const paramsSchema = params => ({ type: 'object', properties: Object.fromEntries(params.map(p => [p.name, p.schema || { type: 'string' }])), required: params.filter(p => p.required).map(p => p.name) });
const write = op => op.method !== 'GET';
const keyFor = (r, row) => unwrap(row)?.[r.idField];
const sensitiveAction = op => op.method === 'DELETE' || /\/(cancel|archive|retire|deactivate|lock|reset-password|rotate-secret|runs)$/.test(op.path);

export default function BackendWorkspace({ section = 'Missions' }) {
  return section === 'Charging' ? <ChargingWorkspace /> : <ResourceWorkspace section={section} />;
}
function ChargingWorkspace() {
  const [open, setOpen] = useState(false);
  const role = getSession()?.account?.role;
  const op = operations['POST /api/v1/operational-requests'];
  return <section className="be-workspace"><div className="be-card"><h2>Sạc pin</h2><p>Tạo yêu cầu sạc cho robot. Máy chủ sẽ kiểm tra quy trình đã phát hành và điều kiện vận hành trước khi điều phối.</p><button type="button" className="primary" disabled={!canUse(op, role)} onClick={() => setOpen(true)}>Tạo yêu cầu sạc</button></div><ResourceWorkspace section="Robot Status" />{open && <OperationDialog op={op} resource={resources.find(r => r.id === 'requests')} bindings={{}} role={role} preset={{ requestType: 'AUTO_CHARGING' }} onClose={() => setOpen(false)} onSaved={() => {}} />}</section>;
}
function ResourceWorkspace({ section }) {
  const role = getSession()?.account?.role;
  const available = resources.filter(r => r.section === section && (!r.adminOnly || role === 'ADMIN') && (!r.staffOnly || role === 'STAFF'));
  const [tab, setTab] = useState(available[0]?.id);
  const [geometry, setGeometry] = useState('');
  const resource = available.find(r => r.id === tab) || available[0];
  return <section className="be-workspace" aria-label={screenTitles[section] || vi(section)}>
    {section === 'Facility Management' && role === 'ADMIN' && <div className="be-actions"><button type="button" aria-pressed={!geometry} onClick={() => setGeometry('')}>Danh mục máy chủ</button><button type="button" aria-pressed={geometry === 'zone'} onClick={() => setGeometry('zone')}>Vẽ vùng trên bản đồ máy chủ</button><button type="button" aria-pressed={geometry === 'endpoint'} onClick={() => setGeometry('endpoint')}>Đặt điểm và nhóm trên bản đồ máy chủ</button></div>}
    {geometry ? <div className="ls-studio"><FacilityCatalogEditor key={geometry} stage={geometry} /></div> : <>
    {available.length > 1 && <nav className="be-tabs" aria-label="Danh mục chức năng">{available.map(r => <button type="button" key={r.id} className={resource?.id === r.id ? 'selected' : ''} aria-pressed={resource?.id === r.id} onClick={() => setTab(r.id)}>{r.title}</button>)}</nav>}
    {resource ? <ResourcePanel key={resource.id} resource={resource} role={role} /> : <p role="status">Tài khoản này không có quyền sử dụng mục này.</p>}
    </>}
  </section>;
}

function ResourcePanel({ resource, role }) {
  const ops = useMemo(() => resourceOperations(resource.id).filter(op => canUse(op, role)), [resource.id, role]);
  const listOp = operations[`GET ${resource.root}`];
  const detailOp = ops.find(op => op.method === 'GET' && op.path.startsWith(resource.root + '/') && /^\{[^}]+\}$/.test(op.path.slice(resource.root.length + 1)));
  const [parent, setParent] = useState({}), [query, setQuery] = useState({}), [applied, setApplied] = useState({}), [page, setPage] = useState(0);
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null), [detail, setDetail] = useState(null), [detailError, setDetailError] = useState(''), [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState(null), [live, setLive] = useState(false), [liveStatus, setLiveStatus] = useState('');
  const parentSignature = JSON.stringify(parent), querySignature = JSON.stringify(applied);
  const parentReady = paths(listOp).every(p => parent[p.name]);
  useEffect(() => {
    setData(null); setError(''); setSelected(null); setDetail(null); setLive(false);
    if (!parentReady) return;
    const controller = new AbortController(); setLoading(true);
    callBackend(listOp.key, { path: parent, query: { ...applied, page, size: 20 } }, { signal: controller.signal }).then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [listOp.key, parentReady, parentSignature, querySignature, page, revision]);
  const selectedId = selected && keyFor(resource, selected);
  useEffect(() => {
    setDetail(null); setDetailError(''); setLive(false);
    if (!selected) return;
    if (!detailOp || selectedId == null) { setDetail(selected); return; }
    const controller = new AbortController(); setDetailLoading(true);
    const context = rowPaths(resource, selected, parent);
    callBackend(detailOp.key, { path: context }, { signal: controller.signal }).then(setDetail).catch(e => { if (e.name !== 'AbortError') setDetailError(e.message); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected, selectedId, detailOp?.key]);
  useEffect(() => {
    if (!live || resource.id !== 'jobs' || !selectedId) return;
    const controller = new AbortController(); setLiveStatus('Đang kết nối…');
    watchJob(selectedId, { signal: controller.signal, onEvent: event => { setLiveStatus('Đang cập nhật trực tiếp'); if (event.type === 'job-state') setDetail(event.data); } }).then(() => { if (!controller.signal.aborted) { setLiveStatus('Kết nối đã đóng. Bật theo dõi lại để kết nối.'); setLive(false); } }).catch(e => { if (e.name !== 'AbortError') { setLiveStatus(e.message); setLive(false); } });
    return () => controller.abort();
  }, [live, selectedId, resource.id]);
  const rows = Array.isArray(data) ? data : data?.content;
  const singleton = data && !Array.isArray(rows);
  const selectedData = detail || (singleton ? data : null);
  const row = unwrap(selectedData || selected);
  const parentNames = new Set(paths(listOp).map(p => p.name));
  const globalOps = ops.filter(op => op.key !== listOp.key && paths(op).every(p => parentNames.has(p.name)) && (write(op) || op.path !== resource.root));
  const itemOps = ops.filter(op => paths(op).some(p => !parentNames.has(p.name)) && op.key !== detailOp?.key && !op.path.endsWith('/stream'));
  const eligible = op => {
    if (op.path.includes('/confirm-pickup') || op.path.includes('/confirm-delivery')) return false; // Retired for schema 3; use Job step confirmation.
    if (resource.id === 'workflows' && row?.status !== 'DRAFT' && (['PUT', 'DELETE'].includes(op.method) || /\/(steps|tasks|transitions|publish|validate)$/.test(op.path))) return false;
    if (op.path.endsWith('/submit') && row?.status !== 'DRAFT') return false;
    const step = selectedData?.steps?.find(s => s.jobStepId === selectedData.job?.selectedJobStepId);
    if (op.path.endsWith('/responses')) return step?.status === 'RUNNING' && ['HANDLE_PAYLOAD', 'INTERACT'].includes(step.stepTypeSnapshot) && step.resolvedInputsJson?.action !== 'SPEAK';
    if (op.method === 'POST' && /\/(auth-verifications|qr-challenges|qr-verifications)$/.test(op.path)) return step?.status === 'RUNNING' && step.stepTypeSnapshot === 'AUTHENTICATE';
    return true;
  };
  const open = op => setAction({ op, row: selectedData || selected, bindings: rowPaths(resource, selectedData || selected, parent) });
  return <>
    <header className="be-heading"><div><h2>{resource.title}</h2><p>{resource.id === 'retention' ? 'Mỗi mục là một chính sách lưu trữ cho một nhóm dữ liệu, không phải số bản ghi đang lưu.' : `Quản lý dữ liệu và thao tác của ${resource.title.toLowerCase()}.`}</p></div><div className="be-actions"><button type="button" disabled={loading} onClick={() => setRevision(v => v + 1)}>Tải lại</button>{globalOps.map(op => <button type="button" key={op.key} className={write(op) ? 'primary' : ''} onClick={() => open(op)}>{actionLabel(op)}</button>)}</div></header>
    {paths(listOp).length > 0 && <div className="be-card"><SchemaFields schema={paramsSchema(paths(listOp))} value={parent} onChange={next => { setParent(next); setPage(0); }} context={{ role }} /></div>}
    {filters(listOp).length > 0 && <ListFilters schema={paramsSchema(filters(listOp))} value={query} applied={applied} onChange={setQuery} role={role} onApply={() => { try { setApplied(prepareValue(query, paramsSchema(filters(listOp)))); setPage(0); setError(''); } catch (e) { setError(e.message); } }} onReset={() => { setQuery({}); setApplied({}); setPage(0); setError(''); }} />}
    {error && <p className="be-error" role="alert">{error}</p>}
    {loading && <p role="status">Đang tải dữ liệu…</p>}
    {!parentReady && <p className="be-empty">Chọn thông tin ở trên để xem danh sách.</p>}
    {rows && <div className="be-split"><section className="be-card be-record-list"><div className="be-list-head"><strong>{data?.totalElements ?? rows.length} {resource.id === 'retention' ? 'chính sách lưu trữ' : 'kết quả'}</strong>{listOp.parameters.some(p => p.name === 'page') && <span>Trang {page + 1}{data?.totalPages > 0 ? ` / ${data.totalPages}` : ''}</span>}</div>
      {!rows.length && <p className="be-empty">Chưa có dữ liệu phù hợp.</p>}
      <div className="be-records">{rows.map((record, index) => { const item = unwrap(record), id = keyFor(resource, record), status = recordStatus(item), date = recordTimestamp(item), reference = item.jobCode || item.requestCode; return <button type="button" key={id == null ? index : `${id}-${index}`} className={selected === record ? 'selected' : ''} aria-pressed={selected === record} onClick={() => setSelected(record)}>
        <span className="be-record-copy"><strong>{recordTitle(item, resource)}</strong>{item.dataset && item.retentionDays != null ? <small>Thời hạn lưu: {item.retentionDays.toLocaleString('vi-VN')} ngày</small> : item.settingKey ? <small>{settingDisplayValue(item) || 'Chưa có giá trị'}</small> : <small>{[item.actorUsername, date && displayValue(date), reference && `Tham chiếu · ${reference.slice(-6)}`].filter(Boolean).join(' · ') || 'Chọn để xem chi tiết'}</small>}</span>
        {status != null && status !== '' && <span className={`be-badge be-tone-${statusTone(status)}`}>{displayValue(status)}</span>}
      </button>; })}</div>
      {listOp.parameters.some(p => p.name === 'page') && <div className="be-pagination"><button disabled={!page || loading} onClick={() => setPage(p => p - 1)}>Trang trước</button><button disabled={loading || (data.totalPages != null ? page + 1 >= data.totalPages : rows.length < 20)} onClick={() => setPage(p => p + 1)}>Trang sau</button></div>}
    </section><section className="be-card be-record-detail"><h3>{selectedData ? recordTitle(row, resource) : 'Thông tin chi tiết'}</h3>{detailLoading ? <p role="status">Đang tải chi tiết…</p> : detailError ? <p role="alert" className="be-error">{detailError}</p> : selectedData ? <>
      <div className="be-actions">{itemOps.filter(eligible).map(op => <button key={op.key} type="button" className={sensitiveAction(op) ? 'danger' : ''} onClick={() => open(op)}>{actionLabel(op)}</button>)}</div>
      {resource.id === 'jobs' && <div className="be-live"><label className="be-check"><input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} />Theo dõi trực tiếp</label><small role="status">{liveStatus}</small><JobInstruction detail={selectedData} open={open} /></div>}
      <RecordDetails value={selectedData} />
    </> : <p className="be-empty">Chọn một bản ghi để xem và thao tác.</p>}</section></div>}
    {singleton && <section className={resource.id === 'reports' ? '' : 'be-card'}><div className="be-actions">{itemOps.filter(eligible).map(op => <button key={op.key} onClick={() => open(op)}>{actionLabel(op)}</button>)}</div>{resource.id === 'reports' ? <OperationsReport value={data} /> : <RecordDetails value={data} />}</section>}
    {action && <OperationDialog key={action.op.key} {...action} resource={resource} role={role} onClose={() => setAction(null)} onSaved={() => setRevision(v => v + 1)} />}
  </>;
}

function rowPaths(resource, raw, parent = {}) {
  const row = unwrap(raw);
  const id = row?.[resource.idField];
  const result = { ...parent, ...row, id, [resource.idField]: id };
  if (row?.endpointGroupId) result.groupId = row.endpointGroupId;
  if (row?.hospitalInformationId) result.hospitalId = row.hospitalInformationId;
  if (row?.account?.accountId) result.accountId = row.account.accountId;
  return result;
}
function localChoices(raw) {
  const choices = {};
  for (const [array, key, fields] of [['tasks', 'taskId', ['taskId']], ['steps', 'stepId', ['stepId', 'fromStepId', 'toStepId', 'startStepId']], ['transitions', 'transitionId', ['transitionId']], ['slots', 'slotId', ['slotId']]]) {
    if (raw?.[array]) for (const field of fields) choices[field] = raw[array].filter(r => r[key]).map(r => ({ value: r[key], label: recordTitle(r) === 'Thông tin chưa có tên' ? `${fieldLabel(field)} ${r.sequenceNo ?? ''}` : recordTitle(r) }));
  }
  if (raw?.steps) for (const field of ['jobStepId', 'authJobStepId']) choices[field] = raw.steps.filter(s => s.jobStepId && (field !== 'authJobStepId' || s.stepTypeSnapshot === 'AUTHENTICATE')).map(s => ({ value: s.jobStepId, label: `${s.stepCodeSnapshot} · ${vi(s.status)}` }));
  return choices;
}
function JobInstruction({ detail, open }) {
  const step = detail.steps?.find(s => s.jobStepId === detail.job?.selectedJobStepId);
  if (!step || step.status !== 'RUNNING') return null;
  const input = step.resolvedInputsJson || {};
  const key = step.stepTypeSnapshot === 'AUTHENTICATE' ? 'POST /api/v1/jobs/{jobId}/auth-verifications' : 'POST /api/v1/job-steps/{id}/responses';
  if (!['AUTHENTICATE', 'HANDLE_PAYLOAD', 'INTERACT'].includes(step.stepTypeSnapshot) || input.action === 'SPEAK') return null;
  return <section className="be-instruction"><h4>Bước đang chờ xác nhận</h4><p>{input.message || input.text || input.prompt_key || step.stepCodeSnapshot}</p>{input.items && <RecordDetails value={input.items} />}<button type="button" onClick={() => open(operations[key])}>Xác nhận bước hiện tại</button></section>;
}

function OperationDialog({ op, resource, row: raw, bindings, role, preset, onClose, onSaved }) {
  const ref = useRef(null), lock = useRef(false), requestIdentity = useRef(null);
  const row = unwrap(raw), choices = useMemo(() => localChoices(raw), [raw]);
  const currentStep = raw?.steps?.find(s => s.jobStepId === raw.job?.selectedJobStepId);
  const responseAction = op.path === '/api/v1/job-steps/{id}/responses';
  const initialPath = Object.fromEntries(paths(op).map(p => [p.name, op.path.startsWith('/api/v1/auth-verifications/') ? '' : responseAction && p.name === 'id' ? currentStep?.jobStepId || '' : bindings[p.name] ?? '']));
  const [path, setPath] = useState(initialPath), [query, setQuery] = useState(() => initialValue(paramsSchema(queryParams(op))) || {}), [body, setBody] = useState(() => {
    const data = initialValue(requestSchema(op.key), op.method === 'PUT' ? { ...row, ...row?.rollout, expectedRevision: row?.rollout?.revision } : undefined) || {};
    if (op.path.endsWith('/auth-verifications') || op.path.endsWith('/qr-challenges')) { data.authJobStepId = currentStep?.jobStepId; data.purpose = currentStep?.resolvedInputsJson?.purpose; data.validForSeconds = 120; if (op.path.endsWith('/auth-verifications')) data.method = 'STAFF_CONFIRMATION'; }
    return { ...data, ...preset };
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(undefined), [completed, setCompleted] = useState(false), [confirm, setConfirm] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const schema = requestSchema(op.key);
  const missingPaths = paths(op).filter(p => !initialPath[p.name]);
  const hasBody = !!op.body;
  const selectPath = next => {
    setPath(next);
    const child = raw?.steps?.find(s => s.stepId === next.stepId) || raw?.tasks?.find(s => s.taskId === next.taskId) || raw?.transitions?.find(s => s.transitionId === next.transitionId) || raw?.slots?.find(s => s.slotId === next.slotId);
    if (op.method === 'PUT' && child) setBody(initialValue(schema, child));
  };
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    try {
      if (sensitiveAction(op) && !confirm) throw Error('Vui lòng xác nhận thao tác.');
      const payload = hasBody ? responseAction ? staffResponse(currentStep, body) : prepareBody(op.key, body) : undefined;
      const typedQuery = prepareValue(query, paramsSchema(queryParams(op)));
      const signature = JSON.stringify({ path, query: typedQuery, body: payload });
      if (requestIdentity.current?.signature !== signature) requestIdentity.current = { signature, key: crypto.randomUUID() };
      lock.current = true; setBusy(true);
      const download = op.path.endsWith('/export.csv');
      const output = await callBackend(op.key, { path, query: typedQuery, body: payload, idempotencyKey: requestIdentity.current.key }, download ? { responseType: 'blob', headers: { Accept: 'text/csv' } } : {});
      if (download) {
        const url = URL.createObjectURL(output), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bao-cao-cong-viec.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setResult('Đã tải báo cáo.');
      } else setResult(output ?? null);
      setCompleted(true);
      if (write(op)) onSaved();
      if (op.path === '/api/v1/auth/change-password') { clearSession(); window.location.assign('/login'); }
    } catch (e) { setError(e.message || 'Không thực hiện được thao tác.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const title = actionLabel(op);
  return <dialog className="be-dialog be-workspace" ref={ref} aria-label={title} onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <header className="be-heading"><div><h2>{title}</h2><p>{resource.title}{raw ? ` · ${recordTitle(row)}` : ''}</p></div><button type="button" disabled={busy} aria-label="Đóng biểu mẫu" onClick={onClose}>Đóng</button></header>
    {completed ? <><p className="be-success" role="status">{write(op) ? 'Đã lưu thành công.' : 'Đã tải dữ liệu.'}</p><RecordDetails value={result} /><button className="primary" onClick={onClose}>Hoàn tất</button></> : <form onSubmit={submit}>
      <fieldset disabled={busy} className="be-form-body">
        {!!missingPaths.length && <SchemaFields schema={paramsSchema(missingPaths)} value={path} onChange={selectPath} context={{ role, choices }} />}
        {!!queryParams(op).length && <SchemaFields schema={paramsSchema(queryParams(op))} value={query} onChange={setQuery} context={{ role }} />}
        {hasBody && (responseAction ? <StepConfirmation step={currentStep} value={body} onChange={setBody} /> : <SchemaFields key={JSON.stringify(path)} schema={schema} value={body} onChange={setBody} context={{ role, choices }} />)}
        {!hasBody && write(op) && <p>Thực hiện “{title}” cho bản ghi đang chọn.</p>}
        {op.path.endsWith('/retention/runs') && <p className={query.dryRun ? 'be-muted' : 'be-error'}>{query.dryRun ? 'Chỉ xem trước; không xóa dữ liệu.' : 'Thao tác thật có thể lưu trữ hoặc xóa dữ liệu theo chính sách máy chủ. Hãy kiểm tra kết quả xem trước trước khi tiếp tục.'}</p>}
        {sensitiveAction(op) && <label className="be-check be-confirm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />Tôi xác nhận thực hiện thao tác này.</label>}
      </fieldset>
      {error && <p className="be-error" role="alert">{error}</p>}
      <footer className="be-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="primary" disabled={busy || responseAction && !currentStep} type="submit">{busy ? 'Đang xử lý…' : write(op) ? 'Xác nhận' : 'Xem kết quả'}</button></footer>
    </form>}
  </dialog>;
}

function responseType(step) {
  if (step?.stepTypeSnapshot === 'HANDLE_PAYLOAD') return 'PAYLOAD_CONFIRMED';
  const input = step?.resolvedInputsJson || {};
  if (['CLOSE_SENDER', 'CLOSE_RECEIVER', 'CONFIRM_COMPARTMENT_CLOSED', 'STAFF_CLOSE_DOOR_AND_CLEAR_MECHANISM'].includes(input.prompt_key)) return 'DOOR_CLOSED';
  if (['VERIFY_SENDER', 'VERIFY_RECEIVER', 'VERIFY_COMPARTMENT_LOCKED', 'STAFF_PHYSICALLY_VERIFY_LOCK'].includes(input.prompt_key)) return 'LOCK_CHECKED';
  return input.action === 'DISPLAY' ? 'UI_DISPLAYED' : 'INTERACTION_CONFIRMED';
}
function StepConfirmation({ step, value, onChange }) {
  if (!step) return <p>Chọn công việc có bước đang chạy trước khi xác nhận.</p>;
  const type = responseType(step);
  const label = { PAYLOAD_CONFIRMED: 'Tôi đã kiểm tra hàng đúng danh sách', DOOR_CLOSED: 'Tôi đã kiểm tra cửa đóng', LOCK_CHECKED: 'Tôi đã kiểm tra khóa chốt', UI_DISPLAYED: 'Tôi đã đọc hướng dẫn', INTERACTION_CONFIRMED: 'Tôi đã thực hiện yêu cầu' }[type];
  return <div className="be-instruction"><p>{step.resolvedInputsJson?.text || step.resolvedInputsJson?.message || step.resolvedInputsJson?.prompt_key || step.stepCodeSnapshot}</p>{step.resolvedInputsJson?.items && <RecordDetails value={step.resolvedInputsJson.items} />}<label className="be-check"><input type="checkbox" checked={value.confirmed === true} onChange={e => onChange({ ...value, confirmed: e.target.checked })} />{label}</label><SchemaFields schema={{ type: 'object', properties: { note: { type: 'string', maxLength: 2000 }, ...(step.resolvedInputsJson?.action === 'CAPTURE_INPUT' ? { values: { type: 'object' } } : {}) } }} value={value} onChange={onChange} /></div>;
}
function staffResponse(step, body) {
  if (!step || step.status !== 'RUNNING' || !['HANDLE_PAYLOAD', 'INTERACT'].includes(step.stepTypeSnapshot) || step.resolvedInputsJson?.action === 'SPEAK') throw Error('Bước này không nhận xác nhận từ giao diện.');
  if (!body.confirmed) throw Error('Vui lòng kiểm tra và xác nhận trước khi gửi.');
  const type = responseType(step), input = step.resolvedInputsJson || {};
  const data = type === 'PAYLOAD_CONFIRMED' ? { confirmed: true, items: input.items } : type === 'DOOR_CLOSED' ? { closed: true } : type === 'LOCK_CHECKED' ? { locked: true } : type === 'UI_DISPLAYED' ? { prompt_key: input.prompt_key } : { confirmed: true, ...(body.values ? { values: prepareValue(body.values, { type: 'object' }) } : {}) };
  return { responseType: type, data, ...(body.note?.trim() ? { note: body.note.trim() } : {}) };
}
