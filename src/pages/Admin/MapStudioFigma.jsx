import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vi } from '../../i18n/vi.js';
import WorkspaceTabs from '../../components/WorkspaceTabs.jsx';
import LiveMapping from './robotOperations/LiveMapping.jsx';
import FacilityCatalogEditor from './FacilityCatalogEditor.jsx';
import SavedMapLibrary from './SavedMapLibrary.jsx';
import MapPresentationEditor from './MapPresentationEditor.jsx';
import './mapStudio.css';

export const workflow=[['scan','Scan'],['zone','Zone'],['endpoint','Endpoint'],['presentation','Chỉnh giao diện']];

function Button({children,tone='',...props}) {
  return <button type="button" {...props} className={'ls-btn '+tone}>{children}</button>;
}

export default function MapStudioFigma({initialStage='scan'}) {
  const navigate=useNavigate();
  const stageParam=new URLSearchParams(window.location.search).get('stage');
  const requestedStage=stageParam||initialStage;
  const [mapId,setMapId]=useState(()=>new URLSearchParams(window.location.search).get('mapId')||'');
  const [stage,setStage]=useState(()=>mapId?(workflow.some(([id])=>id===stageParam)?stageParam:'endpoint'):workflow.some(([id])=>id===requestedStage)?requestedStage:'scan');
  const [showLibrary,setShowLibrary]=useState(()=>!mapId&&stage==='scan'&&new URLSearchParams(window.location.search).get('stage')!=='scan');
  const [copyNotice,setCopyNotice]=useState('');
  const [presentationDirty,setPresentationDirty]=useState(false);
  const canLeave=()=>!presentationDirty||window.confirm('Bản đồ còn chỉnh sửa chưa lưu. Bỏ thay đổi và rời trang chỉnh sửa?');
  const openLibrary=()=>{if(canLeave())setShowLibrary(true);};
  const switchStage=target=>{if(target===stage||canLeave()){setStage(target);navigate('/admin/map?'+new URLSearchParams({...(mapId?{mapId}:{}),stage:target}),{replace:true});}};
  const index=workflow.findIndex(([id])=>id===stage);
  const openMap=(id,target)=>{
    setMapId(id);
    setStage(target);
    setShowLibrary(false);
    navigate('/admin/map?'+new URLSearchParams({mapId:id,stage:target}),{replace:true});
  };
  const mapDeleted=ids=>{
    if(!ids.includes(mapId))return;
    setMapId('');
    setStage('scan');
    setPresentationDirty(false);
    setCopyNotice('');
    navigate('/admin/map',{replace:true});
  };

  if(showLibrary)return <section className="ls-studio">
    <header className="ls-heading">
      <div><h2>Thư viện bản đồ</h2><p>Quản lý bản đồ đã quét, thiết lập vùng và điểm đích cho robot.</p></div>
      <div className="ls-actions">
        {stage!=='scan'&&<Button onClick={()=>setShowLibrary(false)}>← Quay lại bản đồ đang chỉnh</Button>}
        <Button tone="primary" onClick={()=>{setStage('scan');setShowLibrary(false);navigate('/admin/map?stage=scan');}}>Quét map mới</Button>
      </div>
    </header>
    <SavedMapLibrary onOpen={openMap} onDeleted={mapDeleted} initialMapId={mapId}/>
  </section>;

  return <section className={'ls-studio' + (stage === 'scan' ? ' ls-scan-studio' : '')}>
    <header className="ls-heading">
      <div>
        {stage==='scan'&&<span className="ls-scan-eyebrow">MAP STUDIO / TẠO BẢN ĐỒ</span>}
        <h2>{stage==='scan'?'Quét bản đồ':vi(workflow[index][1])}</h2>
        <p>{stage==='scan'?'Quét không gian để tạo bản đồ cho robot.':stage==='zone'?'Thiết lập vùng di chuyển trên bản đồ đã chọn.':stage==='presentation'?'Chỉnh map thô thành bản đồ dễ đọc, thêm phòng, tường và nhãn.':'Đặt vị trí và hướng đến của robot trên bản đồ.'}</p>
      </div>
      <div className="ls-actions">
        <Button onClick={openLibrary}>← Thư viện bản đồ</Button>
        {stage==='scan'&&<Button onClick={()=>navigate('/admin/system-settings')}>Kết nối robot ↗</Button>}
        {stage==='zone'&&<Button tone="primary" onClick={()=>setStage('endpoint')}>Tiếp tục: Điểm đích →</Button>}
      </div>
    </header>
    <div className="ls-stage-nav"><WorkspaceTabs label={vi('Map Studio stages')} active={stage} onSelect={switchStage}
      items={workflow.map(([id,label],i)=>({id,label:`${i+1}. ${vi(label)}`}))}/></div>
    {copyNotice&&<p className="ls-notice" role="status">{copyNotice}</p>}
    {stage==='scan'
      ? <LiveMapping embedded onMapSaved={id=>openMap(id,'zone')}/>
      : stage==='presentation' ? <MapPresentationEditor key={mapId} mapId={mapId} onOpenLibrary={openLibrary} onDirtyChange={setPresentationDirty}/>
      : <FacilityCatalogEditor key={mapId||'catalog'} stage={stage} initialMapId={mapId} onMapChange={setMapId} onOpenLibrary={()=>setShowLibrary(true)} onMapCopied={id=>{setCopyNotice('Đã mở bản đồ tương thích dẫn đường. BE giữ nguyên bản gốc và sao chép điểm đích; kiểm tra lại vùng, nhóm điểm và liên kết phòng trên bản này trước khi kích hoạt.');openMap(id,'zone');}}/>}
  </section>;
}
