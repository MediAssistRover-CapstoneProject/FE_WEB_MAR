import { injectStyles } from '../../styles/injectStyles.js';
const inlineStyles = String.raw`.ws-screen { min-width: 0; height: 100vh; overflow: hidden; background: #fff; }
.ws-screen .wf-sidebar { top: 100px; bottom: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
.ws-screen .wf-sidebar button { width: 100%; }
.ws-screen .robot-location { display: none; }
.ws-main { height: 100vh; min-width: 0; overflow: hidden; padding: 44px 28px 24px; max-width: 1600px; }
.ws-screen h2 { font-size: 14px; font-weight: 600; line-height: 1.45; margin: 0; }
.ws-screen p { line-height: 1.45; }
.ws-dispatch-grid { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; height: calc(100vh - 230px); min-height: 0; margin-top: 24px; }
.ws-panel { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; min-width: 0; }
.ws-controls { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.ws-scroll { min-height: 0; height: auto; flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 12px; scrollbar-width: thin; }
.ws-scroll > * { flex-shrink: 0; }
.ws-station-entry { display: flex; flex-direction: column; gap: 12px; }
.ws-controls footer { padding-top: 0; }
.ws-screen .ws-action { width: 100%; min-height: 40px; height: auto; padding: 10px 16px; flex-shrink: 0; }
.ws-screen .ws-action:focus-visible, .ws-tile:focus-visible { outline: 2px solid #2f80ff; outline-offset: 2px; }
.ws-field { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.ws-field > span, .ws-parameter > span { color: #475569; font-size: 10px; font-weight: 500; line-height: 15px; }
.ws-field input, .ws-field select { width: 100%; min-width: 0; height: 42px; padding: 10px 16px; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; background: #f1f5f9; font: 600 14px/1.45 Inter, Arial, sans-serif; }
.ws-field input:focus, .ws-field select:focus { outline: 2px solid #93c5fd; outline-offset: 1px; }
.ws-field [aria-invalid=true] { border-color: #dc2626; }
.ws-field small { color: #b91c1c; }
.ws-tile { display: flex; flex-direction: column; gap: 12px; width: 100%; margin: 0; padding: 16px; border: 0; border-radius: 6px; background: #f1f5f9; color: #0f172a; font: inherit; text-align: left; }
button.ws-tile:hover { background: #e8eef6; }
.ws-tile strong { font-size: 14px; font-weight: 600; line-height: 1.45; }
.ws-tile span, .ws-scroll p { font-size: 12px; font-weight: 400; color: #475569; line-height: 1.45; margin: 0; }
.ws-screen small { font-size: 10px; line-height: 1.45; }
.ws-checkbox { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.ws-map { background: #f8fafc; height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
.ws-map-image { position: relative; flex: 1; min-height: 0; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 8px; }
.ws-map-image img { position: absolute; width: 100%; height: 100%; object-fit: cover; top: 0; left: 0; }
.ws-simulation-path { position: absolute; left: 23%; top: 27%; width: 61%; height: 56%; border: 3px dashed #2f80ff; border-left: 0; border-bottom: 0; border-radius: 0 18px 0 0; opacity: .72; pointer-events: none; }
.ws-sim-robot { position: absolute; z-index: 2; display: grid; place-items: center; width: 34px; height: 34px; border: 3px solid #fff; border-radius: 50%; background: #2f80ff; box-shadow: 0 0 0 3px #93c5fd, 0 5px 16px #1d4ed866; color: #fff; font-size: 9px; font-weight: 700; transform: translate(-50%, -50%); transition: left 1s ease, top 1s ease; }
.ws-sim-robot::after { content: 'MAR-01'; position: absolute; top: 38px; left: 50%; padding: 3px 6px; border-radius: 4px; background: #0f172acc; color: #fff; font-size: 9px; white-space: nowrap; transform: translateX(-50%); }
.ws-simulation-progress { height: 8px; overflow: hidden; border-radius: 999px; background: #dbeafe; }
.ws-simulation-progress i { display: block; height: 100%; border-radius: inherit; background: #2f80ff; transition: width 1s ease; }
.ws-screen[data-node-id="571:52018"] .ws-map-image::after { content: 'MAR-01'; position: absolute; z-index: 2; left: 84%; top: 23%; display: grid; width: 34px; height: 34px; place-items: center; border: 3px solid #fff; border-radius: 50%; background: #2f80ff; box-shadow: 0 0 0 3px #93c5fd, 0 5px 16px #1d4ed866; color: #fff; font-size: 8px; font-weight: 700; transform: translate(-50%, -50%); animation: ws-simulate-route 5.6s ease-in-out forwards; }
@keyframes ws-simulate-route { 0% { left:84%; top:23%; } 25% { left:84%; top:42%; } 55% { left:60%; top:64%; } 78% { left:37%; top:64%; } 100% { left:23%; top:79%; } }
.ws-map > small { color: #475569; }
.ws-details-grid { display: grid; grid-template-columns: minmax(0, 824fr) minmax(270px, 320fr); gap: 20px; height: calc(100vh - 230px); min-height: 0; margin-top: 24px; }
.ws-details-grid .ws-controls { height: 100%; }
.ws-details-grid .ws-scroll { height: 100%; padding-right: 12px; }
.ws-parameter { min-height: 88px; display: flex; flex-direction: column; gap: 6px; }
.ws-parameter > div { border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 12px; background: #f1f5f9; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.ws-parameter > small { color: #475569; }
.ws-details { height: 100%; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.ws-details > strong { margin-top: 8px; font-size: 14px; font-weight: 600; }
.ws-details > p { margin: 0; font-size: 12px; color: #475569; }
.ws-details > strong + p { display: none; }
.ws-details .ws-action { min-height: 36px; padding: 8px 16px; }
.ws-blue { color: #2f80ff; }
.ws-footer { margin-top: 20px; display: flex; gap: 12px; align-items: center; }
.ws-footer .ws-action { width: 270px; }
.ws-footer .ws-action + .ws-action { width: 210px; }
.ws-footer small { color: #475569; }
@media (max-width: 1200px) { .ws-dispatch-grid { grid-template-columns: 328px minmax(0,1fr); } }
@media (max-width: 900px) { .ws-screen,.ws-main { height: auto; overflow: visible; } .ws-main { margin-left: 0; padding: 28px 16px; } .ws-dispatch-grid { grid-template-columns: minmax(280px, 360px) minmax(0,1fr); height: auto; } .ws-map { min-height: 520px; } .ws-screen .tab-button { flex: 1; min-width: 0; } }
@media (max-width: 650px) { .ws-dispatch-grid, .ws-details-grid { grid-template-columns: 1fr; height: auto; margin-top: 24px; } .ws-controls { height: auto; min-height: 580px; } .ws-scroll { height: auto; max-height: 654px; } .ws-controls footer { margin-top: auto; } .ws-details-grid .ws-controls, .ws-details { height: auto; max-height: 706px; } .ws-footer { flex-wrap: wrap; } .ws-footer .ws-action { width: 100%; } }
`;
injectStyles('mediassist-style-pages-Workstations-WorkstationsPage-jsx', inlineStyles);

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar, MarButton } from '../Workflows/WorkflowsPage.jsx';
import routeMap from '../../assets/images/workstation-route.png';
import { figmaScreens } from './figmaScreens.js';
import { facilityApi } from '../../features/facility/facilityApi.js';
import { workflowApi } from '../../features/workflows/workflowApi.js';

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
const simulationStages = [
  { label: 'Validating workflow inputs', left: '84%', top: '23%' },
  { label: 'Leaving Pharmacy Pickup', left: '84%', top: '42%' },
  { label: 'Navigating the main corridor', left: '60%', top: '64%' },
  { label: 'Approaching destination', left: '37%', top: '64%' },
  { label: 'Delivery completed', left: '23%', top: '79%' },
];
const titles = { stations: 'Dispatch', configuration: 'Dispatch — Configuration', ready: 'Dispatch — Pharmacy Counter', disabled: 'Dispatch — Disabled', delivery: 'Dispatch — New Job', request: 'Dispatch — Delivery Request', escort: 'Dispatch — New Escort Job', 'review-delivery': 'Dispatch — Review Delivery', 'review-escort': 'Dispatch — Review Escort', missing: 'Dispatch — Missing Input', jobs: 'Dispatch — Jobs', button: 'Dispatch — Workflow Button', working: 'Dispatch — Workflow Simulation', prompt: 'Dispatch — Pharmacy Counter', history: 'Dispatch — Pharmacy Counter', 'escort-running': 'Job — Patient Escort Running' };
const storageKey = 'mediassist-workstations-v1';
function readSaved() { try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; } }

function Field({ label, value, onChange, options, error, type = 'text', readOnly = false }) {
  return <label className="ws-field"><span>{label}</span>{options ? <select value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error}>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: option } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select> : <input type={type} placeholder={label.startsWith('Search') ? 'Search…' : undefined} min={type === 'number' ? '1' : undefined} value={value} readOnly={readOnly} onChange={onChange ? e => onChange(e.target.value) : undefined} aria-invalid={!!error} />}{error && <small role="alert">{error}</small>}</label>;
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
  const [simulationStep, setSimulationStep] = useState(0);
  const [catalog, setCatalog] = useState({ endpoints: [], rooms: [], workflows: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    Promise.all([facilityApi.listEndpoints({ page: 0, size: 100 }), facilityApi.listRooms({ page: 0, size: 100 }), workflowApi.list({ page: 0, size: 100 })]).then(([endpointPage, roomPage, workflowPage]) => {
      if (active) setCatalog({ endpoints: endpointPage.content ?? [], rooms: roomPage.content ?? [], workflows: workflowPage.content ?? [], loading: false, error: '' });
    }).catch((error) => { if (active) setCatalog({ endpoints: [], rooms: [], workflows: [], loading: false, error: error.message || 'Dispatch catalog is unavailable.' }); });
    return () => { active = false; };
  }, []);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify({ station, stations, button, activeJob, history, sequence })); } catch { /* UI remains usable if storage is unavailable. */ } }, [station, stations, button, activeJob, history, sequence]);
  useEffect(() => {
    if (view !== 'working' || activeJob.status !== 'RUNNING') return undefined;
    setSimulationStep(0);
    const timer = window.setInterval(() => {
      setSimulationStep((current) => {
        const next = current + 1;
        if (next >= simulationStages.length) {
          window.clearInterval(timer);
          setActiveJob((job) => ({ ...job, status: 'SUCCEEDED' }));
          return simulationStages.length - 1;
        }
        return next;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [view, activeJob.id, activeJob.status]);
  const endpointOptions = catalog.endpoints.filter((item) => item.active && item.accessible).map((item) => ({ value: item.endpointId, label: `${item.endpointCode} · ${item.endpointName}` }));
  const destinationOptions = [...catalog.rooms.filter((item) => item.active).map((item) => ({ value: item.roomId, label: `${item.roomCode} · ${item.roomName}` })), ...endpointOptions];
  const dispatchDefinitions = catalog.workflows.map((item) => ({ id: item.workflowId, code: item.workflowCode, name: item.workflowName, status: item.status, label: `${item.workflowCode} · ${item.workflowName}` }));
  const workflowOptions = dispatchDefinitions.map((item) => ({ value: item.id, label: item.label }));
  const selectedWorkflow = workflowOptions.find((item) => item.value === button.workflow) || workflowOptions.find((item) => /delivery/i.test(item.label)) || workflowOptions[0] || { value: button.workflow, label: button.workflow };
  const includeCurrent = (options, value) => options.some((item) => item.value === value) ? options : [{ value, label: value }, ...options];
  const go = next => { setSearch(''); setErrors({}); setParams(next === 'stations' ? {} : { view: next }); };
  function saveStation(value) { setStation(value); setStations(items => [...items.filter(item => item.id !== value.id), value]); }
  const editStation = () => { setStationDraft(station); go('configuration'); };
  const newJob = type => { setSimulationStep(0); setJob({ ...initialJob, type, description: type === 'escort' ? 'Escort patient to Room 305' : initialJob.description }); go(type); };
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
    setSequence(sequence + 1); setSimulationStep(0); setActiveJob(next);
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
    const matches = dispatchDefinitions.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(search.toLowerCase()));
    const dispatch = (definition) => { setButton((current) => ({ ...current, workflow: definition.id })); setJob({ ...initialJob, type: /escort/i.test(definition.label) ? 'escort' : 'delivery', description: `Dispatch ${definition.name}` }); go('delivery'); };
    content = <><h2>DISPATCH</h2><p>Select a workflow definition, configure the required inputs, then dispatch it to an available robot.</p>{action('+ New dispatch', () => newJob('delivery'), true)}<Field label="Search workflow definitions" value={search} onChange={setSearch} />{catalog.error && <p>{catalog.error}</p>}{catalog.loading && <p>Loading workflow definitions…</p>}{matches.map((definition) => <div className="ws-station-entry" key={definition.id}><Tile title={definition.name}>{definition.code}<br />Status · {definition.status || 'DRAFT'}</Tile>{action('Configure & dispatch', () => dispatch(definition), true)}{action('Dispatch settings', () => { setButton((current) => ({ ...current, workflow: definition.id })); setStationDraft(station); go('configuration'); })}</div>)}{!catalog.loading && !matches.length && <p>No workflow definitions returned by the backend.</p>}</>;
    footer = null;
  } else if (view === 'configuration') {
    content = <><h2>DISPATCH PROFILE</h2>{catalog.error && <p>{catalog.error}</p>}{fields(stationDraft, setStationDraft, [['name', 'Dispatch profile name'], ['location', 'Location type', ['Endpoint', 'Location']], ['endpoint', 'Endpoint', endpointOptions.length ? includeCurrent(endpointOptions, stationDraft.endpoint) : [{ value: stationDraft.endpoint, label: catalog.loading ? 'Loading endpoints…' : stationDraft.endpoint }]], ['subscription', 'Prompt subscription', ['This dispatch profile', 'All dispatch profiles']]])}<h2>WORKFLOW CONFIGURATION</h2>{action('Configure workflow dispatch', () => { setButtonDraft(button); go('button'); })}<label className="ws-checkbox"><input type="checkbox" checked={stationDraft.enabled} onChange={e => setStationDraft(s => ({ ...s, enabled: e.target.checked }))} />Dispatch profile enabled</label>{action('Cancel', () => go('stations'))}</>;
    footer = action('Save dispatch profile', () => { if (!stationDraft.name.trim()) { setErrors({ name: 'Enter a dispatch profile name.' }); return; } saveStation({ ...stationDraft, name: stationDraft.name.trim() }); go(stationDraft.enabled ? 'ready' : 'disabled'); }, true);
  } else if (view === 'button') {
    content = <><h2>WORKFLOW DISPATCH CONFIGURATION</h2>{fields(buttonDraft, setButtonDraft, [['label', 'Dispatch button label'], ['workflow', 'Workflow definition', workflowOptions.length ? includeCurrent(workflowOptions, buttonDraft.workflow) : [{ value: buttonDraft.workflow, label: catalog.loading ? 'Loading workflows…' : buttonDraft.workflow }]], ['dispatch', 'On dispatch', ['Run immediately', 'Ask at start']], ['repeat', 'Repeat this job', ['Don’t repeat', 'Repeat forever', 'Ask user']]])}<small>Workflow definitions are loaded from the Workflow Definitions API.</small>{fields(buttonDraft, setButtonDraft, [['changeRepeat', 'Allow operator to change repeat', ['Off', 'On']], ['changeRobot', 'Allow operator to change robot', ['Off · MAR-01', 'On']], ['limit', 'Limit queued jobs', null, 'number'], ['second', 'Add a second job', ['None', 'Return to Ready', 'Automatic Charging']]])}</>;
    footer = action('Save Button', () => { if (!buttonDraft.label.trim() || Number(buttonDraft.limit) < 1 || !Number.isInteger(Number(buttonDraft.limit))) { setErrors({ label: !buttonDraft.label.trim() ? 'Enter a button label.' : '', limit: 'Use a positive whole number.' }); return; } setButton(buttonDraft); go('configuration'); }, true);
  } else if (view === 'ready') {
    content = <><Tile title="Ready to Dispatch">MAR-01 is ready to receive a workflow dispatch.</Tile><h2>AVAILABLE WORKFLOWS</h2>{action(`Dispatch ${selectedWorkflow.label}`, () => { setJob({ ...initialJob, type: /escort/i.test(selectedWorkflow.label) ? 'escort' : 'delivery' }); go('request'); }, true)}<Tile title={selectedWorkflow.label}>Pharmacy → Room 305<br />Workflow definition · {button.repeat}</Tile><p>{button.dispatch} · Inputs are ready for review.</p>{action('Operator Prompts', () => go('prompt'))}{action('Dispatch History', () => go('history'))}{action('New workflow dispatch', () => newJob('delivery'))}</>;
    footer = action('Edit dispatch profile', editStation);
  } else if (view === 'disabled') {
    content = <><Tile title="Dispatch profile disabled">Workflow dispatch is unavailable until this profile is enabled.</Tile><Field label="Dispatch profile" value={station.name} readOnly /><Field label="Linked endpoint" value={station.endpoint} readOnly />{action('Edit configuration', editStation)}</>;
    footer = action('Enable dispatch profile', () => { saveStation({ ...station, enabled: true }); go('ready'); }, true);
  } else if (['delivery', 'escort'].includes(view)) {
    content = <><h2>NEW WORKFLOW DISPATCH</h2><p>Select a workflow definition, assign a robot, then provide its dispatch inputs.</p>{catalog.error && <p>{catalog.error}</p>}<Field label="Description" value={job.description} onChange={v => update('description', v)} /><Field label="Workflow definition" value={button.workflow} options={workflowOptions.length ? includeCurrent(workflowOptions, button.workflow) : [{ value: button.workflow, label: catalog.loading ? 'Loading workflows…' : button.workflow }]} onChange={v => { setButton((current) => ({ ...current, workflow: v })); setJob((current) => ({ ...current, type: /escort/i.test(workflowOptions.find((item) => item.value === v)?.label || '') ? 'escort' : 'delivery' })); }} />{action(job.type === 'delivery' ? 'Choose Patient Escort Instead' : 'Choose Medical Delivery', () => newJob(job.type === 'delivery' ? 'escort' : 'delivery'))}<Field label="Assign robot (optional)" value={job.robot} options={['MAR-01', 'Auto assign']} onChange={v => update('robot', v)} />{job.type === 'delivery' && <Field label="Pickup" value={job.pickup} options={endpointOptions.length ? includeCurrent(endpointOptions, job.pickup) : [{ value: job.pickup, label: catalog.loading ? 'Loading pickup endpoints…' : job.pickup }]} onChange={v => update('pickup', v)} />}<Field label="Destination" value={job.destination} options={destinationOptions.length ? includeCurrent(destinationOptions, job.destination) : [{ value: job.destination, label: catalog.loading ? 'Loading destinations…' : job.destination }]} onChange={v => update('destination', v)} />{job.type === 'escort' && <Field label="Patient session" value={job.session} onChange={v => update('session', v)} />}<p>Workflow, pickup and destination choices are loaded from the backend catalog.</p></>;
    footer = action(job.type === 'escort' ? 'Create Job' : 'Review Job Inputs', review, true);
  } else if (view === 'request') {
    content = <><h2>PRECONFIGURED WORKSTATION DISPATCH</h2>{[['Button', button.label], ['Pickup', job.pickup], ['Destination', job.destination], ['Workflow version', `${button.workflow} · 1.0.0`], ['Robot', job.robot]].map(([label, value]) => <Field key={label} label={label} value={value} readOnly />)}{action('Review dispatch inputs', review)}{action('Back to workstation', () => go('ready'))}</>;
    footer = action('Dispatch Job', () => createJob(true), true);
  } else if (view === 'working') {
    const activeStage = simulationStages[simulationStep];
    const percent = Math.round(((simulationStep + 1) / simulationStages.length) * 100);
    const complete = activeJob.status === 'SUCCEEDED';
    content = <><h2>{complete ? 'SIMULATION COMPLETED' : 'WORKFLOW SIMULATION'}</h2><Tile title={complete ? '✓ Job completed' : `Running · ${percent}%`}>{complete ? 'The simulated robot has reached its destination.' : activeStage.label}<br />{activeJob.type === 'escort' ? 'Patient Escort' : 'Medical Delivery'} · {activeJob.id}</Tile><Tile title="Route">{activeJob.pickup} → {activeJob.destination}<br />MAR-01 · Browser simulation only</Tile><div className="ws-simulation-progress" aria-label={`Simulation progress: ${percent}%`}><i style={{ width: `${percent}%` }} /></div><p>{complete ? 'The result is recorded as succeeded. You can review the job or create another dispatch.' : 'The robot advances automatically through this workflow. No manual control or live robot command is used.'}</p></>;
    footer = complete ? action('View Job Details', () => go(activeJob.type === 'escort' ? 'escort-running' : 'succeeded'), true) : action('Restart simulation', () => { setActiveJob((job) => ({ ...job, status: 'RUNNING' })); setSimulationStep(0); }, true);
  } else if (view === 'prompt') {
    content = <><h2>OPERATOR PROMPT</h2><Tile title="Delivery completed">{activeJob.destination} · {activeJob.id}<br />Would you like to dispatch this workflow again?</Tile>{action('Repeat Delivery', () => createJob(true), true)}{action('Finish — Do Not Repeat', () => { const complete = { ...activeJob, status: 'SUCCEEDED' }; setHistory(h => [complete, ...h.filter(j => j.id !== complete.id)]); setActiveJob(complete); go('ready'); })}<small>Shown when the button repeat rule is Ask user.</small></>;
    footer = action('Close', () => go('ready'));
  } else if (view === 'history') {
    const filtered = history.filter(item => `${item.id} ${item.type} ${item.destination} ${item.status}`.toLowerCase().includes(search.toLowerCase()));
    content = <><h2>WORK HISTORY</h2><Field label="Search" value={search} onChange={setSearch} />{filtered.map(item => <Tile key={item.id} title={`${item.status === 'SUCCEEDED' ? '✓ ' : ''}${item.type === 'escort' ? 'Patient Escort' : 'Medical Delivery'}`} onClick={() => { setActiveJob({ ...initialJob, ...item }); go(item.status.toLowerCase()); }}>{item.status} · {item.destination}<br />MAR-01 · {item.id}</Tile>)}{!filtered.length && <p>No jobs found.</p>}</>;
    footer = action('Back to Dispatch', () => go('stations'));
  } else if (view === 'jobs') {
    content = <><h2>OVERVIEW</h2>{Object.entries(statusHelp).map(([status, help]) => <Tile title={status} key={status} onClick={() => go(status.toLowerCase())}>{help}</Tile>)}</>;
    footer = action('New dispatch', () => newJob('delivery'), true);
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
  return <div className="workflows-screen ws-screen" data-node-id={source?.id}><Sidebar /><main className="workflows-main ws-main"><header className="workflows-header"><h1>{title}</h1><p className="robot-location">MAR-01 · Hospital Floor 1</p><nav className="workflow-tabs" aria-label="Automation workspace">{[['Workflows', null], ['Dispatch', 'stations'], ['Jobs', 'jobs']].map(([label, target]) => <MarButton key={label} className="tab-button" variant={(target === 'jobs' ? jobView || view === 'jobs' : target === 'stations' && !jobView && view !== 'jobs') ? 'primary' : 'subtle'} onClick={() => target ? go(target) : navigate('/workflows')}>{label}</MarButton>)}</nav><p className="preview-note">Workflow definitions, facility endpoints and dispatch inputs are loaded from the API.</p></header><div className={details ? 'ws-details-grid' : 'ws-dispatch-grid'}><section className="ws-panel ws-controls"><div className="ws-scroll">{content}</div>{!details && <footer>{footer}</footer>}</section>{details ? <aside className="ws-panel ws-details"><h2>DETAILS & ACTIONS</h2><strong>MediAssistRover</strong><p>MAR-01 · Hospital Floor 1</p>{jobView || view === 'jobs' ? <>{[['Running', 'RUNNING'], ['Waiting for Input', 'WAITING'], ['Paused', 'PAUSED'], ['Failed', 'FAILED'], ['Cancelled', 'CANCELLED']].map(([label, status]) => <MarButton key={status} className="ws-action" variant="subtle" onClick={() => setStatus(status)}>{label}</MarButton>)}{action('Queue Job', () => setStatus('QUEUED'))}{action('Assign Robot', () => setStatus('ASSIGNED'))}{action('Patient Escort Running', () => go('escort-running'))}<p>Illustrative job states. No live robot commands are sent by this prototype.</p></> : <>{action('Medical Delivery', () => newJob('delivery'))}{action('Patient Escort', () => newJob('escort'))}{action('Input Error State', () => { update('destination', ''); go('missing'); })}<p>Choose a workflow definition, provide its required inputs, then review the dispatch request.</p></>}<small className="ws-blue">DISPATCH</small><p>Configuration follows the backend workflow definition and Facility Catalog.</p></aside> : <section className="ws-panel ws-map"><h2>HOSPITAL FLOOR 1 / MAR-01</h2><div className="ws-map-image"><img src={routeMap} alt="Hospital Floor 1: MAR-01 route from Pharmacy to Room 305" /></div><small>Route preview · Pharmacy → Room 305</small></section>}</div>{details && <footer className="ws-footer">{footer}{action('Back to Workflows', () => navigate('/workflows'))}</footer>}</main></div>;
}
