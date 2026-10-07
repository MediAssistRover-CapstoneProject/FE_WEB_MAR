import { injectStyles } from '../../styles/injectStyles.js';
const inlineStyles = String.raw`.map-studio-figma{--ink:#0f172a;--slate:#475569;--line:#cbd5e1;--cloud:#f1f5f9;--blue:#2f80ff;--blue-dark:#1d4ed8;--pale:#dbeafe;--good:#15803d;--warn:#a16207;--danger:#f05252;color:var(--ink);font-family:Inter,Arial,sans-serif;min-width:0}.map-studio-figma *{box-sizing:border-box}.map-studio-figma button,.map-studio-figma input{font:inherit}.map-stage-header{height:64px;margin:-24px -28px 8px;padding:0 38px;background:#fff;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f1f5f9}.map-stage-header h2{font-size:22px;line-height:1.2;margin:0;font-weight:600}.map-stage-header>div{display:flex;align-items:center;gap:10px}.map-figma-button{height:36px;min-width:110px;border:1px solid var(--line);border-radius:7px;padding:0 14px;background:var(--cloud);color:var(--ink);font-size:13px;font-weight:600;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}.map-figma-button:hover{transform:translateY(-1px);box-shadow:0 4px 12px #0f172a15}.map-figma-button.primary{background:var(--blue);border-color:var(--blue);color:#fff}.map-figma-button.danger{background:var(--danger);border-color:var(--danger);color:#fff}.map-workflow{height:48px;margin:0 0 10px;border:1px solid var(--line);border-radius:8px;padding:5px 8px 5px;position:relative;background:#fff}.map-workflow p{position:absolute;left:50%;top:-14px;transform:translateX(-50%);margin:0;color:var(--slate);font-size:9px;white-space:nowrap;background:#f7f9fc;padding:0 6px}.map-workflow p span{padding:0 5px}.map-workflow>div{display:grid;grid-template-columns:repeat(8,minmax(70px,1fr));gap:6px}.map-workflow button{height:24px;border-radius:6px;border:1px solid var(--line);background:var(--cloud);color:var(--slate);font-size:10px;text-align:left;padding:0 10px;cursor:pointer}.map-workflow button.active{border-color:var(--blue);background:var(--blue);color:#fff;font-weight:600}.map-stage-layout{display:grid;gap:16px;align-items:start}.map-panel{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-width:0}.map-panel>h3{margin:0 0 12px;color:var(--slate);font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.15px}.map-image-frame{overflow:hidden;border:1px solid #c7d0d8;border-radius:8px;background:#e9eef5;min-width:0}.map-image-frame img{display:block;width:100%;height:100%;object-fit:cover}.map-side-stack{display:grid;gap:16px}.map-labelled-value{display:block;margin-bottom:11px}.map-labelled-value>span,.map-panel small,.route-test-panel label,.simulation-panel>label{display:block;margin-bottom:5px;color:var(--slate);font-size:9px;font-weight:500}.map-labelled-value>div{height:34px;border:1px solid var(--line);border-radius:6px;background:var(--cloud);padding:10px 11px;font-size:10px;font-weight:500;color:var(--ink)}.map-status-pair{margin:0;padding:9px 2px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px}.map-status-pair span{color:var(--slate)}.map-status-pair b{font-size:11px;font-weight:500;color:var(--ink)}.good{color:var(--good)!important}.warning-text{color:var(--warn)!important}.map-notice{margin:10px 0 0;padding:7px 9px;border-radius:5px;background:#eff6ff;color:var(--blue-dark);font-size:10px}.scan-layout{grid-template-columns:minmax(0,1fr) 246px}.map-lidar-panel{height:782px}.map-lidar-panel .map-image-frame{height:662px;margin:42px 18px 0}.mapping-status{min-height:430px}.mapping-status .recording{display:block;color:var(--good);font-size:13px;margin:0 0 16px}.mapping-status .warning-text{display:block;font-size:13px;margin:0 0 16px}.mapping-status>.map-figma-button{width:100%;margin-top:12px}.mapping-checklist{min-height:220px}.mapping-checklist p,.publish-checklist p{margin:0;padding:8px 2px;color:var(--good);font-size:12px;font-weight:600}.mapping-checklist p span,.publish-checklist p span{padding-left:10px;color:var(--ink);font-weight:400;font-size:10px}.mapping-checklist .map-figma-button{width:100%;margin-top:20px}.cleanup-layout{grid-template-columns:158px minmax(0,1fr) 246px}.map-tool-panel{height:782px;padding:14px 12px}.map-tool-panel button{display:block;width:100%;height:30px;border:0;border-radius:6px;background:transparent;color:var(--slate);padding:0 16px;text-align:left;font-size:11px;cursor:pointer}.map-tool-panel button:hover,.map-tool-panel button.selected{color:var(--blue-dark);background:var(--pale);font-weight:600}.cleanup-map .map-image-frame{height:630px;margin:42px 0 0}.remap-panel{min-height:218px}.remap-panel>span,.map-quality>span{display:block;color:var(--slate);font-size:10px;margin:6px 0}.remap-panel>strong{display:block;font-size:22px;margin-bottom:10px}.remap-panel p{color:var(--slate);font-size:10px;line-height:1.4;margin:8px 0 12px}.remap-panel small{margin-top:10px}.remap-panel>b{display:block;font-size:10px;margin-top:-2px}.mini-progress{height:7px;margin:5px 0 12px;border-radius:99px;background:#e2e8f0;overflow:hidden}.mini-progress i{display:block;width:78%;height:100%;background:var(--blue);border-radius:inherit}.remap-panel .map-figma-button,.map-quality .map-figma-button{width:100%;margin-top:12px}.map-quality{min-height:210px}.map-quality>strong{display:block;font-size:20px;margin:2px 0}.semantic-layout,.traffic-layout{grid-template-columns:208px minmax(0,1fr) 276px}.semantic-map,.traffic-map{height:782px}.property-panel{min-height:782px}.property-panel small{margin-top:13px}.property-panel>b{display:block;font-size:10px;margin:0 0 8px}.property-panel>.map-figma-button{width:100%;margin-top:4px}.two-buttons{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.two-buttons .map-figma-button{min-width:0;padding:0 8px}.endpoint-layout{grid-template-columns:340px minmax(0,1fr) 276px}.endpoint-list{height:782px}.endpoint-list input{display:block;width:100%;height:36px;border:1px solid var(--line);border-radius:7px;padding:0 14px;background:var(--cloud);color:var(--ink);font-size:12px;margin:6px 0 18px}.endpoint-list button,.route-list button{position:relative;width:100%;min-height:74px;border:1px solid var(--line);border-radius:7px;background:var(--cloud);margin:0 0 12px;padding:13px 14px 10px 40px;text-align:left;cursor:pointer}.endpoint-list button.selected,.route-list button.selected{background:var(--pale);border-color:var(--line)}.endpoint-list button>i{position:absolute;left:14px;top:24px;width:10px;height:10px;border-radius:50%}.endpoint-list button b,.endpoint-list button span{display:block}.endpoint-list button b{font-size:12px;margin-bottom:5px}.endpoint-list button span{color:var(--slate);font-size:10px}.endpoint-map-column{display:grid;gap:4px}.endpoint-map-column .map-panel{padding:14px 0 0}.endpoint-map-column .map-panel>h3{padding:0 16px}.endpoint-map-column .map-image-frame{height:383px;border-radius:0 0 8px 8px}.endpoint-usage{min-height:150px;padding:14px 14px}.endpoint-usage p{font-size:10px;margin:0 0 10px}.endpoint-usage span{display:block;font-size:9px;color:var(--slate);margin:7px 0}.endpoint-usage .map-figma-button{float:right;margin-top:-44px}.endpoint-details{height:782px}.endpoint-details h4{font-size:16px;margin:0 0 3px}.endpoint-details em{display:block;color:#7c3aed;font-size:9px;font-style:normal;margin-bottom:11px}.endpoint-details .map-status-pair{padding:8px 0;font-size:9px}.endpoint-details .map-figma-button{width:100%;height:29px;margin:4px 0 0;font-size:11px}.traffic-layout{grid-template-columns:214px minmax(0,1fr) 276px}.traffic-tools{height:782px;padding:13px 12px;background:#03172e;border-color:#112a48}.traffic-tools h3{color:#cbd5e1}.traffic-tools button{display:flex;width:100%;align-items:center;gap:10px;height:36px;border:0;border-radius:6px;background:transparent;color:#cad5e3;text-align:left;font-size:11px;cursor:pointer}.traffic-tools button i{width:16px;height:3px;background:#2f80ff;border-radius:5px}.traffic-tools button:nth-of-type(2) i{background:linear-gradient(90deg,#2f80ff 50%,transparent 50%);border-top:2px solid #2f80ff}.traffic-tools button:nth-of-type(3) i{height:13px;border:1px solid #8b5cf6;background:#57438b66}.traffic-tools button:nth-of-type(4) i{height:13px;border:1px solid #f05252;background:#70252c}.traffic-tools button.selected{background:#0e3d88;color:#fff;font-weight:600}.traffic-map{background:#03172e}.routes-layout{grid-template-columns:300px minmax(0,1fr) 186px}.patrol-settings{height:782px}.patrol-settings h4,.route-list h4,.point-action h4,.validation-panel h4{font-size:11px;margin:20px 0 12px}.patrol-settings .map-status-pair{padding:8px 0}.map-check{color:var(--good);font-size:11px;font-weight:600;margin:9px 0}.map-check span{color:var(--ink);font-size:10px;font-weight:400;padding-left:10px}.patrol-settings>.map-figma-button{width:100%;margin-top:8px}.routes-map-column{display:grid;gap:8px}.routes-map-column>.map-panel{padding:14px 14px 12px}.routes-map-column .map-image-frame{height:462px}.point-action{min-height:132px}.point-action h4{margin:0 0 5px}.point-action b{color:#0e7490;font-size:10px}.point-action p{color:var(--slate);font-size:9px;margin:8px 0}.point-action .map-figma-button{float:right;margin-top:-35px}.route-list{height:782px;padding:14px 12px}.route-list button{min-height:56px;margin-bottom:12px;padding:10px 10px}.route-list button b,.route-list button span{display:block}.route-list button b{font-size:11px}.route-list button span{font-size:9px;color:var(--slate);margin-top:4px}.route-list button em{position:absolute;right:10px;bottom:10px;font-size:9px;font-style:normal}.route-list>small{display:block;color:var(--slate);font-size:9px;margin-top:40px}.route-list>h4{font-size:13px;margin:7px 0}.route-list>p{font-size:9px;color:var(--slate)}.route-list>.map-figma-button{width:100%;margin-top:12px;min-width:0;font-size:11px}.validate-layout{grid-template-columns:minmax(0,620px) minmax(300px,374px);justify-content:space-between}.validation-panel{min-height:778px}.validation-panel h4{font-size:15px;margin:4px 0 24px}.validation-score{display:flex;align-items:end;gap:24px;margin:0 0 20px}.validation-score span{font-size:10px;color:var(--slate)}.validation-score strong{font-size:24px;color:var(--good)}.validation-row{width:100%;height:48px;display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:6px;background:var(--cloud);padding:0 14px;margin:9px 0;text-align:left;cursor:pointer}.validation-row i{font-style:normal;font-size:18px}.validation-row.pass i{color:#32ca78}.validation-row.warning i{color:#f5b73d}.validation-row span{font-size:10px;flex:1}.validation-row b{font-size:9px}.validation-row.pass b{color:var(--good)}.validation-row.warning b{color:var(--warn)}.three-buttons{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:18px}.three-buttons .map-figma-button{padding:0 10px;min-width:0;font-size:11px}.versions-stack{grid-template-rows:270px 1fr}.version-list button{display:grid;width:100%;grid-template-columns:56px 1fr auto;align-items:center;height:43px;border:1px solid var(--line);border-radius:5px;background:var(--cloud);padding:0 10px;margin:9px 0;text-align:left}.version-list button.current{background:#d9fbe6;border-color:#a8e2c0}.version-list button b{font-size:11px}.version-list button em{font-style:normal;color:var(--warn);font-size:9px}.version-list button.current em{color:var(--good)}.version-list button span{color:var(--slate);font-size:9px}.publish-checklist p{padding:7px 0}.publish-checklist>em{display:block;color:var(--warn);font-size:9px;font-style:normal;margin:14px 0}.publish-checklist .map-figma-button{width:100%;margin-top:6px}.publish-layout{grid-template-columns:292px minmax(0,1fr) 198px}.route-test-panel{height:782px}.route-test-panel .map-figma-button.primary{width:100%;margin:6px 0 24px}.route-metrics{display:grid;grid-template-columns:1fr 1fr;gap:20px 12px;margin-bottom:22px}.route-metrics span,.route-metrics strong,.route-metrics b{display:block}.route-metrics span{font-size:9px;color:var(--slate);margin-bottom:7px}.route-metrics strong{font-size:17px}.route-metrics b{font-size:10px}.simulation-panel{height:782px;background:#f8fafc}.simulation-panel .map-image-frame{height:410px}.simulation-panel>label{margin:19px 0 9px}.timeline-progress{height:8px;border-radius:99px;background:#e2e8f0;overflow:hidden}.timeline-progress i{display:block;width:65%;height:100%;background:var(--blue);border-radius:inherit}.timeline-times{display:flex;justify-content:space-between;margin:7px 0 17px;color:var(--slate);font-size:9px}.timeline-times span:nth-child(2){color:var(--warn)}.simulation-panel>p{font-size:9px}.publish-validation{height:782px}.publish-validation p{color:var(--good);font-size:10px;margin:15px 0}.publish-validation p span{color:var(--ink);padding-left:10px}.warning-callout,.ready-callout{padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--cloud);display:grid;gap:3px;margin:22px 0 10px}.warning-callout b{color:var(--warn);font-size:12px}.warning-callout span,.ready-callout small{font-size:9px;color:var(--slate)}.publish-validation>.map-figma-button{width:100%;min-width:0;margin:6px 0;font-size:11px}.ready-callout{border-color:#4ade80;background:#f0fdf4;margin-top:14px}.ready-callout b{font-size:11px}.map-stage-header:has(+ .map-stage-layout){margin-bottom:8px}@media(max-width:1220px){.scan-layout{grid-template-columns:minmax(0,1fr) 220px}.endpoint-layout{grid-template-columns:280px minmax(0,1fr) 230px}.routes-layout{grid-template-columns:250px minmax(0,1fr) 168px}.map-stage-header{margin-left:-16px;margin-right:-16px;padding:0 24px}.map-workflow>div{overflow-x:auto}.map-workflow{overflow:hidden}.map-workflow>div{min-width:860px}.semantic-layout,.traffic-layout{grid-template-columns:175px minmax(0,1fr) 240px}}@media(max-width:980px){.map-stage-header{height:auto;min-height:64px;gap:10px;padding:12px 16px;align-items:flex-start}.map-stage-header h2{font-size:18px}.map-stage-header>div{flex-wrap:wrap;justify-content:flex-end}.map-stage-layout,.scan-layout,.cleanup-layout,.semantic-layout,.traffic-layout,.endpoint-layout,.routes-layout,.validate-layout,.publish-layout{grid-template-columns:1fr}.map-panel,.map-tool-panel,.map-lidar-panel,.property-panel,.endpoint-list,.endpoint-details,.traffic-tools,.patrol-settings,.route-list,.validation-panel,.route-test-panel,.simulation-panel,.publish-validation{height:auto;min-height:0}.map-lidar-panel .map-image-frame{height:min(65vw,600px);margin:15px 0 0}.cleanup-map .map-image-frame{height:min(65vw,600px)}.semantic-map,.traffic-map{height:min(75vw,700px)}.endpoint-map-column .map-image-frame,.routes-map-column .map-image-frame,.simulation-panel .map-image-frame{height:min(62vw,500px)}.map-side-stack{grid-template-columns:1fr 1fr}.versions-stack{grid-template-columns:1fr 1fr;grid-template-rows:none}.endpoint-map-column{order:2}.endpoint-details{order:3}.route-list{order:3}}@media(max-width:620px){.map-stage-header{margin-top:-16px}.map-stage-header>div{width:100%}.map-figma-button{flex:1;min-width:0;padding:0 8px;font-size:11px}.map-workflow{height:42px}.map-workflow p{display:none}.map-workflow>div{padding-top:4px}.map-side-stack,.versions-stack{grid-template-columns:1fr}.map-panel{padding:12px}.three-buttons{grid-template-columns:1fr}.endpoint-list button{min-height:60px}.map-stage-header h2{font-size:16px}.point-action .map-figma-button{float:none;margin:8px 0 0}.endpoint-usage .map-figma-button{float:none;margin:10px 0 0}}
`;
injectStyles('mediassist-style-pages-Admin-MapStudioFigma-jsx', inlineStyles);

import { useEffect, useMemo, useState } from 'react';
import scanLidar from '../../assets/images/map-studio/scan-1.png';
import cleanupLidar from '../../assets/images/map-studio/cleanup-1.png';
import semanticFloorMap from '../../assets/images/map-studio/semantic-1.png';
import endpointFloorMap from '../../assets/images/map-studio/endpoints-1.png';
import trafficFloorMap from '../../assets/images/map-studio/traffic-3.png';
import patrolFloorMap from '../../assets/images/map-studio/routes-1.png';
import simulationFloorMap from '../../assets/images/map-studio/publish-1.png';
import { facilityApi } from '../../features/facility/facilityApi.js';

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
        <Panel title="Mapping status" className="mapping-status"><strong className={paused ? 'warning-text' : 'recording'}>● {paused ? 'PAUSED' : 'RECORDING'}</strong><StatusPair label="Elapsed" value="08:42" /><StatusPair label="Mapped Area" value="418 m²" /><StatusPair label="LiDAR" value="Healthy" good /><StatusPair label="Localization" value="Good" good /><StatusPair label="Loop Closure" value="Detected" good /><StatusPair label="Resolution" value="0.05 m" /><Button>Run route simulation</Button><Button>Set Robot Pose</Button></Panel>
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

function EndpointsStage({ setStage, catalog }) {
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState('');
  const endpoints = catalog.endpoints;
  const selected = endpoints.find((item) => item.endpointId === selectedId) ?? endpoints[0] ?? null;
  const endpointColor = (item) => ({ PICKUP: '#3182f6', DROPOFF: '#8b5cf6', ESCORT: '#22c55e', CHARGING: '#22c55e', EMERGENCY: '#f05252' }[item?.endpointType] ?? '#f5b73d');
  const map = catalog.maps.find((item) => item.mapId === selected?.mapId);
  return <>
    <StageTitle title="Map Studio — Endpoints"><Button tone="primary" onClick={() => setNotice('Endpoint creation requires map coordinates and a catalog entry.')}>+ Add Endpoint</Button></StageTitle>
    <div className="map-stage-layout endpoint-layout">
      <Panel title="Locations" className="endpoint-list"><input aria-label="Search locations" placeholder="Search locations…" />{catalog.loading && <p className="map-notice">Loading endpoint catalog…</p>}{catalog.error && <p className="map-notice">{catalog.error}</p>}{endpoints.map((item) => <button type="button" key={item.endpointId} className={selected?.endpointId === item.endpointId ? 'selected' : ''} onClick={() => setSelectedId(item.endpointId)}><i style={{ background: endpointColor(item) }} /><b>{item.endpointName}</b><span>{item.endpointType} · {item.endpointCode}</span></button>)}{!catalog.loading && !catalog.error && endpoints.length === 0 && <p className="map-notice">No catalog endpoints are available.</p>}</Panel>
      <div className="endpoint-map-column"><Panel title="2D location map"><MapImage src={endpointFloorMap} alt="Hospital floor endpoints map" /></Panel><Panel title="Endpoint usage" className="endpoint-usage"><p>Used by 8 mission templates</p><span>• Medication Delivery</span><span>• Patient Escort</span><span>• Emergency Response</span><Button onClick={() => setNotice('Dependencies opened')}>View Dependencies</Button></Panel></div>
      <Panel title="Endpoint details" className="endpoint-details"><h4>{selected?.endpointName ?? 'Select an endpoint'}</h4><em>{selected ? `${selected.endpointType} · ${selected.endpointCode}` : 'No selection'}</em>{selected && [['Map', map?.mapName ?? String(selected.mapId).slice(0, 8)], ['Coordinates', `X ${selected.xM ?? '—'} · Y ${selected.yM ?? '—'}`], ['Orientation', `${selected.yawRad ?? '—'} rad`], ['Accessible', selected.accessible ? 'Yes' : 'No'], ['Public', selected.publicVisible ? 'Yes' : 'No'], ['Status', selected.active ? 'Active' : 'Inactive'], ['Room', selected.roomId ? String(selected.roomId).slice(0, 8) : '—'], ['Zone', selected.zoneId ? String(selected.zoneId).slice(0, 8) : '—']].map(([label, value]) => <StatusPair key={label} label={label} value={value} />)}<Button tone="primary" onClick={() => setNotice('Endpoint editing is backed by PUT /api/v1/endpoints/{id}.')}>Edit Endpoint</Button><Button onClick={() => setNotice('Navigation test requires a service request.')}>Test Navigation</Button><Button onClick={() => setNotice('Endpoint duplication is not exposed by the backend.')}>Duplicate</Button><Button onClick={() => setNotice('Use deactivate instead of deleting catalog endpoints.')}>Deactivate</Button>{notice && <p className="map-notice">{notice}</p>}<Button tone="primary" onClick={() => setStage('traffic')}>Continue to Traffic</Button></Panel>
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
  const [catalog, setCatalog] = useState({ endpoints: [], maps: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    Promise.all([facilityApi.listEndpoints({ page: 0, size: 100 }), facilityApi.listMaps({ page: 0, size: 100 })]).then(([endpointPage, mapPage]) => {
      if (active) setCatalog({ endpoints: endpointPage.content ?? [], maps: mapPage.content ?? [], loading: false, error: '' });
    }).catch((error) => { if (active) setCatalog({ endpoints: [], maps: [], loading: false, error: error.message || 'Unable to load the facility catalog.' }); });
    return () => { active = false; };
  }, []);
  const Stage = stageComponents[stage];
  return <section className="map-studio-figma"><WorkflowBar stage={stage} onStageChange={setStage} /><Stage setStage={setStage} catalog={catalog} /></section>;
}

export { workflow };
