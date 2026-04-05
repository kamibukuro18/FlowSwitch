import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { useReleaseInfo } from "../hooks/useReleaseInfo";
import { InfoModal } from "./InfoModal";
import { t, Lang } from "../i18n";
import "./Sidebar.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

export function Sidebar({ store }: Props) {
  const { state, navigateTo, startEditingMode } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const releaseInfo = useReleaseInfo();

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo" data-tauri-drag-region>
          <span className="logo-text">FlowSwitch</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${state.currentView === "modes" ? "active" : ""}`}
            onClick={() => navigateTo("modes")}
          >
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
            <span className="nav-label">{t(lang, "nav_new_mode")}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`nav-item ${state.currentView === "settings" ? "active" : ""}`}
            onClick={() => navigateTo("settings")}
          >
            <span className="nav-label">{t(lang, "nav_settings")}</span>
          </button>

          <button
            className={`nav-item ${isInfoOpen ? "active" : ""}`}
            onClick={() => setIsInfoOpen(true)}
          >
            <span className="nav-label">Info</span>
            {releaseInfo.hasUpdate ? <span className="nav-badge">NEW</span> : null}
          </button>
        </div>
      </aside>

      <InfoModal
        isOpen={isInfoOpen}
        releaseInfo={releaseInfo}
        onRefresh={releaseInfo.refresh}
        onClose={() => setIsInfoOpen(false)}
      />
    </>
  );
}
