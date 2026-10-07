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
  width: 100%;
  min-height: 77px;
  border: 0;
  border-radius: 6px;
  background: #f1f5f9;
  cursor: pointer;
  padding: 14px 16px;
  text-align: left;
  color: inherit;
  font: inherit;
}

.workflow-card:hover {
  background: #e8eef6;
}

.workflow-card strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
}

.workflow-card span {
  display: block;
  margin-top: 12px;
  color: var(--mar-muted, #475569);
  font-size: 12px;
}

.workflow-card b {
  margin: 0 10px;
}

.workflow-card em {
  margin-left: 12px;
  font-style: normal;
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
  grid-template-columns: 320px minmax(620px, 824px);
  gap: 20px;
  margin-top: 30px;
}

.editor-side,
.editor-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
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
.sim-library, .sim-inspector { padding: 18px; overflow: auto; background: #fbfdff; }
.sim-library { border-right: 1px solid #dce7fb; }
.sim-inspector { border-left: 1px solid #dce7fb; }
.sim-kicker { margin: 0 0 6px; color: #477cf4; font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
.sim-library h2, .sim-inspector h2 { margin: 0; color: #193b70; font-size: 15px; }
.sim-library > p { margin: 7px 0 14px; color: #7188aa; font-size: 11px; line-height: 1.45; }
.sim-workflow-list { display: grid; gap: 8px; }
.sim-workflow-list button { width: 100%; border: 1px solid transparent; border-radius: 9px; background: transparent; color: #334155; cursor: pointer; padding: 11px; text-align: left; transition: .18s ease; }
.sim-workflow-list button:hover { background: #eff6ff; }
.sim-workflow-list button.active { border-color: #bfdbfe; background: #eaf2ff; color: #1d4ed8; }
.sim-workflow-list strong, .sim-workflow-list small { display: block; }
.sim-workflow-list strong { font-size: 12px; line-height: 1.35; }
.sim-workflow-list small { margin-top: 5px; color: #7188aa; font-size: 9px; }
.sim-new-workflow { width: 100%; margin-top: 14px; }
.sim-map-column { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; background: #f8fbff; }
.sim-map-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #dce7fb; }
.sim-map-head strong { color: #193b70; font-size: 14px; }
.sim-map-head span { color: #7188aa; font-size: 10px; }
.sim-map-canvas { position: relative; min-height: 0; margin: 14px; overflow: hidden; border: 1px solid #bfd2ef; border-radius: 10px; background: #edf5ff; }
.sim-map-canvas > img { width: 100%; height: 100%; object-fit: cover; opacity: .84; }
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
.sim-name { margin: 15px 0 4px !important; color: #193b70 !important; font-size: 17px !important; line-height: 1.35; }
.sim-code { margin: 0 0 16px; color: #7188aa; font-size: 10px; }
.sim-progress { height: 7px; margin: 14px 0 6px; overflow: hidden; border-radius: 999px; background: #dbeafe; }
.sim-progress i { display: block; height: 100%; border-radius: inherit; background: #2f80ff; transition: width .35s ease; }
.sim-progress-label { display: flex; justify-content: space-between; color: #7188aa; font-size: 10px; }
.sim-steps { display: grid; gap: 8px; margin-top: 20px; }
.sim-step { display: grid; grid-template-columns: 25px 1fr; gap: 9px; align-items: center; padding: 9px; border: 1px solid #e0e9f7; border-radius: 8px; background: #fff; }
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
`;
injectStyles('mediassist-style-pages-Workflows-WorkflowsPage-jsx', inlineStyles);

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../features/admin/components/AdminSidebar.jsx';
import { clearSession } from '../../features/auth/session.js';
import { workflowApi } from '../../features/workflows/workflowApi.js';

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

export function MarButton({ children, variant = 'primary', className = '', onClick }) {
  return (
    <button className={`wf-button ${variant} ${className}`.trim()} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function Field({ label, value }) {
  return (
    <label className="wf-field">
      <span>{label}</span>
      <input value={value} readOnly />
    </label>
  );
}

function Tabs() {
  const navigate = useNavigate();
  return (
    <div className="workflow-tabs">
      <MarButton className="tab-button">Workflows</MarButton>
      <MarButton className="tab-button" variant="subtle" onClick={() => navigate('/workstations')}>Dispatch</MarButton>
      <MarButton className="tab-button" variant="subtle" onClick={() => navigate('/workstations?view=jobs')}>Jobs</MarButton>
    </div>
  );
}

export function DispatchSimulationPreview({ onCreate, definitions, loading, error }) {
  const available = definitions.length ? definitions : (loading ? [] : workflows);
  const [selectedKey, setSelectedKey] = useState(null);
  const [runStatus, setRunStatus] = useState('READY');
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const getKey = (workflow) => workflow.workflowId || workflow.workflowCode || workflow.code || workflow.name;
  const selected = available.find((workflow) => getKey(workflow) === selectedKey) || available[0];
  const routePoints = [[89.6, 0], [89.6, 40], [70.5, 40], [68.2, 52.4], [62.2, 52.4], [29.2, 52.4], [29.2, 68.2], [14.8, 68.2]];
  const totalSeconds = 12;
  const progress = Math.min(elapsed / totalSeconds, 1);
  const scaled = progress * (routePoints.length - 1);
  const pointIndex = Math.min(Math.floor(scaled), routePoints.length - 2);
  const segment = scaled - pointIndex;
  const [fromX, fromY] = routePoints[pointIndex];
  const [toX, toY] = routePoints[Math.min(pointIndex + 1, routePoints.length - 1)];
  const robotPosition = { left: `${fromX + (toX - fromX) * segment}%`, top: `${fromY + (toY - fromY) * segment}%` };
  const sequence = ['AUTHENTICATE', 'MOVE', 'INTERACT', 'NOTIFY'];
  const completedSteps = Math.min(sequence.length, Math.floor(progress * sequence.length));
  const currentLabel = runStatus === 'SUCCEEDED' ? 'Simulation completed' : runStatus === 'RUNNING' ? ['Checking workflow inputs', 'Leaving Pharmacy Pickup', 'Navigating main corridor', 'Approaching destination'][Math.min(completedSteps, 3)] : 'Choose a workflow and press Run';

  useEffect(() => {
    if (!selectedKey && available[0]) setSelectedKey(getKey(available[0]));
  }, [available, selectedKey]);
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

  return <section className="simulation-studio" aria-label="Workflow simulation workspace">
    <aside className="sim-library">
      <p className="sim-kicker">Workflow library</p>
      <h2>Available workflows</h2>
      <p>Select an existing workflow. All workflows use the same Hospital Floor 1 simulation map.</p>
      <div className="sim-workflow-list">
        {available.map((workflow) => {
          const key = getKey(workflow);
          return <button className={key === getKey(selected) ? 'active' : ''} type="button" key={key} onClick={() => chooseWorkflow(key)}>
            <strong>{workflow.workflowName || workflow.name}</strong>
            <small>{workflow.workflowCode || workflow.code} · {workflow.status || 'DRAFT'}</small>
          </button>;
        })}
        {!loading && !available.length && <p className="preview-note">{error || 'No workflow definitions returned by the backend.'}</p>}
      </div>
      <MarButton className="sim-new-workflow" variant="subtle" onClick={onCreate}>+ Create workflow</MarButton>
    </aside>
    <section className="sim-map-column">
      <header className="sim-map-head"><strong>Hospital Floor 1 · Shared simulation map</strong><span>1 robot · 8 zones</span></header>
      <div className="sim-map-canvas">
        <img src={workflowRouteMap} alt="Shared Hospital Floor 1 simulation map" />
        <span className={runStatus === 'READY' ? 'sim-robot is-idle' : 'sim-robot'} style={robotPosition}><img src={simulationRover} alt="" /></span>
        <span className="sim-map-caption">{runStatus === 'RUNNING' ? currentLabel : runStatus === 'SUCCEEDED' ? 'Route complete · Room 305' : 'Pharmacy Pickup → Room 305'}</span>
      </div>
      <footer className="sim-runbar">
        <div className="sim-run-status"><strong>{runStatus === 'READY' ? 'Ready to run' : currentLabel}</strong><span>{selected ? (selected.workflowName || selected.name) : 'Loading workflow definitions…'}</span></div>
        <span className="sim-time">{time}</span>
        <div className="sim-speed" aria-label="Simulation speed">{[1, 2, 5].map((value) => <button className={speed === value ? 'active' : ''} type="button" key={value} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
        <MarButton variant="subtle" onClick={reset}>Reset</MarButton>
        <MarButton onClick={run}>{runStatus === 'RUNNING' ? 'Running…' : runStatus === 'SUCCEEDED' ? 'Run again' : '▶ Run'}</MarButton>
      </footer>
    </section>
    <aside className="sim-inspector">
      <p className="sim-kicker">Workflow configuration</p>
      <h2 className="sim-name">{selected ? (selected.workflowName || selected.name) : 'Loading workflow…'}</h2>
      <p className="sim-code">{selected ? `${selected.workflowCode || selected.code} · ${selected.status || 'DRAFT'}` : 'Workflow definition API'}</p>
      <div className="sim-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      <div className="sim-progress-label"><span>Simulation progress</span><b>{Math.round(progress * 100)}%</b></div>
      <div className="sim-steps">{sequence.map((step, index) => <article className={index < completedSteps ? 'sim-step done' : index === completedSteps && runStatus === 'RUNNING' ? 'sim-step current' : 'sim-step'} key={step}><b>{index < completedSteps || runStatus === 'SUCCEEDED' ? '✓' : String(index + 1).padStart(2, '0')}</b><div><strong>{step.replace('_', ' ')}</strong><small>{index < completedSteps || runStatus === 'SUCCEEDED' ? 'Completed' : index === completedSteps && runStatus === 'RUNNING' ? 'Running now' : 'Waiting'}</small></div></article>)}</div>
    </aside>
  </section>;
}

function Library({ saved, onCreate, onOpenDraft, definitions, loading, error }) {
  return (
    <div className="workflows-grid">
      <section className="workflow-panel library-panel">
        <h2>WORKFLOW DEFINITIONS · {loading ? 'LOADING' : definitions.length}</h2>
        <div className="workflow-list">
          {definitions.map((workflow) => (
            <button className="workflow-card" type="button" key={workflow.workflowId || workflow.code} onClick={onCreate}>
              <strong>{workflow.workflowName || workflow.name}</strong>
              <span>{workflow.workflowCode || workflow.code}<b>·</b>{workflow.status || ((workflow.steps || 0) + ' steps')}<em>→</em></span>
            </button>
          ))}
          {!loading && !definitions.length && <p className="preview-note">{error || 'No workflow definitions returned by the backend.'}</p>}
        </div>
      </section>
      <aside className="workflow-panel action-panel">
        {saved ? <><h2>MY WORKFLOWS</h2><h3>New workflow</h3><p>DRAFT · New tasks</p><MarButton className="full" onClick={onOpenDraft}>Open Draft</MarButton><MarButton className="full" variant="subtle" onClick={onCreate}>+ Create Workflow</MarButton><h2>WORKFLOW DEFINITIONS</h2><p>Definitions are loaded from the backend catalog.</p></> : <><h2>CREATE A WORKFLOW</h2><p>Build a workflow, define its tasks, and configure its available step types.</p><MarButton className="full" onClick={onCreate}>+ Create Workflow</MarButton><h2>WORKFLOW DEFINITIONS</h2><p>Select an existing workflow to inspect its configuration.</p></>}
      </aside>
    </div>
  );
}

function EditorSide({ activeTask, screen, setScreen, setActiveTask, customTask }) {
  const allTasks = customTask ? [...tasks, 'Confirm delivery'] : tasks;

  return (
    <section className="workflow-panel editor-side">
      <h2>WORKFLOW</h2>
      <Field label="Name" value="New workflow" />
      <Field label="Description" value="Add a description..." />
      <div className="task-heading">
        <h2>TASKS · 4 DEFAULTS</h2>
        {screen !== 'create' ? <button type="button" onClick={() => setScreen('add-task')}>+</button> : null}
      </div>
      {allTasks.map((task) => (
        <button
          className={activeTask === task ? 'editor-side-button active' : 'editor-side-button'}
          type="button"
          key={task}
          onClick={() => {
            setActiveTask(task);
            setScreen(task === 'Confirm delivery' ? 'custom-task' : 'task-empty');
          }}
        >
          {task}
        </button>
      ))}
      <h2 className="endpoint-heading">ENDPOINT CONFIGURATION</h2>
      <button className={screen === 'options' || screen === 'queue-exit' ? 'editor-side-button small active' : 'editor-side-button small'} type="button" onClick={() => setScreen('options')}>
        Options ›
      </button>
      <button className={screen === 'marker' || screen === 'marker-sensors' ? 'editor-side-button small active' : 'editor-side-button small'} type="button" onClick={() => setScreen('marker')}>
        Marker Options ›
      </button>
    </section>
  );
}

function SelectTaskPanel() {
  return (
    <section className="workflow-panel editor-detail">
      <h2>SELECT A TASK</h2>
      <h3>Select Move, Load, Transport or Unload to build its step sequence.</h3>
      <p>Each task has an ordered list of steps. Use + Add Step to choose from the step type library.</p>
    </section>
  );
}

function TaskPanel({ task, screen, setScreen }) {
  const steps = screen === 'two-steps' ? ['MOVE', 'INTERACT'] : screen === 'one-step' ? ['MOVE'] : [];

  return (
    <section className="workflow-panel editor-detail">
      <h2>TASK</h2>
      <h3 className="large">{task}</h3>
      {screen === 'step-types' ? (
        <>
          <MarButton className="wide" variant="subtle">Select step type ▴</MarButton>
          <div className="step-dropdown">
            {stepTypes.map((type, index) => (
              <button type="button" key={type} onClick={() => setScreen(index === 1 ? 'two-steps' : 'one-step')}>
                {type}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2>STEP SEQUENCE · {steps.length ? `${steps.length} ${steps.length === 1 ? 'STEP' : 'STEPS'}` : 'EMPTY'}</h2>
          {steps.length ? (
            <>
              {steps.map((step, index) => (
                <div className="step-row" key={step}>
                  {String(index + 1).padStart(2, '0')}
                  <span>{step}</span>
                </div>
              ))}
              <p>Step type selected from the library. Configuration uses the predefined defaults.</p>
            </>
          ) : (
            <p>No steps yet. Add a step from the library.</p>
          )}
          <MarButton className="wide" variant="subtle" onClick={() => setScreen('step-types')}>+ Add Step</MarButton>
        </>
      )}
    </section>
  );
}

function OptionsPanel({ screen, setScreen }) {
  if (screen === 'queue-exit') {
    return (
      <section className="workflow-panel editor-detail">
        <h2>OPTIONS / QUEUE & EXIT</h2>
        <p>Endpoint template · Task sequences</p>
        <h2>QUEUE</h2>
        <p>Steps performed while waiting to access the endpoint.</p>
        <MarButton className="wide" variant="subtle">+ Add Queue Step</MarButton>
        <h2>EXIT</h2>
        <p>Steps performed when leaving the endpoint.</p>
        <MarButton className="wide" variant="subtle">+ Add Exit Step</MarButton>
      </section>
    );
  }

  return (
    <section className="workflow-panel editor-detail">
      <h2>OPTIONS</h2>
      <p>Endpoint-related settings</p>
      <MarButton className="wide" variant="subtle" onClick={() => setScreen('queue-exit')}>Queue & Exit ›</MarButton>
      <MarButton className="wide" variant="subtle" onClick={() => setScreen('marker')}>Marker Options ›</MarButton>
      <p>Configure how the robot waits, leaves the endpoint and approaches its marker.</p>
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
      <h2>MARKER OPTIONS</h2>
      <p>Endpoint template · Dock marker geometry and behavior</p>
      <div className="marker-grid">
        {fields.map(([label, value]) => <Field label={label} value={value} key={label} />)}
      </div>
      <label className="sensor-toggle">
        <input type="checkbox" checked={sensors} readOnly />
        Sensor monitoring
      </label>
      {!sensors ? <MarButton className="wide" variant="subtle" onClick={() => setScreen('marker-sensors')}>Turn Sensor Monitoring On</MarButton> : null}
    </section>
  );
}

function AddTaskPanel({ setScreen, setActiveTask }) {
  return (
    <section className="workflow-panel editor-detail">
      <h2>NEW TASK</h2>
      <Field label="Task name" value="Confirm delivery" />
      <p>The task starts empty. Add steps from the same step type library.</p>
      <MarButton className="wide" onClick={() => {
        setActiveTask('Confirm delivery');
        setScreen('custom-task');
      }}>
        Add Task
      </MarButton>
      <MarButton className="wide" variant="subtle" onClick={() => setScreen('create')}>Cancel</MarButton>
    </section>
  );
}

function ReviewPanel() {
  return (
    <section className="workflow-panel editor-detail">
      <h2>WORKFLOW DRAFT</h2>
      <Field label="Name" value="New workflow" />
      <h2>DEFAULT TASKS</h2>
      <h3 className="large">Move → Load → Transport → Unload</h3>
      <h2>Selected task</h2>
      <h3>Move</h3>
      <h2>Selected step type</h2>
      <h3>MOVE</h3>
      <p>Save as a draft. Empty tasks must be completed before validation and publishing.</p>
    </section>
  );
}

function StepConfigPanel({ step, onChange, onDone }) {
  return <section className="workflow-panel editor-detail step-config-panel"><button className="config-back" onClick={onDone}>← Back to task</button><span className="modal-kicker">STEP CONFIGURATION</span><h2>{step.type}</h2><p>{stepTypeCopy[step.type][1]}</p><div className="inline-config-fields">{stepFields[step.type].map((field) => <label key={field}>{field}<input placeholder={`Enter ${field}`} value={step.values[field]} onChange={(event) => onChange({ ...step, values: { ...step.values, [field]: event.target.value } })} /></label>)}</div><button className="inline-config-save" onClick={onDone}>✓ Done · Back to task</button></section>;
}

function Editor({ setMode, setSaved }) {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [showTypes, setShowTypes] = useState(false);
  const [renameTask, setRenameTask] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [configStep, setConfigStep] = useState(null);
  const taskClickTimer = useRef(null);
  const addTask = () => { const task = { id: crypto.randomUUID(), name: `Task ${tasks.length + 1}`, steps: [] }; setTasks((value) => [...value, task]); };
  const startRename = (task) => { setRenameTask(task); setRenameValue(task.name); };
  const saveRename = () => { if (renameValue.trim()) setTasks((value) => value.map((item) => item.id === renameTask.id ? { ...item, name: renameValue.trim() } : item)); setRenameTask(null); };
  const addStep = (type) => { const step = { id: crypto.randomUUID(), type, values: Object.fromEntries(stepFields[type].map((field) => [field, ''])) }; setTasks((value) => value.map((task) => task.id === activeTask ? { ...task, steps: [...task.steps, step] } : task)); setShowTypes(false); setConfigStep(step); };
  const updateConfigStep = (nextStep) => { setConfigStep(nextStep); setTasks((value) => value.map((task) => task.id === activeTask ? { ...task, steps: task.steps.map((step) => step.id === nextStep.id ? nextStep : step) } : task)); };
  const selected = tasks.find((task) => task.id === activeTask);
  const openTask = (task) => { taskClickTimer.current = window.setTimeout(() => { setActiveTask(task.id); setShowTypes(true); }, 220); };
  const editTask = (task) => { window.clearTimeout(taskClickTimer.current); startRename(task); };
  return <><div className="workflow-editor-grid"><section className="workflow-panel editor-side"><h2>WORKFLOW</h2><Field label="Name" value="New workflow" /><Field label="Description" value="Add a description..." /><div className="task-heading"><h2>TASKS · {tasks.length}</h2><button type="button" onClick={addTask}>+</button></div>{tasks.length === 0 && <p className="task-empty-note">No tasks yet. Click + to create Task 1.</p>}{tasks.map((task) => <button className={activeTask === task.id ? 'editor-side-button active' : 'editor-side-button'} type="button" key={task.id} onClick={() => openTask(task)} onDoubleClick={() => editTask(task)}>{task.name}<small>{task.steps.length ? `${task.steps.length} steps` : 'No steps yet'}</small></button>)}</section>{configStep ? <StepConfigPanel step={configStep} onChange={updateConfigStep} onDone={() => setConfigStep(null)} /> : <section className="workflow-panel editor-detail workflow-steps-panel"><span className="modal-kicker">WORKFLOW STEPS</span><h2>{selected ? selected.name : 'Select a task'}</h2>{selected ? <><p>Choose a step to edit its fields.</p><div className="step-table"><div className="step-table-head"><span>#</span><span>STEP TYPE</span><span>STATUS</span></div>{selected.steps.length ? selected.steps.map((step, index) => <button className="step-table-row" key={step.id} onClick={() => setConfigStep(step)}><span>{String(index + 1).padStart(2, '0')}</span><b>{step.type}</b><em>{Object.values(step.values).some(Boolean) ? 'Configured' : 'Needs setup'}</em></button>) : <div className="step-empty-state">Click the task again to open the Step Type library.</div>}</div></> : <SelectTaskPanel />}</section>}</div>{showTypes && <div className="type-modal" onClick={() => setShowTypes(false)}><div className="type-modal-card" onClick={(event) => event.stopPropagation()}><header><div><span className="modal-kicker">MEDIASSIST ACTION LIBRARY</span><h2>Add a step to the workflow</h2><p>Choose an action to add to the open task.</p></div></header><div>{stepTypes.map((type) => <button key={type} onClick={() => addStep(type)}><i>{stepTypeCopy[type][0]}</i><span><small>{type}</small><b>{type.replace('_', ' ')}</b><em>{stepTypeCopy[type][1]}</em></span><strong>＋</strong></button>)}</div></div></div>}{renameTask && <div className="rename-backdrop" onClick={() => setRenameTask(null)}><form className="rename-dialog" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveRename(); }}><span className="rename-icon">✎</span><h2>Rename task</h2><p>Use a clear name to make the workflow easier to follow.</p><label>Task name<input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></label><footer><button type="button" onClick={() => setRenameTask(null)}>Cancel</button><button type="submit">Save name</button></footer></form></div>}<footer className="workflow-actions"><MarButton className="create" onClick={() => { setSaved(true); setMode('library'); }}>Save Draft</MarButton></footer></>;
}

export default function WorkflowsPage() {
  const [mode, setMode] = useState('library');
  const [screen, setScreen] = useState('create');
  const [saved, setSaved] = useState(false);
  const [definitions, setDefinitions] = useState([]);
  const [definitionError, setDefinitionError] = useState('');
  const [definitionsLoading, setDefinitionsLoading] = useState(true);
  const creating = mode === 'create';

  useEffect(() => {
    let current = true;
    workflowApi.list({ page: 0, size: 100 }).then((page) => {
      if (!current) return;
      setDefinitions(Array.isArray(page) ? page : page?.content ?? []);
      setDefinitionError('');
    }).catch((error) => { if (current) setDefinitionError(error.message || 'Unable to load workflow definitions.'); })
      .finally(() => { if (current) setDefinitionsLoading(false); });
    return () => { current = false; };
  }, []);

  const openCreate = () => {
    setMode('create');
    setScreen('create');
  };

  return (
    <div className="workflows-screen">
      <Sidebar />
      <main className="workflows-main">
        <header className="workflows-header">
          <h1>{creating ? 'Create Workflow' : 'Workflows'}</h1>
          <Tabs />
          <p className="preview-note">
            {creating ? 'Build a workflow from tasks, or start with one of the 10 templates.' : saved ? 'Draft saved. Continue editing or create another workflow.' : 'Specification v1.0 · editable UI preview'}
          </p>
        </header>

        {creating ? (
          <Editor setMode={setMode} setSaved={setSaved} />
        ) : (
          <Library saved={saved} onCreate={openCreate} onOpenDraft={openCreate} definitions={definitions} loading={definitionsLoading} error={definitionError} />
        )}
      </main>
    </div>
  );
}
