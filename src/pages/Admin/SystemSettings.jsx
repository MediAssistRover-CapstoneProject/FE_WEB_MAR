import { useState } from 'react';
import './SystemSettings.css';

const sections = ['General', 'Robot', 'Navigation', 'Mission Defaults', 'Emergency', 'Voice', 'Camera', 'Notifications', 'Security', 'Data Retention'];

export default function SystemSettings() {
  const [active, setActive] = useState('Emergency');
  const [saved, setSaved] = useState(false);
  return <section className="system-settings"><aside className="settings-nav"><b>Settings</b>{sections.map((section) => <button className={active === section ? 'active' : ''} onClick={() => { setActive(section); setSaved(false); }} key={section}>{section}</button>)}</aside><article className="settings-panel"><small>{active} settings</small><h2>{active === 'Emergency' ? 'Emergency response policy' : `${active} preferences`}</h2><div className="settings-form">{active === 'Emergency' ? <><Toggle label="Auto-create incident on fall detection" initial /><Toggle label="Dispatch MAR-01 to the incident" initial /><Toggle label="Record camera evidence automatically" initial /><label>Emergency escalation timeout<select defaultValue="30 seconds"><option>30 seconds</option><option>60 seconds</option><option>90 seconds</option></select></label><label>Emergency notification group<select defaultValue="Nurse Station 2"><option>Nurse Station 2</option><option>Operations manager</option><option>Security team</option></select></label></> : <><Toggle label={`Enable ${active.toLowerCase()} services`} initial /><label>Default configuration<select defaultValue="Hospital Floor 1"><option>Hospital Floor 1</option><option>Care team standard</option></select></label></>}</div><footer><span>{saved ? 'Changes saved' : 'Changes are saved locally in this demo.'}</span><button onClick={() => setSaved(true)}>Save changes</button></footer></article></section>;
}

function Toggle({ label, initial = false }) { const [enabled, setEnabled] = useState(initial); return <button type="button" className="settings-toggle" onClick={() => setEnabled(!enabled)}><span>{label}</span><i className={enabled ? 'on' : ''} aria-label={enabled ? 'Enabled' : 'Disabled'} /></button>; }
