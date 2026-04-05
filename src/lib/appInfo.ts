import { getName, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { APP_METADATA } from "../config/appMetadata";

export type RuntimeAppInfo = {
  appName: string;
  appVersion: string;
};

export type GithubReleaseSummary = {
  version: string;
  title: string;
  body: string;
  url: string;
  publishedAt: string | null;
};

type GithubReleaseResponse = {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
};

function stripVersionPrefix(value: string): string {
  return value.trim().replace(/^[^\d]*/, "");
}

function parseVersionParts(value: string): number[] {
  const core = stripVersionPrefix(value).split("-")[0].split("+")[0];
  if (!core) return [];
  return core.split(".").map((part) => {
    const match = part.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 0;
  });
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export function summarizeReleaseBody(body: string, maxLines = 6, maxChars = 420): string {
  const normalized = body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

export async function getRuntimeAppInfo(): Promise<RuntimeAppInfo> {
  const [appName, appVersion] = await Promise.all([
    getName().catch(() => APP_METADATA.appName),
    getVersion().catch(() => APP_METADATA.appVersion),
  ]);

  return { appName, appVersion };
}

export async function fetchLatestGithubRelease(
  apiUrl: string,
  fallbackUrl: string
): Promise<GithubReleaseSummary> {
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases request failed: ${response.status}`);
  }

  const data = (await response.json()) as GithubReleaseResponse;

  return {
    version: data.tag_name?.trim() || data.name?.trim() || "",
    title: data.name?.trim() || data.tag_name?.trim() || "Latest Release",
    body: summarizeReleaseBody(data.body ?? ""),
    url: data.html_url?.trim() || fallbackUrl,
    publishedAt: data.published_at ?? null,
  };
}

export async function openExternalUrl(url: string): Promise<void> {
  if ("__TAURI_INTERNALS__" in window) {
    await openUrl(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
