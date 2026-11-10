import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../features/api/client.js';
import { getSession } from '../../features/auth/session.js';
import './fallCamera.css';

const BASE=(import.meta.env.VITE_VISION_API_BASE_URL||'http://127.0.0.1:8001').replace(/\/$/,'');
const labels={
  STOPPED:'Đã dừng',
  WAITING_FRAME:'Chờ khung hình',
  RUNNING:'Đang phân tích',
  STALE:'Mất khung hình mới',
  ERROR:'Lỗi camera/model',
  NO_DATA:'Chưa đủ dữ liệu',
  NO_PERSON:'Không thấy người',
  LOW_VISIBILITY:'Không đủ điểm khớp cơ thể',
  INSUFFICIENT_EVIDENCE:'Chưa đủ bằng chứng kết luận',
  CALIBRATING:'Đang lấy mốc đứng',
  CALIBRATING_LOWER_BODY:'Đang lấy tư thế đứng làm mốc',
  UPRIGHT:'Chưa có dấu hiệu ngã trong quan sát',
  NORMAL:'Chưa có dấu hiệu ngã trong quan sát',
  CHECKING:'Đang xác minh tư thế sụp xuống',
  UNSTABLE_POSTURE:'Tư thế không ổn định',
  HORIZONTAL_POSTURE:'Tư thế thấp/ngang · chưa xác nhận chuyển động ngã',
  SUSPECTED_FALL:'Nghi ngờ té ngã · cần người xác minh'
};
const modeLabels={
  full_body:'Toàn thân · gần đến xa (full_body)',
  lower_body:'Từ hông trở xuống · camera thấp (lower_body)',
  auto:'Tự động theo điểm khớp (auto)'
};

export default function FallCameraPage(){
  return getSession()?.account?.role==='ADMIN'&&getSession()?.mode!=='demo'
    ? <CameraWorkspace/>
    : <p role="alert">Chức năng này yêu cầu tài khoản ADMIN.</p>;
}

function CameraWorkspace(){
  const [config,setConfig]=useState(null),
    [source,setSource]=useState('browser'),
    [mode,setMode]=useState('full_body'),
    [crop,setCrop]=useState(0),
    [state,setState]=useState(null),
    [error,setError]=useState(''),
    [phase,setPhase]=useState('stopped'),
    [picture,setPicture]=useState(null);
  const video=useRef(null),canvas=useRef(null),stream=useRef(null),session=useRef(null),generation=useRef(0),controllers=useRef(new Set()),timers=useRef(new Set()),objectUrl=useRef(null),mounted=useRef(false),lastMedia=useRef(null),seq=useRef(0);

  async function request(path,options={},retry=true){
    const controller=new AbortController();controllers.current.add(controller);const timer=setTimeout(()=>controller.abort(),30000);
    const token=getSession()?.tokens?.accessToken;
    try{
      const response=await fetch(BASE+'/api/admin/camera'+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers}});
      if(response.status===401&&retry){await apiRequest('/api/v1/auth/me');return request(path,options,false);}
      if(!response.ok){const body=await response.json().catch(()=>({}));const e=new Error(body.detail||'Không kết nối được dịch vụ Vision.');e.status=response.status;throw e;}
      return options.image?response.blob():response.json();
    }finally{clearTimeout(timer);controllers.current.delete(controller);}
  }

  function clearImage(){if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=null;if(mounted.current)setPicture(null);}

  function stop(show=true){
    generation.current++;for(const c of controllers.current)c.abort();controllers.current.clear();for(const t of timers.current)clearTimeout(t);timers.current.clear();
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;
    const sid=session.current;session.current=null;clearImage();
    if(sid){const token=getSession()?.tokens?.accessToken;fetch(BASE+'/api/admin/camera/stop',{method:'POST',keepalive:true,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid})}).catch(()=>{});}
    if(show&&mounted.current){setPhase('stopped');setState({status:'STOPPED',fallState:'NO_DATA'});}
  }

  function later(fn,ms){const id=setTimeout(()=>{timers.current.delete(id);fn();},ms);timers.current.add(id);}

  async function loadConfig(){
    setError('');
    try{
      const cfg=await request('/config');
      setConfig(cfg);
    }catch(e){
      if(mounted.current&&e.name!=='AbortError')setError('Vision chưa sẵn sàng hoặc phiên đăng nhập không hợp lệ. '+e.message);
    }
  }

  useEffect(()=>{
    mounted.current=true;loadConfig();
    const hide=()=>{if(document.hidden)stop();};
    document.addEventListener('visibilitychange',hide);
    const leave=()=>stop(false);
    window.addEventListener('pagehide',leave);
    return()=>{mounted.current=false;stop(false);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',leave);};
  },[]);

  async function poll(epoch){
    if(epoch!==generation.current||!session.current)return;
    try{
      const s=await request('/state');if(epoch!==generation.current)return;setState(s);
      if(s.status==='ERROR'){throw new Error(s.error||'Camera hoặc model báo lỗi.');}
      if(['STALE','STOPPED'].includes(s.status))clearImage();
      if(s.status==='RUNNING'){
        try{
          const blob=await request('/snapshot?sessionId='+session.current,{image:true});
          if(epoch!==generation.current)return;
          const url=URL.createObjectURL(blob);
          if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
          objectUrl.current=url;
          setPicture(url);
        }catch(e){if(e.status===404)clearImage();else throw e;}
      }
      if(epoch===generation.current)later(()=>poll(epoch),500);
    }catch(e){if(epoch===generation.current&&e.name!=='AbortError'){setError(e.message);stop();}}
  }

  async function sendFrame(epoch,firstTime){
    if(epoch!==generation.current||!session.current)return;
    try{
      const v=video.current,c=canvas.current;
      if(v&&v.readyState>=2&&v.videoWidth&&v.currentTime!==lastMedia.current){
        lastMedia.current=v.currentTime;
        const scale=Math.min(1,640/v.videoWidth);
        c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);
        c.getContext('2d').drawImage(v,0,0,c.width,c.height);
        const sample=Math.max(0,v.currentTime-firstTime);
        const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.75));
        if(epoch!==generation.current||!blob)return;
        try{
          const s=await request('/frame',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Session-Id':session.current,'X-Frame-Seq':String(++seq.current),'X-Sample-Time':String(sample)},body:blob});
          if(epoch===generation.current)setState(s);
        }catch(e){if(e.status!==429)throw e;}
      }
      if(epoch===generation.current)later(()=>sendFrame(epoch,firstTime),Math.ceil(1000/Math.min(6,config?.maxFps||6)));
    }catch(e){if(epoch===generation.current&&e.name!=='AbortError'){setError(e.message);stop();}}
  }

  async function start(){
    stop(false);setError('');setPhase('starting');const epoch=generation.current;
    try{
      const s=await request('/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,cropTopPercent:crop,mode})});
      if(epoch!==generation.current){
        fetch(BASE+'/api/admin/camera/stop',{method:'POST',headers:{Authorization:'Bearer '+getSession()?.tokens?.accessToken,'Content-Type':'application/json'},body:JSON.stringify({sessionId:s.sessionId})}).catch(()=>{});
        return;
      }
      session.current=s.sessionId;setState(s);
      if(source==='browser'){
        const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});
        if(epoch!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
        stream.current=media;video.current.srcObject=media;await video.current.play();seq.current=0;lastMedia.current=null;sendFrame(epoch,video.current.currentTime);
      }
      if(epoch===generation.current){setPhase('running');poll(epoch);}
    }catch(e){
      if(epoch===generation.current){
        setError(e.name==='NotAllowedError'?'Bạn chưa cho phép dùng camera laptop.':e.name==='NotReadableError'?'Camera đang được ứng dụng khác sử dụng.':e.name==='AbortError'?'Kết nối Vision mất quá nhiều thời gian.':e.message);
        stop();
      }
    }
  }

  const active=phase!=='stopped';
  const currentMode=state?.mode||mode;
  return <section className="be-workspace fall-camera">
    <header className="fall-heading">
      <div>
        <h2>Camera & AI té ngã</h2>
        <p>Quan sát tư thế toàn thân (gần đến xa) hoặc từ hông trở xuống (camera thấp) bằng webcam laptop hoặc camera Raspberry Pi.</p>
      </div>
      <span className="fall-badge">Chế độ kiểm thử · không phát cảnh báo staff</span>
    </header>
    {error&&<p role="alert" className="be-error">{error}</p>}
    <div className="be-card fall-controls">
      <label>Nguồn camera
        <select disabled={active} value={source} onChange={e=>setSource(e.target.value)}>
          <option value="browser">Camera laptop (Webcam)</option>
          <option value="robot">Camera Raspberry Pi</option>
        </select>
      </label>
      <label>Chế độ nhận diện
        <select disabled={active} value={mode} onChange={e=>setMode(e.target.value)}>
          <option value="full_body">Toàn thân · từ gần đến xa (full_body)</option>
          <option value="lower_body">Từ hông trở xuống · camera thấp (lower_body)</option>
          <option value="auto">Tự động chọn theo khớp nhìn thấy (auto)</option>
        </select>
      </label>
      <label>Cắt phần trên ảnh để thử góc nhìn camera thấp · {crop}%
        <input type="range" min="0" max="70" step="5" value={crop} disabled={active} onChange={e=>setCrop(Number(e.target.value))}/>
      </label>
      <div className="be-actions">
        <button className="primary" disabled={!config||active||(source==='robot'&&!config.robotConfigured)} onClick={start}>
          {phase==='starting'?'Đang kết nối…':'Bật camera và AI'}
        </button>
        <button disabled={!active} onClick={()=>stop()}>Dừng camera</button>
        <button disabled={active} onClick={loadConfig}>Kiểm tra kết nối</button>
      </div>
    </div>
    {!config&&<div className="be-instruction">Khởi động Vision tại D:\AI_VOic22222: <code>.\run_system.ps1 -Profile local -NoVoice</code>. Cổng mặc định 8001.</div>}
    {source==='robot'&&!config?.robotConfigured&&<div className="be-instruction">Trên máy Vision, cấu hình <code>VISION_ROBOT_STREAM_URL=http://IP_PI:8080/stream?topic=/ascamera/camera_publisher/rgb0/image&amp;type=mjpeg&amp;width=640&amp;height=480&amp;quality=60</code> (hoặc <code>http://IP_PI:8090/video</code>) và <code>VISION_CAMERA_ALLOWED_HOSTS=IP_PI</code>, rồi khởi động lại Vision.</div>}
    <div className="fall-grid">
      <article className="be-card">
        <header className="fall-heading">
          <h3>Khung hình đã phân tích (AI vẽ khớp)</h3>
          <strong role="status">{labels[state?.status]||state?.status||'Chưa kết nối'}</strong>
        </header>
        <div className="fall-video">
          {picture?<img alt="Camera đã vẽ điểm khớp cơ thể" src={picture}/>:<p>{active?'Đang chờ khung hình mới từ model…':'Chọn chế độ, bấm "Bật camera và AI" rồi cấp quyền webcam để bắt đầu.'}</p>}
        </div>
        <p className={state?.fallState==='SUSPECTED_FALL'?'be-error':'fall-state'}>
          {labels[state?.fallState]||state?.fallState||'Chưa đủ dữ liệu'}
        </p>
        {source==='browser'&&(
          <details open>
            <summary>Video đầu vào từ Webcam Laptop (gốc)</summary>
            <video ref={video} muted playsInline autoPlay/>
          </details>
        )}
        <canvas ref={canvas} hidden/>
      </article>
      <aside className="be-card">
        <h3>Dữ liệu quan sát</h3>
        <dl>
          <dt>Chế độ nhận diện</dt>
          <dd>{modeLabels[currentMode]||currentMode}</dd>
          <dt>Người được model tìm thấy</dt>
          <dd>{state?.metrics?.detectedPeople??'Chưa có dữ liệu'}</dd>
          <dt>Thời gian xử lý khung</dt>
          <dd>{state?.processingMs==null?'Chưa đo':state.processingMs+' ms'}</dd>
          <dt>Tần suất phân tích trung bình</dt>
          <dd>{state?.inferenceFps==null?'Chưa đo':state.inferenceFps+' khung/giây'}</dd>
          <dt>Tuổi khung hình</dt>
          <dd>{state?.lastFrameAgeSec==null?'Chưa đo':state.lastFrameAgeSec+' giây'}</dd>
        </dl>
        <p>Thiếu điểm khớp là <b>không đủ bằng chứng</b>. Kết quả chưa được hiệu chuẩn thành phần trăm chính xác.</p>
        {state?.people?.map((person,i)=><details key={person.person_id??i} open={i===0}>
          <summary>Người #{person.person_id??i+1}: {labels[person.state]||person.state||'Quan sát'}</summary>
          <pre>{JSON.stringify(person.metrics,null,2)}</pre>
        </details>)}
        {state?.events?.length>0&&<p className="be-error">Có sự kiện nghi ngã cục bộ; cần người xác minh. Không gửi đến staff từ phiên thử này.</p>}
      </aside>
    </div>
    <div className="be-instruction">
      <strong>Lưu ý chế độ Toàn thân &amp; Từ hông trở xuống</strong>
      <p><b>Toàn thân (full_body):</b> Cần thấy hai vai, hai hông và ít nhất một chân đủ gối–mắt cá; đo độ rơi hông theo tỷ lệ chiều dài thân trên (<code>torso_pixels</code>) để hỗ trợ khoảng cách từ gần đến xa. <b>Từ hông trở xuống (lower_body):</b> Dùng cho camera thấp của robot, cần thấy hai hông và ít nhất một chân đủ hông–gối–mắt cá.</p>
    </div>
  </section>;
}
