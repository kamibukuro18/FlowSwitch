import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ModeExecutionResult } from "./types";
import { t, Lang } from "./i18n";
import { useAppStore } from "./store/appStore";
import {
  clearShortcuts,
  executeMode,
  getDefaultConfigPath,
  loadConfig,
  loadSettings,
  registerShortcuts,
  saveConfig,
  updateTrayMenu,
} from "./hooks/useTauri";
import { SAMPLE_CONFIG } from "./data/sampleConfig";
import { Sidebar } from "./components/Sidebar";
import { ModeListView } from "./components/ModeListView";
import { ModeEditorView } from "./components/ModeEditorView";
import { SettingsView } from "./components/SettingsView";
import { ExecutionResultView } from "./components/ExecutionResultView";
import { WelcomeWizard } from "./components/WelcomeWizard";
import "./App.css";

function App() {
  const store = useAppStore();
  const {
    state,
    setConfig,
    setSettings,
    setError,
    setLastExecutionResult,
    clearToast,
  } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const [showWizard, setShowWizard] = useState<boolean | null>(null);
  const configLoadedRef = useRef(false);
  const historyReadyRef = useRef(false);
  const ignoreNextHistoryPushRef = useRef(false);
  const currentViewRef = useRef(state.currentView);

  const toastMessage = useMemo(() => {
    if (!state.toast) return null;
    return state.toast.kind === "mode_saved"
      ? t(lang, "saved_indicator")
      : t(lang, "target_added");
  }, [lang, state.toast]);

  useEffect(() => {
    const isDark =
      state.settings.theme === "dark" ||
      (state.settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [state.settings.theme]);

  useEffect(() => {
    currentViewRef.current = state.currentView;
  }, [state.currentView]);

  useEffect(() => {
    if (!state.config) return;
    updateTrayMenu(state.config).catch(() => {});
  }, [state.config]);

  useEffect(() => {
    if (!state.config || !state.settings.configFilePath) return;
    if (!configLoadedRef.current) {
      configLoadedRef.current = true;
      return;
    }
    saveConfig(state.settings.configFilePath, state.config).catch((error) => {
      setError(`Auto-save failed: ${error}`);
    });
  }, [setError, state.config, state.settings.configFilePath]);

  useEffect(() => {
    if (!state.config) {
      void clearShortcuts();
      return;
    }

    let cancelled = false;

    void registerShortcuts(state.config, async (modeId) => {
      if (cancelled) return;
      try {
        const result = await executeMode(modeId, state.config!);
        if (!cancelled) {
          setLastExecutionResult(result);
        }
      } catch (error) {
        console.warn(`Failed to execute shortcut mode "${modeId}":`, error);
      }
    });

    return () => {
      cancelled = true;
      void clearShortcuts();
    };
  }, [setLastExecutionResult, state.config]);

  useEffect(() => {
    const unlisten = listen<ModeExecutionResult>("tray-mode-executed", (event) => {
      setLastExecutionResult(event.payload);
    });
    return () => {
      unlisten.then((dispose) => dispose());
    };
  }, [setLastExecutionResult]);

  useEffect(() => {
    if (!state.toast) return;
    const timeout = window.setTimeout(() => {
      clearToast();
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [clearToast, state.toast]);

  useEffect(() => {
    if (showWizard !== false) return;

    if (!historyReadyRef.current) {
      window.history.replaceState({ view: state.currentView }, "");
      historyReadyRef.current = true;
      return;
    }

    if (ignoreNextHistoryPushRef.current) {
      ignoreNextHistoryPushRef.current = false;
      return;
    }

    if (window.history.state?.view !== state.currentView) {
      window.history.pushState({ view: state.currentView }, "");
    }
  }, [showWizard, state.currentView]);

  useEffect(() => {
    if (showWizard !== false) return;

    function handlePopState(event: PopStateEvent) {
      const view = event.state?.view;
      if (view !== "modes" && view !== "editor" && view !== "settings" && view !== "execution") {
        ignoreNextHistoryPushRef.current = true;
        store.navigateTo("modes");
        return;
      }

      if (view === currentViewRef.current) {
        return;
      }

      ignoreNextHistoryPushRef.current = true;
      store.navigateTo(view);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showWizard, store]);

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
          setShowWizard(true);
        }
      } catch {
        setShowWizard(true);
      }
    }

    void init();
  }, [setConfig, setSettings]);

  function renderView() {
    switch (state.currentView) {
      case "editor":
        return <ModeEditorView store={store} />;
      case "settings":
        return <SettingsView store={store} />;
      case "execution":
        return <ExecutionResultView store={store} />;
      case "modes":
      default:
        return <ModeListView store={store} />;
    }
  }

  if (showWizard === null) return null;

  if (showWizard) {
    return <WelcomeWizard store={store} onFinish={() => setShowWizard(false)} />;
  }

  return (
    <div className="app-layout">
      <Sidebar store={store} />
      <main className="app-main">
        {state.error ? (
          <div className="error-banner">
            <span>{state.error}</span>
            <button onClick={() => setError(null)}>Close</button>
          </div>
        ) : null}
        {renderView()}
        {toastMessage ? <div className="app-toast">{toastMessage}</div> : null}
      </main>
    </div>
  );
}

export default App;
