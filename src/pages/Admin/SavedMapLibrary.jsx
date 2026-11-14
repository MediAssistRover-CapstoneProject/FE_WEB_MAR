import { useEffect, useRef, useState } from 'react';
import { facilityApi, allFacilityPages } from '../../features/facility/facilityApi.js';
import { getSession } from '../../features/auth/session.js';
import FacilityGeometryPreview from './FacilityGeometryPreview.jsx';
import DeleteMapDialog from './DeleteMapDialog.jsx';
import './savedMapLibrary.css';

const labels={DRAFT:'Nháp',ACTIVE:'Đang hoạt động',INACTIVE:'Không hoạt động',ARCHIVED:'Lưu trữ'};
const number=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('vi-VN',{maximumFractionDigits:3}):'—';
function MapIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" strokeLinejoin="round"/><path d="M9 3v16M15 5v16"/></svg>;}
function Status({value}){return <span className={'sml-status sml-status--'+(labels[value]?value.toLowerCase():'unknown')}><i/>{labels[value]||value}</span>;}

export default function SavedMapLibrary({onOpen,onDeleted,initialMapId=''}){
  const [maps,setMaps]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selected,setSelected]=useState(initialMapId),[revision,setRevision]=useState(0);
  const [deleteTarget,setDeleteTarget]=useState(null),[notice,setNotice]=useState('');
  const [bulkMode,setBulkMode]=useState(false),[checkedIds,setCheckedIds]=useState([]);
  const session=getSession(),canDelete=session?.account?.role==='ADMIN'&&session?.mode!=='demo';
  const picker=useRef(null),summary=useRef(null),selectAll=useRef(null);
  useEffect(()=>{
    if(selectAll.current)selectAll.current.indeterminate=checkedIds.length>0&&checkedIds.length<maps.length;
  },[checkedIds,maps,bulkMode]);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    allFacilityPages(facilityApi.listMaps).then(rows=>{
      if(active){setMaps(rows);setCheckedIds(ids=>ids.filter(id=>rows.some(m=>m.mapId===id)));setSelected(id=>rows.some(m=>m.mapId===id)?id:rows.find(m=>m.status==='ACTIVE')?.mapId||rows[0]?.mapId||'');}
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[revision]);
  const map=maps.find(m=>m.mapId===selected);
  const chooseMap=id=>{
    setSelected(id);
    picker.current.open=false;
    summary.current.focus();
  };
  const mapDeleted=deleted=>{
    const deletedIds=new Set(deleted.map(item=>item.mapId));
    const remaining=maps.filter(item=>!deletedIds.has(item.mapId));
    setMaps(remaining);
    setCheckedIds(ids=>ids.filter(id=>!deletedIds.has(id)));
    setSelected(id=>!deletedIds.has(id)?id:remaining.find(item=>item.status==='ACTIVE')?.mapId||remaining[0]?.mapId||'');
    if(!remaining.length)setBulkMode(false);
    setNotice(deleted.length===1?`Đã xóa bản đồ “${deleted[0].mapName}” cùng dữ liệu liên quan khỏi database.`:`Đã xóa ${deleted.length} bản đồ cùng dữ liệu liên quan khỏi database.`);
    window.dispatchEvent(new Event('mediassist-facility-updated'));
    summary.current?.focus();
    onDeleted?.([...deletedIds]);
  };

  return <div className="sml-library">
    <details className="sml-picker" ref={picker}>
      <summary ref={summary}>
        <span className="sml-picker-icon"><MapIcon/></span>
        <span className="sml-picker-copy"><strong>Map đã quét trong database <span className="sml-count">{loading?'…':maps.length}</span></strong><small>{map?<>Đang chọn: <b>{map.mapName}</b> · v{map.versionNo}</>:'Chọn bản đồ đã lưu để bắt đầu thiết lập'}</small></span>
        <span className="sml-picker-action"><span>Chọn map</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      </summary>
      <div className="sml-picker-content">
        <div className="sml-list-heading"><span>{bulkMode?'Đánh dấu các bản đồ muốn xóa khỏi danh sách sử dụng.':'Chọn một bản đồ để xem trước và cấu hình.'}</span><div className="ls-actions">{canDelete&&maps.length>0&&<button type="button" className={'ls-btn small '+(bulkMode?'':'danger')} disabled={loading||!!error} onClick={()=>{setBulkMode(value=>!value);setCheckedIds([]);}}>{bulkMode?'Hủy chọn':'Chọn để xóa'}</button>}<button type="button" className="ls-btn small" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Tải lại danh sách map</button></div></div>
        {bulkMode&&<div className="sml-bulk-toolbar" role="group" aria-label="Chọn bản đồ để xóa"><label><input ref={selectAll} type="checkbox" checked={maps.length>0&&checkedIds.length===maps.length} disabled={loading||!!error||!maps.length} onChange={event=>setCheckedIds(event.target.checked?maps.map(m=>m.mapId):[])}/>Chọn tất cả</label><span role="status">Đã chọn {checkedIds.length}/{maps.length} bản đồ</span><button type="button" className="ls-btn small sml-delete-confirm" disabled={loading||!!error||!checkedIds.length} onClick={()=>{setNotice('');setDeleteTarget(maps.filter(m=>checkedIds.includes(m.mapId)));}}>Xóa đã chọn ({checkedIds.length})</button></div>}
        <div className="sml-map-list" aria-label="Danh sách map đã quét">
          {maps.map(m=>{
            const checked=checkedIds.includes(m.mapId);
            const content=<><span className="sml-option-top"><span className="sml-option-name">{m.mapName}</span>{bulkMode?<input type="checkbox" aria-label={`Chọn xóa ${m.mapName} · v${m.versionNo}`} checked={checked} disabled={loading||!!error} onChange={event=>setCheckedIds(ids=>event.target.checked?[...ids,m.mapId]:ids.filter(id=>id!==m.mapId))}/>:<span className="sml-radio" aria-hidden="true"/>}</span><span className="sml-option-meta">v{m.versionNo}<span>·</span>{number(m.widthM)} × {number(m.heightM)} m</span><Status value={m.status}/></>;
            return bulkMode?<label className={'sml-map-option sml-map-check '+(checked?'is-checked':'')} key={m.mapId}>{content}</label>:<button type="button" className={'sml-map-option '+(m.mapId===selected?'is-selected':'')} key={m.mapId} disabled={loading} aria-pressed={m.mapId===selected} onClick={()=>chooseMap(m.mapId)}>{content}</button>;
          })}
        </div>
      </div>
    </details>

    {loading&&<p className="sml-message" role="status">Đang tải danh sách map…</p>}
    {notice&&<p className="sml-message sml-message--success" role="status">{notice}</p>}
    {error&&<div className="sml-message sml-message--error" role="alert"><span>Không tải được map: {error}</span><button type="button" className="ls-btn small" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Thử lại</button></div>}
    {!loading&&!error&&!maps.length&&<div className="sml-empty"><span className="sml-picker-icon"><MapIcon/></span><h3>Chưa có bản đồ đã lưu</h3><p>Database chưa có bản đồ.</p><p>Chọn “Quét map mới” để tạo bản đồ từ robot.</p></div>}

    {map&&<section className="sml-preview" aria-label="Xem trước bản đồ đã chọn">
      <header className="sml-preview-heading">
        <div className="sml-preview-title"><span className="sml-eyebrow">BẢN ĐỒ ĐANG CHỌN</span><div><h3>{map.mapName}</h3><Status value={map.status}/></div><p>Kiểm tra bản đồ trước khi thiết lập vùng và điểm đích.</p></div>
        <div className="sml-preview-actions">{canDelete&&!bulkMode&&<button type="button" className="ls-btn danger" disabled={loading||!!error} onClick={()=>{setNotice('');setDeleteTarget([map]);}}>Xóa bản đồ</button>}<button type="button" className="ls-btn" disabled={loading||bulkMode} onClick={()=>onOpen(map.mapId,'presentation')}>Chỉnh giao diện map</button><button type="button" className="ls-btn primary" disabled={loading||bulkMode} onClick={()=>onOpen(map.mapId,'zone')}>Mở bản đồ <span aria-hidden="true">→</span></button></div>
      </header>
      <dl className="sml-map-facts"><div><dt>Kích thước</dt><dd>{number(map.widthM)} × {number(map.heightM)} <span>m</span></dd></div><div><dt>Độ phân giải</dt><dd>{number(map.resolutionMPerPixel*100)} <span>cm/ô</span></dd></div><div><dt>Phiên bản</dt><dd>v{map.versionNo}</dd></div></dl>
      <div className="sml-canvas"><FacilityGeometryPreview key={map.mapId} map={map} zones={[]} endpoints={[]}/></div>
    </section>}
    {deleteTarget&&<DeleteMapDialog maps={deleteTarget} onClose={()=>setDeleteTarget(null)} onDeleted={mapDeleted}/>}
  </div>;
}
