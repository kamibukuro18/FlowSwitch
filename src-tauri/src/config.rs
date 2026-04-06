use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsPath {
    pub macos: Option<String>,
    pub windows: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsCommand {
    pub macos: Option<String>,
    pub windows: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Target {
    #[serde(rename = "url")]
    Url {
        value: String,
        label: Option<String>,
    },
    #[serde(rename = "directory")]
    Directory { path: OsPath, label: Option<String> },
    #[serde(rename = "application")]
    Application {
        name: String,
        path: OsPath,
        args: Option<Vec<String>>,
        command: Option<OsCommand>,
    },
    #[serde(rename = "file")]
    File {
        path: OsPath,
        label: Option<String>,
        args: Option<Vec<String>>,
    },
    #[serde(rename = "console")]
    Console {
        name: Option<String>,
        command: Option<OsCommand>,
        working_dir: Option<OsPath>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExitAction {
    Nothing,
    Close,
    Minimize,
}

impl Default for ExitAction {
    fn default() -> Self {
        ExitAction::Nothing
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mode {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub shortcut: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    #[serde(default)]
    pub keep_alive_apps: Vec<String>,
    #[serde(default)]
    pub exit_action: ExitAction,
    #[serde(default)]
    pub close_others_on_launch: bool,
    #[serde(default)]
    pub close_apps_on_launch: bool,
    #[serde(default)]
    pub close_directories_on_launch: bool,
    pub targets: Vec<Target>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub version: u32,
    pub config_dir: Option<String>,
    pub modes: Vec<Mode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub config_file_path: Option<String>,
    pub theme: Option<String>,
    pub language: Option<String>,
    #[serde(default = "default_keep_running_in_tray")]
    pub keep_running_in_tray: bool,
    #[serde(default)]
    pub onboarding_complete: bool,
}

fn default_keep_running_in_tray() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            config_file_path: None,
            theme: Some("dark".to_string()),
            language: Some("en".to_string()),
            keep_running_in_tray: true,
            onboarding_complete: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    #[serde(rename = "targetIndex")]
    pub target_index: usize,
    pub target: Target,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeExecutionResult {
    #[serde(rename = "modeId")]
    pub mode_id: String,
    pub results: Vec<ExecutionResult>,
}
