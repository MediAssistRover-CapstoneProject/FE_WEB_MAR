import { ZONE_CATEGORIES } from '../../features/facility/facilityContract.js';
import FacilityGeometryPreview, { polygonPoints } from './FacilityGeometryPreview.jsx';
import './zoneMapEditor.css';

const descriptions={
  KEEP_OUT:'Robot không đi vào vùng này.',
  SPEED:'Robot giảm tốc khi đi qua vùng này.',
  NO_STOP:'Robot được đi qua, nhưng không dừng hoặc nhận điểm đến trong vùng.',
};
const colors={KEEP_OUT:'#e45b69',SPEED:'#3b82f6',NO_STOP:'#e5a020'};
function Field({label,children,...props}){return <label className="ls-field"><span>{label}</span>{children||<input aria-label={label} {...props}/>}</label>;}

function nextCode(zones){
  const used=new Set(zones.map(z=>z.zoneCode?.toUpperCase()));
  let number=1;
  while(used.has('ZONE_'+String(number).padStart(3,'0')))number++;
  return 'ZONE_'+String(number).padStart(3,'0');
}

export default function ZoneMapEditor({map,zones,endpoints,zone,setZone,drawing,setDrawing,busy,onSelect,onSave}){
  const locked=busy||map.status==='ARCHIVED';
  const points=polygonPoints(zone.polygonJson);
  const area=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
  const set=(key,value)=>setZone(z=>({...z,[key]:value}));
  const choose=id=>{onSelect(id);setDrawing(false);};
  const setPoints=value=>set('polygonJson',JSON.stringify({points:value},null,2));
  const code=zone.zoneCode?.trim()||nextCode(zones);
  return <div className="zm-editor">
    <section className="ls-panel zm-map-panel">
      <header className="zm-heading"><div><h3>{map.mapName}</h3><p>{drawing?'Bấm lần lượt các góc để vẽ ranh giới vùng.':'Chọn vùng trên bản đồ để chỉnh sửa, hoặc vẽ một vùng mới.'}</p></div><span className={'zm-mode '+(drawing?'is-drawing':'')}>{drawing?'Đang vẽ vùng':'Bản đồ đã lưu'}</span></header>
      <div className="zm-tools"><button type="button" className={'ls-btn '+(drawing?'primary':'')} disabled={locked} aria-pressed={drawing} onClick={()=>setDrawing(value=>!value)}>{drawing?'Dừng vẽ':'Vẽ vùng'}</button><button type="button" className="ls-btn small" disabled={locked||!points.length} onClick={()=>setPoints(points.slice(0,-1))}>Bỏ đỉnh cuối</button><button type="button" className="ls-btn small" disabled={locked||!points.length} onClick={()=>{setPoints([]);setDrawing(true);}}>Vẽ lại</button><span>{points.length?`${points.length} đỉnh · ${area.toLocaleString('vi-VN',{maximumFractionDigits:2})} m²`:'Chọn ít nhất 3 đỉnh trên bản đồ'}</span></div>
      <FacilityGeometryPreview map={map} zones={zones} endpoints={endpoints} zoneEdit={zone} drawing={drawing&&!locked} onZone={choose} onPoint={point=>setZone(current=>({...current,polygonJson:JSON.stringify({points:[...polygonPoints(current.polygonJson),[point.xM,point.yM]]},null,2)}))}/>
      <section className="zm-saved" aria-label="Vùng đã lưu"><header><h4>Vùng đã lưu <span>{zones.length}</span></h4><button type="button" className="ls-btn small" disabled={locked} onClick={()=>choose('')}>+ Vùng mới</button></header>
        {zones.length?<div className="ls-item-list">{zones.map(z=><button type="button" className={'ls-item '+(z.zoneId===zone.zoneId?'selected':'')} key={z.zoneId} disabled={busy} onClick={()=>choose(z.zoneId)}><i style={{background:colors[z.zoneType]}}/><span><strong>{z.zoneName}</strong><small>{ZONE_CATEGORIES[z.zoneType]}{z.active?'':' · Đã tắt'}</small></span></button>)}</div>:<p className="zm-empty">Chưa có vùng nào. Đặt tên và vẽ vùng đầu tiên trên bản đồ.</p>}
      </section>
    </section>
    <aside className="ls-panel zm-properties">
      <header className="zm-heading"><div><h3>{zone.zoneId?'Chỉnh sửa vùng':'Tạo vùng mới'}</h3><p>Đặt tên, chọn chức năng và vẽ ranh giới.</p></div></header>
      <form onSubmit={event=>{event.preventDefault();onSave({...zone,zoneCode:code});}} onInvalidCapture={event=>{let details=event.target.closest('details');while(details){details.open=true;details=details.parentElement.closest('details');}}}>
        <fieldset disabled={locked}>
          <Field label="Tên vùng" required maxLength={160} placeholder="VD: Khu vực trước cửa thang máy" value={zone.zoneName} onChange={event=>set('zoneName',event.target.value)}/>
          <Field label="Loại vùng"><select aria-label="Loại vùng" value={zone.zoneType} onChange={event=>set('zoneType',event.target.value)}>{Object.entries(ZONE_CATEGORIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
          <p className="zm-type-help"><i style={{background:colors[zone.zoneType]}}/>{descriptions[zone.zoneType]}</p>
          {zone.zoneType==='SPEED'&&<Field label="Giới hạn tốc độ (m/s)" required type="number" min="0.000001" step="any" placeholder="VD: 0.3" value={zone.speedLimitMps??''} onChange={event=>set('speedLimitMps',event.target.value)}/>}
          <div className={'zm-geometry '+(points.length>=3&&area>0?'is-ready':'')}><strong>{points.length>=3&&area>0?'Đã có ranh giới vùng':'Chưa hoàn tất ranh giới'}</strong><span>{points.length>=3?`${points.length} đỉnh · ${area.toLocaleString('vi-VN',{maximumFractionDigits:2})} m²`:'Bấm “Vẽ vùng”, rồi chọn ít nhất 3 góc trên bản đồ.'}</span></div>
          <details className="zm-options"><summary>Nhập tọa độ thủ công</summary><Field label="Tọa độ vùng (mét)"><textarea aria-label="Tọa độ vùng (mét)" rows={5} value={zone.polygonJson} onChange={event=>set('polygonJson',event.target.value)}/></Field><small>Dạng: {'{"points":[[0,0],[2,0],[2,2],[0,2]]}'}</small></details>
          <details className="zm-options"><summary>Cài đặt nâng cao</summary><p>Mã vùng được tạo tự động. Các thông tin bên dưới không bắt buộc.</p>
            <Field label="Mã vùng" maxLength={64} placeholder={code} value={zone.zoneCode||''} onChange={event=>set('zoneCode',event.target.value)}/>
            <Field label="Mô tả" value={zone.description||''} onChange={event=>set('description',event.target.value)}/>
            <label className="zm-check"><input type="checkbox" checked={!!zone.active} onChange={event=>set('active',event.target.checked)}/> Vùng hoạt động</label>
            <label className="zm-check"><input type="checkbox" checked={!!zone.publicVisible} onChange={event=>set('publicVisible',event.target.checked)}/> Hiển thị công khai</label>
            <details className="zm-options"><summary>Camera và thông số bổ sung</summary>
              {zone.zoneType!=='SPEED'&&zone.speedLimitMps!==''&&zone.speedLimitMps!=null&&<Field label="Giới hạn tốc độ đã lưu (m/s)" type="number" min="0.000001" step="any" value={zone.speedLimitMps} onChange={event=>set('speedLimitMps',event.target.value)}/>}
              <Field label="Sức chứa (người)" type="number" min="0" step="1" value={zone.capacityLimit??''} onChange={event=>set('capacityLimit',event.target.value)}/>
              <Field label="Diện tích hiệu chuẩn (m²)" type="number" min="0.000001" step="any" value={zone.calibratedAreaM2??''} onChange={event=>set('calibratedAreaM2',event.target.value)}/>
              <Field label="Nguồn camera" maxLength={255} value={zone.cameraSourceRef||''} onChange={event=>set('cameraSourceRef',event.target.value)}/>
              <Field label="ROI camera (JSON tùy chọn)"><textarea aria-label="ROI camera (JSON tùy chọn)" rows={3} value={zone.cameraRoiJson||''} onChange={event=>set('cameraRoiJson',event.target.value)}/></Field>
            </details>
          </details>
          <div className="zm-save-bar"><button type="submit" className="ls-btn primary" disabled={points.length<3||!zone.zoneName.trim()||area===0}>{busy?'Đang lưu…':zone.zoneId?'Lưu thay đổi':'Lưu vùng'}</button><button type="button" className="ls-btn" onClick={()=>choose(zone.zoneId||'')}>Bỏ thay đổi</button></div>
        </fieldset>
      </form>
    </aside>
  </div>;
}
