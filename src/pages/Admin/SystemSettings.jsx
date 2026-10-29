import { vi } from '../../i18n/vi.js';
import { injectStyles } from '../../styles/injectStyles.js';
const inlineStyles = String.raw`.system-settings{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;padding-top:8px}.settings-nav,.settings-panel{border:1px solid #cbd5e1;border-radius:10px;background:#fff}.settings-nav{min-height:778px;padding:14px 16px}.settings-nav>b,.settings-panel>small{display:block;color:#475569;font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.35px}.settings-nav button{display:block;width:100%;margin:10px 0 0;padding:10px 16px;border-radius:6px;background:transparent;color:#475569;text-align:left;font-size:11px;font-weight:400}.settings-nav button:hover,.settings-nav button.active{background:#dbeafe;color:#0f172a;font-weight:600}.settings-panel{min-height:778px;padding:14px 20px;display:flex;flex-direction:column}.settings-panel h2{margin:14px 6px 24px;font-size:18px}.settings-form{max-width:620px;display:flex;flex-direction:column;gap:15px}.settings-form label{display:flex;flex-direction:column;gap:8px;font-size:12px;color:#0f172a}.settings-form select{height:38px;padding:0 12px;border:1px solid #cbd5e1;border-radius:7px;background:#f1f5f9;color:#475569;font:11px Inter,Arial,sans-serif}.settings-toggle{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid #e2e8f0;border-radius:0;background:transparent;color:#0f172a;text-align:left;font-size:12px;font-weight:500}.settings-toggle i{width:34px;height:18px;padding:2px;border-radius:99px;background:#cbd5e1}.settings-toggle i:after{content:'';display:block;width:14px;height:14px;border-radius:50%;background:#fff;transition:.2s}.settings-toggle i.on{background:#2f80ff}.settings-toggle i.on:after{transform:translateX(16px)}.settings-panel footer{margin-top:auto;padding:18px 0 2px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;color:#15803d;font-size:11px}.settings-panel footer button{height:36px;padding:0 15px;font-size:13px}@media(max-width:700px){.system-settings{grid-template-columns:1fr}.settings-nav{min-height:0;display:flex;flex-wrap:wrap;gap:6px}.settings-nav>b{width:100%}.settings-nav button{width:auto;margin:0}.settings-panel{min-height:620px}.settings-panel footer{gap:10px;align-items:flex-start;flex-direction:column}}
.settings-form label>span{color:#64748b;font-size:11px;font-weight:400}.settings-form .setting-json{min-height:118px;padding:10px;border:1px solid #bfdbfe;border-radius:8px;background:#f8fbff;color:#0f172a;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.5;resize:vertical}.settings-form label>button{align-self:flex-start;height:32px;padding:0 12px;font-size:11px}
`;
injectStyles('mediassist-style-pages-Admin-SystemSettings-jsx', inlineStyles);

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../features/admin/adminApi.js';
import LiveMapping, { ROBOT_CAMERA_URL_KEY } from './robotOperations/LiveMapping.jsx';

export function RobotCameraSettings() {
  const [url, setUrl] = useState(() => localStorage.getItem(ROBOT_CAMERA_URL_KEY) || import.meta.env.VITE_ROBOT_CAMERA_URL || '');
  const [message, setMessage] = useState('');
  const save = () => {
    try {
      if (url.trim()) {
        const parsed = new URL(url.trim());
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw Error('URL phải dùng HTTP/HTTPS và không chứa tài khoản hoặc mật khẩu.');
        if (location.protocol === 'https:' && parsed.protocol !== 'https:') throw Error('Trang HTTPS cần URL video HTTPS.');
        localStorage.setItem(ROBOT_CAMERA_URL_KEY, parsed.href);
      } else localStorage.removeItem(ROBOT_CAMERA_URL_KEY);
      setMessage('Đã lưu trên trình duyệt này. Mở lại Bản đồ → Quét để áp dụng. Để trống để dùng ảnh MQTT.');
    } catch (error) { setMessage(error.message); }
  };
  return <div className="settings-form"><label><b>URL video trực tiếp từ robot</b><span>Chỉ dùng khi máy mở web truy cập được Pi cùng mạng. Để trống để xem ảnh MQTT qua máy chủ.</span><input type="url" placeholder="http://IP_PI:8080/stream?topic=/ascamera/camera_publisher/rgb0/image" value={url} onChange={(event) => setUrl(event.target.value)} /></label><button type="button" onClick={save}>Lưu nguồn camera</button>{message && <p role="status">{message}</p>}</div>;
}

export default function SystemSettings() {
  const [settings, setSettings] = useState([]); const [active, setActive] = useState('__robot__'); const [drafts, setDrafts] = useState({}); const [notice, setNotice] = useState('');
  const load = useCallback(async () => { try { const page = await adminApi.listSettings({ size: 100 }); const items = page.content ?? []; setSettings(items); const initial = Object.fromEntries(items.map((item) => [item.systemSettingId, JSON.stringify(item.settingValue, null, 2)])); setDrafts(initial); setActive((current) => current || items[0]?.category || ''); } catch (error) { setNotice(error.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const categories = useMemo(() => [...new Set(settings.map((setting) => setting.category))], [settings]);
  const visible = settings.filter((setting) => setting.category === active);
  const save = async (setting) => { try { const settingValue = JSON.parse(drafts[setting.systemSettingId]); await adminApi.updateSetting(setting.systemSettingId, { settingValue, dataType: setting.dataType, category: setting.category, description: setting.description, publicSetting: setting.publicSetting }); setNotice(`${setting.settingKey} saved.`); await load(); } catch (error) { setNotice(error instanceof SyntaxError ? 'Setting value must be valid JSON.' : error.message); } };
  return <section className="system-settings"><aside className="settings-nav"><b>{vi("Settings")}</b><button className={active === '__robot__' ? 'active' : ''} onClick={() => { setActive('__robot__'); setNotice(''); }}>Kết nối robot & phiên quét</button>{vi(categories.map((category) => <button className={active === category ? 'active' : ''} onClick={() => { setActive(category); setNotice(''); }} key={category}>{vi(category)}</button>))}</aside><article className="settings-panel">{active === '__robot__' ? <><small>Thiết bị và phiên quét</small><h2>Kết nối robot & phiên quét</h2><RobotCameraSettings /><LiveMapping configurationOnly /></> : <><small>{vi(active || 'System')}{vi(" settings")}</small><h2>{vi(active ? `${active} configuration` : 'System configuration')}</h2><div className="settings-form">{vi(visible.map((setting) => <label key={setting.systemSettingId}><b>{vi(setting.settingKey)}</b><span>{vi(setting.description || 'Runtime configuration value')}</span><textarea className="setting-json" value={drafts[setting.systemSettingId] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [setting.systemSettingId]: event.target.value }))} /><button type="button" onClick={() => save(setting)}>{vi("Save ")}{vi(setting.settingKey)}</button></label>))}{vi(!visible.length && <p>{vi("No runtime settings are available for this category.")}</p>)}</div><footer><span>{vi(notice || 'Changes are stored in the backend and recorded in audit logs.')}</span><button onClick={load}>{vi("Refresh")}</button></footer></>}</article></section>;
}
