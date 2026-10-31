import { vi } from '../../i18n/vi.js';
import { injectStyles } from '../../styles/injectStyles.js';
const inlineStyles = String.raw`.monitor-screen{color:#0f172a;font-family:Inter,Arial,sans-serif;min-width:0;padding-top:8px}.monitor-screen *{box-sizing:border-box}.monitor-panel{background:#fff;border:1px solid #cbd5e1;border-radius:10px;min-width:0}.monitor-panel__head{color:#475569;font-size:13px;font-weight:500;letter-spacing:.35px;text-transform:uppercase}.monitor-panel__head--split{align-items:center;display:flex;justify-content:space-between;gap:10px}.monitor-panel__head small{color:#64748b;font-size:9px;font-weight:500;letter-spacing:0;text-transform:none}.monitor-kicker{color:#475569;display:block;font-size:10px;margin-top:20px}.monitor-notice{color:#15803d;font-size:11px;font-weight:600;margin:12px 2px 0}.monitor-screen button{font-family:inherit;font-weight:600}.monitor-screen button.secondary{background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a}.monitor-screen button.danger{background:#f05252}.monitor-screen select,.monitor-screen textarea,.monitor-screen input{font-family:inherit}.monitor-icon-action{align-items:center;background:#2f80ff;border-radius:5px;color:#fff;display:inline-flex;font-size:18px;height:24px;justify-content:center;line-height:1;padding:0;width:24px}

/* Voice & Scripts — Figma node 7:501 */
.voice-scripts__layout{display:grid;gap:18px;grid-template-columns:300px minmax(0,550px) minmax(230px,1fr)}.voice-scripts__library,.voice-scripts__editor,.voice-scripts__usage{min-height:778px;padding:14px 16px}.voice-scripts__categories{display:grid;gap:10px;margin-top:12px}.voice-scripts__categories button{background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;font-size:11px;height:42px;padding:0 13px;text-align:left}.voice-scripts__categories button.is-selected{background:#dbeafe;color:#0f172a}.voice-scripts__library h3,.voice-scripts__voice-settings h3{font-size:11px;margin:28px 0 16px}.voice-scripts__script-list{display:grid;gap:13px}.voice-scripts__script-list button{background:transparent;color:#475569;font-size:10px;font-weight:400;padding:0 14px;text-align:left}.voice-scripts__script-list button:hover,.voice-scripts__script-list button.is-active{color:#1d4ed8;font-weight:600}.voice-scripts__editor h2,.voice-scripts__usage h2{font-size:18px;margin:15px 4px 24px}.voice-scripts__selects{display:grid;gap:16px;grid-template-columns:1fr 1fr}.voice-scripts__selects label,.voice-scripts__message{color:#475569;display:flex;flex-direction:column;font-size:10px;gap:8px}.voice-scripts__selects select,.voice-scripts__voice-settings select{appearance:auto;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;font-size:11px;height:36px;padding:0 12px}.voice-scripts__message{margin-top:20px}.voice-scripts__message textarea{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;font-size:12px;height:180px;line-height:1.45;padding:14px;resize:vertical}.voice-scripts__field-label{color:#475569;display:block;font-size:10px;margin-top:25px}.voice-scripts__variables{display:flex;gap:6px;margin-top:12px}.voice-scripts__variables button{background:#f1f5f9;border:1px solid #cbd5e1;color:#0e7490;flex:1;font-size:9px;height:28px;min-width:0;padding:0 6px}.voice-scripts__voice-settings h3{margin:28px 0 18px}.voice-scripts__voice-settings>label{align-items:center;color:#475569;display:grid;font-size:10px;gap:12px;grid-template-columns:78px auto 1fr;margin:18px 0}.voice-scripts__voice-settings>label b{font-size:10px;font-weight:400}.voice-scripts__voice-settings input[type=range]{accent-color:#2f80ff;height:8px;margin:0;width:100%}.voice-scripts__voice-settings select{grid-column:2 / span 2;width:120px}.voice-scripts__editor-actions{display:flex;gap:10px;margin-top:32px}.voice-scripts__editor-actions button{font-size:13px;height:34px;padding:0 14px;white-space:nowrap}.voice-scripts__usage .monitor-kicker:first-of-type{margin-top:17px}.voice-scripts__usage h2{font-size:14px;margin:11px 2px 20px}.voice-scripts__templates{display:grid;gap:12px}.voice-scripts__templates article{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;min-height:52px;padding:10px 12px}.voice-scripts__templates b{display:block;font-size:10px}.voice-scripts__templates span{color:#15803d;display:block;font-size:9px;margin-top:7px;text-align:right}.voice-scripts__fallback{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;font-size:10px;line-height:1.45;margin:12px 0 22px;padding:13px 12px}.voice-scripts__robot-test{font-size:13px;height:34px;margin-bottom:17px;width:100%}.voice-scripts__usage>small{color:#475569;display:block;font-size:10px;margin:12px 0}

/* Analytics & Reports — Figma node 7:362 */
.analytics-reports__tools{align-items:center;display:flex;justify-content:space-between;margin-bottom:15px}.monitor-segmented{display:flex;gap:9px}.monitor-segmented button{background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;font-size:11px;height:36px;min-width:92px;padding:0 17px}.monitor-segmented button.is-selected{background:#dbeafe;color:#0f172a}.analytics-reports__tools>button{font-size:11px;height:36px;padding:0 17px}.analytics-reports__metrics{display:grid;gap:12px;grid-template-columns:repeat(6,minmax(0,1fr));margin-bottom:14px}.analytics-reports__metrics article{height:78px;padding:12px}.analytics-reports__metrics span{color:#475569;display:block;font-size:10px}.analytics-reports__metrics strong{display:block;font-size:18px;margin-top:10px}.analytics-reports__metrics .is-green{color:#15803d}.analytics-reports__metrics .is-teal{color:#0e7490}.analytics-reports__metrics .is-amber{color:#a16207}.analytics-reports__grid{display:grid;gap:14px;grid-template-columns:minmax(330px,1fr) minmax(350px,1.04fr)}.analytics-reports__charts{display:grid;gap:12px}.analytics-reports__chart{background:#031b34;border:1px solid #cbd5e1;border-radius:8px;margin:0;min-height:0;overflow:hidden}.analytics-reports__chart img{display:block;height:auto;width:100%}.analytics-reports__insights{display:grid;gap:12px;grid-template-rows:1fr 1fr}.analytics-reports__utilization,.analytics-reports__quality{padding:12px}.analytics-reports__utilization .monitor-panel__head,.analytics-reports__quality .monitor-panel__head{margin-bottom:17px}.analytics-reports__util-row{align-items:center;display:grid;gap:10px;grid-template-columns:62px minmax(80px,1fr) 32px;margin:13px 0}.analytics-reports__util-row span,.analytics-reports__util-row b{color:#475569;font-size:9px;font-weight:500}.analytics-reports__util-row b{text-align:right}.analytics-reports__util-row>div{background:#e2e8f0;border-radius:8px;height:9px;overflow:hidden}.analytics-reports__util-row i{background:#2f80ff;border-radius:8px;display:block;height:100%}.analytics-reports__util-row .is-amber{background:#f5b82e}.analytics-reports__util-row .is-green{background:#28d17c}.analytics-reports__util-row .is-slate{background:#8ea4c0}.analytics-reports__util-row .is-red{background:#f05252}.analytics-reports__quality{position:relative}.analytics-reports__quality-row{align-items:center;display:grid;grid-template-columns:1fr 54px 38px;margin:13px 0}.analytics-reports__quality-row span,.analytics-reports__quality-row b,.analytics-reports__quality-row em{font-size:9px;font-style:normal}.analytics-reports__quality-row span{color:#475569}.analytics-reports__quality-row em{color:#15803d;text-align:right}.analytics-reports__quality button{bottom:13px;font-size:11px;height:25px;position:absolute;right:13px}

/* History & Replay — Figma node 79:2 */
.history-replay__tools{align-items:center;color:#475569;display:flex;font-size:10px;justify-content:space-between;margin:-2px 0 12px}.history-replay__tools>div{display:flex;gap:8px}.history-replay__tools button{font-size:10px;height:32px;padding:0 12px}.history-replay__layout{display:grid;gap:12px;grid-template-columns:minmax(180px,.8fr) minmax(350px,1.62fr) minmax(210px,.94fr)}.history-replay__sessions,.history-replay__map-card{min-height:512px;padding:12px}.history-replay__sessions>button{align-items:flex-start;background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a;display:grid;gap:8px;grid-template-columns:22px minmax(0,1fr) 8px;margin:8px 0 0;min-height:75px;padding:10px;text-align:left;width:100%}.history-replay__sessions>button.is-selected{background:#fff;border-color:#2f80ff;box-shadow:inset 0 0 0 1px #2f80ff}.history-replay__sessions>button>img{height:22px;width:22px}.history-replay__sessions>button span{min-width:0}.history-replay__sessions>button b,.history-replay__sessions>button small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.history-replay__sessions>button b{font-size:10px}.history-replay__sessions>button small{color:#475569;font-size:8px;font-weight:400;margin-top:4px}.history-replay__sessions>button em{border-radius:4px;color:#fff;display:inline-block;font-size:8px;font-style:normal;margin-top:7px;padding:3px 7px}.history-replay__sessions em.is-complete{background:#28d17c}.history-replay__sessions em.is-failed{background:#f05252}.history-replay__sessions em.is-interrupted{background:#f5b82e}.history-replay__sessions>button>i{font-size:17px;font-style:normal;grid-column:3;grid-row:1}.history-replay__sessions>button time{color:#475569;font-size:8px;grid-column:2 / span 2;text-align:right}.history-replay__sessions footer{align-items:center;color:#64748b;display:flex;font-size:9px;justify-content:space-between;margin-top:11px}.history-replay__sessions footer button{background:#fff;border:1px solid #cbd5e1;color:#475569;font-size:12px;height:20px;margin-left:5px;padding:0;width:20px}.history-replay__map-card img{border:1px solid #cbd5e1;border-radius:5px;display:block;height:405px;margin-top:12px;object-fit:contain;width:100%}.history-replay__map-card .monitor-panel__head button{font-size:9px;height:23px;padding:0 11px}.history-replay__right-column{display:grid;gap:10px;grid-template-rows:1.25fr 1fr}.history-replay__details,.history-replay__events{padding:12px}.history-replay__details .monitor-panel__head em{background:#dcfce7;border-radius:3px;color:#15803d;font-size:8px;font-style:normal;padding:4px 7px}.history-replay__details p{display:grid;gap:5px;grid-template-columns:82px minmax(0,1fr);margin:8px 0}.history-replay__details p span,.history-replay__details p b{font-size:8px}.history-replay__details p span{color:#64748b}.history-replay__details p b{font-weight:500}.history-replay__events .monitor-panel__head button{font-size:8px;height:24px;padding:0 8px}.history-replay__events p{align-items:center;display:grid;gap:7px;grid-template-columns:43px 10px minmax(0,1fr);margin:9px 0}.history-replay__events p time,.history-replay__events p span{font-size:8px}.history-replay__events p time{color:#64748b}.history-replay__events p img{height:10px;width:10px}.history-replay__player{align-items:center;display:grid;gap:16px;grid-template-columns:180px minmax(230px,1fr) 132px;margin-top:12px;min-height:86px;padding:12px}.history-replay__transport{align-items:center;display:flex;justify-content:center;gap:8px}.history-replay__transport button{font-size:9px;height:28px;padding:0 8px}.history-replay__transport .history-replay__play{align-items:center;border-radius:50%;display:inline-flex;font-size:14px;height:30px;justify-content:center;padding:0;width:30px}.history-replay__timeline{display:grid;grid-template-columns:1fr;position:relative}.history-replay__timeline>span{color:#475569;font-size:8px;margin-bottom:2px}.history-replay__timeline input{accent-color:#2f80ff;width:100%}.history-replay__timeline div{display:flex;justify-content:space-around;margin-top:-5px;pointer-events:none}.history-replay__timeline div img{height:10px;width:10px}.history-replay__timeline small{color:#64748b;font-size:7px;margin-top:5px}.history-replay__player-actions{display:flex;gap:8px}.history-replay__player-actions button{font-size:9px;height:28px;padding:0 11px}

/* Alerts & Notifications — Figma node 7:2 */
.alerts-notifications__tools{align-items:center;display:flex;justify-content:space-between;margin-bottom:12px}.alerts-notifications__tools>button{font-size:11px;height:36px;padding:0 16px}.monitor-tab-list{display:flex;gap:12px}.monitor-tab-list button{background:transparent;color:#475569;font-size:10px;height:36px;min-width:82px;padding:0 13px}.monitor-tab-list button.is-selected{background:#dbeafe;color:#0f172a}.alerts-notifications__table-card{min-height:398px;padding:12px}.alerts-notifications__table-scroll{overflow-x:auto}.alerts-notifications__table-card table{border-collapse:separate;border-spacing:0 9px;min-width:800px;width:100%}.alerts-notifications__table-card th{color:#475569;font-size:8px;font-weight:500;padding:0 3px 2px;text-align:left}.alerts-notifications__table-card td{background:#f1f5f9;border-bottom:1px solid #cbd5e1;border-top:1px solid #cbd5e1;font-size:8px;padding:11px 3px}.alerts-notifications__table-card td:first-child{border-left:1px solid #cbd5e1;border-radius:4px 0 0 4px}.alerts-notifications__table-card td:last-child{border-radius:0 4px 4px 0;border-right:1px solid #cbd5e1}.alerts-notifications__table-card tr.is-selected td{background:#fff1f1}.alerts-notifications__table-card td em{font-size:8px;font-style:normal;font-weight:600;text-transform:uppercase}.alerts-notifications__table-card .is-critical{color:#b91c1c}.alerts-notifications__table-card .is-warning{color:#a16207}.alerts-notifications__table-card .is-info{color:#0e7490}.alerts-notifications__table-card td button{background:transparent;color:#2f80ff;font-size:8px;padding:0}.alerts-notifications__bottom{display:grid;gap:12px;grid-template-columns:1fr 1.05fr;margin-top:12px}.alerts-notifications__detail,.alerts-notifications__routing{min-height:105px;padding:12px}.alerts-notifications__detail h2{color:#a16207;font-size:12px;margin:7px 0 4px}.alerts-notifications__detail p{color:#475569;font-size:8px;margin:0}.alerts-notifications__detail>div:last-child{display:flex;gap:8px;margin-top:14px}.alerts-notifications__detail>div:last-child button{font-size:9px;height:25px;padding:0 11px}.alerts-notifications__routing{position:relative}.alerts-notifications__routing p{font-size:8px;margin:12px 0}.alerts-notifications__routing p b{font-weight:600}.alerts-notifications__routing button{bottom:12px;font-size:10px;height:25px;position:absolute;right:12px}

.alerts-notifications__table-card .alerts-notifications__empty{color:#64748b;font-size:11px;margin:38px 4px;text-align:center}.alerts-notifications__table-card .alerts-notifications__error{color:#b91c1c}.alerts-notifications__detail .alert-status{color:#475569;font-size:8px;margin-top:5px}.alerts-notifications__detail .alert-status b{color:#0f172a}.alerts-notifications__detail .api-action{min-width:102px}.alerts-notifications__detail .api-action:disabled,.alerts-notifications__tools button:disabled{cursor:not-allowed;opacity:.65}

@media(max-width:1150px){.voice-scripts__layout{grid-template-columns:260px minmax(0,1fr)}.voice-scripts__usage{grid-column:span 2;min-height:auto}.analytics-reports__metrics{grid-template-columns:repeat(3,1fr)}.history-replay__layout{grid-template-columns:minmax(190px,.75fr) minmax(340px,1.5fr)}.history-replay__right-column{grid-column:span 2;grid-template-columns:1fr 1fr;grid-template-rows:none}.history-replay__details,.history-replay__events{min-height:260px}}
@media(max-width:820px){.voice-scripts__layout,.analytics-reports__grid,.history-replay__layout,.alerts-notifications__bottom{grid-template-columns:1fr}.voice-scripts__usage,.history-replay__right-column{grid-column:auto}.voice-scripts__library,.voice-scripts__editor,.voice-scripts__usage{min-height:auto}.analytics-reports__metrics{grid-template-columns:repeat(2,1fr)}.analytics-reports__insights{grid-template-columns:1fr 1fr;grid-template-rows:none}.history-replay__right-column{grid-template-columns:1fr}.history-replay__map-card img{height:auto}.history-replay__player{grid-template-columns:1fr}.alerts-notifications__detail,.alerts-notifications__routing{min-height:150px}.monitor-notice{margin-bottom:14px}}
@media(max-width:560px){.monitor-segmented,.monitor-tab-list{gap:6px;overflow-x:auto;padding-bottom:3px}.monitor-segmented button,.monitor-tab-list button{min-width:auto;white-space:nowrap}.analytics-reports__tools,.alerts-notifications__tools,.history-replay__tools{align-items:flex-start;gap:10px;flex-direction:column}.analytics-reports__metrics{grid-template-columns:1fr 1fr}.voice-scripts__selects{grid-template-columns:1fr}.voice-scripts__editor-actions,.alerts-notifications__detail>div:last-child{flex-wrap:wrap}.voice-scripts__variables{flex-wrap:wrap}.voice-scripts__variables button{flex:0 0 calc(50% - 3px)}.analytics-reports__insights{grid-template-columns:1fr}.history-replay__sessions,.history-replay__map-card{min-height:auto}.history-replay__transport{justify-content:flex-start}.history-replay__player-actions{justify-content:flex-start}}
`;
injectStyles('mediassist-style-pages-Admin-MonitoringScreens-jsx', inlineStyles);

import { useEffect, useMemo, useState } from 'react';
import ReportChart from './ReportChart.jsx';
import dotBlue from '../../assets/images/figma-history-dot-6.svg';
import dotGreen from '../../assets/images/figma-history-dot-2.svg';
import dotViolet from '../../assets/images/figma-history-dot-4.svg';
import dotAmber from '../../assets/images/figma-history-dot-10.svg';
import missionIconActive from '../../assets/images/figma-history-dot-8.svg';
import missionIconIdle from '../../assets/images/figma-history-dot-12.svg';
import { alertsApi } from '../../features/alerts/alertsApi.js';
import { monitoringApi } from '../../features/monitoring/monitoringApi.js';
import { reportsApi } from '../../features/reports/reportsApi.js';
import { operationsApi } from '../../features/operations/operationsApi.js';
import { voiceApi } from '../../features/voice/voiceApi.js';

const scriptCategories = ['Navigation', 'Delivery', 'Escort', 'Emergency', 'General', 'Error'];
const deliveryScripts = [
  'Arrival at Pickup',
  'Pickup Prompt',
  'Auth Request',
  'Pickup Success',
  'Delivery Arrival',
  'Recipient Verify',
  'Open Compartment',
  'Delivery Success',
  'Delivery Failure',
];

function titleCase(value) {
  return String(value ?? '').toLowerCase().replace(/(^|_)([a-z])/g, (_, separator, character) => `${separator ? ' ' : ''}${character.toUpperCase()}`);
}

function alertLocation(alert) {
  const data = alert.dataJson ?? {};
  return data.location ?? data.locationName ?? data.zoneName ?? (alert.zoneId ? `Zone ${String(alert.zoneId).slice(0, 8)}` : 'Not specified');
}

function formatAlertTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function toAlertRow(alert) {
  const severity = titleCase(alert.severity || 'INFO');
  const status = titleCase(alert.status || 'OPEN');
  const source = titleCase(alert.notificationType || 'SYSTEM');
  return {
    id: alert.alertId,
    time: formatAlertTime(alert.createdAt),
    severity,
    title: alert.message || `${source} alert`,
    location: alertLocation(alert),
    source,
    status,
    detail: alert.message || `${source} alert`,
    note: `${alertLocation(alert)} · ${alert.requireAck ? 'Acknowledgement required' : 'No acknowledgement required'}`,
    raw: alert,
  };
}

function reportRange(period) {
  const to = new Date();
  const from = new Date(to);
  if (period === 'Today') from.setHours(0, 0, 0, 0);
  else if (period === '30 Days') from.setDate(from.getDate() - 30);
  else if (period === 'Custom') from.setDate(from.getDate() - 14);
  else from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    interval: period === 'Today' ? 'HOUR' : 'DAY',
  };
}

function number(value, fallback = '—') {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('vi-VN') : fallback;
}

function percent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
}

function duration(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const seconds = Math.round(Number(value));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function durationBetween(start, end) {
  if (!start || !end) return '—';
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return duration(seconds);
}

function jobStatusLabel(status) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'COMPLETED') return 'Complete';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Interrupted';
  return titleCase(normalized || 'Unknown');
}

function historyStatusClass(status) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'COMPLETED') return 'complete';
  if (normalized === 'FAILED') return 'failed';
  return 'interrupted';
}

function relativeTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function Notice({ children }) {
  return children ? <p className="monitor-notice" role="status">{vi(children)}</p> : null;
}

export function VoiceScripts() {
  const [category, setCategory] = useState('Delivery');
  const [selectedScript, setSelectedScript] = useState('Delivery Arrival');
  const [message, setMessage] = useState('“Tôi đã đến {room} với {item}\nđược giao từ {location}.\nVui lòng xác nhận người nhận.”');
  const [volume, setVolume] = useState(80);
  const [notice, setNotice] = useState('');
  const [scripts, setScripts] = useState(deliveryScripts);
  const [interactions, setInteractions] = useState([]);
  const [voiceMeta, setVoiceMeta] = useState({ totalElements: 0 });
  const [voiceError, setVoiceError] = useState('');

  useEffect(() => {
    let active = true;
    voiceApi.listInteractions({ page: 0, size: 4 }).then((page) => {
      if (!active) return;
      setInteractions(page.content ?? []);
      setVoiceMeta(page);
      setVoiceError('');
    }).catch((requestError) => {
      if (active) setVoiceError(requestError.message || 'Voice history is unavailable.');
    });
    return () => { active = false; };
  }, []);

  const createScript = () => {
    const newScript = `New delivery script ${scripts.length + 1}`;
    setScripts((items) => [...items, newScript]);
    setSelectedScript(newScript);
    setNotice('A new delivery script is ready to edit.');
  };

  return <section className="monitor-screen voice-scripts" aria-label={vi("Voice and scripts workspace")}>
    <div className="voice-scripts__layout">
      <aside className="monitor-panel voice-scripts__library">
        <div className="monitor-panel__head monitor-panel__head--split">
          <span>{vi("Script library")}</span>
          <button className="monitor-icon-action" onClick={createScript} type="button" aria-label={vi("Create script")}>{vi("+")}</button>
        </div>
        <div className="voice-scripts__categories" aria-label={vi("Script categories")}>
          {vi(scriptCategories.map((item) => <button className={category === item ? 'is-selected' : ''} key={item} onClick={() => { setCategory(item); setNotice(''); }}>{vi(item)}</button>))}
        </div>
        <h3>{vi("Delivery scripts")}</h3>
        <div className="voice-scripts__script-list">
          {vi(scripts.map((item) => <button className={selectedScript === item ? 'is-active' : ''} onClick={() => { setSelectedScript(item); setNotice(''); }} key={item}>{vi(item)}</button>))}
        </div>
      </aside>

      <article className="monitor-panel voice-scripts__editor">
        <div className="monitor-panel__head">{vi("Script editor")}</div>
        <h2>{vi(selectedScript)}</h2>
        <div className="voice-scripts__selects">
          <label>{vi("Language")}<select defaultValue="Vietnamese"><option value={"Vietnamese"}>{vi("Vietnamese")}</option><option value={"English"}>{vi("English")}</option></select></label>
          <label>{vi("Voice")}<select defaultValue="Female 1"><option value={"Female 1"}>{vi("Female 1")}</option><option value={"Female 2"}>{vi("Female 2")}</option><option value={"Male 1"}>{vi("Male 1")}</option></select></label>
        </div>
        <label className="voice-scripts__message">{vi("Message")}<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <span className="voice-scripts__field-label">{vi("Variables")}</span>
        <div className="voice-scripts__variables">
          {vi(['{room}', '{item}', '{location}', '{patient_name}', '{staff_name}'].map((token) => <button key={token} type="button" onClick={() => setMessage((value) => `${value}${value.endsWith(' ') ? '' : ' '}${token}`)}>{vi(token)}</button>))}
        </div>
        <section className="voice-scripts__voice-settings" aria-label={vi("Voice settings")}>
          <h3>{vi("Voice settings")}</h3>
          <label>{vi("Volume ")}<b>{vi(volume)}{vi("%")}</b><input aria-label={vi("Volume ")} type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          <label>{vi("Speed ")}<select defaultValue="Normal"><option value={"Slow"}>{vi("Slow")}</option><option value={"Normal"}>{vi("Normal")}</option><option value={"Fast"}>{vi("Fast")}</option></select></label>
        </section>
        <div className="voice-scripts__editor-actions">
          <button className="secondary" type="button" onClick={() => setNotice(`Previewing “${selectedScript}” on your browser.`)}>{vi("Preview Voice")}</button>
          <button type="button" onClick={() => setNotice('Script saved successfully.')}>{vi("Save Script")}</button>
          <button className="secondary" type="button" onClick={() => setNotice('A duplicate script was created.')}>{vi("Duplicate")}</button>
          <button className="danger" type="button" onClick={() => setNotice('Delete is available after confirming with an administrator.')}>{vi("Delete")}</button>
        </div>
        <Notice>{vi(notice)}</Notice>
      </article>

      <aside className="monitor-panel voice-scripts__usage">
        <div className="monitor-panel__head">{vi("Robot voice history")}</div>
        <span className="monitor-kicker">{vi("Recorded interactions")}</span>
        <h2>{vi(voiceMeta.totalElements ? `${number(voiceMeta.totalElements)} interactions` : 'No interactions yet')}</h2>
        <div className="voice-scripts__templates">
          {vi(interactions.map((item) => <article key={item.voiceInteractionId}><b>{vi(item.detectedIntent ? titleCase(item.detectedIntent) : 'Voice interaction')}</b><span>{vi(titleCase(item.status))}{vi(" · ")}{vi(relativeTime(item.startedAt))}</span></article>))}
          {vi(!voiceError && interactions.length === 0 && <article><b>{vi("No recorded interaction")}</b><span>{vi("The backend has not received voice activity yet.")}</span></article>)}
        </div>
        <span className="monitor-kicker">{vi("Editor scope")}</span>
        <p className="voice-scripts__fallback">{vi("The backend currently exposes voice history only. Script editing remains local until a script-management API is available.")}</p>
        <button className="secondary voice-scripts__robot-test" type="button" onClick={() => setNotice('Test request sent to MAR-01.')}>{vi("Test on Robot")}</button>
        <small>{vi(voiceError || 'History loaded from /api/v1/voice/interactions')}</small>
        <small>{vi("Preview target: MAR-01")}</small>
      </aside>
    </div>
  </section>;
}

export function AnalyticsReports() {
  const [period, setPeriod] = useState('7 Days');
  const [notice, setNotice] = useState('');
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [loadingReport, setLoadingReport] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    setLoadingReport(true);
    try {
      const result = await reportsApi.getAnalytics(reportRange(period));
      setReport(result);
      setReportError('');
    } catch (requestError) {
      setReportError(requestError.message || 'Analytics report is unavailable.');
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => { loadReport(); }, [period]);

  const exportJobs = async () => {
    setExporting(true);
    setNotice('');
    try {
      const csv = await reportsApi.exportJobsCsv(reportRange(period));
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mediassist-jobs-report.csv';
      link.click();
      URL.revokeObjectURL(url);
      setNotice('Job report downloaded.');
    } catch (requestError) {
      setNotice(requestError.message || 'Unable to export the job report.');
    } finally {
      setExporting(false);
    }
  };

  const metrics = report
    ? [
      ['Job Success', percent(report.jobs?.successRatePercent), 'green'],
      ['Total Jobs', number(report.jobs?.total)],
      ['Average Job', duration(report.jobs?.averageDurationSeconds)],
      ['Fleet Utilization', percent(report.robots?.utilizationPercent), 'teal'],
      ['Open Alerts', number(report.incidents?.alerts), 'amber'],
      ['Crowd Records', number(report.monitoring?.crowdDensityRecords)],
    ]
    : [['Job Success', '—', 'green'], ['Total Jobs', '—'], ['Average Job', '—'], ['Fleet Utilization', '—', 'teal'], ['Open Alerts', '—', 'amber'], ['Crowd Records', '—']];

  return <section className="monitor-screen analytics-reports" aria-label={vi("Analytics and reports")}>
    <div className="analytics-reports__tools">
      <div className="monitor-segmented" aria-label={vi("Reporting period")}>
        {vi(['Today', '7 Days', '30 Days', 'Custom'].map((item) => <button className={period === item ? 'is-selected' : ''} type="button" key={item} onClick={() => { setPeriod(item); setNotice(''); }}>{vi(item)}</button>))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}><button className="secondary" type="button" onClick={exportJobs} disabled={exporting}>{vi(exporting ? 'Exporting…' : 'Export CSV')}</button><button className="secondary" type="button" onClick={loadReport} disabled={loadingReport}>{vi(loadingReport ? 'Loading…' : 'Refresh Report')}</button></div>
    </div>
    <div className="analytics-reports__metrics">
      {vi(metrics.map(([label, value, tone]) => <article className="monitor-panel" key={label}><span>{vi(label)}</span><strong className={tone ? `is-${tone}` : ''}>{vi(value)}</strong></article>))}
    </div>
    <div className="analytics-reports__grid">
      <div className="analytics-reports__charts">
        <ReportChart title="Tổng quan công việc" items={[{label:'Tổng công việc',value:report?.jobs?.total},{label:'Thất bại',value:report?.jobs?.failed,color:'#f87171'},{label:'Cần khôi phục',value:report?.jobs?.recoveryRequired,color:'#fbbf24'}]}/>
        <ReportChart title="Hiệu suất vận hành" unit="%" items={[{label:'Thành công',value:report?.jobs?.successRatePercent,color:'#34d399'},{label:'Sử dụng robot',value:report?.robots?.utilizationPercent}]}/>
      </div>
      <div className="analytics-reports__insights">
        <article className="monitor-panel analytics-reports__utilization">
          <div className="monitor-panel__head">{vi("Live report summary")}</div>
          <UtilizationRow label="Fleet utilization" value={percent(report?.robots?.utilizationPercent)} amount={Number(report?.robots?.utilizationPercent) || 0} tone="blue" />
          <UtilizationRow label="Job success" value={percent(report?.jobs?.successRatePercent)} amount={Number(report?.jobs?.successRatePercent) || 0} tone="green" />
          <UtilizationRow label="Delivered" value={number(report?.deliveries?.delivered)} amount={report?.deliveries?.total ? Math.round((report.deliveries.delivered / report.deliveries.total) * 100) : 0} tone="amber" />
          <UtilizationRow label="Emergency ack" value={duration(report?.emergencies?.averageAcknowledgementSeconds)} amount={report?.emergencies?.total ? Math.round((report.emergencies.acknowledged / report.emergencies.total) * 100) : 0} tone="slate" />
          <UtilizationRow label="Suspected falls" value={number(report?.monitoring?.suspectedFalls)} amount={Math.min(100, Number(report?.monitoring?.suspectedFalls) || 0)} tone="red" />
        </article>
        <article className="monitor-panel analytics-reports__quality">
          <div className="monitor-panel__head">{vi("Operation quality")}</div>
          {vi([
            ['Failed jobs', number(report?.jobs?.failed), 'Jobs'],
            ['Recovery required', number(report?.jobs?.recoveryRequired), 'Jobs'],
            ['Detection events', number(report?.monitoring?.detectionEvents), 'Monitoring'],
            ['Average persons', number(report?.monitoring?.averagePersonCount), 'Crowd'],
            ['Max persons', number(report?.monitoring?.maximumPersonCount), 'Crowd'],
          ].map(([label, value, change]) => <div className="analytics-reports__quality-row" key={label}><span>{vi(label)}</span><b>{vi(value)}</b><em>{vi(change)}</em></div>))}
          <button className="secondary" type="button" onClick={() => setNotice(reportError || (report ? `Generated ${relativeTime(report.generatedAt)}.` : 'Analytics data is loading.'))}>{vi("Report status")}</button>
        </article>
      </div>
    </div>
    <Notice>{vi(notice || reportError)}</Notice>
  </section>;
}

function UtilizationRow({ label, value, amount, tone }) {
  return <div className="analytics-reports__util-row"><span>{vi(label)}</span><div><i className={`is-${tone}`} style={{ width: `${amount}%` }} /></div><b>{vi(value)}</b></div>;
}

export function HistoryReplay() {
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState({ page: 0, totalPages: 0, totalElements: 0, first: true, last: true });
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [isPlaying, setPlaying] = useState(false);
  const [progress, setProgress] = useState(64);
  const [notice, setNotice] = useState('');
  const eventDots = [dotGreen, dotBlue, dotAmber, dotViolet, dotBlue, dotBlue, dotGreen];

  const loadJobs = async (nextPage = 0) => {
    setLoadingJobs(true);
    setRequestError('');
    try {
      const result = await operationsApi.listJobs({ page: nextPage, size: 10 });
      const records = result?.content ?? [];
      setJobs(records);
      setPage({
        page: result?.page ?? nextPage,
        totalPages: result?.totalPages ?? 0,
        totalElements: result?.totalElements ?? records.length,
        first: result?.first ?? nextPage === 0,
        last: result?.last ?? true,
      });
      setSelectedJobId((current) => records.some((job) => job.jobId === current) ? current : records[0]?.jobId ?? null);
    } catch (error) {
      setJobs([]);
      setSelectedJobId(null);
      setRequestError(error.message || 'Unable to load job history.');
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setEvents([]);
      return undefined;
    }
    let active = true;
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const result = await operationsApi.listJobEvents(selectedJobId, { page: 0, size: 100 });
        if (active) setEvents(result?.content ?? []);
      } catch (error) {
        if (active) {
          setEvents([]);
          setRequestError(error.message || 'Unable to load this job event log.');
        }
      } finally {
        if (active) setLoadingEvents(false);
      }
    };
    loadEvents();
    return () => { active = false; };
  }, [selectedJobId]);

  const selected = jobs.find((job) => job.jobId === selectedJobId) ?? null;
  const selectedStatus = jobStatusLabel(selected?.status);
  const selectedStart = selected?.startedAt ?? selected?.acceptedAt ?? selected?.queuedAt;
  const selectedEnd = selected?.endedAt;
  const selectedDuration = durationBetween(selectedStart, selectedEnd);
  const detailRows = selected ? [
    ['Job code', selected.jobCode || String(selected.jobId).slice(0, 8)],
    ['Status', selectedStatus],
    ['Priority', String(selected.priority ?? '—')],
    ['Queued', relativeTime(selected.queuedAt)],
    ['Started', relativeTime(selectedStart)],
    ['Finished', relativeTime(selectedEnd)],
    ['Duration', selectedDuration],
    ['Robot', selected.robotId ? String(selected.robotId).slice(0, 8) : 'Not assigned'],
    ['Workflow', selected.workflowId ? String(selected.workflowId).slice(0, 8) : 'Not specified'],
    ['Failure reason', selected.failureReason || '—'],
  ] : [];

  return <section className="monitor-screen history-replay" aria-label={vi("History and replay")}>
    <div className="history-replay__tools">
      <span>{vi("Mission playback &amp; event review")}</span>
      <div><button className="secondary" type="button" onClick={() => loadJobs(page.page)} disabled={loadingJobs}>{vi(loadingJobs ? 'Loading…' : 'Refresh')}</button></div>
    </div>
    <div className="history-replay__layout">
      <aside className="monitor-panel history-replay__sessions">
        <div className="monitor-panel__head monitor-panel__head--split"><span>{vi("Mission / session list")}</span><small>{vi(`${number(page.totalElements, '0')} records`)}</small></div>
        {vi(jobs.map((job) => <button className={selectedJobId === job.jobId ? 'is-selected' : ''} type="button" key={job.jobId} onClick={() => { setSelectedJobId(job.jobId); setProgress(64); setNotice(''); }}>
          <img src={selectedJobId === job.jobId ? missionIconActive : missionIconIdle} alt={vi("")} />
          <span><b>{vi(job.jobCode || String(job.jobId).slice(0, 8))}</b><small>{vi(job.robotId ? `Robot ${String(job.robotId).slice(0, 8)}` : 'No robot assigned')}</small><em className={`is-${historyStatusClass(job.status)}`}>{vi(jobStatusLabel(job.status))}</em><small>{vi(relativeTime(job.queuedAt))}</small></span><i>{vi("›")}</i><time>{vi(durationBetween(job.startedAt ?? job.acceptedAt ?? job.queuedAt, job.endedAt))}</time>
        </button>))}
        {vi(!loadingJobs && !requestError && jobs.length === 0 && <p className="history-replay__empty">{vi("No jobs are recorded yet.")}</p>)}
        <footer>{vi(`${page.totalElements === 0 ? 0 : page.page * 10 + 1}–${Math.min((page.page + 1) * 10, page.totalElements)} of ${number(page.totalElements, '0')} `)}<span><button type="button" aria-label={vi("Previous page")} disabled={page.first || loadingJobs} onClick={() => loadJobs(Math.max(0, page.page - 1))}>{vi("‹")}</button><button type="button" aria-label={vi("Next page")} disabled={page.last || loadingJobs} onClick={() => loadJobs(page.page + 1)}>{vi("›")}</button></span></footer>
      </aside>
      <article className="monitor-panel history-replay__map-card">
        <div className="monitor-panel__head"><span>{vi("Mission route")}</span></div>
        <div className="history-replay__route-unavailable" style={{ alignItems: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 5, color: '#64748b', display: 'flex', flexDirection: 'column', height: 405, justifyContent: 'center', marginTop: 12, padding: 26, textAlign: 'center' }}><strong style={{ color: '#334155', fontSize: 12 }}>{vi("Route preview is not available")}</strong><span style={{ fontSize: 10, lineHeight: 1.5, marginTop: 8, maxWidth: 255 }}>{vi("The current API provides job records and events, but not a recorded route polyline. No sample route is shown as live data.")}</span></div>
      </article>
      <aside className="history-replay__right-column">
        <article className="monitor-panel history-replay__details">
          <div className="monitor-panel__head monitor-panel__head--split"><span>{vi("Mission details")}</span>{vi(selected && <em>{vi(selectedStatus)}</em>)}</div>
          {vi(detailRows.map(([label, value]) => <p key={label}><span>{vi(label)}</span><b>{vi(value)}</b></p>))}
          {vi(!selected && <p className="history-replay__empty">{vi("Select a job to view its backend details.")}</p>)}
        </article>
        <article className="monitor-panel history-replay__events">
          <div className="monitor-panel__head monitor-panel__head--split"><span>{vi("Event log")}</span><button className="secondary" type="button" onClick={() => selectedJobId && operationsApi.listJobEvents(selectedJobId, { page: 0, size: 100 }).then((result) => { setEvents(result?.content ?? []); setNotice('Event log refreshed.'); }).catch((error) => setNotice(error.message || 'Unable to refresh events.'))} disabled={!selectedJobId || loadingEvents}>{vi(loadingEvents ? 'Loading…' : 'Refresh')}</button></div>
          {vi(events.map((event, index) => <p key={event.jobEventId}><time>{vi(formatAlertTime(event.occurredAt))}</time><img src={eventDots[index % eventDots.length]} alt={vi("")} /><span>{vi(titleCase(event.eventType || 'Job event'))}</span></p>))}
          {vi(!loadingEvents && selected && events.length === 0 && <p className="history-replay__empty">{vi("No recorded events for this job.")}</p>)}
        </article>
      </aside>
    </div>
    <footer className="monitor-panel history-replay__player">
      <div className="history-replay__transport"><button type="button" className="secondary" aria-label={vi("Back ten seconds")} onClick={() => setProgress((value) => Math.max(0, value - 10))} disabled={!selected}>{vi("◀ 10")}</button><button className="history-replay__play" type="button" onClick={() => setPlaying((value) => !value)} disabled={!selected}>{vi(isPlaying ? 'Ⅱ' : '▶')}</button><button type="button" className="secondary" aria-label={vi("Forward ten seconds")} onClick={() => setProgress((value) => Math.min(100, value + 10))} disabled={!selected}>{vi("10 ▶")}</button></div>
      <div className="history-replay__timeline"><span>{vi(selectedDuration)}</span><input aria-label={vi("Replay progress")} type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} disabled={!selected} /><div aria-hidden="true">{vi(events.slice(0, 5).map((_, index) => <img src={eventDots[index % eventDots.length]} alt={vi("")} key={index} />))}</div><small>{vi("Controls are a local event-review aid. Route playback requires a recorded route API.")}</small></div>
      <div className="history-replay__player-actions"><button className="secondary" type="button" onClick={() => setNotice('Snapshot is not available because the backend has no route playback API.')} disabled={!selected}>{vi("Snapshot")}</button><button type="button" onClick={() => setNotice('Job events are displayed from the backend. CSV export is available from the analytics report.')} disabled={!selected}>{vi("Event data")}</button></div>
    </footer>
    <Notice>{vi(notice || requestError)}</Notice>
  </section>;
}

export function AlertsNotifications() {
  const [filter, setFilter] = useState('All');
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const page = await alertsApi.list({ page: 0, size: 100 });
      const items = (page.content ?? []).map(toAlertRow);
      setAlerts(items);
      setSelectedId((currentId) => items.some((item) => item.id === currentId) ? currentId : items[0]?.id ?? null);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlerts(); }, []);

  const visibleRows = useMemo(() => filter === 'All' ? alerts : alerts.filter((row) => row.severity === filter), [alerts, filter]);
  const current = alerts.find((row) => row.id === selectedId) ?? visibleRows[0] ?? null;
  const totals = useMemo(() => ({
    All: alerts.length,
    Critical: alerts.filter((row) => row.severity === 'Critical').length,
    Warning: alerts.filter((row) => row.severity === 'Warning').length,
    Info: alerts.filter((row) => row.severity === 'Info').length,
  }), [alerts]);

  const updateAlert = (updated) => {
    const next = toAlertRow(updated);
    setAlerts((items) => items.map((item) => item.id === next.id ? next : item));
    setSelectedId(next.id);
    return next;
  };

  const progressAlert = async (action) => {
    if (!current) return;
    setSubmitting(true);
    setNotice('');
    try {
      const updated = await alertsApi[action](current.id);
      const next = updateAlert(updated);
      setNotice(`${next.title} is now ${next.status.toLowerCase()}.`);
    } catch (requestError) {
      setNotice(requestError.message || `Unable to ${action} this alert.`);
    } finally {
      setSubmitting(false);
    }
  };

  const actionFor = (row) => {
    if (!row) return null;
    if (row.raw.status === 'OPEN') return ['acknowledge', 'Acknowledge'];
    if (row.raw.status === 'ACKNOWLEDGED') return ['resolve', 'Resolve'];
    if (row.raw.status === 'RESOLVED') return ['close', 'Close'];
    return null;
  };
  const currentAction = actionFor(current);

  return <section className="monitor-screen alerts-notifications" aria-label={vi("Alerts and notifications")}>
    <div className="alerts-notifications__tools">
      <div className="monitor-tab-list" role="tablist" aria-label={vi("Alert filters")}>
        {vi(['All', 'Critical', 'Warning', 'Info'].map((label) => <button className={filter === label ? 'is-selected' : ''} type="button" role="tab" aria-selected={filter === label} key={label} onClick={() => { setFilter(label); setNotice(''); }}>{vi(label)}{vi(" (")}{vi(totals[label])}{vi(")")}</button>))}
      </div>
      <button className="secondary" type="button" onClick={loadAlerts} disabled={loading}>{vi(loading ? 'Loading…' : 'Refresh')}</button>
    </div>
    <article className="monitor-panel alerts-notifications__table-card">
      <div className="monitor-panel__head">{vi("Active alerts")}</div>
      <div className="alerts-notifications__table-scroll"><table><thead><tr>{vi(['Time', 'Severity', 'Alert', 'Location', 'Source', 'Status', 'Action'].map((label) => <th key={label}>{vi(label)}</th>))}</tr></thead><tbody>{vi(visibleRows.map((row) => <tr className={current?.id === row.id ? 'is-selected' : ''} key={row.id} onClick={() => { setSelectedId(row.id); setNotice(''); }}><td>{vi(row.time)}</td><td><em className={`is-${row.severity.toLowerCase()}`}>{vi(row.severity)}</em></td><td>{vi(row.title)}</td><td>{vi(row.location)}</td><td>{vi(row.source)}</td><td>{vi(row.status)}</td><td><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id); setNotice(`Viewing ${row.title}.`); }}>{vi("View")}</button></td></tr>))}</tbody></table>{vi(loading && <p className="alerts-notifications__empty">{vi("Loading alerts…")}</p>)}{vi(!loading && error && <p className="alerts-notifications__empty alerts-notifications__error">{vi(error)}</p>)}{vi(!loading && !error && visibleRows.length === 0 && <p className="alerts-notifications__empty">{vi("No alerts match this filter.")}</p>)}</div>
    </article>
    <div className="alerts-notifications__bottom">
      <article className="monitor-panel alerts-notifications__detail">
        <div className="monitor-panel__head">{vi("Alert detail preview")}</div>
        <h2>{vi(current?.detail ?? 'Select an alert')}</h2>
        <p>{vi(current?.note ?? 'Choose an alert above to inspect its details and response status.')}</p>
        {vi(current && <p className="alert-status">{vi("Status: ")}<b>{vi(current.status)}</b></p>)}
        <div><button className="secondary" type="button" disabled={!current} onClick={() => setNotice('Map view is ready for this alert.')}>{vi("View on Map")}</button><button className="secondary" type="button" disabled={!current} onClick={loadAlerts}>{vi("Refresh")}</button>{vi(currentAction && <button className="api-action" type="button" disabled={submitting} onClick={() => progressAlert(currentAction[0])}>{vi(submitting ? 'Saving…' : currentAction[1])}</button>)}</div>
      </article>
      <article className="monitor-panel alerts-notifications__routing">
        <div className="monitor-panel__head">{vi("Notification routing")}</div>
        <p><b>{vi("Critical")}</b>{vi(" → Admin + Nurse Station")}</p><p><b>{vi("Warnings")}</b>{vi(" → Admin dashboard")}</p><p><b>{vi("Info")}</b>{vi(" → Activity feed only")}</p>
        <button className="secondary" type="button" onClick={() => setNotice('Notification routing editor opened.')}>{vi("Edit Routing")}</button>
      </article>
    </div>
    <Notice>{vi(notice)}</Notice>
  </section>;
}

