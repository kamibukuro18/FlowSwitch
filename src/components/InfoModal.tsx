import { useEffect } from "react";
import { APP_METADATA } from "../config/appMetadata";
import { openExternalUrl } from "../lib/appInfo";
import { ReleaseInfoState } from "../hooks/useReleaseInfo";
import "./InfoModal.css";

type Props = {
  isOpen: boolean;
  releaseInfo: ReleaseInfoState;
  onRefresh: () => Promise<void>;
  onClose: () => void;
};

export function InfoModal({ isOpen, releaseInfo, onRefresh, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const linkItems = [
    { label: "Profile", url: APP_METADATA.profileUrl },
    { label: "More Tools", url: APP_METADATA.moreToolsUrl },
    { label: "Support", url: APP_METADATA.supportUrl },
    { label: "GitHub", url: APP_METADATA.githubRepoUrl },
  ];

  const release = releaseInfo.latestRelease;

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <div>
            <div className="info-modal-eyebrow">Info</div>
            <h2>{releaseInfo.appName}</h2>
          </div>
          <button className="info-modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="info-section">
          <div className="info-section-title">About</div>
          <div className="info-about-card">
            <div className="info-app-line">
              <span className="info-app-name">{releaseInfo.appName}</span>
              <span className="info-version-pill">
                Version {releaseInfo.currentVersion}
              </span>
            </div>
            <div className="info-author-name">{APP_METADATA.authorName}</div>
            <p className="info-author-description">{APP_METADATA.authorDescription}</p>
          </div>
        </div>

        <div className="info-section">
          <div className="info-section-title">Links</div>
          <div className="info-link-grid">
            {linkItems.map((item) => (
              <button
                key={item.label}
                className="info-link-button"
                onClick={() => void openExternalUrl(item.url)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="info-section">
          <div className="info-section-header">
            <div className="info-section-title">Updates</div>
            {releaseInfo.hasUpdate ? (
              <span className="info-update-badge">Update Available</span>
            ) : null}
          </div>

          <div className="info-update-card">
            <div className="info-update-meta">
              <div>
                <div className="info-meta-label">Current Version</div>
                <div className="info-meta-value">{releaseInfo.currentVersion}</div>
              </div>
              <div>
                <div className="info-meta-label">Latest Version</div>
                <div className="info-meta-value">
                  {release?.version || "Not Available"}
                </div>
              </div>
            </div>

            <div className="info-update-status">
              {releaseInfo.isLoading && "Checking GitHub Releases..."}
              {!releaseInfo.isLoading && releaseInfo.error && "Unable to load release info right now."}
              {!releaseInfo.isLoading && !releaseInfo.error && releaseInfo.hasUpdate && "Update Available"}
              {!releaseInfo.isLoading && !releaseInfo.error && !releaseInfo.hasUpdate && release && "You are on the latest version."}
            </div>

            {release ? (
              <>
                <div className="info-release-title">{release.title}</div>
                <pre className="info-release-body">
                  {release.body || "No release notes provided."}
                </pre>
                <div className="info-update-actions">
                  <button
                    className="info-primary-button"
                    onClick={() => void openExternalUrl(release.url)}
                  >
                    Open Release
                  </button>
                  <button className="info-secondary-button" onClick={() => void onRefresh()}>
                    Check Again
                  </button>
                </div>
              </>
            ) : (
              <div className="info-update-actions">
                <button className="info-secondary-button" onClick={() => void onRefresh()}>
                  Check Again
                </button>
              </div>
            )}

            <div className="info-source-note">Release info is loaded from GitHub Releases.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
