import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { loadConfig, saveSettings, getDefaultConfigPath } from "../hooks/useTauri";
import { t, Lang } from "../i18n";
import "./SettingsView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

export function SettingsView({ store }: Props) {
  const { state, setConfig, setSettings, setError, setLoading } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const [configPath, setConfigPath] = useState(state.settings.configFilePath ?? "");
  const [saved, setSaved] = useState(false);

  async function handleAppearanceChange(
    patch: {
      theme?: "light" | "dark" | "system";
      language?: "en" | "ja";
      keepRunningInTray?: boolean;
    }
  ) {
    const next = { ...state.settings, ...patch };
    setSettings(patch);
    await saveSettings(next).catch(() => {});
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
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(`Failed to load config: ${err}`);
    } finally {
      setLoading(false);
    }
  }


  async function handleUseDefault() {
    try {
      const defaultPath = await getDefaultConfigPath();
      setConfigPath(defaultPath);
    } catch (err) {
      setError(`Failed to get default path: ${err}`);
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
              onChange={(e) => setConfigPath(e.target.value)}
              placeholder="/path/to/flowswitch.json"
            />
            <button className="btn-outline" onClick={handleUseDefault}>
              {t(lang, "default_btn")}
            </button>
          </div>

          <div className="config-actions">
            <button className="btn-primary" onClick={handleLoadConfig}>
              {t(lang, "load_config")}
            </button>
            {saved && <span className="saved-indicator">{t(lang, "saved_indicator")}</span>}
          </div>
          <p className="settings-auto-save-note">{t(lang, "auto_save_note")}</p>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">{t(lang, "appearance")}</h3>
          <div className="settings-row">
            <label>{t(lang, "theme_label")}</label>
            <select
              value={state.settings.theme ?? "dark"}
              onChange={(e) => handleAppearanceChange({ theme: e.target.value as "light" | "dark" | "system" })}
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
              onChange={(e) => handleAppearanceChange({ language: e.target.value as "en" | "ja" })}
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
              onChange={(e) => handleAppearanceChange({ keepRunningInTray: e.target.checked })}
            />
          </div>
          <p className="settings-section-desc">{t(lang, "tray_residency_desc")}</p>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">{t(lang, "config_format")}</h3>
          <p className="settings-section-desc">{t(lang, "config_format_desc")}</p>
          <pre className="config-example">{JSON.stringify({
            version: 1,
            modes: [{
              id: "dev",
              name: "Development",
              description: "Start coding environment",
              shortcut: "CmdOrCtrl+Shift+1",
              color: "#6366f1",
              icon: "⌨️",
              exitAction: "minimize",
              targets: [
                { type: "url", value: "https://github.com", label: "GitHub" },
                {
                  type: "directory",
                  label: "Projects",
                  path: { macos: "~/Projects", windows: "%USERPROFILE%\\Projects" }
                },
                {
                  type: "application",
                  name: "VSCode",
                  path: {
                    macos: "/Applications/Visual Studio Code.app",
                    windows: "C:\\...\\Code.exe"
                  }
                }
              ]
            }]
          }, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
