import { useMemo, useState } from 'react';
import scanLidar from '../../assets/images/map-studio/scan-1.png';
import cleanupLidar from '../../assets/images/map-studio/cleanup-1.png';
import semanticFloorMap from '../../assets/images/map-studio/semantic-1.png';
import endpointFloorMap from '../../assets/images/map-studio/endpoints-1.png';
import trafficFloorMap from '../../assets/images/map-studio/traffic-3.png';
import patrolFloorMap from '../../assets/images/map-studio/routes-1.png';
import simulationFloorMap from '../../assets/images/map-studio/publish-1.png';
import './MapStudioFigma.css';

const workflow = [
  ['scan', 'Scan'], ['cleanup', 'Cleanup'], ['semantic', 'Semantic'], ['endpoints', 'Endpoints'],
  ['traffic', 'Traffic'], ['routes', 'Routes'], ['validate', 'Validate'], ['publish', 'Publish'],
];

const endpointRows = [
  ['#3182f6', 'Pharmacy Pickup', 'Pickup  •  EP-01'],
  ['#22b8cf', 'Central Lab', 'Pickup  •  EP-02'],
  ['#8b5cf6', 'Room 305', 'Drop-off  •  EP-04'],
  ['#22c55e', 'Reception', 'Escort  •  EP-06'],
  ['#22c55e', 'Charging Station', 'Charge  •  EP-08'],
  ['#f5b73d', 'Waiting Hall', 'Waiting  •  EP-09'],
  ['#f05252', 'Emergency Point', 'Emergency  •  EP-10'],
];

const validationRows = [
  ['Map origin configured', 'pass'], ['Home endpoint configured', 'pass'], ['Charger reachable', 'pass'],
  ['All destinations reachable', 'pass'], ['No waypoint inside restricted zone', 'pass'],
  ['Lane LN-12 disconnected', 'warning'], ['Room 305 too close to wall', 'warning'], ['No critical validation errors', 'pass'],
];

function Button({ children, tone = 'secondary', className = '', onClick, type = 'button' }) {
  return <button type={type} onClick={onClick} className={`map-figma-button ${tone} ${className}`}>{children}</button>;
}

function WorkflowBar({ stage, onStageChange }) {
  return <div className="map-workflow" aria-label="Map Studio workflow">
    <p>MAP STUDIO WORKFLOW <span>•</span> Hospital Floor 1 <span>•</span> v1.5 Draft</p>
    <div>{workflow.map(([id, label], index) => <button type="button" key={id} onClick={() => onStageChange(id)} className={stage === id ? 'active' : ''}>{index + 1} {label}</button>)}</div>
  </div>;
}

function StageTitle({ title, children }) {
  return <header className="map-stage-header"><h2>{title}</h2><div>{children}</div></header>;
}

function LabelledValue({ label, value, className = '' }) {
  return <label className={`map-labelled-value ${className}`}><span>{label}</span><div>{value}</div></label>;
}

function StatusPair({ label, value, good = false }) {
  return <p className="map-status-pair"><span>{label}</span><b className={good ? 'good' : ''}>{value}</b></p>;
}

function MapImage({ src, alt, className = '' }) {
  return <div className={`map-image-frame ${className}`}><img src={src} alt={alt} /></div>;
}

function Panel({ title, children, className = '' }) {
  return <section className={`map-panel ${className}`}><h3>{title}</h3>{children}</section>;
}

function ScanStage({ setStage }) {
  const [paused, setPaused] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  return <>
    <StageTitle title="Map Studio — Scan & SLAM">
      <Button onClick={() => setPaused(!paused)}>{paused ? 'Resume Mapping' : 'Pause Mapping'}</Button>
      <Button tone="primary" onClick={() => setStage('cleanup')}>Finish Mapping</Button>
    </StageTitle>
    <div className="map-stage-layout scan-layout">
      <Panel title="Live LiDAR occupancy map" className="map-lidar-panel"><MapImage src={scanLidar} alt="Live LiDAR occupancy scan of Hospital Floor 1" /></Panel>
      <aside className="map-side-stack">
        <Panel title="Mapping status" className="mapping-status"><strong className={paused ? 'warning-text' : 'recording'}>● {paused ? 'PAUSED' : 'RECORDING'}</strong><StatusPair label="Elapsed" value="08:42" /><StatusPair label="Mapped Area" value="418 m²" /><StatusPair label="LiDAR" value="Healthy" good /><StatusPair label="Localization" value="Good" good /><StatusPair label="Loop Closure" value="Detected" good /><StatusPair label="Resolution" value="0.05 m" /><Button>Manual Drive</Button><Button>Set Robot Pose</Button></Panel>
        <Panel title="Mapping checklist" className="mapping-checklist">{['LiDAR online', 'Drive slowly', 'Close mapping loop', 'Scan all corridors', 'Avoid moving crowds'].map(item => <p key={item}>✓ <span>{item}</span></p>)}<Button tone="danger" onClick={() => setDiscarded(true)}>{discarded ? 'Session discarded' : 'Discard Session'}</Button></Panel>
      </aside>
    </div>
  </>;
}

function CleanupStage({ setStage }) {
  const tools = ['Select', 'Erase Noise', 'Restore', 'Draw Wall', 'Remove Wall', 'Fill Free Space', 'Crop', 'Rotate', 'Set Origin', 'Selective Remap'];
  const [tool, setTool] = useState('Selective Remap');
  const [remapping, setRemapping] = useState(false);
  return <>
    <StageTitle title="Map Studio — Cleanup & Remap"><Button onClick={() => setTool('Select')}>Undo</Button><Button tone="primary" onClick={() => setStage('semantic')}>Continue Setup</Button></StageTitle>
    <div className="map-stage-layout cleanup-layout">
      <Panel title="Cleanup tools" className="map-tool-panel">{tools.map(name => <button type="button" onClick={() => setTool(name)} className={tool === name ? 'selected' : ''} key={name}>{name}</button>)}</Panel>
      <Panel title="Occupancy map cleanup" className="map-lidar-panel cleanup-map"><MapImage src={cleanupLidar} alt="Occupancy map ready for cleanup" /></Panel>
      <aside className="map-side-stack">
        <Panel title="Selective remap" className="remap-panel"><span>Selected Region</span><strong>42.8 m²</strong><p>Use selective remapping when a small area changed and the full facility does not need re-scanning.</p><small>Robot</small><b className="good">MAR-01 · Online</b><small>Region confidence</small><div className="mini-progress"><i /></div><Button tone="primary" onClick={() => setRemapping(!remapping)}>{remapping ? 'Remapping…' : 'Start Selective Remap'}</Button></Panel>
        <Panel title="Map quality" className="map-quality"><StatusPair label="Noise remaining" value="12 points" /><StatusPair label="Disconnected walls" value="0" good /><StatusPair label="Unknown areas" value="2" /><span>Overall Quality</span><strong className="good">94%</strong><Button>Auto Detect Noise</Button></Panel>
      </aside>
    </div>
  </>;
}

function SemanticStage({ setStage }) {
  const objects = ['Select / Pan', 'Room', 'Door', 'Elevator', 'Stairs', 'POI / Location', 'Waiting Area', 'Restricted Facility', 'Label / Annotation', 'Measure'];
  const [object, setObject] = useState('Room');
  const [saved, setSaved] = useState(false);
  return <>
    <StageTitle title="Map Studio — Semantic Setup" />
    <div className="map-stage-layout semantic-layout">
      <Panel title="Semantic objects" className="map-tool-panel">{objects.map(name => <button type="button" onClick={() => setObject(name)} className={object === name ? 'selected' : ''} key={name}>{name}</button>)}</Panel>
      <MapImage src={semanticFloorMap} alt="Semantic floor map of Hospital Floor 1" className="semantic-map" />
      <Panel title="Room properties" className="property-panel"><LabelledValue label="Name" value="Pharmacy" /><LabelledValue label="Display Name" value="Pharmacy" /><LabelledValue label="Category" value="Pharmacy" /><LabelledValue label="Floor" value="Floor 1" /><LabelledValue label="Access" value="Staff + Patient" /><LabelledValue label="Navigation POI" value="Enabled" /><small>Door links</small><b className="good">Door-07 → Main Corridor</b><small>Semantic layers</small><b className="good">✓ Room  ✓ Door  ✓ POI / Labels</b><Button tone="primary" onClick={() => setSaved(true)}>{saved ? 'Room saved' : 'Save Room'}</Button><div className="two-buttons"><Button>Add Door</Button><Button>Add POI</Button></div><Button tone="primary" onClick={() => setStage('endpoints')}>Continue to Endpoints</Button></Panel>
    </div>
  </>;
}

function EndpointsStage({ setStage }) {
  const [selected, setSelected] = useState(endpointRows[2]);
  const [notice, setNotice] = useState('');
  return <>
    <StageTitle title="Map Studio — Endpoints"><Button tone="primary" onClick={() => setNotice('Endpoint creation is ready')}>+ Add Endpoint</Button></StageTitle>
    <div className="map-stage-layout endpoint-layout">
      <Panel title="Locations" className="endpoint-list"><input aria-label="Search locations" placeholder="Search locations…" />{endpointRows.map(item => <button type="button" key={item[1]} className={selected[1] === item[1] ? 'selected' : ''} onClick={() => setSelected(item)}><i style={{ background: item[0] }} /><b>{item[1]}</b><span>{item[2]}</span></button>)}</Panel>
      <div className="endpoint-map-column"><Panel title="2D location map"><MapImage src={endpointFloorMap} alt="Hospital floor endpoints map" /></Panel><Panel title="Endpoint usage" className="endpoint-usage"><p>Used by 8 mission templates</p><span>• Medication Delivery</span><span>• Patient Escort</span><span>• Emergency Response</span><Button onClick={() => setNotice('Dependencies opened')}>View Dependencies</Button></Panel></div>
      <Panel title="Endpoint details" className="endpoint-details"><h4>{selected[1]}</h4><em>{selected[2]}</em>{[['Floor', 'Level 1'], ['Coordinates', 'X 42.15 • Y 18.67'], ['Orientation', '90°'], ['Arrival Radius', '0.25 m'], ['Queueing', 'Enabled'], ['Max Queue', '2'], ['Exit Path', 'Shortest'], ['Access', 'Staff + Patient'], ['Connected Lanes', '3']].map(([label, value]) => <StatusPair key={label} label={label} value={value} />)}<Button tone="primary" onClick={() => setNotice('Endpoint edit mode enabled')}>Edit Endpoint</Button><Button>Test Navigation</Button><Button>Duplicate</Button><Button>Disable</Button><Button tone="danger" onClick={() => setNotice('Delete requires confirmation')}>Delete</Button>{notice && <p className="map-notice">{notice}</p>}<Button tone="primary" onClick={() => setStage('traffic')}>Continue to Traffic</Button></Panel>
    </div>
  </>;
}

function TrafficStage({ setStage }) {
  const objects = ['Lane', 'One-way Lane', 'Speed Zone', 'Restricted Zone', 'Preferred Direction', 'Narrow Corridor', 'Single Robot Zone', 'No Replan Zone', 'Occupancy Zone', 'Stop Line', 'Yield Line'];
  const [object, setObject] = useState('Speed Zone');
  const [valid, setValid] = useState(false);
  return <>
    <StageTitle title="Map Studio — Traffic Graph" />
    <div className="map-stage-layout traffic-layout">
      <Panel title="Traffic objects" className="traffic-tools">{objects.map(name => <button type="button" key={name} className={object === name ? 'selected' : ''} onClick={() => setObject(name)}><i />{name}</button>)}</Panel>
      <MapImage src={trafficFloorMap} alt="Route graph and traffic overlay" className="traffic-map" />
      <Panel title="Speed zone properties" className="property-panel"><LabelledValue label="Name" value="Waiting Hall Slow" /><LabelledValue label="Max speed" value="0.25 m/s" /><LabelledValue label="Applies to" value="MAR-01" /><LabelledValue label="Active schedule" value="Always" /><LabelledValue label="Planner behavior" value="Allow" /><LabelledValue label="Priority" value="Safety" /><LabelledValue label="Crowd override" value="0.15 m/s" /><small>Conflict check</small><b className="good">✓ No overlapping rule conflict</b><Button tone="primary">Save Rule</Button><Button>Add Stop / Yield</Button><Button tone="primary" onClick={() => setValid(true)}>{valid ? 'Traffic valid' : 'Validate Traffic'}</Button><Button tone="primary" onClick={() => setStage('routes')}>Continue to Routes</Button></Panel>
    </div>
  </>;
}

function RoutesStage({ setStage }) {
  const [route, setRoute] = useState('Outpatient Loop');
  return <>
    <StageTitle title="Map Studio — Routes & Patrol"><Button onClick={() => setRoute('Outpatient Loop')}>Save Patrol</Button><Button tone="primary">Run Patrol Now</Button></StageTitle>
    <div className="map-stage-layout routes-layout">
      <Panel title="Patrol settings" className="patrol-settings"><LabelledValue label="Route Name" value="Outpatient Night Patrol" /><LabelledValue label="Route Type" value="Loop" /><h4>Schedule</h4>{[['Start', '20:00'], ['End', '06:00'], ['Repeat', 'Every 30 min'], ['Days', 'Mon–Sun']].map(([label, value]) => <StatusPair key={label} label={label} value={value} />)}<h4>Patrol behavior</h4>{['Pause on obstacle', 'Capture image at P2', 'Crowd scan at P3', 'Check restricted area P4', 'Return home when complete'].map(item => <p className="map-check" key={item}>✓ <span>{item}</span></p>)}<Button>Test Route</Button><Button tone="danger">Disable Patrol</Button></Panel>
      <div className="routes-map-column"><Panel title="Patrol map"><MapImage src={patrolFloorMap} alt="Outpatient Night Patrol route map" /></Panel><Panel title="Patrol point action" className="point-action"><h4>P9 — Waiting Hall</h4><b>Action: Crowd Scan</b><p>Wait 8 sec · Capture snapshot if density HIGH</p><Button onClick={() => setRoute('P9 edited')}>Edit Point Action</Button></Panel></div>
      <Panel title="Patrol routes" className="route-list">{[['Main Corridor Patrol', '8 pts', 'Active'], ['Outpatient Loop', '7 pts', 'Active'], ['Emergency Sweep', '12 pts', 'Paused']].map(([name, points, status]) => <button type="button" onClick={() => setRoute(name)} key={name} className={route === name ? 'selected' : ''}><b>{name}</b><span>{points}</span><em className={status === 'Active' ? 'good' : 'warning-text'}>{status}</em></button>)}<small>Next run</small><h4>Today 20:00</h4><p>Estimated duration 14m</p><Button>Preview Timeline</Button><Button tone="primary" onClick={() => setStage('validate')}>Validate Routes</Button></Panel>
    </div>
  </>;
}

function ValidateStage({ setStage }) {
  const [focused, setFocused] = useState('');
  return <>
    <StageTitle title="Map Studio — Validate & Versions"><Button>Run Validation</Button><Button tone="primary" onClick={() => setStage('publish')}>Publish v1.5</Button></StageTitle>
    <div className="map-stage-layout validate-layout">
      <Panel title="Map validation" className="validation-panel"><h4>Hospital Floor 1 • Draft v1.5</h4><div className="validation-score"><span>Validation Score</span><strong>92%</strong></div>{validationRows.map(([label, status]) => <button type="button" onClick={() => setFocused(label)} key={label} className={`validation-row ${status}`}><i>{status === 'pass' ? '●' : '▲'}</i><span>{label}</span><b>{status.toUpperCase()}</b></button>)}<div className="three-buttons"><Button onClick={() => setFocused('Lane LN-12 disconnected')}>Focus Warning</Button><Button>Ignore Warning</Button><Button tone="primary">Revalidate</Button></div>{focused && <p className="map-notice">Reviewing: {focused}</p>}</Panel>
      <aside className="map-side-stack versions-stack"><Panel title="Map versions" className="version-list">{[['v1.5', 'Draft', 'Today 10:32'], ['v1.4', 'Active', 'Aug 23 16:40'], ['v1.3', 'Archived', 'Aug 21 11:12'], ['v1.2', 'Archived', 'Aug 18 09:15']].map(([version,status,date], index) => <button type="button" key={version} className={index === 1 ? 'current' : ''}><b>{version}</b><em>{status}</em><span>{date}</span></button>)}</Panel><Panel title="Publish checklist" className="publish-checklist">{['Robot MAR-01 is idle', 'Validation completed', 'No critical errors', 'Charger configured', 'Home endpoint configured', 'Rollback version available'].map(item => <p key={item}>✓ <span>{item}</span></p>)}<em>Publishing makes v1.5 the active navigation map.</em><Button>Preview Changes</Button><Button tone="primary" onClick={() => setStage('publish')}>Publish Map</Button></Panel></aside>
    </div>
  </>;
}

function PublishStage() {
  const [calculated, setCalculated] = useState(false);
  const [published, setPublished] = useState(false);
  return <>
    <StageTitle title="Map Studio — Test & Publish" />
    <div className="map-stage-layout publish-layout">
      <Panel title="Route test" className="route-test-panel"><LabelledValue label="From" value="Pharmacy Pickup" /><LabelledValue label="To" value="Room 305" /><LabelledValue label="Route policy" value="Safest" /><LabelledValue label="Avoid crowds" value="Enabled" /><LabelledValue label="Blocked timeout" value="20 sec" /><LabelledValue label="Auto replan" value="Enabled" /><Button tone="primary" onClick={() => setCalculated(true)}>{calculated ? 'Route calculated' : 'Calculate Route'}</Button><div className="route-metrics"><div><span>Distance</span><strong>128.4 m</strong></div><div><span>ETA</span><strong>2m 11s</strong></div><div><span>Battery est.</span><strong className="good">2.8%</strong></div><div><span>Zones crossed</span><b className="warning-text">1 slow zone</b></div></div><div className="two-buttons"><Button>Run Simulation</Button><Button>Send Robot Test</Button></div></Panel>
      <Panel title="Simulation preview" className="simulation-panel"><MapImage src={simulationFloorMap} alt="Route simulation between pharmacy and Room 305" /><label>Simulation timeline</label><div className="timeline-progress"><i /></div><div className="timeline-times"><span>00:00</span><span>Obstacle replan</span><span>02:11</span></div><p className="good">✓ Route reachable · Charger reachable · No restricted-zone violation</p></Panel>
      <Panel title="Validation" className="publish-validation">{['Map origin configured', 'Home configured', 'Charger configured', 'All endpoints reachable', 'No endpoint in restricted zone', 'Lane connectivity', 'Wall clearance', 'Traffic conflicts'].map((item,index) => <p className={index === 5 || index === 6 ? 'warning-text' : 'good'} key={item}>{index === 5 || index === 6 ? '▲' : '✓'} <span>{item}</span></p>)}<div className="warning-callout"><b>2 warnings</b><span>LN-12 disconnected · EP-09 wall clearance</span></div><Button>Focus Warning</Button><Button tone="primary">Re-run Validation</Button><div className="ready-callout"><small>READY TO PUBLISH</small><b>v1.5 → v1.6</b></div><Button tone="primary" onClick={() => setPublished(true)}>{published ? 'Map v1.6 published' : 'Publish Map v1.6'}</Button></Panel>
    </div>
  </>;
}

const stageComponents = { scan: ScanStage, cleanup: CleanupStage, semantic: SemanticStage, endpoints: EndpointsStage, traffic: TrafficStage, routes: RoutesStage, validate: ValidateStage, publish: PublishStage };

/**
 * Self-contained Figma implementation for the eight Map Studio screens.
 * Pass initialStage to open a particular screen, or leave it unset for Scan & SLAM.
 */
export default function MapStudioFigma({ initialStage = 'scan' }) {
  const permittedStage = useMemo(() => workflow.some(([id]) => id === initialStage) ? initialStage : 'scan', [initialStage]);
  const [stage, setStage] = useState(permittedStage);
  const Stage = stageComponents[stage];
  return <section className="map-studio-figma"><WorkflowBar stage={stage} onStageChange={setStage} /><Stage setStage={setStage} /></section>;
}

export { workflow };
