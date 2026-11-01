import { useNavigate, useSearchParams } from 'react-router-dom';
import MapDispatch from './MapDispatch.jsx';
import ServerDispatch from './ServerDispatch.jsx';
import LiveMapping from '../Admin/robotOperations/LiveMapping.jsx';
import SpeechAnnouncement from '../Admin/robotOperations/SpeechAnnouncement.jsx';

const modes = [
  { id: 'server', label: 'Bản đồ máy chủ' },
  { id: 'mapping', label: 'Quét & điều khiển' },
  { id: 'speech', label: 'Phát thông báo' },
  { id: 'local', label: 'Mô phỏng cục bộ' },
];

export default function DispatchWorkspace(props){
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = modes.some(item => item.id === params.get('mode')) ? params.get('mode') : 'server';
  const selectMode = id => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (id === 'server') next.delete('mode');
    else next.set('mode', id);
    return next;
  });
  return <section className="server-dispatch" aria-label="Không gian điều phối robot">
    <div className="ls-studio ls-actions" style={{marginTop:16}} role="group" aria-label="Chế độ điều phối">
      {modes.map(item => <button key={item.id} className={'ls-btn '+(mode===item.id?'primary':'')} aria-pressed={mode===item.id} onClick={()=>selectMode(item.id)}>{item.label}</button>)}
    </div>
    {mode === 'server' && <ServerDispatch/>}
    {mode === 'mapping' && <div style={{marginTop:16}}><LiveMapping embedded onMapSaved={mapId => navigate('/admin/map?mapId='+encodeURIComponent(mapId))}/></div>}
    {mode === 'speech' && <div style={{marginTop:16}}><SpeechAnnouncement/></div>}
    {mode === 'local' && <MapDispatch {...props}/>}
  </section>;
}
