import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, API_BASE_URL } from '../../features/api/client.js';
import { getSession } from '../../features/auth/session.js';
import './aiWorkspace.css';
import { KNOWLEDGE_DOCUMENTS as DOCS, documentStatuses as statuses, documentPending, loadKnowledgeDocuments, documentUploadBody } from '../../features/api/knowledgeDocuments.js';

const VOICE = '/api/v1/admin/assistant/voice';

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
  const [docs,setDocs]=useState([]), [file,setFile]=useState(null), [fileKey,setFileKey]=useState(0);
  const [filter,setFilter]=useState('all'), [query,setQuery]=useState(''), [detail,setDetail]=useState(null);
  const [loading,setLoading]=useState(true), [showAddForm,setShowAddForm]=useState(false), a=useActions();
  const alive=useRef(false), generation=useRef(0);
  const load=async signal=>{
    const current=++generation.current;
    const rows=await loadKnowledgeDocuments(signal);
    if(alive.current&&!signal?.aborted&&current===generation.current){setDocs(rows);setLoading(false);setDetail(previous=>previous?rows.find(d=>d.id===previous.id)||previous:null);}
    return rows;
  };
  useEffect(()=>{alive.current=true;const c=new AbortController();load(c.signal).catch(e=>{if(!c.signal.aborted){a.setError(e.message);setLoading(false);}});return()=>{alive.current=false;c.abort();};},[]);
  useEffect(()=>{
    if(!docs.some(documentPending))return;
    const c=new AbortController();let timer;
    const poll=async()=>{
      try{await load(c.signal);}catch(e){if(!c.signal.aborted){a.setError(e.message);timer=setTimeout(poll,3000);}}
    };
    timer=setTimeout(poll,3000);
    return()=>{clearTimeout(timer);c.abort();};
  },[docs]);
  const reset=()=>{setFile(null);setFileKey(n=>n+1);};
  const save=e=>{e.preventDefault();a.run(async signal=>{
    const uploaded=await apiRequest(DOCS,{method:'POST',body:documentUploadBody(file),signal});
    if(signal.aborted)return;
    reset();setShowAddForm(false);
    a.setMessage(uploaded.status==='COMPLETED'?'Tài liệu đã sẵn sàng cho AI.':documentPending(uploaded)?'Đã nhận tài liệu. Đợi trạng thái Sẵn sàng để AI sử dụng.':`Trạng thái tài liệu: ${statuses[uploaded.status]||uploaded.status}. ${uploaded.errorCode||''}`);
    await load(signal);
  });};
  const shown=docs.filter(d=>(filter==='all'||d.status===filter)&&d.filename.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  return <><Notice {...a}/>
    {!showAddForm?<div style={{marginBottom:16}}><button type="button" className="primary" onClick={()=>{reset();setShowAddForm(true);}}>+ Thêm dữ liệu cho AI</button></div>:
      <form className="be-card" onSubmit={save}><h3>Thêm dữ liệu cho AI</h3><fieldset disabled={a.busy} className="ai-form">
        <label>Tài liệu<input key={fileKey} required type="file" accept=".pdf,.docx,.txt,.md" onChange={e=>setFile(e.target.files[0]||null)}/></label>
        <p className="ai-note">PDF, DOCX, TXT hoặc MD · tối đa 20 MB. TXT và MD cần dùng UTF-8. Tài liệu được xử lý vào kho AI; tải lại cùng nội dung sẽ trả về tài liệu đã có.</p>
        <div className="be-actions"><button type="submit" className="primary">{a.busy?'Đang tải lên…':'Tải tài liệu lên AI'}</button><button type="button" onClick={()=>{setShowAddForm(false);reset();}}>Thu gọn</button></div>
      </fieldset></form>}
    <section className="be-card"><header className="ai-heading"><h3>Kho dữ liệu AI</h3><button disabled={a.busy} onClick={()=>a.run(async signal=>{await load(signal);a.setMessage('Đã tải lại danh sách tài liệu.');})}>Làm mới</button></header>
      <div className="ai-fields"><label>Tìm tài liệu<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tên tệp"/></label><label>Trạng thái<select aria-label="Trạng thái" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tất cả</option>{Object.entries(statuses).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label></div>
      <p>{shown.length} tài liệu · {docs.filter(d=>d.status==='COMPLETED').length} sẵn sàng</p>
      <div className="ai-table"><table><thead><tr><th>Tài liệu</th><th>Dung lượng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{shown.map(d=><tr key={d.id}>
        <td><strong>{d.filename}</strong><small>{new Date(d.updatedAt).toLocaleString('vi-VN')}</small></td><td>{(d.sizeBytes/1024).toLocaleString('vi-VN',{maximumFractionDigits:1})} KB</td>
        <td>{statuses[d.status]||d.status}{d.errorCode&&<small className="be-error">{d.errorCode}</small>}</td>
        <td><button disabled={a.busy} onClick={()=>a.run(async signal=>{const value=await apiRequest(`${DOCS}/${d.id}`,{signal});if(!signal.aborted)setDetail(value);})}>Xem trạng thái</button></td>
      </tr>)}</tbody></table></div>
      {!shown.length&&<p>{loading?'Đang tải kho dữ liệu…':'Không có tài liệu phù hợp.'}</p>}
      {detail&&<details open><summary>{detail.filename}</summary><p>Trạng thái: {statuses[detail.status]||detail.status}</p>{detail.errorCode&&<p className="be-error">Mã lỗi: {detail.errorCode}</p>}<p>Cập nhật: {new Date(detail.updatedAt).toLocaleString('vi-VN')}</p><button onClick={()=>setDetail(null)}>Đóng</button></details>}
    </section></>;
}

export function AiTestPage() {
  if(!isAdmin())return <p role="alert" className="be-error">Trang kiểm thử AI yêu cầu tài khoản ADMIN.</p>;
  return <TestWorkspace/>;
}
function TestWorkspace() {
  const [info,setInfo]=useState(null),a=useActions();
  const frame=useRef(null),[height,setHeight]=useState(760);
  const refresh=()=>a.run(async signal=>{const [voice,docs]=await Promise.all([apiRequest(VOICE,{signal}),loadKnowledgeDocuments(signal)]);setInfo({voice,count:docs.filter(d=>d.status==='COMPLETED').length});});
  useEffect(()=>{const c=new AbortController();Promise.all([apiRequest(VOICE,{signal:c.signal}),loadKnowledgeDocuments(c.signal)]).then(([voice,docs])=>{if(!c.signal.aborted)setInfo({voice,count:docs.filter(d=>d.status==='COMPLETED').length});}).catch(e=>{if(!c.signal.aborted)a.setError(e.message);});return()=>c.abort();},[]);
  // Isolate the existing kiosk engine so leaving the page tears down mic/audio.
  // All data requests still use the configured backend; no admin token enters the frame.
  const base=API_BASE_URL||window.location.origin;
  const srcDoc=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}/assistant.css"><style>body{background:transparent;min-height:0}main{width:100%;margin:0}.card{box-shadow:none}.assistant-stage{display:flex;flex-direction:column;align-items:center;padding:20px}.voice-avatar{position:relative;inset:auto;width:100%;min-height:340px}#answer{white-space:pre-wrap;text-align:center}#mic{margin:16px}#sourceBadge.warning{color:#9a3412}#work{overflow-wrap:anywhere}</style></head><body><main><section class="card assistant-stage"><div id="voiceFace" class="voice-avatar"><div class="robot-face"><div class="robot-ear robot-ear-left"></div><div class="robot-ear robot-ear-right"></div><div class="robot-antenna"><span></span></div><div class="robot-screen"><div class="robot-eyes"><span class="robot-eye"></span><span class="robot-eye"></span></div><div class="robot-cheek robot-cheek-left"></div><div class="robot-cheek robot-cheek-right"></div><div class="robot-mouth"></div></div></div><strong id="faceStatus"></strong><small id="faceHint"></small></div><span id="sourceBadge" class="badge" hidden></span><p id="answer" aria-live="polite"></p><div id="actions"></div><button id="mic" disabled>🎙 Bật voice</button><button id="stopVoice" class="secondary">Dừng giọng nói</button><div id="work" role="status"></div><small id="sessionState"></small></section></main><script>window.MAR_TEST_MODE=true;window.MAR_API_BASE=${JSON.stringify(base).replace(/</g,'\\u003c')};<\/script><script src="${base}/kiosk-voice.js?v=automation-1"><\/script></body></html>`;
  useEffect(()=>{if(!frame.current)return;let observer;const load=()=>{try{const doc=frame.current.contentDocument;observer?.disconnect();observer=new ResizeObserver(()=>setHeight(Math.max(620,doc.body.scrollHeight+30)));observer.observe(doc.body);}catch{}};const f=frame.current;f.addEventListener('load',load);return()=>{f.removeEventListener('load',load);observer?.disconnect();};},[]);
  return <section className="be-workspace ai-workspace"><header className="ai-heading"><div><h2>Kiểm thử AI bệnh viện</h2><p>Thử bằng microphone và loa của laptop, với nguồn bệnh viện và cấu hình giọng hiện tại.</p></div><Link className="ai-link" to="/admin/voice-scripts?tab=ai-voice">Điều chỉnh giọng và dữ liệu →</Link></header><Notice {...a}/><div className="be-card ai-heading"><div>{info?<><strong>{info.voice.kioskEngine==='CLOUD'?`Giọng AI ${info.voice.cloudVoice}`:'Giọng trên máy'} · {info.voice.rate}×</strong><p>{info.count} tài liệu sẵn sàng · Cấu hình phiên bản {info.voice.revision}</p></>:<p>Đang tải cấu hình…</p>}</div><button disabled={a.busy} onClick={refresh}>Tải lại cấu hình kiểm thử</button></div>    <div className="be-card"><p>Bấm Bật voice, nói “hello” rồi đặt câu hỏi. Bấm mic để ngắt lời, Dừng giọng nói để tắt.</p><iframe ref={frame} title="Kiểm thử mic và giọng AI" allow="microphone; autoplay" srcDoc={srcDoc} style={{width:'100%',height,border:0}}/></div>
  </section>;
}
