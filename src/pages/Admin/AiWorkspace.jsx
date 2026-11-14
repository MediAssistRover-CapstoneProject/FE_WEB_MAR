import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, API_BASE_URL } from '../../features/api/client.js';
import { getSession } from '../../features/auth/session.js';
import './aiWorkspace.css';

const VOICE = '/api/v1/admin/assistant/voice';
const DOCS = '/api/v1/admin/knowledge/documents';
const statuses = { READY:'Sẵn sàng', UPLOADED:'Chờ xử lý', PROCESSING:'Đang xử lý', FAILED:'Xử lý lỗi', ARCHIVED:'Đã xóa khỏi AI' };
const emptyDocument = () => ({title:'', category:'HOSPITAL_INFO', language:'vi-VN', visibility:'PUBLIC', content:'', expectedVersionId:null});
const isAdmin = () => getSession()?.account?.role === 'ADMIN' && getSession()?.mode !== 'demo';
const Notice = ({error, message}) => <>{error && <p role="alert" className="be-error">{error}</p>}{message && <p role="status" className="be-success">{message}</p>}</>;
function useActions() {
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [message,setMessage] = useState('');
  const mounted = useRef(false), active = useRef(null);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; active.current?.abort(); }; },[]);
  const run = async task => {
    if (active.current) return;
    const c = new AbortController(); active.current=c; setBusy(true); setError(''); setMessage('');
    const timer=setTimeout(()=>c.abort(),95000);
    try { await task(c.signal); }
    catch(e) { if(mounted.current) setError(e.name==='AbortError'?'Yêu cầu mất quá nhiều thời gian. Hãy thử lại.':e.message); }
    finally { clearTimeout(timer); active.current=null; if(mounted.current)setBusy(false); }
  };
  return {busy,error,message,run,setError,setMessage};
}
export function AiAdminPanel({section}) {
  if(!isAdmin()) return <p className="be-error">Chức năng này yêu cầu tài khoản ADMIN đang đăng nhập.</p>;
  const title = section==='ai-voice'?'Cấu hình giọng AI':'Nguồn trả lời của AI';
  return <div className="ai-workspace"><header className="ai-heading"><div><h2>{title}</h2><p>Quản lý trực tiếp trên hệ thống bệnh viện.</p></div><Link to="/admin/ai-test" className="ai-link">Kiểm thử AI →</Link></header>{section==='ai-voice'?<VoiceEditor/>:<KnowledgeEditor/>}</div>;
}
function VoiceEditor() {
  const [voice,setVoice]=useState(null), [voices,setVoices]=useState([]), a=useActions();
  const player=useRef(null), url=useRef(null), preview=useRef(null);
  const stop=()=>{preview.current?.abort();preview.current=null;window.speechSynthesis?.cancel();if(player.current){player.current.pause();player.current.removeAttribute('src');}if(url.current){URL.revokeObjectURL(url.current);url.current=null;}};
  useEffect(()=>{
    const c=new AbortController();apiRequest(VOICE,{signal:c.signal}).then(setVoice).catch(e=>{if(!c.signal.aborted)a.setError(e.message);});
    const update=()=>setVoices(window.speechSynthesis?.getVoices()||[]);update();window.speechSynthesis?.addEventListener('voiceschanged',update);
    return ()=>{c.abort();stop();window.speechSynthesis?.removeEventListener('voiceschanged',update);};
  },[]);
  const patch=values=>setVoice(s=>({...s,...values}));
  const previewCloud=()=>a.run(async signal=>{
    stop();const c=new AbortController();preview.current=c;signal.addEventListener('abort',()=>c.abort(),{once:true});
    let blob;try{blob=await apiRequest(VOICE+'/preview',{method:'POST',body:voice,responseType:'blob',signal:c.signal});}catch(e){if(c.signal.aborted&&!signal.aborted)return;throw e;}
    if(c.signal.aborted)return;url.current=URL.createObjectURL(blob);player.current.src=url.current;await player.current.play().catch(()=>{});a.setMessage('Mẫu giọng đã sẵn sàng. Có thể bấm phát để nghe lại.');
  });
  const previewBrowser=()=>{
    stop();if(!window.speechSynthesis){a.setError('Trình duyệt không hỗ trợ giọng đọc.');return;}
    const chosen=voices.find(v=>v.voiceURI===voice.browserVoiceUri);
    if(voice.browserVoiceUri&&!chosen){a.setError('Giọng đã lưu không có trên máy này. Hãy chọn giọng khác.');return;}
    const u=new SpeechSynthesisUtterance('Xin chào, tôi là MAR. Bạn cần hỗ trợ thông tin bệnh viện nào?');u.lang='vi-VN';u.rate=voice.rate;u.voice=chosen||voices.find(v=>/^vi([_-]|$)/i.test(v.lang))||null;
    u.onerror=()=>a.setError('Không phát được giọng đọc trên máy.');speechSynthesis.speak(u);
  };
  return <section className="be-card"><Notice {...a}/>{!voice?<p>Đang tải cấu hình giọng nói…</p>:<>
    <fieldset disabled={a.busy} className="ai-form"><div className="ai-fields">
      <label>Kiosk sử dụng<select aria-label="Kiosk sử dụng" value={voice.kioskEngine||'BROWSER'} onChange={e=>patch({kioskEngine:e.target.value})}><option value="BROWSER">Giọng trên máy · phát nhanh</option><option value="CLOUD">Giọng AI · dùng cả trên laptop</option></select></label>
      <label>Giọng AI<select aria-label="Giọng AI" value={voice.profile} onChange={e=>patch({profile:e.target.value,...(e.target.value==='CUSTOM'?{}:{cloudVoice:e.target.value==='MALE'?'cedar':'coral'})})}><option value="FEMALE">Nữ · Coral</option><option value="MALE">Nam · Cedar</option><option value="CUSTOM">Tùy chọn giọng khác</option></select></label>
      <label>Kiểu giọng<select aria-label="Kiểu giọng" value={voice.cloudVoice} onChange={e=>patch({cloudVoice:e.target.value,profile:e.target.value==='cedar'?'MALE':e.target.value==='coral'?'FEMALE':'CUSTOM'})}>{['coral','cedar','marin','alloy','ash','ballad','echo','sage','shimmer','verse'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Cách thể hiện<select aria-label="Cách thể hiện" value={voice.style} onChange={e=>patch({style:e.target.value})}><option value="CALM">Điềm tĩnh, rõ ràng</option><option value="WARM">Thân thiện, gần gũi</option><option value="FORMAL">Trang trọng, chuyên nghiệp</option></select></label>
      <label>Tốc độ nói · {Number(voice.rate).toFixed(2)}×<input type="range" min="0.75" max="1.5" step="0.05" value={voice.rate} onChange={e=>patch({rate:Number(e.target.value)})}/></label>
      <label>Giọng kiosk có trên máy<select aria-label="Giọng kiosk có trên máy" disabled={voice.kioskEngine==='CLOUD'} value={voice.browserVoiceUri} onChange={e=>patch({browserVoiceUri:e.target.value})}><option value="">Tiếng Việt mặc định</option>{voice.browserVoiceUri&&!voices.some(v=>v.voiceURI===voice.browserVoiceUri)&&<option value={voice.browserVoiceUri}>Giọng đã lưu · không có trên máy này</option>}{[...voices].sort((a,b)=>Number(/^vi/i.test(b.lang))-Number(/^vi/i.test(a.lang))).map(v=><option value={v.voiceURI} key={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label>
    </div><p className="ai-note">Lưu để áp dụng từ lượt nói tiếp theo. Giọng AI cần kết nối mạng; giọng trên máy phụ thuộc giọng đã cài. Phong cách chỉ áp dụng cho giọng AI.</p>
    <div className="be-actions"><button onClick={previewBrowser}>Nghe thử giọng trên máy</button><button onClick={previewCloud}>Nghe thử AI</button><button className="primary" onClick={()=>a.run(async signal=>{const saved=await apiRequest(VOICE,{method:'PUT',body:voice,signal});setVoice(saved);a.setMessage('Đã lưu giọng nói. Áp dụng từ lượt nói tiếp theo.');})}>Lưu giọng nói</button><button onClick={()=>a.run(async signal=>{setVoice(await apiRequest(VOICE,{signal}));a.setMessage('Đã tải cấu hình mới nhất.');})}>Tải lại cấu hình</button></div></fieldset>
    <div className="ai-audio"><audio ref={player} controls preload="none"/><button type="button" onClick={stop}>Dừng nghe</button></div>
  </>}</section>;
}
function KnowledgeEditor() {
  const [docs,setDocs]=useState([]), [form,setForm]=useState(emptyDocument), [editing,setEditing]=useState(null), [file,setFile]=useState(null), [fileKey,setFileKey]=useState(0), [filter,setFilter]=useState('active'), [query,setQuery]=useState(''), [detail,setDetail]=useState(null), [loading,setLoading]=useState(true), [showAddForm,setShowAddForm]=useState(false), a=useActions();
  const alive=useRef(false);
  const load=async signal=>{const d=await apiRequest(DOCS,{signal});if(!Array.isArray(d))throw new Error('Không tải được danh sách tài liệu. Hãy đăng nhập bằng tài khoản ADMIN.');if(alive.current){setDocs(d);setLoading(false);}return d;};
  useEffect(()=>{alive.current=true;const c=new AbortController();load(c.signal).catch(e=>{if(!c.signal.aborted){a.setError(e.message);setLoading(false);}});return()=>{alive.current=false;c.abort();};},[]);
  useEffect(()=>{if(!docs.some(d=>['UPLOADED','PROCESSING'].includes(d.status)))return;const c=new AbortController();const timer=setTimeout(()=>load(c.signal).catch(e=>{if(!c.signal.aborted)a.setError(e.message);}),3000);return()=>{clearTimeout(timer);c.abort();};},[docs]);
  const reset=()=>{setEditing(null);setForm(emptyDocument());setFile(null);setFileKey(n=>n+1);};
  const patch=values=>setForm(s=>({...s,...values}));
  const save=e=>{e.preventDefault();a.run(async signal=>{
    if(!form.title.trim()||!form.category.trim())throw new Error('Hãy nhập tiêu đề và danh mục.');
    if(!file&&!form.content.trim())throw new Error('Nhập nội dung hoặc chọn tài liệu.');
    if(file&&file.size>25*1024*1024)throw new Error('Tệp phải nhỏ hơn hoặc bằng 25 MB.');
    let body=form;
    if(file){body=new FormData();body.append('file',file);for(const k of ['title','category','language','visibility'])body.append(k,form[k]);if(editing)body.append('expectedVersionId',form.expectedVersionId);}
    await apiRequest(DOCS+(editing?'/'+editing:''),{method:editing?'PUT':'POST',body,signal});if(signal.aborted)return;reset();setShowAddForm(false);await load(signal);a.setMessage('Đã lưu. Đợi trạng thái Sẵn sàng để AI sử dụng nội dung mới.');
  });};
  const shown=docs.filter(d=>(filter==='all'||(filter==='active'?d.status!=='ARCHIVED':d.status===filter))&&`${d.title} ${d.category}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  const isFormOpen = showAddForm || Boolean(editing);
  return <><Notice {...a}/>
  {!isFormOpen ? (
    <div style={{ marginBottom: 16 }}>
      <button type="button" className="primary" onClick={() => { setShowAddForm(true); reset(); }}>
        + Thêm dữ liệu cho AI
      </button>
    </div>
  ) : (
    <form className="be-card" onSubmit={save}>
      <header className="ai-heading">
        <h3>{editing ? 'Sửa tài liệu' : 'Thêm dữ liệu cho AI'}</h3>
        <div className="be-actions">
          <button type="button" disabled={a.busy} onClick={reset}>Tạo mới</button>
          <button type="button" onClick={() => { setShowAddForm(false); reset(); }}>Thu gọn</button>
        </div>
      </header>
      <fieldset disabled={a.busy} className="ai-form">
        <div className="ai-fields">
          <label>Tiêu đề<input required maxLength={255} value={form.title} onChange={e=>patch({title:e.target.value})}/></label>
          <label>Danh mục<input required maxLength={80} value={form.category} onChange={e=>patch({category:e.target.value})}/></label>
          <label>Ngôn ngữ<select aria-label="Ngôn ngữ" value={form.language} onChange={e=>patch({language:e.target.value})}><option value="vi-VN">Tiếng Việt</option><option value="en-US">English</option></select></label>
          <label>Phạm vi<select aria-label="Phạm vi" value={form.visibility} onChange={e=>patch({visibility:e.target.value})}><option value="PUBLIC">Công khai · kiosk được tra cứu</option><option value="INTERNAL">Nội bộ · nhân viên</option></select></label>
        </div>
        <label>Nội dung để AI tra cứu<textarea rows={7} maxLength={200000} value={form.content} onChange={e=>patch({content:e.target.value})}/></label>
        <label>Tài liệu mới hoặc tệp thay thế<input key={fileKey} type="file" accept=".docx,.pdf,.jpg,.jpeg,.png" onChange={e=>setFile(e.target.files[0]||null)}/></label>
        <p className="ai-note">DOCX, PDF, JPG, PNG · tối đa 25 MB. Nếu chọn tệp, nội dung được lấy từ tệp. Mỗi lần sửa lưu thành phiên bản mới.</p>
        <div className="be-actions">
          <button type="submit" className="primary">{a.busy?'Đang xử lý…':'Lưu và cập nhật AI'}</button>
          <button type="button" onClick={() => { setShowAddForm(false); reset(); }}>{editing ? 'Hủy chỉnh sửa' : 'Thu gọn'}</button>
        </div>
      </fieldset>
    </form>
  )}
  <section className="be-card"><header className="ai-heading"><h3>Kho dữ liệu AI</h3><button disabled={a.busy} onClick={()=>a.run(signal=>load(signal))}>Làm mới</button></header><div className="ai-fields"><label>Tìm tài liệu<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tiêu đề hoặc danh mục"/></label><label>Trạng thái<select aria-label="Trạng thái" value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Đang sử dụng / xử lý</option><option value="all">Tất cả</option><option value="ARCHIVED">Đã xóa khỏi AI</option><option value="FAILED">Xử lý lỗi</option></select></label></div><p>{shown.length} tài liệu · {docs.filter(d=>d.status==='READY').length} sẵn sàng</p><div className="ai-table"><table><thead><tr><th>Tài liệu</th><th>Phạm vi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{shown.map(d=>{const busy=['UPLOADED','PROCESSING'].includes(d.status);return <tr key={d.id}><td><strong>{d.title}</strong><small>{d.category} · {d.filename}</small><small>{new Date(d.updatedAt).toLocaleString('vi-VN')}</small></td><td>{d.visibility==='PUBLIC'?'Công khai':'Nội bộ'}</td><td>{statuses[d.status]||d.status}</td><td><div className="be-actions">
    <button disabled={a.busy} onClick={()=>a.run(async signal=>setDetail(await apiRequest(`${DOCS}/${d.id}`,{signal})))}>Xem</button>
    <button disabled={a.busy||busy||d.status==='ARCHIVED'} onClick={()=>a.run(async signal=>{setShowAddForm(true);const editor=await apiRequest(`${DOCS}/${d.id}/editor`,{signal});setEditing(d.id);setForm({title:d.title,category:d.category,language:d.language,visibility:d.visibility,content:editor.content,expectedVersionId:editor.versionId});setFile(null);setFileKey(n=>n+1);})}>Sửa</button>
    <button disabled={a.busy||busy} onClick={()=>a.run(async signal=>{await apiRequest(`${DOCS}/${d.id}/reindex`,{method:'POST',signal});await load(signal);})}>{d.status==='ARCHIVED'?'Khôi phục':'Xử lý lại'}</button>
    {d.status!=='ARCHIVED'&&<button className="danger" disabled={a.busy} onClick={()=>{if(!window.confirm(`Xóa “${d.title}” khỏi nguồn trả lời AI? Có thể khôi phục trong danh sách đã xóa.`))return;a.run(async signal=>{await apiRequest(`${DOCS}/${d.id}`,{method:'DELETE',signal});if(editing===d.id)reset();if(detail?.id===d.id)setDetail(null);await load(signal);a.setMessage('Đã loại tài liệu khỏi nguồn trả lời AI.');});}}>Xóa khỏi AI</button>}
  </div></td></tr>;})}</tbody></table></div>{!shown.length&&<p>{loading?'Đang tải kho dữ liệu…':'Không có tài liệu phù hợp.'}</p>}{detail&&<details open><summary>Nội dung: {detail.title}</summary>{detail.errorMessage&&<p className="be-error">{detail.errorMessage}</p>}<pre>{detail.preview}{'\n\n'}{detail.chunks?.map(c=>`${c.locator||''}\n${c.content}`).join('\n\n')}</pre><button onClick={()=>setDetail(null)}>Đóng nội dung</button></details>}</section></>;
}

export function AiTestPage() {
  if(!isAdmin())return <p role="alert" className="be-error">Trang kiểm thử AI yêu cầu tài khoản ADMIN.</p>;
  return <TestWorkspace/>;
}
function TestWorkspace() {
  const [info,setInfo]=useState(null),a=useActions();
  const frame=useRef(null),[height,setHeight]=useState(760);
  const refresh=()=>a.run(async signal=>{const [voice,docs]=await Promise.all([apiRequest(VOICE,{signal}),apiRequest(DOCS,{signal})]);setInfo({voice,count:docs.filter(d=>d.status==='READY'&&d.visibility==='PUBLIC').length});});
  useEffect(()=>{const c=new AbortController();Promise.all([apiRequest(VOICE,{signal:c.signal}),apiRequest(DOCS,{signal:c.signal})]).then(([voice,docs])=>{if(!c.signal.aborted)setInfo({voice,count:docs.filter(d=>d.status==='READY'&&d.visibility==='PUBLIC').length});}).catch(e=>{if(!c.signal.aborted)a.setError(e.message);});return()=>c.abort();},[]);
  // Isolate the existing kiosk engine so leaving the page tears down mic/audio.
  // All data requests still use the configured backend; no admin token enters the frame.
  const base=API_BASE_URL||window.location.origin;
  const srcDoc=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}/assistant.css"><style>body{background:transparent;min-height:0}main{width:100%;margin:0}.card{box-shadow:none}.assistant-stage{display:flex;flex-direction:column;align-items:center;padding:20px}.voice-avatar{position:relative;inset:auto;width:100%;min-height:340px}#answer{white-space:pre-wrap;text-align:center}#mic{margin:16px}#sourceBadge.warning{color:#9a3412}#work{overflow-wrap:anywhere}</style></head><body><main><section class="card assistant-stage"><div id="voiceFace" class="voice-avatar"><div class="robot-face"><div class="robot-ear robot-ear-left"></div><div class="robot-ear robot-ear-right"></div><div class="robot-antenna"><span></span></div><div class="robot-screen"><div class="robot-eyes"><span class="robot-eye"></span><span class="robot-eye"></span></div><div class="robot-cheek robot-cheek-left"></div><div class="robot-cheek robot-cheek-right"></div><div class="robot-mouth"></div></div></div><strong id="faceStatus"></strong><small id="faceHint"></small></div><span id="sourceBadge" class="badge" hidden></span><p id="answer" aria-live="polite"></p><div id="actions"></div><button id="mic" disabled>🎙 Bật voice</button><button id="stopVoice" class="secondary">Dừng giọng nói</button><div id="work" role="status"></div><small id="sessionState"></small></section></main><script>window.MAR_TEST_MODE=true;window.MAR_API_BASE=${JSON.stringify(base).replace(/</g,'\\u003c')};<\/script><script src="${base}/kiosk-voice.js?v=automation-1"><\/script></body></html>`;
  useEffect(()=>{if(!frame.current)return;let observer;const load=()=>{try{const doc=frame.current.contentDocument;observer?.disconnect();observer=new ResizeObserver(()=>setHeight(Math.max(620,doc.body.scrollHeight+30)));observer.observe(doc.body);}catch{}};const f=frame.current;f.addEventListener('load',load);return()=>{f.removeEventListener('load',load);observer?.disconnect();};},[]);
  return <section className="be-workspace ai-workspace"><header className="ai-heading"><div><h2>Kiểm thử AI bệnh viện</h2><p>Thử bằng microphone và loa của laptop, với nguồn bệnh viện và cấu hình giọng hiện tại.</p></div><Link className="ai-link" to="/admin/voice-scripts?tab=ai-voice">Điều chỉnh giọng và dữ liệu →</Link></header><Notice {...a}/><div className="be-card ai-heading"><div>{info?<><strong>{info.voice.kioskEngine==='CLOUD'?`Giọng AI ${info.voice.cloudVoice}`:'Giọng trên máy'} · {info.voice.rate}×</strong><p>{info.count} tài liệu công khai sẵn sàng · Cấu hình phiên bản {info.voice.revision}</p></>:<p>Đang tải cấu hình…</p>}</div><button disabled={a.busy} onClick={refresh}>Tải lại cấu hình kiểm thử</button></div>    <div className="be-card"><p>Bấm Bật voice, nói “hello” rồi đặt câu hỏi. Bấm mic để ngắt lời, Dừng giọng nói để tắt.</p><iframe ref={frame} title="Kiểm thử mic và giọng AI" allow="microphone; autoplay" srcDoc={srcDoc} style={{width:'100%',height,border:0}}/></div>
  </section>;
}
