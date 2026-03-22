import { invoke, isTauri } from "@tauri-apps/api/core";
import { Config, ModeExecutionResult, AppSettings } from "../types";

function assertTauri() {
  if (!isTauri()) {
    throw new Error(
      "Tauri IPC not available. Run the app with 'npm run tauri dev' or as a built desktop app."
    );
  }
}

export async function loadConfig(filePath: string): Promise<Config> {
  assertTauri();
  return invoke<Config>("load_config", { filePath });
}

export async function saveConfig(
  filePath: string,
  config: Config
): Promise<void> {
  assertTauri();
  return invoke<void>("save_config", { filePath, config });
}

export async function executeMode(
  modeId: string,
  config: Config
): Promise<ModeExecutionResult> {
  assertTauri();
  return invoke<ModeExecutionResult>("execute_mode", { modeId, config });
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>("save_settings", { settings });
}

export async function registerShortcuts(config: Config): Promise<void> {
  return invoke<void>("register_shortcuts", { config });
}

export async function selectFile(): Promise<string | null> {
  return invoke<string | null>("select_file");
}

export async function selectDirectory(): Promise<string | null> {
  return invoke<string | null>("select_directory");
}

export async function getDefaultConfigPath(): Promise<string> {
  return invoke<string>("get_default_config_path");
}
