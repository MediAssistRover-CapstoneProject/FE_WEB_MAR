import { useEffect, useRef, useState } from 'react';
import { getSession } from '../../../features/auth/session.js';
import { jobPath, post, readTracking, request, writeTracking } from '../../../features/robotOperations/api.js';
import { isOperator, terminalJobs } from '../../../features/robotOperations/model.js';
import { ErrorNotice, Field, JobStatus, Picker, useCatalog } from './Shared.jsx';

const delay = (ms, signal) => new Promise((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
});
export default function SpeechAnnouncement() {
  const operator = isOperator(getSession());
  const { catalog, loading, error: catalogError, reload } = useCatalog('SPEECH', operator);
  const [robotId, setRobotId] = useState(() => readTracking('speech')?.robotId || ''), [workflowId, setWorkflowId] = useState('');
  const [text, setText] = useState(''), [languageCode, setLanguageCode] = useState('vi');
  const [jobId, setJobId] = useState(() => readTracking('speech')?.jobId || ''), [detail, setDetail] = useState(null);
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState(null), [pollError, setPollError] = useState(null);
  const [phase, setPhase] = useState(''), [message, setMessage] = useState(''), [revision, setRevision] = useState(0);
  const [recent, setRecent] = useState([]), [uncertain, setUncertain] = useState(false);
  const operation = useRef(null), locked = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current?.abort(); }; }, []);
  useEffect(() => {
    setSnapshot(null); setDetail(null);
    if (!operator || !robotId) return;
    const controller = new AbortController(); let timer;
    const poll = async () => {
      try {
        const [snap, info, jobs] = await Promise.all([
          request(`/api/v1/robots/${encodeURIComponent(robotId)}/snapshot`, { signal: controller.signal }),
          jobId ? request(jobPath(jobId), { signal: controller.signal }) : null,
          request(`/api/v1/jobs?robotId=${encodeURIComponent(robotId)}&size=100`, { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) { setSnapshot(snap); setDetail(info); setRecent((jobs.content || []).filter(j => typeof j.inputJson?.speech_text === 'string')); setPollError(null); }
      } catch (e) { if (!controller.signal.aborted) { setSnapshot(null); setPollError(e); } }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [operator, robotId, jobId, revision]);
  const track = id => { setJobId(id); setDetail(null); writeTracking('speech', { robotId, jobId: id }); setUncertain(false); };
  const robotReady = snapshot?.mqttConnected && snapshot?.heartbeatFresh && snapshot?.dispatchReady && snapshot.robot?.status === 'IDLE' && !snapshot.activeJobId;
  const active = jobId && (!detail || !terminalJobs.has(detail.job.status));
  const submit = async e => {
    e.preventDefault();
    if (locked.current || !operator || !robotReady || active || uncertain || !text.trim() || text.length > 500) return;
    locked.current = true; const controller = new AbortController(); operation.current = controller;
    setError(null); setPhase('prepare'); setMessage('Đang chuẩn bị giọng đọc…'); let creating = false;
    // Freeze the phrase/robot/workflow for the whole preparation transaction.
    const payload = { workflowId, robotId, text: text.trim(), languageCode };
    try {
      const deadline = Date.now() + 150000;
      let prepared = false;
      while (Date.now() < deadline) {
        const result = await post('/api/v1/pi/speech/prepare', { text: payload.text, languageCode, speedWpm: 150 }, { signal: controller.signal });
        if (result.state === 'READY') { prepared = true; break; }
        if (result.state !== 'PENDING') throw Object.assign(Error(result.code || 'Không chuẩn bị được giọng đọc.'), { status: 503 });
        await delay(2000, controller.signal);
      }
      if (!prepared) throw Object.assign(Error('Hết thời gian chuẩn bị giọng đọc; chưa tạo nhiệm vụ.'), { status: 408 });
      if (controller.signal.aborted || !isOperator(getSession())) return;
      const latest = await request(`/api/v1/robots/${encodeURIComponent(robotId)}/snapshot`, { signal: controller.signal });
      if (!latest.mqttConnected || !latest.heartbeatFresh || !latest.dispatchReady || latest.activeJobId || latest.robot?.status !== 'IDLE') throw Object.assign(Error('Robot chưa rảnh hoặc mất kết nối. Kết thúc nhiệm vụ quét trước khi phát thông báo.'), { status: 409 });
      if (controller.signal.aborted) return;
      setPhase('create'); creating = true;
      const result = await post('/api/v1/speech-jobs', payload, { signal: controller.signal, retry: false });
      writeTracking('speech', { jobId: result.jobId, robotId });
      if (mounted.current) { setJobId(result.jobId); setMessage('Đã tạo nhiệm vụ phát thông báo. Đang chờ phản hồi từ robot.'); }
    } catch (e) {
      if (mounted.current) {
        if (creating && (!e.status || e.status >= 500)) { setUncertain(true); setMessage('Chưa xác nhận kết quả tạo nhiệm vụ. Chọn nhiệm vụ trong danh sách gần đây để theo dõi; không gửi lặp.'); }
        else if (e.name === 'AbortError') setMessage('Đã dừng chuẩn bị. Chưa gửi nhiệm vụ phát loa.');
        else { setError(e); setMessage('Chưa hoàn tất yêu cầu phát thông báo.'); }
      }
    } finally { locked.current = false; if (mounted.current) { setPhase(''); setRevision(v => v + 1); } }
  };
  return <section className="ro-workspace" aria-label="Phát thông báo">
    <header className="ro-card ro-hero"><div><span className="ro-badge">Giọng nói robot</span><h2>Phát thông báo</h2><p>Soạn lời nhắn, chuẩn bị giọng đọc và theo dõi kết quả phát trên robot.</p></div><button disabled={!!phase} onClick={() => { reload(); setRevision(v => v + 1); }}>Tải lại trạng thái</button></header>
    {!operator ? <p className="ro-help">Chỉ quản trị viên đăng nhập thật được gửi thông báo đến robot.</p> : <>
      <ErrorNotice error={catalogError} /><div className="ro-columns"><section className="ro-card"><h3>Nội dung thông báo</h3><form onSubmit={submit}><fieldset disabled={!!phase || loading}><div className="ro-fields">
        <Picker label="Robot phát thông báo" value={robotId} onChange={id => { setRobotId(id); setSnapshot(null); setJobId(''); setDetail(null); writeTracking('speech', null); setUncertain(false); }} disabled={!!active} items={catalog.robots} idKey="robotId" nameKey="robotName" empty="Chưa có robot trên máy chủ" />
        <Picker label="Quy trình phát loa đã phát hành" value={workflowId} onChange={setWorkflowId} items={catalog.workflows} idKey="workflowId" nameKey="workflowName" empty="Chưa có quy trình phát loa phù hợp" />
        <div className="ro-form-wide"><Field label="Nội dung thông báo"><textarea required maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder="Nhập nội dung cần robot thông báo…" /></Field><small>{text.length}/500 ký tự</small></div>
        <Field label="Ngôn ngữ"><select value={languageCode} onChange={e => setLanguageCode(e.target.value)}><option value="vi">Tiếng Việt</option><option value="en">Tiếng Anh</option></select></Field>
      </div></fieldset><div className="ro-actions"><button className="primary" type="submit" disabled={!!phase || loading || !!active || !robotReady || !workflowId || !text.trim() || uncertain}>Gửi thông báo tới robot</button>{phase === 'prepare' && <button type="button" onClick={() => operation.current?.abort()}>Dừng chuẩn bị</button>}</div></form>
      {loading && <p role="status">Đang tải danh mục…</p>}{!loading && !catalog.workflows.length && <p className="ro-help">Chưa có quy trình phát loa đã phát hành phù hợp. Kiểm tra mục Quản lý quy trình.</p>}
      {!robotReady && robotId && <p className="ro-help">Robot chưa sẵn sàng hoặc đang có nhiệm vụ. Hãy kết thúc phiên quét và chờ robot rảnh trước khi phát thông báo.</p>}
      {message && <p className="ro-status" role="status">{message}</p>}<ErrorNotice error={error} />
      <details className="ro-details" open={uncertain || undefined}><summary>Nhiệm vụ phát thông báo gần đây</summary><Field label="Theo dõi thông báo"><select value={jobId} disabled={!!phase} onChange={e => track(e.target.value)}><option value="">Chọn nhiệm vụ</option>{jobId && !recent.some(j => j.jobId === jobId) && <option value={jobId}>Nhiệm vụ đang theo dõi</option>}{recent.map(j => <option key={j.jobId} value={j.jobId}>{j.inputJson.speech_text.slice(0, 60)} · {new Date(j.queuedAt).toLocaleString('vi-VN')}</option>)}</select></Field></details>
      </section><JobStatus title="Kết quả phát thông báo" detail={detail} error={pollError} /></div>
    </>}
  </section>;
}
