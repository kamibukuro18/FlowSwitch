import { useEffect, useState } from "react";
import { save as pickSavePath } from "@tauri-apps/plugin-dialog";
import {
  getDefaultConfigPath,
  getLaunchAtStartup,
  loadConfig,
  saveSettings,
  setLaunchAtStartup,
} from "../hooks/useTauri";
import { useAppStore } from "../store/appStore";
import { t, Lang } from "../i18n";
import "./SettingsView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

const CONFIG_EXAMPLE = {
  version: 1,
  modes: [
    {
      id: "dev",
      name: "Development",
      description: "Start coding environment",
      shortcut: "CmdOrCtrl+Shift+1",
      color: "#6366f1",
      icon: "⚙️",
      exitAction: "minimize",
      targets: [
        { type: "url", value: "https://github.com", label: "GitHub" },
        {
          type: "directory",
          label: "Projects",
          path: { macos: "~/Projects", windows: "%USERPROFILE%\\Projects" },
        },
        {
          type: "application",
          name: "VSCode",
          path: {
            macos: "/Applications/Visual Studio Code.app",
            windows: "C:\\Program Files\\Microsoft VS Code\\Code.exe",
          },
        },
      ],
    },
  ],
};

export function SettingsView({ store }: Props) {
  const { state, setConfig, setSettings, setError, setLoading } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const [configPath, setConfigPath] = useState(state.settings.configFilePath ?? "");
  const [saved, setSaved] = useState(false);
  const [startupBusy, setStartupBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getLaunchAtStartup()
      .then((enabled) => {
        if (!cancelled) setSettings({ launchAtStartup: enabled });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [setSettings]);

  async function handleAppearanceChange(
    patch: {
      theme?: "light" | "dark" | "system";
      language?: "en" | "ja";
      keepRunningInTray?: boolean;
      launchAtStartup?: boolean;
    }
  ) {
    const nextSettings = { ...state.settings, ...patch };
    setSettings(patch);
    await saveSettings(nextSettings).catch(() => {});
  }

  async function handleStartupChange(enabled: boolean) {
    const previous = state.settings.launchAtStartup ?? false;
    setStartupBusy(true);
    setSettings({ launchAtStartup: enabled });

    try {
      await setLaunchAtStartup(enabled);
      await saveSettings({ ...state.settings, launchAtStartup: enabled });
    } catch (error) {
      setSettings({ launchAtStartup: previous });
      setError(`Failed to update startup setting: ${error}`);
    } finally {
      setStartupBusy(false);
    }
  }

  async function handleLoadConfig() {
    if (!configPath.trim()) {
      setError("Please enter a config file path");
      return;
    }

    setLoading(true);
    try {
      const config = await loadConfig(configPath.trim());
      setConfig(config);
      setSettings({ configFilePath: configPath.trim() });
      await saveSettings({ ...state.settings, configFilePath: configPath.trim() });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setError(`Failed to load config: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleUseDefault() {
    try {
      const defaultPath = await getDefaultConfigPath();
      setConfigPath(defaultPath);
    } catch (error) {
      setError(`Failed to get default path: ${error}`);
    }
  }

  async function handleBrowseConfigPath() {
    try {
      const selected = await pickSavePath({
        title: "Select Config File",
        defaultPath: configPath || (await getDefaultConfigPath()),
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (selected) {
        setConfigPath(selected);
      }
    } catch (error) {
      setError(`Failed to choose config file path: ${error}`);
    }
  }

  return (
    <div className="settings-view">
      <div className="view-header">
        <h1>{t(lang, "settings")}</h1>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h3 className="settings-section-title">{t(lang, "config_file")}</h3>
          <p className="settings-section-desc">{t(lang, "config_file_desc")}</p>

          <div className="config-path-row">
            <input
              type="text"
              value={configPath}
              onChange={(event) => setConfigPath(event.target.value)}
              placeholder="/path/to/flowswitch.json"
            />
            <button className="btn-outline" onClick={handleBrowseConfigPath}>
              {t(lang, "browse")}
            </button>
            <button className="btn-outline" onClick={handleUseDefault}>
              {t(lang, "default_btn")}
            </button>
          </div>

          <div className="config-actions">
            <button className="btn-primary" onClick={handleLoadConfig}>
              {t(lang, "load_config")}
            </button>
            {saved ? <span className="saved-indicator">{t(lang, "saved_indicator")}</span> : null}
          </div>
          <p className="settings-auto-save-note">{t(lang, "auto_save_note")}</p>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">{t(lang, "appearance")}</h3>
          <div className="settings-row">
            <label>{t(lang, "theme_label")}</label>
            <select
              value={state.settings.theme ?? "dark"}
              onChange={(event) =>
                handleAppearanceChange({
                  theme: event.target.value as "light" | "dark" | "system",
                })
              }
            >
              <option value="dark">{t(lang, "theme_dark")}</option>
              <option value="light">{t(lang, "theme_light")}</option>
              <option value="system">{t(lang, "theme_system")}</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{t(lang, "language_label")}</label>
            <select
              value={state.settings.language ?? "en"}
              onChange={(event) =>
                handleAppearanceChange({ language: event.target.value as "en" | "ja" })
              }
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{t(lang, "tray_residency_label")}</label>
            <input
              type="checkbox"
              checked={state.settings.keepRunningInTray ?? true}
              onChange={(event) =>
                handleAppearanceChange({ keepRunningInTray: event.target.checked })
              }
            />
          </div>
          <p className="settings-section-desc">{t(lang, "tray_residency_desc")}</p>
          <div className="settings-row">
            <label>{t(lang, "startup_launch_label")}</label>
            <input
              type="checkbox"
              checked={state.settings.launchAtStartup ?? false}
              disabled={startupBusy}
              onChange={(event) => void handleStartupChange(event.target.checked)}
            />
          </div>
          <p className="settings-section-desc">{t(lang, "startup_launch_desc")}</p>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">{t(lang, "config_format")}</h3>
          <p className="settings-section-desc">{t(lang, "config_format_desc")}</p>
          <pre className="config-example">{JSON.stringify(CONFIG_EXAMPLE, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
