import { useState } from "react";
import { Mode, Target } from "../types";
import "./ModeCard.css";

type Props = {
  mode: Mode;
  isExecuting: boolean;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function targetIcon(target: Target): string {
  switch (target.type) {
    case "url":
      return "🔗";
    case "directory":
      return "📁";
    case "application":
      return "🖥";
  }
}

function targetLabel(target: Target): string {
  switch (target.type) {
    case "url":
      return (target as { type: "url"; value: string; label?: string }).label ?? target.value;
    case "directory":
      return (target as { type: "directory"; path: object; label?: string }).label ?? "Directory";
    case "application":
      return target.name;
  }
}

export function ModeCard({ mode, isExecuting, onExecute, onEdit, onDelete }: Props) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const urlCount = mode.targets.filter((t) => t.type === "url").length;
  const appCount = mode.targets.filter((t) => t.type === "application").length;
  const dirCount = mode.targets.filter((t) => t.type === "directory").length;

  const accentColor = mode.color ?? "#6366f1";

  return (
    <div className="mode-card" style={{ "--accent": accentColor } as React.CSSProperties}>
      <div className="card-accent-bar" style={{ background: accentColor }} />

      <div className="card-header">
        <div className="card-icon">{mode.icon ?? "⚡"}</div>
        <div className="card-title-area">
          <h3 className="card-title">{mode.name || "Untitled Mode"}</h3>
          {mode.description && (
            <p className="card-description">{mode.description}</p>
          )}
        </div>
        <div className="card-menu">
          <button className="card-menu-btn" onClick={onEdit} title="Edit">✎</button>
          {showConfirmDelete ? (
            <div className="delete-confirm">
              <button className="btn-danger-sm" onClick={() => { onDelete(); setShowConfirmDelete(false); }}>
                Delete
              </button>
              <button className="btn-cancel-sm" onClick={() => setShowConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="card-menu-btn danger" onClick={() => setShowConfirmDelete(true)} title="Delete">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="card-stats">
        {urlCount > 0 && (
          <span className="stat-chip">
            <span>🔗</span> {urlCount} URL{urlCount !== 1 ? "s" : ""}
          </span>
        )}
        {appCount > 0 && (
          <span className="stat-chip">
            <span>🖥</span> {appCount} App{appCount !== 1 ? "s" : ""}
          </span>
        )}
        {dirCount > 0 && (
          <span className="stat-chip">
            <span>📁</span> {dirCount} Dir{dirCount !== 1 ? "s" : ""}
          </span>
        )}
        {mode.targets.length === 0 && (
          <span className="stat-chip empty">No targets</span>
        )}
      </div>

      {mode.targets.length > 0 && (
        <div className="card-targets">
          {mode.targets.slice(0, 3).map((t, i) => (
            <div key={i} className="target-preview">
              <span className="target-preview-icon">{targetIcon(t)}</span>
              <span className="target-preview-label">{targetLabel(t)}</span>
            </div>
          ))}
          {mode.targets.length > 3 && (
            <div className="target-preview more">
              +{mode.targets.length - 3} more
            </div>
          )}
        </div>
      )}

      <div className="card-footer">
        {mode.shortcut && (
          <span className="shortcut-badge">{mode.shortcut}</span>
        )}
        <button
          className={`launch-btn ${isExecuting ? "launching" : ""}`}
          onClick={onExecute}
          disabled={isExecuting || mode.targets.length === 0}
          style={{ background: accentColor }}
        >
          {isExecuting ? (
            <>
              <span className="spinner">◌</span> Launching...
            </>
          ) : (
            <>▶ Launch</>
          )}
        </button>
      </div>
    </div>
  );
}
