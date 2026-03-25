import { useState } from "react";
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
};

export function ModeCard({ mode, lang, isExecuting, onExecute, onEdit, onDelete }: Props) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div className="mode-card">
      <span className="card-title">{mode.name || "Untitled Mode"}</span>

      {mode.closeOthersOnLaunch && (
        <span className="close-others-badge" title={t(lang, "close_others")}>✕🌐</span>
      )}
      {mode.closeAppsOnLaunch && (
        <span className="close-others-badge" title={t(lang, "close_apps")}>✕🖥</span>
      )}
      {mode.closeDirectoriesOnLaunch && (
        <span className="close-others-badge" title={t(lang, "close_dirs")}>✕📁</span>
      )}

      <div className="card-actions">
        {showConfirmDelete ? (
          <>
            <button className="btn-danger-sm" onClick={() => { onDelete(); setShowConfirmDelete(false); }}>
              Delete
            </button>
            <button className="btn-cancel-sm" onClick={() => setShowConfirmDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="card-action-btn" onClick={onEdit} title="Edit">✎</button>
            <button className="card-action-btn danger" onClick={() => setShowConfirmDelete(true)} title="Delete">✕</button>
          </>
        )}
        <button
          className={`launch-btn ${isExecuting ? "launching" : ""}`}
          onClick={onExecute}
          disabled={isExecuting || mode.targets.length === 0}
        >
          {isExecuting ? <><span className="spinner">◌</span> Launching...</> : "▶ Launch"}
        </button>
      </div>
    </div>
  );
}
