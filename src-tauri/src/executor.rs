use crate::config::{ExecutionResult, Mode, ModeExecutionResult, OsCommand, OsPath, Target};
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
    if mode.close_apps_on_launch {
        close_apps();
    }
    if mode.close_directories_on_launch {
        close_directories();
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
        for process in &[
            "chrome.exe",
            "msedge.exe",
            "firefox.exe",
            "opera.exe",
            "brave.exe",
        ] {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", process])
                .output();
        }
    }
    #[cfg(target_os = "macos")]
    {
        for app in &[
            "Google Chrome",
            "Microsoft Edge",
            "Firefox",
            "Opera",
            "Brave Browser",
            "Safari",
        ] {
            let _ = Command::new("pkill").args(["-x", app]).output();
        }
    }
}

fn close_apps() {
    #[cfg(target_os = "windows")]
    {
        // Close all apps with a visible main window, excluding system processes.
        let script = r#"
            $excluded = @('explorer','SearchHost','StartMenuExperienceHost',
                          'ShellExperienceHost','SystemSettings','TextInputHost',
                          'LockApp','dwm','winlogon','csrss','svchost','conhost',
                          'taskhostw','sihost','fontdrvhost','WUDFHost')
            Get-Process | Where-Object {
                $_.MainWindowTitle -ne '' -and
                $_.Name -notin $excluded -and
                $_.Name -notlike '*FlowSwitch*'
            } | ForEach-Object {
                $_.CloseMainWindow() | Out-Null
            }
        "#;
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output();
    }
    #[cfg(target_os = "macos")]
    {
        let script = r#"
            tell application "System Events"
                set appList to name of every process whose visible is true
            end tell
            repeat with appName in appList
                if appName is not "FlowSwitch" and appName is not "Finder" then
                    try
                        tell application appName to quit
                    end try
                end if
            end repeat
        "#;
        let _ = Command::new("osascript").args(["-e", script]).output();
    }
}

fn close_directories() {
    #[cfg(target_os = "windows")]
    {
        // Close Explorer folder windows without killing the shell.
        let script =
            "(New-Object -comobject shell.application).windows() | ForEach-Object { $_.quit() }";
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("osascript")
            .args(["-e", "tell application \"Finder\" to close every window"])
            .output();
    }
}

fn execute_target(index: usize, target: &Target) -> ExecutionResult {
    let outcome = match target {
        Target::Url { value, .. } => open_url(value),
        Target::Directory { path, .. } => resolve_os_path(path).and_then(open_directory),
        Target::Application {
            path,
            args,
            command,
            ..
        } => {
            if let Some(cmd) = resolve_os_command(command.as_ref()) {
                run_command(cmd)
            } else {
                let arg_list = args_as_slices(args);
                resolve_os_path(path).and_then(|app_path| launch_path(app_path, &arg_list))
            }
        }
        Target::File { path, args, .. } => {
            let arg_list = args_as_slices(args);
            resolve_os_path(path).and_then(|file_path| open_file(file_path, &arg_list))
        }
        Target::Console {
            command,
            working_dir,
            ..
        } => {
            let cmd = resolve_os_command(command.as_ref());
            let dir = working_dir
                .as_ref()
                .and_then(|path| resolve_os_path(path).ok())
                .map(expand_path);
            open_console(cmd, dir.as_deref())
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

fn resolve_os_path(path: &OsPath) -> Result<&str, String> {
    let resolved = if CURRENT_OS == "macos" {
        path.macos.as_deref()
    } else {
        path.windows.as_deref()
    };
    match resolved {
        Some(p) if !p.trim().is_empty() => Ok(p),
        _ => Err(format!("No path configured for OS: {}", CURRENT_OS)),
    }
}

fn resolve_os_command(command: Option<&OsCommand>) -> Option<&str> {
    let resolved = if CURRENT_OS == "macos" {
        command.and_then(|c| c.macos.as_deref())
    } else {
        command.and_then(|c| c.windows.as_deref())
    };
    resolved.filter(|cmd| !cmd.trim().is_empty())
}

fn args_as_slices(args: &Option<Vec<String>>) -> Vec<&str> {
    args.as_ref()
        .map(|items| items.iter().map(|item| item.as_str()).collect())
        .unwrap_or_default()
}

fn open_url(url: &str) -> Result<(), String> {
    if url.is_empty() {
        return Err("Empty URL".to_string());
    }
    open::that(url).map_err(|e| format!("Failed to open URL: {}", e))
}

fn open_directory(path: &str) -> Result<(), String> {
    let expanded = expand_path(path);
    let dir = std::path::Path::new(&expanded);
    if !dir.exists() {
        return Err(format!("Directory not found: {}", expanded));
    }
    open::that(&expanded).map_err(|e| format!("Failed to open directory: {}", e))
}

fn open_file(path: &str, args: &[&str]) -> Result<(), String> {
    let expanded = expand_path(path);
    let file = std::path::Path::new(&expanded);
    if !file.exists() {
        return Err(format!("File not found: {}", expanded));
    }

    if !args.is_empty() || is_direct_launch_file(&expanded) {
        launch_path(&expanded, args)
    } else {
        open::that(&expanded).map_err(|e| format!("Failed to open file: {}", e))
    }
}

fn is_direct_launch_file(path: &str) -> bool {
    let extension = std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    #[cfg(target_os = "windows")]
    {
        matches!(extension.as_str(), "exe" | "bat" | "cmd" | "com" | "ps1")
    }

    #[cfg(target_os = "macos")]
    {
        matches!(extension.as_str(), "sh" | "command" | "tool")
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        !extension.is_empty()
    }
}

fn launch_path(path: &str, args: &[&str]) -> Result<(), String> {
    let expanded = expand_path(path);

    #[cfg(target_os = "macos")]
    {
        if expanded.ends_with(".app") {
            let mut cmd = Command::new("open");
            cmd.arg(&expanded);
            if !args.is_empty() {
                cmd.arg("--args");
                cmd.args(args);
            }
            return cmd
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to launch {}: {}", expanded, e));
        }
    }

    Command::new(&expanded)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to launch {}: {}", expanded, e))
}

fn open_console(command: Option<&str>, working_dir: Option<&str>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut parts: Vec<String> = Vec::new();
        if let Some(dir) = working_dir {
            parts.push(format!("cd /d \"{}\"", dir.replace('"', "\"\"")));
        }
        if let Some(cmd) = command {
            parts.push(cmd.to_string());
        }

        if parts.is_empty() {
            return Command::new("cmd")
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to open console: {}", e));
        }

        return Command::new("cmd")
            .args(["/K", &parts.join(" && ")])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to open console: {}", e));
    }

    #[cfg(target_os = "macos")]
    {
        let mut parts: Vec<String> = Vec::new();
        if let Some(dir) = working_dir {
            parts.push(format!("cd {}", shell_quote(dir)));
        }
        if let Some(cmd) = command {
            parts.push(cmd.to_string());
        }

        if parts.is_empty() {
            return Command::new("open")
                .args(["-a", "Terminal"])
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to open console: {}", e));
        }

        let script = parts.join("; ");
        return Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "tell application \"Terminal\" to do script \"{}\"",
                    escape_applescript(&script)
                ),
                "-e",
                "tell application \"Terminal\" to activate",
            ])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to open console: {}", e));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let mut script = String::new();
        if let Some(dir) = working_dir {
            script.push_str(&format!("cd {};", shell_quote(dir)));
        }
        if let Some(cmd) = command {
            script.push_str(cmd);
            script.push(';');
        }
        script.push_str("exec sh");
        Command::new("sh")
            .args(["-c", &script])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to open console: {}", e))
    }
}

fn run_command(cmd: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return Command::new("cmd")
            .args(["/C", cmd])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to run command: {}", e));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("sh")
            .args(["-c", cmd])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to run command: {}", e))
    }
}

#[cfg(not(target_os = "windows"))]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

#[cfg(target_os = "macos")]
fn escape_applescript(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn expand_path(path: &str) -> String {
    let mut result = if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            path.replacen('~', &home.to_string_lossy(), 1)
        } else {
            path.to_string()
        }
    } else {
        path.to_string()
    };

    #[cfg(target_os = "windows")]
    {
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
    }

    result
}
