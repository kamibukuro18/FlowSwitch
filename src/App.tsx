import { useEffect } from "react";
import { useAppStore } from "./store/appStore";
import { loadSettings, loadConfig, getDefaultConfigPath } from "./hooks/useTauri";
import { ModeListView } from "./components/ModeListView";
import { ModeEditorView } from "./components/ModeEditorView";
import { SettingsView } from "./components/SettingsView";
import { ExecutionResultView } from "./components/ExecutionResultView";
import { Sidebar } from "./components/Sidebar";
import { SAMPLE_CONFIG } from "./data/sampleConfig";
import "./App.css";

function App() {
  const store = useAppStore();
  const { state, setConfig, setSettings, setError } = store;

  useEffect(() => {
    const isDark = state.settings.theme === "dark" ||
      (state.settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [state.settings.theme]);

  useEffect(() => {
    async function init() {
      try {
        const settings = await loadSettings();
        setSettings(settings);

        if (settings.configFilePath) {
          const config = await loadConfig(settings.configFilePath);
          setConfig(config);
        } else {
          // Show sample config on first launch
          const defaultPath = await getDefaultConfigPath();
          setSettings({ configFilePath: defaultPath });
          setConfig(SAMPLE_CONFIG);
        }
      } catch {
        // First launch or settings not found - use sample config
        setConfig(SAMPLE_CONFIG);
      }
    }
    init();
  }, []);

  const renderView = () => {
    switch (state.currentView) {
      case "modes":
        return <ModeListView store={store} />;
      case "editor":
        return <ModeEditorView store={store} />;
      case "settings":
        return <SettingsView store={store} />;
      case "execution":
        return <ExecutionResultView store={store} />;
      default:
        return <ModeListView store={store} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar store={store} />
      <main className="app-main">
        {state.error && (
          <div className="error-banner">
            <span>{state.error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {renderView()}
      </main>
    </div>
  );
}

export default App;
