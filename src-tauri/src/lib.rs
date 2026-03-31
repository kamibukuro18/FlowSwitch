mod commands;
mod config;
mod drop_target;
mod executor;

use commands::*;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

// ── Shared app state (config cached for tray execution) ──────────────────────

pub(crate) struct AppState {
    pub config: std::sync::Mutex<Option<config::Config>>,
    pub settings: std::sync::Mutex<config::AppSettings>,
}

// ── Tray menu builder ─────────────────────────────────────────────────────────

pub(crate) fn build_tray_menu(
    app: &tauri::AppHandle,
    modes: &[config::Mode],
) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;

    for mode in modes {
        let label = if let Some(icon) = &mode.icon {
            format!("{} {}", icon, mode.name)
        } else {
            mode.name.clone()
        };
        let item = MenuItem::with_id(app, format!("mode:{}", mode.id), label, true, None::<&str>)?;
        menu.append(&item)?;
    }

    if !modes.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }

    let show_item = MenuItem::with_id(app, "show", "FlowSwitch を開く", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
    menu.append(&show_item)?;
    menu.append(&quit_item)?;

    Ok(menu)
}

// ── Window helper ─────────────────────────────────────────────────────────────

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let persisted_settings = commands::load_settings_from_disk;
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            let initial_settings = persisted_settings(app.handle());
            app.manage(AppState {
                config: std::sync::Mutex::new(None),
                settings: std::sync::Mutex::new(initial_settings),
            });

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Register custom OLE drop target (Windows only).
            #[cfg(target_os = "windows")]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let h2 = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        if let Some(win) = h2.get_webview_window("main") {
                            if let Ok(hwnd) = win.hwnd() {
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

            // ── System tray ───────────────────────────────────────────────────

            let initial_menu = build_tray_menu(app.handle(), &[])
                .expect("failed to build initial tray menu");

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("no window icon"))
                .tooltip("FlowSwitch")
                .menu(&initial_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &tauri::AppHandle, event: tauri::menu::MenuEvent| {
                    match event.id().as_ref() {
                        "show" => show_main_window(app),
                        "quit" => app.exit(0),
                        id => {
                            if let Some(mode_id) = id.strip_prefix("mode:") {
                                let mode_id = mode_id.to_owned();
                                // Lock, execute, then drop lock before emit
                                let result = {
                                    let state = app.state::<AppState>();
                                    let guard = state.config.lock().unwrap();
                                    guard.as_ref()
                                        .and_then(|cfg| {
                                            cfg.modes.iter().find(|m| m.id == mode_id)
                                        })
                                        .map(executor::execute_mode)
                                };
                                if let Some(r) = result {
                                    let _ = app.emit("tray-mode-executed", &r);
                                }
                            }
                        }
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: TrayIconEvent| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // ── Hide to tray on window close ──────────────────────────────────

            let window = app.get_webview_window("main").unwrap();
            window.on_window_event({
                let app = app.handle().clone();
                let window = window.clone();
                move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let keep_running_in_tray = {
                            let state = app.state::<AppState>();
                            let keep_running = state.settings.lock().unwrap().keep_running_in_tray;
                            keep_running
                        };
                        if keep_running_in_tray {
                            api.prevent_close();
                            let _ = window.hide();
                        }
                    }
                }
            });

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
            update_tray_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
