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
    setCatalogLoading(true);
    loadAllPages(workflowApi.list)
      .then(items => Promise.all(items.map(item => workflowApi.get(item.workflowId))))
      .then(details => {
        if (active) setCatalog(details.filter(item => speechSteps(item).length > 0).map(item => item.workflow));
      })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    if (savedSelection.current === workflowId && workflowId) {
      savedSelection.current = '';
      return;
    }
    let active = true;
    setDetail(null); setDrafts({}); setEditing(''); setError(''); setMessage('');
    stop();
    if (!workflowId) { setLoading(false); return; }
    setLoading(true);
    workflowApi.get(workflowId).then(value => { if (active) setDetail(value); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
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
    <header className="ai-heading"><div><h2>Lời nói workflow</h2><p>Sửa nhanh lời robot đọc ở từng bước tương tác.</p></div>
      <button disabled={saving || loading || catalogLoading} onClick={() => {
        if (!dirty || window.confirm('Bỏ các thay đổi chưa lưu và tải lại từ máy chủ?')) setRevision(value => value + 1);
      }}>Tải lại</button>
    </header>
    <div className="be-card ws-picker"><div className="ai-fields">
      <label>Tìm workflow<input type="search" value={workflowSearch} onChange={e => setWorkflowSearch(e.target.value)} placeholder="Tên hoặc mã workflow" /></label>
      <label>Workflow<select aria-label="Workflow" value={workflowId} disabled={saving || catalogLoading} onChange={e => selectWorkflow(e.target.value)}>
        <option value="">{catalogLoading ? 'Đang tải workflow…' : 'Chọn workflow cần sửa lời nói'}</option>
        {workflowId && workflow?.workflowId === workflowId && steps.length > 0 && !catalog.some(item => item.workflowId === workflowId)
          && <option value={workflowId}>{workflow.workflowName}</option>}
        {listed.map(item => <option key={item.workflowId} value={item.workflowId}>{item.workflowName} · v{item.versionNo} · {workflowStatusLabel(item.status)}</option>)}
      </select></label>
    </div>{!catalogLoading && !catalog.length && <p>Chưa có workflow có bước phát lời nói trên máy chủ. <Link className="ai-link" to="/workflow">Mở trình thiết kế workflow</Link></p>}</div>
    {error && <p className="be-error" role="alert">{error}</p>}
    {message && <p className="be-success" role="status">{message}</p>}
    {loading && <p role="status">Đang tải các bước tương tác…</p>}
    {!workflowId && !loading && <div className="be-card ws-empty">Chọn workflow để xem và chỉnh lời nói của robot.</div>}
    {workflow && <>
      <div className="ws-workflow-heading"><div><h3>{workflow.workflowName} <span>v{workflow.versionNo} · {workflowStatusLabel(workflow.status)}</span></h3>
        <p>{steps.length} bước phát lời nói{dirty ? ` · ${changes.length} bước đã sửa` : ''}</p></div>
        <Link className="ai-link" to={`/workflow?workflowId=${workflow.workflowId}`} onClick={event => {
          if (saving || dirty && !window.confirm('Bỏ các thay đổi chưa lưu để mở trình thiết kế workflow?')) event.preventDefault();
        }}>Mở workflow ↗</Link>
      </div>
      <label className="ws-search">Tìm bước hoặc lời nói<input type="search" value={stepSearch} onChange={e => setStepSearch(e.target.value)} placeholder="Tên bước, mã bước hoặc câu robot đọc" /></label>
      {inactive && <p className="ai-note">Phiên bản này đã ngừng sử dụng. Chọn bản nháp hoặc phiên bản đang phát hành để chỉnh sửa.</p>}
      {!steps.length && <div className="be-card ws-empty">Workflow này chưa có bước phát lời nói. Thêm bước Tương tác với hành động Phát lời nói trong trình thiết kế.</div>}
      {!!steps.length && !shown.length && <p role="status">Không có bước phù hợp với nội dung tìm kiếm.</p>}
      <div className="ws-steps">{shown.map(step => {
        const data = drafts[step.stepCode] ?? speechData(step);
        const editable = editableSpeechData(step) && !inactive;
        const open = editing === step.stepCode;
        const text = typeof data?.text === 'string' ? data.text : 'Lời nói lấy từ biến khi workflow chạy';
        const issue = changedCodes.has(step.stepCode) ? speechError(data) : '';
        const task = detail.tasks?.find(item => item.taskId === step.taskId);
        return <article className={`be-card ws-step${open ? ' is-editing' : ''}`} key={step.stepCode}>
          <div className="ws-step-heading"><div><h4>{step.stepName}</h4><p>{task?.taskName ? `${task.taskName} · ` : ''}Bước {step.sequenceNo}{step.enabled === false ? ' · Đã tắt' : ''}{changedCodes.has(step.stepCode) ? ' · Chưa lưu' : ''}</p></div>
            <div className="be-actions"><button disabled={saving || typeof data?.text !== 'string' || !data.text.trim() || !!speechError(data)} onClick={() => playing === step.stepCode ? stop() : preview(step, data)}>{playing === step.stepCode ? 'Dừng nghe' : 'Nghe thử trên máy'}</button>
              <button aria-expanded={open} disabled={saving || !editable} onClick={() => setEditing(open ? '' : step.stepCode)}>{open ? 'Thu gọn' : 'Sửa lời nói'}</button></div>
          </div>
          {!open && <p className="ws-text">{text}</p>}
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
            <div className="be-actions"><button disabled={!changedCodes.has(step.stepCode)} onClick={() => resetStep(step)}>Hoàn tác bước này</button></div>
          </fieldset>}
        </article>;
      })}</div>
      {!!steps.length && <footer className="be-card ws-save"><div><strong>{dirty ? `${changes.length} bước có thay đổi` : 'Lời nói đã đồng bộ với workflow'}</strong>
        <p>Nghe thử dùng giọng trên máy này. Giọng thực tế phụ thuộc cấu hình phát của robot.</p>
        {workflow.status === 'PUBLISHED' && <p>Lưu và áp dụng sẽ phát hành phiên bản mới. Chọn phiên bản mới khi giao nhiệm vụ. Lịch đã gắn phiên bản cũ tiếp tục dùng phiên bản đó.</p>}
      </div><div className="be-actions">
        {workflow.status !== 'PUBLISHED' && <button disabled={saving || !dirty || !!invalid || inactive} onClick={() => save(false)}>Lưu bản nháp</button>}
        <button className="primary" disabled={saving || !dirty || !!invalid || inactive} onClick={() => save(true)}>{saving ? 'Đang lưu…' : 'Lưu và áp dụng'}</button>
      </div>{invalid && <p className="be-error" role="alert">{invalid}</p>}</footer>}
    </>}
  </section>;
}
