import { vi } from '../../i18n/vi.js';
import WorkspaceTabs from '../../components/WorkspaceTabs.jsx';
import { injectStyles } from '../../styles/injectStyles.js';
import workflowRouteMap from '../../assets/images/workflow-simulation-route.png';
import simulationRover from '../../assets/images/simulation-rover.png';
const inlineStyles = String.raw`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

.workflows-screen {
  height: 100vh;
  min-width: 0;
  overflow: hidden;
  background: var(--mar-surface, #fff);
  color: var(--mar-text, #0f172a);
  font-family: Inter, Arial, sans-serif;
}

.wf-sidebar {
  position: fixed;
  top: 40px;
  bottom: 9px;
  left: 0;
  width: 220px;
  background: #f8fafc;
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
}

.wf-brand {
  width: 100%;
  height: auto;
  border: 0;
  background: transparent;
  padding: 0 12px 8px;
  color: var(--mar-text, #0f172a);
  cursor: pointer;
  font-size: 20px;
  font-weight: 600;
  text-align: left;
}

.wf-brand span {
  display: block;
  margin-top: 3px;
  color: var(--mar-muted, #475569);
  font-size: 10px;
  font-weight: 500;
}

.wf-sidebar section {
  margin-top: 12px;
}

.wf-sidebar h3 {
  margin: 0 0 3px;
  color: var(--mar-primary, #2f80ff);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.wf-sidebar button {
  width: 200px;
  height: 25px;
  display: block;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--mar-muted, #475569);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  text-align: left;
  padding: 0 10px;
}

.wf-sidebar button.active {
  background: #dbeafe;
  color: var(--mar-primary, #2f80ff);
}

.wf-sidebar-footer {
  margin-top: auto;
  padding: 0 12px;
  color: var(--mar-muted, #475569);
  font-size: 11px;
  line-height: 2.2;
}

.wf-sidebar-footer b {
  display: block;
  color: var(--mar-text, #0f172a);
}

.wf-sidebar-footer i {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0f172a;
}

.workflows-main {
  margin-left: 220px;
  height: 100vh;
  min-width: 0;
  overflow: hidden;
  padding: 44px 28px 24px;
}

.workflows-screen.workflow-page { height: auto; min-height: 100vh; overflow: visible; }
.workflows-screen.workflow-page .workflows-main { height: auto; min-height: 100vh; overflow: visible; }

.workflows-header {
  position: relative;
}

.workflows-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.45;
}

.robot-location {
  position: absolute;
  top: 10px;
  right: 0;
  margin: 0;
  color: var(--mar-muted, #475569);
  font-size: 10px;
  font-weight: 500;
}

.workflow-tabs {
  display: flex;
  gap: 12px;
  margin-top: 29px;
}

.wf-button {
  height: 36px;
  border: 0;
  border-radius: var(--mar-radius, 6px);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 0 16px;
}

.wf-button.primary {
  background: var(--mar-primary, #2f80ff);
  color: var(--mar-surface, #fff);
}

.wf-button.subtle {
  background: #f1f5f9;
  color: var(--mar-text, #0f172a);
}

.tab-button {
  width: 190px;
}

.preview-note {
  margin: 17px 0 0;
  color: var(--mar-muted, #475569);
  font-size: 12px;
}

.workflows-grid {
  display: grid;
  grid-template-columns: minmax(620px, 824px) 320px;
  gap: 20px;
  height: calc(100vh - 230px);
  min-height: 0;
  margin-top: 24px;
}

.workflow-panel {
  height: 100%;
  min-height: 0;
  border: 1px solid var(--mar-border, #cbd5e1);
  border-radius: 10px;
  background: var(--mar-surface, #fff);
  padding: 16px;
}

.workflow-panel h2 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.workflow-list {
  height: auto;
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding-right: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-color: var(--mar-border, #cbd5e1) #fff;
  scrollbar-width: thin;
}

.library-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workflow-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 86px;
  border: 0;
  border-radius: 10px;
  background: #f1f5f9;
  padding: 14px 16px;
  text-align: left;
  color: inherit;
  font: inherit;
}

.workflow-card:hover {
  background: #e8f0ff;
}

.workflow-card-open { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 12px; flex: 1; min-width: 0; border: 0; background: transparent; color: inherit; padding: 0; text-align: left; cursor: pointer; }
.workflow-card-delete { display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 34px; border: 1px solid #dbe4ef; border-radius: 9px; background: #fff; color: #71829b; padding: 0; transition: background .15s, color .15s, border-color .15s; }
.workflow-card-delete:hover { border-color: #f5b6bd; background: #fff5f6; color: #c94a5b; }
.workflow-card-delete:focus-visible,.workflow-card-open:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }

.workflow-card-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  background: #dbeafe;
  color: #2563eb;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .4px;
}

.workflow-card-copy {
  min-width: 0;
}

.workflow-card-copy strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
}

.workflow-card-copy small {
  display: block;
  margin-top: 5px;
  color: var(--mar-muted, #475569);
  font-size: 12px;
  line-height: 1.4;
}

.action-panel p {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.25;
}

.action-panel h2:not(:first-child) {
  margin-top: 12px;
}

.action-panel h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.wf-button.full {
  width: 100%;
  height: 40px;
  margin-bottom: 12px;
}

.wf-button.wide {
  width: 100%;
}

.workflow-editor-grid {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 20px;
  margin-top: 30px;
}

.editor-side,
.editor-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: visible;
}

.editor-detail h3 {
  margin: -4px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.editor-detail h3.large {
  font-size: 18px;
}

.editor-detail p {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
}

.wf-field {
  display: block;
  width: 100%;
}

.wf-field span {
  display: block;
  height: 20px;
  color: var(--mar-muted, #475569);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.45;
}

.wf-field input {
  width: 100%;
  height: 37px;
  border: 1px solid var(--mar-border, #cbd5e1);
  border-radius: 6px;
  background: #f1f5f9;
  color: var(--mar-text, #0f172a);
  font: inherit;
  font-size: 12px;
  padding: 8px 12px;
}

.task-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 32px;
}

.task-heading h2 {
  flex: 1;
  margin: 0;
}

.task-heading button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: #f1f5f9;
  color: var(--mar-text, #0f172a);
  cursor: pointer;
  font: inherit;
}

.editor-side-button {
  width: 100%;
  min-height: 40px;
  border: 0;
  border-radius: 6px;
  background: #f1f5f9;
  color: var(--mar-text, #0f172a);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 0 16px;
}

.editor-side-button.active {
  background: var(--mar-primary, #2f80ff);
  color: #fff;
}

.editor-side-button.small {
  min-height: 32px;
}
.editor-task-item { display: flex; gap: 6px; align-items: stretch; }
.editor-task-item .editor-side-button { flex: 1; text-align: left; padding: 9px 12px; }
.editor-delete-button { flex: 0 0 32px; border: 1px solid #fecaca; background: #fff; color: #b91c1c; padding: 0; }
.editor-delete-button:hover { background: #fef2f2; }
.editor-step-item { display: flex; align-items: stretch; border-top: 1px solid #e5eefc; }
.editor-step-item .step-table-row { flex: 1; min-width: 0; border-top: 0; }
.editor-step-item .editor-delete-button { margin: 8px; }
.workflow-save-error { color: #b91c1c !important; font-size: 12px !important; }
.wf-button:disabled { opacity: .6; cursor: not-allowed; }

.endpoint-heading {
  margin-top: 0 !important;
  font-weight: 400 !important;
}

.step-dropdown {
  width: 100%;
  border: 1px solid var(--mar-border, #cbd5e1);
  border-radius: 6px;
  background: #fff;
  padding: 6px;
}

.step-dropdown button {
  display: block;
  width: 500px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: #fff;
  color: var(--mar-text, #0f172a);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
  padding: 0 16px;
}

.step-dropdown button:hover {
  background: #f1f5f9;
}

.step-row {
  width: 100%;
  color: var(--mar-text, #0f172a);
  font-size: 12px;
  font-weight: 600;
}

.step-row span {
  display: block;
  height: 40px;
  margin-top: 10px;
  border-radius: 6px;
  background: #f1f5f9;
  font-weight: 400;
  line-height: 40px;
  padding: 0 16px;
}

.marker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  width: 100%;
}

.sensor-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  font-size: 12px;
}

.sensor-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--mar-primary, #2f80ff);
}

.workflow-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  position: sticky;
  bottom: 0;
  z-index: 5;
  padding: 12px 0;
  background: #fff;
}

.workflow-actions .create {
  width: 270px;
}

.workflow-actions .back {
  width: 210px;
}

.workflow-actions p {
  margin: 0;
  color: var(--mar-muted, #475569);
  font-size: 10px;
  font-weight: 500;
}

.simulation-studio {
  display: grid;
  grid-template-columns: 250px minmax(480px, 1fr) 300px;
  height: calc(100vh - 185px);
  min-height: 560px;
  margin-top: 22px;
  overflow: hidden;
  border: 1px solid #d7e4fb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(57, 111, 210, .08);
}
.simulation-studio > * { min-width: 0; }
.sim-library, .sim-inspector { display: flex; min-height: 0; flex-direction: column; padding: clamp(11px, 1.7vh, 18px); overflow: hidden; background: #fbfdff; }
.sim-library { border-right: 1px solid #dce7fb; }
.sim-inspector { border-left: 1px solid #dce7fb; }
.sim-kicker { margin: 0 0 6px; color: #477cf4; font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
.sim-library h2, .sim-inspector h2 { margin: 0; color: #193b70; font-size: 15px; }
.sim-library > p { margin: 7px 0 14px; color: #7188aa; font-size: 11px; line-height: 1.45; }
.sim-workflow-list { display: grid; flex: 1 1 auto; min-height: 0; gap: 8px; overflow-y: auto; padding-right: 5px; scrollbar-width: thin; }
.sim-workflow-list button { width: 100%; border: 1px solid transparent; border-radius: 9px; background: transparent; color: #334155; cursor: pointer; padding: 11px; text-align: left; transition: .18s ease; }
.sim-workflow-list button:hover { background: #eff6ff; }
.sim-workflow-list button.active { border-color: #bfdbfe; background: #eaf2ff; color: #1d4ed8; }
.sim-workflow-list strong, .sim-workflow-list small { display: block; }
.sim-workflow-list strong { font-size: 12px; line-height: 1.35; }
.sim-workflow-list small { margin-top: 5px; color: #7188aa; font-size: 9px; }
.sim-new-workflow { width: 100%; flex: 0 0 auto; margin-top: 12px; }
.sim-map-column { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; background: #f8fbff; }
.sim-map-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #dce7fb; }
.sim-map-head strong { color: #193b70; font-size: 14px; }
.sim-map-head span { color: #7188aa; font-size: 10px; }
.sim-map-canvas { position: relative; min-height: 0; margin: 14px; overflow: hidden; border: 1px solid #bfd2ef; border-radius: 10px; background: #edf5ff; }
.sim-map-canvas { background: #eaf2ff; }
.sim-map-canvas .sim-map-backdrop { position: absolute; inset: -14px; width: calc(100% + 28px); height: calc(100% + 28px); object-fit: cover; filter: blur(13px); opacity: .16; }
.sim-map-canvas .sim-map-foreground { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: contain; opacity: 1; }
.sim-robot { position: absolute; z-index: 2; display: grid; width: 44px; height: 44px; place-items: center; border-radius: 50%; transform: translate(-50%, -50%); transition: left .45s linear, top .45s linear; }
.sim-robot img { width: 66px; height: 66px; object-fit: contain; filter: drop-shadow(0 4px 7px #0f172a55); animation: sim-rover-float 1.25s ease-in-out infinite; }
.sim-robot::after { content: 'MAR-01'; position: absolute; top: 42px; left: 50%; padding: 3px 6px; border-radius: 4px; background: #0f172acc; color: #fff; font-size: 9px; white-space: nowrap; transform: translateX(-50%); }
.sim-robot.is-idle { opacity: .7; filter: grayscale(.45); }
@keyframes sim-rover-float { 50% { transform: translateY(-3px) rotate(-1deg); } }
.sim-map-caption { position: absolute; left: 14px; bottom: 14px; padding: 8px 10px; border: 1px solid #d7e4fb; border-radius: 7px; background: #fffffff0; color: #4d6e9c; font-size: 10px; }
.sim-runbar { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-top: 1px solid #dce7fb; background: #fff; }
.sim-run-status { min-width: 0; margin-right: auto; }
.sim-run-status strong, .sim-run-status span { display: block; }
.sim-run-status strong { color: #193b70; font-size: 12px; }
.sim-run-status span { margin-top: 3px; color: #7188aa; font-size: 10px; }
.sim-time { color: #477cf4; font-size: 12px; font-weight: 600; }
.sim-speed { display: flex; overflow: hidden; border: 1px solid #d7e4fb; border-radius: 7px; }
.sim-speed button { border: 0; border-radius: 0; background: #fff; color: #64748b; cursor: pointer; padding: 7px 9px; font-size: 10px; }
.sim-speed button.active { background: #eaf2ff; color: #2563eb; font-weight: 700; }
.sim-runbar .wf-button { height: 34px; padding: 0 15px; }
.sim-name { margin: clamp(9px, 1.5vh, 15px) 0 4px !important; color: #193b70 !important; font-size: clamp(14px, 1.6vw, 17px) !important; line-height: 1.35; }
.sim-code { margin: 0 0 16px; color: #7188aa; font-size: 10px; }
.sim-progress { height: 7px; margin: 14px 0 6px; overflow: hidden; border-radius: 999px; background: #dbeafe; }
.sim-progress i { display: block; height: 100%; border-radius: inherit; background: #2f80ff; transition: width .35s ease; }
.sim-progress-label { display: flex; justify-content: space-between; color: #7188aa; font-size: 10px; }
.sim-steps { display: grid; flex: 1 1 auto; min-height: 0; gap: clamp(5px, .9vh, 8px); margin-top: clamp(10px, 1.8vh, 20px); overflow-y: auto; padding-right: 4px; scrollbar-width: thin; }
.sim-step { display: grid; grid-template-columns: 25px 1fr; gap: 9px; align-items: center; padding: clamp(6px, 1.1vh, 9px); border: 1px solid #e0e9f7; border-radius: 8px; background: #fff; }
.sim-step b { display: grid; width: 23px; height: 23px; place-items: center; border-radius: 6px; background: #eaf2ff; color: #3978e8; font-size: 9px; }
.sim-step strong, .sim-step small { display: block; }
.sim-step strong { color: #334155; font-size: 11px; }
.sim-step small { margin-top: 2px; color: #7188aa; font-size: 9px; }
.sim-step.current { border-color: #86b4ff; background: #f4f8ff; }
.sim-step.done b { background: #dcfce7; color: #15803d; }
@media (max-width: 1180px) {
  .simulation-studio { grid-template-columns: 220px minmax(420px, 1fr) 260px; }
  .sim-library, .sim-inspector { padding: 14px; }
}
@media (max-width: 900px) {
  .simulation-studio { grid-template-columns: 210px minmax(440px, 1fr); height: auto; overflow: visible; }
  .sim-inspector { grid-column: span 2; border-top: 1px solid #dce7fb; border-left: 0; }
  .sim-map-column { min-height: 560px; }
}

.task-empty-note{margin:0;color:var(--mar-muted,#475569);font-size:11px;line-height:1.45}.editor-side-button small{display:block;margin-top:3px;opacity:.7;font-size:9px}.type-modal{position:fixed;z-index:20;inset:0;display:grid;place-items:center;background:#14251d66;backdrop-filter:blur(3px)}.type-modal-card{width:min(680px,calc(100% - 32px));max-height:80vh;overflow:auto;border-radius:12px;background:#fff;padding:24px;box-shadow:0 20px 60px #0f231833}.type-modal-card header{display:flex;align-items:center;justify-content:space-between}.type-modal-card h2,.type-modal-card p{margin:0}.type-modal-card h2{font-size:19px}.type-modal-card p{margin:7px 0 17px;color:var(--mar-muted,#475569);font-size:11px}.type-modal-card header button{border:0;background:transparent;font-size:24px;cursor:pointer}.type-modal-card>div{display:grid;grid-template-columns:1fr 1fr;gap:9px}.type-modal-card>div button{display:flex;justify-content:space-between;align-items:center;min-height:49px;border:1px solid var(--mar-border,#cbd5e1);border-radius:7px;background:#fff;color:var(--mar-text,#0f172a);padding:10px 13px;text-align:left;cursor:pointer}.type-modal-card>div button:hover{background:#f0fdf4;border-color:#5faa83}.type-modal-card>div b{font-size:11px}.type-modal-card>div span{color:#368a67;font-size:19px}@media(max-width:650px){.type-modal-card>div{grid-template-columns:1fr}}
.type-modal-close{display:grid!important;width:34px;height:34px;place-items:center;border:1px solid #d9e4dc!important;border-radius:50%;color:#4b675c;background:#f8fbf9!important;line-height:1}
.type-modal{background:rgba(17,43,35,.45)}.type-modal-card{width:min(800px,calc(100% - 36px));padding:31px 32px;border:1px solid rgba(255,255,255,.7);border-radius:18px;box-shadow:0 28px 80px rgba(12,43,32,.28)}.type-modal-card header{align-items:flex-start;margin-bottom:24px}.type-modal-card header h2{margin:5px 0 6px;font-size:25px;letter-spacing:-.6px}.type-modal-card header p{margin:0;font-size:12px}.modal-kicker{display:block;color:#568c78!important;font-size:9px!important;font-weight:700;letter-spacing:1.3px}.type-modal-close{flex:0 0 auto;width:38px;height:38px;font-size:26px!important;transition:.18s}.type-modal-close:hover{background:#e9f5ef!important;transform:rotate(90deg)}.type-modal-card>div{gap:12px}.type-modal-card>div button{min-height:84px;padding:13px;border-color:#dce9d7;transition:.18s ease}.type-modal-card>div button:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(43,112,80,.1)}.type-modal-card>div i{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;background:#eaf5ed;color:#348662;font-style:normal;font-size:19px}.type-modal-card>div span{display:grid;gap:2px;text-align:left}.type-modal-card>div small{color:#7d9d90;font-size:8px;font-weight:700;letter-spacing:.8px}.type-modal-card>div span b{font-size:12px;color:#1b3c34}.type-modal-card>div em{color:#80988d;font-size:10px;font-style:normal;line-height:1.35}.type-modal-card>div strong{margin-left:auto;color:#37916b;font-size:20px;font-weight:400}.rename-backdrop{position:fixed;z-index:25;inset:0;display:grid;place-items:center;background:rgba(17,43,35,.46);backdrop-filter:blur(4px)}.rename-dialog{width:min(390px,calc(100% - 32px));padding:28px;border:1px solid rgba(255,255,255,.8);border-radius:16px;background:#fff;box-shadow:0 28px 80px rgba(12,43,32,.3)}.rename-icon{display:grid;width:40px;height:40px;place-items:center;border-radius:11px;background:#eaf5ed;color:#2d8663;font-size:19px}.rename-dialog h2{margin:15px 0 6px;font-size:20px}.rename-dialog p{margin:0 0 20px;color:#7f968c;font-size:12px}.rename-dialog label{display:block;color:#607f73;font-size:11px;font-weight:600}.rename-dialog input{box-sizing:border-box;width:100%;margin-top:7px;border:1px solid #cfe0d4;border-radius:8px;padding:11px 12px;font:inherit;color:#22483b;outline:none}.rename-dialog input:focus{border-color:#5aac86;box-shadow:0 0 0 3px #e7f4ec}.rename-dialog footer{display:flex;justify-content:flex-end;gap:9px;margin-top:23px}.rename-dialog footer button{border:1px solid #d7e5db;border-radius:7px;padding:10px 13px;background:#fff;color:#547368;font:600 12px Inter;cursor:pointer}.rename-dialog footer button[type=submit]{border-color:#2c8968;background:#2c8968;color:#fff}

@media (max-width: 900px) {
  .workflows-screen {
    height: auto;
    min-width: 320px;
    overflow: visible;
  }

  .wf-sidebar {
    display: none;
  }

  .workflows-main {
    margin-left: 0;
    height: auto;
    overflow: visible;
    padding: 28px 16px;
  }

  .robot-location {
    position: static;
    margin-top: 8px;
  }

  .workflow-tabs,
  .workflow-actions {
    overflow-x: auto;
  }

  .workflows-grid {
    height: auto;
    grid-template-columns: 1fr;
  }

  .workflow-editor-grid {
    grid-template-columns: 1fr;
  }
}
.workflow-main{background:#f6f9ff}.workflow-topbar{border-color:#dce7fb}.workflow-topbar p,.form-caption,.modal-kicker{color:#477cf4!important}.workflow-topbar span,.workflow-topbar div:last-child{color:#60789e}.workflow-topbar i{background:#2582ff}.workflow-studio{border-color:#d7e4fb;box-shadow:0 16px 38px rgba(57,111,210,.08)}.studio-header,.workflow-meta,.studio-footer,.config-footer{border-color:#dce7fb}.studio-icon{background:#eaf2ff;color:#347cff}.workflow-meta label,.studio-field span,.studio-toggle{color:#657da4}.workflow-meta input,.studio-field input,.studio-field textarea{border-color:#d5e2fa;background:#fbfdff;color:#193b70}.workflow-meta input:focus,.studio-field input:focus,.studio-field textarea:focus{border-color:#4d8cff;box-shadow:0 0 0 3px #e6efff}.task-heading b span{background:#e9f1ff;color:#4d7fe5}.task-heading button,.task-delete,.back-arrow{color:#357df4}.task-card.active{border-color:#7eabff;box-shadow:0 3px 12px #e5efff}.task-card-main span,.task-steps b{color:#4380ee}.task-steps>button:not(.add-step),.task-placeholder{background:#f6f9ff}.empty-task,.add-step{border-color:#b9d2ff;color:#347cf5}.task-placeholder button{background:#e7f0ff;color:#216ce7}.studio-footer button,.config-footer button{background:#2f7cf6}.type-modal{background:rgba(20,47,92,.47)}.type-modal-card{border-color:rgba(255,255,255,.85);box-shadow:0 28px 80px rgba(24,65,137,.3)}.type-modal-close{border-color:#d7e5fb!important;color:#386db5;background:#f6f9ff!important}.type-modal-close:hover{background:#e7f0ff!important}.type-modal-card>div button{border-color:#d6e3f8}.type-modal-card>div button:hover{background:#f6f9ff;border-color:#77a5ff;box-shadow:0 8px 18px rgba(45,114,238,.13)}.type-modal-card>div i{background:#e9f2ff;color:#377dfa}.type-modal-card>div small{color:#5680c1}.type-modal-card>div span b{color:#18396d}.type-modal-card>div em{color:#7892b5}.type-modal-card>div strong{color:#347df5}.rename-backdrop{background:rgba(20,47,92,.47)}.rename-dialog{box-shadow:0 28px 80px rgba(24,65,137,.3)}.rename-icon{background:#e9f2ff;color:#347cf5}.rename-dialog p{color:#7188aa}.rename-dialog label{color:#58729a}.rename-dialog input{border-color:#d4e2f8;color:#193b70}.rename-dialog input:focus{border-color:#5792ff;box-shadow:0 0 0 3px #e8f1ff}.rename-dialog footer button{border-color:#d6e3f8;color:#4d6e9c}.rename-dialog footer button[type=submit]{border-color:#2f7cf6;background:#2f7cf6}
.type-modal-card header,.step-config-dialog header{position:relative}.type-modal-card .type-modal-close,.step-config-dialog .type-modal-close{position:absolute;top:0;right:0}.config-backdrop{position:fixed;z-index:26;inset:0;display:grid;place-items:center;padding:20px;background:rgba(20,47,92,.47);backdrop-filter:blur(4px)}.step-config-dialog{width:min(540px,100%);max-height:82vh;overflow:auto;box-sizing:border-box;padding:28px;border-radius:17px;background:#fff;box-shadow:0 28px 80px rgba(24,65,137,.3)}.step-config-dialog h2,.step-config-dialog p{margin:0}.step-config-dialog h2{margin:5px 0;font-size:23px}.step-config-dialog p{color:#738aac;font-size:12px}.config-fields{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin:24px 0}.config-fields label{color:#52709c;font-size:10px;font-weight:700}.config-fields input{box-sizing:border-box;width:100%;margin-top:7px;border:1px solid #d4e2f8;border-radius:8px;padding:10px;font:inherit;font-size:12px;color:#193b70;outline:0}.config-fields input:focus{border-color:#5792ff;box-shadow:0 0 0 3px #e8f1ff}.step-config-dialog footer{display:flex;justify-content:flex-end;gap:9px}.step-config-dialog footer button{border:1px solid #d6e3f8;border-radius:7px;padding:10px 13px;background:#fff;color:#4d6e9c;font:600 12px Inter;cursor:pointer}.step-config-dialog footer button[type=submit]{border-color:#2f7cf6;background:#2f7cf6;color:#fff}@media(max-width:560px){.config-fields{grid-template-columns:1fr}}
.step-config-panel{height:706px}.config-back{align-self:flex-start;border:0;background:transparent;padding:0;color:#397cf1;font:600 11px Inter;cursor:pointer}.step-config-panel h2{margin:3px 0}.step-config-panel>p{margin:0;color:#7892b5;font-size:11px}.inline-config-fields{display:grid;grid-template-columns:1fr 1fr;gap:13px;overflow:auto;margin-top:12px;padding-right:4px}.inline-config-fields label{color:#52709c;font-size:10px;font-weight:700}.inline-config-fields input{box-sizing:border-box;width:100%;margin-top:7px;border:1px solid #d4e2f8;border-radius:8px;padding:10px;font:inherit;font-size:12px;color:#193b70;outline:0}.inline-config-fields input:focus{border-color:#5792ff;box-shadow:0 0 0 3px #e8f1ff}.inline-config-save{margin-top:auto;width:100%;border:0;border-radius:7px;padding:13px;background:#2f7cf6;color:#fff;font:600 12px Inter;cursor:pointer}@media(max-width:560px){.inline-config-fields{grid-template-columns:1fr}}
.type-modal,.rename-backdrop{width:100vw;height:100vh;max-width:100vw;overflow:hidden}.type-modal-card{position:relative;box-sizing:border-box;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px)}.type-modal-card>div button:hover{transform:none}.type-modal-card .type-modal-close{position:absolute!important;top:30px!important;right:30px!important;z-index:2}.type-modal-card header{padding-right:54px}
.workflow-steps-panel{background:linear-gradient(180deg,#fff 0%,#f9fbff 100%)}.workflow-steps-panel>h2{margin:5px 0}.workflow-steps-panel>p{margin:0 0 20px;color:#7289aa;font-size:12px}.step-table{border:1px solid #d8e5fa;border-radius:10px;overflow:hidden;background:#fff}.step-table-head,.step-table-row{display:grid;grid-template-columns:52px 1fr 105px;align-items:center;gap:12px}.step-table-head{padding:11px 15px;background:#eef4ff;color:#5b7eb6;font-size:9px;font-weight:700;letter-spacing:.7px}.step-table-row{width:100%;border:0;border-top:1px solid #e5eefc;background:#fff;padding:15px;text-align:left;cursor:pointer;transition:background .15s}.step-table-row:hover{background:#f1f6ff}.step-table-row span{color:#7d96bf;font-size:11px;font-weight:700}.step-table-row b{color:#1d427c;font-size:12px}.step-table-row em{justify-self:end;border-radius:20px;background:#eef4ff;padding:5px 8px;color:#4b79c5;font-size:9px;font-style:normal}.step-empty-state{padding:30px 18px;color:#8095b5;font-size:12px;text-align:center}@media(max-width:560px){.step-table-head,.step-table-row{grid-template-columns:34px 1fr}.step-table-head span:last-child,.step-table-row em{display:none}}
.workflow-card-actions{display:flex;align-items:center;gap:6px}.workflow-card-status,.workflow-card-published{border:1px solid #cfe0fb;border-radius:8px;background:#f7faff;color:#3373d5;padding:6px 8px;font:600 10px Inter;white-space:nowrap}.workflow-card-status{cursor:pointer}.workflow-card-status.is-publish{border-color:#2f7cf6;background:#2f7cf6;color:#fff}.workflow-card-published{border-color:#c7e5d8;background:#effaf5;color:#168261}.workflow-type-choice{max-width:760px;margin:auto;display:grid;gap:14px;padding:28px}.workflow-type-choice h2,.workflow-type-choice p{margin:0}.workflow-type-choice p{color:#6d84a7;line-height:1.6}.workflow-type-choice>div{display:grid;grid-template-columns:1fr 1fr;gap:14px}.workflow-type-choice>div button{display:grid;gap:7px;border:1px solid #cfe0fb;border-radius:13px;background:#f9fbff;color:#193b70;padding:19px;text-align:left;cursor:pointer}.workflow-type-choice>div button:hover{border-color:#5d96fb;background:#edf4ff}.workflow-type-choice>div strong{font-size:16px}.workflow-type-choice>div span{color:#6580a6;font-size:12px;line-height:1.5}.workflow-type-choice>div em{color:#286df0;font-size:12px;font-style:normal;font-weight:600}.patrol-workflow-builder .editor-side{height:auto}.patrol-workflow-builder .wf-field select,.patrol-workflow-builder .wf-field input{box-sizing:border-box;width:100%;height:42px;border:1px solid #d4e2f8;border-radius:8px;background:#fbfdff;color:#193b70;padding:10px;font:inherit;font-size:12px}.patrol-return-toggle{display:flex;gap:8px;align-items:flex-start;color:#55729c;font-size:12px;line-height:1.45}.patrol-return-toggle input{accent-color:#2f7cf6}.patrol-step-list{display:grid;gap:10px;margin:17px 0}.patrol-step-config{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:11px;align-items:start;border:1px solid #d8e5fa;border-radius:11px;background:#fff;padding:12px}.patrol-step-config>b{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#e9f2ff;color:#2f7cf6;font-size:11px}.patrol-step-config>div:nth-child(2){display:grid;grid-template-columns:1fr 130px;gap:9px}.patrol-step-config label{display:grid;gap:5px;color:#58749d;font-size:10px;font-weight:700}.patrol-step-config select,.patrol-step-config input{box-sizing:border-box;width:100%;height:38px;border:1px solid #d4e2f8;border-radius:7px;background:#fff;color:#193b70;padding:8px;font:inherit;font-size:12px}.patrol-step-actions{display:flex;gap:4px}.patrol-step-actions button{width:29px;height:29px;border:1px solid #d4e2f8;border-radius:7px;background:#fff;color:#376fbf;cursor:pointer}.patrol-step-actions button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:620px){.workflow-type-choice>div{grid-template-columns:1fr}.patrol-step-config{grid-template-columns:28px 1fr}.patrol-step-actions{grid-column:2}.patrol-step-config>div:nth-child(2){grid-template-columns:1fr}}
`;
injectStyles('mediassist-style-pages-Workflows-WorkflowsPage-jsx', inlineStyles);

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminSidebar from '../../features/admin/components/AdminSidebar.jsx';
import { clearSession } from '../../features/auth/session.js';
import { latestWorkflowVersions, workflowApi } from '../../features/workflows/workflowApi.js';
import { editorTasks, newWorkflowCode, stepPayload, taskPayload, workflowPayload } from '../../features/workflows/workflowDraftModel.js';
import { buildPatrolGraph, loadAllPages, orderedPatrolSteps } from '../../features/workflows/patrolWorkflowModel.js';
import MoveDestinationFields from './MoveDestinationFields.jsx';
import { LOCAL_MAP_ID, localMapCatalog, mergeLocalDesigns, getDesign, saveLocalGraph, removeLocalDesign } from '../../features/workflows/localPatrolDesign.js';

const navGroups = [
  ['Overview', ['Dashboard']],
  ['Operations', ['Live Operations', 'Emergency Center', 'Missions', 'Patrol']],
  ['Map & Navigation', ['Map Studio']],
  ['Robot', ['Robot Status', 'Charging']],
  ['Monitoring', ['Alerts', 'Crowd Heatmap', 'History & Replay', 'Analytics']],
  ['Automation', ['Workflows', 'Voice & Scripts']],
  ['Administration', ['Users & Roles', 'System Settings', 'Audit Logs']],
];

const workflows = [
  ['Patient Guidance and Escort', 'WF_PATIENT_ESCORT', 16],
  ['Outpatient Information Assistance', 'WF_INFORMATION_ASSISTANCE', 15],
  ['Secure Medical Delivery', 'WF_SECURE_MEDICAL_DELIVERY', 28],
  ['Crowd Density Monitoring', 'WF_CROWD_MONITORING', 15],
  ['Emergency SOS Response', 'WF_EMERGENCY_SOS_RESPONSE', 18],
  ['Patient Fall Detection and Response', 'WF_FALL_DETECTION_RESPONSE', 9],
  ['Restricted Area Monitoring', 'WF_RESTRICTED_AREA_MONITORING', 15],
  ['Automatic Charging and Return to Ready', 'WF_AUTO_CHARGING', 19],
  ['Blocked Path Navigation Recovery', 'WF_NAVIGATION_RECOVERY', 11],
  ['Robot Startup and Standby', 'WF_ROBOT_STARTUP_STANDBY', 13],
].map(([name, code, steps]) => ({ name, code, steps }));

const systemWorkflowCopy = {
  WF_PATIENT_ESCORT: ['Đồng hành cùng bệnh nhân', 'Hướng dẫn và hỗ trợ bệnh nhân đến điểm đích', 'ĐH'],
  WF_INFORMATION_ASSISTANCE: ['Hỗ trợ tra cứu thông tin', 'Tra cứu và phản hồi thông tin cho người dùng', 'TT'],
  WF_SECURE_MEDICAL_DELIVERY: ['Giao vật tư y tế an toàn', 'Điều phối giao nhận vật tư giữa các điểm', 'YT'],
  WF_CROWD_MONITORING: ['Giám sát mật độ khu vực', 'Theo dõi số người và cảnh báo khi cần thiết', 'GS'],
  WF_EMERGENCY_SOS_RESPONSE: ['Ứng phó khẩn cấp SOS', 'Tiếp nhận và điều phối phản hồi khẩn cấp', 'KC'],
  WF_FALL_RESPONSE: ['Xử lý sự kiện nghi té ngã', 'Phát hiện, xác minh và thông báo sự cố', 'AT'],
  WF_FALL_DETECTION_RESPONSE: ['Xử lý sự kiện nghi té ngã', 'Phát hiện, xác minh và thông báo sự cố', 'AT'],
  WF_RESTRICTED_MONITORING: ['Giám sát khu vực hạn chế', 'Theo dõi các khu vực cần kiểm soát', 'GS'],
  WF_RESTRICTED_AREA_MONITORING: ['Giám sát khu vực hạn chế', 'Theo dõi các khu vực cần kiểm soát', 'GS'],
  WF_AUTO_CHARGING: ['Yêu cầu sạc robot', 'Gửi yêu cầu sạc thủ công đến nhân viên', 'SR'],
  WF_NAVIGATION_RECOVERY: ['Khôi phục điều hướng', 'Hỗ trợ robot xử lý tuyến đường bị gián đoạn', 'ĐH'],
  WF_ROBOT_STARTUP_STANDBY: ['Kiểm tra sẵn sàng robot', 'Xác nhận robot sẵn sàng trước khi vận hành', 'RB'],
  WF_NAVIGATION: ['Điều hướng đến điểm đích', 'Thiết lập tuyến đường và điểm đến cho robot', 'ĐH'],
  WF_MAPPING: ['Lập và xác thực bản đồ', 'Tạo, kiểm tra và lưu bản đồ vận hành', 'BĐ'],
};

function workflowPresentation(workflow) {
  const code = workflow.workflowCode || workflow.code;
  const copy = systemWorkflowCopy[code];
  if (copy) return { title: copy[0], description: copy[1], badge: copy[2] };
  return {
    title: workflow.workflowName || workflow.name || 'Quy trình chưa đặt tên',
    description: 'Sẵn sàng để xem cấu hình và thiết lập điều phối.',
    badge: 'QT',
  };
}

const stepTypes = [
  'MOVE',
  'INTERACT',
  'DATA_SERVICE',
  'AUTHENTICATE',
  'CONTROL_HARDWARE',
  'HANDLE_PAYLOAD',
  'EXECUTE_SENSING',
  'NOTIFY',
  'WAIT',
  'CHECK_CONDITION',
  'SET_CONTEXT',
];
const stepTypeCopy = { MOVE: ['⌁', 'Move the robot to a configured destination'], INTERACT: ['◌', 'Voice, screen, and user interaction'], DATA_SERVICE: ['▤', 'Query or update business data'], AUTHENTICATE: ['◇', 'Verify identity and permission'], CONTROL_HARDWARE: ['⌘', 'Control locks and hardware'], HANDLE_PAYLOAD: ['□', 'Handle delivery payloads'], EXECUTE_SENSING: ['◉', 'Read sensors and observations'], NOTIFY: ['♧', 'Send alerts and notifications'], WAIT: ['◷', 'Wait for a duration or event'], CHECK_CONDITION: ['⌘', 'Evaluate workflow conditions'], SET_CONTEXT: ['›_', 'Update shared job context'] };
const stepFields = { MOVE:['map_id','endpoint_id','mode','max_speed_mps'],INTERACT:['action','language','prompt_key','data','text'],DATA_SERVICE:['service_key','operation','resource','request'],AUTHENTICATE:['method','required_permission','purpose'],CONTROL_HARDWARE:['device_id','action','verification_mode','verification_id','purpose'],HANDLE_PAYLOAD:['action','delivery_id','items','verification_mode'],EXECUTE_SENSING:['task_type','sensors','mode','duration_sec','region_id'],NOTIFY:['notification_type','severity','recipients','channels','message'],WAIT:['wait_type','duration_sec','event_type'],CHECK_CONDITION:['expression','language','default_next_step_id'],SET_CONTEXT:['scope','assignments','merge_mode'] };

export function Sidebar() {
  const navigate = useNavigate();
  return <AdminSidebar active="Workflows" onSelect={(screen) => navigate(`/admin?screen=${encodeURIComponent(screen)}`)} onLogout={() => { clearSession(); navigate('/'); }} />;
}

export function MarButton({ children, variant = 'primary', className = '', onClick, disabled = false }) {
  return (
    <button className={`wf-button ${variant} ${className}`.trim()} type="button" onClick={onClick} disabled={disabled}>
      {vi(children)}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, children }) {
  return (
    <label className="wf-field">
      <span>{vi(label)}</span>{children ?? <input value={value} readOnly={!onChange} onChange={onChange ? (event) => onChange(event.target.value) : undefined} placeholder={placeholder ? vi(placeholder) : undefined} />}
    </label>
  );
}

function Tabs() {
  const navigate = useNavigate();
  return (
    <WorkspaceTabs label="Không gian quy trình" active="workflow" onSelect={id => navigate(id === 'workflow' ? '/workflows' : '/workstations')} items={[{ id: 'workflow', label: 'Quy trình' }, { id: 'dispatch', label: 'Điều phối' }]}/>
  );
}

export function DispatchSimulationPreview({ onCreate, definitions, loading, error }) {
  const available = definitions.length ? definitions : (loading ? [] : workflows);
  const [selectedKey, setSelectedKey] = useState(null);
  const [runStatus, setRunStatus] = useState('READY');
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const mapCanvasRef = useRef(null);
  const [mapBounds, setMapBounds] = useState({ left: 0, top: 0, width: 1, height: 1 });
  const getKey = (workflow) => workflow.workflowId || workflow.workflowCode || workflow.code || workflow.name;
  const selected = available.find((workflow) => getKey(workflow) === selectedKey) || available[0];
  const routePoints = [[89.5, 18.7], [89.5, 44.3], [70.5, 44.3], [68.2, 52.4], [62.2, 52.4], [29.2, 52.4], [29.2, 60.1], [14.8, 60.1]];
  const totalSeconds = 12;
  const progress = Math.min(elapsed / totalSeconds, 1);
  const scaled = progress * (routePoints.length - 1);
  const pointIndex = Math.min(Math.floor(scaled), routePoints.length - 2);
  const segment = scaled - pointIndex;
  const [fromX, fromY] = routePoints[pointIndex];
  const [toX, toY] = routePoints[Math.min(pointIndex + 1, routePoints.length - 1)];
  const pointX = fromX + (toX - fromX) * segment;
  const pointY = fromY + (toY - fromY) * segment;
  const robotPosition = { left: (mapBounds.left + mapBounds.width * pointX / 100).toFixed(2) + 'px', top: (mapBounds.top + mapBounds.height * pointY / 100).toFixed(2) + 'px' };
  const sequence = ['AUTHENTICATE', 'MOVE', 'INTERACT', 'NOTIFY'];
  const completedSteps = Math.min(sequence.length, Math.floor(progress * sequence.length));
  const currentLabel = runStatus === 'SUCCEEDED' ? 'Simulation completed' : runStatus === 'RUNNING' ? ['Checking workflow inputs', 'Leaving Pharmacy Pickup', 'Navigating main corridor', 'Approaching destination'][Math.min(completedSteps, 3)] : 'Choose a workflow and press Run';

  useEffect(() => {
    if (!selectedKey && available[0]) setSelectedKey(getKey(available[0]));
  }, [available, selectedKey]);
  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return undefined;

    const updateMapBounds = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const sourceAspectRatio = 1365 / 1152;
      const imageWidth = Math.min(width, height * sourceAspectRatio);
      const imageHeight = imageWidth / sourceAspectRatio;
      setMapBounds({
        left: (width - imageWidth) / 2,
        top: (height - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight,
      });
    };

    updateMapBounds();
    const observer = new ResizeObserver(updateMapBounds);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (runStatus !== 'RUNNING') return undefined;
    const timer = window.setInterval(() => setElapsed((value) => Math.min(totalSeconds, value + 0.25 * speed)), 250);
    return () => window.clearInterval(timer);
  }, [runStatus, speed]);
  useEffect(() => {
    if (elapsed >= totalSeconds && runStatus === 'RUNNING') setRunStatus('SUCCEEDED');
  }, [elapsed, runStatus]);

  const chooseWorkflow = (key) => { setSelectedKey(key); setElapsed(0); setRunStatus('READY'); };
  const run = () => { if (runStatus === 'SUCCEEDED') setElapsed(0); setRunStatus('RUNNING'); };
  const reset = () => { setElapsed(0); setRunStatus('READY'); };
  const time = `00:${String(Math.floor(elapsed)).padStart(2, '0')}`;

  return <section className="simulation-studio" aria-label={vi("Workflow simulation workspace")}>
    <aside className="sim-library">
      <p className="sim-kicker">{vi("Workflow library")}</p>
      <h2>{vi("Available workflows")}</h2>
      <p>{vi("Select an existing workflow. All workflows use the same Hospital Floor 1 simulation map.")}</p>
      <div className="sim-workflow-list">
        {vi(available.map((workflow) => {
          const key = getKey(workflow);
          const presentation = workflowPresentation(workflow);
          return <button className={key === getKey(selected) ? 'active' : ''} type="button" key={key} onClick={() => chooseWorkflow(key)}>
            <strong>{vi(presentation.title)}</strong>
            <small>{vi(presentation.description)}</small>
          </button>;
        }))}
        {vi(!loading && !available.length && <p className="preview-note">{vi(error || 'No workflow definitions returned by the backend.')}</p>)}
      </div>
      <MarButton className="sim-new-workflow" variant="subtle" onClick={onCreate}>{vi("+ Create workflow")}</MarButton>
    </aside>
    <section className="sim-map-column">
      <header className="sim-map-head"><strong>{vi("Hospital Floor 1 · Shared simulation map")}</strong><span>{vi("1 robot · 8 zones")}</span></header>
      <div className="sim-map-canvas" ref={mapCanvasRef}>
        <img className="sim-map-backdrop" src={workflowRouteMap} alt={vi("")} aria-hidden="true" />
        <img className="sim-map-foreground" src={workflowRouteMap} alt={vi("Shared Hospital Floor 1 simulation map")} />
        <span className={runStatus === 'READY' ? 'sim-robot is-idle' : 'sim-robot'} style={robotPosition}><img src={simulationRover} alt={vi("")} /></span>
        <span className="sim-map-caption">{vi(runStatus === 'RUNNING' ? currentLabel : runStatus === 'SUCCEEDED' ? 'Route complete · Room 305' : 'Pharmacy Pickup → Room 305')}</span>
      </div>
      <footer className="sim-runbar">
        <div className="sim-run-status"><strong>{vi(runStatus === 'READY' ? 'Ready to run' : currentLabel)}</strong><span>{vi(selected ? workflowPresentation(selected).title : 'Loading workflow definitions…')}</span></div>
        <span className="sim-time">{vi(time)}</span>
        <div className="sim-speed" aria-label={vi("Simulation speed")}>{vi([1, 2, 3, 5].map((value) => <button className={speed === value ? 'active' : ''} type="button" key={value} onClick={() => setSpeed(value)}>{vi(value)}{vi("×")}</button>))}</div>
        <MarButton variant="subtle" onClick={reset}>{vi("Reset")}</MarButton>
        <MarButton onClick={run}>{vi(runStatus === 'RUNNING' ? 'Running…' : runStatus === 'SUCCEEDED' ? 'Run again' : '▶ Run')}</MarButton>
      </footer>
    </section>
    <aside className="sim-inspector">
      <p className="sim-kicker">{vi("Workflow configuration")}</p>
      <h2 className="sim-name">{vi(selected ? workflowPresentation(selected).title : 'Loading workflow…')}</h2>
      <p className="sim-code">{vi(selected ? workflowPresentation(selected).description : 'Workflow definition API')}</p>
      <div className="sim-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      <div className="sim-progress-label"><span>{vi("Simulation progress")}</span><b>{vi(Math.round(progress * 100))}{vi("%")}</b></div>
      <div className="sim-steps">{vi(sequence.map((step, index) => <article className={index < completedSteps ? 'sim-step done' : index === completedSteps && runStatus === 'RUNNING' ? 'sim-step current' : 'sim-step'} key={step}><b>{vi(index < completedSteps || runStatus === 'SUCCEEDED' ? '✓' : String(index + 1).padStart(2, '0'))}</b><div><strong>{vi(step.replace('_', ' '))}</strong><small>{vi(index < completedSteps || runStatus === 'SUCCEEDED' ? 'Completed' : index === completedSteps && runStatus === 'RUNNING' ? 'Running now' : 'Waiting')}</small></div></article>))}</div>
    </aside>
  </section>;
}

function Library({ onCreate, onOpen, onRemove, onValidate, onPublish, actionId, definitions, loading, error }) {
  const visible = definitions.filter(item => item.status !== 'ARCHIVED');
  return (
    <div className="workflows-grid">
      <section className="workflow-panel library-panel">
        <h2>QUY TRÌNH CÓ SẴN · {loading ? 'ĐANG TẢI' : visible.length}</h2>
        <div className="workflow-list">
          {vi(visible.map((workflow) => {
            const presentation = workflowPresentation(workflow);
            return <div className="workflow-card" key={workflow.workflowId || workflow.code}>
              <button className="workflow-card-open" type="button" onClick={() => onOpen(workflow)} aria-label={vi(`Mở ${presentation.title}`)}>
                <span className="workflow-card-icon" aria-hidden="true">{presentation.badge}</span>
                <span className="workflow-card-copy"><strong>{vi(presentation.title)}</strong><small>{vi(presentation.description)}</small></span>
              </button>
              <div className="workflow-card-actions">
                {workflow.status === 'DRAFT' && <>{workflow.localOnly ? <span className="workflow-card-status">Lưu trên thiết bị</span> : <button className="workflow-card-status" type="button" disabled={actionId === workflow.workflowId} onClick={() => onValidate(workflow)}>{actionId === workflow.workflowId ? '…' : 'Xác thực'}</button>}<button className="workflow-card-delete" type="button" onClick={() => onRemove(workflow)} aria-label={`Xóa ${presentation.title}`} title="Xóa bản nháp"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" /></svg></button></>}
                {workflow.status === 'VALIDATED' && <button className="workflow-card-status is-publish" type="button" disabled={actionId === workflow.workflowId} onClick={() => onPublish(workflow)}>{actionId === workflow.workflowId ? '…' : 'Xuất bản'}</button>}
                {workflow.status === 'PUBLISHED' && <><span className="workflow-card-published">Đã xuất bản</span><button className="workflow-card-delete" type="button" onClick={() => onRemove(workflow)} aria-label={`Xóa ${presentation.title}`} title="Xóa quy trình đã xuất bản"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" /></svg></button></>}
              </div>
            </div>;
          }))}
          {vi(!loading && !definitions.length && <p className="preview-note">{vi(error || 'No workflow definitions returned by the backend.')}</p>)}
        </div>
      </section>
      <aside className="workflow-panel action-panel">
        <h2>{vi("TẠO QUY TRÌNH")}</h2><p>{vi("Tạo tuyến tuần tra từ điểm trên bản đồ đã lưu. Tuyến tuần tra được lưu trên thiết bị để chạy thử.")}</p><MarButton className="full" onClick={onCreate}>{vi("+ Tạo quy trình")}</MarButton><h2>{vi("QUY TRÌNH CÓ SẴN")}</h2><p>{vi("Chọn bản nháp để tiếp tục chỉnh sửa. Có thể xóa bản nháp hoặc quy trình đã xuất bản chưa có lịch sử nhiệm vụ.")}</p>
      </aside>
    </div>
  );
}

function EditorSide({ activeTask, screen, setScreen, setActiveTask, customTask }) {
  const allTasks = customTask ? [...tasks, 'Confirm delivery'] : tasks;

  return (
    <section className="workflow-panel editor-side">
      <h2>{vi("WORKFLOW")}</h2>
      <Field label="Name" value="New workflow" />
      <Field label="Description" value="Add a description..." />
      <div className="task-heading">
        <h2>{vi("TASKS · 4 DEFAULTS")}</h2>
        {vi(screen !== 'create' ? <button type="button" onClick={() => setScreen('add-task')}>{vi("+")}</button> : null)}
      </div>
      {vi(allTasks.map((task) => (
        <button
          className={activeTask === task ? 'editor-side-button active' : 'editor-side-button'}
          type="button"
          key={task}
          onClick={() => {
            setActiveTask(task);
            setScreen(task === 'Confirm delivery' ? 'custom-task' : 'task-empty');
          }}
        >
          {vi(task)}
        </button>
      )))}
      <h2 className="endpoint-heading">{vi("ENDPOINT CONFIGURATION")}</h2>
      <button className={screen === 'options' || screen === 'queue-exit' ? 'editor-side-button small active' : 'editor-side-button small'} type="button" onClick={() => setScreen('options')}>{vi("Options ›")}</button>
      <button className={screen === 'marker' || screen === 'marker-sensors' ? 'editor-side-button small active' : 'editor-side-button small'} type="button" onClick={() => setScreen('marker')}>{vi("Marker Options ›")}</button>
    </section>
  );
}

function SelectTaskPanel() {
  return (
    <section className="workflow-panel editor-detail">
      <h2>{vi("SELECT A TASK")}</h2>
      <h3>{vi("Select Move, Load, Transport or Unload to build its step sequence.")}</h3>
      <p>{vi("Each task has an ordered list of steps. Use + Add Step to choose from the step type library.")}</p>
    </section>
  );
}

function TaskPanel({ task, screen, setScreen }) {
  const steps = screen === 'two-steps' ? ['MOVE', 'INTERACT'] : screen === 'one-step' ? ['MOVE'] : [];

  return (
    <section className="workflow-panel editor-detail">
      <h2>{vi("TASK")}</h2>
      <h3 className="large">{vi(task)}</h3>
      {vi(screen === 'step-types' ? (
        <>
          <MarButton className="wide" variant="subtle">{vi("Select step type ▴")}</MarButton>
          <div className="step-dropdown">
            {vi(stepTypes.map((type, index) => (
              <button type="button" key={type} onClick={() => setScreen(index === 1 ? 'two-steps' : 'one-step')}>
                {vi(type)}
              </button>
            )))}
          </div>
        </>
      ) : (
        <>
          <h2>{vi("STEP SEQUENCE · ")}{vi(steps.length ? `${steps.length} ${steps.length === 1 ? 'STEP' : 'STEPS'}` : 'EMPTY')}</h2>
          {steps.length ? (
            <>
              {steps.map((step, index) => (
                <div className="step-row" key={step}>
                  {vi(String(index + 1).padStart(2, '0'))}
                  <span>{vi(step)}</span>
                </div>
              ))}
              <p>{vi("Step type selected from the library. Configuration uses the predefined defaults.")}</p>
            </>
          ) : (
            <p>{vi("No steps yet. Add a step from the library.")}</p>
          )}
          <MarButton className="wide" variant="subtle" onClick={() => setScreen('step-types')}>{vi("+ Add Step")}</MarButton>
        </>
      ))}
    </section>
  );
}

function OptionsPanel({ screen, setScreen }) {
  if (screen === 'queue-exit') {
    return (
      <section className="workflow-panel editor-detail">
        <h2>{vi("OPTIONS / QUEUE & EXIT")}</h2>
        <p>{vi("Endpoint template · Task sequences")}</p>
        <h2>{vi("QUEUE")}</h2>
        <p>{vi("Steps performed while waiting to access the endpoint.")}</p>
        <MarButton className="wide" variant="subtle">{vi("+ Add Queue Step")}</MarButton>
        <h2>{vi("EXIT")}</h2>
        <p>{vi("Steps performed when leaving the endpoint.")}</p>
        <MarButton className="wide" variant="subtle">{vi("+ Add Exit Step")}</MarButton>
      </section>
    );
  }

  return (
    <section className="workflow-panel editor-detail">
      <h2>{vi("OPTIONS")}</h2>
      <p>{vi("Endpoint-related settings")}</p>
      <MarButton className="wide" variant="subtle" onClick={() => setScreen('queue-exit')}>{vi("Queue & Exit ›")}</MarButton>
      <MarButton className="wide" variant="subtle" onClick={() => setScreen('marker')}>{vi("Marker Options ›")}</MarButton>
      <p>{vi("Configure how the robot waits, leaves the endpoint and approaches its marker.")}</p>
    </section>
  );
}

function MarkerPanel({ sensors, setScreen }) {
  const fields = [
    ['Marker type', 'Dock'],
    ['Approach angle', '0 deg'],
    ['Tolerance radius', '0.35 m'],
    ['Alignment mode', 'Front camera'],
    ['Retry limit', '3 attempts'],
    ['Timeout', '45 sec'],
    ['Dock offset X', '0.00 m'],
    ['Dock offset Y', '0.00 m'],
    ['Safety stop', 'Enabled'],
    ['Speed limit', '0.4 m/s'],
  ];

  return (
    <section className="workflow-panel editor-detail">
      <h2>{vi("MARKER OPTIONS")}</h2>
      <p>{vi("Endpoint template · Dock marker geometry and behavior")}</p>
      <div className="marker-grid">
        {vi(fields.map(([label, value]) => <Field label={label} value={value} key={label} />))}
      </div>
      <label className="sensor-toggle">
        <input type="checkbox" checked={sensors} readOnly />{vi("Sensor monitoring")}</label>
      {vi(!sensors ? <MarButton className="wide" variant="subtle" onClick={() => setScreen('marker-sensors')}>{vi("Turn Sensor Monitoring On")}</MarButton> : null)}
    </section>
  );
}

function AddTaskPanel({ setScreen, setActiveTask }) {
  return (
    <section className="workflow-panel editor-detail">
      <h2>{vi("NEW TASK")}</h2>
      <Field label="Task name" value="Confirm delivery" />
      <p>{vi("The task starts empty. Add steps from the same step type library.")}</p>
      <MarButton className="wide" onClick={() => {
        setActiveTask('Confirm delivery');
        setScreen('custom-task');
      }}>{vi("Add Task")}</MarButton>
      <MarButton className="wide" variant="subtle" onClick={() => setScreen('create')}>{vi("Cancel")}</MarButton>
    </section>
  );
}

function ReviewPanel() {
  return (
    <section className="workflow-panel editor-detail">
      <h2>{vi("QUY TRÌNH ĐANG THIẾT KẾ")}</h2>
      <Field label="Name" value="New workflow" />
      <h2>{vi("DEFAULT TASKS")}</h2>
      <h3 className="large">{vi("Move → Load → Transport → Unload")}</h3>
      <h2>{vi("Selected task")}</h2>
      <h3>{vi("Move")}</h3>
      <h2>{vi("Selected step type")}</h2>
      <h3>{vi("MOVE")}</h3>
      <p>{vi("Hoàn tất các tác vụ trước khi kiểm tra và xuất bản quy trình.")}</p>
    </section>
  );
}

function StepConfigPanel({ step, onChange, onDone }) {
  if (step.type === 'MOVE') return <section className="workflow-panel editor-detail step-config-panel"><button type="button" className="config-back" onClick={onDone}>← Quay lại tác vụ</button><span className="modal-kicker">CẤU HÌNH BƯỚC</span><h2>Di chuyển đến điểm đích</h2><MoveDestinationFields step={step} onChange={onChange} /><button type="button" className="inline-config-save" onClick={onDone}>Xong · Quay lại tác vụ</button></section>;
  return <section className="workflow-panel editor-detail step-config-panel"><button className="config-back" onClick={onDone}>{vi("← Back to task")}</button><span className="modal-kicker">{vi("STEP CONFIGURATION")}</span><h2>{vi(step.type)}</h2><p>{vi(stepTypeCopy[step.type][1])}</p><div className="inline-config-fields">{vi(stepFields[step.type].map((field) => <label key={field}>{vi(field)}<input placeholder={vi(`Enter ${field}`)} value={step.values[field]} onChange={(event) => onChange({ ...step, values: { ...step.values, [field]: event.target.value } })} /></label>))}</div><button className="inline-config-save" onClick={onDone}>{vi("✓ Done · Back to task")}</button></section>;
}

function listContent(value) {
  return Array.isArray(value) ? value : value?.content ?? [];
}

function newPatrolCode() {
  return `WF_PATROL_${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

/**
 * A patrol is intentionally built as one static graph: one task, an ordered
 * chain of MOVE steps and explicit terminal transitions.  The deployment
 * screen can therefore read the same route without keeping a second route
 * definition in browser storage.
 */
function PatrolWorkflowEditor({ onSaved, onCancel }) {
  const [name, setName] = useState('Tuyến tuần tra mới');
  const [description, setDescription] = useState('Robot đi tuần qua các điểm theo thứ tự đã cấu hình.');
  const [maps, setMaps] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [mapId, setMapId] = useState('');
  const [moves, setMoves] = useState([{ endpointId: '', speed: '0.08' }]);
  const [returnToStart, setReturnToStart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => { const catalog = localMapCatalog(); return [catalog.maps, catalog.endpoints]; })
      .then(([mapPage, endpointPage]) => {
        if (!current) return;
        const nextMaps = listContent(mapPage);
        setMaps(nextMaps);
        setEndpoints(listContent(endpointPage));
        const active = nextMaps.find((map) => map.status === 'ACTIVE') ?? nextMaps[0];
        setMapId(active?.mapId ?? '');
      })
      .catch((cause) => { if (current) setError(cause?.message || 'Không tải được bản đồ và điểm đích.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  const availableEndpoints = endpoints.filter((endpoint) => endpoint.mapId === mapId && endpoint.active !== false && endpoint.accessible !== false);
  const selectedEndpoints = moves.map((move) => availableEndpoints.find((endpoint) => endpoint.endpointId === move.endpointId)).filter(Boolean);
  const updateMove = (index, patch) => setMoves((current) => current.map((move, itemIndex) => itemIndex === index ? { ...move, ...patch } : move));
  const changeMap = (nextMapId) => {
    setMapId(nextMapId);
    setMoves((current) => current.map((move) => ({ ...move, endpointId: '' })));
    setError('');
  };
  const moveStep = (index, offset) => setMoves((current) => {
    const copy = [...current];
    [copy[index], copy[index + offset]] = [copy[index + offset], copy[index]];
    return copy;
  });

  const save = async () => {
    const validMoves = moves.filter((move) => move.endpointId);
    if (!name.trim()) { setError('Nhập tên quy trình tuần tra.'); return; }
    if (!mapId) { setError('Chọn bản đồ trước khi chọn điểm tuần tra.'); return; }
    if (validMoves.length < 2 || validMoves.length !== moves.length) { setError('Tuyến tuần tra cần ít nhất 2 điểm đích hợp lệ.'); return; }
    if (new Set(validMoves.map((move) => move.endpointId)).size !== validMoves.length) { setError('Không chọn trùng một điểm trong cùng tuyến.'); return; }
    const invalidSpeed = validMoves.some((move) => !Number.isFinite(Number(move.speed)) || Number(move.speed) <= 0 || Number(move.speed) > .3);
    if (invalidSpeed) { setError('Tốc độ mỗi chặng phải lớn hơn 0 và không quá 0,30 m/s.'); return; }
    if (!validMoves.every((move) => availableEndpoints.some((endpoint) => endpoint.endpointId === move.endpointId))) { setError('Có điểm đích không thuộc bản đồ đang chọn hoặc đã không sẵn sàng.'); return; }

    const routeMoves = returnToStart ? [...validMoves, { ...validMoves[0], returnMove: true }] : validMoves;
    const steps = routeMoves.map((move, index) => {
      const endpoint = availableEndpoints.find((item) => item.endpointId === move.endpointId);
      const stepCode = move.returnMove ? 'MOVE_RETURN_START' : `MOVE_${String(index + 1).padStart(2, '0')}`;
      return {
        taskCode: 'PATROL_ROUTE', stepType: 'MOVE', stepCode,
        stepName: move.returnMove ? `Quay về ${endpoint.endpointName}` : `Đi đến ${endpoint.endpointName}`,
        sequenceNo: index + 1, description: move.returnMove ? 'Kết thúc tuyến tại điểm xuất phát.' : `Điểm tuần tra ${index + 1}.`,
        paramsJson: { map_id: mapId, endpoint_id: endpoint.endpointId, mode: 'PATROL', max_speed_mps: Number(move.speed) },
        inputMappingJson: {}, timeoutSec: 300, maxAttempts: 2, retryDelaySec: 5, retryCodesJson: [], maxVisits: 1, auditLevel: 'BASIC',
      };
    });
    const transitions = steps.flatMap((step, index) => [
      { fromStepCode: step.stepCode, toStepCode: steps[index + 1]?.stepCode ?? null, outcome: 'SUCCESS', conditionJson: null, priority: 1, defaultTransition: true, terminalStatus: index === steps.length - 1 ? 'SUCCEEDED' : null },
      { fromStepCode: step.stepCode, toStepCode: null, outcome: 'FAILURE', conditionJson: null, priority: 1, defaultTransition: true, terminalStatus: 'RECOVERY_REQUIRED' },
      { fromStepCode: step.stepCode, toStepCode: null, outcome: 'TIMEOUT', conditionJson: null, priority: 1, defaultTransition: true, terminalStatus: 'RECOVERY_REQUIRED' },
    ]);
    setSaving(true); setError('');
    try {
      const saved = saveLocalGraph({
        workflow: {
          workflowCode: newPatrolCode(), versionNo: 1, workflowName: name.trim(), serviceType: 'PATROL', description: description.trim(),
          inputSchemaJson: { type: 'object' }, inputUiJson: {}, defaultInputsJson: {}, outputMappingJson: {}, requiredCapabilitiesJson: ['MOVE'],
          maxDurationSec: Math.max(1200, steps.length * 360), maxTotalVisits: steps.length, graphVersion: 3, schemaVersion: 3,
        },
        graph: {
          startStepCode: steps[0].stepCode,
          tasks: [{ taskCode: 'PATROL_ROUTE', taskName: 'Tuyến tuần tra', sequenceNo: 1, description: 'Chuỗi di chuyển qua các điểm tuần tra.', configJson: { map_id: mapId, route_kind: 'PATROL' } }],
          steps, transitions,
        },
      });
      await onSaved('Đã lưu tuyến trên thiết bị này. Mở Tuần tra để xem bản đồ và chạy mô phỏng; không gửi lệnh robot.', saved.workflow.workflowId);
    } catch (cause) {
      setError(cause?.message || 'Không thể tạo quy trình tuần tra.');
    } finally { setSaving(false); }
  };

  return <>
    <div className="workflow-editor-grid patrol-workflow-builder">
      <section className="workflow-panel editor-side">
        <span className="modal-kicker">TUYẾN LẤY TỪ WORKFLOW</span>
        <h2>Thông tin quy trình</h2>
        <Field label="Tên quy trình" value={name} onChange={setName} placeholder="Ví dụ: Tuần tra tầng 1" />
        <Field label="Mô tả" value={description} onChange={setDescription} placeholder="Mô tả mục đích tuyến" />
        <Field label="Bản đồ dùng cho toàn tuyến"><select value={mapId} disabled={loading} onChange={(event) => changeMap(event.target.value)}><option value="">Chọn bản đồ đã lưu</option>{maps.map((map) => <option key={map.mapId} value={map.mapId}>{map.mapName}{map.status === 'ACTIVE' ? ' · đang hoạt động' : ''}</option>)}</select></Field>
        <p className="preview-note">Tạo một tác vụ “Tuyến tuần tra”. Các bước MOVE bên phải là nguồn dữ liệu duy nhất mà màn hình Tuần tra sẽ đọc.</p>
        <label className="patrol-return-toggle"><input type="checkbox" checked={returnToStart} onChange={(event) => setReturnToStart(event.target.checked)} /> Thêm bước quay về điểm đầu sau chặng cuối</label>
      </section>
      <section className="workflow-panel editor-detail workflow-steps-panel">
        <span className="modal-kicker">TÁC VỤ DUY NHẤT · TUYẾN TUẦN TRA</span>
        <h2>Các chặng di chuyển</h2>
        <p>Chọn điểm đích đã tạo trong Bản đồ. Thứ tự tại đây chính là thứ tự robot đi qua ở màn hình Tuần tra.</p>
        {loading && <p className="preview-note">Đang tải bản đồ và điểm đích…</p>}
        {!loading && mapId && !availableEndpoints.length && <p className="workflow-save-error">Bản đồ này chưa có điểm đích khả dụng. Hãy tạo điểm đích trong Bản đồ trước.</p>}
        <div className="patrol-step-list">{moves.map((move, index) => <article key={index} className="patrol-step-config"><b>{String(index + 1).padStart(2, '0')}</b><div><label>Điểm đích<select value={move.endpointId} disabled={!mapId} onChange={(event) => updateMove(index, { endpointId: event.target.value })}><option value="">Chọn điểm đích</option>{availableEndpoints.map((endpoint) => <option key={endpoint.endpointId} value={endpoint.endpointId} disabled={moves.some((item, itemIndex) => itemIndex !== index && item.endpointId === endpoint.endpointId)}>{endpoint.endpointName}</option>)}</select></label><label>Tốc độ tối đa (m/s)<input type="number" min="0.01" max="0.3" step="0.01" value={move.speed} onChange={(event) => updateMove(index, { speed: event.target.value })} /></label></div><div className="patrol-step-actions"><button type="button" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="Đưa chặng lên">↑</button><button type="button" disabled={index === moves.length - 1} onClick={() => moveStep(index, 1)} aria-label="Đưa chặng xuống">↓</button><button type="button" disabled={moves.length <= 1} onClick={() => setMoves((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Xóa chặng">×</button></div></article>)}</div>
        <MarButton variant="subtle" onClick={() => setMoves((current) => [...current, { endpointId: '', speed: '0.08' }])}>+ Thêm bước MOVE</MarButton>
        {selectedEndpoints.length > 0 && <p className="preview-note">Tuyến sẽ đi: {selectedEndpoints.map((endpoint) => endpoint.endpointName).join(' → ')}{returnToStart ? ` → ${selectedEndpoints[0]?.endpointName}` : ''}.</p>}
      </section>
    </div>
    <footer className="workflow-actions"><MarButton className="create" onClick={save} disabled={saving || loading}>{saving ? 'Đang tạo…' : 'Tạo bản nháp tuyến tuần tra'}</MarButton><MarButton variant="subtle" onClick={onCancel} disabled={saving}>Quay lại</MarButton>{error && <p role="alert" className="workflow-save-error">{error}</p>}</footer>
  </>;
}

function Editor({ initialDetail, onSaved, onCancel }) {
  const workflow = initialDetail?.workflow;
  const [serviceType, setServiceType] = useState(workflow?.serviceType ?? 'CUSTOM');
  const [name, setName] = useState(workflow?.workflowName ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [code] = useState(() => workflow?.workflowCode ?? newWorkflowCode());
  const [workflowId, setWorkflowId] = useState(workflow?.workflowId ?? null);
  const [tasks, setTasks] = useState(() => editorTasks(initialDetail));
  const [activeTask, setActiveTask] = useState(() => editorTasks(initialDetail)[0]?.id ?? null);
  const [showTypes, setShowTypes] = useState(false);
  const [configStep, setConfigStep] = useState(null);
  const [deletedTasks, setDeletedTasks] = useState([]);
  const [deletedSteps, setDeletedSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = tasks.find((task) => task.id === activeTask);

  const addTask = () => {
    const id = crypto.randomUUID();
    const task = { id, code: `TASK_${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`, name: `Tác vụ ${tasks.length + 1}`, steps: [] };
    setTasks((current) => [...current, task]);
    setActiveTask(id);
  };
  const removeTask = (task) => {
    if (!window.confirm(`Xóa tác vụ “${task.name}” và các bước của nó?`)) return;
    setDeletedSteps((current) => [...current, ...task.steps.filter((step) => step.stepId).map((step) => step.stepId)]);
    if (task.taskId) setDeletedTasks((current) => [...current, task.taskId]);
    setTasks((current) => current.filter((item) => item.id !== task.id));
    if (activeTask === task.id) setActiveTask(null);
    setConfigStep(null);
  };
  const addStep = (type) => {
    const id = crypto.randomUUID();
    const previousMove = tasks.flatMap(task => task.steps).findLast(step => step.type === 'MOVE');
    const step = { id, code: `STEP_${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`, type, values: type === 'MOVE' ? { map_id: serviceType === 'PATROL' ? previousMove?.values.map_id ?? '' : '', endpoint_id: '', mode: serviceType === 'PATROL' ? 'PATROL' : 'NORMAL', max_speed_mps: .08 } : Object.fromEntries(stepFields[type].map((field) => [field, ''])) };
    setTasks((current) => current.map((task) => task.id === activeTask ? { ...task, steps: [...task.steps, step] } : task));
    setShowTypes(false);
    setConfigStep(step);
  };
  const updateConfigStep = (nextStep) => {
    setConfigStep(nextStep);
    setTasks((current) => current.map((task) => task.id === activeTask ? { ...task, steps: task.steps.map((step) => step.id === nextStep.id ? nextStep : step) } : task));
  };
  const removeStep = (step) => {
    if (step.stepId) setDeletedSteps((current) => [...current, step.stepId]);
    setTasks((current) => current.map((task) => task.id === activeTask ? { ...task, steps: task.steps.filter((item) => item.id !== step.id) } : task));
    if (configStep?.id === step.id) setConfigStep(null);
  };
  const reorderStep = (index, offset) => setTasks(current => current.map(task => {
    if (task.id !== activeTask) return task;
    const steps = [...task.steps];
    [steps[index], steps[index + offset]] = [steps[index + offset], steps[index]];
    return { ...task, steps };
  }));
  const save = async () => {
    if (saving) return;
    if (!name.trim()) { setError('Nhập tên quy trình trước khi lưu.'); return; }
    if (tasks.some((task) => !task.name.trim())) { setError('Mỗi tác vụ cần có tên.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = workflowPayload({ code, versionNo: workflow?.versionNo ?? 1, name, description, source: workflow });
      if (serviceType === 'PATROL') {
        // Never silently flatten existing branches or recovery actions.
        if (initialDetail?.transitions?.length && (orderedPatrolSteps(initialDetail).issues.length || orderedPatrolSteps(initialDetail).steps.some((step, index) => step.stepId !== editorTasks(initialDetail).flatMap(task => task.steps)[index]?.stepId) || initialDetail.transitions.some(item => item.outcome !== 'SUCCESS' && (item.toStepId || item.terminalStatus !== 'RECOVERY_REQUIRED' || item.conditionJson != null)))) throw new Error('Quy trình có nhánh, thứ tự đồ thị khác thứ tự bước hoặc xử lý lỗi riêng. Không thể thay bằng tuyến tuần tra đơn giản; hãy tạo tuyến mới để giữ nguyên quy trình hiện có.');
        const graph = buildPatrolGraph(tasks);
        const { maps, endpoints } = localMapCatalog();
        if (graph.steps.some(step => !maps.some(map => map.mapId === step.paramsJson.map_id) || !endpoints.some(endpoint => endpoint.endpointId === step.paramsJson.endpoint_id && endpoint.mapId === step.paramsJson.map_id && endpoint.active !== false && endpoint.accessible !== false))) throw new Error('Có điểm đích không còn khả dụng hoặc sai bản đồ. Hãy chọn lại trong từng bước Di chuyển.');
        Object.assign(body, { serviceType: 'PATROL', schemaVersion: 3, graphVersion: 3, requiredCapabilitiesJson: ['MOVE'], maxTotalVisits: graph.steps.length, maxDurationSec: Math.max(1200, graph.steps.length * 360) });
        const saved = saveLocalGraph({ workflow: { ...body, workflowId }, graph });
        setWorkflowId(saved.workflow.workflowId);
        await onSaved('Đã lưu tuyến trên thiết bị này. Mở Tuần tra để xem bản đồ và mô phỏng. Bản trên máy chủ không thay đổi.', saved.workflow.workflowId);
        return;
      }
      if (tasks.some(task => task.steps.some(step => step.type === 'MOVE' && step.values.map_id === LOCAL_MAP_ID))) throw new Error('Các điểm này thuộc bản đồ cục bộ. Chọn mục đích “Tuyến tuần tra” để lưu và chạy thử; không gửi điểm cục bộ lên máy chủ.');
      const savedWorkflow = workflowId ? await workflowApi.update(workflowId, body) : await workflowApi.create(body);
      const id = savedWorkflow.workflowId;
      setWorkflowId(id);

      for (const stepId of deletedSteps) {
        await workflowApi.deleteStep(id, stepId);
        setDeletedSteps((current) => current.filter((item) => item !== stepId));
      }
      for (const taskId of deletedTasks) {
        await workflowApi.deleteTask(id, taskId);
        setDeletedTasks((current) => current.filter((item) => item !== taskId));
      }

      let nextTaskSequence = Math.max(0, ...tasks.map((task) => task.sequenceNo ?? 0)) + 1;
      let nextStepSequence = Math.max(0, ...tasks.flatMap((task) => task.steps.map((step) => step.sequenceNo ?? 0))) + 1;
      for (const task of tasks) {
        const taskBody = taskPayload(task, task.sequenceNo ?? nextTaskSequence++);
        const savedTask = task.taskId
          ? await workflowApi.updateTask(id, task.taskId, taskBody)
          : await workflowApi.addTask(id, taskBody);
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, taskId: savedTask.taskId, sequenceNo: savedTask.sequenceNo } : item));
        for (const step of task.steps) {
          const stepBody = stepPayload(step, savedTask.taskId, step.sequenceNo ?? nextStepSequence++);
          const savedStep = step.stepId
            ? await workflowApi.updateStep(id, step.stepId, stepBody)
            : await workflowApi.addStep(id, stepBody);
          setTasks((current) => current.map((item) => item.id === task.id ? {
            ...item, steps: item.steps.map((part) => part.id === step.id ? { ...part, stepId: savedStep.stepId, sequenceNo: savedStep.sequenceNo } : part),
          } : item));
        }
      }
      await onSaved();
    } catch (cause) {
      setError(cause?.message || 'Không thể lưu quy trình. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <div className="workflow-editor-grid">
      <section className="workflow-panel editor-side">
        <h2>Quy trình</h2>
        <Field label="Tên quy trình" value={name} onChange={setName} placeholder="Nhập tên quy trình" />
        <Field label="Mô tả" value={description} onChange={setDescription} placeholder="Mô tả ngắn" />
        <Field label="Mục đích quy trình"><select value={serviceType} disabled={workflow?.serviceType === 'PATROL'} onChange={event => setServiceType(event.target.value)}><option value={workflow?.serviceType === 'PATROL' ? 'CUSTOM' : workflow?.serviceType ?? 'CUSTOM'}>Quy trình nghiệp vụ</option><option value="PATROL">Tuyến tuần tra</option></select></Field>
        <p className="wf-link-note">{serviceType === 'PATROL' ? 'Thêm các bước Di chuyển theo thứ tự ghé thăm, chọn điểm trên cùng bản đồ. Khi lưu, tuyến được liên kết sang Tuần tra để xem bản đồ và chạy mô phỏng. Bản nháp lưu trên thiết bị này, không thay đổi quy trình máy chủ.' : 'Nếu đây là chuỗi đi qua nhiều điểm, chọn “Tuyến tuần tra” để liên kết với màn Tuần tra. Chỉ đặt tên “Tuần tra” chưa xác định loại quy trình.'}</p>
        <div className="task-heading"><h2>Tác vụ · {tasks.length}</h2><button type="button" onClick={addTask} aria-label="Thêm tác vụ">+</button></div>
        {tasks.length === 0 && <p className="task-empty-note">Chưa có tác vụ. Bấm + để thêm.</p>}
        {tasks.map((task) => <div className="editor-task-item" key={task.id}>
          <button className={activeTask === task.id ? 'editor-side-button active' : 'editor-side-button'} type="button" onClick={() => { setActiveTask(task.id); setConfigStep(null); }}>{task.name}<small>{task.steps.length} bước</small></button>
          <button className="editor-delete-button" type="button" onClick={() => removeTask(task)} aria-label={`Xóa ${task.name}`}>×</button>
        </div>)}
      </section>
      {configStep ? <StepConfigPanel step={configStep} onChange={updateConfigStep} onDone={() => setConfigStep(null)} /> : <section className="workflow-panel editor-detail workflow-steps-panel">
        <span className="modal-kicker">CÁC BƯỚC QUY TRÌNH</span>
        <h2>{selected?.name || 'Chọn tác vụ'}</h2>
        {selected ? <><Field label="Tên tác vụ" value={selected.name} onChange={(value) => setTasks((current) => current.map((task) => task.id === selected.id ? { ...task, name: value } : task))} placeholder="Nhập tên tác vụ" /><p>Chọn bước để cấu hình hoặc thêm bước mới.</p><div className="step-table"><div className="step-table-head"><span>#</span><span>LOẠI BƯỚC</span><span>TRẠNG THÁI</span></div>{selected.steps.length ? selected.steps.map((step, index) => <div className="editor-step-item" key={step.id}><button className="step-table-row" type="button" onClick={() => setConfigStep(step)}><span>{String(index + 1).padStart(2, '0')}</span><b>{step.type === 'MOVE' ? 'Di chuyển' : step.type}</b><em>{Object.values(step.values).some(Boolean) ? 'Đã cấu hình' : 'Chưa cấu hình'}</em></button>{serviceType === 'PATROL' && <span className="wf-step-order"><button type="button" disabled={index === 0} onClick={() => reorderStep(index, -1)} aria-label={`Đưa bước ${index + 1} lên`}>↑</button><button type="button" disabled={index === selected.steps.length - 1} onClick={() => reorderStep(index, 1)} aria-label={`Đưa bước ${index + 1} xuống`}>↓</button></span>}<button className="editor-delete-button" type="button" onClick={() => removeStep(step)} aria-label={`Xóa bước ${index + 1}`}>×</button></div>) : <div className="step-empty-state">Chưa có bước nào.</div>}</div><MarButton variant="subtle" onClick={() => setShowTypes(true)}>+ Thêm bước</MarButton></> : <SelectTaskPanel />}
      </section>}
    </div>
    {showTypes && <div className="type-modal" onClick={() => setShowTypes(false)}><div className="type-modal-card" onClick={(event) => event.stopPropagation()}><header><div><span className="modal-kicker">THƯ VIỆN HÀNH ĐỘNG</span><h2>Thêm bước vào tác vụ</h2><p>Chọn loại bước cần cấu hình.</p></div><button className="type-modal-close" type="button" onClick={() => setShowTypes(false)} aria-label="Đóng">×</button></header><div>{stepTypes.map((type) => <button type="button" key={type} onClick={() => addStep(type)}><i>{stepTypeCopy[type][0]}</i><span><small>{type}</small><b>{type.replaceAll('_', ' ')}</b><em>{stepTypeCopy[type][1]}</em></span><strong>＋</strong></button>)}</div></div></div>}
    <footer className="workflow-actions"><MarButton className="create" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu quy trình'}</MarButton><MarButton variant="subtle" onClick={onCancel} disabled={saving}>Quay lại</MarButton>{error && <p role="alert" className="workflow-save-error">{error}</p>}</footer>
  </>;
}

function WorkflowTypeChoice({ onPatrol, onStandard, onCancel }) {
  return <section className="workflow-panel workflow-type-choice">
    <span className="modal-kicker">TẠO QUY TRÌNH</span>
    <h2>Quy trình này dùng để làm gì?</h2>
    <p>Chọn “Tuyến tuần tra” khi robot cần đi qua nhiều điểm đích theo thứ tự. Chọn quy trình khác cho các tác vụ nghiệp vụ độc lập.</p>
    <div>
      <button type="button" onClick={onPatrol}><strong>Tuyến tuần tra</strong><span>Một tác vụ với chuỗi MOVE. Mỗi MOVE chọn một điểm đích trên cùng bản đồ.</span><em>Mở trình tạo tuyến →</em></button>
      <button type="button" onClick={onStandard}><strong>Quy trình khác</strong><span>Tạo tác vụ và bước tự do từ thư viện hành động hiện có.</span><em>Mở trình thiết kế →</em></button>
    </div>
    <MarButton variant="subtle" onClick={onCancel}>Quay lại</MarButton>
  </section>;
}

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedWorkflowId = searchParams.get('workflowId');
  const [savedPatrolId, setSavedPatrolId] = useState('');
  const previewPatrol = id => navigate(`/admin?screen=Patrol&workflowId=${encodeURIComponent(id)}`);
  const [mode, setMode] = useState('library');
  const [editing, setEditing] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const [pageMessage, setPageMessage] = useState('');
  const [definitions, setDefinitions] = useState([]);
  const [definitionError, setDefinitionError] = useState('');
  const [definitionsLoading, setDefinitionsLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const creating = mode === 'create' || mode === 'patrol';

  const loadDefinitions = async () => {
    setDefinitionsLoading(true);
    try {
      setDefinitions(current => mergeLocalDesigns(current.filter(item => !item.localOnly)));
      const page = await loadAllPages(workflowApi.list);
      setDefinitions(mergeLocalDesigns(latestWorkflowVersions(Array.isArray(page) ? page : page?.content ?? [])));
      setDefinitionError('');
    } catch (error) {
      setDefinitionError(error.message || 'Không tải được danh sách quy trình.');
      try { setDefinitions(mergeLocalDesigns([])); } catch (cause) { setDefinitionError(cause.message); }
    } finally {
      setDefinitionsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    loadAllPages(workflowApi.list).then((page) => {
      if (!current) return;
      setDefinitions(mergeLocalDesigns(latestWorkflowVersions(Array.isArray(page) ? page : page?.content ?? [])));
      setDefinitionError('');
    }).catch((error) => { if (current) { setDefinitionError(error.message || 'Không tải được quy trình máy chủ.'); try { setDefinitions(mergeLocalDesigns([])); } catch (cause) { setDefinitionError(cause.message); } } })
      .finally(() => { if (current) setDefinitionsLoading(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (!linkedWorkflowId) return;
    let current = true;
    getDesign(linkedWorkflowId, workflowApi.get).then(detail => {
      if (!current) return;
      if (!['DRAFT', 'VALIDATED'].includes(detail.workflow.status) && detail.workflow.serviceType !== 'PATROL') { setPageMessage('Đây là phiên bản đã xuất bản, không sửa trực tiếp. Hãy tạo tuyến mới nếu cần thay đổi.'); return; }
      setEditing(detail); setEditorKey(key => key + 1); setMode('create');
    }).catch(cause => { if (current) setPageMessage(cause.message || 'Không mở được quy trình được liên kết.'); });
    return () => { current = false; };
  }, [linkedWorkflowId]);

  const openCreate = () => {
    setEditing(null);
    setEditorKey((key) => key + 1);
    setPageMessage('');
    setMode('choose');
  };
  const openExisting = async (definition) => {
    if (!['DRAFT', 'VALIDATED'].includes(definition.status) && definition.serviceType !== 'PATROL') {
      setPageMessage('Quy trình đã xuất bản không thể sửa trực tiếp. Hãy tạo bản nháp mới.');
      return;
    }
    try {
      const detail = await getDesign(definition.workflowId, workflowApi.get);
      setEditing(detail);
      setEditorKey((key) => key + 1);
      setPageMessage('');
      setMode('create');
    } catch (error) { setPageMessage(error.message || 'Không mở được quy trình.'); }
  };
  const removeDefinition = async (definition) => {
    const published = definition.status === 'PUBLISHED';
    const label = published ? 'quy trình đã xuất bản' : 'bản nháp';
    const warning = published ? ' Quy trình sẽ không còn nhận nhiệm vụ mới.' : '';
    if (!window.confirm(`Xóa ${label} “${definition.workflowName}”?${warning}${definition.localOnly ? ' Chỉ xóa bản trên thiết bị, bản máy chủ (nếu có) vẫn giữ nguyên.' : ''}`)) return;
    try {
      if (definition.localOnly) removeLocalDesign(definition.workflowId);
      else await workflowApi.remove(definition.workflowId);
      setPageMessage(definition.localOnly ? 'Đã xóa bản nháp trên thiết bị. Bản máy chủ (nếu có) được giữ nguyên.' : `Đã xóa ${label}.`);
      await loadDefinitions();
    } catch (error) { setPageMessage(error.message || `Không xóa được ${label}.`); }
  };
  const validateDefinition = async (definition) => {
    if (definition.localOnly) return;
    setActionId(definition.workflowId);
    try {
      await workflowApi.validate(definition.workflowId);
      setPageMessage('Đã xác thực workflow. Có thể xuất bản khi không còn cảnh báo chặn.');
      await loadDefinitions();
    } catch (error) { setPageMessage(error.message || 'Không thể xác thực workflow.'); }
    finally { setActionId(''); }
  };
  const publishDefinition = async (definition) => {
    if (definition.localOnly) return;
    setActionId(definition.workflowId);
    try {
      await workflowApi.publish(definition.workflowId);
      setPageMessage('Đã xuất bản workflow. Tuyến hiện xuất hiện trong màn hình Tuần tra.');
      await loadDefinitions();
    } catch (error) { setPageMessage(error.message || 'Không thể xuất bản workflow.'); }
    finally { setActionId(''); }
  };
  const afterSave = async (message = 'Đã lưu quy trình vào máy chủ.', patrolId = '') => {
    setPageMessage(message);
    setSavedPatrolId(patrolId);
    setMode('library');
    await loadDefinitions();
  };

  return (
    <div className="workflows-screen workflow-page">
      <Sidebar />
      <main className="workflows-main">
        <header className="workflows-header">
          <h1>{vi(mode === 'patrol' ? 'Tạo tuyến tuần tra' : creating ? (editing ? 'Chỉnh sửa quy trình' : 'Tạo quy trình') : mode === 'choose' ? 'Chọn loại quy trình' : 'Quy trình')}</h1>
          <Tabs />
          <p className="preview-note">
            {vi(mode === 'patrol' ? 'Một tác vụ, nhiều bước MOVE. Các endpoint được dùng lại trực tiếp ở màn hình Tuần tra.' : creating ? 'Đặt tên, thêm tác vụ và lưu bản nháp quy trình.' : mode === 'choose' ? 'Chọn đúng loại để tránh tạo lại tuyến ở hai màn hình.' : 'Chọn bản nháp để chỉnh sửa hoặc tạo quy trình mới.')}
          </p>
          {definitionError && <p className="preview-note" role="alert">{definitionError} Các bản nháp trên thiết bị vẫn được giữ lại.</p>}
          {pageMessage && <p className="preview-note" role="status">{pageMessage}</p>}
          {savedPatrolId && !creating && <MarButton variant="subtle" onClick={() => previewPatrol(savedPatrolId)}>Xem tuyến vừa lưu trong Tuần tra →</MarButton>}
        </header>

        {vi(mode === 'create' ? <Editor key={editorKey} initialDetail={editing} onSaved={afterSave} onCancel={() => { setMode('library'); loadDefinitions(); }} /> : mode === 'patrol' ? <PatrolWorkflowEditor key={editorKey} onSaved={afterSave} onCancel={() => setMode('library')} /> : mode === 'choose' ? <WorkflowTypeChoice onPatrol={() => { setEditorKey((key) => key + 1); setMode('patrol'); }} onStandard={() => { setEditorKey((key) => key + 1); setMode('create'); }} onCancel={() => setMode('library')} /> : <Library onCreate={openCreate} onOpen={openExisting} onRemove={removeDefinition} onValidate={validateDefinition} onPublish={publishDefinition} actionId={actionId} definitions={definitions} loading={definitionsLoading} error={definitionError} />)}
      </main>
    </div>
  );
}
