import { useEffect, useRef, useState } from 'react';
import { groupError, SELECTION_POLICIES, API_SELECTION_POLICIES, POLICY_HELP } from '../../features/facility/endpointGroups.js';

const empty = () => ({ id:'', code:'', name:'', selectionPolicy:'PRIORITY', allowFallback:false, active:true, description:'', roomId:null, fallbackRadiusM:0.75, members:[] });
const emptyPair = () => ({roomId:'',primaryEndpointId:'',fallbackEndpointId:'',groupCode:'',groupName:'',fallbackRadiusM:0.75,setAsRoomDefault:false});
export default function EndpointGroupEditor({groups, endpoints, rooms=[], mapId, onCreatePair, onSave, onMember, onRemove, onDelete, onDirtyChange, busy=false, remote=false}) {
  const [form,setForm]=useState(empty),[member,setMember]=useState({endpointId:'',sequenceNo:1,active:true}),[error,setError]=useState('');
  const [pair,setPair]=useState(emptyPair);
  const [deleteTarget,setDeleteTarget]=useState(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
  const deleteDialog=useRef(null);
  useEffect(()=>{if(deleteTarget)deleteDialog.current?.showModal();},[deleteTarget]);
  const selected=groups.find(g=>g.id===form.id);
  const members=selected?.members||[];
  const baseline={...empty(),...selected};
  const formDirty=Object.keys(empty()).filter(k=>k!=='members').some(k=>form[k]!==baseline[k]);
  const savedMember=members.find(m=>m.endpointId===member.endpointId);
  const dirty=formDirty||!!pair.roomId||!!member.endpointId&&(!savedMember||['sequenceNo','active'].some(k=>member[k]!==savedMember[k]));
  useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange?.(false),[onDirtyChange]);
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  const run=async action=>{setError('');try{await action();}catch(e){setError(e.message||'Không lưu được thay đổi.');}};
  const select=id=>{const g=groups.find(g=>g.id===id);setForm(g?{...empty(),...structuredClone(g)}:empty());setMember({endpointId:'',sequenceNo:Math.max(0,...(g?.members||[]).map(m=>m.sequenceNo))+1,active:true});setError('');};
  const pairEndpoints=endpoints.filter(point=>point.roomId===pair.roomId&&point.enabled!==false&&point.accessible!==false);
  return <section className="ls-panel" aria-label="Quản lý nhóm điểm đích"><h3>Nhóm điểm đích</h3>
    <p>Gộp các điểm cùng chức năng để robot chọn một điểm phù hợp khi điều phối.</p>
    {remote&&onCreatePair&&<details className="ls-panel"><summary>Tạo điểm chính và điểm dự phòng cho một phòng</summary><p>Chọn hai điểm đã gán cùng phòng trên bản đồ. Robot chỉ đổi sang điểm dự phòng khi lối tới điểm chính bị chặn và đã xác nhận dừng.</p>
      <form onSubmit={event=>{event.preventDefault();run(async()=>{
        if(!pair.roomId||!pair.primaryEndpointId||!pair.fallbackEndpointId||pair.primaryEndpointId===pair.fallbackEndpointId)throw Error('Chọn phòng và hai điểm khác nhau.');
        if(![pair.primaryEndpointId,pair.fallbackEndpointId].every(id=>pairEndpoints.some(point=>point.id===id)))throw Error('Hai điểm phải hoạt động, cùng phòng và cùng bản đồ.');
        const radius=Number(pair.fallbackRadiusM);if(!Number.isFinite(radius)||radius<0.1||radius>2)throw Error('Bán kính điểm dự phòng phải từ 0,1 đến 2 m.');
        const result=await onCreatePair({...pair,mapId,groupCode:pair.groupCode.trim(),groupName:pair.groupName.trim(),fallbackRadiusM:radius});
        setForm({...empty(),...result});setPair(emptyPair());setMember({endpointId:'',sequenceNo:3,active:true});
      });}}><fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
        <label className="ls-field">Phòng<select required value={pair.roomId} onChange={event=>{const room=rooms.find(item=>item.roomId===event.target.value);setPair({...emptyPair(),roomId:event.target.value,groupCode:room?('ROOM_'+room.roomCode+'_PAIR').slice(0,64):'',groupName:room?(room.roomName+' · điểm chính và dự phòng').slice(0,160):''});}}><option value="">Chọn phòng</option>{rooms.filter(room=>room.active!==false).map(room=><option key={room.roomId} value={room.roomId}>{room.roomName} · {room.roomCode}</option>)}</select></label>
        <label className="ls-field">Điểm chính<select required value={pair.primaryEndpointId} onChange={event=>setPair({...pair,primaryEndpointId:event.target.value})}><option value="">Chọn điểm trong phòng</option>{pairEndpoints.map(point=><option key={point.id} value={point.id} disabled={point.id===pair.fallbackEndpointId}>{point.name}</option>)}</select></label>
        <label className="ls-field">Điểm dự phòng ngoài cửa<select required value={pair.fallbackEndpointId} onChange={event=>setPair({...pair,fallbackEndpointId:event.target.value})}><option value="">Chọn điểm dự phòng</option>{pairEndpoints.map(point=><option key={point.id} value={point.id} disabled={point.id===pair.primaryEndpointId}>{point.name}</option>)}</select></label>
        {pair.roomId&&pairEndpoints.length<2&&<p>Cần gán ít nhất hai điểm hoạt động vào phòng này trong tab Điểm đích.</p>}
        <label className="ls-field">Tên nhóm<input required maxLength={160} value={pair.groupName} onChange={event=>setPair({...pair,groupName:event.target.value})}/></label>
        <label className="ls-field">Mã nhóm<input required maxLength={64} value={pair.groupCode} onChange={event=>setPair({...pair,groupCode:event.target.value})}/></label>
        <label className="ls-field">Bán kính cho phép chuyển điểm (m)<input required type="number" min="0.1" max="2" step="0.05" value={pair.fallbackRadiusM} onChange={event=>setPair({...pair,fallbackRadiusM:event.target.value})}/></label>
        <label className="ls-field"><span><input type="checkbox" checked={pair.setAsRoomDefault} onChange={event=>setPair({...pair,setAsRoomDefault:event.target.checked})}/> Dùng làm nhóm điểm đến mặc định của phòng</span></label>
        <button className="ls-btn primary" disabled={!pair.roomId||pairEndpoints.length<2}>Tạo nhóm hai điểm</button>
      </fieldset></form>
    </details>}
    <div className="ls-group-toolbar">
      <label className="ls-field">Nhóm đang chỉnh<select aria-label="Nhóm đang chỉnh" value={form.id} disabled={busy} onChange={e=>select(e.target.value)}><option value="">+ Tạo nhóm mới</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}{g.active?'':' · tắt'}</option>)}</select></label>
      {!remote&&onDelete&&selected&&<button type="button" className="ls-btn danger" disabled={busy} onClick={()=>{setDeleteError('');setDeleteTarget(selected);}}>Xóa nhóm</button>}
    </div>
    {deleteTarget&&<dialog ref={deleteDialog} className="ls-confirm" role="alertdialog" aria-label="Xóa nhóm điểm đích" onCancel={e=>{if(deleting)e.preventDefault();else setDeleteTarget(null);}}>
      <strong>Xóa nhóm “{deleteTarget.name}”?</strong>
      <p>Chỉ xóa nhóm và liên kết thành viên. Các điểm đích trên bản đồ vẫn được giữ nguyên.</p>
      {dirty&&<p>Thay đổi chưa lưu trong nhóm này sẽ bị bỏ.</p>}
      <p>Bấm Lưu bản đồ sau khi xóa để cập nhật Điều phối.</p>
      {deleteError&&<p className="ls-error" role="alert">{deleteError}</p>}
      <div className="ls-actions"><button type="button" autoFocus className="ls-btn" disabled={deleting} onClick={()=>setDeleteTarget(null)}>Hủy</button><button type="button" className="ls-btn danger" disabled={busy||deleting} onClick={async()=>{
        setDeleting(true);setDeleteError('');
        try{await onDelete(deleteTarget);select('');setDeleteTarget(null);}catch(e){setDeleteError(e.message||'Không xóa được nhóm. Vui lòng thử lại.');}finally{setDeleting(false);}
      }}>{deleting?'Đang xóa…':'Xóa nhóm'}</button></div>
    </dialog>}
    <div className="ls-group-grid">
    <form onSubmit={e=>{e.preventDefault();run(async()=>{const candidate={...form,code:form.code.trim(),name:form.name.trim(),members};const problem=groupError(candidate,groups,endpoints);if(problem)throw Error(problem);const result=await onSave(candidate);setForm(result);});}}>
      <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
        <label className="ls-field">Mã nhóm<input required maxLength={64} value={form.code} onChange={e=>set('code',e.target.value)}/></label>
        <label className="ls-field">Tên nhóm<input required maxLength={160} value={form.name} onChange={e=>set('name',e.target.value)}/></label>
        <label className="ls-field">Chính sách chọn điểm<select disabled={!!form.roomId} aria-label="Chính sách chọn điểm" value={form.selectionPolicy} onChange={e=>set('selectionPolicy',e.target.value)}>{Object.entries(remote?API_SELECTION_POLICIES:SELECTION_POLICIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {form.roomId&&<><p>Phòng: {rooms.find(room=>room.roomId===form.roomId)?.roomName||form.roomId}. Thứ tự 1 là điểm chính, thứ tự 2 là điểm dự phòng.</p><label className="ls-field">Bán kính chuyển sang điểm dự phòng (m)<input required type="number" min="0.1" max="2" step="0.05" value={form.fallbackRadiusM} onChange={event=>set('fallbackRadiusM',event.target.value)}/></label></>}
        <p>{POLICY_HELP[form.selectionPolicy]}</p>
        <label className="ls-field">Mô tả công việc tương đương<input value={form.description||''} onChange={e=>set('description',e.target.value)}/></label>
        <label className="ls-field"><span><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/> Kích hoạt nhóm</span></label>
        <label className="ls-field"><span><input disabled={!!form.roomId} type="checkbox" checked={form.allowFallback} onChange={e=>set('allowFallback',e.target.checked)}/> Cho phép thử điểm kế tiếp khi không có đường</span></label>
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
