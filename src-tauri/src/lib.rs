mod commands;
mod config;
mod drop_target;
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

            // Register custom OLE drop target (Windows only).
            // We spawn a thread and wait briefly for WebView2 to create its
            // child windows before we revoke its IDropTarget and install ours.
            #[cfg(target_os = "windows")]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Wait for WebView2 to create its child windows
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let h2 = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        if let Some(win) = h2.get_webview_window("main") {
                            if let Ok(hwnd) = win.hwnd() {
                                // Extract raw isize from HWND regardless of windows-rs version.
                                // Tauri may use a different windows-rs than our drop_target module.
                                // HWND is always a single pointer-sized value, so this is safe.
                                let raw: isize = unsafe {
                                    let ptr = &hwnd as *const _ as *const isize;
                                    *ptr
                                };
                                unsafe { drop_target::win::setup(&h2, raw) };
                            }
                        }
                    });
                });
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
