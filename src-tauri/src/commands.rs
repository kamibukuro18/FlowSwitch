use crate::config::{AppSettings, Config, ModeExecutionResult};
use crate::executor;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn settings_path(app: &AppHandle) -> PathBuf {
    app.path().app_config_dir()
        .unwrap_or_else(|_| dirs::config_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("settings.json")
}

#[tauri::command]
pub fn load_config(file_path: String) -> Result<Config, String> {
    let path = expand_home(&file_path);
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read config file '{}': {}", path, e))?;
    serde_json::from_str::<Config>(&content)
        .map_err(|e| format!("Invalid config JSON: {}", e))
}

#[tauri::command]
pub fn save_config(file_path: String, config: Config) -> Result<(), String> {
    let path = expand_home(&file_path);
    // Create parent directories if needed
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))
}

#[tauri::command]
pub fn execute_mode(mode_id: String, config: Config) -> Result<ModeExecutionResult, String> {
    let mode = config
        .modes
        .iter()
        .find(|m| m.id == mode_id)
        .ok_or_else(|| format!("Mode '{}' not found", mode_id))?;

    Ok(executor::execute_mode(mode))
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app);
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read settings: {}", e))?;
    serde_json::from_str::<AppSettings>(&content)
        .map_err(|e| format!("Invalid settings JSON: {}", e))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

#[tauri::command]
pub fn get_default_config_path(app: AppHandle) -> Result<String, String> {
    let path = app.path().document_dir()
        .unwrap_or_else(|_| dirs::document_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("FlowSwitch")
        .join("config.json");
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn select_file() -> Result<Option<String>, String> {
    // Handled via plugin-dialog in frontend
    Ok(None)
}

#[tauri::command]
pub fn select_directory() -> Result<Option<String>, String> {
    // Handled via plugin-dialog in frontend
    Ok(None)
}

#[tauri::command]
pub fn register_shortcuts(_app: AppHandle, _config: Config) -> Result<(), String> {
    // Global shortcuts are registered via the plugin-global-shortcut plugin
    // This command is a placeholder; actual registration happens via the Tauri plugin API
    // called from the frontend using @tauri-apps/plugin-global-shortcut
    Ok(())
}

fn expand_home(path: &str) -> String {
    if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            return path.replacen('~', &home.to_string_lossy(), 1);
        }
    }
    path.to_string()
}
