import { useState } from 'react';
import patrolRouteMap from '../../assets/images/map-studio/patrol-1.png';
import './PatrolRoutesFigma.css';

const savedRoutes = [
  ['Main Corridor Round', '8 pts', 'Active'],
  ['Outpatient Safety Loop', '7 pts', 'Active'],
  ['Emergency Area Check', '12 pts', 'Paused'],
];

function PatrolButton({ children, primary = false, danger = false, onClick }) {
  return <button type="button" onClick={onClick} className={`patrol-figma-button${primary ? ' primary' : ''}${danger ? ' danger' : ''}`}>{children}</button>;
}

function Field({ label, value }) {
  return <label className="patrol-field"><span>{label}</span><div>{value}</div></label>;
}

function SettingPair({ label, value }) { return <p className="patrol-pair"><span>{label}</span><b>{value}</b></p>; }

/** Standalone Patrol Routes screen matching Figma node 65:2. */
export default function PatrolRoutesFigma() {
  const [activeRoute, setActiveRoute] = useState(savedRoutes[1][0]);
  const [selectedPoint, setSelectedPoint] = useState('P9 — Waiting Hall Checkpoint');
  const [notice, setNotice] = useState('');
  const [running, setRunning] = useState(false);
  return <section className="patrol-routes-figma">
    <header className="patrol-page-header"><h2>Patrol Routes</h2><div><span className="robot-online">MAR-01&nbsp; • &nbsp;Online</span><span>72% Battery</span><PatrolButton onClick={() => setNotice('Changes saved')}>Save Changes</PatrolButton><PatrolButton primary onClick={() => setRunning(!running)}>{running ? 'Patrol Running' : 'Run Now'}</PatrolButton></div></header>
    <nav className="patrol-tabs" aria-label="Patrol management views">{['Route Builder', 'Point Actions', 'Schedule', 'Simulation', 'History'].map((tab, index) => <button type="button" className={index === 0 ? 'active' : ''} key={tab}>{tab}</button>)}</nav>
    <main className="patrol-screen-grid">
      <aside className="patrol-card patrol-settings-card"><h3>Route settings</h3><Field label="Route Name" value="Outpatient Safety Patrol" /><Field label="Route Type" value="Loop" /><h4>Schedule</h4>{[['Start', '20:00'], ['End', '06:00'], ['Repeat', 'Every 30 minutes'], ['Days', 'Mon–Sun']].map(([label, value]) => <SettingPair key={label} label={label} value={value} />)}<h4>Patrol behavior</h4>{['Pause on obstacle', 'Capture snapshot at P2', 'Check crowd density at P3', 'Check restricted area at P4', 'Return Home when complete'].map(item => <p className="patrol-check" key={item}>✓ <span>{item}</span></p>)}<div className="patrol-settings-actions"><PatrolButton onClick={() => setNotice('Patrol test prepared')}>Test Patrol</PatrolButton><PatrolButton danger onClick={() => setNotice('Disable patrol requires confirmation')}>Disable Patrol</PatrolButton></div></aside>
      <section className="patrol-card patrol-builder-card"><h3>Patrol route builder</h3><div className="patrol-route-image"><img src={patrolRouteMap} alt="Patrol route map for Hospital Floor 1" /></div><article className="selected-point"><small>Selected point action</small><h4>{selectedPoint}</h4><b>Action: Check Crowd Density</b><p>Wait 8 sec · Snapshot if density is HIGH</p><PatrolButton onClick={() => setSelectedPoint(selectedPoint === 'P9 — Waiting Hall Checkpoint' ? 'P2 — Corridor Camera Check' : 'P9 — Waiting Hall Checkpoint')}>Edit Point Action</PatrolButton></article></section>
      <aside className="patrol-card patrol-saved-card"><h3>Saved patrol routes</h3>{savedRoutes.map(([name, points, state]) => <button type="button" key={name} className={activeRoute === name ? 'active' : ''} onClick={() => setActiveRoute(name)}><b>{name}</b><span>{points}</span><em className={state === 'Active' ? 'active-status' : 'paused-status'}>{state}</em></button>)}<div className="next-run"><small>Next scheduled run</small><h4>Today • 20:00</h4><p>Estimated duration • 14 min</p><PatrolButton onClick={() => setNotice('Schedule opened')}>Open Schedule</PatrolButton></div></aside>
    </main>
    {notice && <p className="patrol-notice" role="status">{notice}</p>}
  </section>;
}
