import { Mode } from "../types";
import { t, Lang } from "../i18n";
import "./ModeCard.css";

type Props = {
  mode: Mode;
  lang: Lang;
  isExecuting: boolean;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
};

export function ModeCard({
  mode,
  lang,
  isExecuting,
  onExecute,
  onEdit,
  onDelete,
  onToggleHidden,
}: Props) {
  const isHidden = mode.hidden ?? false;

  return (
    <div className={`mode-card ${isHidden ? "hidden-mode" : ""}`} onDoubleClick={onEdit}>
      <span className="card-title">{mode.name || "Untitled Mode"}</span>
      {isHidden ? <span className="hidden-badge">{t(lang, "hidden_badge")}</span> : null}

      {mode.closeOthersOnLaunch && (
        <span className="close-others-badge" title={t(lang, "close_others")}>Browser</span>
      )}
      {mode.closeAppsOnLaunch && (
        <span className="close-others-badge" title={t(lang, "close_apps")}>Apps</span>
      )}
      {mode.closeDirectoriesOnLaunch && (
        <span className="close-others-badge" title={t(lang, "close_dirs")}>Dirs</span>
      )}

      <div className="card-actions">
        <button
          className={`card-action-btn ${isHidden ? "show-mode-btn" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleHidden();
          }}
          title={isHidden ? t(lang, "unhide_mode") : t(lang, "hide_mode")}
          aria-label={isHidden ? t(lang, "unhide_mode") : t(lang, "hide_mode")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {isHidden ? (
              <path
                d="M12 5c5.2 0 8.7 4.3 10 7-1.3 2.7-4.8 7-10 7S3.3 14.7 2 12c1.3-2.7 4.8-7 10-7Zm0 2C8.3 7 5.5 9.7 4.3 12c1.2 2.3 4 5 7.7 5s6.5-2.7 7.7-5C18.5 9.7 15.7 7 12 7Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z"
                fill="currentColor"
              />
            ) : (
              <path
                d="m3.3 2.4 18.3 18.3-1.4 1.4-3.1-3.1A10.7 10.7 0 0 1 12 20C6.8 20 3.3 15.7 2 13c.7-1.5 2.1-3.3 4-4.7L1.9 4 3.3 2.4Zm4.2 7.4A10.1 10.1 0 0 0 4.3 13c1.2 2.3 4 5 7.7 5 1.3 0 2.5-.3 3.6-.9l-2.1-2.1a3 3 0 0 1-4.2-4.2L7.5 9.8ZM12 6c5.2 0 8.7 4.3 10 7-.4.9-1.2 2-2.2 3.1l-1.4-1.4c.6-.6 1-1.2 1.3-1.7-1.2-2.3-4-5-7.7-5-.8 0-1.5.1-2.2.3L8.2 6.7A10.8 10.8 0 0 1 12 6Zm2.8 6.5-3.3-3.3a3 3 0 0 1 3.3 3.3Z"
                fill="currentColor"
              />
            )}
          </svg>
        </button>
        <button
          className="card-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Edit"
          aria-label="Edit mode"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19.14 12.94a7.95 7.95 0 0 0 .05-.94 7.95 7.95 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7.28 7.28 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.95 7.95 0 0 0-.05.94c0 .32.02.63.05.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          className="card-action-btn danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
          aria-label="Delete mode"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9ZM6 7h12l-1 13H7L6 7Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          className={`launch-btn ${isExecuting ? "launching" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onExecute();
          }}
          disabled={isExecuting || mode.targets.length === 0}
        >
          {isExecuting ? <><span className="spinner">...</span> Launching...</> : "Launch"}
        </button>
      </div>
    </div>
  );
}
