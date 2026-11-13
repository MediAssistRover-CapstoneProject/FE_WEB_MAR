import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSession } from '../auth/session.js';
import { API_BASE_URL } from '../api/client.js';
import { workflowApi } from '../workflows/workflowApi.js';
import { loadAllPages, workflowStatusLabel } from '../workflows/patrolWorkflowModel.js';
import { speechFields } from '../workflows/designer/stepCatalog.js';
import { designerStorageKey } from '../workflows/designer/designerStorage.js';
import { clearSyncedSpeechDrafts, editableSpeechData, isBound, speechChanges, speechData, speechError, speechSteps } from './workflowSpeech.js';
import './workflowSpeech.css';

function SpeechIcon({ name }) {
  const shapes = {
    speech: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18A8 8 0 0 1 5 15" /></>,
    workflow: <><rect x="8" y="3" width="8" height="5" rx="1.5" /><rect x="2" y="16" width="8" height="5" rx="1.5" /><rect x="14" y="16" width="8" height="5" rx="1.5" /><path d="M12 8v4M6 16v-4h12v4" /></>,
    play: <><path d="m9 5 11 7-11 7V5Z" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    edit: <><path d="m16 4 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15l-1 6 5-2" /></>,
    chevron: <path d="m6 15 6-6 6 6" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] || shapes.speech}</svg>;
}

export default function WorkflowSpeechPanel({ onDirtyChange }) {
  const session = getSession();
  if (session?.account?.role !== 'ADMIN' || session?.mode === 'demo')
    return <p className="be-error">Chức năng này yêu cầu tài khoản ADMIN đang đăng nhập.</p>;
  return <SpeechWorkspace onDirtyChange={onDirtyChange} />;
}

function SpeechWorkspace({ onDirtyChange }) {
  const [params, setParams] = useSearchParams();
  const workflowId = params.get('workflowId') || '';
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [editing, setEditing] = useState('');
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [stepSearch, setStepSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState('');
  const savingRef = useRef(false);
  const mounted = useRef(false);
  const playback = useRef(0);
  const savedSelection = useRef('');
  const changes = speechChanges(detail, drafts);
  const dirty = changes.length > 0;
  const steps = speechSteps(detail);
  const invalid = changes.map(change => speechError(change.data)).find(Boolean);
  const workflow = detail?.workflow;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; playback.current += 1; window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => {
    onDirtyChange?.(dirty || saving);
    return () => onDirtyChange?.(false);
  }, [dirty, saving, onDirtyChange]);
  useEffect(() => {
    const guard = event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, saving]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    setCatalogLoading(true); setCatalogError('');
    // The list already contains picker labels. Fetch a graph only after selection.
    // Defer starting so StrictMode's discarded mount does not send duplicate requests.
    Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return loadAllPages(query => workflowApi.list(query, { signal: controller.signal }));
    })
      .then(items => { if (active) setCatalog(items); })
      .catch(e => { if (active) setCatalogError(controller.signal.aborted
        ? 'Tải danh sách workflow quá lâu. Hãy bấm Tải lại để thử lại.' : e.message); })
      .finally(() => { clearTimeout(timer); if (active) setCatalogLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [revision]);
  useEffect(() => {
    if (savedSelection.current === workflowId && workflowId) {
      savedSelection.current = '';
      return;
    }
    let active = true;
    const controller = new AbortController();
    setDetail(null); setDrafts({}); setEditing(''); setError(''); setMessage('');
    stop();
    if (!workflowId) { setLoading(false); return; }
    const timer = setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return workflowApi.get(workflowId, { signal: controller.signal });
    }).then(value => { if (active) setDetail(value); })
      .catch(e => { if (active) setError(controller.signal.aborted
        ? 'Tải các bước workflow quá lâu. Hãy bấm Tải lại để thử lại.' : e.message); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [workflowId, revision]);

  function stop() {
    playback.current += 1;
    window.speechSynthesis?.cancel();
    setPlaying('');
  }
  function selectWorkflow(id) {
    if (savingRef.current || dirty && !window.confirm('Bỏ các thay đổi chưa lưu để chuyển workflow?')) return;
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (id) next.set('workflowId', id);
      else next.delete('workflowId');
      return next;
    }, { replace: true });
  }
  function changeField(step, field, value) {
    stop(); setMessage('');
    setDrafts(previous => {
      const data = { ...(previous[step.stepCode] ?? speechData(step)) };
      if (value === '') delete data[field];
      else data[field] = value;
      return { ...previous, [step.stepCode]: data };
    });
  }
  function resetStep(step) {
    stop();
    setDrafts(previous => { const next = { ...previous }; delete next[step.stepCode]; return next; });
  }
  function preview(step, data) {
    stop(); setError('');
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      setError('Trình duyệt này chưa hỗ trợ nghe thử giọng nói.'); return;
    }
    const issue = speechError(data);
    if (issue) { setError(issue); return; }
    const token = playback.current;
    const utterance = new SpeechSynthesisUtterance(data.text);
    const language = data.language_code === 'en' ? 'en' : 'vi';
    utterance.lang = language === 'en' ? 'en-US' : 'vi-VN';
    utterance.voice = speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith(language)) || null;
    if (typeof data.speed_wpm === 'number') utterance.rate = data.speed_wpm / 150;
    if (typeof data.volume === 'number') utterance.volume = data.volume / 100;
    utterance.onend = () => { if (mounted.current && token === playback.current) setPlaying(''); };
    utterance.onerror = event => {
      if (!mounted.current || token !== playback.current) return;
      setPlaying('');
      if (!['canceled', 'interrupted'].includes(event.error)) setError('Không phát được giọng đọc. Kiểm tra giọng đã cài trên máy.');
    };
    setPlaying(step.stepCode);
    speechSynthesis.speak(utterance);
  }
  async function save(publish) {
    if (savingRef.current || !dirty || invalid) return;
    savingRef.current = true; setSaving(true); setError(''); setMessage(''); stop();
    try {
      const saved = await workflowApi.saveSpeech(workflow.workflowId, {
        expectedRowVersion: workflow.rowVersion, publish, steps: changes,
      });
      if (!mounted.current) return;
      let localNotice = '';
      try {
        const storageKey = designerStorageKey(API_BASE_URL, getSession()?.account);
        if (clearSyncedSpeechDrafts(localStorage, storageKey, saved.workflow.workflowId))
          localNotice = ' Bạn có bản thiết kế chưa đồng bộ trên thiết bị. Kiểm tra lời nói trong bản đó trước khi lưu lại từ trình thiết kế.';
      } catch {
        localNotice = ' Chưa cập nhật được bộ nhớ bản thiết kế trên thiết bị.';
      }
      setDetail(saved); setDrafts({}); setEditing('');
      setCatalog(previous => [...previous.filter(item => item.workflowId !== saved.workflow.workflowId), saved.workflow]
        .sort((a, b) => a.workflowCode.localeCompare(b.workflowCode) || b.versionNo - a.versionNo));
      if (saved.workflow.workflowId !== workflowId) {
        savedSelection.current = saved.workflow.workflowId;
        setParams(previous => {
          const next = new URLSearchParams(previous);
          next.set('workflowId', saved.workflow.workflowId);
          return next;
        }, { replace: true });
        setMessage(`Đã phát hành phiên bản ${saved.workflow.versionNo}. Chọn phiên bản này khi giao nhiệm vụ mới.${localNotice}`);
      } else setMessage((publish ? 'Đã lưu và phát hành lời nói mới.' : 'Đã lưu lời nói vào bản nháp workflow.') + localNotice);
    } catch (e) {
      if (mounted.current) setError(e.status === 409 ? `${e.message} Các thay đổi đang nhập vẫn được giữ trên màn hình.`
        : e.status === 404 || e.status === 405 ? 'Máy chủ chưa hỗ trợ lưu nhanh lời nói workflow. Cần cập nhật backend để sử dụng.'
          : e.status === 0 || e.status >= 500 ? `${e.message} Hãy tải lại để kiểm tra phiên bản đã lưu trước khi thử lại.` : e.message);
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const listed = catalog.filter(item => item.workflowId === workflowId
    || `${item.workflowName} ${item.workflowCode}`.toLocaleLowerCase('vi').includes(workflowSearch.toLocaleLowerCase('vi')));
  const shown = steps.filter(step => `${step.stepName} ${step.stepCode} ${JSON.stringify(drafts[step.stepCode] ?? speechData(step))}`
    .toLocaleLowerCase('vi').includes(stepSearch.toLocaleLowerCase('vi')));
  const changedCodes = new Set(changes.map(change => change.stepCode));
  const inactive = workflow?.status === 'ARCHIVED';
  return <section className="ai-workspace workflow-speech" aria-label="Lời nói workflow">
    <header className="ws-heading"><div className="ws-heading-copy"><span className="ws-heading-icon"><SpeechIcon name="speech" /></span><div>
      <span className="ws-eyebrow">NỘI DUNG TƯƠNG TÁC</span><h2>Lời nói workflow</h2><p>Chỉnh nội dung và nghe thử lời robot đọc trong từng bước.</p></div></div>
      <button className="ws-button ws-refresh" disabled={saving || loading || catalogLoading} onClick={() => {
        if (!dirty || window.confirm('Bỏ các thay đổi chưa lưu và tải lại từ máy chủ?')) setRevision(value => value + 1);
      }}><SpeechIcon name="refresh" />Tải lại</button>
    </header>
    <div className="be-card ws-picker"><div className="ws-card-heading"><div className="ws-card-title"><span className="ws-small-icon"><SpeechIcon name="workflow" /></span><div><h3>Chọn workflow</h3><p>Tìm quy trình bạn muốn chỉnh lời nói.</p></div></div>
      <span className="ws-badge">{catalogLoading ? 'Đang tải…' : `${catalog.length} workflow`}</span></div><div className="ai-fields">
      <label>Tìm workflow<span className="ws-search-control"><SpeechIcon name="search" /><input type="search" value={workflowSearch} onChange={e => setWorkflowSearch(e.target.value)} placeholder="Tên hoặc mã workflow" /></span></label>
      <label>Workflow<select aria-label="Workflow" value={workflowId} disabled={saving || catalogLoading} onChange={e => selectWorkflow(e.target.value)}>
        <option value="">{catalogLoading ? 'Đang tải workflow…' : 'Chọn workflow cần sửa lời nói'}</option>
        {workflowId && !catalog.some(item => item.workflowId === workflowId)
          && <option value={workflowId}>{workflow?.workflowId === workflowId ? workflow.workflowName : 'Workflow đang chọn'}</option>}
        {listed.map(item => <option key={item.workflowId} value={item.workflowId}>{item.workflowName} · v{item.versionNo} · {workflowStatusLabel(item.status)}</option>)}
      </select></label>
    </div>
      {!catalogLoading && !catalogError && !catalog.length && <p>Chưa có workflow trên máy chủ. <Link className="ai-link" to="/workflow">Mở trình thiết kế workflow</Link></p>}</div>
    {catalogError && <p className="be-error" role="alert">{catalogError}</p>}
    {error && <p className="be-error" role="alert">{error}</p>}
    {message && <p className="be-success" role="status">{message}</p>}
    {loading && <div className="be-card ws-loading" role="status"><span className="ws-small-icon"><SpeechIcon name="refresh" /></span><div><strong>Đang tải các bước tương tác…</strong><p>Nội dung lời nói sẽ xuất hiện tại đây.</p></div></div>}
    {!workflowId && !loading && <div className="be-card ws-empty"><span className="ws-empty-icon"><SpeechIcon name="speech" /></span><h3>Lời nói theo từng bước</h3><p>Chọn workflow để xem và chỉnh lời nói của robot.</p><span className="ws-empty-hint">Chỉnh nội dung · Nghe thử · Lưu và áp dụng</span></div>}
    {workflow && <>
      <div className="ws-workflow-heading"><div className="ws-workflow-copy"><div className="ws-workflow-meta"><span className="ws-workflow-code">{workflow.workflowCode}</span><span className={`ws-badge ws-status-${workflow.status?.toLowerCase()}`}>{workflowStatusLabel(workflow.status)}</span><span className="ws-version">Phiên bản {workflow.versionNo}</span></div><h3>{workflow.workflowName}</h3></div>
        <div className="ws-workflow-actions"><div className="ws-workflow-count"><strong>{steps.length}</strong><span>bước phát lời nói</span></div><Link className="ws-button" to={`/workflow?workflowId=${workflow.workflowId}`} onClick={event => {
          if (saving || dirty && !window.confirm('Bỏ các thay đổi chưa lưu để mở trình thiết kế workflow?')) event.preventDefault();
        }}>Mở workflow<SpeechIcon name="arrow" /></Link></div>
      </div>
      <div className="ws-list-toolbar"><div><h3>Các bước phát lời nói <span>{shown.length}</span></h3><p>Theo thứ tự thực hiện trong workflow.</p></div><label className="ws-search"><span>Tìm bước hoặc lời nói</span><span className="ws-search-control"><SpeechIcon name="search" /><input type="search" value={stepSearch} onChange={e => setStepSearch(e.target.value)} placeholder="Tìm bước hoặc nội dung lời nói…" /></span></label></div>
      {inactive && <p className="ai-note">Phiên bản này đã ngừng sử dụng. Chọn bản nháp hoặc phiên bản đang phát hành để chỉnh sửa.</p>}
      {!steps.length && <div className="be-card ws-empty"><span className="ws-empty-icon"><SpeechIcon name="speech" /></span><h3>Chưa có nội dung lời nói</h3><p>Workflow này chưa có bước phát lời nói. Thêm bước Tương tác với hành động Phát lời nói trong trình thiết kế.</p></div>}
      {!!steps.length && !shown.length && <p role="status">Không có bước phù hợp với nội dung tìm kiếm.</p>}
      <div className="ws-steps">{shown.map(step => {
        const data = drafts[step.stepCode] ?? speechData(step);
        const editable = editableSpeechData(step) && !inactive;
        const open = editing === step.stepCode;
        const text = typeof data?.text === 'string' ? data.text : 'Lời nói lấy từ biến khi workflow chạy';
        const issue = changedCodes.has(step.stepCode) ? speechError(data) : '';
        const task = detail.tasks?.find(item => item.taskId === step.taskId);
        return <article className={`be-card ws-step${open ? ' is-editing' : ''}${changedCodes.has(step.stepCode) ? ' is-dirty' : ''}`} key={step.stepCode}>
          <div className="ws-step-heading"><div className="ws-step-identity"><span className="ws-step-number">{String(step.sequenceNo).padStart(2, '0')}</span><div><div className="ws-step-title"><h4>{step.stepName}</h4>{changedCodes.has(step.stepCode) && <span className="ws-badge ws-dirty-badge">Chưa lưu</span>}{step.enabled === false && <span className="ws-badge">Đã tắt</span>}</div><p>{task?.taskName ? `${task.taskName} · ` : ''}Bước {step.sequenceNo}</p></div></div>
            <div className="be-actions"><button className="ws-button" disabled={saving || typeof data?.text !== 'string' || !data.text.trim() || !!speechError(data)} onClick={() => playing === step.stepCode ? stop() : preview(step, data)}><SpeechIcon name={playing === step.stepCode ? 'stop' : 'play'} />{playing === step.stepCode ? 'Dừng nghe' : 'Nghe thử trên máy'}</button>
              <button className="ws-button ws-edit-button" aria-expanded={open} disabled={saving || !editable} onClick={() => setEditing(open ? '' : step.stepCode)}><SpeechIcon name={open ? 'chevron' : 'edit'} />{open ? 'Thu gọn' : 'Sửa lời nói'}</button></div>
          </div>
          {!open && <div className="ws-utterance"><SpeechIcon name="speech" /><div><span>Lời robot đọc</span><p className="ws-text">{text}</p></div></div>}
          {!editableSpeechData(step) && <p className="ai-note">Nội dung bước này được liên kết với nguồn dữ liệu. Mở workflow để chỉnh nguồn.</p>}
          {open && <fieldset disabled={saving} className="ai-form">
            <label>Nội dung nói{isBound(data?.text) ? <span className="ws-binding">Đang lấy từ biến. Chỉnh nguồn trong workflow.</span>
              : <><textarea rows={3} maxLength={500} value={data?.text ?? ''} onChange={e => changeField(step, 'text', e.target.value)} /><small>{data?.text?.length ?? 0}/500 ký tự</small></>}</label>
            <div className="ws-speech-fields">{speechFields.filter(field => field.key !== 'text').map(field => <label key={field.key}>{field.label}
              {isBound(data?.[field.key]) ? <span className="ws-binding">Lấy từ biến của workflow</span>
                : field.key === 'language_code' ? <select value={data?.language_code ?? ''} onChange={e => changeField(step, field.key, e.target.value)}><option value="">Theo mặc định robot</option><option value="vi">Tiếng Việt</option><option value="en">English</option></select>
                  : <input type="number" min={field.min} max={field.max} step="1" placeholder="Theo mặc định robot" value={data?.[field.key] ?? ''} onChange={e => changeField(step, field.key, e.target.value === '' ? '' : Number(e.target.value))} />}
            </label>)}</div>
            {issue && <p className="be-error" role="alert">{issue}</p>}
            <div className="be-actions ws-editor-actions"><span>Chỉ lưu những bước có thay đổi.</span><button className="ws-button" disabled={!changedCodes.has(step.stepCode)} onClick={() => resetStep(step)}><SpeechIcon name="refresh" />Hoàn tác bước này</button></div>
          </fieldset>}
        </article>;
      })}</div>
      {!!steps.length && workflow.status === 'PUBLISHED' && <div className="ws-publish-note"><SpeechIcon name="info" /><p>Lưu và áp dụng sẽ phát hành phiên bản mới. Chọn phiên bản mới khi giao nhiệm vụ. Lịch đã gắn phiên bản cũ tiếp tục dùng phiên bản đó.</p></div>}
      {!!steps.length && <footer className={`be-card ws-save${dirty ? ' has-changes' : ''}`}><div className="ws-save-summary"><span className="ws-save-icon"><SpeechIcon name={dirty ? 'edit' : 'check'} /></span><div><strong>{dirty ? `${changes.length} bước có thay đổi` : 'Lời nói đã đồng bộ với workflow'}</strong>
        <p>Nghe thử dùng giọng trên máy này. Giọng thực tế phụ thuộc cấu hình phát của robot.</p></div>
      </div><div className="be-actions">
        {workflow.status !== 'PUBLISHED' && <button disabled={saving || !dirty || !!invalid || inactive} onClick={() => save(false)}>Lưu bản nháp</button>}
        <button className="primary ws-button" disabled={saving || !dirty || !!invalid || inactive} onClick={() => save(true)}><SpeechIcon name="save" />{saving ? 'Đang lưu…' : 'Lưu và áp dụng'}</button>
      </div>{invalid && <p className="be-error" role="alert">{invalid}</p>}</footer>}
    </>}
  </section>;
}
