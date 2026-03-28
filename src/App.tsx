import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./store/appStore";
import { loadSettings, loadConfig, getDefaultConfigPath, saveConfig, updateTrayMenu } from "./hooks/useTauri";
import { ModeExecutionResult } from "./types";
import { ModeListView } from "./components/ModeListView";
import { ModeEditorView } from "./components/ModeEditorView";
import { SettingsView } from "./components/SettingsView";
import { ExecutionResultView } from "./components/ExecutionResultView";
import { WelcomeWizard } from "./components/WelcomeWizard";
import { Sidebar } from "./components/Sidebar";
import { SAMPLE_CONFIG } from "./data/sampleConfig";
import "./App.css";

function App() {
  const store = useAppStore();
  const { state, setConfig, setSettings, setError, setLastExecutionResult } = store;
  const [showWizard, setShowWizard] = useState<boolean | null>(null); // null = loading
  const configLoadedRef = useRef(false); // skip auto-save on initial load

  useEffect(() => {
    const isDark = state.settings.theme === "dark" ||
      (state.settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [state.settings.theme]);

  // Sync tray menu whenever config changes
  useEffect(() => {
    if (state.config) {
      updateTrayMenu(state.config).catch(() => {});
    }
  }, [state.config]);

  // Auto-save config to disk whenever it changes (skip initial load)
  useEffect(() => {
    if (!state.config || !state.settings.configFilePath) return;
    if (!configLoadedRef.current) {
      configLoadedRef.current = true;
      return;
    }
    saveConfig(state.settings.configFilePath, state.config).catch((err) => {
      setError(`Auto-save failed: ${err}`);
    });
  }, [state.config]);

  // Receive mode executions triggered from the tray (silent background launch)
  useEffect(() => {
    const unlisten = listen<ModeExecutionResult>("tray-mode-executed", (ev) => {
      setLastExecutionResult(ev.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const settings = await loadSettings();
        setSettings(settings);

        if (settings.onboardingComplete) {
          setShowWizard(false);
          if (settings.configFilePath) {
            const config = await loadConfig(settings.configFilePath);
            setConfig(config);
          } else {
            const defaultPath = await getDefaultConfigPath();
            setSettings({ configFilePath: defaultPath });
            setConfig(SAMPLE_CONFIG);
          }
        } else {
          // First launch — show onboarding wizard
          setShowWizard(true);
        }
      } catch {
        // First launch or settings not found — show wizard
        setShowWizard(true);
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

  // Show nothing while loading settings
  if (showWizard === null) return null;

  if (showWizard) {
    return (
      <WelcomeWizard
        store={store}
        onFinish={async () => {
          // Reload config from the path the wizard just saved
          if (state.settings.configFilePath) {
            try {
              const config = await loadConfig(state.settings.configFilePath);
              setConfig(config);
            } catch {
              // Config was just created by the wizard, so it should load fine
            }
          }
          setShowWizard(false);
        }}
      />
    );
  }

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
