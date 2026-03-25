import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../store/appStore";
import { Mode, Target, UrlTarget, DirectoryTarget, ApplicationTarget } from "../types";
import { selectFile, selectDirectory, getBrowserBookmarks, checkPathType, BookmarkItem } from "../hooks/useTauri";
import { t, Lang } from "../i18n";
import "./ModeEditorView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

export function ModeEditorView({ store }: Props) {
  const { state, saveMode, navigateTo } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const initialMode = state.editingMode!;

  const [mode, setMode] = useState<Mode>({ ...initialMode });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Active add tab
  type AddTab = "paste" | "bookmarks" | "app" | "dir";
  const [activeTab, setActiveTab] = useState<AddTab | null>(null);

  // Paste URLs
  const [pasteText, setPasteText] = useState("");

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  // New App / Dir forms
  const [newApp, setNewApp] = useState<ApplicationTarget>({ type: "application", name: "", path: { macos: "", windows: "" }, args: [] });
  const [newDir, setNewDir] = useState<DirectoryTarget>({ type: "directory", path: { macos: "", windows: "" }, label: "" });

  // Drag & drop
  const [isDragOver, setIsDragOver] = useState(false);

  function toggleTab(tab: AddTab) {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  function update(patch: Partial<Mode>) {
    setMode((m) => ({ ...m, ...patch }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!mode.name.trim()) newErrors.name = "Mode name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    saveMode(mode);
  }

  // ── Targets ──────────────────────────────────────────

  function addUrlTargets(urls: string[]) {
    const newTargets: Target[] = urls
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"))
      .map((url) => ({ type: "url" as const, value: url, label: "" }));
    if (newTargets.length > 0)
      setMode((m) => ({ ...m, targets: [...m.targets, ...newTargets] }));
  }

  function updateTarget(index: number, patch: Partial<Target>) {
    update({ targets: mode.targets.map((t, i) => i === index ? { ...t, ...patch } as Target : t) });
  }

  function removeTarget(index: number) {
    update({ targets: mode.targets.filter((_, i) => i !== index) });
  }

  function moveTarget(from: number, to: number) {
    const targets = [...mode.targets];
    const [item] = targets.splice(from, 1);
    targets.splice(to, 0, item);
    update({ targets });
  }

  // ── Paste URLs ────────────────────────────────────────

  function handlePasteAdd() {
    addUrlTargets(pasteText.split(/[\n\r,]+/));
    setPasteText("");
    setActiveTab(null);
  }

  // ── Bookmarks ────────────────────────────────────────

  async function handleTabBookmarks() {
    toggleTab("bookmarks");
    if (bookmarks.length > 0) return;
    setBookmarksLoading(true);
    try {
      const items = await getBrowserBookmarks();
      setBookmarks(items);
    } finally {
      setBookmarksLoading(false);
    }
  }

  function toggleBookmark(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  function handleAddBookmarks() {
    addUrlTargets(Array.from(selectedUrls));
    setSelectedUrls(new Set());
    setActiveTab(null);
  }

  const filteredBookmarks = bookmarks.filter((b) => {
    const q = bookmarkSearch.toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.folder.toLowerCase().includes(q);
  });

  // ── App / Dir forms ───────────────────────────────────

  async function browseForApp(os: "macos" | "windows") {
    try {
      const file = await selectFile();
      if (file) setNewApp((a) => ({ ...a, path: { ...a.path, [os]: file } }));
    } catch { /* cancelled */ }
  }

  async function browseForDir(os: "macos" | "windows") {
    try {
      const dir = await selectDirectory();
      if (dir) setNewDir((d) => ({ ...d, path: { ...d.path, [os]: dir } }));
    } catch { /* cancelled */ }
  }

  function handleAddApp() {
    update({ targets: [...mode.targets, { ...newApp }] });
    setNewApp({ type: "application", name: "", path: { macos: "", windows: "" }, args: [] });
    setActiveTab(null);
  }

  function handleAddDir() {
    update({ targets: [...mode.targets, { ...newDir }] });
    setNewDir({ type: "directory", path: { macos: "", windows: "" }, label: "" });
    setActiveTab(null);
  }

  // ── Drag & drop (via custom Rust IDropTarget → Tauri events) ─────────────

  useEffect(() => {
    let active = true;
    let unlistens: Array<() => void> = [];

    const reg = async () => {
      const u1 = await listen<void>("app-drag-enter", () => { if (active) setIsDragOver(true); });
      const u2 = await listen<void>("app-drag-leave", () => { if (active) setIsDragOver(false); });
      const u3 = await listen<{ paths: string[]; url: string | null }>("app-drop", async (ev) => {
        if (!active) return;
        setIsDragOver(false);
        const { paths, url } = ev.payload;

        if (url) { addUrlTargets([url]); return; }

        if (paths.length > 0) {
          const results = await Promise.all(paths.map(async (p): Promise<Target | null> => {
            const kind = await checkPathType(p).catch(() => "file" as const);
            const name = p.split(/[/\\]/).pop() ?? p;
            const isWin = /^[A-Za-z]:/.test(p);
            if (kind === "app") return {
              type: "application",
              name: name.replace(/\.(exe|app|msi|dmg|pkg|bat|cmd|sh)$/i, ""),
              path: isWin ? { macos: "", windows: p } : { macos: p, windows: "" },
              args: [],
            };
            if (kind === "dir") return {
              type: "directory",
              label: name,
              path: isWin ? { macos: "", windows: p } : { macos: p, windows: "" },
            };
            return null;
          }));
          const newTargets = results.filter((t): t is Target => t !== null);
          if (newTargets.length > 0) setMode((m) => ({ ...m, targets: [...m.targets, ...newTargets] }));
        }
      });
      if (active) unlistens = [u1, u2, u3];
      else { u1(); u2(); u3(); }
    };
    reg();

    return () => { active = false; unlistens.forEach((fn) => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DragOver/Leave still needed so the browser shows the correct drop cursor
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDragLeave() { /* handled via Rust event */ }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); } // prevent browser default

  return (
    <div className="editor-view">
      <div className="editor-header">
        <button className="back-btn" onClick={() => navigateTo("modes")}>{t(lang, "back")}</button>
        <h2>{initialMode.name ? t(lang, "edit_mode_title", initialMode.name) : t(lang, "new_mode")}</h2>
        <button className="btn-save" onClick={handleSave}>{t(lang, "save")}</button>
      </div>

      <div className="editor-content">
        {/* Basic Info */}
        <div className="editor-section">
          <h3 className="section-title">{t(lang, "basic_info")}</h3>
          <div className="form-group">
            <label>{t(lang, "mode_name_label")}</label>
            <input
              type="text"
              value={mode.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder={t(lang, "mode_name_ph")}
              className={errors.name ? "error" : ""}
            />
            {errors.name && <span className="field-error">{t(lang, "mode_name_required")}</span>}
          </div>
          <div className="toggle-row">
            <label className="toggle-label">{t(lang, "close_others")}</label>
            <button
              className={`toggle-btn ${mode.closeOthersOnLaunch ? "on" : "off"}`}
              onClick={() => update({ closeOthersOnLaunch: !mode.closeOthersOnLaunch })}
            >
              {mode.closeOthersOnLaunch ? "ON" : "OFF"}
            </button>
          </div>
          <div className="toggle-row">
            <label className="toggle-label">{t(lang, "close_apps")}</label>
            <button
              className={`toggle-btn ${mode.closeAppsOnLaunch ? "on" : "off"}`}
              onClick={() => update({ closeAppsOnLaunch: !mode.closeAppsOnLaunch })}
            >
              {mode.closeAppsOnLaunch ? "ON" : "OFF"}
            </button>
          </div>
          <div className="toggle-row">
            <label className="toggle-label">{t(lang, "close_dirs")}</label>
            <button
              className={`toggle-btn ${mode.closeDirectoriesOnLaunch ? "on" : "off"}`}
              onClick={() => update({ closeDirectoriesOnLaunch: !mode.closeDirectoriesOnLaunch })}
            >
              {mode.closeDirectoriesOnLaunch ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Targets */}
        <div
          className={`editor-section drop-zone ${isDragOver ? "drag-over" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="section-header">
            <h3 className="section-title">{t(lang, "targets_header", mode.targets.length)}</h3>
            {mode.targets.length > 0 && (
              <button className="add-target-btn danger" onClick={() => update({ targets: [] })}>{t(lang, "delete_all")}</button>
            )}
          </div>

          {/* Tab bar */}
          <div className="add-target-tabs">
            {(["paste", "bookmarks", "app", "dir"] as const).map((tab) => (
              <button
                key={tab}
                className={`add-tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={tab === "bookmarks" ? handleTabBookmarks : () => toggleTab(tab)}
              >
                {tab === "paste" && t(lang, "tab_paste")}
                {tab === "bookmarks" && t(lang, "tab_bookmarks")}
                {tab === "app" && t(lang, "tab_app")}
                {tab === "dir" && t(lang, "tab_dir")}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          {activeTab === "paste" && (
            <div className="tab-panel">
              <textarea
                className="paste-textarea"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t(lang, "paste_ph")}
                autoFocus
              />
              <div className="tab-panel-footer">
                <button className="btn-save" onClick={handlePasteAdd} disabled={!pasteText.trim()}>{t(lang, "add")}</button>
                <button className="back-btn" onClick={() => { setActiveTab(null); setPasteText(""); }}>{t(lang, "cancel")}</button>
              </div>
            </div>
          )}

          {activeTab === "bookmarks" && (
            <div className="tab-panel tab-panel-bookmarks">
              <div className="bookmark-panel-header">
                <input
                  className="bookmark-search"
                  type="text"
                  placeholder={t(lang, "bookmark_search_ph")}
                  value={bookmarkSearch}
                  onChange={(e) => setBookmarkSearch(e.target.value)}
                  autoFocus
                />
                <span className="bookmark-count">
                  {selectedUrls.size > 0
                    ? t(lang, "selected_count", selectedUrls.size)
                    : t(lang, "count_items", filteredBookmarks.length)}
                </span>
              </div>
              {bookmarksLoading ? (
                <div className="bookmark-loading">{t(lang, "loading")}</div>
              ) : filteredBookmarks.length === 0 ? (
                <div className="bookmark-loading">
                  {bookmarks.length === 0 ? t(lang, "no_bookmarks") : t(lang, "no_matching_bookmarks")}
                </div>
              ) : (
                <div className="bookmark-list">
                  {filteredBookmarks.map((b, i) => (
                    <label key={i} className="bookmark-item">
                      <input type="checkbox" checked={selectedUrls.has(b.url)} onChange={() => toggleBookmark(b.url)} />
                      <div className="bookmark-info">
                        <span className="bookmark-name">{b.name || b.url}</span>
                        <span className="bookmark-meta">{b.browser}{b.folder ? ` · ${b.folder}` : ""}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="tab-panel-footer">
                <button className="btn-save" onClick={handleAddBookmarks} disabled={selectedUrls.size === 0}>
                  {selectedUrls.size > 0 ? t(lang, "add_selected", selectedUrls.size) : t(lang, "add")}
                </button>
                <button className="back-btn" onClick={() => {
                  const allSelected = filteredBookmarks.every((b) => selectedUrls.has(b.url));
                  setSelectedUrls(allSelected ? new Set() : new Set(filteredBookmarks.map((b) => b.url)));
                }}>
                  {filteredBookmarks.every((b) => selectedUrls.has(b.url)) ? t(lang, "deselect_all") : t(lang, "select_all")}
                </button>
                <button className="back-btn" onClick={() => { setActiveTab(null); setBookmarkSearch(""); }}>{t(lang, "close")}</button>
              </div>
            </div>
          )}

          {activeTab === "app" && (
            <div className="tab-panel">
              <div className="form-group">
                <label>{t(lang, "app_name_label")}</label>
                <input type="text" value={newApp.name} onChange={(e) => setNewApp((a) => ({ ...a, name: e.target.value }))} placeholder="VSCode, Spotify..." autoFocus />
              </div>
              <div className="form-group">
                <label>{t(lang, "macos_path_app")}</label>
                <div className="path-row">
                  <input type="text" value={newApp.path.macos ?? ""} onChange={(e) => setNewApp((a) => ({ ...a, path: { ...a.path, macos: e.target.value } }))} placeholder="/Applications/Visual Studio Code.app" />
                  <button className="browse-btn" onClick={() => browseForApp("macos")}>{t(lang, "browse")}</button>
                </div>
              </div>
              <div className="form-group">
                <label>{t(lang, "windows_path_exe")}</label>
                <div className="path-row">
                  <input type="text" value={newApp.path.windows ?? ""} onChange={(e) => setNewApp((a) => ({ ...a, path: { ...a.path, windows: e.target.value } }))} placeholder="C:\...\Code.exe" />
                  <button className="browse-btn" onClick={() => browseForApp("windows")}>{t(lang, "browse")}</button>
                </div>
              </div>
              <div className="form-group">
                <label>{t(lang, "launch_args")}</label>
                <input type="text" value={(newApp.args ?? []).join(" ")} onChange={(e) => setNewApp((a) => ({ ...a, args: e.target.value ? e.target.value.split(" ") : [] }))} placeholder="--new-window" />
              </div>
              <div className="tab-panel-footer">
                <button className="btn-save" onClick={handleAddApp} disabled={!newApp.name.trim()}>{t(lang, "add")}</button>
                <button className="back-btn" onClick={() => setActiveTab(null)}>{t(lang, "cancel")}</button>
              </div>
            </div>
          )}

          {activeTab === "dir" && (
            <div className="tab-panel">
              <div className="form-group">
                <label>{t(lang, "label_optional")}</label>
                <input type="text" value={newDir.label ?? ""} onChange={(e) => setNewDir((d) => ({ ...d, label: e.target.value }))} placeholder="My Projects..." autoFocus />
              </div>
              <div className="form-group">
                <label>{t(lang, "macos_path")}</label>
                <div className="path-row">
                  <input type="text" value={newDir.path.macos ?? ""} onChange={(e) => setNewDir((d) => ({ ...d, path: { ...d.path, macos: e.target.value } }))} placeholder="~/Projects/myapp" />
                  <button className="browse-btn" onClick={() => browseForDir("macos")}>{t(lang, "browse")}</button>
                </div>
              </div>
              <div className="form-group">
                <label>{t(lang, "windows_path")}</label>
                <div className="path-row">
                  <input type="text" value={newDir.path.windows ?? ""} onChange={(e) => setNewDir((d) => ({ ...d, path: { ...d.path, windows: e.target.value } }))} placeholder="%USERPROFILE%\Projects\myapp" />
                  <button className="browse-btn" onClick={() => browseForDir("windows")}>{t(lang, "browse")}</button>
                </div>
              </div>
              <div className="tab-panel-footer">
                <button className="btn-save" onClick={handleAddDir} disabled={!newDir.path.macos && !newDir.path.windows}>{t(lang, "add")}</button>
                <button className="back-btn" onClick={() => setActiveTab(null)}>{t(lang, "cancel")}</button>
              </div>
            </div>
          )}

          {isDragOver && <div className="drop-hint">{t(lang, "drop_hint")}</div>}

          {mode.targets.length === 0 && !activeTab && !isDragOver && (
            <div className="targets-empty">{t(lang, "targets_empty")}</div>
          )}

          <div className="targets-list">
            {mode.targets.map((target, index) => (
              <TargetEditor
                key={index}
                target={target}
                index={index}
                total={mode.targets.length}
                lang={lang}
                onChange={(patch) => updateTarget(index, patch)}
                onRemove={() => removeTarget(index)}
                onMoveUp={index > 0 ? () => moveTarget(index, index - 1) : undefined}
                onMoveDown={index < mode.targets.length - 1 ? () => moveTarget(index, index + 1) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────

type TargetEditorProps = {
  target: Target;
  index: number;
  total: number;
  lang: Lang;
  onChange: (patch: Partial<Target>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

function TargetEditor({ target, lang, onChange, onRemove, onMoveUp, onMoveDown }: TargetEditorProps) {
  const typeLabel = {
    url: t(lang, "type_url"),
    directory: t(lang, "type_dir"),
    application: t(lang, "type_app"),
  };
  return (
    <div className={`target-editor target-type-${target.type}`}>
      <div className="target-editor-header">
        <span className="target-type-badge">{typeLabel[target.type]}</span>
        <div className="target-actions">
          {onMoveUp && <button className="target-action-btn" onClick={onMoveUp}>↑</button>}
          {onMoveDown && <button className="target-action-btn" onClick={onMoveDown}>↓</button>}
          <button className="target-action-btn remove" onClick={onRemove}>✕</button>
        </div>
      </div>
      {target.type === "url" && <UrlTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<UrlTarget>) => void} />}
      {target.type === "directory" && <DirectoryTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<DirectoryTarget>) => void} />}
      {target.type === "application" && <AppTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<ApplicationTarget>) => void} />}
    </div>
  );
}

function UrlTargetEditor({ target, lang, onChange }: { target: UrlTarget; lang: Lang; onChange: (p: Partial<UrlTarget>) => void }) {
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>{t(lang, "label_optional")}</label>
        <input type="text" value={target.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="GitHub, Notion..." />
      </div>
      <div className="form-group">
        <label>{t(lang, "url_label")}</label>
        <input type="url" value={target.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="https://..." />
      </div>
    </div>
  );
}

function DirectoryTargetEditor({ target, lang, onChange }: { target: DirectoryTarget; lang: Lang; onChange: (p: Partial<DirectoryTarget>) => void }) {
  async function browse(os: "macos" | "windows") {
    try {
      const dir = await selectDirectory();
      if (dir) onChange({ path: { ...target.path, [os]: dir } });
    } catch { /* cancelled */ }
  }
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>{t(lang, "label_optional")}</label>
        <input type="text" value={target.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="My Projects..." />
      </div>
      <div className="form-group">
        <label>{t(lang, "macos_path")}</label>
        <div className="path-row">
          <input type="text" value={target.path.macos ?? ""} onChange={(e) => onChange({ path: { ...target.path, macos: e.target.value } })} placeholder="~/Projects/myapp" />
          <button className="browse-btn" onClick={() => browse("macos")}>{t(lang, "browse")}</button>
        </div>
      </div>
      <div className="form-group">
        <label>{t(lang, "windows_path")}</label>
        <div className="path-row">
          <input type="text" value={target.path.windows ?? ""} onChange={(e) => onChange({ path: { ...target.path, windows: e.target.value } })} placeholder="%USERPROFILE%\Projects\myapp" />
          <button className="browse-btn" onClick={() => browse("windows")}>{t(lang, "browse")}</button>
        </div>
      </div>
    </div>
  );
}

function AppTargetEditor({ target, lang, onChange }: { target: ApplicationTarget; lang: Lang; onChange: (p: Partial<ApplicationTarget>) => void }) {
  async function browse(os: "macos" | "windows") {
    try {
      const file = await selectFile();
      if (file) onChange({ path: { ...target.path, [os]: file } });
    } catch { /* cancelled */ }
  }
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>{t(lang, "app_name_label")}</label>
        <input type="text" value={target.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="VSCode, Spotify..." />
      </div>
      <div className="form-group">
        <label>{t(lang, "macos_path_app")}</label>
        <div className="path-row">
          <input type="text" value={target.path.macos ?? ""} onChange={(e) => onChange({ path: { ...target.path, macos: e.target.value } })} placeholder="/Applications/Visual Studio Code.app" />
          <button className="browse-btn" onClick={() => browse("macos")}>{t(lang, "browse")}</button>
        </div>
      </div>
      <div className="form-group">
        <label>{t(lang, "windows_path_exe")}</label>
        <div className="path-row">
          <input type="text" value={target.path.windows ?? ""} onChange={(e) => onChange({ path: { ...target.path, windows: e.target.value } })} placeholder="C:\...\Code.exe" />
          <button className="browse-btn" onClick={() => browse("windows")}>{t(lang, "browse")}</button>
        </div>
      </div>
      <div className="form-group">
        <label>{t(lang, "launch_args")}</label>
        <input type="text" value={(target.args ?? []).join(" ")} onChange={(e) => onChange({ args: e.target.value ? e.target.value.split(" ") : [] })} placeholder="--new-window --verbose" />
      </div>
    </div>
  );
}
