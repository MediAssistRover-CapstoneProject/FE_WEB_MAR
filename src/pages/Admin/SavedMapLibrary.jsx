import { useEffect, useRef, useState } from 'react';
import { facilityApi, allFacilityPages } from '../../features/facility/facilityApi.js';
import FacilityGeometryPreview from './FacilityGeometryPreview.jsx';
import './savedMapLibrary.css';

const labels={DRAFT:'Nháp',ACTIVE:'Đang hoạt động',INACTIVE:'Không hoạt động',ARCHIVED:'Lưu trữ'};
const number=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('vi-VN',{maximumFractionDigits:3}):'—';
function MapIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" strokeLinejoin="round"/><path d="M9 3v16M15 5v16"/></svg>;}
function Status({value}){return <span className={'sml-status sml-status--'+(labels[value]?value.toLowerCase():'unknown')}><i/>{labels[value]||value}</span>;}

export default function SavedMapLibrary({onOpen,initialMapId=''}){
  const [maps,setMaps]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selected,setSelected]=useState(initialMapId),[revision,setRevision]=useState(0);
  const picker=useRef(null),summary=useRef(null);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    allFacilityPages(facilityApi.listMaps).then(rows=>{
      if(active){setMaps(rows);setSelected(id=>rows.some(m=>m.mapId===id)?id:rows.find(m=>m.status==='ACTIVE')?.mapId||rows[0]?.mapId||'');}
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[revision]);
  const map=maps.find(m=>m.mapId===selected);
  const chooseMap=id=>{
    setSelected(id);
    picker.current.open=false;
    summary.current.focus();
  };

  return <div className="sml-library">
    <details className="sml-picker" ref={picker}>
      <summary ref={summary}>
        <span className="sml-picker-icon"><MapIcon/></span>
        <span className="sml-picker-copy"><strong>Map đã quét trong database <span className="sml-count">{loading?'…':maps.length}</span></strong><small>{map?<>Đang chọn: <b>{map.mapName}</b> · v{map.versionNo}</>:'Chọn bản đồ đã lưu để bắt đầu thiết lập'}</small></span>
        <span className="sml-picker-action"><span>Chọn map</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      </summary>
      <div className="sml-picker-content">
        <div className="sml-list-heading"><span>Chọn một bản đồ để xem trước và cấu hình.</span><button type="button" className="ls-btn small" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Tải lại danh sách map</button></div>
        <div className="sml-map-list" aria-label="Danh sách map đã quét">
          {maps.map(m=><button type="button" className={'sml-map-option '+(m.mapId===selected?'is-selected':'')} key={m.mapId} disabled={loading} aria-pressed={m.mapId===selected} onClick={()=>chooseMap(m.mapId)}>
            <span className="sml-option-top"><span className="sml-option-name">{m.mapName}</span><span className="sml-radio" aria-hidden="true"/></span>
            <span className="sml-option-meta">v{m.versionNo}<span>·</span>{number(m.widthM)} × {number(m.heightM)} m</span>
            <Status value={m.status}/>
          </button>)}
        </div>
      </div>
    </details>

    {loading&&<p className="sml-message" role="status">Đang tải danh sách map…</p>}
    {error&&<div className="sml-message sml-message--error" role="alert"><span>Không tải được map: {error}</span><button type="button" className="ls-btn small" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Thử lại</button></div>}
    {!loading&&!error&&!maps.length&&<div className="sml-empty"><span className="sml-picker-icon"><MapIcon/></span><h3>Chưa có bản đồ đã lưu</h3><p>Database chưa có bản đồ.</p><p>Chọn “Quét map mới” để tạo bản đồ từ robot.</p></div>}

    {map&&<section className="sml-preview" aria-label="Xem trước bản đồ đã chọn">
      <header className="sml-preview-heading">
        <div className="sml-preview-title"><span className="sml-eyebrow">BẢN ĐỒ ĐANG CHỌN</span><div><h3>{map.mapName}</h3><Status value={map.status}/></div><p>Kiểm tra bản đồ trước khi thiết lập vùng và điểm đích.</p></div>
        <div className="sml-preview-actions"><button type="button" className="ls-btn primary" disabled={loading} onClick={()=>onOpen(map.mapId,'zone')}>Mở bản đồ <span aria-hidden="true">→</span></button></div>
      </header>
      <dl className="sml-map-facts"><div><dt>Kích thước</dt><dd>{number(map.widthM)} × {number(map.heightM)} <span>m</span></dd></div><div><dt>Độ phân giải</dt><dd>{number(map.resolutionMPerPixel*100)} <span>cm/ô</span></dd></div><div><dt>Phiên bản</dt><dd>v{map.versionNo}</dd></div></dl>
      <div className="sml-canvas"><FacilityGeometryPreview key={map.mapId} map={map} zones={[]} endpoints={[]}/></div>
    </section>}
  </div>;
}
