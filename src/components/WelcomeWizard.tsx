import { useEffect, useState } from "react";
import { ask, confirm, open as pickOpenPath } from "@tauri-apps/plugin-dialog";
import {
  getDefaultConfigPath,
  loadConfig,
  pathExists,
  saveConfig,
  saveSettings,
} from "../hooks/useTauri";
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

function getWizardDialogText(lang: Lang) {
  if (lang === "ja") {
    return {
      existingTitle: "既存の設定ファイルがあります",
      existingMessage:
        "選択した場所には既に config.json があります。既存の設定を読み込みますか？\n\n「いいえ」を選ぶと、新しい設定作成へ進みます。保存時に上書き確認を行います。",
      useExisting: "既存設定を使う",
      createNew: "新規作成へ進む",
      overwriteTitle: "設定ファイルを上書きしますか？",
      overwriteMessage:
        "この場所には既に設定ファイルがあります。上書きすると既存の内容は置き換えられます。\n\n上書きして続行しますか？",
      overwrite: "上書きする",
      cancel: "キャンセル",
    };
  }

  return {
    existingTitle: "Existing Config Found",
    existingMessage:
      "A config.json file already exists at the selected location. Do you want to load the existing config?\n\nChoose No to continue creating a new config. You will be asked again before overwriting.",
    useExisting: "Use Existing",
    createNew: "Create New",
    overwriteTitle: "Overwrite Config File?",
    overwriteMessage:
      "A config file already exists at this location. Overwriting it will replace the existing contents.\n\nDo you want to overwrite it and continue?",
    overwrite: "Overwrite",
    cancel: "Cancel",
  };
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

  async function finishWithExistingConfig() {
    setLoading(true);
    try {
      const config = await loadConfig(configPath.trim());
      setConfig(config);

      const nextSettings = {
        ...state.settings,
        language: lang,
        configFilePath: configPath.trim(),
        onboardingComplete: true,
      };

      setSettings(nextSettings);
      await saveSettings(nextSettings);
      onFinish();
    } catch (error) {
      setError(`Failed to load existing config: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleNextFromConfigStep() {
    const path = configPath.trim();
    if (!path) return;

    if (await pathExists(path)) {
      const text = getWizardDialogText(lang);
      const useExisting = await ask(text.existingMessage, {
        title: text.existingTitle,
        kind: "warning",
        okLabel: text.useExisting,
        cancelLabel: text.createNew,
      });

      if (useExisting) {
        await finishWithExistingConfig();
        return;
      }
    }

    setStep(3);
  }

  async function handleFinish(createMode: boolean) {
    setLoading(true);
    try {
      const path = configPath.trim();
      if (!path) {
        setLoading(false);
        return;
      }

      if (await pathExists(path)) {
        const text = getWizardDialogText(lang);
        const overwrite = await confirm(text.overwriteMessage, {
          title: text.overwriteTitle,
          kind: "warning",
          okLabel: text.overwrite,
          cancelLabel: text.cancel,
        });

        if (!overwrite) {
          return;
        }
      }

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

      await saveConfig(path, config);
      setConfig(config);

      const nextSettings = {
        ...state.settings,
        language: lang,
        configFilePath: path,
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
              <button
                className="wizard-btn primary"
                onClick={() => void handleNextFromConfigStep()}
                disabled={!configPath.trim() || loading}
              >
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
