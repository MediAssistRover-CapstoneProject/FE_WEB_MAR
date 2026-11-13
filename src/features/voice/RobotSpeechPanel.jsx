import { useEffect, useRef, useState } from 'react';
import { robotSpeechApi, robotVoices, speechFailure, speechProfileError } from './robotSpeechApi.js';
import './robotSpeech.css';

function VoiceIcon({ name }) {
  const shapes = {
    wave: <path d="M3 10v4M7.5 6v12M12 3v18M16.5 7v10M21 10v4" />,
    sliders: <><path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6" /></>,
    headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="5" height="9" rx="2" /><rect x="16" y="12" width="5" height="9" rx="2" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18A8 8 0 0 1 5 15" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></>,
    play: <path d="m9 5 11 7-11 7V5Z" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] || shapes.wave}</svg>;
}

function VoiceWave() {
  return <div className="rv-wave" aria-hidden="true">{[12, 22, 34, 19, 45, 60, 38, 72, 52, 30, 62, 44, 24, 40, 27, 17, 10].map((height, index) => <span key={index} style={{ '--bar-height': `${height}px` }} />)}</div>;
}

const sameProfile = (a, b) => a && b && a.voice === b.voice
  && a.speedMultiplier === b.speedMultiplier && a.instructions === b.instructions;

export default function RobotSpeechPanel({ onDirtyChange }) {
  const [saved, setSaved] = useState(null), [form, setForm] = useState(null);
  const [status, setStatus] = useState(null), [statusError, setStatusError] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [text, setText] = useState('Xin chào, tôi là robot hỗ trợ bệnh viện MediAssist.'), [language, setLanguage] = useState('vi');
  const [audioReady, setAudioReady] = useState(false);
  const active = useRef(null), mounted = useRef(false), player = useRef(null), audioUrl = useRef(null);
  const dirty = !!form && !sameProfile(form, saved);
  const invalid = form ? speechProfileError(form) : '';

  function clearAudio() {
    if (player.current) { player.current.pause(); player.current.removeAttribute('src'); player.current.load(); }
    if (audioUrl.current) { URL.revokeObjectURL(audioUrl.current); audioUrl.current = null; }
  }
  function stop() {
    if (active.current?.kind === 'preview') active.current.controller.abort();
    clearAudio(); setAudioReady(false);
  }
  async function run(kind, task) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = { kind, controller }; setBusy(kind); setError(''); setMessage('');
    const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), 90000);
    try { await task(controller.signal); }
    catch (e) {
      if (mounted.current && active.current?.controller === controller && e.name !== 'AbortError') setError(e.name === 'TimeoutError'
        ? 'Yêu cầu mất quá nhiều thời gian. Hãy thử lại.' : speechFailure(e));
    } finally {
      clearTimeout(timer);
      if (active.current?.controller === controller) {
        active.current = null;
        if (mounted.current) setBusy('');
      }
    }
  }
  async function load(signal) {
    setStatusError('');
    const [profile, health] = await Promise.allSettled([robotSpeechApi.get(signal), robotSpeechApi.status(signal)]);
    if (signal.aborted || !mounted.current) return;
    if (health.status === 'fulfilled') setStatus(health.value);
    else { setStatus(null); setStatusError('Chưa kiểm tra được trạng thái dịch vụ giọng nói.'); }
    if (profile.status === 'rejected') throw profile.reason;
    setSaved(profile.value); setForm(profile.value);
  }
  useEffect(() => {
    mounted.current = true;
    run('load', load);
    return () => { mounted.current = false; active.current?.controller.abort(); active.current = null; clearAudio(); };
  }, []);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    const guard = event => { if (dirty || busy === 'save') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);

  function patch(values) { stop(); setMessage(''); setForm(previous => ({ ...previous, ...values })); }
  function reset() { stop(); setError(''); setMessage(''); setForm({ ...saved }); }
  function save() {
    if (!dirty || invalid) return;
    stop();
    run('save', async signal => {
      const result = await robotSpeechApi.save(form, signal);
      if (signal.aborted || !mounted.current) return;
      setSaved(result); setForm(result);
      setMessage('Đã lưu giọng robot. Các câu tạo mới sẽ dùng cấu hình này.');
    });
  }
  function preview() {
    if (dirty || !text.trim() || text.length > 500) return;
    stop();
    run('preview', async signal => {
      const blob = await robotSpeechApi.preview(text.trim(), language, signal);
      if (signal.aborted || !mounted.current) return;
      audioUrl.current = URL.createObjectURL(blob);
      player.current.src = audioUrl.current; setAudioReady(true);
      try { await player.current.play(); }
      catch { if (!signal.aborted) setMessage('Âm thanh đã sẵn sàng. Bấm phát trên trình nghe để nghe thử.'); }
    });
  }
  const unavailable = status?.tts && (!status.tts.enabled || !status.tts.configured);
  const serviceState = busy === 'load' ? 'checking' : !status?.tts ? 'unknown' : unavailable ? 'warning' : 'ready';
  const serviceTitle = { checking: 'Đang kiểm tra dịch vụ', unknown: 'Chưa xác định trạng thái', warning: 'Dịch vụ cần được thiết lập', ready: 'Dịch vụ đã được cấu hình' }[serviceState];
  const speed = Number.isFinite(form?.speedMultiplier) ? form.speedMultiplier : 1.25;
  return <section className="robot-voice-page rv-page" aria-label="Giọng robot">
    <header className="rv-heading"><div className="rv-heading-copy"><span className="rv-heading-icon"><VoiceIcon name="wave" /></span><div>
      <span className="rv-eyebrow">CẤU HÌNH ÂM THANH</span><h2>Giọng nói của robot</h2>
      <p>Một giọng nói nhất quán cho mọi tương tác của robot.</p></div></div>
      <button className="rv-button rv-refresh" disabled={!!busy} onClick={() => {
        if (dirty && !window.confirm('Bỏ các thay đổi giọng robot chưa lưu và tải lại?')) return;
        stop(); run('load', load);
      }}><VoiceIcon name="refresh" />Tải lại cấu hình</button>
    </header>
    <div className={`rv-service is-${serviceState}`} role="status"><span className="rv-service-icon"><VoiceIcon name={serviceState === 'ready' ? 'check' : 'info'} /></span>
      <div className="rv-service-copy"><strong>{serviceTitle}</strong><p>{statusError || (status?.tts ? !status.tts.enabled ? 'Máy chủ chưa bật giọng nói robot.'
        : !status.tts.configured ? 'Máy chủ chưa cấu hình dịch vụ giọng nói.' : 'Dịch vụ giọng nói đã bật và có cấu hình.' : 'Trạng thái giọng nói sẽ được cập nhật từ máy chủ.')}</p></div>
      <span className="rv-scope"><VoiceIcon name="globe" />Dùng chung cho các robot</span>
    </div>
    {error && <p className="rv-notice is-error" role="alert"><VoiceIcon name="info" />{error}</p>}
    {message && <p className="rv-notice is-success" role="status"><VoiceIcon name="check" />{message}</p>}
    {!form && busy === 'load' && <div className="rv-loading" role="status"><VoiceIcon name="refresh" />Đang tải cấu hình giọng robot…</div>}
    {form && <div className="rv-layout">
      <section className="rv-card rv-settings" aria-labelledby="rv-settings-title">
        <header className="rv-card-heading"><div className="rv-card-title"><span className="rv-card-icon"><VoiceIcon name="sliders" /></span><div><h3 id="rv-settings-title">Thiết lập giọng đọc</h3><p>Chọn giọng và cách robot thể hiện lời nói.</p></div></div>
          <span className={`rv-badge${dirty ? ' is-dirty' : ''}`}>{dirty ? 'Chưa lưu thay đổi' : 'Đã đồng bộ'}</span></header>
        <fieldset className="rv-form" disabled={!!busy}>
          <div className="rv-field"><label htmlFor="rv-voice">Giọng robot</label><div className="rv-voice-select"><span className="rv-voice-avatar"><VoiceIcon name="wave" /></span><select id="rv-voice" value={form.voice} onChange={e => patch({ voice: e.target.value })}>
            {robotVoices.map(voice => <option key={voice} value={voice}>{voice.charAt(0).toUpperCase() + voice.slice(1)}</option>)}
          </select></div><p className="rv-hint">Giọng này sẽ dùng cho các câu nói được tạo sau khi lưu.</p></div>
          <div className="rv-field rv-speed-field"><div className="rv-label-row"><label htmlFor="rv-speed">Tốc độ nói (lần)</label><div className="rv-speed-value"><input id="rv-speed" type="number" min="0.25" max="4" step="0.05" value={form.speedMultiplier}
            onChange={e => patch({ speedMultiplier: e.target.value === '' ? '' : Number(e.target.value) })} /><span aria-hidden="true">×</span></div></div>
            <input className="rv-speed-slider" type="range" aria-label="Điều chỉnh tốc độ nói" min="0.25" max="4" step="0.05" value={Math.min(4, Math.max(0.25, speed))}
              style={{ '--range-progress': `${(Math.min(4, Math.max(0.25, speed)) - .25) / 3.75 * 100}%` }} onChange={e => patch({ speedMultiplier: Number(e.target.value) })} />
            <div className="rv-speed-labels"><span>Chậm · 0.25×</span><span>Nhanh · 4×</span></div>
          </div>
          <div className="rv-field"><div className="rv-label-row"><label htmlFor="rv-instructions">Hướng dẫn cách đọc</label><span className="rv-count">{form.instructions.length}/1000</span></div>
            <textarea id="rv-instructions" rows={5} maxLength={1000} value={form.instructions} placeholder="Ví dụ: Nói tiếng Việt tự nhiên, điềm tĩnh, ngắt nghỉ nhẹ nhàng."
              onChange={e => patch({ instructions: e.target.value })} />
            <p className="rv-hint">Mô tả ngữ điệu, cách phát âm và nhịp đọc bạn mong muốn.</p></div>
          {invalid && <p className="rv-notice is-error" role="alert">{invalid}</p>}
          <footer className="rv-settings-footer"><span className={`rv-save-state${dirty ? ' is-dirty' : ''}`}><span />{dirty ? 'Có thay đổi chưa lưu' : 'Cấu hình đã được lưu'}</span><div>
            <button className="rv-button rv-reset" disabled={!dirty} onClick={reset}>Hoàn tác</button>
            <button className="rv-button rv-primary" disabled={!dirty || !!invalid} onClick={save}><VoiceIcon name="save" />{busy === 'save' ? 'Đang lưu…' : 'Lưu giọng robot'}</button></div></footer>
        </fieldset>
      </section>
      <section className="rv-card rv-preview" aria-labelledby="rv-preview-title">
        <header className="rv-card-heading"><div className="rv-card-title"><span className="rv-card-icon is-purple"><VoiceIcon name="headphones" /></span><div><h3 id="rv-preview-title">Nghe thử giọng robot</h3><p>Trải nghiệm âm thanh ngay trên thiết bị này.</p></div></div></header>
        <div className="rv-preview-body">
          <div className="rv-voice-stage"><div className="rv-stage-top"><span className="rv-stage-label">GIỌNG ĐÃ LƯU</span><span className="rv-stage-format">Nghe thử</span></div>
            <VoiceWave /><div className="rv-stage-profile"><strong>{saved.voice}</strong><span>{saved.speedMultiplier}× <i />{language === 'vi' ? 'Tiếng Việt' : 'English'}</span></div>
          </div>
          <fieldset className="rv-form rv-preview-form" disabled={!!busy}>
            <div className="rv-field"><div className="rv-label-row"><label htmlFor="rv-preview-text">Nội dung nghe thử</label><span className="rv-count">{text.length}/500</span></div><textarea id="rv-preview-text" rows={4} maxLength={500} value={text}
              onChange={e => { stop(); setText(e.target.value); }} /></div>
            <div className="rv-field"><label htmlFor="rv-language">Ngôn ngữ nghe thử</label><select id="rv-language" value={language} onChange={e => { stop(); setLanguage(e.target.value); }}>
              <option value="vi">Tiếng Việt</option><option value="en">English</option></select></div>
            {dirty && <p className="rv-preview-warning"><VoiceIcon name="info" />Lưu thay đổi giọng robot trước khi nghe thử.</p>}
            <button className="rv-button rv-preview-button" disabled={dirty || !!invalid || !text.trim() || !!unavailable} onClick={preview}><VoiceIcon name={busy === 'preview' ? 'wave' : 'play'} />Nghe thử giọng robot</button>
          </fieldset>
          <div className={`rv-player${audioReady ? ' has-audio' : ''}`}>
            <div className="rv-player-heading"><span><VoiceIcon name="headphones" />{busy === 'preview' ? 'Đang tạo âm thanh nghe thử…' : audioReady ? 'Bản nghe thử đã sẵn sàng' : 'Bản nghe thử'}</span>
              <button className="rv-stop" disabled={busy !== 'preview' && !audioReady} onClick={stop}><VoiceIcon name="stop" />Dừng nghe</button></div>
            {busy === 'preview' && <p className="rv-hint" role="status">Đang tạo âm thanh nghe thử…</p>}
            {!audioReady && busy !== 'preview' && <p className="rv-hint">Âm thanh sẽ xuất hiện sau khi bạn bấm nghe thử.</p>}
            <audio ref={player} aria-label="Âm thanh giọng robot" controls preload="none" hidden={!audioReady} />
          </div>
        </div>
      </section>
      <div className="rv-footnote"><VoiceIcon name="info" /><p>Lưu để áp dụng cho các câu nói tiếp theo của robot. Nghe thử sử dụng cấu hình đã lưu và phát trên thiết bị này.</p></div>
    </div>}
  </section>;
}
