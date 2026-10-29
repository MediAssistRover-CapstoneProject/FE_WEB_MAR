import { useState } from 'react';
import MapDispatch from './MapDispatch.jsx';
import ServerDispatch from './ServerDispatch.jsx';
export default function DispatchWorkspace(props){
  const [mode,setMode]=useState('server');
  return <><div className="ls-studio ls-actions" style={{marginTop:16}}><button className={'ls-btn '+(mode==='server'?'primary':'')} aria-pressed={mode==='server'} onClick={()=>setMode('server')}>Bản đồ máy chủ</button><button className={'ls-btn '+(mode==='local'?'primary':'')} aria-pressed={mode==='local'} onClick={()=>setMode('local')}>Mô phỏng cục bộ</button></div>{mode==='server'?<ServerDispatch/>:<MapDispatch {...props}/>}</>;
}
