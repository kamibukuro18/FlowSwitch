import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { executeMode, loadConfig } from "../hooks/useTauri";
import { t, Lang } from "../i18n";
import { ModeCard } from "./ModeCard";
import "./ModeListView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

type SortKey = "name" | "targets" | "default";

export function ModeListView({ store }: Props) {
  const {
    state,
    setConfig,
    setLastExecutionResult,
    navigateTo,
    startEditingMode,
    deleteMode,
    setModeHidden,
    setError,
    setLoading,
    setSearchQuery,
  } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const modes = state.config?.modes ?? [];
  const visibleModes = modes.filter((mode) => !mode.hidden);
  const hiddenModes = modes.filter((mode) => mode.hidden);
  const activeModes = showHidden ? hiddenModes : visibleModes;

  const filtered = activeModes.filter((mode) => {
    if (!state.searchQuery) return true;
    const query = state.searchQuery.toLowerCase();
    return (
      mode.name.toLowerCase().includes(query) ||
      (mode.description ?? "").toLowerCase().includes(query)
    );
  });

  const sorted = [...filtered].sort((left, right) => {
    if (sortKey === "name") return left.name.localeCompare(right.name);
    if (sortKey === "targets") return right.targets.length - left.targets.length;
    return 0;
  });

  async function handleExecute(modeId: string) {
    if (!state.config) return;
    setExecutingId(modeId);
    setLoading(true);
    try {
      const result = await executeMode(modeId, state.config);
      setLastExecutionResult(result);
      navigateTo("execution");
    } catch (error) {
      setError(`Failed to execute mode: ${error}`);
    } finally {
      setExecutingId(null);
      setLoading(false);
    }
  }

  async function handleReload() {
    if (!state.settings.configFilePath) return;
    setLoading(true);
    try {
      const config = await loadConfig(state.settings.configFilePath);
      setConfig(config);
    } catch (error) {
      setError(`Failed to reload config: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateMode() {
    startEditingMode({
      id: crypto.randomUUID(),
      name: "",
      description: "",
      targets: [],
      exitAction: "nothing",
    });
  }

  function handleToggleHidden(modeId: string, hidden: boolean) {
    setModeHidden(modeId, hidden);
    if (state.searchQuery) {
      setSearchQuery("");
    }
  }

  return (
    <div className="mode-list-view">
      <div className="view-header">
        <div className="header-left">
          <h1>{t(lang, "nav_modes")}</h1>
          <span className="mode-count">{visibleModes.length}</span>
          {hiddenModes.length > 0 || showHidden ? (
            <button
              className={`hidden-toggle ${showHidden ? "active" : ""}`}
              onClick={() => setShowHidden((value) => !value)}
              title={showHidden ? t(lang, "show_visible_modes") : t(lang, "show_hidden_modes")}
            >
              {showHidden ? t(lang, "visible_modes") : t(lang, "hidden_modes")}{" "}
              <span>{showHidden ? visibleModes.length : hiddenModes.length}</span>
            </button>
          ) : null}
        </div>
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder={t(lang, "search_placeholder")}
              value={state.searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="sort-select"
          >
            <option value="default">{t(lang, "sort_default")}</option>
            <option value="name">{t(lang, "sort_name")}</option>
            <option value="targets">{t(lang, "sort_targets")}</option>
          </select>
          <button className="btn-icon btn-text" onClick={handleReload} title={t(lang, "reload_config")}>
            Reload
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          {state.searchQuery ? (
            <>
              <p>{t(lang, "no_match", state.searchQuery)}</p>
              <button className="btn-secondary" onClick={() => setSearchQuery("")}>
                {t(lang, "clear_search")}
              </button>
            </>
          ) : (
            <>
              <p>
                {showHidden
                  ? t(lang, "no_hidden_modes")
                  : hiddenModes.length > 0
                    ? t(lang, "all_modes_hidden")
                    : t(lang, "no_modes")}
              </p>
              {showHidden ? (
                <button className="btn-secondary" onClick={() => setShowHidden(false)}>
                  {t(lang, "show_visible_modes")}
                </button>
              ) : hiddenModes.length > 0 ? (
                <button className="btn-secondary" onClick={() => setShowHidden(true)}>
                  {t(lang, "show_hidden_modes")}
                </button>
              ) : !showHidden ? (
                <button className="btn-primary" onClick={handleCreateMode}>
                  {t(lang, "create_mode")}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mode-grid">
          {sorted.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              lang={lang}
              isExecuting={executingId === mode.id}
              onExecute={() => handleExecute(mode.id)}
              onEdit={() => startEditingMode(mode)}
              onDelete={() => deleteMode(mode.id)}
              onToggleHidden={() => handleToggleHidden(mode.id, !mode.hidden)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
