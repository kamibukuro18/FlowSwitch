export type AppMetadata = {
  appName: string;
  appVersion: string;
  authorName: string;
  authorDescription: string;
  profileUrl: string;
  moreToolsUrl: string;
  supportUrl: string;
  githubRepoUrl: string;
  githubReleasesApiUrl: string;
};

// Replace these values when reusing this Info / Updates layer in another app.
export const APP_METADATA: AppMetadata = {
  appName: "FlowSwitch",
  appVersion: "0.1.0",
  authorName: "kamibukuro18",
  authorDescription:
    "Indie desktop tools focused on small, practical workflow improvements.",
  profileUrl: "https://github.com/kamibukuro18",
  moreToolsUrl: "https://github.com/kamibukuro18?tab=repositories",
  supportUrl: "https://github.com/kamibukuro18/FlowSwitch/issues",
  githubRepoUrl: "https://github.com/kamibukuro18/FlowSwitch",
  githubReleasesApiUrl:
    "https://api.github.com/repos/kamibukuro18/FlowSwitch/releases/latest",
};
