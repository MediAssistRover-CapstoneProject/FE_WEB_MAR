import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, API_BASE_URL } from '../../../features/api/client.js';
import { getSession } from '../../../features/auth/session.js';
import { isOperator } from '../../../features/robotOperations/model.js';

const assets = new Set(['mapping-workflow.json', 'mapping-local-workflow.json', 'speech-workflow.json', 'navigation-move-workflow.json']);
// The reviewed BE console runs locally; all protected calls use FE token refresh.
export async function consoleRequest(path, options = {}) {
  const value = String(path);
  if (!value.startsWith('/api/v1/')) {
    const asset = value.replace(/^\//, '');
    if (!assets.has(asset)) throw Error('Nguồn dữ liệu không được hỗ trợ.');
    return fetch(`/robot-console/${asset}`, { signal: options.signal });
  }
  if (!isOperator(getSession())) return new Response(JSON.stringify({ message: 'Cần đăng nhập ADMIN thật.' }), { status: 403 });
  const headers = new Headers(options.headers);
  headers.delete('Authorization');
  try {
    return await apiRequest(value, { ...options, headers: Object.fromEntries(headers), body: options.body === undefined ? undefined : JSON.parse(options.body), responseType: 'response' });
  } catch (error) {
    if (!error.status) throw error;
    return new Response(JSON.stringify(error.body || { message: error.message }), { status: error.status, headers: { 'Content-Type': 'application/json' } });
  }
}

export default function RobotConsole({ navigationOnly=false, mapId='', robotId='' }) {
  const frame = useRef(null), frameResize = useRef(null);
  const [html, setHtml] = useState(''), [error, setError] = useState('');
  const operator = isOperator(getSession());
  const attachFrame=useCallback(node=>{
    if(!node){frameResize.current?.disconnect();frame.current?.contentWindow?.dispatchEvent(new Event('pagehide'));}
    frame.current=node;
    if(node){node.marRequest=consoleRequest;node.marCamera=import.meta.env.VITE_ROBOT_CAMERA_URL||'';}
  },[]);
  useEffect(() => {
    if (!operator) return;
    const abort = new AbortController();
    fetch('/robot-console/mapping.html', { signal: abort.signal }).then(r => { if (!r.ok) throw Error('Không tải được giao diện robot.'); return r.text(); }).then(source => {
      const bootstrap = `<script>window.fetch=(path,options)=>window.frameElement.marRequest(path,options);document.addEventListener('DOMContentLoaded',()=>{const t=document.getElementById('token');t.value='FE_SESSION';t.closest('label').hidden=true;const c=document.getElementById('cameraStreamUrl');c.value=window.frameElement.marCamera||'';});<\/script>`;
      const scope = encodeURIComponent(API_BASE_URL + ':' + (getSession()?.account?.accountId || getSession()?.account?.username || ''));
      const config=JSON.stringify({mapId,robotId}).replaceAll('<','\\u003c');
      const navigationSetup=navigationOnly?`<style>body{max-width:none;margin:0;padding:0;background:#f7f9fc;font:13px/1.5 Inter,Arial,sans-serif;color:#172b4d}body>*:not(#mapNavigation):not(style):not(script){display:none!important}#mapNavigation{margin:0;border:0;padding:16px;background:transparent}#navMapLoader,#navEndpointEditor,#navNormalize,#navActivate{display:none!important}</style><script>document.addEventListener('DOMContentLoaded',()=>{const config=${config};document.getElementById('robot').value=config.robotId;document.getElementById('navMapId').value=config.mapId;document.getElementById('navMapId').readOnly=true;document.getElementById('navLoad').click();});<\/script>`:'';
      setHtml(source.replace('<html lang="vi">', '<html lang="vi"><script>window.marNavigationStorage='+JSON.stringify('mar-navigation-request-'+scope)+';<\/script>').replace('<html lang="vi">', '<html lang="vi">' + bootstrap).replace('</html>',navigationSetup+'</html>'));
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => { abort.abort(); frameResize.current?.disconnect(); frame.current?.contentWindow?.dispatchEvent(new Event('pagehide')); };
  }, [operator,navigationOnly,mapId,robotId]);
  if (!operator) return <p>Đăng nhập ADMIN thật để quét, định vị và điều khiển robot. Tài khoản demo chỉ dùng mô phỏng.</p>;
  return <section>{!navigationOnly&&<p>BE: {API_BASE_URL || 'cùng địa chỉ FE'} · Camera kết nối trực tiếp Pi. Các thao tác bên dưới gửi lệnh thật.</p>}{error && <p role="alert">{error}</p>}{html && <iframe allow="clipboard-write" title={navigationOnly?'Điều phối robot trên bản đồ đang hoạt động':'Điều khiển robot thật — map, định vị và MOVE'} ref={attachFrame} onLoad={()=>{
    frameResize.current?.disconnect();
    const node=frame.current,content=node?.contentDocument?.getElementById('mapNavigation');
    if(!navigationOnly||!content)return;
    const resize=()=>{const height=Math.ceil(content.getBoundingClientRect().height)+2;if(height>0&&Math.abs(node.getBoundingClientRect().height-height)>1)node.style.height=height+'px';};
    frameResize.current=new ResizeObserver(resize);frameResize.current.observe(content);resize();
  }} srcDoc={html} style={{ width: '100%', height: navigationOnly?'700px':'85vh' , border: '1px solid #dce5f0',borderRadius:10 }} />}</section>;
}
