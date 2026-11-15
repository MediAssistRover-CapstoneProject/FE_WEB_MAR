import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../features/api/client.js';
import { getSession } from '../../features/auth/session.js';
import './aiWorkspace.css';
import { KNOWLEDGE_DOCUMENTS as DOCS, documentStatuses as statuses, documentPending, loadKnowledgeDocuments, documentUploadBody } from '../../features/api/knowledgeDocuments.js';

import RobotSpeechPanel from '../../features/voice/RobotSpeechPanel.jsx';

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
  return <div className="ai-workspace"><header className="ai-heading"><div><h2>{title}</h2><p>Quản lý trực tiếp trên hệ thống bệnh viện.</p></div><Link to="/admin/ai-test" className="ai-link">Kiểm thử AI →</Link></header>{section==='ai-voice'?<RobotSpeechPanel/>:<KnowledgeEditor/>}</div>;
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
  const [docs,setDocs]=useState(null),a=useActions();
  const refresh=()=>a.run(async signal=>{
    const rows=await loadKnowledgeDocuments(signal);
    if(!signal.aborted)setDocs(rows);
  });
  useEffect(()=>{
    const c=new AbortController();
    loadKnowledgeDocuments(c.signal).then(rows=>{if(!c.signal.aborted)setDocs(rows);})
      .catch(e=>{if(!c.signal.aborted)a.setError(e.message);});
    return()=>c.abort();
  },[]);
  return <section className="be-workspace ai-workspace">
    <header className="ai-heading"><div><h2>Kiểm thử giọng nói và dữ liệu AI</h2><p>Nghe thử giọng robot trên loa của máy và kiểm tra tài liệu đã xử lý.</p></div><Link className="ai-link" to="/admin/voice-scripts?tab=ai-knowledge">Quản lý dữ liệu AI →</Link></header>
    <Notice {...a}/>
    <div className="be-card ai-heading"><div>{docs?<p>{docs.filter(d=>d.status==='COMPLETED').length} / {docs.length} tài liệu sẵn sàng</p>:<p>{a.error?'Chưa tải được danh sách tài liệu.':'Đang tải danh sách tài liệu…'}</p>}<p>Trang này kiểm thử giọng đọc. Hội thoại bằng microphone và trả lời từ tài liệu cần được kiểm thử trên robot.</p></div><button disabled={a.busy} onClick={refresh}>Tải lại trạng thái tài liệu</button></div>
    <RobotSpeechPanel/>
  </section>;
}
