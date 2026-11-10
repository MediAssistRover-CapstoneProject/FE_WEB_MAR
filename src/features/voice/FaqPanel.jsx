import { useEffect, useState } from 'react';
import { voiceApi } from './voiceApi.js';

const empty = () => ({questions:'',answer:'',source:'',source_excerpt:'',approved:false,visibility:'PUBLIC'});
const unwrap = value => value.data ?? value;
export default function FaqPanel() {
  const [store,setStore]=useState({items:[],revision:'',active:0});
  const [draft,setDraft]=useState(empty);const [id,setId]=useState(null);
  const [message,setMessage]=useState('');const [question,setQuestion]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;voiceApi.listFaqs().then(v=>{if(active)setStore(unwrap(v));}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
  function edit(item){setId(item?.id??null);setDraft(item?{...item,questions:item.questions.join('\n')}:empty());}
  function change(name,value){setDraft(old=>({...old,[name]:value,...(name!=='approved'?{approved:false}:{})}));}
  async function save(event){event.preventDefault();setBusy(true);try{
    const body={questions:draft.questions.split('\n').map(s=>s.trim()).filter(Boolean),answer:draft.answer,source:draft.source,
      source_excerpt:draft.source_excerpt??'',approved:draft.approved,visibility:draft.visibility,revision:store.revision};
    setStore(unwrap(await voiceApi.saveFaq(id,body)));edit(null);setMessage('Đã lưu FAQ vào kho dùng chung của hệ thống.');
  }catch(e){setMessage(e.message);}finally{setBusy(false);}}
  async function remove(){if(!id||!window.confirm('Xóa FAQ đang chọn?'))return;try{setStore(unwrap(await voiceApi.deleteFaq(id,store.revision)));edit(null);setMessage('Đã xóa FAQ.');}catch(e){setMessage(e.message);}}
  async function test(event){event.preventDefault();try{const v=unwrap(await voiceApi.testFaq(question));setMessage(v.matched?`${v.answer} — Tra FAQ: ${v.processing_ms} ms`:'Chưa khớp FAQ đã duyệt. Kiểm tra trạng thái và cách hỏi.');}catch(e){setMessage(e.message);}}
  const field={display:'block',width:'100%',margin:'6px 0 14px',padding:9,border:'1px solid #cbd5e1',borderRadius:6};
  return <section className="monitor-panel" style={{marginTop:24,padding:20}} aria-label="Quản lý FAQ bệnh viện">
    <h2>FAQ trả lời nhanh</h2><p>{store.active} câu đang dùng · {store.items.length} câu đã lưu</p>
    <p role="status">{message}</p>
    <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
      <aside style={{flex:'1 1 240px'}}><button onClick={()=>edit(null)}>Thêm FAQ</button>
        {store.items.map(item=><button key={item.id} onClick={()=>edit(item)} style={{...field,textAlign:'left',background:item.id===id?'#e8f4f1':'white'}}>
          {item.questions[0]}<small style={{display:'block'}}>{item.approved&&item.visibility==='PUBLIC'?'Đang dùng':'Bản nháp'}</small>
        </button>)}
      </aside>
      <form onSubmit={save} style={{flex:'2 1 340px'}}>
        <label>Câu hỏi và các cách hỏi tương đương, mỗi dòng một câu<textarea style={field} required maxLength={4000} rows={3} value={draft.questions} onChange={e=>change('questions',e.target.value)}/></label>
        <label>Câu robot sẽ đọc<textarea style={field} required maxLength={500} rows={3} value={draft.answer} onChange={e=>change('answer',e.target.value)}/></label>
        <label>Nguồn xác nhận<input style={field} required maxLength={500} value={draft.source} onChange={e=>change('source',e.target.value)}/></label>
        {draft.source_excerpt&&<details><summary>Trích đoạn nguồn để kiểm tra</summary><p>{draft.source_excerpt}</p></details>}
        <label>Phạm vi<select style={field} value={draft.visibility} onChange={e=>change('visibility',e.target.value)}><option value="PUBLIC">Công khai cho bệnh nhân</option><option value="INTERNAL">Nội bộ, không dùng cho bệnh nhân</option></select></label>
        <label><input type="checkbox" checked={draft.approved} onChange={e=>change('approved',e.target.checked)}/> Tôi đã kiểm tra nguồn và duyệt câu trả lời này.</label>
        <div style={{display:'flex',gap:12,marginTop:14}}><button disabled={busy||!store.revision}>{draft.approved?'Lưu và bật FAQ':'Lưu bản nháp'}</button><button type="button" disabled={!id} onClick={remove}>Xóa</button></div>
      </form>
    </div>
    <form onSubmit={test} style={{marginTop:20}}><label>Thử FAQ đang bật<input style={field} required value={question} onChange={e=>setQuestion(e.target.value)}/></label><button>Thử câu hỏi</button></form>
  </section>;
}
