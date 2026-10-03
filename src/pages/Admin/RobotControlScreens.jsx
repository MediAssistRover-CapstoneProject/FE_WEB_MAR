import { useState } from 'react';
import manualTeleoperation from './assets/manual-teleoperation.png';
import joystickRing from './assets/manual-joystick-ring.svg';
import joystickCenter from './assets/manual-joystick-center.svg';
import speedKnob from './assets/manual-speed-knob.svg';
import healthRing from './assets/status-health-ring.svg';
import healthFill from './assets/status-health-fill.svg';
import './RobotControlScreens.css';

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
  const tabs = ['Overview', 'Navigation', 'Sensors', 'Safety', 'Network', 'Diagnostics'];

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
        <h2>MAR-01</h2>
        <p className="r-healthy-text">Autonomous · Online</p>
        <Button className={maintenance ? 'r-button--active' : 'r-button--soft'} onClick={() => { setMaintenance(!maintenance); setNotice(maintenance ? 'Maintenance mode disabled' : 'Maintenance mode enabled'); }}>{maintenance ? 'Maintenance Mode On' : 'Maintenance Mode'}</Button>
      </article>

      <article className="r-card r-readings-card">
        <p className="r-kicker">System telemetry</p>
        <dl className="r-key-values">
          {telemetry.map(([label, value, good]) => <div key={label}><dt>{label}</dt><dd className={good ? 'r-value--good' : ''}>{value}</dd></div>)}
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
