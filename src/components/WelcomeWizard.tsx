import { useState, useEffect } from "react";
import { t, Lang } from "../i18n";
import { Config } from "../types";
import { getDefaultConfigPath, saveSettings, saveConfig } from "../hooks/useTauri";
import { useAppStore } from "../store/appStore";
import "./WelcomeWizard.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
  onFinish: () => void;
};

export function WelcomeWizard({ store, onFinish }: Props) {
  const { state, setSettings, setConfig, setError } = store;
  const [lang, setLang] = useState<Lang>((state.settings.language ?? "en") as Lang);
  const [step, setStep] = useState(1);
  const [configPath, setConfigPath] = useState("");
  const [modeName, setModeName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);

  const TOTAL_STEPS = 3;

  // Initialise default path on first render
  useEffect(() => {
    getDefaultConfigPath().then((p) => setConfigPath(p)).catch(() => {});
  }, []);

  function handleLangChange(newLang: Lang) {
    setLang(newLang);
    setSettings({ language: newLang });
  }

  async function handleFinish(createMode: boolean) {
    setLoading(true);
    try {
      const targets = pasteText
        .split(/[\n\r,]+/)
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"))
        .map((url) => ({ type: "url" as const, value: url, label: "" }));

      const config: Config = {
        version: 1,
        modes: createMode && modeName.trim()
          ? [{
              id: crypto.randomUUID(),
              name: modeName.trim(),
              targets,
              exitAction: "nothing",
            }]
          : [],
      };

      // Save config file
      await saveConfig(configPath, config);
      setConfig(config);

      // Save settings with onboarding flag
      const newSettings = {
        ...state.settings,
        language: lang,
        configFilePath: configPath,
        onboardingComplete: true,
      };
      setSettings(newSettings);
      await saveSettings(newSettings);

      onFinish();
    } catch (err) {
      setError(`Setup failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        {/* Language toggle — always visible */}
        <div className="wizard-lang-toggle">
          <button className={lang === "en" ? "active" : ""} onClick={() => handleLangChange("en")}>EN</button>
          <button className={lang === "ja" ? "active" : ""} onClick={() => handleLangChange("ja")}>JA</button>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="wizard-step">
            <div className="wizard-hero">⚡</div>
            <h1>{t(lang, "welcome_title")}</h1>
            <p className="wizard-desc">{t(lang, "welcome_desc")}</p>
            <button className="wizard-btn primary" onClick={() => setStep(2)}>
              {t(lang, "get_started")}
            </button>
          </div>
        )}

        {/* Step 2: Config path */}
        {step === 2 && (
          <div className="wizard-step">
            <div className="wizard-step-indicator">{t(lang, "step_of", 1, TOTAL_STEPS - 1)}</div>
            <h2>{t(lang, "setup_path_title")}</h2>
            <p className="wizard-desc">{t(lang, "setup_path_desc")}</p>
            <div className="wizard-input-row">
              <input
                type="text"
                value={configPath}
                onChange={(e) => setConfigPath(e.target.value)}
                placeholder="/path/to/flowswitch.json"
              />
              <button
                className="wizard-btn outline"
                onClick={() => getDefaultConfigPath().then((p) => setConfigPath(p)).catch(() => {})}
              >
                {t(lang, "default_btn")}
              </button>
            </div>
            <div className="wizard-nav">
              <button className="wizard-btn ghost" onClick={() => setStep(1)}>{t(lang, "back")}</button>
              <button className="wizard-btn primary" onClick={() => setStep(3)} disabled={!configPath.trim()}>
                {t(lang, "next")}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: First mode */}
        {step === 3 && (
          <div className="wizard-step">
            <div className="wizard-step-indicator">{t(lang, "step_of", 2, TOTAL_STEPS - 1)}</div>
            <h2>{t(lang, "first_mode_title")}</h2>
            <p className="wizard-desc">{t(lang, "first_mode_desc")}</p>
            <div className="wizard-form">
              <input
                type="text"
                value={modeName}
                onChange={(e) => setModeName(e.target.value)}
                placeholder={t(lang, "mode_name_wizard_ph")}
                className="wizard-mode-name"
              />
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t(lang, "urls_wizard_ph")}
                className="wizard-urls"
                rows={4}
              />
            </div>
            <div className="wizard-nav">
              <button className="wizard-btn ghost" onClick={() => setStep(2)}>{t(lang, "back")}</button>
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
