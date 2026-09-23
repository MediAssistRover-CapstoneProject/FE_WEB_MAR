import { useMemo, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import MarButton from "../components/MarButton";

const workflowTemplates = [
  {
    name: "Patient Guidance and Escort",
    code: "WF_PATIENT_ESCORT",
    steps: 16,
  },
  {
    name: "Outpatient Information Assistance",
    code: "WF_INFORMATION_ASSISTANCE",
    steps: 15,
  },
  {
    name: "Secure Medical Delivery",
    code: "WF_SECURE_MEDICAL_DELIVERY",
    steps: 28,
  },
  {
    name: "Crowd Density Monitoring",
    code: "WF_CROWD_MONITORING",
    steps: 15,
  },
  {
    name: "Emergency SOS Response",
    code: "WF_EMERGENCY_SOS_RESPONSE",
    steps: 18,
  },
  {
    name: "Patient Fall Detection and Response",
    code: "WF_FALL_DETECTION_RESPONSE",
    steps: 9,
  },
  {
    name: "Restricted Area Monitoring",
    code: "WF_RESTRICTED_AREA_MONITORING",
    steps: 15,
  },
  {
    name: "Automatic Charging and Return to Ready",
    code: "WF_AUTO_CHARGING",
    steps: 19,
  },
  {
    name: "Blocked Path Navigation Recovery",
    code: "WF_NAVIGATION_RECOVERY",
    steps: 11,
  },
  {
    name: "Robot Startup and Standby",
    code: "WF_ROBOT_STARTUP_STANDBY",
    steps: 13,
  },
];

const tabs = ["Workflows", "Workstations", "Jobs"];

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState("Workflows");
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const selected = useMemo(
    () => workflowTemplates.find((item) => item.code === selectedWorkflow),
    [selectedWorkflow]
  );

  const handleCreate = () => {
    window.alert(
      "Create Workflow: connect this action to your /workflows/new route or modal."
    );
  };

  return (
    <div className="min-h-screen min-w-[1180px] bg-white font-inter text-mar-text">
      <AdminSidebar active="Workflows" />

      <main className="ml-[220px] min-h-screen px-[28px] pb-[33px] pt-[56px]">
        <header className="relative">
          <h2 className="text-[22px] font-semibold leading-[1.45]">Workflows</h2>

          <p className="absolute right-0 top-[10px] text-[10px] font-medium text-mar-muted">
            MAR-01 · Hospital Floor 1
          </p>

          <div className="mt-[29px] flex gap-3">
            {tabs.map((tab) => (
              <MarButton
                key={tab}
                variant={tab === activeTab ? "primary" : "subtle"}
                className="w-[190px]"
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </MarButton>
            ))}
          </div>

          <p className="mt-[17px] text-[12px] font-normal text-mar-muted">
            Specification v1.0 • editable UI preview
          </p>
        </header>

        <div className="mt-[30px] grid grid-cols-[minmax(620px,824px)_320px] gap-5">
          <section className="h-[706px] rounded-[10px] border border-mar-border bg-white p-4">
            <h3 className="text-[14px] font-semibold leading-[1.45]">
              WORKFLOW TEMPLATES · 10 DEFAULTS
            </h3>

            <div className="workflow-scroll mt-3 h-[636px] overflow-y-auto overflow-x-hidden pr-3">
              <div className="flex flex-col gap-3">
                {workflowTemplates.map((workflow) => {
                  const isSelected = selectedWorkflow === workflow.code;

                  return (
                    <button
                      type="button"
                      key={workflow.code}
                      onClick={() => setSelectedWorkflow(workflow.code)}
                      className={[
                        "w-full rounded-[6px] px-4 py-[14px] text-left",
                        "transition-colors duration-150",
                        isSelected
                          ? "bg-mar-selected"
                          : "bg-mar-subtle hover:bg-[#e8eef6]",
                      ].join(" ")}
                    >
                      <div className="text-[14px] font-semibold leading-[1.45] text-mar-text">
                        {workflow.name}
                      </div>
                      <div className="mt-3 text-[12px] font-normal leading-[1.45] text-mar-muted">
                        {workflow.code}
                        <span className="mx-2">·</span>
                        {workflow.steps} steps including branches
                        <span className="ml-3">→</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="h-[706px] rounded-[10px] border border-mar-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">CREATE A WORKFLOW</h3>
            <p className="mt-3 text-[12px] leading-normal text-mar-text">
              Start a new workflow with four default tasks, then add steps from
              the library.
            </p>

            <MarButton className="mt-3 h-10 w-full" onClick={handleCreate}>
              + Create Workflow
            </MarButton>

            <h3 className="mt-3 text-[14px] font-semibold">
              DEFAULT TEMPLATES
            </h3>
            <p className="mt-3 text-[12px] leading-normal text-mar-text">
              The 10 templates are examples. Open one to inspect its sequence.
            </p>

            {selected && (
              <div className="mt-5 rounded-[8px] border border-mar-border bg-mar-sidebar p-3">
                <div className="text-[12px] font-semibold">{selected.name}</div>
                <div className="mt-1 text-[11px] text-mar-muted">
                  {selected.code}
                </div>
                <div className="mt-2 text-[11px] text-mar-muted">
                  {selected.steps} steps including branches
                </div>
              </div>
            )}
          </aside>
        </div>

        <footer className="mt-5 flex items-center gap-3">
          <MarButton className="w-[270px]" onClick={handleCreate}>
            Create Workflow
          </MarButton>
          <MarButton
            variant="subtle"
            className="w-[210px]"
            onClick={() => setActiveTab("Workflows")}
          >
            Back to Workflows
          </MarButton>
          <p className="ml-0 text-[10px] font-medium text-mar-muted">
            Scroll inside panels to view all content.
          </p>
        </footer>
      </main>
    </div>
  );
}
