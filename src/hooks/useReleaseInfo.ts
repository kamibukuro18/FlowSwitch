import { useCallback, useEffect, useState } from "react";
import { APP_METADATA } from "../config/appMetadata";
import {
  compareVersions,
  fetchLatestGithubRelease,
  getRuntimeAppInfo,
  GithubReleaseSummary,
} from "../lib/appInfo";

export type ReleaseInfoState = {
  appName: string;
  currentVersion: string;
  latestRelease: GithubReleaseSummary | null;
  hasUpdate: boolean;
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: ReleaseInfoState = {
  appName: APP_METADATA.appName,
  currentVersion: APP_METADATA.appVersion,
  latestRelease: null,
  hasUpdate: false,
  isLoading: true,
  error: null,
};

export function useReleaseInfo() {
  const [state, setState] = useState<ReleaseInfoState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      const runtime = await getRuntimeAppInfo();
      const latestRelease = await fetchLatestGithubRelease(
        APP_METADATA.githubReleasesApiUrl,
        `${APP_METADATA.githubRepoUrl}/releases`
      );

      setState({
        appName: runtime.appName,
        currentVersion: runtime.appVersion,
        latestRelease,
        hasUpdate: compareVersions(latestRelease.version, runtime.appVersion) > 0,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const runtime = await getRuntimeAppInfo().catch(() => ({
        appName: APP_METADATA.appName,
        appVersion: APP_METADATA.appVersion,
      }));

      setState({
        appName: runtime.appName,
        currentVersion: runtime.appVersion,
        latestRelease: null,
        hasUpdate: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to load updates.",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}
