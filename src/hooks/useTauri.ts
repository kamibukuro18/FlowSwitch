import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { Config, ModeExecutionResult, AppSettings } from "../types";

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return Promise.reject(
      new Error("Tauri context not available. Run the app with: npm run tauri dev")
    );
  }
  return tauriInvoke<T>(cmd, args);
}

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

export async function checkPathType(path: string): Promise<"dir" | "app" | "file"> {
  return invoke<"dir" | "app" | "file">("check_path_type", { path });
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

export async function getBrowserTabs(): Promise<string[]> {
  return invoke<string[]>("get_browser_tabs");
}

export type BookmarkItem = {
  browser: string;
  folder: string;
  name: string;
  url: string;
};

export async function getBrowserBookmarks(): Promise<BookmarkItem[]> {
  return invoke<BookmarkItem[]>("get_browser_bookmarks");
}

export async function updateTrayMenu(config: Config): Promise<void> {
  return invoke<void>("update_tray_menu", { config });
}
