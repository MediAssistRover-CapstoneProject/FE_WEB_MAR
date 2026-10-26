import {useEffect,useRef,useState} from 'react';
export default function GazeboDesktop({url,onStop,canStop}) {
 const host=useRef(null),expand=useRef(null);
 const [wide,setWide]=useState(false),[version,setVersion]=useState(0),[loaded,setLoaded]=useState(false),[hint,setHint]=useState('Đang tải desktop Docker…');
 useEffect(()=>{setLoaded(false);setHint('Đang tải desktop Docker…');const id=setTimeout(()=>setHint('Nếu màn hình trống: kiểm tra Docker và cổng 6080, rồi bấm Kết nối lại.'),12000);return()=>clearTimeout(id);},[url,version]);
 useEffect(()=>{
  if(!wide)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const key=e=>{if(e.key==='Escape'&&!document.fullscreenElement){setWide(false);expand.current?.focus();}};
  window.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',key);};
 },[wide]);
 const fullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await host.current.requestFullscreen();}catch{setWide(true);setHint('Đã mở rộng trong trang; trình duyệt chưa cho phép toàn màn hình.');}};
 return <section ref={host} className={'gazebo-desktop'+(wide?' gazebo-desktop-expanded':'')} aria-label="Màn hình Gazebo và RViz2">
  <div className="gazebo-desktop-bar"><div><strong>Gazebo & RViz2</strong><small>Desktop trực tiếp trong Docker</small></div><div className="gazebo-window-actions"><button disabled={!canStop} onClick={onStop}>Dừng hành trình</button><button onClick={()=>setVersion(v=>v+1)}>Kết nối lại</button><button onClick={fullscreen}>Toàn màn hình</button><button ref={expand} aria-expanded={wide} onClick={()=>setWide(v=>!v)}>{wide?'Thu lại':'Mở màn hình lớn'}</button></div></div>
  {!loaded&&<p role="status">{hint}</p>}
  <iframe key={version} title="Gazebo và RViz2 trực tiếp" src={url} allow="fullscreen" onLoad={()=>setLoaded(true)} onError={()=>{setLoaded(false);setHint('Không tải được desktop. Kiểm tra container mô phỏng.');}}/>
  <p>Trạng thái kết nối hiển thị trong noVNC. Phóng lớn giữ nguyên phiên đang mở; thu lại bằng nút ở trên.</p>
 </section>;
}
