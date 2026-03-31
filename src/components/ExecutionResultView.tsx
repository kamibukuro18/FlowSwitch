import { useAppStore } from "../store/appStore";
import { ExecutionResult, Target } from "../types";
import { t, Lang } from "../i18n";
import "./ExecutionResultView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

function targetDescription(target: Target): string {
  switch (target.type) {
    case "url":
      return target.value;
    case "directory":
      return target.path.macos ?? target.path.windows ?? "(no path)";
    case "application":
      return target.name;
    case "file":
      return target.path.macos ?? target.path.windows ?? "(no path)";
    case "console":
      return (
        target.command?.macos ??
        target.command?.windows ??
        target.workingDir?.macos ??
        target.workingDir?.windows ??
        "(console)"
      );
  }
}

export function ExecutionResultView({ store }: Props) {
  const { state, navigateTo } = store;
  const lang = (state.settings.language ?? "en") as Lang;
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
          {t(lang, "back")}
        </button>
        <div className="execution-title">
          <h2>
            {mode?.icon ?? "FlowSwitch"} {mode?.name ?? result.modeId} {t(lang, "launched")}
          </h2>
          <div className="execution-summary">
            <span className="summary-success">{t(lang, "succeeded", successCount)}</span>
            {failCount > 0 && (
              <span className="summary-fail">{t(lang, "skipped", failCount)}</span>
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
          {t(lang, "done")}
        </button>
      </div>
    </div>
  );
}

function ResultItem({ result }: { result: ExecutionResult }) {
  const target = result.target;

  function icon() {
    if (!result.success) return "X";
    switch (target.type) {
      case "url":
        return "W";
      case "directory":
        return "D";
      case "application":
        return "A";
      case "file":
        return "F";
      case "console":
        return ">";
    }
  }

  function label() {
    switch (target.type) {
      case "url":
        return target.label ?? target.value;
      case "directory":
        return target.label ?? targetDescription(target);
      case "application":
        return target.name;
      case "file":
        return target.label ?? targetDescription(target);
      case "console":
        return target.name ?? targetDescription(target);
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
