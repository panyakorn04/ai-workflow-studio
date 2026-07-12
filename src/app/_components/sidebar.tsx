import {
  Activity,
  Blocks,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  Command,
  GitBranch,
  LayoutDashboard,
  Settings2,
  Sparkles,
} from "lucide-react";

const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Workflows", icon: GitBranch },
  { label: "Executions", icon: Activity, count: "3" },
  { label: "Skills", icon: Blocks },
  { label: "Analytics", icon: ChartNoAxesCombined },
];
export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={16} />
        </div>
        <span>Workflow Studio</span>
      </div>
      <button type="button" className="workspace">
        <span className="avatar">PB</span>
        <span>
          <strong>Panyakorn</strong>
          <small>Production workspace</small>
        </span>
        <ChevronDown size={14} />
      </button>
      <nav>
        <p>Workspace</p>
        {nav.map(({ label, icon: Icon, active, count }) => (
          <button
            type="button"
            className={active ? "nav-item active" : "nav-item"}
            aria-current={active ? "page" : undefined}
            disabled={!active}
            key={label}
          >
            <Icon size={16} />
            <span>{label}</span>
            {count ? <em>{count}</em> : null}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button type="button" className="nav-item" disabled>
          <Settings2 size={16} />
          Settings
        </button>
        <button type="button" className="nav-item" disabled>
          <CircleHelp size={16} />
          Documentation
        </button>
        <div className="shortcut">
          <Command size={13} /> <span>Quick actions</span>
          <kbd>⌘ K</kbd>
        </div>
      </div>
    </aside>
  );
}
