import { useAppStore } from "../store/appStore";
import { t, Lang } from "../i18n";
import "./Sidebar.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

export function Sidebar({ store }: Props) {
  const { state, navigateTo, startEditingMode } = store;
  const lang = (state.settings.language ?? "en") as Lang;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" data-tauri-drag-region>
        <div className="logo-icon">⚡</div>
        <span className="logo-text">FlowSwitch</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${state.currentView === "modes" ? "active" : ""}`}
          onClick={() => navigateTo("modes")}
        >
          <span className="nav-icon">⊞</span>
          <span className="nav-label">{t(lang, "nav_modes")}</span>
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
          <span className="nav-label">{t(lang, "nav_new_mode")}</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <button
          className={`nav-item ${state.currentView === "settings" ? "active" : ""}`}
          onClick={() => navigateTo("settings")}
        >
          <span className="nav-icon">⚙</span>
          <span className="nav-label">{t(lang, "nav_settings")}</span>
        </button>
      </div>
    </aside>
  );
}
