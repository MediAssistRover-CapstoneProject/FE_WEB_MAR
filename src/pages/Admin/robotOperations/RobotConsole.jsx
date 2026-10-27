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

export default function RobotConsole() {
  const frame = useRef(null);
  const [html, setHtml] = useState(''), [error, setError] = useState('');
  const operator = isOperator(getSession());
  useEffect(() => {
    if (!operator) return;
    const abort = new AbortController();
    fetch('/robot-console/mapping.html', { signal: abort.signal }).then(r => { if (!r.ok) throw Error('Không tải được giao diện robot.'); return r.text(); }).then(source => {
      const bootstrap = `<script>window.fetch=(path,options)=>window.frameElement.marRequest(path,options);document.addEventListener('DOMContentLoaded',()=>{const t=document.getElementById('token');t.value='FE_SESSION';t.closest('label').hidden=true;const c=document.getElementById('cameraStreamUrl');c.value=window.frameElement.marCamera||'';});<\/script>`;
      const scope = encodeURIComponent(API_BASE_URL + ':' + (getSession()?.account?.accountId || getSession()?.account?.username || ''));
      setHtml(source.replaceAll('mar-navigation-request', 'mar-navigation-request-' + scope).replace('<html lang="vi">', '<html lang="vi">' + bootstrap));
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => { abort.abort(); frame.current?.contentWindow?.dispatchEvent(new Event('pagehide')); };
  }, [operator]);
  if (!operator) return <p>Đăng nhập ADMIN thật để quét, định vị và điều khiển robot. Tài khoản demo chỉ dùng mô phỏng.</p>;
  return <section><p>BE: {API_BASE_URL || 'cùng địa chỉ FE'} · Camera kết nối trực tiếp Pi. Các thao tác bên dưới gửi lệnh thật.</p>{error && <p role="alert">{error}</p>}{html && <iframe title="Điều khiển robot thật — map, định vị và MOVE" ref={node => { if (!node) frame.current?.contentWindow?.dispatchEvent(new Event('pagehide')); frame.current = node; if (node) { node.marRequest = consoleRequest; node.marCamera = import.meta.env.VITE_ROBOT_CAMERA_URL || ''; } }} srcDoc={html} style={{ width: '100%', height: '85vh', border: '1px solid #ddd' }} />}</section>;
}
