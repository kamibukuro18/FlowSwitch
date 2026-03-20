import { useAppStore } from "../store/appStore";
import { ExecutionResult, Target } from "../types";
import "./ExecutionResultView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

function targetDescription(target: Target): string {
  switch (target.type) {
    case "url":
      return target.value;
    case "directory": {
      const p = target.path.macos ?? target.path.windows ?? "(no path)";
      return p;
    }
    case "application":
      return target.name;
  }
}

export function ExecutionResultView({ store }: Props) {
  const { state, navigateTo } = store;
  const result = state.lastExecutionResult;

  if (!result) {
    navigateTo("modes");
    return null;
  }

  const mode = state.config?.modes.find((m) => m.id === result.modeId);
  const successCount = result.results.filter((r) => r.success).length;
  const failCount = result.results.filter((r) => !r.success).length;

  return (
    <div className="execution-view">
      <div className="execution-header">
        <button className="back-btn" onClick={() => navigateTo("modes")}>
          ← Back
        </button>
        <div className="execution-title">
          <h2>
            {mode?.icon ?? "⚡"} {mode?.name ?? result.modeId} — Launched
          </h2>
          <div className="execution-summary">
            <span className="summary-success">✓ {successCount} succeeded</span>
            {failCount > 0 && (
              <span className="summary-fail">✕ {failCount} skipped</span>
            )}
          </div>
        </div>
      </div>

      <div className="execution-results">
        {result.results.map((r, i) => (
          <ResultItem key={i} result={r} />
        ))}
      </div>

      <div className="execution-footer">
        <button className="btn-primary" onClick={() => navigateTo("modes")}>
          Done
        </button>
      </div>
    </div>
  );
}

function ResultItem({ result }: { result: ExecutionResult }) {
  const target = result.target;

  function icon() {
    if (!result.success) return "✕";
    switch (target.type) {
      case "url": return "🔗";
      case "directory": return "📁";
      case "application": return "🖥";
    }
  }

  function label() {
    switch (target.type) {
      case "url": return (target as { type: "url"; value: string; label?: string }).label ?? target.value;
      case "directory": return (target as { type: "directory"; path: { macos?: string; windows?: string }; label?: string }).label ?? targetDescription(target);
      case "application": return target.name;
    }
  }

  return (
    <div className={`result-item ${result.success ? "success" : "skipped"}`}>
      <span className="result-status-icon">{icon()}</span>
      <div className="result-content">
        <span className="result-label">{label()}</span>
        <span className="result-detail">{targetDescription(target)}</span>
      </div>
      {!result.success && result.error && (
        <span className="result-error">{result.error}</span>
      )}
    </div>
  );
}
