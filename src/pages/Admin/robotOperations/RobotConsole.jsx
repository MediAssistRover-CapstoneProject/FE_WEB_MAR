import { useEffect, useRef, useState } from 'react';
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

export default function RobotConsole({ navigationOnly=false, mapId='', robotId='', endpointId='' }) {
  const frame = useRef(null);
  const [html, setHtml] = useState(''), [error, setError] = useState('');
  const operator = isOperator(getSession());
  useEffect(() => {
    if (!operator) return;
    const abort = new AbortController();
    fetch('/robot-console/mapping.html', { signal: abort.signal }).then(r => { if (!r.ok) throw Error('Không tải được giao diện robot.'); return r.text(); }).then(source => {
      const bootstrap = `<script>window.fetch=(path,options)=>window.frameElement.marRequest(path,options);document.addEventListener('DOMContentLoaded',()=>{const t=document.getElementById('token');t.value='FE_SESSION';t.closest('label').hidden=true;const c=document.getElementById('cameraStreamUrl');c.value=window.frameElement.marCamera||'';});<\/script>`;
      const scope = encodeURIComponent(API_BASE_URL + ':' + (getSession()?.account?.accountId || getSession()?.account?.username || ''));
      const config=JSON.stringify({mapId,robotId,endpointId}).replaceAll('<','\\u003c');
      const navigationSetup=navigationOnly?`<style>body{max-width:none;margin:0;padding:0;background:white;font:14px/1.6 Inter,Arial,sans-serif;color:#172b4d}body>*:not(#mapNavigation):not(style):not(script){display:none!important}#mapNavigation{margin:0;border:0;padding:16px}button{border:1px solid #cbd5e1;border-radius:7px;color:#334155}input,select{border-color:#cbd5e1!important}#navUseSaved,#navNewPoint,#navSavePoint,#navNormalize,#navActivate{display:none!important}</style><script>document.addEventListener('DOMContentLoaded',()=>{const config=${config};document.getElementById('robot').value=config.robotId;document.getElementById('navMapId').value=config.mapId;document.getElementById('navMapId').readOnly=true;document.getElementById('navSeedMode').checked=true;for(const id of ['navPointCode','navPointName','navX','navY','navYaw'])document.getElementById(id).closest('label').hidden=true;const select=document.getElementById('navEndpoints');const observer=new MutationObserver(()=>{if([...select.options].some(o=>o.value===config.endpointId)){select.value=config.endpointId;select.dispatchEvent(new Event('change'));observer.disconnect();}});if(config.endpointId)observer.observe(select,{childList:true});document.getElementById('navLoad').click();});<\/script>`:'';
      setHtml(source.replaceAll('mar-navigation-request', 'mar-navigation-request-' + scope).replace('<html lang="vi">', '<html lang="vi">' + bootstrap).replace('</html>',navigationSetup+'</html>'));
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => { abort.abort(); frame.current?.contentWindow?.dispatchEvent(new Event('pagehide')); };
  }, [operator,navigationOnly,mapId,robotId,endpointId]);
  if (!operator) return <p>Đăng nhập ADMIN thật để quét, định vị và điều khiển robot. Tài khoản demo chỉ dùng mô phỏng.</p>;
  return <section>{!navigationOnly&&<p>BE: {API_BASE_URL || 'cùng địa chỉ FE'} · Camera kết nối trực tiếp Pi. Các thao tác bên dưới gửi lệnh thật.</p>}{error && <p role="alert">{error}</p>}{html && <iframe title={navigationOnly?'Điều phối robot trên bản đồ đang hoạt động':'Điều khiển robot thật — map, định vị và MOVE'} ref={node => { if (!node) frame.current?.contentWindow?.dispatchEvent(new Event('pagehide')); frame.current = node; if (node) { node.marRequest = consoleRequest; node.marCamera = import.meta.env.VITE_ROBOT_CAMERA_URL || ''; } }} srcDoc={html} style={{ width: '100%', height: '85vh', border: '1px solid #dce5f0',borderRadius:10 }} />}</section>;
}
