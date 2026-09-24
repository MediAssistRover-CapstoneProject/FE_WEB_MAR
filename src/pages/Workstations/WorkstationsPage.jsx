import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar, MarButton } from '../Workflows/WorkflowsPage.jsx';
import routeMap from '../../assets/images/workstation-route.png';
import { figmaScreens } from './figmaScreens.js';
import './workstations.css';

const statusHelp = {
  CREATED: 'Đã tạo, input hợp lệ nhưng chưa đưa vào hàng đợi.',
  QUEUED: 'Đang chờ robot hoặc tài nguyên.', ASSIGNED: 'Đã gán cho robot cụ thể.',
  RUNNING: 'Đang thực thi step hiện tại.', WAITING: 'Đang chờ event, người dùng hoặc Staff.',
  PAUSED: 'Tạm dừng có chủ đích và cần điều kiện tiếp tục.',
  SUCCEEDED: 'Đi tới transition COMPLETE_JOB hoặc step cuối thành công.',
  FAILED: 'Đi tới FAIL_JOB hoặc gặp lỗi không có nhánh xử lý.',
  CANCELLED: 'Đã hủy và hoàn thành thao tác an toàn hoặc compensation.',
};
const initialStation = { id: 'pharmacy', name: 'Pharmacy Counter', location: 'Endpoint', endpoint: 'EP-01 · Pharmacy Pickup', subscription: 'This workstation', enabled: true };
const initialButton = { label: 'Deliver to Room 305', workflow: 'Secure Medical Delivery', dispatch: 'Run immediately', repeat: 'Don’t repeat', changeRepeat: 'Off', changeRobot: 'Off · MAR-01', limit: '1', second: 'None' };
const initialJob = { description: 'Deliver medication to Room 305', robot: 'MAR-01', pickup: 'Pharmacy · EP-01', destination: 'Room 305', payload: 'PAYLOAD-104 · MEDICATION', compartment: 'COMP-01', session: 'SESSION-104', type: 'delivery' };
const initialHistory = [
  { id: 'JOB-DEL-103', type: 'delivery', destination: 'Room 305', status: 'SUCCEEDED' },
  { id: 'JOB-ESC-102', type: 'escort', destination: 'Outpatient Clinic', status: 'SUCCEEDED' },
  { id: 'JOB-DEL-101', type: 'delivery', destination: 'Room 305', status: 'CANCELLED' },
];
const titles = { stations: 'Workstations', configuration: 'New Workstation — Dispatch Configuration', ready: 'Workstation Dispatch — Pharmacy Counter', disabled: 'Workstation — Disabled', manual: 'Manual Dispatch', delivery: 'Workflows / Workstations — New Job', request: 'Workstation — Delivery Request', escort: 'Manual Dispatch — New Escort Job', 'review-delivery': 'Dispatch — Review Delivery', 'review-escort': 'Dispatch — Review Escort', missing: 'Dispatch — Missing Input', jobs: 'Dispatch — Jobs', button: 'Workstation — Workflow Button', working: 'Workstation — Pharmacy Counter', prompt: 'Workstation — Pharmacy Counter', history: 'Workstation — Pharmacy Counter', 'escort-running': 'Job — Patient Escort Running' };
const storageKey = 'mediassist-workstations-v1';
function readSaved() { try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; } }

function Field({ label, value, onChange, options, error, type = 'text', readOnly = false }) {
  return <label className="ws-field"><span>{label}</span>{options ? <select value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error}>{options.map(option => <option key={option}>{option}</option>)}</select> : <input type={type} placeholder={label.startsWith('Search') ? 'Search…' : undefined} min={type === 'number' ? '1' : undefined} value={value} readOnly={readOnly} onChange={onChange ? e => onChange(e.target.value) : undefined} aria-invalid={!!error} />}{error && <small role="alert">{error}</small>}</label>;
}
function Tile({ title, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return <Tag type={onClick ? 'button' : undefined} className="ws-tile" onClick={onClick}><strong>{title}</strong>{children && <span>{children}</span>}</Tag>;
}
function Parameter({ label, value, help }) { return <div className="ws-parameter"><span>{label}</span><div>{value}</div>{help && <small>{help}</small>}</div>; }

export default function WorkstationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view') || 'stations';
  const validViews = [...figmaScreens.map(s => s.view), 'running', 'waiting', 'paused', 'succeeded', 'failed', 'cancelled'];
  const view = validViews.includes(requestedView) ? requestedView : 'stations';
  const [saved] = useState(readSaved);
  const [station, setStation] = useState({ ...initialStation, ...saved.station });
  const [stations, setStations] = useState(Array.isArray(saved.stations) ? saved.stations : [{ ...initialStation, ...saved.station }]);
  const [button, setButton] = useState({ ...initialButton, ...saved.button });
  const [stationDraft, setStationDraft] = useState(station);
  const [buttonDraft, setButtonDraft] = useState(button);
  const [job, setJob] = useState({ ...initialJob, type: requestedView.includes('escort') ? 'escort' : 'delivery' });
  const [activeJob, setActiveJob] = useState({ ...initialJob, id: 'JOB-DEL-104', status: 'RUNNING', ...saved.activeJob });
  const [history, setHistory] = useState(Array.isArray(saved.history) ? saved.history : initialHistory);
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState({});
  const [sequence, setSequence] = useState(saved.sequence || 104);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify({ station, stations, button, activeJob, history, sequence })); } catch { /* UI remains usable if storage is unavailable. */ } }, [station, stations, button, activeJob, history, sequence]);
  const go = next => { setSearch(''); setErrors({}); setParams(next === 'stations' ? {} : { view: next }); };
  function saveStation(value) { setStation(value); setStations(items => [...items.filter(item => item.id !== value.id), value]); }
  const editStation = () => { setStationDraft(station); go('configuration'); };
  const newJob = type => { setJob({ ...initialJob, type, description: type === 'escort' ? 'Escort patient to Room 305' : initialJob.description }); go(type); };
  const update = (key, value) => setJob(previous => ({ ...previous, [key]: value }));
  const action = (label, onClick, primary = false) => <MarButton variant={primary ? 'primary' : 'subtle'} className="ws-action" onClick={onClick}>{label}</MarButton>;
  const fields = (data, setter, schema) => schema.map(([key, label, options, type]) => <Field key={key} label={label} value={data[key]} options={options} type={type} onChange={value => setter(previous => ({ ...previous, [key]: value }))} error={errors[key]} />);
  function validate() {
    const invalid = {};
    if (!job.destination.trim()) invalid.destination = 'Choose an existing destination.';
    if (job.type === 'delivery' && !job.payload.trim()) invalid.payload = 'Select or scan the expected payload.';
    if (job.type === 'delivery' && !job.pickup.trim()) invalid.pickup = 'Select a pickup endpoint.';
    if (job.type === 'escort' && !job.session.trim()) invalid.session = 'Enter a patient session.';
    if (Object.keys(invalid).length) { go('missing'); setErrors(invalid); return false; }
    return true;
  }
  const review = () => { if (validate()) go(`review-${job.type}`); };
  function createJob(immediate = false) {
    if (!station.enabled && immediate) { go('disabled'); return; }
    if (!validate()) return;
    const id = `JOB-${job.type === 'escort' ? 'ESC' : 'DEL'}-${sequence + 1}`;
    const next = { ...job, id, status: immediate ? 'RUNNING' : 'CREATED' };
    setSequence(sequence + 1); setActiveJob(next);
    go(immediate ? 'working' : 'created');
  }
  function setStatus(status) {
    const next = { ...activeJob, status }; setActiveJob(next);
    if (['SUCCEEDED', 'CANCELLED', 'FAILED'].includes(status)) setHistory(previous => [next, ...previous.filter(item => item.id !== next.id)]);
    go(status.toLowerCase());
  }
  const jobView = Object.keys(statusHelp).map(s => s.toLowerCase()).includes(view) || view === 'escort-running';
  const details = jobView || ['review-delivery', 'review-escort', 'missing', 'jobs'].includes(view);
  const currentStatus = view === 'escort-running' ? 'RUNNING' : view.toUpperCase();
  const title = titles[view] || `Job — ${currentStatus}`;
  const source = figmaScreens.find(s => s.view === view);
  let content, footer;

  if (view === 'stations') {
    const matches = stations.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
    content = <><h2>WORKSTATIONS</h2>{action('New', () => { setStationDraft({ ...initialStation, id: crypto.randomUUID(), name: '' }); go('configuration'); }, true)}<Field label="Search" value={search} onChange={setSearch} />{matches.map(item => <div className="ws-station-entry" key={item.id}><Tile title={item.name}>{item.endpoint.split(' · ')[0]} · {item.location}<br />1 workflow button · {item.enabled ? 'Enabled' : 'Disabled'}</Tile>{action('Dispatch', () => { setStation(item); go(item.enabled ? 'ready' : 'disabled'); })}{action('Edit configuration', () => { setStation(item); setStationDraft(item); go('configuration'); })}</div>)}{!matches.length && <p>No workstations found.</p>}</>;
    footer = action('New Job · Enter manually', () => newJob('delivery'), true);
  } else if (view === 'configuration') {
    content = <><h2>NEW WORKSTATION</h2>{fields(stationDraft, setStationDraft, [['name', 'Workstation name'], ['location', 'Location type', ['Endpoint', 'Location']], ['endpoint', 'Endpoint', ['EP-01 · Pharmacy Pickup', 'EP-06 · Reception Desk']], ['subscription', 'Prompt subscription', ['This workstation', 'All workstations']]])}<h2>DISPATCH BUTTONS</h2>{action('Configure workflow button', () => { setButtonDraft(button); go('button'); })}<label className="ws-checkbox"><input type="checkbox" checked={stationDraft.enabled} onChange={e => setStationDraft(s => ({ ...s, enabled: e.target.checked }))} />Workstation enabled</label>{action('Cancel', () => go('stations'))}</>;
    footer = action('Save Workstation', () => { if (!stationDraft.name.trim()) { setErrors({ name: 'Enter a workstation name.' }); return; } saveStation({ ...stationDraft, name: stationDraft.name.trim() }); go(stationDraft.enabled ? 'ready' : 'disabled'); }, true);
  } else if (view === 'button') {
    content = <><h2>BUTTON CONFIGURATION</h2>{fields(buttonDraft, setButtonDraft, [['label', 'Button label'], ['workflow', 'Workflow', ['Secure Medical Delivery', 'Patient Escort']], ['dispatch', 'On dispatch', ['Run immediately', 'Ask at start']], ['repeat', 'Repeat this job', ['Don’t repeat', 'Repeat forever', 'Ask user']]])}<small>Repeat options: Don’t repeat · Repeat forever · Ask user</small>{fields(buttonDraft, setButtonDraft, [['changeRepeat', 'Allow operator to change repeat', ['Off', 'On']], ['changeRobot', 'Allow operator to change robot', ['Off · MAR-01', 'On']], ['limit', 'Limit queued jobs', null, 'number'], ['second', 'Add a second job', ['None', 'Return to Ready', 'Automatic Charging']]])}</>;
    footer = action('Save Button', () => { if (!buttonDraft.label.trim() || Number(buttonDraft.limit) < 1 || !Number.isInteger(Number(buttonDraft.limit))) { setErrors({ label: !buttonDraft.label.trim() ? 'Enter a button label.' : '', limit: 'Use a positive whole number.' }); return; } setButton(buttonDraft); go('configuration'); }, true);
  } else if (view === 'ready') {
    content = <><Tile title="Ready for Work">MAR-01 is ready to receive a job.</Tile><h2>AVAILABLE DISPATCH BUTTONS</h2>{action('Dispatch delivery', () => { setJob({ ...initialJob, type: button.workflow === 'Patient Escort' ? 'escort' : 'delivery' }); go('request'); }, true)}<Tile title={button.workflow === 'Patient Escort' ? 'Patient Escort' : 'Medical Delivery'}>Pharmacy → Room 305<br />Workflow v1.0.0 · {button.repeat}</Tile><p>{button.dispatch} · Inputs are already configured.</p>{action('Operator Prompts', () => go('prompt'))}{action('Work History', () => go('history'))}{action('New Job · Enter manually', () => newJob('delivery'))}</>;
    footer = action('Edit workstation', editStation);
  } else if (view === 'disabled') {
    content = <><Tile title="Workstation Disabled">Dispatch is unavailable until this workstation is enabled.</Tile><Field label="Workstation" value={station.name} readOnly /><Field label="Linked endpoint" value={station.endpoint} readOnly />{action('Edit configuration', editStation)}</>;
    footer = action('Enable Workstation', () => { saveStation({ ...station, enabled: true }); go('ready'); }, true);
  } else if (['delivery', 'escort'].includes(view)) {
    content = <><h2>NEW JOB</h2><p>Create a job from an existing workflow.</p><Field label="Description" value={job.description} onChange={v => update('description', v)} /><Field label="Workflow to dispatch" value={job.type === 'escort' ? 'Patient Escort' : 'Secure Medical Delivery'} options={['Secure Medical Delivery', 'Patient Escort']} onChange={v => newJob(v === 'Patient Escort' ? 'escort' : 'delivery')} />{action(job.type === 'delivery' ? 'Choose Patient Escort Instead' : 'Choose Medical Delivery', () => newJob(job.type === 'delivery' ? 'escort' : 'delivery'))}<Field label="Assign robot (optional)" value={job.robot} options={['MAR-01', 'Auto assign']} onChange={v => update('robot', v)} />{job.type === 'delivery' && <Field label="Pickup" value={job.pickup} onChange={v => update('pickup', v)} />}<Field label="Destination" value={job.destination} onChange={v => update('destination', v)} />{job.type === 'escort' && <Field label="Patient session" value={job.session} onChange={v => update('session', v)} />}<p>Review required inputs before creating the Job. Defaults apply only when no explicit value is supplied.</p></>;
    footer = action(job.type === 'escort' ? 'Create Job' : 'Review Job Inputs', review, true);
  } else if (view === 'request') {
    content = <><h2>PRECONFIGURED WORKSTATION DISPATCH</h2>{[['Button', button.label], ['Pickup', job.pickup], ['Destination', job.destination], ['Workflow version', `${button.workflow} · 1.0.0`], ['Robot', job.robot]].map(([label, value]) => <Field key={label} label={label} value={value} readOnly />)}{action('Review dispatch inputs', review)}{action('Back to workstation', () => go('ready'))}</>;
    footer = action('Dispatch Job', () => createJob(true), true);
  } else if (view === 'manual') {
    content = <><h2>WORK</h2>{action('+ New Job', () => newJob('delivery'), true)}{action('History', () => go('history'))}<Field label="Search jobs" value={search} onChange={setSearch} />{['FAILED', 'WAITING', 'RUNNING'].map(status => <Tile key={status} title={`${status} (${activeJob.status === status ? 1 : 0})`} onClick={activeJob.status === status ? () => go(status.toLowerCase()) : undefined}>{activeJob.status === status && `${activeJob.type === 'escort' ? 'Patient Escort' : 'Medical Delivery'} · ${activeJob.id}`}</Tile>)}{action('View Running Job', () => go('working'))}</>;
    footer = action('Create Job', () => newJob('delivery'), true);
  } else if (view === 'working') {
    content = <><Tile title="↑ Working">Robot is completing its assigned job.</Tile><Tile title="Job: Executing">{activeJob.type === 'escort' ? 'Patient Escort' : 'Medical Delivery'} · {activeJob.id}<br />{activeJob.pickup} → {activeJob.destination}</Tile><Tile title="✓ Pickup complete">Payload verified · Compartment locked</Tile><Tile title={`→ Move to ${activeJob.destination}`}>Executing · MAR-01</Tile><Tile title="Receiver authentication">Pending</Tile>{action('View Operator Prompt', () => { setActiveJob(a => ({ ...a, status: 'SUCCEEDED' })); go('prompt'); })}</>;
    footer = action('View Job Details', () => go(activeJob.type === 'escort' ? 'escort-running' : 'running'));
  } else if (view === 'prompt') {
    content = <><h2>OPERATOR PROMPT</h2><Tile title="Delivery completed">{activeJob.destination} · {activeJob.id}<br />Would you like to dispatch this workflow again?</Tile>{action('Repeat Delivery', () => createJob(true), true)}{action('Finish — Do Not Repeat', () => { const complete = { ...activeJob, status: 'SUCCEEDED' }; setHistory(h => [complete, ...h.filter(j => j.id !== complete.id)]); setActiveJob(complete); go('ready'); })}<small>Shown when the button repeat rule is Ask user.</small></>;
    footer = action('Close', () => go('ready'));
  } else if (view === 'history') {
    const filtered = history.filter(item => `${item.id} ${item.type} ${item.destination} ${item.status}`.toLowerCase().includes(search.toLowerCase()));
    content = <><h2>WORK HISTORY</h2><Field label="Search" value={search} onChange={setSearch} />{filtered.map(item => <Tile key={item.id} title={`${item.status === 'SUCCEEDED' ? '✓ ' : ''}${item.type === 'escort' ? 'Patient Escort' : 'Medical Delivery'}`} onClick={() => { setActiveJob({ ...initialJob, ...item }); go(item.status.toLowerCase()); }}>{item.status} · {item.destination}<br />MAR-01 · {item.id}</Tile>)}{!filtered.length && <p>No jobs found.</p>}</>;
    footer = action('Back to Work Monitor', () => go('manual'));
  } else if (view === 'jobs') {
    content = <><h2>OVERVIEW</h2>{Object.entries(statusHelp).map(([status, help]) => <Tile title={status} key={status} onClick={() => go(status.toLowerCase())}>{help}</Tile>)}</>;
    footer = action('New Manual Dispatch', () => go('manual'), true);
  } else if (view === 'missing') {
    content = <><h2>OVERVIEW</h2><Tile title="Job not created">Required inputs must be valid before creating a job.</Tile>{fields(job, setJob, job.type === 'escort' ? [['destination', 'dropoff_location_id'], ['session', 'Patient session']] : [['destination', 'dropoff_location_id'], ['payload', 'payload_id'], ['pickup', 'Pickup']])}</>;
    footer = action('Complete Required Inputs', review, true);
  } else if (view.startsWith('review-')) {
    const escort = view === 'review-escort';
    const values = escort ? [['Workflow version', 'WF_PATIENT_ESCORT / 1.0.0'], ['Robot', job.robot], ['Session', job.session], ['Destination', job.destination]] : [['Workflow version', 'WF_SECURE_MEDICAL_DELIVERY / 1.0.0'], ['Robot', job.robot], ['Pickup → Drop-off', `${job.pickup} → ${job.destination}`], ['Payload', job.payload], ['Compartment', job.compartment], ['Busy robot', 'QUEUED', 'SINGLE_PER_ROBOT']];
    content = <><h2>CONFIGURATION & PARAMETERS</h2>{values.map(([label, value, help]) => <Parameter key={label} label={label} value={value} help={help} />)}</>;
    footer = action(escort ? 'Create Escort Job' : 'Create Delivery Job', () => createJob(), true);
  } else if (jobView) {
    const values = view === 'escort-running' ? [['Job', activeJob.type === 'escort' ? activeJob.id : 'JOB-ESC-104'], ['Workflow', 'WF_PATIENT_ESCORT / 1.0.0'], ['Current step', 'ESCORT_070 · MOVE'], ['Session', activeJob.session], ['Target', activeJob.destination]] : [['Job', activeJob.id, 'Example job'], ['Workflow version', activeJob.type === 'escort' ? 'WF_PATIENT_ESCORT / 1.0.0' : 'WF_SECURE_MEDICAL_DELIVERY / 1.0.0', 'Pinned'], ['Robot', activeJob.robot], ['Status', currentStatus, statusHelp[currentStatus]], ['Current step', ['CREATED', 'QUEUED', 'ASSIGNED'].includes(currentStatus) ? 'Not started' : `Move to ${activeJob.destination}`, 'Illustrative runtime state'], ['Safety', 'Complete hardware transition or compensation before interruption']];
    content = <><h2>CONFIGURATION & PARAMETERS</h2>{values.map(([label, value, help]) => <Parameter key={label} label={label} value={value} help={help} />)}</>;
    footer = action(view === 'queued' ? 'Preview Start' : 'Back to Jobs', () => view === 'queued' ? setStatus('ASSIGNED') : go('jobs'), true);
  }
  return <div className="workflows-screen ws-screen" data-node-id={source?.id}><Sidebar /><main className="workflows-main ws-main"><header className="workflows-header"><h1>{title}</h1><p className="robot-location">MAR-01 · Hospital Floor 1</p><nav className="workflow-tabs" aria-label="Automation workspace">{[['Workflows', null], ['Workstations', 'stations'], ['Jobs', 'jobs']].map(([label, target]) => <MarButton key={label} className="tab-button" variant={(target === 'jobs' ? jobView || view === 'jobs' : target === 'stations' && !jobView && view !== 'jobs') ? 'primary' : 'subtle'} onClick={() => target ? go(target) : navigate('/workflows')}>{label}</MarButton>)}</nav><p className="preview-note">Specification v1.0 • editable UI preview</p></header><div className={details ? 'ws-details-grid' : 'ws-dispatch-grid'}><section className="ws-panel ws-controls"><div className="ws-scroll">{content}</div>{!details && <footer>{footer}</footer>}</section>{details ? <aside className="ws-panel ws-details"><h2>DETAILS & ACTIONS</h2><strong>MediAssistRover</strong><p>MAR-01 · Hospital Floor 1</p>{jobView || view === 'jobs' ? <>{[['Running', 'RUNNING'], ['Waiting for Input', 'WAITING'], ['Paused', 'PAUSED'], ['Failed', 'FAILED'], ['Cancelled', 'CANCELLED']].map(([label, status]) => <MarButton key={status} className="ws-action" variant="subtle" onClick={() => setStatus(status)}>{label}</MarButton>)}{action('Queue Job', () => setStatus('QUEUED'))}{action('Assign Robot', () => setStatus('ASSIGNED'))}{action('Patient Escort Running', () => go('escort-running'))}<p>Illustrative job states. No live robot commands are sent by this prototype.</p></> : <>{action('Medical Delivery', () => newJob('delivery'))}{action('Patient Escort', () => newJob('escort'))}{action('Input Error State', () => { update('destination', ''); go('missing'); })}<p>Choose a workflow version, provide its required inputs, then review the dispatch request.</p></>}<small className="ws-blue">DESIGN PREVIEW</small><p>Configuration and runtime examples follow the attached workflow specification.</p></aside> : <section className="ws-panel ws-map"><h2>HOSPITAL FLOOR 1 / MAR-01</h2><div className="ws-map-image"><img src={routeMap} alt="Hospital Floor 1: MAR-01 route from Pharmacy to Room 305" /></div><small>Route preview · Pharmacy → Room 305</small></section>}</div>{details && <footer className="ws-footer">{footer}{action('Back to Workflows', () => navigate('/workflows'))}<small>Scroll inside panels to view all content.</small></footer>}</main></div>;
}
