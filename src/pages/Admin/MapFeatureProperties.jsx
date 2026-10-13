import { vi } from '../../i18n/vi.js';
import { cloneElement, useId } from 'react';
import { polygonArea } from './mapStudioModel.js';
import { inPolygon } from './lidarGeometry.js';
import { groupsFor } from '../../features/facility/endpointGroups.js';
import { ZONE_TYPES, ZONE_GROUPS } from './zoneCatalog.js';

export function ZoneTypePicker({value,onChange}) {
  return <><label className="ls-field">Loại vùng<select aria-label="Loại vùng" value={value} onChange={e=>onChange(e.target.value)}>{ZONE_GROUPS.filter(group=>ZONE_TYPES.some(t=>t.group===group&&!t.unsupported)).map(group=><optgroup key={group} label={group}>{ZONE_TYPES.filter(t=>t.group===group&&!t.unsupported).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>)}</select></label>
    <details className="ls-advanced"><summary>Các loại vùng cần kết nối robot</summary><div style={{maxHeight:260,overflowY:'auto',paddingRight:8}} tabIndex={0} role="region" aria-label="Giới hạn các loại vùng nâng cao"><p>11 loại dưới đây có trong tài liệu OTTO nhưng chưa thể áp dụng khi chỉ có bản quét mẫu. Không tạo vùng không có tác dụng.</p>{ZONE_TYPES.filter(t=>t.unsupported).map(t=><p key={t.id}><strong>{t.label}</strong> — {t.help}</p>)}</div><a href="https://docs.ottomotors.com/en/30495-30726-configurable-zones-types.html" target="_blank" rel="noreferrer">Đọc danh mục vùng OTTO ↗</a></details></>;
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
  return <details className="ls-advanced"><summary>{vi("Thuộc tính & hình học nâng cao")}</summary>
    <Input label="Mô tả vùng" maxLength={160} value={zone.description||''} onChange={e=>set('description',e.target.value)}/>
    <label><input type="checkbox" checked={zone.enabled!==false} onChange={e=>set('enabled',e.target.checked)}/>{vi("Áp dụng quy tắc khi điều phối")}</label>
    {zone.type==='PREFERRED_DIRECTION'&&<><p>Chi phí âm ưu tiên tuyến; từ 0 đến dưới 1 tăng chi phí. Giá trị <strong>1 cấm hướng tương ứng</strong>, kể cả đoạn nối đến điểm đích.</p><Action onClick={()=>setZone(z=>({...z,alignCost:-.5,antiAlignCost:1,crossCost:0}))}>Chặn chiều ngược</Action>{[['alignCost','Cùng hướng',-.5],['antiAlignCost','Ngược hướng',0],['crossCost','Cắt ngang',0]].map(([key,label,value])=><Input key={key} label={'Chi phí '+label.toLowerCase()} type="number" min="-.9" max="1" step=".05" value={zone[key]??value} onChange={e=>set(key,e.target.value===''?'':Number(e.target.value))}/>)}</>}
    {vi(zone.points.length>=3&&<><p>{"Diện tích: "}{vi((polygonArea(zone.points)*.0025).toFixed(2))}{" m² · "}{vi(zone.points.length)}{" đỉnh. Tọa độ trên bản đồ tính theo ô 5 cm."}</p><div className="ls-actions">{vi([['←',-10,0],['↑',0,-10],['↓',0,10],['→',10,0]].map(([label,x,y])=><Action key={label} aria-label={vi('Dịch vùng '+label)} onClick={()=>set('points',zone.points.map(p=>({x:p.x+x,y:p.y+y})))}>{vi(label)}{" 0,5 m"}</Action>))}</div><div className="ls-actions"><Action disabled={zone.points.length>=24} onClick={()=>{const [a,b]=zone.points;set('points',[a,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},...zone.points.slice(1)]);}}>{vi("Thêm đỉnh cạnh đầu")}</Action><Action disabled={zone.points.length<=3} onClick={()=>set('points',zone.points.slice(0,-1))}>{vi("Xóa đỉnh cuối")}</Action></div></>)}
  </details>;
}
export function EndpointProperties({endpoint,setEndpoint,draft,onOpenGroups}){
  const set=(key,value)=>setEndpoint(e=>({...e,[key]:value}));
  const areas=draft.zones.filter(z=>z.type==='AREA'&&inPolygon(endpoint,z.points));
  const groups=groupsFor(draft).filter(g=>g.members.some(m=>m.endpointId===endpoint.id));
  return <>
    <Input label="Mô tả điểm" value={endpoint.description||''} maxLength={160} onChange={e=>set('description',e.target.value)}/>
    <label><input type="checkbox" checked={endpoint.enabled!==false} onChange={e=>set('enabled',e.target.checked)}/>{vi("Cho phép điều phối đến điểm này")}</label>
    {endpoint.placed&&<p>Vùng chứa: {areas.map(a=>a.name).join(', ')||'Ngoài vùng có tên'}.</p>}
    <p>Nhóm điểm đích: {groups.map(g=>g.name).join(', ')||'Chưa tham gia nhóm'}.</p>
    <Action onClick={onOpenGroups}>Quản lý nhóm điểm đích →</Action>
  </>;
}
