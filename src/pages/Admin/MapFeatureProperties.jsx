import { vi } from '../../i18n/vi.js';
import { cloneElement, useId } from 'react';
import { inPolygon } from './lidarGeometry.js';
import { groupsFor } from '../../features/facility/endpointGroups.js';
import { ZONE_TYPES, ZONE_SETUP_TYPES, ZONE_ROBOT_POLICY } from './zoneCatalog.js';

export function ZoneTypePicker({value,onChange}) {
  const legacy = !ZONE_SETUP_TYPES.some(t=>t.id===value);
  return <><label className="ls-field">Loại vùng<select aria-label="Loại vùng" value={value} onChange={e=>onChange(e.target.value)}>{legacy&&<option value={value} disabled>{ZONE_TYPES.find(t=>t.id===value)?.label} · vùng đã lưu</option>}{ZONE_SETUP_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
    <section className="ls-policy" aria-label="Chính sách áp dụng vùng"><strong>Chưa đồng bộ với robot</strong><p>{ZONE_ROBOT_POLICY[value]||'Vùng nâng cao đã lưu được giữ nguyên để tương thích với bản đồ cũ.'}</p><p>Bạn có thể khoanh vùng và lưu tại trình duyệt. Quy tắc di chuyển hiện chỉ áp dụng trong mô phỏng, chưa có kết nối triển khai đến robot thật.</p>{legacy&&<p>Không tạo mới loại vùng này. Bạn có thể giữ nguyên hoặc đổi sang một trong các loại vùng ở trên.</p>}</section></>;
}

export const TASK_NAMES={WAIT:'Chờ tại điểm',LOAD:'Nhận hàng',UNLOAD:'Giao hàng',CHARGE:'Sạc mô phỏng',NOTIFY:'Thông báo hoàn tất'};
export const ENDPOINT_TEMPLATES={
  WAYPOINT:{name:'Điểm trung gian',tasks:[]}, HOME:{name:'Điểm gốc',tasks:[]},
  PARKING:{name:'Bãi đỗ',tasks:[{action:'WAIT',seconds:2}]},
  PICKUP:{name:'Nhận hàng',tasks:[{action:'LOAD',seconds:4}]},
  DROPOFF:{name:'Giao hàng',tasks:[{action:'UNLOAD',seconds:4}]},
  CHARGING:{name:'Trạm sạc',tasks:[{action:'CHARGE',seconds:10}]},
};
export function templateFields(type){return {type,template:type,tasks:structuredClone(ENDPOINT_TEMPLATES[type]?.tasks||[]),templateLinked:true};}
function Input({label,children,...props}){const id=useId();return <label className="ls-field"><span id={id}>{vi(label)}</span>{children?cloneElement(children,{'aria-labelledby':id}):<input {...props} aria-labelledby={id}/>}</label>;}
const Action=({children,...props})=><button type="button" className="ls-btn small" {...props}>{vi(children)}</button>;
export function ZoneProperties({zone,setZone}){
  const set=(key,value)=>setZone(z=>({...z,[key]:value}));
  return <details className="ls-advanced"><summary>Thông tin bổ sung</summary>
    <Input label="Mô tả vùng" maxLength={160} value={zone.description||''} onChange={e=>set('description',e.target.value)}/>
    <label><input type="checkbox" checked={zone.enabled!==false} onChange={e=>set('enabled',e.target.checked)}/>{['AREA','REST'].includes(zone.type)?'Bật vùng':'Áp dụng trong mô phỏng'}</label>
    {zone.type==='PREFERRED_DIRECTION'&&<><p>Chi phí âm ưu tiên tuyến; từ 0 đến dưới 1 tăng chi phí. Giá trị <strong>1 cấm hướng tương ứng</strong>, kể cả đoạn nối đến điểm đích.</p><Action onClick={()=>setZone(z=>({...z,alignCost:-.5,antiAlignCost:1,crossCost:0}))}>Chặn chiều ngược</Action>{[['alignCost','Cùng hướng',-.5],['antiAlignCost','Ngược hướng',0],['crossCost','Cắt ngang',0]].map(([key,label,value])=><Input key={key} label={'Chi phí '+label.toLowerCase()} type="number" min="-.9" max="1" step=".05" value={zone[key]??value} onChange={e=>set(key,e.target.value===''?'':Number(e.target.value))}/>)}</>}
  </details>;
}
export function EndpointProperties({endpoint,setEndpoint,draft,onOpenGroups}){
  const set=(key,value)=>setEndpoint(e=>({...e,[key]:value}));
  const areas=draft.zones.filter(z=>['AREA','REST'].includes(z.type)&&inPolygon(endpoint,z.points));
  const groups=groupsFor(draft).filter(g=>g.members.some(m=>m.endpointId===endpoint.id));
  return <>
    <Input label="Mô tả điểm" value={endpoint.description||''} maxLength={160} onChange={e=>set('description',e.target.value)}/>
    <label><input type="checkbox" checked={endpoint.enabled!==false} onChange={e=>set('enabled',e.target.checked)}/>{vi("Cho phép điều phối đến điểm này")}</label>
    {endpoint.placed&&<p>Vùng chứa: {areas.map(a=>a.name).join(', ')||'Chưa nằm trong vùng'}.</p>}
    <p>Nhóm điểm đích: {groups.map(g=>g.name).join(', ')||'Chưa tham gia nhóm'}.</p>
    <Action onClick={onOpenGroups}>Quản lý nhóm điểm đích →</Action>
  </>;
}
