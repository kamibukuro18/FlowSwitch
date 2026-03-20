import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { ModeCard } from "./ModeCard";
import { executeMode, loadConfig } from "../hooks/useTauri";
import "./ModeListView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

type SortKey = "name" | "targets" | "default";

export function ModeListView({ store }: Props) {
  const { state, setConfig, setLastExecutionResult, navigateTo, startEditingMode, deleteMode, setError, setLoading, setSearchQuery } = store;
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [executingId, setExecutingId] = useState<string | null>(null);

  const modes = state.config?.modes ?? [];

  const filtered = modes.filter((m) => {
    if (!state.searchQuery) return true;
    const q = state.searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.description ?? "").toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "targets") return b.targets.length - a.targets.length;
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
    } catch (err) {
      setError(`Failed to execute mode: ${err}`);
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
    } catch (err) {
      setError(`Failed to reload config: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mode-list-view">
      <div className="view-header">
        <div className="header-left">
          <h1>Modes</h1>
          <span className="mode-count">{modes.length}</span>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search modes..."
              value={state.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="sort-select"
          >
            <option value="default">Default order</option>
            <option value="name">Sort by name</option>
            <option value="targets">Sort by targets</option>
          </select>
          <button className="btn-icon" onClick={handleReload} title="Reload config">
            ↺
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          {state.searchQuery ? (
            <>
              <div className="empty-icon">⌕</div>
              <p>No modes match "{state.searchQuery}"</p>
              <button className="btn-secondary" onClick={() => setSearchQuery("")}>
                Clear search
              </button>
            </>
          ) : (
            <>
              <div className="empty-icon">⊞</div>
              <p>No modes yet. Create your first mode!</p>
              <button
                className="btn-primary"
                onClick={() =>
                  startEditingMode({
                    id: crypto.randomUUID(),
                    name: "",
                    description: "",
                    targets: [],
                    exitAction: "nothing",
                  })
                }
              >
                + Create Mode
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
