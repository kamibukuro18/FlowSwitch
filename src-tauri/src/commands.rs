use crate::config::{AppSettings, Config, ModeExecutionResult};
use crate::executor;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};

fn settings_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| dirs::config_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("settings.json")
}

pub(crate) fn load_settings_from_disk(app: &AppHandle) -> AppSettings {
    let path = settings_path(app);
    if !path.exists() {
        return AppSettings::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<AppSettings>(&content).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn load_config(file_path: String) -> Result<Config, String> {
    let path = expand_home(&file_path);
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read config file '{}': {}", path, e))?;
    serde_json::from_str::<Config>(&content).map_err(|e| format!("Invalid config JSON: {}", e))
}

#[tauri::command]
pub fn save_config(file_path: String, config: Config) -> Result<(), String> {
    let path = expand_home(&file_path);
    // Create parent directories if needed
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write config file: {}", e))
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
    Ok(load_settings_from_disk(&app))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let keep_running_in_tray = settings.keep_running_in_tray;
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))?;

    let state = app.state::<crate::AppState>();
    *state.settings.lock().unwrap() = settings;
    crate::apply_macos_residency(&app, keep_running_in_tray).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_default_config_path(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .document_dir()
        .unwrap_or_else(|_| dirs::document_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("FlowSwitch")
        .join("config.json");
    Ok(path.to_string_lossy().to_string())
}

/// Returns "dir", "app", or "file" for a given path.
#[tauri::command]
pub fn check_path_type(path: String) -> String {
    let p = std::path::Path::new(&path);
    if p.is_dir() {
        // On macOS, .app bundles are directories — treat them as apps
        if path.to_lowercase().ends_with(".app") {
            return "app".into();
        }
        return "dir".into();
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if matches!(
        ext.as_str(),
        "exe" | "msi" | "dmg" | "pkg" | "sh" | "bat" | "cmd"
    ) {
        return "app".into();
    }
    "file".into()
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

#[tauri::command]
pub fn get_browser_tabs() -> Result<Vec<String>, String> {
    // Query Chrome/Edge remote debugging API on common ports
    for port in [9222u16, 9223, 9224] {
        if let Ok(mut stream) = TcpStream::connect(format!("127.0.0.1:{}", port)) {
            stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
            let req = format!(
                "GET /json/list HTTP/1.1\r\nHost: localhost:{}\r\nConnection: close\r\n\r\n",
                port
            );
            if stream.write_all(req.as_bytes()).is_err() {
                continue;
            }
            let mut response = String::new();
            stream.read_to_string(&mut response).ok();
            if let Some(body_start) = response.find("\r\n\r\n") {
                let body = &response[body_start + 4..];
                if let Ok(tabs) = serde_json::from_str::<Vec<serde_json::Value>>(body) {
                    let urls: Vec<String> = tabs
                        .iter()
                        .filter_map(|t| t["url"].as_str())
                        .filter(|u| u.starts_with("http"))
                        .map(String::from)
                        .collect();
                    if !urls.is_empty() {
                        return Ok(urls);
                    }
                }
            }
        }
    }
    Err("ブラウザが見つかりません。Chrome/Edge を --remote-debugging-port=9222 で起動してください。".to_string())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BookmarkItem {
    pub browser: String,
    pub folder: String,
    pub name: String,
    pub url: String,
}

#[tauri::command]
pub fn get_browser_bookmarks() -> Vec<BookmarkItem> {
    let mut result = Vec::new();
    for (browser, path) in bookmark_paths() {
        if !path.exists() {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };
        let Some(roots) = json.get("roots") else {
            continue;
        };
        for root in &["bookmark_bar", "other", "synced"] {
            if let Some(node) = roots.get(root) {
                collect_bookmarks(node, &browser, "", &mut result);
            }
        }
    }
    result
}

fn bookmark_paths() -> Vec<(String, PathBuf)> {
    let mut paths = Vec::new();
    #[cfg(target_os = "windows")]
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let base = PathBuf::from(&local);
        paths.push((
            "Chrome".into(),
            base.join("Google/Chrome/User Data/Default/Bookmarks"),
        ));
        paths.push((
            "Edge".into(),
            base.join("Microsoft/Edge/User Data/Default/Bookmarks"),
        ));
        paths.push((
            "Brave".into(),
            base.join("BraveSoftware/Brave-Browser/User Data/Default/Bookmarks"),
        ));
    }
    #[cfg(target_os = "macos")]
    if let Some(home) = dirs::home_dir() {
        let lib = home.join("Library/Application Support");
        paths.push(("Chrome".into(), lib.join("Google/Chrome/Default/Bookmarks")));
        paths.push(("Edge".into(), lib.join("Microsoft Edge/Default/Bookmarks")));
        paths.push((
            "Brave".into(),
            lib.join("BraveSoftware/Brave-Browser/Default/Bookmarks"),
        ));
    }
    paths
}

fn collect_bookmarks(
    node: &serde_json::Value,
    browser: &str,
    folder: &str,
    out: &mut Vec<BookmarkItem>,
) {
    match node.get("type").and_then(|t| t.as_str()) {
        Some("url") => {
            let name = node
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let url = node
                .get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if url.starts_with("http") {
                out.push(BookmarkItem {
                    browser: browser.into(),
                    folder: folder.into(),
                    name,
                    url,
                });
            }
        }
        Some("folder") => {
            let fname = node.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let next_folder = if folder.is_empty() {
                fname.to_string()
            } else {
                format!("{} / {}", folder, fname)
            };
            if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
                for child in children {
                    collect_bookmarks(child, browser, &next_folder, out);
                }
            }
        }
        _ => {}
    }
}

/// Called from the frontend whenever the config changes.
/// Updates the cached config in AppState and rebuilds the tray context menu.
#[tauri::command]
pub fn update_tray_menu(app: AppHandle, config: Config) -> Result<(), String> {
    // Cache config for tray-triggered executions
    {
        let state = app.state::<crate::AppState>();
        *state.config.lock().unwrap() = Some(config.clone());
    }
    // Rebuild and apply the tray menu
    let menu = crate::build_tray_menu(&app, &config.modes).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
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
