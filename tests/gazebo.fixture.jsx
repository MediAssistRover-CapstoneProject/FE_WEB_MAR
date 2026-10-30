import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import GazeboPanel from '../src/pages/Admin/GazeboPanel.jsx';
import { createDraft } from '../src/pages/Admin/mapStudioModel.js';
import {localMockMap,rosToWeb,mapBinding} from '../src/features/maps/MapProvider.js';
import '../src/pages/Admin/patrol.css';
import '../src/pages/Admin/mapStudio.css';
if(location.port!=='5175')throw Error('Fixture requires isolated origin 5175');
localStorage.setItem('mediassist-rover.session',JSON.stringify({account:{role:'ADMIN'},tokens:{accessToken:'browser-fixture-only'}}));
const map={...createDraft(),mapSource:mapBinding(),name:'Bản đồ LiDAR · Kiểm thử',scan:{status:'complete',progress:100},endpoints:[0,.4].map((dx,i)=>({id:'ep'+i,name:'Điểm '+i,...rosToWeb({...localMockMap.spawn,x:localMockMap.spawn.x+dx})}))};
const plan={valid:true,points:map.endpoints.map(endpoint=>({endpoint,step:{paramsJson:{max_speed_mps:.15}}}))};
window.gazeboTestManifest=localMockMap;
function Fixture(){
 const [visible,setVisible]=useState(true),[view,setView]=useState('gazebo');
 return <main className="patrol-workspace" style={{maxWidth:1100,margin:'auto',padding:16,fontFamily:'Arial',boxSizing:'border-box'}}>
 <h1>Gazebo · Kiểm thử giao diện</h1><button onClick={()=>setVisible(false)}>Rời màn hình</button>
 {['2d','3d','gazebo'].map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}
 {visible&&<GazeboPanel map={map} plan={plan} viewMode={view}/>}</main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
