import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from '../../components/WorkflowWorkspaceShared.jsx';
import { workflowApi } from '../../features/workflows/workflowApi.js';
import { facilityApi, allFacilityPages } from '../../features/facility/facilityApi.js';
import { API_BASE_URL } from '../../features/api/client.js';
import { getSession } from '../../features/auth/session.js';
import { loadAllPages } from '../../features/workflows/patrolWorkflowModel.js';
import { readLocalDesigns } from '../../features/workflows/localPatrolDesign.js';
import { copy, newDocument, fromDetail, fingerprint, validateDocument, convertLocal } from '../../features/workflows/designer/designerModel.js';
import { designerStorageKey, readDrafts, writeDraft, deleteDraft } from '../../features/workflows/designer/designerStorage.js';
import { saveDesign, publishDesign } from '../../features/workflows/designer/designerService.js';
import { rebuildQrDeliveryDraft, QR_DELIVERY_DRAFT_NOTICE } from '../../features/workflows/designer/qrDeliveryDraft.js';
import DesignerInspector from './designer/DesignerInspector.jsx';
import WorkflowCanvas from './designer/WorkflowCanvas.jsx';
import InputPreview from './designer/InputPreview.jsx';
import DeleteStepDialog from './designer/DeleteStepDialog.jsx';
import './designer/workflowDesigner.css';

const statuses = { DRAFT: 'Bản nháp', VALIDATED: 'Đã kiểm tra', PUBLISHED: 'Đã publish', ARCHIVED: 'Đã ngừng' };
export default function WorkflowDesignerPage() {
  const [params, setParams] = useSearchParams();
  const storageKey = designerStorageKey(API_BASE_URL, getSession()?.account);
  const [entry, setEntry] = useState(null), current = useRef(null);
  const [remote, setRemote] = useState([]), [drafts, setDrafts] = useState([]), [legacy, setLegacy] = useState([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), busyRef = useRef(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [storageError, setStorageError] = useState('');
  const [search, setSearch] = useState(''), [statusFilter, setStatusFilter] = useState('');
  const [selectedNode, setSelectedNode] = useState(null), [selectedEdge, setSelectedEdge] = useState(null);
  const [errors, setErrors] = useState([]), [preview, setPreview] = useState(false), [savedAt, setSavedAt] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [catalog, setCatalog] = useState({ maps: [], endpoints: [], rooms: [] }), [catalogError, setCatalogError] = useState(''), [catalogLoading, setCatalogLoading] = useState(true), [catalogRevision, setCatalogRevision] = useState(0);
  const past = useRef([]), future = useRef([]), openToken = useRef(0), lastRequested = useRef(null), [historyTick, setHistoryTick] = useState(0);
  const document = entry?.document;
  const serverStatus = document?.workflow.status ?? 'DRAFT';
  const immutable = ['PUBLISHED', 'ARCHIVED'].includes(serverStatus) || !!document?.legacyLocal || !!document?.readOnlyReasons?.length;
  const readOnly = immutable || !!busy;
  const synced = !!entry?.syncFingerprint && document && entry.syncFingerprint === fingerprint(document);
  const runtimeNotice = document?.workflow.inputUiJson?.deliveryDraft?.runtimeReady === false ? QR_DELIVERY_DRAFT_NOTICE : '';
  const validated = synced && serverStatus === 'VALIDATED' && !runtimeNotice;
  function assign(value) { current.current = value; setEntry(value); }
  function select(nodeId, edgeId) { setSelectedNode(nodeId); setSelectedEdge(edgeId); }
  function resetHistory() { past.current = []; future.current = []; setHistoryTick(t => t + 1); select(null, null); setErrors([]); setDeleteTarget(null); }
  function recordHistory() { if (!current.current || readOnly) return; past.current = [...past.current.slice(-79), copy(current.current.document)]; future.current = []; setHistoryTick(t => t + 1); }
  function change(update, record = true) {
    if (!current.current || readOnly) return;
    const previous = current.current.document, next = typeof update === 'function' ? update(previous) : update;
    if (next === previous) return;
    if (record) recordHistory();
    assign({ ...current.current, document: next, syncFingerprint: null }); setErrors([]); setMessage('');
  }
  function undo() {
    if (!past.current.length || readOnly) return;
    future.current.push(copy(current.current.document)); const next = past.current.pop();
    assign({ ...current.current, document: next, syncFingerprint: null }); select(null, null); setErrors([]); setHistoryTick(t => t + 1);
  }
  function redo() {
    if (!future.current.length || readOnly) return;
    past.current.push(copy(current.current.document)); const next = future.current.pop();
    assign({ ...current.current, document: next, syncFingerprint: null }); select(null, null); setErrors([]); setHistoryTick(t => t + 1);
  }
  function persist(value, explicit = false) {
    try { const saved = writeDraft(localStorage, storageKey, value); setDrafts(readDrafts(localStorage, storageKey)); setSavedAt(saved.savedAt); setStorageError(''); if (explicit) setMessage('Đã lưu bản thiết kế trên thiết bị này.'); return true; }
    catch (e) { setStorageError('Không lưu được trên thiết bị: ' + e.message); return false; }
  }
  async function reload() {
    setLoading(true);
    try { setDrafts(readDrafts(localStorage, storageKey)); } catch (e) { setStorageError(e.message); }
    try { setLegacy(readLocalDesigns()); } catch (e) { setError(e.message); }
    try { setRemote(await loadAllPages(workflowApi.list)); } catch (e) { setError('Không tải được danh sách máy chủ: ' + e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [storageKey]);
  useEffect(() => {
    let active = true; setCatalogLoading(true); setCatalogError('');
    Promise.all([allFacilityPages(facilityApi.listMaps), allFacilityPages(facilityApi.listEndpoints), allFacilityPages(facilityApi.listRooms)]).then(([maps, endpoints, rooms]) => { if (active) setCatalog({ maps, endpoints, rooms }); }).catch(e => { if (active) setCatalogError(e.message); }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [catalogRevision]);
  useEffect(() => {
    if (!entry || immutable || busy) return;
    const timer = setTimeout(() => persist(entry), 650);
    return () => clearTimeout(timer);
  }, [entry, immutable, busy, storageKey]);
  useEffect(() => {
    const guard = event => {
      if (!current.current || immutable) return;
      try { writeDraft(localStorage, storageKey, current.current); }
      catch { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [storageKey, immutable]);
  useEffect(() => () => {
    // Flush the latest edit when a sidebar route unmounts the editor before its debounce.
    const value = current.current;
    if (value && !value.document.legacyLocal) try { writeDraft(localStorage, storageKey, value); } catch { /* Existing storage errors remain visible while mounted. */ }
  }, [storageKey]);
  useEffect(() => {
    const keydown = event => {
      if (!current.current || busyRef.current || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable || preview || deleteTarget) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { if (selectedEdge) remove('edge', selectedEdge); else if (selectedNode && selectedNode !== 'start') remove('node', selectedNode); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [selectedNode, selectedEdge, readOnly, preview, deleteTarget, historyTick]);
  async function openDefinition(definition, preferLocal = true) {
    const token = ++openToken.current; setError(''); setMessage(''); setBusy('Đang mở…'); busyRef.current = true;
    try {
      let saved;
      try { saved = preferLocal && readDrafts(localStorage, storageKey).find(d => d.document.localId === definition.workflowId || d.document.workflow.workflowId === definition.workflowId); }
      catch (e) { setStorageError(e.message); }
      const local = legacy.find(d => d.workflow.workflowId === definition.workflowId);
      const detail = saved ? null : local ?? await workflowApi.get(definition.workflowId);
      if (token !== openToken.current) return;
      if (saved) { assign(copy(saved)); setSavedAt(saved.savedAt); setMessage('Đã khôi phục bản trên thiết bị. Lưu và kiểm tra lại trước khi publish.'); assign({ ...copy(saved), syncFingerprint: null }); }
      else { const next = fromDetail(detail); assign({ document: next, syncFingerprint: detail.workflow.localOnly ? null : fingerprint(next) }); setSavedAt(''); }
      resetHistory();
    } catch (e) { setError(e.message); }
    finally { if (token === openToken.current) { setBusy(''); busyRef.current = false; } }
  }
  const requestedId = params.get('workflowId');
  useEffect(() => { if (!requestedId) lastRequested.current = null; else if (!loading && lastRequested.current !== requestedId) { lastRequested.current = requestedId; openDefinition({ workflowId: requestedId }); } }, [requestedId, loading]);
  function createNew() { if (busyRef.current) return; ++openToken.current; assign({ document: newDocument(), syncFingerprint: null }); resetHistory(); setError(''); setMessage(''); setSavedAt(''); if (requestedId) setParams({}); }
  function applyQrDeliveryDraft() {
    if (readOnly || !window.confirm('Thay đồ thị hiện tại bằng mẫu nhận hàng A → giao hàng B qua QR và nút đóng cửa? Có thể hoàn tác. Mẫu được giữ ở bản nháp vì phần chạy một nút còn cần tích hợp BE/Pi và màn robot.')) return;
    change(rebuildQrDeliveryDraft(current.current.document));
    select(null, null); setError(''); persist(current.current);
    setMessage('Đã dựng lại 10 bước nhận/giao hàng qua QR. ' + QR_DELIVERY_DRAFT_NOTICE);
  }
  function remove(kind, id) {
    if (readOnly || !current.current || kind === 'node' && id === 'start') return;
    if (kind === 'node') {
      const node = current.current.document.nodes.find(n => n.id === id);
      if (node) setDeleteTarget({ node, localId: current.current.document.localId, connectionCount: current.current.document.edges.filter(e => e.source === id || e.target === id).length });
      return;
    }
    deleteElement(kind, id);
  }
  function deleteElement(kind, id) {
    if (readOnly || !current.current || kind === 'node' && id === 'start') return;
    change(d => { const next = copy(d); next.edges = next.edges.filter(e => kind === 'edge' ? e.id !== id : e.source !== id && e.target !== id); if (kind === 'node') { next.nodes = next.nodes.filter(n => n.id !== id); for (const key of Object.keys(next.invalidJson ?? {})) if (key.startsWith(id + ':')) delete next.invalidJson[key]; } return next; }); select(null, null);
  }
  function confirmDelete() {
    if (deleteTarget && current.current?.document.localId === deleteTarget.localId) deleteElement('node', deleteTarget.node.id);
    setDeleteTarget(null);
  }
  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(action); setError(''); setMessage('');
    try { await actionHandlers[action](); }
    catch (e) { setError(e.message); }
    finally { busyRef.current = false; setBusy(''); }
  }
  async function saveRemote() {
    const value = current.current;
    if (!value || immutable) throw new Error('Bản này chỉ được xem. Tạo phiên bản hoặc bản chuyển đổi trước.');
    const issues = validateDocument(value.document, catalogError || catalogLoading ? null : catalog);
    setErrors(issues);
    if (issues.length) { select(issues[0].nodeId ?? null, issues[0].edgeId ?? null); throw new Error('Cần sửa các lỗi trong bản thiết kế trước khi lưu máy chủ.'); }
    // Invalidate before either transaction, including network/partial failures.
    const pending = { ...value, syncFingerprint: null }; assign(pending); persist(pending);
    try {
      const saved = await saveDesign(value.document, workflowApi);
      assign(saved); persist(saved); setMessage('Đã lưu đầy đủ workflow lên máy chủ.'); return saved;
    } catch (e) { assign(pending); persist(pending); throw new Error('Chưa đồng bộ đầy đủ lên máy chủ. Bản thiết kế được giữ trên thiết bị; cần lưu lại trước khi publish. ' + e.message); }
  }
  const actionHandlers = {
    'Lưu lên máy chủ': saveRemote,
    'Kiểm tra': async () => { const saved = await saveRemote(); const result = await workflowApi.validate(saved.document.workflow.workflowId); const next = { ...saved, document: { ...saved.document, workflow: { ...saved.document.workflow, status: result.status, definitionHash: result.definitionHash } } }; next.syncFingerprint = fingerprint(next.document); assign(next); persist(next); setMessage(saved.document.workflow.inputUiJson?.deliveryDraft?.runtimeReady === false ? 'BE đã kiểm tra cấu trúc workflow. ' + QR_DELIVERY_DRAFT_NOTICE : 'BE đã xác thực workflow.' + (result.warnings?.length ? ' ' + result.warnings.join(' · ') : ' Có thể publish.')); },
    'Publish': async () => { if (current.current.document.workflow.inputUiJson?.deliveryDraft?.runtimeReady === false) throw new Error(QR_DELIVERY_DRAFT_NOTICE); const workflow = await publishDesign(current.current, workflowApi); const next = { ...current.current, document: { ...current.current.document, workflow: { ...current.current.document.workflow, ...workflow } } }; next.syncFingerprint = fingerprint(next.document); assign(next); persist(next); setMessage('Đã publish workflow.'); await reload(); },
    'Tạo phiên bản mới': async () => { const detail = await workflowApi.clone(current.current.document.workflow.workflowId, {}); const next = fromDetail(detail); assign({ document: next, syncFingerprint: fingerprint(next) }); resetHistory(); setMessage('Đã tạo phiên bản mới trên máy chủ.'); },
    'Ngừng sử dụng': async () => { const workflow = await workflowApi.archive(current.current.document.workflow.workflowId); const next = { ...current.current, document: { ...current.current.document, workflow: { ...current.current.document.workflow, ...workflow } } }; assign(next); persist(next); setMessage('Đã ngừng nhận nhiệm vụ mới.'); await reload(); },
  };
  function backToLibrary() { if (entry && !immutable && !persist(current.current)) return; ++openToken.current; assign(null); resetHistory(); setParams({}); reload(); }
  function convert() { const next = convertLocal(current.current.document); assign({ document: next, syncFingerprint: null }); resetHistory(); persist(current.current); setMessage('Đã tạo bản sao dùng biến điểm đến. Bản tuần tra cục bộ gốc vẫn được giữ.'); }
  const library = [
    ...drafts.map(d => ({ ...d.document.workflow, workflowId: d.document.workflow.workflowId ?? d.document.localId, localEntry: d, source: d.document.workflow.workflowId ? 'Máy chủ · có bản trên thiết bị' : 'Thiết bị', savedAt: d.savedAt })),
    ...remote.filter(w => !drafts.some(d => d.document.workflow.workflowId === w.workflowId)).map(w => ({ ...w, source: 'Máy chủ' })),
    ...legacy.map(d => ({ ...d.workflow, source: 'Tuần tra cục bộ' })),
  ].filter(w => (!statusFilter || (w.status ?? 'DRAFT') === statusFilter) && `${w.workflowName} ${w.workflowCode}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return <div className="wfd-page"><Sidebar /><main className="wfd-main"><header className="wfd-page-header"><div><small>AUTOMATION STUDIO</small><h1>{document ? document.workflow.workflowName : 'Thiết kế quy trình'}</h1><p>{document ? `${document.workflow.workflowCode} · Phiên bản ${document.workflow.versionNo}` : 'Ghép các hành động thành quy trình có thể sử dụng lại.'}</p></div><div className="wfd-header-actions">{document ? <button disabled={!!busy} onClick={backToLibrary}>← Thư viện</button> : <><button disabled={loading} onClick={() => { setError(''); reload(); }}>Tải lại</button><button className="primary" onClick={createNew}>＋ Tạo quy trình</button></>}</div></header>{error && <div role="alert" className="wfd-banner error">{error}<button aria-label="Đóng thông báo lỗi" onClick={() => setError('')}>×</button></div>}{storageError && <div role="alert" className="wfd-banner error">{storageError}</div>}{message && <div role="status" className="wfd-banner success">{message}</div>}{document ? <><div className="wfd-topbar"><div className="wfd-save-status"><span className={'wfd-status ' + serverStatus.toLowerCase()}>{statuses[serverStatus] ?? serverStatus}</span><span>{busy || (synced ? 'Đã đồng bộ máy chủ' : savedAt ? 'Đã lưu thiết bị · chưa đồng bộ' : 'Chưa lưu')}{savedAt && !busy ? ' · ' + new Date(savedAt).toLocaleTimeString('vi-VN') : ''}</span></div><div className="wfd-toolbar-actions"><button disabled={!!busy} onClick={() => { select(null, null); }}>Thông tin & biến</button><button disabled={!!busy} onClick={() => setPreview(true)}>Xem trước đầu vào</button>{!immutable && <><button disabled={!!busy} onClick={applyQrDeliveryDraft}>Mẫu giao hàng QR</button><button disabled={!!busy} onClick={() => persist(current.current, true)}>Lưu trên thiết bị</button><button disabled={!!busy} onClick={() => run('Lưu lên máy chủ')}>Lưu lên máy chủ</button><button disabled={!!busy} onClick={() => run('Kiểm tra')}>Kiểm tra</button><button className="primary" disabled={!!busy || !validated} title={!validated ? 'Lưu và kiểm tra workflow trước khi publish' : undefined} onClick={() => run('Publish')}>Publish</button></>}{['PUBLISHED', 'ARCHIVED'].includes(serverStatus) && !document.legacyLocal && <button disabled={!!busy} className="primary" onClick={() => run('Tạo phiên bản mới')}>Tạo phiên bản mới</button>}{serverStatus === 'PUBLISHED' && <button disabled={!!busy} onClick={() => { if (window.confirm('Ngừng nhận nhiệm vụ mới cho workflow này? Lịch sử được giữ nguyên.')) run('Ngừng sử dụng'); }}>Ngừng sử dụng</button>}{document.legacyLocal && <button disabled={!!busy} onClick={convert}>Tạo bản chuyển đổi</button>}</div></div>{document.readOnlyReasons?.length > 0 && <div className="wfd-banner warning">Chỉ xem: {document.readOnlyReasons.join(' ')}</div>}{document.legacyLocal && <div className="wfd-banner warning">Bản tuần tra cục bộ được giữ nguyên để xem và mô phỏng. Tạo bản chuyển đổi để khai báo điểm đến dùng trên máy chủ.</div>}{runtimeNotice && <div role="status" className="wfd-banner warning">{runtimeNotice}</div>}<div className="wfd-studio" aria-busy={!!busy}><WorkflowCanvas key={document.localId} document={document} change={change} recordHistory={recordHistory} readOnly={readOnly} errors={errors} selectedNode={selectedNode} selectedEdge={selectedEdge} onSelect={select} onDelete={remove} undo={undo} redo={redo} canUndo={!!past.current.length} canRedo={!!future.current.length} /><DesignerInspector key={selectedNode ?? selectedEdge ?? 'workflow'} document={document} selectedNode={selectedNode} selectedEdge={selectedEdge} change={change} readOnly={readOnly} onDelete={remove} onError={setError} catalog={catalog} /></div>{errors.length > 0 && <section className="wfd-validation" aria-label="Lỗi thiết kế"><strong>Cần sửa {errors.length} lỗi</strong>{errors.map((issue, index) => <button key={index} onClick={() => select(issue.nodeId ?? null, issue.edgeId ?? null)}>{issue.message}</button>)}</section>}{preview && <InputPreview document={document} catalog={catalog} catalogError={catalogError} loading={catalogLoading} onRetry={() => setCatalogRevision(v => v + 1)} onClose={() => setPreview(false)} />}</> : <><div className="wfd-library-filters"><input aria-label="Tìm workflow" placeholder="Tìm tên hoặc mã quy trình…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Lọc trạng thái" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><span>{library.length} quy trình</span></div>{loading && <p role="status" className="wfd-muted">Đang tải quy trình…</p>}<div className="wfd-library">{library.map(w => <article key={`${w.source}:${w.workflowId}`} className="wfd-library-card"><div className="wfd-card-icon">⌘</div><div className="wfd-card-copy"><div><h2>{w.workflowName}</h2><span className={'wfd-status ' + (w.status ?? 'DRAFT').toLowerCase()}>{statuses[w.status ?? 'DRAFT']}</span></div><p>{w.description || 'Quy trình chưa có mô tả.'}</p><small>{w.workflowCode} · v{w.versionNo} · {w.source}</small></div><div className="wfd-card-actions"><button className="primary" disabled={!!busy} onClick={() => { if (w.localEntry && !w.localEntry.document.workflow.workflowId) { assign(copy(w.localEntry)); resetHistory(); setSavedAt(w.localEntry.savedAt); setError(''); } else openDefinition(w); }}>Mở quy trình</button>{w.localEntry && <button disabled={!!busy} onClick={() => { if (!window.confirm('Xóa bản thiết kế trên thiết bị? Bản trên máy chủ và bản tuần tra gốc được giữ nguyên.')) return; try { deleteDraft(localStorage, storageKey, w.localEntry.document.localId); setDrafts(readDrafts(localStorage, storageKey)); } catch (e) { setStorageError(e.message); } }}>Xóa bản thiết bị</button>}{w.workflowId && !w.localEntry && !w.localOnly && w.status === 'DRAFT' && <button disabled={!!busy} onClick={async () => { if (!window.confirm('Xóa bản nháp trên máy chủ?')) return; try { await workflowApi.remove(w.workflowId); await reload(); } catch (e) { setError(e.message); } }}>Xóa bản nháp</button>}</div></article>)}</div>{!loading && !library.length && <section className="wfd-empty-library"><i>⌘</i><h2>{search || statusFilter ? 'Không tìm thấy quy trình' : 'Tạo workflow đầu tiên'}</h2><p>Kéo các step, kết nối luồng và khai báo những dữ liệu cần nhập khi sử dụng.</p><button className="primary" onClick={createNew}>＋ Tạo quy trình</button></section>}</>}{deleteTarget && <DeleteStepDialog node={deleteTarget.node} connectionCount={deleteTarget.connectionCount} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}</main></div>;
}
