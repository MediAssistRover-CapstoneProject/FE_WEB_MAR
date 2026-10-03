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
import './MonitoringScreens.css';

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

