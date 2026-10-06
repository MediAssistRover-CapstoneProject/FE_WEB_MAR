import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './workflows.css';

const navGroups = [
  ['Overview', ['Dashboard']],
  ['Operations', ['Live Operations', 'Emergency Center', 'Missions', 'Patrol']],
  ['Map & Navigation', ['Map Studio']],
  ['Robot', ['Robot Status', 'Manual Control', 'Charging']],
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
const stepTypeCopy = { MOVE: ['⌁', 'Di chuyển robot đến điểm đích'], INTERACT: ['◌', 'Tương tác bằng giọng nói hoặc màn hình'], DATA_SERVICE: ['▤', 'Truy vấn và cập nhật dữ liệu'], AUTHENTICATE: ['◇', 'Kiểm tra danh tính và quyền'], CONTROL_HARDWARE: ['⌘', 'Điều khiển khóa và thiết bị'], HANDLE_PAYLOAD: ['□', 'Giao nhận vật phẩm'], EXECUTE_SENSING: ['◉', 'Đọc cảm biến và quan sát'], NOTIFY: ['♧', 'Gửi cảnh báo và thông báo'], WAIT: ['◷', 'Chờ thời gian hoặc sự kiện'], CHECK_CONDITION: ['⌘', 'Đánh giá điều kiện workflow'], SET_CONTEXT: ['›_', 'Cập nhật dữ liệu ngữ cảnh'] };

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="wf-sidebar">
      <div className="wf-brand">
        MediAssistRover
        <span>ADMIN CONTROL CENTER</span>
      </div>
      <nav>
        {navGroups.map(([group, items]) => (
          <section key={group}>
            <h3>{group}</h3>
            {items.map((item) => (
              <button className={item === 'Workflows' ? 'active' : ''} type="button" key={item} onClick={() => navigate(item === 'Workflows' ? '/workflows' : `/admin?screen=${encodeURIComponent(item)}`)}>
                {item}
              </button>
            ))}
          </section>
        ))}
      </nav>
      <div className="wf-sidebar-footer">
        <span>1 Robot Managed</span>
        <b>MAR-01 <i /> Online</b>
      </div>
    </aside>
  );
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
      <MarButton className="tab-button" variant="subtle" onClick={() => navigate('/workstations')}>Workstations</MarButton>
      <MarButton className="tab-button" variant="subtle" onClick={() => navigate('/workstations?view=jobs')}>Jobs</MarButton>
    </div>
  );
}

function Library({ saved, onCreate, onOpenDraft }) {
  return (
    <>
      <div className="workflows-grid">
        <section className="workflow-panel library-panel">
          <h2>WORKFLOW TEMPLATES · 10 DEFAULTS</h2>
          <div className="workflow-list">
            {workflows.map((workflow) => (
              <button className="workflow-card" type="button" key={workflow.code} onClick={onCreate}>
                <strong>{workflow.name}</strong>
                <span>{workflow.code}<b>·</b>{workflow.steps} steps including branches<em>→</em></span>
              </button>
            ))}
          </div>
        </section>

        <aside className="workflow-panel action-panel">
          {saved ? (
            <>
              <h2>MY WORKFLOWS</h2>
              <h3>New workflow</h3>
              <p>DRAFT · 4 default tasks</p>
              <MarButton className="full" onClick={onOpenDraft}>Open Draft</MarButton>
              <MarButton className="full" variant="subtle" onClick={onCreate}>+ Create Workflow</MarButton>
              <h2>10 DEFAULT TEMPLATES</h2>
              <p>Templates remain available in the list.</p>
            </>
          ) : (
            <>
              <h2>CREATE A WORKFLOW</h2>
              <p>Start a new workflow with four default tasks, then add steps from the library.</p>
              <MarButton className="full" onClick={onCreate}>+ Create Workflow</MarButton>
              <h2>DEFAULT TEMPLATES</h2>
              <p>The 10 templates are examples. Open one to inspect its sequence.</p>
            </>
          )}
        </aside>
      </div>

      <footer className="workflow-actions">
        <MarButton className="create" onClick={onCreate}>Create Workflow</MarButton>
        <MarButton className="back" variant="subtle">Back to Workflows</MarButton>
        <p>Scroll inside panels to view all content.</p>
      </footer>
    </>
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

function Editor({ setMode, setSaved }) {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [showTypes, setShowTypes] = useState(false);
  const [renameTask, setRenameTask] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const taskClickTimer = useRef(null);
  const addTask = () => { const task = { id: crypto.randomUUID(), name: `Task ${tasks.length + 1}`, steps: [] }; setTasks((value) => [...value, task]); };
  const startRename = (task) => { setRenameTask(task); setRenameValue(task.name); };
  const saveRename = () => { if (renameValue.trim()) setTasks((value) => value.map((item) => item.id === renameTask.id ? { ...item, name: renameValue.trim() } : item)); setRenameTask(null); };
  const addStep = (type) => { setTasks((value) => value.map((task) => task.id === activeTask ? { ...task, steps: [...task.steps, type] } : task)); setShowTypes(false); };
  const selected = tasks.find((task) => task.id === activeTask);
  const openTask = (task) => { taskClickTimer.current = window.setTimeout(() => { setActiveTask(task.id); setShowTypes(true); }, 220); };
  const editTask = (task) => { window.clearTimeout(taskClickTimer.current); startRename(task); };
  return <><div className="workflow-editor-grid"><section className="workflow-panel editor-side"><h2>WORKFLOW</h2><Field label="Name" value="New workflow" /><Field label="Description" value="Add a description..." /><div className="task-heading"><h2>TASKS · {tasks.length}</h2><button type="button" onClick={addTask}>+</button></div>{tasks.length === 0 && <p className="task-empty-note">Chưa có task. Nhấn dấu + để tạo Task 1.</p>}{tasks.map((task) => <button className={activeTask === task.id ? 'editor-side-button active' : 'editor-side-button'} type="button" key={task.id} onClick={() => openTask(task)} onDoubleClick={() => editTask(task)}>{task.name}<small>{task.steps.length ? `${task.steps.length} step` : 'Chưa có step'}</small></button>)}</section><section className="workflow-panel editor-detail"><h2>{selected ? selected.name : 'TASKS'}</h2>{selected ? <><p>Click một task để chọn Step Type. Double-click để đổi tên task.</p><h2>STEP SEQUENCE · {selected.steps.length}</h2>{selected.steps.map((step, index) => <div className="step-row" key={`${step}-${index}`}>{String(index + 1).padStart(2, '0')}<span>{step}</span></div>)}<MarButton className="wide" variant="subtle" onClick={() => setShowTypes(true)}>+ Add Step</MarButton></> : <SelectTaskPanel />}</section></div>{showTypes && <div className="type-modal" onClick={() => setShowTypes(false)}><div className="type-modal-card" onClick={(event) => event.stopPropagation()}><header><div><span className="modal-kicker">BỘ HÀNH ĐỘNG MEDIASSIST</span><h2>Thêm bước vào workflow</h2><p>Chọn một hành động để thêm vào task đang mở.</p></div><button className="type-modal-close" aria-label="Đóng bảng chọn Step Type" onClick={() => setShowTypes(false)}>×</button></header><div>{stepTypes.map((type) => <button key={type} onClick={() => addStep(type)}><i>{stepTypeCopy[type][0]}</i><span><small>{type}</small><b>{type.replace('_', ' ')}</b><em>{stepTypeCopy[type][1]}</em></span><strong>＋</strong></button>)}</div></div></div>}{renameTask && <div className="rename-backdrop" onClick={() => setRenameTask(null)}><form className="rename-dialog" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveRename(); }}><span className="rename-icon">✎</span><h2>Đổi tên task</h2><p>Đặt tên rõ ràng để dễ theo dõi quy trình.</p><label>Tên task<input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></label><footer><button type="button" onClick={() => setRenameTask(null)}>Hủy</button><button type="submit">Lưu tên</button></footer></form></div>}<footer className="workflow-actions"><MarButton className="create" onClick={() => { setSaved(true); setMode('library'); }}>Save Draft</MarButton><MarButton className="back" variant="subtle" onClick={() => setMode('library')}>Back to Workflows</MarButton></footer></>;
}

export default function WorkflowsPage() {
  const [mode, setMode] = useState('library');
  const [screen, setScreen] = useState('create');
  const [saved, setSaved] = useState(false);
  const creating = mode === 'create';

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
          <p className="robot-location">MAR-01 · Hospital Floor 1</p>
          <Tabs />
          <p className="preview-note">
            {creating ? 'Build a workflow from tasks, or start with one of the 10 templates.' : saved ? 'Draft saved. Continue editing or create another workflow.' : 'Specification v1.0 · editable UI preview'}
          </p>
        </header>

        {creating ? (
          <Editor setMode={setMode} setSaved={setSaved} />
        ) : (
          <Library saved={saved} onCreate={openCreate} onOpenDraft={openCreate} />
        )}
      </main>
    </div>
  );
}
