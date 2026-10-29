import { vi } from '../../i18n/vi.js';
import { cloneElement, useId, useMemo } from 'react';
import { inPolygon } from './lidarGeometry.js';
import { groupsFor } from '../../features/facility/endpointGroups.js';
import { ZONE_SETUP_TYPES, ZONE_ROBOT_POLICY } from './zoneCatalog.js';

export function ZoneTypePicker({value,onChange}) {
  return <><label className="ls-field">Loại vùng<select aria-label="Loại vùng" value={value} onChange={e=>onChange(e.target.value)}>{ZONE_SETUP_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
    <section className="ls-policy" aria-label="Chính sách áp dụng vùng"><strong>Chính sách vùng</strong><p>{ZONE_ROBOT_POLICY[value]}</p><p>Quy tắc di chuyển hiện được áp dụng trong mô phỏng; việc triển khai xuống robot thật vẫn cần cơ chế đồng bộ riêng.</p></section></>;
}

export const TASK_NAMES={WAIT:'Chờ tại điểm',LOAD:'Nhận hàng',UNLOAD:'Giao hàng',CHARGE:'Sạc mô phỏng',NOTIFY:'Thông báo hoàn tất'};
export const ENDPOINT_TEMPLATES={
  WAYPOINT:{name:'Điểm đường',tasks:[]},
  CHARGER:{name:'Điểm sạc',tasks:[{action:'CHARGE',seconds:10}]},
  PARK:{name:'Điểm đỗ',tasks:[{action:'WAIT',seconds:2}]},
  STAGING:{name:'Điểm tập kết',tasks:[{action:'WAIT',seconds:2}]},
};
export function templateFields(type){return {type,template:type,tasks:structuredClone(ENDPOINT_TEMPLATES[type]?.tasks||[]),templateLinked:true};}
function Input({label,children,...props}){const id=useId();return <label className="ls-field"><span id={id}>{vi(label)}</span>{children?cloneElement(children,{'aria-labelledby':id}):<input {...props} aria-labelledby={id}/>}</label>;}
const Action=({children,...props})=><button type="button" className="ls-btn small" {...props}>{vi(children)}</button>;
export function ZoneProperties({zone,setZone}){
  const set=(key,value)=>setZone(z=>({...z,[key]:value}));
  return <details className="ls-advanced"><summary>Thông tin bổ sung</summary>
    <Input label="Mô tả vùng" maxLength={160} value={zone.description||''} onChange={e=>set('description',e.target.value)}/>
    <label><input type="checkbox" checked={zone.enabled!==false} onChange={e=>set('enabled',e.target.checked)}/>Áp dụng trong mô phỏng</label>
  </details>;
}
export function EndpointProperties({endpoint,setEndpoint,draft,onOpenGroups}){
  const set=(key,value)=>setEndpoint(e=>({...e,[key]:value}));
  const areas=useMemo(()=>draft.zones.filter(z=>inPolygon(endpoint,z.points)),[draft.zones, endpoint.x, endpoint.y]);
  const groups=useMemo(()=>groupsFor(draft).filter(g=>g.members.some(m=>m.endpointId===endpoint.id)),[draft, endpoint.id]);
  return <>
    <Input label="Mô tả điểm" value={endpoint.description||''} maxLength={160} onChange={e=>set('description',e.target.value)}/>
    <label><input type="checkbox" checked={endpoint.enabled!==false} onChange={e=>set('enabled',e.target.checked)}/>{vi("Cho phép điều phối đến điểm này")}</label>
    {endpoint.placed&&<p>Vùng chứa: {areas.map(a=>a.name).join(', ')||'Chưa nằm trong vùng'}.</p>}
    <p>Nhóm điểm đích: {groups.map(g=>g.name).join(', ')||'Chưa tham gia nhóm'}.</p>
    <Action onClick={onOpenGroups}>Quản lý nhóm điểm đích →</Action>
  </>;
}
