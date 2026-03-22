import { useAppStore } from "../store/appStore";
import "./Sidebar.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

export function Sidebar({ store }: Props) {
  const { state, navigateTo, startEditingMode } = store;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">⚡</div>
        <span className="logo-text">FlowSwitch</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${state.currentView === "modes" ? "active" : ""}`}
          onClick={() => navigateTo("modes")}
        >
          <span className="nav-icon">⊞</span>
          <span className="nav-label">Modes</span>
        </button>

        <button
          className="nav-item nav-add"
          onClick={() =>
            startEditingMode({
              id: crypto.randomUUID(),
              name: "",
              description: "",
              targets: [],
              exitAction: "nothing",
            })
          }
        >
          <span className="nav-icon">+</span>
          <span className="nav-label">New Mode</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <button
          className={`nav-item ${state.currentView === "settings" ? "active" : ""}`}
          onClick={() => navigateTo("settings")}
        >
          <span className="nav-icon">⚙</span>
          <span className="nav-label">Settings</span>
        </button>
      </div>
    </aside>
  );
}
