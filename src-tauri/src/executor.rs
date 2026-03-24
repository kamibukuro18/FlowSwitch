use crate::config::{ExecutionResult, Mode, ModeExecutionResult, Target};
use std::process::Command;

#[cfg(target_os = "macos")]
const CURRENT_OS: &str = "macos";

#[cfg(target_os = "windows")]
const CURRENT_OS: &str = "windows";

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const CURRENT_OS: &str = "linux";

pub fn execute_mode(mode: &Mode) -> ModeExecutionResult {
    if mode.close_others_on_launch {
        close_browsers();
    }

    let mut results = Vec::new();
    for (index, target) in mode.targets.iter().enumerate() {
        let result = execute_target(index, target);
        results.push(result);
    }

    ModeExecutionResult {
        mode_id: mode.id.clone(),
        results,
    }
}

fn close_browsers() {
    #[cfg(target_os = "windows")]
    {
        for process in &["chrome.exe", "msedge.exe", "firefox.exe", "opera.exe", "brave.exe"] {
            let _ = Command::new("taskkill").args(["/F", "/IM", process]).output();
        }
    }
    #[cfg(target_os = "macos")]
    {
        for app in &["Google Chrome", "Microsoft Edge", "Firefox", "Opera", "Brave Browser", "Safari"] {
            let _ = Command::new("pkill").args(["-x", app]).output();
        }
    }
}

fn execute_target(index: usize, target: &Target) -> ExecutionResult {
    let outcome = match target {
        Target::Url { value, .. } => open_url(value),
        Target::Directory { path, .. } => {
            let resolved = if CURRENT_OS == "macos" {
                path.macos.as_deref()
            } else {
                path.windows.as_deref()
            };
            match resolved {
                Some(p) if !p.is_empty() => open_directory(p),
                _ => Err(format!("No path configured for OS: {}", CURRENT_OS)),
            }
        }
        Target::Application { path, args, command, .. } => {
            // Try command first, then path
            let cmd_str = if CURRENT_OS == "macos" {
                command.as_ref().and_then(|c| c.macos.as_deref())
            } else {
                command.as_ref().and_then(|c| c.windows.as_deref())
            };

            if let Some(cmd) = cmd_str {
                run_command(cmd)
            } else {
                let app_path = if CURRENT_OS == "macos" {
                    path.macos.as_deref()
                } else {
                    path.windows.as_deref()
                };
                match app_path {
                    Some(p) if !p.is_empty() => {
                        let arg_list: Vec<&str> = args
                            .as_ref()
                            .map(|a| a.iter().map(|s| s.as_str()).collect())
                            .unwrap_or_default();
                        launch_application(p, &arg_list)
                    }
                    _ => Err(format!("No path configured for OS: {}", CURRENT_OS)),
                }
            }
        }
    };

    match outcome {
        Ok(()) => ExecutionResult {
            target_index: index,
            target: target.clone(),
            success: true,
            error: None,
        },
        Err(e) => ExecutionResult {
            target_index: index,
            target: target.clone(),
            success: false,
            error: Some(e),
        },
    }
}

fn open_url(url: &str) -> Result<(), String> {
    if url.is_empty() {
        return Err("Empty URL".to_string());
    }
    open::that(url).map_err(|e| format!("Failed to open URL: {}", e))
}

fn open_directory(path: &str) -> Result<(), String> {
    let expanded = expand_path(path);
    let p = std::path::Path::new(&expanded);
    if !p.exists() {
        return Err(format!("Directory not found: {}", expanded));
    }
    open::that(&expanded).map_err(|e| format!("Failed to open directory: {}", e))
}

fn launch_application(path: &str, args: &[&str]) -> Result<(), String> {
    let expanded = expand_path(path);

    #[cfg(target_os = "macos")]
    {
        // On macOS, use `open` command for .app bundles
        if expanded.ends_with(".app") {
            let mut cmd = Command::new("open");
            cmd.arg(&expanded);
            if !args.is_empty() {
                cmd.arg("--args");
                cmd.args(args);
            }
            cmd.spawn().map_err(|e| format!("Failed to launch {}: {}", expanded, e))?;
            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    {
        Command::new(&expanded)
            .args(args)
            .spawn()
            .map_err(|e| format!("Failed to launch {}: {}", expanded, e))?;
        return Ok(());
    }

    // Fallback: try direct spawn
    Command::new(&expanded)
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to launch {}: {}", expanded, e))?;

    Ok(())
}

fn run_command(cmd: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", cmd])
            .spawn()
            .map_err(|e| format!("Failed to run command: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("sh")
            .args(["-c", cmd])
            .spawn()
            .map_err(|e| format!("Failed to run command: {}", e))?;
    }

    Ok(())
}

fn expand_path(path: &str) -> String {
    if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            return path.replacen('~', &home.to_string_lossy(), 1);
        }
    }

    // Windows environment variable expansion
    #[cfg(target_os = "windows")]
    {
        let mut result = path.to_string();
        // Simple %VAR% expansion
        while let Some(start) = result.find('%') {
            if let Some(end) = result[start + 1..].find('%') {
                let var_name = &result[start + 1..start + 1 + end];
                if let Ok(val) = std::env::var(var_name) {
                    result = result.replacen(&format!("%{}%", var_name), &val, 1);
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        return result;
    }

    path.to_string()
}
