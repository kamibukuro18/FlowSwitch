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
    setError,
    setLoading,
    setSearchQuery,
  } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [executingId, setExecutingId] = useState<string | null>(null);

  const modes = state.config?.modes ?? [];

  const filtered = modes.filter((mode) => {
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

  return (
    <div className="mode-list-view">
      <div className="view-header">
        <div className="header-left">
          <h1>{t(lang, "nav_modes")}</h1>
          <span className="mode-count">{modes.length}</span>
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
              <p>{t(lang, "no_modes")}</p>
              <button className="btn-primary" onClick={handleCreateMode}>
                {t(lang, "create_mode")}
              </button>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
