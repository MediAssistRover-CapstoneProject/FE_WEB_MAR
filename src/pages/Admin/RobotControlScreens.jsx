import { injectStyles } from '../../styles/injectStyles.js';
const inlineStyles = String.raw`.r-screen{color:var(--mar-text,#0f172a);font-family:Inter,Arial,sans-serif}.r-screen *{box-sizing:border-box}.r-screen button,.r-screen input,.r-screen select{font:inherit}.r-card{border:1px solid var(--mar-border,#cbd5e1);border-radius:10px;background:#fff;padding:14px 16px}.r-kicker{margin:0;color:var(--mar-muted,#475569);font-size:12px;font-weight:500;letter-spacing:.18px;text-transform:uppercase}.r-card-intro{margin:5px 0 0;color:var(--mar-muted,#475569);font-size:10px}.r-button{min-height:34px;border:1px solid #2f80ff;border-radius:7px;background:#2f80ff;color:#f7f9fc;cursor:pointer;font-size:12px;font-weight:600;padding:0 14px;transition:background .18s ease,box-shadow .18s ease,transform .18s ease}.r-button:hover{background:#146bea;box-shadow:0 4px 12px #2f80ff2e}.r-button:active{transform:translateY(1px)}.r-button--soft{border-color:#cbd5e1;background:#f1f5f9;color:#0f172a}.r-button--soft:hover{border-color:#9fc4ff;background:#e6f0ff;box-shadow:none}.r-button--active{border-color:#15803d;background:#15803d}.r-button--danger{border-color:#f05252;background:#f05252}.r-button--danger:hover{background:#dc2626}.r-value--good{color:#15803d!important}.r-value--warning{color:#b45309!important}.r-notice{margin:12px 0 0;color:#1d4ed8;font-size:11px;font-weight:600}.r-key-values{margin:0}.r-key-values>div{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 15px}.r-key-values dt{color:#475569;font-size:10px}.r-key-values dd{margin:0;color:#0f172a;font-size:10px;font-weight:500;text-align:right}.r-inline-actions{display:flex;gap:8px}.r-inline-actions .r-button{flex:1;padding:0 10px}.r-tabs{display:flex;gap:12px;margin:0 0 22px}.r-tabs button{height:30px;min-width:82px;border:1px solid transparent;border-radius:6px;background:transparent;color:#334155;cursor:pointer;font-size:9px;font-weight:500}.r-tabs button:hover,.r-tabs .is-active{background:#dbeafe;color:#0f172a;font-weight:600}.r-status-grid{display:grid;grid-template-columns:minmax(190px,.88fr) minmax(250px,1.28fr) minmax(280px,1.42fr);gap:12px}.r-status-grid>.r-card{min-height:235px}.r-health-card{text-align:center}.r-health-orb{position:relative;width:150px;height:150px;margin:8px auto -4px}.r-health-orb img{position:absolute;left:0;top:0}.r-health-orb img+img{left:18px;top:18px}.r-health-orb strong{position:absolute;top:48px;left:0;width:100%;color:#15803d;font-size:24px}.r-health-orb span{position:absolute;top:80px;left:0;width:100%;color:#475569;font-size:9px}.r-health-card h2{margin:0;font-size:16px}.r-healthy-text{margin:6px 0 18px;color:#15803d;font-size:10px;font-weight:500}.r-health-card .r-button{width:154px}.r-readings-card .r-kicker,.r-navigation-card .r-kicker{margin-bottom:15px}.r-navigation-values>div{margin-bottom:13px}.r-navigation-card .r-inline-actions{margin-top:-3px}.r-navigation-card .r-button{font-size:10px;white-space:nowrap}.r-sensors-card{position:relative;min-height:268px;margin-top:12px;padding:14px 16px}.r-sensor-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:10px 0 0}.r-sensor{position:relative;min-height:51px;border:1px solid #cbd5e1;border-radius:5px;background:#f1f5f9;padding:10px}.r-sensor strong{display:block;font-size:10px}.r-sensor span{display:block;margin-top:9px;color:#15803d;font-size:9px}.r-sensor span i,.r-safety-grid i,.r-station-status i,.r-connected i{display:inline-block;width:6px;height:6px;margin-right:4px;border-radius:50%;background:#22c55e;vertical-align:1px}.r-sensor small{position:absolute;right:10px;bottom:9px;color:#475569;font-size:8px}.r-sensor-action{position:absolute;right:24px;bottom:15px;width:140px;font-size:10px}.r-manual-alert{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:35px;margin:0 0 13px;padding:7px 12px;border:1px solid #cbd5e1;border-radius:7px;background:#eff6ff;color:#475569}.r-manual-alert span{display:flex;align-items:center;gap:7px;font-size:9px}.r-manual-alert span i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b}.r-manual-alert b{color:#b45309;font-size:10px;text-transform:uppercase}.r-manual-alert small{font-size:9px}.r-manual-alert strong{color:#2563eb;font-size:9px;text-transform:uppercase}.r-manual-layout{display:grid;grid-template-columns:minmax(440px,1.72fr) minmax(285px,.93fr);gap:14px}.r-teleoperation-frame{min-height:0;margin:0;border:1px solid #0e2744;border-radius:3px;overflow:hidden;background:#031426}.r-teleoperation-frame img{display:block;width:100%;height:auto;aspect-ratio:1.045;object-fit:cover}.r-safety-card{margin-top:14px;min-height:142px}.r-safety-card>.r-card-intro{margin-top:4px}.r-safety-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:11px}.r-safety-grid article{min-height:63px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;padding:10px}.r-safety-grid span{display:block;color:#475569;font-size:8px}.r-safety-grid b{display:block;margin-top:13px;font-size:10px;text-transform:uppercase}.r-safety-foot{margin:10px 0 0;color:#64748b;font-size:8px}.r-manual-side{display:grid;align-content:start;gap:14px}.r-drive-card{min-height:371px}.r-card-heading{display:flex;justify-content:space-between;gap:10px}.r-card-heading>div>p:last-child{margin:3px 0 0;color:#475569;font-size:8px}.r-connected{align-self:start;padding:6px 8px;border-radius:5px;background:#dcfce7;color:#15803d;font-size:9px}.r-joystick{position:relative;width:198px;height:198px;margin:10px auto 0}.r-joystick>img{position:absolute}.r-joystick-ring{left:0;top:0}.r-joystick-center{left:65px;top:65px}.r-joystick-button{position:absolute;z-index:1;border:0;border-radius:50%;background:transparent;color:#2563eb;cursor:pointer;font-size:22px;line-height:1}.r-joystick-button:hover,.r-joystick-button.is-selected{color:#0f4dae;text-shadow:0 0 10px #60a5fa}.r-joystick-button--up{left:82px;top:13px}.r-joystick-button--down{left:82px;bottom:11px}.r-joystick-button--left{left:32px;top:86px}.r-joystick-button--right{right:31px;top:86px}.r-joystick-button--stop{left:65px;top:65px;width:68px;height:68px;color:#334155;font-size:9px;font-weight:600}.r-joystick-button--stop:hover{color:#0f172a;text-shadow:none}.r-control-caption{margin:0 0 12px;text-align:center;color:#64748b;font-size:8px}.r-speed-control{position:relative;display:block;margin:0 0 12px}.r-speed-control span{display:flex;justify-content:space-between;margin-bottom:6px;color:#475569;font-size:8px;text-transform:uppercase}.r-speed-control b{color:#0f172a;font-size:9px}.r-speed-control input{display:block;width:100%;height:5px;accent-color:#2f80ff;cursor:pointer}.r-speed-control img{position:absolute;left:calc(20% - 9px);top:23px;pointer-events:none}.r-mode-control{margin-bottom:14px}.r-mode-control>span{display:block;margin-bottom:5px;color:#475569;font-size:8px;text-transform:uppercase}.r-mode-control>div{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.r-mode-control button{height:21px;border:1px solid transparent;border-radius:5px;background:transparent;color:#475569;cursor:pointer;font-size:8px}.r-mode-control button.is-selected{border-color:#dbeafe;background:#dbeafe;color:#2563eb;font-weight:600}.r-button--emergency{width:100%;min-height:34px;border-color:#f87171;background:#fff1f2;color:#b91c1c;font-size:9px}.r-button--emergency:hover{background:#fee2e2;box-shadow:none}.r-button--emergency>span{margin-right:7px;color:#dc2626}.r-button--emergency small{font-size:8px;font-weight:400}.r-button--emergency.is-stopped{background:#f05252;color:#fff}.r-button--emergency.is-stopped>span{color:#fff}.r-drive-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}.r-drive-actions .r-button{font-size:9px}.r-session-card{min-height:125px}.r-session-card>p:not(.r-kicker){display:flex;justify-content:space-between;margin:9px 0;padding-bottom:7px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:8px}.r-session-card>p:last-child{border-bottom:0}.r-session-card b{font-size:8px;color:#0f172a}.r-charging-toolbar{display:flex;align-items:center;justify-content:flex-end;min-height:36px;margin:0 7px 14px}.r-charging-toolbar>span{margin-right:auto;color:#64748b;font-size:11px}.r-charging-top{display:grid;grid-template-columns:.95fr 1.1fr 1.1fr;gap:12px}.r-charging-top>.r-card{min-height:235px}.r-battery-card>strong{display:block;margin:14px 0 1px;color:#15803d;font-size:34px}.r-battery-card>p:not(.r-kicker){margin:0;color:#475569;font-size:9px}.r-battery-bar{height:13px;margin:17px 7px 21px;border-radius:99px;background:#e2e8f0;overflow:hidden}.r-battery-bar i{display:block;width:72%;height:100%;border-radius:inherit;background:#2fd47d}.r-battery-card .r-key-values>div{margin-bottom:14px}.r-policy-list{margin:2px 0 11px}.r-policy-list label{display:grid;grid-template-columns:1fr 56%;align-items:center;gap:9px;margin:8px 0;color:#475569;font-size:9px}.r-policy-list input{width:100%;height:23px;border:1px solid #cbd5e1;border-radius:5px;background:#f1f5f9;color:#0f172a;font-size:9px;padding:0 10px}.r-policy-list .r-policy-on{color:#15803d}.r-policy-card .r-button{width:100%;font-size:10px}.r-station-card h2{margin:10px 0 8px;font-size:15px}.r-station-status{margin:0 0 16px;color:#15803d;font-size:10px;font-weight:600}.r-station-card .r-key-values{margin-top:18px}.r-station-card .r-key-values>div{margin-bottom:15px}.r-station-card .r-inline-actions{margin-top:19px}.r-station-card .r-button{font-size:10px}.r-charging-bottom{display:grid;grid-template-columns:1.8fr .9fr;gap:12px;margin-top:12px}.r-charging-bottom>.r-card{min-height:300px}.r-schedule-card h2{margin:12px 0 12px;font-size:11px}.r-day-picker{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}.r-day-picker button{height:28px;border:1px solid #cbd5e1;border-radius:5px;background:#f1f5f9;color:#0f172a;cursor:pointer;font-size:9px}.r-day-picker button.is-selected{background:#dbeafe}.r-schedule-inputs{display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:12px;margin:18px 0}.r-schedule-inputs label{color:#475569;font-size:9px}.r-schedule-inputs select{display:block;width:100%;height:29px;margin-top:5px;border:1px solid #cbd5e1;border-radius:5px;background:#f1f5f9;color:#0f172a;font-size:10px;padding:0 10px}.r-schedule-card>.r-button{width:100%;font-size:10px}.r-charge-history{margin-top:19px}.r-charge-history h3,.r-charge-actions h3{margin:0 0 11px;font-size:10px}.r-charge-history p{margin:8px 0;color:#64748b;font-size:9px}.r-charge-history b{margin-left:7px;color:#0f172a}.r-charge-history span{margin-left:7px}.r-charge-actions{display:flex;flex-direction:column;gap:9px}.r-charge-actions .r-button{width:100%;font-size:10px}.r-charge-actions>div{margin-top:10px}.r-charge-actions p{margin:0 0 16px;color:#475569;font-size:9px;line-height:1.4}.r-charge-actions h3{margin-bottom:10px}.r-charging-screen .r-notice{margin-left:7px}@media(max-width:1180px){.r-status-grid{grid-template-columns:1fr 1fr}.r-navigation-card{grid-column:span 2}.r-sensor-grid{grid-template-columns:repeat(4,1fr)}.r-manual-layout{grid-template-columns:1.35fr .95fr}.r-charging-top{grid-template-columns:1fr 1fr}.r-station-card{grid-column:span 2}.r-charging-bottom{grid-template-columns:1.45fr .85fr}}@media(max-width:850px){.r-status-grid,.r-manual-layout,.r-charging-top,.r-charging-bottom{grid-template-columns:1fr}.r-navigation-card,.r-station-card{grid-column:auto}.r-sensor-grid{grid-template-columns:repeat(2,1fr)}.r-sensors-card{min-height:0;padding-bottom:58px}.r-manual-alert{align-items:flex-start;flex-direction:column;gap:4px}.r-manual-alert span{align-items:flex-start;flex-wrap:wrap}.r-manual-alert small{flex-basis:100%}.r-safety-grid{grid-template-columns:repeat(2,1fr)}.r-schedule-inputs{grid-template-columns:1fr}.r-charging-top>.r-card,.r-charging-bottom>.r-card{min-height:0}.r-charging-toolbar{margin-left:0;margin-right:0}.r-charging-toolbar>span{display:none}}@media(max-width:520px){.r-tabs{gap:5px;overflow:auto;padding-bottom:4px}.r-tabs button{min-width:74px}.r-sensor-grid,.r-safety-grid{grid-template-columns:1fr}.r-sensors-card{padding-bottom:68px}.r-sensor-action{left:16px;right:auto;bottom:16px}.r-teleoperation-frame img{aspect-ratio:auto;min-height:270px}.r-drive-actions,.r-day-picker{grid-template-columns:1fr 1fr}.r-day-picker button:last-child{grid-column:span 2}.r-charging-toolbar{justify-content:stretch}.r-charging-toolbar .r-button{width:100%}}
`;
injectStyles('mediassist-style-pages-Admin-RobotControlScreens-jsx', inlineStyles);

import { useEffect, useState } from 'react';
import manualTeleoperation from './assets/manual-teleoperation.png';
import joystickRing from './assets/manual-joystick-ring.svg';
import joystickCenter from './assets/manual-joystick-center.svg';
import speedKnob from './assets/manual-speed-knob.svg';
import healthRing from './assets/status-health-ring.svg';
import healthFill from './assets/status-health-fill.svg';
import { robotsApi } from '../../features/robots/robotsApi.js';

const sensorHealth = [
  ['LiDAR', '10 Hz'],
  ['Front Camera', '30 fps'],
  ['Rear Camera', '30 fps'],
  ['IMU', '100 Hz'],
  ['Wheel Encoder', '50 Hz'],
  ['Load Sensor', 'Active'],
  ['Door Sensor', 'Closed'],
  ['Battery BMS', '72%'],
];

const telemetry = [
  ['Battery', '72%', true],
  ['Localization', '97%', true],
  ['CPU Load', '42%'],
  ['Memory', '61%'],
  ['Temperature', '41°C'],
  ['Uptime', '14h 22m'],
  ['Wi-Fi', '-48 dBm'],
];

const navigation = [
  ['Mode', 'Autonomous'],
  ['Pose', 'X 42.15 · Y 18.67'],
  ['Yaw', '92°'],
  ['Linear Velocity', '0.55 m/s'],
  ['Angular Velocity', '0.04 rad/s'],
  ['Planner', 'Active', true],
  ['Current Goal', 'Room 305'],
];

function Button({ children, className = '', ...props }) {
  return <button type="button" className={`r-button ${className}`.trim()} {...props}>{children}</button>;
}

function Notice({ children }) {
  return <p className="r-notice" role="status" aria-live="polite">{children}</p>;
}

export function RobotStatusScreen() {
  const [tab, setTab] = useState('Overview');
  const [maintenance, setMaintenance] = useState(false);
  const [notice, setNotice] = useState('');
  const [robot, setRobot] = useState(null);
  const tabs = ['Overview', 'Navigation', 'Sensors', 'Safety', 'Network', 'Diagnostics'];
  useEffect(() => { let current = true; robotsApi.list({ page: 0, size: 50 }).then((page) => { const list = Array.isArray(page) ? page : page?.content ?? []; if (current) setRobot(list[0] || null); }).catch((error) => { if (current) setNotice(error.message || 'Unable to load robot status.'); }); return () => { current = false; }; }, []);
  const battery = robot?.batteryPercent ?? 0;
  const identity = robot?.robotCode || robot?.robotName || 'No robot connected';
  const status = robot?.status || 'Unavailable';
  const liveTelemetry = telemetry.map(([label, value, good]) => label === 'Battery' ? [label, robot ? `${battery}%` : '—', battery >= 20] : label === 'Uptime' ? [label, robot?.lastHeartbeat ? new Date(robot.lastHeartbeat).toLocaleString() : '—'] : [label, value, good]);
  const toggleMaintenance = async () => { if (!robot?.robotId) return setNotice('No robot is available from the backend.'); try { await robotsApi.maintenance(robot.robotId, maintenance ? 'Return to service from Robot Status' : 'Maintenance enabled from Robot Status'); setMaintenance((value) => !value); setNotice(maintenance ? 'Maintenance exit requested.' : 'Maintenance mode requested.'); } catch (error) { setNotice(error.message || 'Unable to update maintenance state.'); } };

  return <section className="r-screen r-status-screen" aria-label="Robot status">
    <nav className="r-tabs" aria-label="Robot status sections">
      {tabs.map((item) => <button type="button" className={tab === item ? 'is-active' : ''} onClick={() => { setTab(item); setNotice(`${item} tab selected`); }} key={item}>{item}</button>)}
    </nav>

    <div className="r-status-grid">
      <article className="r-card r-health-card">
        <p className="r-kicker">Robot health</p>
        <div className="r-health-orb" aria-label="92 percent overall health">
          <img src={healthRing} alt="" />
          <img src={healthFill} alt="" />
          <strong>92%</strong>
          <span>Overall Health</span>
        </div>
        <h2>{identity}</h2>
        <p className="r-healthy-text">{status}</p>
        <Button className={maintenance ? 'r-button--active' : 'r-button--soft'} onClick={toggleMaintenance}>{maintenance ? 'Exit Maintenance' : 'Maintenance Mode'}</Button>
      </article>

      <article className="r-card r-readings-card">
        <p className="r-kicker">System telemetry</p>
        <dl className="r-key-values">
          {liveTelemetry.map(([label, value, good]) => <div key={label}><dt>{label}</dt><dd className={good ? 'r-value--good' : ''}>{value}</dd></div>)}
        </dl>
      </article>

      <article className="r-card r-navigation-card">
        <p className="r-kicker">Navigation status</p>
        <dl className="r-key-values r-navigation-values">
          {navigation.map(([label, value, good]) => <div key={label}><dt>{label}</dt><dd className={good ? 'r-value--good' : ''}>{value}</dd></div>)}
        </dl>
        <div className="r-inline-actions">
          <Button className="r-button--soft" onClick={() => setNotice('Relocalization requested')}>Relocalize</Button>
          <Button className="r-button--soft" onClick={() => setNotice('Navigation restart requested')}>Restart Nav</Button>
          <Button onClick={() => setNotice('MAR-01 is returning home')}>Return Home</Button>
        </div>
      </article>
    </div>

    <article className="r-card r-sensors-card">
      <p className="r-kicker">Sensor health</p>
      <div className="r-sensor-grid">
        {sensorHealth.map(([name, detail]) => <article className="r-sensor" key={name}><strong>{name}</strong><span><i /> Healthy</span><small>{detail}</small></article>)}
      </div>
      <Button className="r-button--soft r-sensor-action" onClick={() => setNotice('Sensor view opened')}>Open Sensor View</Button>
    </article>
    {notice && <Notice>{notice}</Notice>}
  </section>;
}

export function ManualControlScreen() {
  const [speed, setSpeed] = useState(20);
  const [direction, setDirection] = useState('');
  const [driveMode, setDriveMode] = useState('Precision');
  const [stopped, setStopped] = useState(false);
  const [notice, setNotice] = useState('');
  const directions = [['up', '▲'], ['left', '◀'], ['stop', 'STOP'], ['right', '▶'], ['down', '▼']];
  const move = (next) => {
    if (next === 'stop') {
      setDirection('');
      setNotice('Motion paused');
      return;
    }
    setStopped(false);
    setDirection(next);
    setNotice(`Moving ${next} at ${speed / 100} m/s`);
  };

  return <section className="r-screen r-manual-screen" aria-label="Manual control">
    <header className="r-manual-alert"><span><i /> <b>Manual control active</b><small>Autonomous mission paused · Teleoperation lock held by Admin User · All commands are audited</small></span><strong>Manual mode</strong></header>
    <div className="r-manual-layout">
      <div className="r-manual-left">
        <figure className="r-teleoperation-frame"><img src={manualTeleoperation} alt="Live teleoperation feed and mini hospital map for MAR-01" /></figure>
        <article className="r-card r-safety-card">
          <p className="r-kicker">Safety status</p>
          <p className="r-card-intro">Real-time safety interlocks while teleoperating</p>
          <div className="r-safety-grid">
            {[['LiDAR Field', 'Clear'], ['Obstacle', 'None'], ['Bumper', 'Ready'], ['E-Stop', 'Released']].map(([label, value]) => <article key={label}><span><i /> {label}</span><b>{value}</b></article>)}
          </div>
          <p className="r-safety-foot">Localization 97% · Safety field 0.8 m · Max manual speed 0.6 m/s</p>
        </article>
      </div>

      <aside className="r-manual-side">
        <article className="r-card r-drive-card">
          <div className="r-card-heading"><div><p className="r-kicker">Drive control</p><p>Hold-to-drive · Safety limits enforced</p></div><b className="r-connected"><i /> Connected</b></div>
          <div className={`r-joystick ${direction ? `r-joystick--${direction}` : ''}`} aria-label="Directional robot controls">
            <img className="r-joystick-ring" src={joystickRing} alt="" />
            <img className="r-joystick-center" src={joystickCenter} alt="" />
            {directions.map(([key, label]) => <button type="button" className={`r-joystick-button r-joystick-button--${key}${direction === key ? ' is-selected' : ''}`} aria-label={key === 'stop' ? 'Stop movement' : `Move ${key}`} onClick={() => move(key)} key={key}>{label}</button>)}
          </div>
          <p className="r-control-caption">WASD / Arrow keys</p>
          <label className="r-speed-control"><span>Speed limit <b>{(speed / 100).toFixed(2)} m/s</b></span><input aria-label="Speed limit" type="range" min="10" max="60" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><img src={speedKnob} alt="" /></label>
          <div className="r-mode-control"><span>Drive mode</span><div>{['Precision', 'Normal', 'Fast'].map((mode) => <button type="button" onClick={() => { setDriveMode(mode); setNotice(`${mode} drive mode selected`); }} className={driveMode === mode ? 'is-selected' : ''} key={mode}>{mode}</button>)}</div></div>
          <Button className={stopped ? 'r-button--emergency is-stopped' : 'r-button--emergency'} onClick={() => { setStopped(true); setDirection(''); setNotice('Emergency stop engaged — motor output is disabled'); }}><span>■</span> {stopped ? 'Emergency Stop Engaged' : 'Emergency Stop'} <small>Immediate motor stop</small></Button>
          <div className="r-drive-actions"><Button className="r-button--soft" onClick={() => { setDirection(''); setNotice('Manual control returned to autonomous navigation'); }}>Return to Auto</Button><Button className="r-button--soft" onClick={() => setNotice('Map centered on MAR-01')}>Center Robot</Button></div>
        </article>

        <article className="r-card r-session-card">
          <p className="r-kicker">Session & telemetry</p>
          {[['Battery', '72%', true], ['Wi-Fi', '-48 dBm', true], ['Pose', 'X 42.15 · Y 18.67'], ['Control lock', 'Admin User', 'warning']].map(([label, value, state]) => <p key={label}><span>{label}</span><b className={state === true ? 'r-value--good' : state === 'warning' ? 'r-value--warning' : ''}>{value}</b></p>)}
        </article>
      </aside>
    </div>
    {notice && <Notice>{notice}</Notice>}
  </section>;
}

export function ChargingScreen() {
  const [policyOpen, setPolicyOpen] = useState(false);
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [charging, setCharging] = useState(false);
  const [notice, setNotice] = useState('');
  const [schedule, setSchedule] = useState({ start: '02:00 AM', end: '06:00 AM', action: 'Auto Charge' });
  const toggleDay = (day) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);

  return <section className="r-screen r-charging-screen" aria-label="Charging">
    <div className="r-charging-toolbar"><span>Battery readiness and dock availability</span><Button onClick={() => { setCharging(true); setNotice('MAR-01 is navigating to Charger-01'); }}>Go Charge Now</Button></div>
    <div className="r-charging-top">
      <article className="r-card r-battery-card">
        <p className="r-kicker">Battery status</p>
        <strong>72%</strong>
        <p>Estimated 2h 45m remaining</p>
        <div className="r-battery-bar"><i /></div>
        <dl className="r-key-values">{[['Voltage', '34.2 V'], ['Current', '2.1 A'], ['Health', '93%'], ['Cycles', '152']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </article>

      <article className="r-card r-policy-card">
        <p className="r-kicker">Auto charging policy</p>
        <div className="r-policy-list">{[['Auto Charge', 'ON', true], ['Go charge below', '20%'], ['Critical battery', '10%'], ['Resume missions', '80%'], ['Idle timeout', '15 min']].map(([label, value, isOn]) => <label key={label}><span>{label}</span><input aria-label={label} defaultValue={value} readOnly className={isOn ? 'r-policy-on' : ''} /></label>)}</div>
        <Button className="r-button--soft" onClick={() => { setPolicyOpen(!policyOpen); setNotice(policyOpen ? 'Charging policy saved' : 'Charging policy fields are ready to edit'); }}>{policyOpen ? 'Save Charging Policy' : 'Edit Charging Policy'}</Button>
      </article>

      <article className="r-card r-station-card">
        <p className="r-kicker">Charging station</p>
        <h2>Charger-01</h2>
        <p className="r-station-status"><i /> Available</p>
        <p className="r-card-intro">Main Corridor — Level 1</p>
        <dl className="r-key-values">{[['Docking Status', 'Ready', true], ['Last charge', 'Today 06:02']].map(([label, value, good]) => <div key={label}><dt>{label}</dt><dd className={good ? 'r-value--good' : ''}>{value}</dd></div>)}</dl>
        <div className="r-inline-actions"><Button className="r-button--soft" onClick={() => setNotice('Charger-01 highlighted on the map')}>View on Map</Button><Button className="r-button--soft" onClick={() => setNotice('Docking test started')}>Test Docking</Button></div>
      </article>
    </div>

    <div className="r-charging-bottom">
      <article className="r-card r-schedule-card">
        <p className="r-kicker">Charging schedule</p>
        <h2>Daily schedule</h2>
        <div className="r-day-picker">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <button type="button" className={days.includes(day) ? 'is-selected' : ''} onClick={() => toggleDay(day)} aria-pressed={days.includes(day)} key={day}>{day}</button>)}</div>
        <div className="r-schedule-inputs">
          <label>Start<select value={schedule.start} onChange={(event) => setSchedule({ ...schedule, start: event.target.value })}><option>02:00 AM</option><option>03:00 AM</option><option>04:00 AM</option></select></label>
          <label>End<select value={schedule.end} onChange={(event) => setSchedule({ ...schedule, end: event.target.value })}><option>06:00 AM</option><option>07:00 AM</option><option>08:00 AM</option></select></label>
          <label>Action<select value={schedule.action} onChange={(event) => setSchedule({ ...schedule, action: event.target.value })}><option>Auto Charge</option><option>Top Up</option><option>Return Home</option></select></label>
        </div>
        <Button onClick={() => setNotice(`Schedule saved for ${days.join(', ')} · ${schedule.start}–${schedule.end}`)}>Save Schedule</Button>
        <div className="r-charge-history"><h3>Charging history</h3><p>Today 02:03 → 06:02 <b>+79%</b> <span>Duration 3h 59m</span></p><p>Yesterday 02:01 → 05:48 <b>+74%</b> <span>Duration 3h 47m</span></p></div>
      </article>

      <article className="r-card r-charge-actions">
        <p className="r-kicker">Charging actions</p>
        <Button onClick={() => { setCharging(true); setNotice('MAR-01 is navigating to Charger-01'); }}>Go Charge Now</Button>
        <Button className="r-button--danger" onClick={() => { setCharging(false); setNotice('Charging request stopped'); }}>Stop Charging</Button>
        <Button className="r-button--soft" onClick={() => setNotice('MAR-01 is returning to its home waypoint')}>Return Home</Button>
        <div><h3>Mission behavior</h3><p>{charging ? 'Charge navigation is active. The current mission pauses safely.' : 'Current mission pauses safely before auto-charge.'}</p><p>After battery reaches 80%, queued missions resume.</p></div>
      </article>
    </div>
    {notice && <Notice>{notice}</Notice>}
  </section>;
}
