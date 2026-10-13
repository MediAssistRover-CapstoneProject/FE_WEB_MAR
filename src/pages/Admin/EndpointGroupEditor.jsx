import { useEffect, useState } from 'react';
import { groupError, SELECTION_POLICIES, API_SELECTION_POLICIES, POLICY_HELP } from '../../features/facility/endpointGroups.js';

const empty = () => ({ id:'', code:'', name:'', selectionPolicy:'PRIORITY', allowFallback:false, active:true, description:'', members:[] });
export default function EndpointGroupEditor({groups, endpoints, onSave, onMember, onRemove, onDirtyChange, busy=false, remote=false}) {
  const [form,setForm]=useState(empty),[member,setMember]=useState({endpointId:'',sequenceNo:1,active:true}),[error,setError]=useState('');
  const selected=groups.find(g=>g.id===form.id);
  const members=selected?.members||[];
  const baseline=selected||empty();
  const formDirty=Object.keys(empty()).filter(k=>k!=='members').some(k=>form[k]!==baseline[k]);
  const savedMember=members.find(m=>m.endpointId===member.endpointId);
  const dirty=formDirty||!!member.endpointId&&(!savedMember||['sequenceNo','active'].some(k=>member[k]!==savedMember[k]));
  useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange?.(false),[onDirtyChange]);
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  const run=async action=>{setError('');try{await action();}catch(e){setError(e.message||'Không lưu được thay đổi.');}};
  const select=id=>{const g=groups.find(g=>g.id===id);setForm(g?structuredClone(g):empty());setMember({endpointId:'',sequenceNo:Math.max(0,...(g?.members||[]).map(m=>m.sequenceNo))+1,active:true});setError('');};
  return <section className="ls-panel" aria-label="Quản lý nhóm điểm đích"><h3>Nhóm điểm đích</h3>
    <p>Gộp các điểm có cùng chức năng. Khi điều phối, robot chọn <strong>một điểm</strong> phù hợp theo chính sách của nhóm.</p>
    <details className="ls-advanced"><summary>Cách thử nhóm trong Điều phối</summary><p>Ví dụ: tạo hai điểm nhận thuốc A và B → tạo nhóm “Quầy nhận thuốc” → thêm A, B làm thành viên → lưu bản đồ. Trong Điều phối, chọn “Nhóm: Quầy nhận thuốc” ở Điểm tiếp theo và chạy.</p><p>Chọn Cân bằng lượt phục vụ để thấy A/B thay phiên sau mỗi lượt hoàn tất. Với thứ tự ưu tiên, tắt thành viên A hoặc bật thử điểm kế tiếp khi A không có đường để kiểm tra chọn B.</p><p>Nhóm không phải một vùng trên bản đồ, không phải tuyến ghé tất cả các điểm và không phải cơ chế dùng chung quyền sở hữu điểm.</p></details>
    <label className="ls-field">Nhóm đang chỉnh<select aria-label="Nhóm đang chỉnh" value={form.id} disabled={busy} onChange={e=>select(e.target.value)}><option value="">+ Tạo nhóm mới</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}{g.active?'':' · tắt'}</option>)}</select></label>
    <div className="ls-group-grid">
    <form onSubmit={e=>{e.preventDefault();run(async()=>{const candidate={...form,code:form.code.trim(),name:form.name.trim(),members};const problem=groupError(candidate,groups,endpoints);if(problem)throw Error(problem);const result=await onSave(candidate);setForm(result);});}}>
      <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
        <label className="ls-field">Mã nhóm<input required maxLength={64} value={form.code} onChange={e=>set('code',e.target.value)}/></label>
        <label className="ls-field">Tên nhóm<input required maxLength={160} value={form.name} onChange={e=>set('name',e.target.value)}/></label>
        <label className="ls-field">Chính sách chọn điểm<select aria-label="Chính sách chọn điểm" value={form.selectionPolicy} onChange={e=>set('selectionPolicy',e.target.value)}>{Object.entries(remote?API_SELECTION_POLICIES:SELECTION_POLICIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <p>{POLICY_HELP[form.selectionPolicy]}</p>
        <label className="ls-field">Mô tả công việc tương đương<input value={form.description||''} onChange={e=>set('description',e.target.value)}/></label>
        <label className="ls-field"><span><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/> Kích hoạt nhóm</span></label>
        <label className="ls-field"><span><input type="checkbox" checked={form.allowFallback} onChange={e=>set('allowFallback',e.target.checked)}/> Cho phép thử điểm kế tiếp khi không có đường</span></label>
        {remote&&<p>Chỉ chuyển điểm sau lỗi PATH_UNAVAILABLE và bằng chứng robot đã dừng.</p>}
        <button className="ls-btn primary" type="submit">{form.id?'Lưu thông tin nhóm':'Tạo nhóm'}</button>
      </fieldset>
    </form>
    {selected?<section><h4>Thành viên · {members.length}</h4><p>Chọn các điểm cùng chức năng trên bản đồ này. Một điểm có thể thuộc nhiều nhóm.</p>
      {!members.length&&<p className="ls-error">Nhóm chưa có thành viên nên chưa dùng được trong Điều phối.</p>}
      <div className="ls-item-list">{[...members].sort((a,b)=>a.sequenceNo-b.sequenceNo).map(m=><div className="ls-task" key={m.endpointId}><strong>{m.sequenceNo}. {endpoints.find(e=>e.id===m.endpointId)?.name||'Điểm không có trên bản đồ'}</strong><small> · {m.active?'Bật':'Tắt'}</small><div className="ls-actions"><button type="button" className="ls-btn small" disabled={busy} onClick={()=>setMember({...m})}>Chỉnh thành viên</button><button type="button" className="ls-btn small" disabled={busy||!m.active} onClick={()=>run(()=>onRemove(selected,m))}>{remote?'Tắt thành viên':'Gỡ khỏi nhóm'}</button></div></div>)}</div>
      <form onSubmit={e=>{e.preventDefault();run(async()=>{const candidate={...selected,members:[...members.filter(m=>m.endpointId!==member.endpointId),member]};const problem=groupError(candidate,groups,endpoints);if(problem)throw Error(problem);await onMember(selected,member,members.some(m=>m.endpointId===member.endpointId));setMember({endpointId:'',sequenceNo:Math.max(member.sequenceNo,...members.map(m=>m.sequenceNo))+1,active:true});});}}>
        <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}><label className="ls-field">Điểm thành viên<select aria-label="Điểm thành viên" required value={member.endpointId} onChange={e=>{const found=members.find(m=>m.endpointId===e.target.value);setMember(found?{...found}:{...member,endpointId:e.target.value});}}><option value="">Chọn điểm trên bản đồ</option>{endpoints.map(e=><option key={e.id} value={e.id}>{e.name}{e.enabled===false?' · tắt':''}{e.accessible===false?' · không tiếp cận':''}</option>)}</select></label>
          <label className="ls-field">Thứ tự ưu tiên<input required type="number" min="1" step="1" value={member.sequenceNo} onChange={e=>setMember(m=>({...m,sequenceNo:Number(e.target.value)}))}/></label>
          <label className="ls-field"><span><input type="checkbox" checked={member.active} onChange={e=>setMember(m=>({...m,active:e.target.checked}))}/> Thành viên hoạt động</span></label>
          <button className="ls-btn" type="submit" disabled={!member.endpointId}>Lưu thành viên</button>
        </fieldset>
      </form>
    </section>:<section className="ls-empty"><h4>Thêm điểm vào nhóm</h4><p>Đặt tên và tạo nhóm ở bên cạnh, sau đó chọn điểm thành viên và thứ tự ưu tiên.</p><p>Có {endpoints.length} điểm đích trên bản đồ này.</p></section>}</div>
    {error&&<p className="ls-error" role="alert">{error}</p>}
  </section>;
}
