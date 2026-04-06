import { useEffect, useState } from "react";
import { open as pickOpenPath } from "@tauri-apps/plugin-dialog";
import { getDefaultConfigPath, saveConfig, saveSettings } from "../hooks/useTauri";
import { useAppStore } from "../store/appStore";
import { Config } from "../types";
import { t, Lang } from "../i18n";
import "./WelcomeWizard.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
  onFinish: () => void;
};

function getDirectoryFromConfigPath(path: string) {
  const normalized = path.trim();
  if (!normalized) return "";
  const separatorIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return separatorIndex < 0 ? normalized : normalized.slice(0, separatorIndex);
}

function buildConfigPathFromDirectory(directory: string) {
  const normalized = directory.trim().replace(/[\\/]+$/, "");
  if (!normalized) return "config.json";
  const separator = normalized.includes("\\") ? "\\" : "/";
  return `${normalized}${separator}config.json`;
}

export function WelcomeWizard({ store, onFinish }: Props) {
  const { state, setSettings, setConfig, setError } = store;
  const [lang, setLang] = useState<Lang>((state.settings.language ?? "en") as Lang);
  const [step, setStep] = useState(1);
  const [configPath, setConfigPath] = useState("");
  const [modeName, setModeName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);

  const totalSteps = 3;

  useEffect(() => {
    getDefaultConfigPath().then(setConfigPath).catch(() => {});
  }, []);

  function handleLangChange(nextLang: Lang) {
    setLang(nextLang);
    setSettings({ language: nextLang });
  }

  async function handleBrowseConfigDirectory() {
    try {
      const selected = await pickOpenPath({
        title: "Select Config Folder",
        directory: true,
        multiple: false,
        defaultPath: getDirectoryFromConfigPath(configPath) || undefined,
      });

      if (typeof selected === "string" && selected.trim()) {
        setConfigPath(buildConfigPathFromDirectory(selected));
      }
    } catch (error) {
      setError(`Failed to choose config folder: ${error}`);
    }
  }

  async function handleUseDefaultPath() {
    try {
      const defaultPath = await getDefaultConfigPath();
      setConfigPath(defaultPath);
    } catch (error) {
      setError(`Failed to get default path: ${error}`);
    }
  }

  async function handleFinish(createMode: boolean) {
    setLoading(true);
    try {
      const targets = pasteText
        .split(/[\n\r,]+/)
        .map((value) => value.trim())
        .filter((value) => value.startsWith("http"))
        .map((value) => ({ type: "url" as const, value, label: "" }));

      const config: Config = {
        version: 1,
        modes:
          createMode && modeName.trim()
            ? [
                {
                  id: crypto.randomUUID(),
                  name: modeName.trim(),
                  targets,
                  exitAction: "nothing",
                },
              ]
            : [],
      };

      await saveConfig(configPath, config);
      setConfig(config);

      const nextSettings = {
        ...state.settings,
        language: lang,
        configFilePath: configPath,
        onboardingComplete: true,
      };

      setSettings(nextSettings);
      await saveSettings(nextSettings);
      onFinish();
    } catch (error) {
      setError(`Setup failed: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        <div className="wizard-lang-toggle">
          <button className={lang === "en" ? "active" : ""} onClick={() => handleLangChange("en")}>
            EN
          </button>
          <button className={lang === "ja" ? "active" : ""} onClick={() => handleLangChange("ja")}>
            JA
          </button>
        </div>

        {step === 1 && (
          <div className="wizard-step">
            <div className="wizard-hero">FlowSwitch</div>
            <h1>{t(lang, "welcome_title")}</h1>
            <p className="wizard-desc">{t(lang, "welcome_desc")}</p>
            <button className="wizard-btn primary" onClick={() => setStep(2)}>
              {t(lang, "get_started")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <div className="wizard-step-indicator">{t(lang, "step_of", 1, totalSteps - 1)}</div>
            <h2>{t(lang, "setup_path_title")}</h2>
            <p className="wizard-desc">{t(lang, "setup_path_desc")}</p>
            <div className="wizard-input-row">
              <input
                type="text"
                value={configPath}
                onChange={(event) => setConfigPath(event.target.value)}
                placeholder="/path/to/FlowSwitch/config.json"
              />
              <button className="wizard-btn outline" onClick={handleBrowseConfigDirectory}>
                {t(lang, "browse")}
              </button>
              <button className="wizard-btn outline" onClick={handleUseDefaultPath}>
                {t(lang, "default_btn")}
              </button>
            </div>
            <div className="wizard-nav">
              <button className="wizard-btn ghost" onClick={() => setStep(1)}>
                {t(lang, "back")}
              </button>
              <button className="wizard-btn primary" onClick={() => setStep(3)} disabled={!configPath.trim()}>
                {t(lang, "next")}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <div className="wizard-step-indicator">{t(lang, "step_of", 2, totalSteps - 1)}</div>
            <h2>{t(lang, "first_mode_title")}</h2>
            <p className="wizard-desc">{t(lang, "first_mode_desc")}</p>
            <div className="wizard-form">
              <input
                type="text"
                value={modeName}
                onChange={(event) => setModeName(event.target.value)}
                placeholder={t(lang, "mode_name_wizard_ph")}
                className="wizard-mode-name"
              />
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={t(lang, "urls_wizard_ph")}
                className="wizard-urls"
                rows={4}
              />
            </div>
            <div className="wizard-nav">
              <button className="wizard-btn ghost" onClick={() => setStep(2)}>
                {t(lang, "back")}
              </button>
              <button className="wizard-btn ghost" onClick={() => handleFinish(false)} disabled={loading}>
                {t(lang, "skip")}
              </button>
              <button
                className="wizard-btn primary"
                onClick={() => handleFinish(true)}
                disabled={loading || !modeName.trim()}
              >
                {t(lang, "create_and_finish")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
