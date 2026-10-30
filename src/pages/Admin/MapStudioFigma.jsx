import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vi } from '../../i18n/vi.js';
import WorkspaceTabs from '../../components/WorkspaceTabs.jsx';
import LiveMapping from './robotOperations/LiveMapping.jsx';
import FacilityCatalogEditor from './FacilityCatalogEditor.jsx';
import SavedMapLibrary from './SavedMapLibrary.jsx';
import './mapStudio.css';

export const workflow=[['scan','Scan'],['zone','Zone'],['endpoint','Endpoint']];

function Button({children,tone='',...props}) {
  return <button type="button" {...props} className={'ls-btn '+tone}>{children}</button>;
}

export default function MapStudioFigma({initialStage='scan'}) {
  const navigate=useNavigate();
  const requestedStage=new URLSearchParams(window.location.search).get('stage')||initialStage;
  const [mapId,setMapId]=useState(()=>new URLSearchParams(window.location.search).get('mapId')||'');
  const [stage,setStage]=useState(()=>mapId?'endpoint':workflow.some(([id])=>id===requestedStage)?requestedStage:'scan');
  const [showLibrary,setShowLibrary]=useState(()=>!mapId&&stage==='scan'&&new URLSearchParams(window.location.search).get('stage')!=='scan');
  const index=workflow.findIndex(([id])=>id===stage);
  const openMap=(id,target)=>{
    setMapId(id);
    setStage(target);
    setShowLibrary(false);
  };

  if(showLibrary)return <section className="ls-studio">
    <header className="ls-heading">
      <div><h2>Thư viện bản đồ</h2><p>Quản lý bản đồ đã quét, thiết lập vùng và điểm đích cho robot.</p></div>
      <div className="ls-actions">
        {stage!=='scan'&&<Button onClick={()=>setShowLibrary(false)}>← Quay lại bản đồ đang chỉnh</Button>}
        <Button tone="primary" onClick={()=>{setStage('scan');setShowLibrary(false);navigate('/admin/map?stage=scan');}}>Quét map mới</Button>
      </div>
    </header>
    <SavedMapLibrary onOpen={openMap} initialMapId={mapId}/>
  </section>;

  return <section className="ls-studio">
    <div className="ls-actions" style={{marginBottom:14}}>
      <Button onClick={()=>setShowLibrary(true)}>Map đã quét trong database</Button>
    </div>
    <WorkspaceTabs label={vi('Map Studio stages')} active={stage} onSelect={setStage}
      items={workflow.map(([id,label],i)=>({id,label:`${i+1}. ${vi(label)}`}))}/>
    <div className="ls-topline"><span>{stage==='scan'?'Bản đồ robot · dữ liệu máy chủ':'Bản đồ robot đã lưu trên máy chủ'}</span></div>
    <header className="ls-heading">
      <div>
        <h2>{index+1}. {vi(workflow[index][1])}</h2>
        <p>{stage==='scan'?'Camera robot và bản đồ LiDAR được cập nhật từ phiên quét.':'Chọn bản đồ trong database để thiết lập vùng và điểm đích.'}</p>
      </div>
      <div className="ls-actions">
        {stage==='scan'&&<Button onClick={()=>navigate('/admin/system-settings')}>Cấu hình kết nối robot →</Button>}
        {stage==='zone'&&<Button tone="primary" onClick={()=>setStage('endpoint')}>Tiếp tục đặt Endpoint →</Button>}
        {stage==='endpoint'&&<Button onClick={()=>setStage('zone')}>← Quay lại Zone</Button>}
      </div>
    </header>
    {stage==='scan'
      ? <LiveMapping embedded onMapSaved={id=>openMap(id,'zone')}/>
      : <FacilityCatalogEditor stage={stage} initialMapId={mapId} onMapChange={setMapId}/>}
  </section>;
}
