import { useEffect, useRef, useState } from 'react';

export default function MappingMapPanel({title,children}) {
  const panel=useRef(null);
  const [zoom,setZoom]=useState(1),[fullscreen,setFullscreen]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const changed=()=>{setFullscreen(document.fullscreenElement===panel.current);setZoom(1);};
    document.addEventListener('fullscreenchange',changed);
    return()=>document.removeEventListener('fullscreenchange',changed);
  },[]);
  useEffect(()=>{
    const viewport=panel.current?.querySelector('.ro-preview.map');
    if(viewport){viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2;}
  },[zoom]);
  const toggleFullscreen=async()=>{
    setMessage('');
    try{
      if(document.fullscreenElement===panel.current)await document.exitFullscreen();
      else await panel.current.requestFullscreen();
    }catch{setMessage('Trình duyệt chưa mở được toàn màn hình. Bạn vẫn có thể dùng nút phóng to.');}
  };
  return <section ref={panel} className="ro-card ro-map-card" style={{'--ro-map-zoom':zoom}}>
    <header className="ro-map-heading"><h3>{title}</h3><div className="ro-map-tools" role="group" aria-label="Hiển thị bản đồ">
      <button type="button" aria-label="Thu nhỏ bản đồ" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z/1.25))}>−</button>
      <button type="button" onClick={()=>setZoom(1)}>Vừa khung</button>
      <button type="button" aria-label="Phóng to bản đồ" disabled={zoom>=4} onClick={()=>setZoom(z=>Math.min(4,z*1.25))}>+</button>
      <span aria-live="polite">{Math.round(zoom*100)}%</span>
      <button type="button" onClick={toggleFullscreen}>{fullscreen?'Thoát toàn màn hình':'Toàn màn hình'}</button>
    </div></header>
    {message&&<p className="ro-muted" role="status">{message}</p>}
    {children}
  </section>;
}
