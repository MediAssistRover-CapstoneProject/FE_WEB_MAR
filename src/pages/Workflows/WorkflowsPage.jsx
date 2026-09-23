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

function Sidebar() {
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
              <button className={item === 'Workflows' ? 'active' : ''} type="button" key={item}>
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

function MarButton({ children, variant = 'primary', className = '' }) {
  return (
    <button className={`wf-button ${variant} ${className}`.trim()} type="button">
      {children}
    </button>
  );
}

export default function WorkflowsPage() {
  return (
    <div className="workflows-screen">
      <Sidebar />
      <main className="workflows-main">
        <header className="workflows-header">
          <h1>Workflows</h1>
          <p className="robot-location">MAR-01 · Hospital Floor 1</p>
          <div className="workflow-tabs">
            <MarButton className="tab-button">Workflows</MarButton>
            <MarButton className="tab-button" variant="subtle">Workstations</MarButton>
            <MarButton className="tab-button" variant="subtle">Jobs</MarButton>
          </div>
          <p className="preview-note">Specification v1.0 · editable UI preview</p>
        </header>

        <div className="workflows-grid">
          <section className="workflow-panel library-panel">
            <h2>WORKFLOW TEMPLATES · 10 DEFAULTS</h2>
            <div className="workflow-list">
              {workflows.map((workflow) => (
                <button className="workflow-card" type="button" key={workflow.code}>
                  <strong>{workflow.name}</strong>
                  <span>{workflow.code}<b>·</b>{workflow.steps} steps including branches<em>→</em></span>
                </button>
              ))}
            </div>
          </section>

          <aside className="workflow-panel action-panel">
            <h2>CREATE A WORKFLOW</h2>
            <p>Start a new workflow with four default tasks, then add steps from the library.</p>
            <MarButton className="full">+ Create Workflow</MarButton>
            <h2>DEFAULT TEMPLATES</h2>
            <p>The 10 templates are examples. Open one to inspect its sequence.</p>
          </aside>
        </div>

        <footer className="workflow-actions">
          <MarButton className="create">Create Workflow</MarButton>
          <MarButton className="back" variant="subtle">Back to Workflows</MarButton>
          <p>Scroll inside panels to view all content.</p>
        </footer>
      </main>
    </div>
  );
}
