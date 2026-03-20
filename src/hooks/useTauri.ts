import { invoke } from "@tauri-apps/api/core";
import { Config, ModeExecutionResult, AppSettings } from "../types";

export async function loadConfig(filePath: string): Promise<Config> {
  return invoke<Config>("load_config", { filePath });
}

export async function saveConfig(
  filePath: string,
  config: Config
): Promise<void> {
  return invoke<void>("save_config", { filePath, config });
}

export async function executeMode(
  modeId: string,
  config: Config
): Promise<ModeExecutionResult> {
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
