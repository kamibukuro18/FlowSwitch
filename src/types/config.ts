export type OsPath = {
  macos?: string;
  windows?: string;
};

export type OsCommand = {
  macos?: string;
  windows?: string;
};

export type UrlTarget = {
  type: "url";
  value: string;
  label?: string;
};

export type DirectoryTarget = {
  type: "directory";
  path: OsPath;
  label?: string;
};

export type ApplicationTarget = {
  type: "application";
  name: string;
  path: OsPath;
  args?: string[];
  command?: OsCommand;
};

export type FileTarget = {
  type: "file";
  path: OsPath;
  label?: string;
  args?: string[];
};

export type ConsoleTarget = {
  type: "console";
  name?: string;
  command?: OsCommand;
  workingDir?: OsPath;
};

export type Target =
  | UrlTarget
  | DirectoryTarget
  | ApplicationTarget
  | FileTarget
  | ConsoleTarget;

export type ExitAction = "nothing" | "close" | "minimize";

export type Mode = {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  color?: string;
  icon?: string;
  keepAliveApps?: string[];
  exitAction?: ExitAction;
  closeOthersOnLaunch?: boolean;
  closeAppsOnLaunch?: boolean;
  closeDirectoriesOnLaunch?: boolean;
  targets: Target[];
};

export type Config = {
  version: number;
  configDir?: string;
  modes: Mode[];
};

export type ExecutionResult = {
  targetIndex: number;
  target: Target;
  success: boolean;
  error?: string;
};

export type ModeExecutionResult = {
  modeId: string;
  results: ExecutionResult[];
};

export type AppSettings = {
  configFilePath?: string;
  theme?: "light" | "dark" | "system";
  language?: "en" | "ja";
  keepRunningInTray?: boolean;
  onboardingComplete?: boolean;
};
