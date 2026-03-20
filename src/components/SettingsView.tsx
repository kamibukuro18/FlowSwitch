import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { loadConfig, saveSettings, getDefaultConfigPath, saveConfig } from "../hooks/useTauri";
import "./SettingsView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

export function SettingsView({ store }: Props) {
  const { state, setConfig, setSettings, setError, setLoading } = store;
  const [configPath, setConfigPath] = useState(state.settings.configFilePath ?? "");
  const [saved, setSaved] = useState(false);

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

  async function handleSaveConfig() {
    if (!state.config || !configPath.trim()) return;
    setLoading(true);
    try {
      await saveConfig(configPath.trim(), state.config);
      setSettings({ configFilePath: configPath.trim() });
      await saveSettings({ ...state.settings, configFilePath: configPath.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(`Failed to save config: ${err}`);
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
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h3 className="settings-section-title">Config File</h3>
          <p className="settings-section-desc">
            Specify where your modes configuration file is stored. Use a synced folder (iCloud, Dropbox, etc.) to share between devices.
          </p>

          <div className="config-path-row">
            <input
              type="text"
              value={configPath}
              onChange={(e) => setConfigPath(e.target.value)}
              placeholder="/path/to/flowswitch.json"
            />
            <button className="btn-outline" onClick={handleUseDefault}>
              Default
            </button>
          </div>

          <div className="config-actions">
            <button className="btn-primary" onClick={handleLoadConfig}>
              Load Config
            </button>
            <button className="btn-secondary" onClick={handleSaveConfig} disabled={!state.config}>
              Save Current Config
            </button>
            {saved && <span className="saved-indicator">✓ Saved</span>}
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>
          <div className="settings-row">
            <label>Theme</label>
            <select
              value={state.settings.theme ?? "dark"}
              onChange={(e) => setSettings({ theme: e.target.value as "light" | "dark" | "system" })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
          <div className="settings-row">
            <label>Language</label>
            <select
              value={state.settings.language ?? "en"}
              onChange={(e) => setSettings({ language: e.target.value as "en" | "ja" })}
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Config File Format</h3>
          <p className="settings-section-desc">
            The config file is a JSON file with the following structure. You can edit it directly or use this app to manage modes.
          </p>
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
