import { useState, useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore";
import { Mode, Target, UrlTarget, DirectoryTarget, ApplicationTarget } from "../types";
import { selectFile, selectDirectory, getBrowserBookmarks, checkPathType, BookmarkItem } from "../hooks/useTauri";
import "./ModeEditorView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

export function ModeEditorView({ store }: Props) {
  const { state, saveMode, navigateTo } = store;
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
    if (newTargets.length > 0) update({ targets: [...mode.targets, ...newTargets] });
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

  // ── Drag & drop ───────────────────────────────────────

  // File drops from Explorer/Finder: use Tauri's onDragDropEvent (provides real FS paths)
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    getCurrentWebview().onDragDropEvent(async (event) => {
      const p = event.payload;
      if (p.type === "enter" || p.type === "over") {
        setIsDragOver(true);
      } else if (p.type === "leave") {
        setIsDragOver(false);
      } else if (p.type === "drop") {
        setIsDragOver(false);
        if (p.paths && p.paths.length > 0) {
          const urlsToAdd: string[] = [];
          const filePaths: string[] = [];

          // Separate Windows URL shortcuts (.url) from actual files/dirs
          for (const path of p.paths) {
            if (path.toLowerCase().endsWith(".url")) {
              // Chrome URL drag on Windows creates a virtual .url shortcut file
              try {
                const content = await readTextFile(path);
                const match = content.match(/^URL=(.+)$/m);
                if (match?.[1]?.startsWith("http")) urlsToAdd.push(match[1].trim());
              } catch { /* virtual file might not exist on disk */ }
            } else {
              filePaths.push(path);
            }
          }

          if (urlsToAdd.length > 0) addUrlTargets(urlsToAdd);

          if (filePaths.length > 0) {
            const results = await Promise.all(
              filePaths.map(async (path) => {
                const kind = await checkPathType(path).catch(() => "file" as const);
                const name = path.split(/[/\\]/).pop() ?? path;
                const isWin = /^[A-Za-z]:/.test(path);
                if (kind === "app") {
                  return {
                    type: "application" as const,
                    name: name.replace(/\.(exe|app|msi|dmg|pkg|bat|cmd|sh)$/i, ""),
                    path: isWin ? { macos: "", windows: path } : { macos: path, windows: "" },
                    args: [],
                  } satisfies Target;
                } else if (kind === "dir") {
                  return {
                    type: "directory" as const,
                    label: name,
                    path: isWin ? { macos: "", windows: path } : { macos: path, windows: "" },
                  } satisfies Target;
                }
                return null;
              })
            );
            const newTargets = results.filter((t): t is Target => t !== null);
            if (newTargets.length > 0) {
              setMode((m) => ({ ...m, targets: [...m.targets, ...newTargets] }));
            }
          }
        }
      }
    }).then((fn) => {
      if (!active) { fn(); return; }
      unlisten = fn;
    });

    return () => {
      active = false;
      unlisten?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL drops from browser (address bar / link drag): handled via React onDrop
  // dragDropEnabled:true means Tauri intercepts file drops, but browser URL drags
  // still reach React's onDrop with text/uri-list data.
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const uriList = e.dataTransfer.getData("text/uri-list");
    const plain = e.dataTransfer.getData("text/plain");
    const raw = uriList || plain;
    const httpUrls = raw
      .split(/[\n\r]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));
    if (httpUrls.length > 0) {
      addUrlTargets(httpUrls);
    }
  }

  return (
    <div className="editor-view">
      <div className="editor-header">
        <button className="back-btn" onClick={() => navigateTo("modes")}>← Back</button>
        <h2>{initialMode.name ? `Edit: ${initialMode.name}` : "New Mode"}</h2>
        <button className="btn-save" onClick={handleSave}>Save</button>
      </div>

      <div className="editor-content">
        {/* Basic Info */}
        <div className="editor-section">
          <h3 className="section-title">Basic Info</h3>
          <div className="form-group">
            <label>Mode Name *</label>
            <input
              type="text"
              value={mode.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Development, Writing..."
              className={errors.name ? "error" : ""}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="toggle-row">
            <label className="toggle-label">Launch 時に他のブラウザを閉じる</label>
            <button
              className={`toggle-btn ${mode.closeOthersOnLaunch ? "on" : "off"}`}
              onClick={() => update({ closeOthersOnLaunch: !mode.closeOthersOnLaunch })}
            >
              {mode.closeOthersOnLaunch ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Targets */}
        <div
          className={`editor-section drop-zone ${isDragOver ? "drag-over" : ""}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="section-header">
            <h3 className="section-title">Targets ({mode.targets.length})</h3>
            {mode.targets.length > 0 && (
              <button className="add-target-btn danger" onClick={() => update({ targets: [] })}>全て削除</button>
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
                {tab === "paste" && "+ URLをペースト"}
                {tab === "bookmarks" && "+ ブックマーク"}
                {tab === "app" && "+ App"}
                {tab === "dir" && "+ Dir"}
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
                placeholder={"URLを貼り付け（複数可・1行1URL）\nhttps://github.com\nhttps://notion.so"}
                autoFocus
              />
              <div className="tab-panel-footer">
                <button className="btn-save" onClick={handlePasteAdd} disabled={!pasteText.trim()}>追加</button>
                <button className="back-btn" onClick={() => { setActiveTab(null); setPasteText(""); }}>キャンセル</button>
              </div>
            </div>
          )}

          {activeTab === "bookmarks" && (
            <div className="tab-panel tab-panel-bookmarks">
              <div className="bookmark-panel-header">
                <input
                  className="bookmark-search"
                  type="text"
                  placeholder="ブックマークを検索..."
                  value={bookmarkSearch}
                  onChange={(e) => setBookmarkSearch(e.target.value)}
                  autoFocus
                />
                <span className="bookmark-count">
                  {selectedUrls.size > 0 ? `${selectedUrls.size} 件選択` : `${filteredBookmarks.length} 件`}
                </span>
              </div>
              {bookmarksLoading ? (
                <div className="bookmark-loading">読み込み中...</div>
              ) : filteredBookmarks.length === 0 ? (
                <div className="bookmark-loading">
                  {bookmarks.length === 0 ? "Chrome / Edge / Brave のブックマークが見つかりません" : "一致するブックマークがありません"}
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
                  {selectedUrls.size > 0 ? `${selectedUrls.size} 件を追加` : "追加"}
                </button>
                <button className="back-btn" onClick={() => {
                  const allSelected = filteredBookmarks.every((b) => selectedUrls.has(b.url));
                  setSelectedUrls(allSelected ? new Set() : new Set(filteredBookmarks.map((b) => b.url)));
                }}>
                  {filteredBookmarks.every((b) => selectedUrls.has(b.url)) ? "全解除" : "全選択"}
                </button>
                <button className="back-btn" onClick={() => { setActiveTab(null); setBookmarkSearch(""); }}>閉じる</button>
              </div>
            </div>
          )}

          {activeTab === "app" && (
            <div className="tab-panel">
              <div className="form-group">
                <label>Application Name</label>
                <input type="text" value={newApp.name} onChange={(e) => setNewApp((a) => ({ ...a, name: e.target.value }))} placeholder="VSCode, Spotify..." autoFocus />
              </div>
              <div className="form-group">
                <label>macOS Path (.app)</label>
                <div className="path-row">
                  <input type="text" value={newApp.path.macos ?? ""} onChange={(e) => setNewApp((a) => ({ ...a, path: { ...a.path, macos: e.target.value } }))} placeholder="/Applications/Visual Studio Code.app" />
                  <button className="browse-btn" onClick={() => browseForApp("macos")}>Browse</button>
                </div>
              </div>
              <div className="form-group">
                <label>Windows Path (.exe)</label>
                <div className="path-row">
                  <input type="text" value={newApp.path.windows ?? ""} onChange={(e) => setNewApp((a) => ({ ...a, path: { ...a.path, windows: e.target.value } }))} placeholder="C:\...\Code.exe" />
                  <button className="browse-btn" onClick={() => browseForApp("windows")}>Browse</button>
                </div>
              </div>
              <div className="form-group">
                <label>Launch Arguments (optional)</label>
                <input type="text" value={(newApp.args ?? []).join(" ")} onChange={(e) => setNewApp((a) => ({ ...a, args: e.target.value ? e.target.value.split(" ") : [] }))} placeholder="--new-window" />
              </div>
              <div className="tab-panel-footer">
                <button className="btn-save" onClick={handleAddApp} disabled={!newApp.name.trim()}>追加</button>
                <button className="back-btn" onClick={() => setActiveTab(null)}>キャンセル</button>
              </div>
            </div>
          )}

          {activeTab === "dir" && (
            <div className="tab-panel">
              <div className="form-group">
                <label>Label (optional)</label>
                <input type="text" value={newDir.label ?? ""} onChange={(e) => setNewDir((d) => ({ ...d, label: e.target.value }))} placeholder="My Projects..." autoFocus />
              </div>
              <div className="form-group">
                <label>macOS Path</label>
                <div className="path-row">
                  <input type="text" value={newDir.path.macos ?? ""} onChange={(e) => setNewDir((d) => ({ ...d, path: { ...d.path, macos: e.target.value } }))} placeholder="~/Projects/myapp" />
                  <button className="browse-btn" onClick={() => browseForDir("macos")}>Browse</button>
                </div>
              </div>
              <div className="form-group">
                <label>Windows Path</label>
                <div className="path-row">
                  <input type="text" value={newDir.path.windows ?? ""} onChange={(e) => setNewDir((d) => ({ ...d, path: { ...d.path, windows: e.target.value } }))} placeholder="%USERPROFILE%\Projects\myapp" />
                  <button className="browse-btn" onClick={() => browseForDir("windows")}>Browse</button>
                </div>
              </div>
              <div className="tab-panel-footer">
                <button className="btn-save" onClick={handleAddDir} disabled={!newDir.path.macos && !newDir.path.windows}>追加</button>
                <button className="back-btn" onClick={() => setActiveTab(null)}>キャンセル</button>
              </div>
            </div>
          )}

          {isDragOver && <div className="drop-hint">URLをここにドロップ</div>}

          {mode.targets.length === 0 && !activeTab && !isDragOver && (
            <div className="targets-empty">
              URLやアプリ、フォルダをドラッグ&ドロップするか、上のタブで追加してください。
            </div>
          )}

          <div className="targets-list">
            {mode.targets.map((target, index) => (
              <TargetEditor
                key={index}
                target={target}
                index={index}
                total={mode.targets.length}
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
  onChange: (patch: Partial<Target>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

function TargetEditor({ target, onChange, onRemove, onMoveUp, onMoveDown }: TargetEditorProps) {
  const typeLabel = { url: "URL", directory: "Directory", application: "Application" };
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
      {target.type === "url" && <UrlTargetEditor target={target} onChange={onChange as (p: Partial<UrlTarget>) => void} />}
      {target.type === "directory" && <DirectoryTargetEditor target={target} onChange={onChange as (p: Partial<DirectoryTarget>) => void} />}
      {target.type === "application" && <AppTargetEditor target={target} onChange={onChange as (p: Partial<ApplicationTarget>) => void} />}
    </div>
  );
}

function UrlTargetEditor({ target, onChange }: { target: UrlTarget; onChange: (p: Partial<UrlTarget>) => void }) {
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>Label (optional)</label>
        <input type="text" value={target.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="GitHub, Notion..." />
      </div>
      <div className="form-group">
        <label>URL</label>
        <input type="url" value={target.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="https://..." />
      </div>
    </div>
  );
}

function DirectoryTargetEditor({ target, onChange }: { target: DirectoryTarget; onChange: (p: Partial<DirectoryTarget>) => void }) {
  async function browse(os: "macos" | "windows") {
    try {
      const dir = await selectDirectory();
      if (dir) onChange({ path: { ...target.path, [os]: dir } });
    } catch { /* cancelled */ }
  }
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>Label (optional)</label>
        <input type="text" value={target.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="My Projects..." />
      </div>
      <div className="form-group">
        <label>macOS Path</label>
        <div className="path-row">
          <input type="text" value={target.path.macos ?? ""} onChange={(e) => onChange({ path: { ...target.path, macos: e.target.value } })} placeholder="~/Projects/myapp" />
          <button className="browse-btn" onClick={() => browse("macos")}>Browse</button>
        </div>
      </div>
      <div className="form-group">
        <label>Windows Path</label>
        <div className="path-row">
          <input type="text" value={target.path.windows ?? ""} onChange={(e) => onChange({ path: { ...target.path, windows: e.target.value } })} placeholder="%USERPROFILE%\Projects\myapp" />
          <button className="browse-btn" onClick={() => browse("windows")}>Browse</button>
        </div>
      </div>
    </div>
  );
}

function AppTargetEditor({ target, onChange }: { target: ApplicationTarget; onChange: (p: Partial<ApplicationTarget>) => void }) {
  async function browse(os: "macos" | "windows") {
    try {
      const file = await selectFile();
      if (file) onChange({ path: { ...target.path, [os]: file } });
    } catch { /* cancelled */ }
  }
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>Application Name</label>
        <input type="text" value={target.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="VSCode, Spotify..." />
      </div>
      <div className="form-group">
        <label>macOS Path (.app)</label>
        <div className="path-row">
          <input type="text" value={target.path.macos ?? ""} onChange={(e) => onChange({ path: { ...target.path, macos: e.target.value } })} placeholder="/Applications/Visual Studio Code.app" />
          <button className="browse-btn" onClick={() => browse("macos")}>Browse</button>
        </div>
      </div>
      <div className="form-group">
        <label>Windows Path (.exe)</label>
        <div className="path-row">
          <input type="text" value={target.path.windows ?? ""} onChange={(e) => onChange({ path: { ...target.path, windows: e.target.value } })} placeholder="C:\...\Code.exe" />
          <button className="browse-btn" onClick={() => browse("windows")}>Browse</button>
        </div>
      </div>
      <div className="form-group">
        <label>Launch Arguments (optional)</label>
        <input type="text" value={(target.args ?? []).join(" ")} onChange={(e) => onChange({ args: e.target.value ? e.target.value.split(" ") : [] })} placeholder="--new-window --verbose" />
      </div>
    </div>
  );
}
