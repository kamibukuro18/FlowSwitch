mod commands;
mod config;
mod executor;

use commands::*;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            execute_mode,
            load_settings,
            save_settings,
            get_default_config_path,
            check_path_type,
            select_file,
            select_directory,
            register_shortcuts,
            get_browser_tabs,
            get_browser_bookmarks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
