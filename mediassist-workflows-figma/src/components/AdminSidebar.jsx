const navGroups = [
  { title: "OVERVIEW", items: ["Dashboard"] },
  {
    title: "OPERATIONS",
    items: ["Live Operations", "Emergency Center", "Missions", "Patrol"],
  },
  { title: "MAP & NAVIGATION", items: ["Map Studio"] },
  { title: "ROBOT", items: ["Robot Status", "Manual Control", "Charging"] },
  {
    title: "MONITORING",
    items: ["Alerts", "Crowd Heatmap", "History & Replay", "Analytics"],
  },
  { title: "AUTOMATION", items: ["Workflows", "Voice & Scripts"] },
  {
    title: "ADMINISTRATION",
    items: ["Users & Roles", "System Settings", "Audit Logs"],
  },
];

export default function AdminSidebar({ active = "Workflows" }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 w-[220px] bg-mar-sidebar">
      <div className="relative h-full px-[10px] pt-[56px]">
        <div className="absolute left-[22px] top-[20px]">
          <h1 className="text-[20px] font-semibold leading-none text-mar-text">
            MediAssistRover
          </h1>
          <p className="mt-[7px] text-[10px] font-medium text-mar-muted">
            ADMIN CONTROL CENTER
          </p>
        </div>

        <nav className="flex flex-col gap-3">
          {navGroups.map((group) => (
            <section key={group.title} className="w-[200px]">
              <h2 className="mb-[3px] text-[9px] font-medium tracking-[1px] text-mar-primary">
                {group.title}
              </h2>

              <div className="flex flex-col gap-[1px]">
                {group.items.map((item) => {
                  const selected = item === active;
                  return (
                    <button
                      key={item}
                      type="button"
                      className={[
                        "flex h-[25px] w-[200px] items-center rounded-[6px] px-[10px]",
                        "text-left text-[11px] font-normal transition-colors",
                        selected
                          ? "bg-mar-selected text-mar-primary"
                          : "text-mar-muted hover:bg-[#eef3f8]",
                      ].join(" ")}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="absolute bottom-[31px] left-[22px]">
          <p className="text-[11px] font-medium text-mar-muted">
            1 Robot Managed
          </p>
          <p className="mt-[10px] text-[11px] font-medium text-mar-text">
            MAR-01&nbsp;&nbsp;&nbsp;● Online
          </p>
        </div>
      </div>
    </aside>
  );
}
