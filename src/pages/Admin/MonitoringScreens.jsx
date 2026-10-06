import { injectStyles } from '../../styles/injectStyles.js';
const inlineStyles = String.raw`.monitor-screen{color:#0f172a;font-family:Inter,Arial,sans-serif;min-width:0;padding-top:8px}.monitor-screen *{box-sizing:border-box}.monitor-panel{background:#fff;border:1px solid #cbd5e1;border-radius:10px;min-width:0}.monitor-panel__head{color:#475569;font-size:13px;font-weight:500;letter-spacing:.35px;text-transform:uppercase}.monitor-panel__head--split{align-items:center;display:flex;justify-content:space-between;gap:10px}.monitor-panel__head small{color:#64748b;font-size:9px;font-weight:500;letter-spacing:0;text-transform:none}.monitor-kicker{color:#475569;display:block;font-size:10px;margin-top:20px}.monitor-notice{color:#15803d;font-size:11px;font-weight:600;margin:12px 2px 0}.monitor-screen button{font-family:inherit;font-weight:600}.monitor-screen button.secondary{background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a}.monitor-screen button.danger{background:#f05252}.monitor-screen select,.monitor-screen textarea,.monitor-screen input{font-family:inherit}.monitor-icon-action{align-items:center;background:#2f80ff;border-radius:5px;color:#fff;display:inline-flex;font-size:18px;height:24px;justify-content:center;line-height:1;padding:0;width:24px}

/* Voice & Scripts — Figma node 7:501 */
.voice-scripts__layout{display:grid;gap:18px;grid-template-columns:300px minmax(0,550px) minmax(230px,1fr)}.voice-scripts__library,.voice-scripts__editor,.voice-scripts__usage{min-height:778px;padding:14px 16px}.voice-scripts__categories{display:grid;gap:10px;margin-top:12px}.voice-scripts__categories button{background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;font-size:11px;height:42px;padding:0 13px;text-align:left}.voice-scripts__categories button.is-selected{background:#dbeafe;color:#0f172a}.voice-scripts__library h3,.voice-scripts__voice-settings h3{font-size:11px;margin:28px 0 16px}.voice-scripts__script-list{display:grid;gap:13px}.voice-scripts__script-list button{background:transparent;color:#475569;font-size:10px;font-weight:400;padding:0 14px;text-align:left}.voice-scripts__script-list button:hover,.voice-scripts__script-list button.is-active{color:#1d4ed8;font-weight:600}.voice-scripts__editor h2,.voice-scripts__usage h2{font-size:18px;margin:15px 4px 24px}.voice-scripts__selects{display:grid;gap:16px;grid-template-columns:1fr 1fr}.voice-scripts__selects label,.voice-scripts__message{color:#475569;display:flex;flex-direction:column;font-size:10px;gap:8px}.voice-scripts__selects select,.voice-scripts__voice-settings select{appearance:auto;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;font-size:11px;height:36px;padding:0 12px}.voice-scripts__message{margin-top:20px}.voice-scripts__message textarea{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;font-size:12px;height:180px;line-height:1.45;padding:14px;resize:vertical}.voice-scripts__field-label{color:#475569;display:block;font-size:10px;margin-top:25px}.voice-scripts__variables{display:flex;gap:6px;margin-top:12px}.voice-scripts__variables button{background:#f1f5f9;border:1px solid #cbd5e1;color:#0e7490;flex:1;font-size:9px;height:28px;min-width:0;padding:0 6px}.voice-scripts__voice-settings h3{margin:28px 0 18px}.voice-scripts__voice-settings>label{align-items:center;color:#475569;display:grid;font-size:10px;gap:12px;grid-template-columns:78px auto 1fr;margin:18px 0}.voice-scripts__voice-settings>label b{font-size:10px;font-weight:400}.voice-scripts__voice-settings input[type=range]{accent-color:#2f80ff;height:8px;margin:0;width:100%}.voice-scripts__voice-settings select{grid-column:2 / span 2;width:120px}.voice-scripts__editor-actions{display:flex;gap:10px;margin-top:32px}.voice-scripts__editor-actions button{font-size:13px;height:34px;padding:0 14px;white-space:nowrap}.voice-scripts__usage .monitor-kicker:first-of-type{margin-top:17px}.voice-scripts__usage h2{font-size:14px;margin:11px 2px 20px}.voice-scripts__templates{display:grid;gap:12px}.voice-scripts__templates article{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;min-height:52px;padding:10px 12px}.voice-scripts__templates b{display:block;font-size:10px}.voice-scripts__templates span{color:#15803d;display:block;font-size:9px;margin-top:7px;text-align:right}.voice-scripts__fallback{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;font-size:10px;line-height:1.45;margin:12px 0 22px;padding:13px 12px}.voice-scripts__robot-test{font-size:13px;height:34px;margin-bottom:17px;width:100%}.voice-scripts__usage>small{color:#475569;display:block;font-size:10px;margin:12px 0}

/* Analytics & Reports — Figma node 7:362 */
.analytics-reports__tools{align-items:center;display:flex;justify-content:space-between;margin-bottom:15px}.monitor-segmented{display:flex;gap:9px}.monitor-segmented button{background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;font-size:11px;height:36px;min-width:92px;padding:0 17px}.monitor-segmented button.is-selected{background:#dbeafe;color:#0f172a}.analytics-reports__tools>button{font-size:11px;height:36px;padding:0 17px}.analytics-reports__metrics{display:grid;gap:12px;grid-template-columns:repeat(6,minmax(0,1fr));margin-bottom:14px}.analytics-reports__metrics article{height:78px;padding:12px}.analytics-reports__metrics span{color:#475569;display:block;font-size:10px}.analytics-reports__metrics strong{display:block;font-size:18px;margin-top:10px}.analytics-reports__metrics .is-green{color:#15803d}.analytics-reports__metrics .is-teal{color:#0e7490}.analytics-reports__metrics .is-amber{color:#a16207}.analytics-reports__grid{display:grid;gap:14px;grid-template-columns:minmax(330px,1fr) minmax(350px,1.04fr)}.analytics-reports__charts{display:grid;gap:12px}.analytics-reports__chart{background:#031b34;border:1px solid #cbd5e1;border-radius:8px;margin:0;min-height:0;overflow:hidden}.analytics-reports__chart img{display:block;height:auto;width:100%}.analytics-reports__insights{display:grid;gap:12px;grid-template-rows:1fr 1fr}.analytics-reports__utilization,.analytics-reports__quality{padding:12px}.analytics-reports__utilization .monitor-panel__head,.analytics-reports__quality .monitor-panel__head{margin-bottom:17px}.analytics-reports__util-row{align-items:center;display:grid;gap:10px;grid-template-columns:62px minmax(80px,1fr) 32px;margin:13px 0}.analytics-reports__util-row span,.analytics-reports__util-row b{color:#475569;font-size:9px;font-weight:500}.analytics-reports__util-row b{text-align:right}.analytics-reports__util-row>div{background:#e2e8f0;border-radius:8px;height:9px;overflow:hidden}.analytics-reports__util-row i{background:#2f80ff;border-radius:8px;display:block;height:100%}.analytics-reports__util-row .is-amber{background:#f5b82e}.analytics-reports__util-row .is-green{background:#28d17c}.analytics-reports__util-row .is-slate{background:#8ea4c0}.analytics-reports__util-row .is-red{background:#f05252}.analytics-reports__quality{position:relative}.analytics-reports__quality-row{align-items:center;display:grid;grid-template-columns:1fr 54px 38px;margin:13px 0}.analytics-reports__quality-row span,.analytics-reports__quality-row b,.analytics-reports__quality-row em{font-size:9px;font-style:normal}.analytics-reports__quality-row span{color:#475569}.analytics-reports__quality-row em{color:#15803d;text-align:right}.analytics-reports__quality button{bottom:13px;font-size:11px;height:25px;position:absolute;right:13px}

/* History & Replay — Figma node 79:2 */
.history-replay__tools{align-items:center;color:#475569;display:flex;font-size:10px;justify-content:space-between;margin:-2px 0 12px}.history-replay__tools>div{display:flex;gap:8px}.history-replay__tools button{font-size:10px;height:32px;padding:0 12px}.history-replay__layout{display:grid;gap:12px;grid-template-columns:minmax(180px,.8fr) minmax(350px,1.62fr) minmax(210px,.94fr)}.history-replay__sessions,.history-replay__map-card{min-height:512px;padding:12px}.history-replay__sessions>button{align-items:flex-start;background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a;display:grid;gap:8px;grid-template-columns:22px minmax(0,1fr) 8px;margin:8px 0 0;min-height:75px;padding:10px;text-align:left;width:100%}.history-replay__sessions>button.is-selected{background:#fff;border-color:#2f80ff;box-shadow:inset 0 0 0 1px #2f80ff}.history-replay__sessions>button>img{height:22px;width:22px}.history-replay__sessions>button span{min-width:0}.history-replay__sessions>button b,.history-replay__sessions>button small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.history-replay__sessions>button b{font-size:10px}.history-replay__sessions>button small{color:#475569;font-size:8px;font-weight:400;margin-top:4px}.history-replay__sessions>button em{border-radius:4px;color:#fff;display:inline-block;font-size:8px;font-style:normal;margin-top:7px;padding:3px 7px}.history-replay__sessions em.is-complete{background:#28d17c}.history-replay__sessions em.is-failed{background:#f05252}.history-replay__sessions em.is-interrupted{background:#f5b82e}.history-replay__sessions>button>i{font-size:17px;font-style:normal;grid-column:3;grid-row:1}.history-replay__sessions>button time{color:#475569;font-size:8px;grid-column:2 / span 2;text-align:right}.history-replay__sessions footer{align-items:center;color:#64748b;display:flex;font-size:9px;justify-content:space-between;margin-top:11px}.history-replay__sessions footer button{background:#fff;border:1px solid #cbd5e1;color:#475569;font-size:12px;height:20px;margin-left:5px;padding:0;width:20px}.history-replay__map-card img{border:1px solid #cbd5e1;border-radius:5px;display:block;height:405px;margin-top:12px;object-fit:contain;width:100%}.history-replay__map-card .monitor-panel__head button{font-size:9px;height:23px;padding:0 11px}.history-replay__right-column{display:grid;gap:10px;grid-template-rows:1.25fr 1fr}.history-replay__details,.history-replay__events{padding:12px}.history-replay__details .monitor-panel__head em{background:#dcfce7;border-radius:3px;color:#15803d;font-size:8px;font-style:normal;padding:4px 7px}.history-replay__details p{display:grid;gap:5px;grid-template-columns:82px minmax(0,1fr);margin:8px 0}.history-replay__details p span,.history-replay__details p b{font-size:8px}.history-replay__details p span{color:#64748b}.history-replay__details p b{font-weight:500}.history-replay__events .monitor-panel__head button{font-size:8px;height:24px;padding:0 8px}.history-replay__events p{align-items:center;display:grid;gap:7px;grid-template-columns:43px 10px minmax(0,1fr);margin:9px 0}.history-replay__events p time,.history-replay__events p span{font-size:8px}.history-replay__events p time{color:#64748b}.history-replay__events p img{height:10px;width:10px}.history-replay__player{align-items:center;display:grid;gap:16px;grid-template-columns:180px minmax(230px,1fr) 132px;margin-top:12px;min-height:86px;padding:12px}.history-replay__transport{align-items:center;display:flex;justify-content:center;gap:8px}.history-replay__transport button{font-size:9px;height:28px;padding:0 8px}.history-replay__transport .history-replay__play{align-items:center;border-radius:50%;display:inline-flex;font-size:14px;height:30px;justify-content:center;padding:0;width:30px}.history-replay__timeline{display:grid;grid-template-columns:1fr;position:relative}.history-replay__timeline>span{color:#475569;font-size:8px;margin-bottom:2px}.history-replay__timeline input{accent-color:#2f80ff;width:100%}.history-replay__timeline div{display:flex;justify-content:space-around;margin-top:-5px;pointer-events:none}.history-replay__timeline div img{height:10px;width:10px}.history-replay__timeline small{color:#64748b;font-size:7px;margin-top:5px}.history-replay__player-actions{display:flex;gap:8px}.history-replay__player-actions button{font-size:9px;height:28px;padding:0 11px}

/* Crowd Heatmap — Figma node 7:117 */
.crowd-heatmap__tabs{margin-bottom:14px}.crowd-heatmap__layout{display:grid;gap:12px;grid-template-columns:minmax(400px,1fr) minmax(220px,.34fr)}.crowd-heatmap__map-card{padding:12px}.crowd-heatmap__map-card>img{border:1px solid #cbd5e1;border-radius:5px;display:block;height:auto;margin-top:8px;width:100%}.crowd-heatmap__legend{align-items:center;color:#0e7490;display:flex;font-size:8px;gap:0;margin:7px 18px 0}.crowd-heatmap__legend i{height:7px;max-width:120px;flex:1}.crowd-heatmap__legend i:nth-of-type(1){background:#2fc6e5;margin-left:8px}.crowd-heatmap__legend i:nth-of-type(2){background:#f5b82e}.crowd-heatmap__legend i:nth-of-type(3){background:#f05252;margin-right:8px}.crowd-heatmap__side{display:grid;gap:12px;grid-template-rows:.86fr 1fr}.crowd-heatmap__density,.crowd-heatmap__rules{padding:12px}.crowd-heatmap__density p{align-items:center;display:grid;grid-template-columns:1fr 30px 33px;margin:18px 0}.crowd-heatmap__density p span,.crowd-heatmap__density p b,.crowd-heatmap__density p em{font-size:9px}.crowd-heatmap__density p b{text-align:right}.crowd-heatmap__density p em{font-size:8px;font-style:normal;text-align:right;text-transform:uppercase}.crowd-heatmap__density .is-high{color:#b91c1c}.crowd-heatmap__density .is-med{color:#a16207}.crowd-heatmap__density .is-low{color:#15803d}.crowd-heatmap__rules p{align-items:center;display:flex;justify-content:space-between;margin:17px 0}.crowd-heatmap__rules p span,.crowd-heatmap__rules p b{font-size:9px}.crowd-heatmap__rules p b{color:#15803d;font-size:8px;text-transform:uppercase}.crowd-heatmap__rules small{color:#64748b;display:block;font-size:9px;margin-top:32px}.crowd-heatmap__rules strong{color:#a16207;display:block;font-size:9px;font-weight:500;margin-top:8px}.crowd-heatmap__rules button{bottom:12px;font-size:11px;height:26px;position:absolute;right:12px}.crowd-heatmap__rules{position:relative}

/* Alerts & Notifications — Figma node 7:2 */
.alerts-notifications__tools{align-items:center;display:flex;justify-content:space-between;margin-bottom:12px}.alerts-notifications__tools>button{font-size:11px;height:36px;padding:0 16px}.monitor-tab-list{display:flex;gap:12px}.monitor-tab-list button{background:transparent;color:#475569;font-size:10px;height:36px;min-width:82px;padding:0 13px}.monitor-tab-list button.is-selected{background:#dbeafe;color:#0f172a}.alerts-notifications__table-card{min-height:398px;padding:12px}.alerts-notifications__table-scroll{overflow-x:auto}.alerts-notifications__table-card table{border-collapse:separate;border-spacing:0 9px;min-width:800px;width:100%}.alerts-notifications__table-card th{color:#475569;font-size:8px;font-weight:500;padding:0 3px 2px;text-align:left}.alerts-notifications__table-card td{background:#f1f5f9;border-bottom:1px solid #cbd5e1;border-top:1px solid #cbd5e1;font-size:8px;padding:11px 3px}.alerts-notifications__table-card td:first-child{border-left:1px solid #cbd5e1;border-radius:4px 0 0 4px}.alerts-notifications__table-card td:last-child{border-radius:0 4px 4px 0;border-right:1px solid #cbd5e1}.alerts-notifications__table-card tr.is-selected td{background:#fff1f1}.alerts-notifications__table-card td em{font-size:8px;font-style:normal;font-weight:600;text-transform:uppercase}.alerts-notifications__table-card .is-critical{color:#b91c1c}.alerts-notifications__table-card .is-warning{color:#a16207}.alerts-notifications__table-card .is-info{color:#0e7490}.alerts-notifications__table-card td button{background:transparent;color:#2f80ff;font-size:8px;padding:0}.alerts-notifications__bottom{display:grid;gap:12px;grid-template-columns:1fr 1.05fr;margin-top:12px}.alerts-notifications__detail,.alerts-notifications__routing{min-height:105px;padding:12px}.alerts-notifications__detail h2{color:#a16207;font-size:12px;margin:7px 0 4px}.alerts-notifications__detail p{color:#475569;font-size:8px;margin:0}.alerts-notifications__detail>div:last-child{display:flex;gap:8px;margin-top:14px}.alerts-notifications__detail>div:last-child button{font-size:9px;height:25px;padding:0 11px}.alerts-notifications__routing{position:relative}.alerts-notifications__routing p{font-size:8px;margin:12px 0}.alerts-notifications__routing p b{font-weight:600}.alerts-notifications__routing button{bottom:12px;font-size:10px;height:25px;position:absolute;right:12px}

@media(max-width:1150px){.voice-scripts__layout{grid-template-columns:260px minmax(0,1fr)}.voice-scripts__usage{grid-column:span 2;min-height:auto}.analytics-reports__metrics{grid-template-columns:repeat(3,1fr)}.history-replay__layout{grid-template-columns:minmax(190px,.75fr) minmax(340px,1.5fr)}.history-replay__right-column{grid-column:span 2;grid-template-columns:1fr 1fr;grid-template-rows:none}.history-replay__details,.history-replay__events{min-height:260px}.crowd-heatmap__layout{grid-template-columns:minmax(340px,1fr) 245px}}
@media(max-width:820px){.voice-scripts__layout,.analytics-reports__grid,.history-replay__layout,.crowd-heatmap__layout,.alerts-notifications__bottom{grid-template-columns:1fr}.voice-scripts__usage,.history-replay__right-column{grid-column:auto}.voice-scripts__library,.voice-scripts__editor,.voice-scripts__usage{min-height:auto}.analytics-reports__metrics{grid-template-columns:repeat(2,1fr)}.analytics-reports__insights{grid-template-columns:1fr 1fr;grid-template-rows:none}.history-replay__right-column{grid-template-columns:1fr}.history-replay__map-card img{height:auto}.history-replay__player{grid-template-columns:1fr}.crowd-heatmap__side{grid-template-columns:1fr 1fr;grid-template-rows:none}.crowd-heatmap__density,.crowd-heatmap__rules{min-height:260px}.alerts-notifications__detail,.alerts-notifications__routing{min-height:150px}.monitor-notice{margin-bottom:14px}}
@media(max-width:560px){.monitor-segmented,.monitor-tab-list{gap:6px;overflow-x:auto;padding-bottom:3px}.monitor-segmented button,.monitor-tab-list button{min-width:auto;white-space:nowrap}.analytics-reports__tools,.alerts-notifications__tools,.history-replay__tools{align-items:flex-start;gap:10px;flex-direction:column}.analytics-reports__metrics{grid-template-columns:1fr 1fr}.voice-scripts__selects{grid-template-columns:1fr}.voice-scripts__editor-actions,.alerts-notifications__detail>div:last-child{flex-wrap:wrap}.voice-scripts__variables{flex-wrap:wrap}.voice-scripts__variables button{flex:0 0 calc(50% - 3px)}.analytics-reports__insights,.crowd-heatmap__side{grid-template-columns:1fr}.history-replay__sessions,.history-replay__map-card{min-height:auto}.history-replay__transport{justify-content:flex-start}.history-replay__player-actions{justify-content:flex-start}}
`;
injectStyles('mediassist-style-pages-Admin-MonitoringScreens-jsx', inlineStyles);

import { useMemo, useState } from 'react';
import analyticsMissionsChart from '../../assets/images/figma-analytics-raw-1.png';
import analyticsBatteryChart from '../../assets/images/figma-analytics-raw-3.png';
import historyRouteMap from '../../assets/images/figma-history-raw-3.png';
import crowdHeatmapMap from '../../assets/images/figma-heatmap-raw-1.png';
import dotBlue from '../../assets/images/figma-history-dot-6.svg';
import dotGreen from '../../assets/images/figma-history-dot-2.svg';
import dotViolet from '../../assets/images/figma-history-dot-4.svg';
import dotAmber from '../../assets/images/figma-history-dot-10.svg';
import missionIconActive from '../../assets/images/figma-history-dot-8.svg';
import missionIconIdle from '../../assets/images/figma-history-dot-12.svg';

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

const alertRows = [
  { time: '10:24', severity: 'Critical', title: 'SOS: Patient Fall Detected', location: 'Main Corridor', source: 'Vision', status: 'Active', detail: 'Patient fall detected', note: 'Main Corridor · 01:02 elapsed' },
  { time: '10:20', severity: 'Warning', title: 'Obstacle Detected', location: 'Corridor A', source: 'LIDAR', status: 'Active', detail: 'Path blocked', note: 'Main Corridor · 01:02 blocked' },
  { time: '10:18', severity: 'Warning', title: 'Battery Below 80%', location: 'Level 1', source: 'Battery', status: 'Active', detail: 'Battery needs attention', note: 'MAR-01 battery is at 72%' },
  { time: '10:15', severity: 'Warning', title: 'Crowd Density High', location: 'Waiting Hall', source: 'Camera', status: 'Active', detail: 'Crowd density is high', note: 'Waiting Hall · 48 people detected' },
  { time: '10:10', severity: 'Info', title: 'Mission Started M1028', location: 'Pharmacy', source: 'Mission', status: 'Info', detail: 'Mission started', note: 'Medication delivery is now in progress' },
  { time: '09:55', severity: 'Info', title: 'Docking Completed', location: 'Charger-01', source: 'Robot', status: 'Cleared', detail: 'Docking completed', note: 'MAR-01 is ready for its next assignment' },
];

function Notice({ children }) {
  return children ? <p className="monitor-notice" role="status">{children}</p> : null;
}

export function VoiceScripts() {
  const [category, setCategory] = useState('Delivery');
  const [selectedScript, setSelectedScript] = useState('Delivery Arrival');
  const [message, setMessage] = useState('“Tôi đã đến {room} với {item}\nđược giao từ {location}.\nVui lòng xác nhận người nhận.”');
  const [volume, setVolume] = useState(80);
  const [notice, setNotice] = useState('');
  const [scripts, setScripts] = useState(deliveryScripts);

  const createScript = () => {
    const newScript = `New delivery script ${scripts.length + 1}`;
    setScripts((items) => [...items, newScript]);
    setSelectedScript(newScript);
    setNotice('A new delivery script is ready to edit.');
  };

  return <section className="monitor-screen voice-scripts" aria-label="Voice and scripts workspace">
    <div className="voice-scripts__layout">
      <aside className="monitor-panel voice-scripts__library">
        <div className="monitor-panel__head monitor-panel__head--split">
          <span>Script library</span>
          <button className="monitor-icon-action" onClick={createScript} type="button" aria-label="Create script">+</button>
        </div>
        <div className="voice-scripts__categories" aria-label="Script categories">
          {scriptCategories.map((item) => <button className={category === item ? 'is-selected' : ''} key={item} onClick={() => { setCategory(item); setNotice(''); }}>{item}</button>)}
        </div>
        <h3>Delivery scripts</h3>
        <div className="voice-scripts__script-list">
          {scripts.map((item) => <button className={selectedScript === item ? 'is-active' : ''} onClick={() => { setSelectedScript(item); setNotice(''); }} key={item}>{item}</button>)}
        </div>
      </aside>

      <article className="monitor-panel voice-scripts__editor">
        <div className="monitor-panel__head">Script editor</div>
        <h2>{selectedScript}</h2>
        <div className="voice-scripts__selects">
          <label>Language<select defaultValue="Vietnamese"><option>Vietnamese</option><option>English</option></select></label>
          <label>Voice<select defaultValue="Female 1"><option>Female 1</option><option>Female 2</option><option>Male 1</option></select></label>
        </div>
        <label className="voice-scripts__message">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <span className="voice-scripts__field-label">Variables</span>
        <div className="voice-scripts__variables">
          {['{room}', '{item}', '{location}', '{patient_name}', '{staff_name}'].map((token) => <button key={token} type="button" onClick={() => setMessage((value) => `${value}${value.endsWith(' ') ? '' : ' '}${token}`)}>{token}</button>)}
        </div>
        <section className="voice-scripts__voice-settings" aria-label="Voice settings">
          <h3>Voice settings</h3>
          <label>Volume <b>{volume}%</b><input aria-label="Volume" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          <label>Speed <select defaultValue="Normal"><option>Slow</option><option>Normal</option><option>Fast</option></select></label>
        </section>
        <div className="voice-scripts__editor-actions">
          <button className="secondary" type="button" onClick={() => setNotice(`Previewing “${selectedScript}” on your browser.`)}>Preview Voice</button>
          <button type="button" onClick={() => setNotice('Script saved successfully.')}>Save Script</button>
          <button className="secondary" type="button" onClick={() => setNotice('A duplicate script was created.')}>Duplicate</button>
          <button className="danger" type="button" onClick={() => setNotice('Delete is available after confirming with an administrator.')}>Delete</button>
        </div>
        <Notice>{notice}</Notice>
      </article>

      <aside className="monitor-panel voice-scripts__usage">
        <div className="monitor-panel__head">Script usage</div>
        <span className="monitor-kicker">Used by</span>
        <h2>4 Mission Templates</h2>
        <div className="voice-scripts__templates">
          {['Medication Delivery', 'Lab Sample Pickup', 'Emergency Supply', 'Patient Escort Arrival'].map((item) => <article key={item}><b>{item}</b><span>Active</span></article>)}
        </div>
        <span className="monitor-kicker">Fallback script</span>
        <p className="voice-scripts__fallback">“Tôi cần hỗ trợ. Vui lòng liên hệ nhân viên vận hành.”</p>
        <button className="secondary voice-scripts__robot-test" type="button" onClick={() => setNotice('Test request sent to MAR-01.')}>Test on Robot</button>
        <small>Preview target: MAR-01</small>
        <small>Audio output: Robot speaker</small>
      </aside>
    </div>
  </section>;
}

export function AnalyticsReports() {
  const [period, setPeriod] = useState('7 Days');
  const [notice, setNotice] = useState('');
  const metrics = period === 'Today'
    ? [['Mission Success', '100%', 'green'], ['Total Missions', '18'], ['Distance', '12.4 km'], ['Avg Mission', '3m 28s'], ['Utilization', '76%', 'teal'], ['Downtime', '12m', 'amber']]
    : [['Mission Success', '96.4%', 'green'], ['Total Missions', '182'], ['Distance', '31.4 km'], ['Avg Mission', '3m 42s'], ['Utilization', '72%', 'teal'], ['Downtime', '1h 18m', 'amber']];

  return <section className="monitor-screen analytics-reports" aria-label="Analytics and reports">
    <div className="analytics-reports__tools">
      <div className="monitor-segmented" aria-label="Reporting period">
        {['Today', '7 Days', '30 Days', 'Custom'].map((item) => <button className={period === item ? 'is-selected' : ''} type="button" key={item} onClick={() => { setPeriod(item); setNotice(''); }}>{item}</button>)}
      </div>
      <button className="secondary" type="button" onClick={() => setNotice(`${period} report export is ready.`)}>Export Report</button>
    </div>
    <div className="analytics-reports__metrics">
      {metrics.map(([label, value, tone]) => <article className="monitor-panel" key={label}><span>{label}</span><strong className={tone ? `is-${tone}` : ''}>{value}</strong></article>)}
    </div>
    <div className="analytics-reports__grid">
      <div className="analytics-reports__charts">
        <figure className="analytics-reports__chart"><img src={analyticsMissionsChart} alt="Missions per day bar chart from Monday to Sunday" /></figure>
        <figure className="analytics-reports__chart"><img src={analyticsBatteryChart} alt="Battery history line chart across seven days" /></figure>
      </div>
      <div className="analytics-reports__insights">
        <article className="monitor-panel analytics-reports__utilization">
          <div className="monitor-panel__head">Robot utilization</div>
          <UtilizationRow label="Navigating" value="41%" amount={41} tone="blue" />
          <UtilizationRow label="Waiting" value="17%" amount={17} tone="amber" />
          <UtilizationRow label="Charging" value="20%" amount={20} tone="green" />
          <UtilizationRow label="Idle" value="18%" amount={18} tone="slate" />
          <UtilizationRow label="Error" value="4%" amount={4} tone="red" />
        </article>
        <article className="monitor-panel analytics-reports__quality">
          <div className="monitor-panel__head">Operation quality</div>
          {[
            ['Blocked Time', '24m', '-18%'],
            ['Crowd Delay', '12m', '-7%'],
            ['Emergency Avg Response', '42s', '-11%'],
            ['Navigation Failures', '3', '-25%'],
            ['Delivery Success', '98%', '+2%'],
          ].map(([label, value, change]) => <div className="analytics-reports__quality-row" key={label}><span>{label}</span><b>{value}</b><em>{change}</em></div>)}
          <button className="secondary" type="button" onClick={() => setNotice('PDF quality report is being generated.')}>Generate PDF Report</button>
        </article>
      </div>
    </div>
    <Notice>{notice}</Notice>
  </section>;
}

function UtilizationRow({ label, value, amount, tone }) {
  return <div className="analytics-reports__util-row"><span>{label}</span><div><i className={`is-${tone}`} style={{ width: `${amount}%` }} /></div><b>{value}</b></div>;
}

const historySessions = [
  ['Delivery M-024', 'Pharmacy → Room 305', 'Complete', 'May 15 · 09:12', '14m 47s'],
  ['Escort M-018', 'Entrance → Room 201', 'Complete', 'May 15 · 07:45', '11m 32s'],
  ['Patrol P-006', 'Main Corridor Loop', 'Complete', 'May 14 · 21:20', '29m 05s'],
  ['Delivery M-023', 'Pharmacy → Room 102', 'Failed', 'May 14 · 18:33', '06m 21s'],
  ['Escort M-017', 'Lab → Room 101', 'Interrupted', 'May 14 · 16:12', '08m 03s'],
];

export function HistoryReplay() {
  const [selectedSession, setSelectedSession] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [progress, setProgress] = useState(64);
  const [notice, setNotice] = useState('');
  const selected = historySessions[selectedSession];
  const eventDots = [dotGreen, dotBlue, dotAmber, dotViolet, dotBlue, dotBlue, dotGreen];

  return <section className="monitor-screen history-replay" aria-label="History and replay">
    <div className="history-replay__tools">
      <span>Mission playback &amp; event review</span>
      <div><button className="secondary" type="button" onClick={() => setNotice('Filter menu opened.')}>Filters</button><button className="secondary" type="button" onClick={() => setNotice('Mission search is ready.')}>Search missions…</button></div>
    </div>
    <div className="history-replay__layout">
      <aside className="monitor-panel history-replay__sessions">
        <div className="monitor-panel__head monitor-panel__head--split"><span>Mission / session list</span><small>48 records</small></div>
        {historySessions.map(([title, route, state, date, duration], index) => <button className={selectedSession === index ? 'is-selected' : ''} type="button" key={title} onClick={() => { setSelectedSession(index); setProgress(64); setNotice(''); }}>
          <img src={index === 0 ? missionIconActive : missionIconIdle} alt="" />
          <span><b>{title}</b><small>{route}</small><em className={`is-${state.toLowerCase()}`}>{state}</em><small>{date}</small></span><i>›</i><time>{duration}</time>
        </button>)}
        <footer>1–5 of 48 <span><button type="button" aria-label="Previous page">‹</button><button type="button" aria-label="Next page">›</button></span></footer>
      </aside>
      <article className="monitor-panel history-replay__map-card">
        <div className="monitor-panel__head monitor-panel__head--split"><span>Mission replay map</span><button className="secondary" type="button">Floor 1</button></div>
        <img src={historyRouteMap} alt="Route replay from Pharmacy to Room 305 on Hospital Floor 1" />
      </article>
      <aside className="history-replay__right-column">
        <article className="monitor-panel history-replay__details">
          <div className="monitor-panel__head monitor-panel__head--split"><span>Mission details</span><em>Completed</em></div>
          {[
            ['Mission Type', 'Delivery'], ['Mission ID', selectedSession === 0 ? 'M-024' : selected[0].replace(/[^A-Z0-9-]/g, '')], ['Route', selected[1]], ['Start Time', '09:12:03'], ['End Time', '09:26:50'], ['Duration', selected[4]], ['Distance', '412 m'], ['Battery Usage', '18% (90% → 72%)'], ['Replay Time', '09:21:34'], ['Current Position', 'Near Room 305'], ['Speed', '0.6 m/s'], ['Mode', 'Autonomous'],
          ].map(([label, value]) => <p key={label}><span>{label}</span><b>{value}</b></p>)}
        </article>
        <article className="monitor-panel history-replay__events">
          <div className="monitor-panel__head monitor-panel__head--split"><span>Event log</span><button className="secondary" type="button" onClick={() => setNotice('Replay events exported.')}>Export Replay</button></div>
          {['Mission started', 'Arrived at Pharmacy', 'Package verified', 'Obstacle detected', 'Replanned route', 'Arrived at Room 305', 'Delivery confirmed', 'Mission completed'].map((event, index) => <p key={event}><time>{['09:12:03', '09:14:11', '09:15:02', '09:17:33', '09:17:40', '09:21:05', '09:23:11', '09:26:50'][index]}</time><img src={eventDots[index % eventDots.length]} alt="" /><span>{event}</span></p>)}
        </article>
      </aside>
    </div>
    <footer className="monitor-panel history-replay__player">
      <div className="history-replay__transport"><button type="button" className="secondary" aria-label="Back ten seconds" onClick={() => setProgress((value) => Math.max(0, value - 10))}>◀ 10</button><button className="history-replay__play" type="button" onClick={() => setPlaying((value) => !value)}>{isPlaying ? 'Ⅱ' : '▶'}</button><button type="button" className="secondary" aria-label="Forward ten seconds" onClick={() => setProgress((value) => Math.min(100, value + 10))}>10 ▶</button></div>
      <div className="history-replay__timeline"><span>00:00</span><input aria-label="Replay progress" type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /><div aria-hidden="true">{[dotBlue, dotAmber, dotViolet, dotBlue, dotGreen].map((dot, index) => <img src={dot} alt="" key={`${dot}-${index}`} />)}</div><small>Replay uses recorded pose, mission events and saved evidence from this session.</small></div>
      <div className="history-replay__player-actions"><button className="secondary" type="button" onClick={() => setNotice('Snapshot captured.')}>Snapshot</button><button type="button" onClick={() => setNotice('Replay export is ready.')}>Export</button></div>
    </footer>
    <Notice>{notice}</Notice>
  </section>;
}

export function CrowdHeatmap() {
  const [range, setRange] = useState('Live');
  const [notice, setNotice] = useState('');
  const density = [['Reception', '23', 'Med'], ['Waiting Hall', '48', 'High'], ['Exam A', '16', 'Low'], ['Exam B', '22', 'Med'], ['Main Corridor', '55', 'High'], ['Room 305', '8', 'Low']];

  return <section className="monitor-screen crowd-heatmap" aria-label="Crowd heatmap">
    <div className="monitor-segmented crowd-heatmap__tabs" aria-label="Heatmap period">
      {['Live', '1 Hour', 'Today', '7 Days'].map((item) => <button className={range === item ? 'is-selected' : ''} key={item} type="button" onClick={() => { setRange(item); setNotice(''); }}>{item}</button>)}
    </div>
    <div className="crowd-heatmap__layout">
      <article className="monitor-panel crowd-heatmap__map-card">
        <div className="monitor-panel__head">Crowd density — Hospital Floor 1</div>
        <img src={crowdHeatmapMap} alt={`${range} crowd density map for Hospital Floor 1`} />
        <div className="crowd-heatmap__legend"><span>Low</span><i /><i /><i /><span>High</span></div>
      </article>
      <aside className="crowd-heatmap__side">
        <article className="monitor-panel crowd-heatmap__density">
          <div className="monitor-panel__head">Live density</div>
          {density.map(([area, people, state]) => <p key={area}><span>{area}</span><b>{people}</b><em className={`is-${state.toLowerCase()}`}>{state}</em></p>)}
        </article>
        <article className="monitor-panel crowd-heatmap__rules">
          <div className="monitor-panel__head">Crowd-aware robot rules</div>
          {['Slow down if HIGH', 'Avoid zone if critical', 'Alert Admin > 60 people', 'Replan through low density'].map((rule) => <p key={rule}><span>{rule}</span><b>On</b></p>)}
          <small>Current effect</small>
          <strong>Robot speed reduced to 0.25 m/s</strong>
          <button className="secondary" type="button" onClick={() => setNotice('Crowd rule editor opened.')}>Edit Crowd Rules</button>
        </article>
      </aside>
    </div>
    <Notice>{notice}</Notice>
  </section>;
}

export function AlertsNotifications() {
  const [filter, setFilter] = useState('All');
  const [selectedId, setSelectedId] = useState('10:20');
  const [notice, setNotice] = useState('');
  const visibleRows = useMemo(() => filter === 'All' ? alertRows : alertRows.filter((row) => row.severity === filter), [filter]);
  const current = alertRows.find((row) => row.time === selectedId) || alertRows[1];

  return <section className="monitor-screen alerts-notifications" aria-label="Alerts and notifications">
    <div className="alerts-notifications__tools">
      <div className="monitor-tab-list" role="tablist" aria-label="Alert filters">
        {[['All', '12'], ['Critical', '2'], ['Warning', '4'], ['Info', '6']].map(([label, total]) => <button className={filter === label ? 'is-selected' : ''} type="button" role="tab" aria-selected={filter === label} key={label} onClick={() => { setFilter(label); setNotice(''); }}>{label} ({total})</button>)}
      </div>
      <button className="secondary" type="button" onClick={() => setNotice('All visible alerts were marked as read.')}>Mark All Read</button>
    </div>
    <article className="monitor-panel alerts-notifications__table-card">
      <div className="monitor-panel__head">Active alerts</div>
      <div className="alerts-notifications__table-scroll"><table><thead><tr>{['Time', 'Severity', 'Alert', 'Location', 'Source', 'Status', 'Action'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <tr className={current.time === row.time ? 'is-selected' : ''} key={row.time} onClick={() => { setSelectedId(row.time); setNotice(''); }}><td>{row.time}</td><td><em className={`is-${row.severity.toLowerCase()}`}>{row.severity}</em></td><td>{row.title}</td><td>{row.location}</td><td>{row.source}</td><td>{row.status}</td><td><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(row.time); setNotice(`Viewing ${row.title}.`); }}>View</button></td></tr>)}</tbody></table></div>
    </article>
    <div className="alerts-notifications__bottom">
      <article className="monitor-panel alerts-notifications__detail">
        <div className="monitor-panel__head">Alert detail preview</div>
        <h2>{current.detail}</h2>
        <p>{current.note}</p>
        <div><button className="secondary" type="button" onClick={() => setNotice('Map opened for this alert.')}>View on Map</button><button className="secondary" type="button" onClick={() => setNotice('Retry started.')}>Retry</button><button className="secondary" type="button" onClick={() => setNotice('Manual Control is ready.')}>Manual Control</button><button type="button" onClick={() => setNotice('Alert acknowledged.')}>Acknowledge</button></div>
      </article>
      <article className="monitor-panel alerts-notifications__routing">
        <div className="monitor-panel__head">Notification routing</div>
        <p><b>Critical</b> → Admin + Nurse Station</p><p><b>Warnings</b> → Admin dashboard</p><p><b>Info</b> → Activity feed only</p>
        <button className="secondary" type="button" onClick={() => setNotice('Notification routing editor opened.')}>Edit Routing</button>
      </article>
    </div>
    <Notice>{notice}</Notice>
  </section>;
}

