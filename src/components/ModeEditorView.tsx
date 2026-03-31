import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../store/appStore";
import {
  Mode,
  Target,
  UrlTarget,
  DirectoryTarget,
  ApplicationTarget,
  FileTarget,
  ConsoleTarget,
} from "../types";
import { selectFile, selectDirectory, getBrowserBookmarks, checkPathType, BookmarkItem } from "../hooks/useTauri";
import { t, Lang } from "../i18n";
import "./ModeEditorView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

function getPreferredPath(target: DirectoryTarget | ApplicationTarget | FileTarget) {
  return target.path.windows || target.path.macos || "";
}

function getPathBasename(path: string) {
  const normalized = path.trim().replace(/[\\/]+$/, "");
  if (!normalized) return "";
  return normalized.split(/[/\\]/).pop() ?? normalized;
}

function getUrlHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getFaviconUrl(url: string) {
  const host = getUrlHost(url);
  return host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : "";
}

function getTargetSummaryText(target: Target): string {
  switch (target.type) {
    case "url": {
      const label = target.label?.trim();
      const host = getUrlHost(target.value);
      return label ? `${label}${host ? ` - ${host}` : ""}` : host || target.value;
    }
    case "directory":
      return target.label?.trim() || getPathBasename(getPreferredPath(target)) || "(directory)";
    case "application":
      return target.name.trim() || getPathBasename(getPreferredPath(target)) || "(application)";
    case "file":
      return target.label?.trim() || getPathBasename(getPreferredPath(target)) || "(file)";
    case "console":
      return (
        target.name?.trim() ||
        target.command?.windows?.trim() ||
        target.command?.macos?.trim() ||
        "(console)"
      );
  }
}

function getTargetIconLabel(target: Target): string {
  switch (target.type) {
    case "url":
      return "U";
    case "directory":
      return "D";
    case "application":
      return "A";
    case "file":
      return "F";
    case "console":
      return "C";
  }
}

function extractDroppedUrls(dataTransfer: DataTransfer): string[] {
  const values = [
    dataTransfer.getData("text/uri-list"),
    dataTransfer.getData("text/plain"),
    dataTransfer.getData("URL"),
    dataTransfer.getData("text/x-moz-url"),
  ];

  return Array.from(
    new Set(
      values
        .flatMap((value) => value.split(/\r?\n/))
        .map((value) => value.trim())
        .filter((value) => value && !value.startsWith("#"))
        .filter((value) => /^https?:\/\//i.test(value))
    )
  );
}

function TargetRowIcon({ target }: { target: Target }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const faviconUrl = target.type === "url" ? getFaviconUrl(target.value) : "";

  return (
    <span className={`target-summary-icon target-summary-icon-${target.type}`}>
      {faviconUrl && !faviconFailed ? (
        <img
          className="target-summary-favicon"
          src={faviconUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <span className="target-summary-fallback">{getTargetIconLabel(target)}</span>
      )}
    </span>
  );
}

export function ModeEditorView({ store }: Props) {
  const { state, saveMode, navigateTo } = store;
  const lang = (state.settings.language ?? "en") as Lang;
  const initialMode = state.editingMode!;

  const [mode, setMode] = useState<Mode>({ ...initialMode });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Active add tab
  type AddTab = "paste" | "bookmarks" | "app" | "dir" | "file" | "console";
  const [activeTab, setActiveTab] = useState<AddTab | null>(null);
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(null);
  const [editingTargetIndex, setEditingTargetIndex] = useState<number | null>(null);
  const [draggingTargetIndex, setDraggingTargetIndex] = useState<number | null>(null);
  const [dragInsertIndex, setDragInsertIndex] = useState<number | null>(null);

  // Paste URLs
  const [pasteText, setPasteText] = useState("");

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  // New App / Dir / File / Console forms
  const [newApp, setNewApp] = useState<ApplicationTarget>({ type: "application", name: "", path: { macos: "", windows: "" }, args: [] });
  const [newDir, setNewDir] = useState<DirectoryTarget>({ type: "directory", path: { macos: "", windows: "" }, label: "" });
  const [newFile, setNewFile] = useState<FileTarget>({ type: "file", path: { macos: "", windows: "" }, label: "", args: [] });
  const [newConsole, setNewConsole] = useState<ConsoleTarget>({
    type: "console",
    name: "",
    command: { macos: "", windows: "" },
    workingDir: { macos: "", windows: "" },
  });

  // Drag & drop
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);
  const internalDragActiveRef = useRef(false);
  const targetListRef = useRef<HTMLDivElement | null>(null);
  const targetRowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const targetButtonRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pendingPointerDragRef = useRef<{
    index: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const lastDropSignatureRef = useRef<{ signature: string; at: number }>({
    signature: "",
    at: 0,
  });

  function update(patch: Partial<Mode>) {
    setMode((m) => ({ ...m, ...patch }));
  }

  function selectTarget(index: number | null) {
    setSelectedTargetIndex(index);
    setActiveTab(null);
    setShowAddChooser(false);
  }

  function startAdding(tab: AddTab) {
    setActiveTab(tab);
    setShowAddChooser(false);
    setSelectedTargetIndex(null);
    setEditingTargetIndex(null);
  }

  function openTargetEditor(index: number) {
    setSelectedTargetIndex(index);
    setEditingTargetIndex(index);
    setActiveTab(null);
    setShowAddChooser(false);
  }

  function closeTargetEditor() {
    setEditingTargetIndex(null);
  }

  function closeAddPanel() {
    if (activeTab === "paste") {
      setPasteText("");
    }
    if (activeTab === "bookmarks") {
      setBookmarkSearch("");
    }
    setActiveTab(null);
  }

  function handleEscapeClose() {
    if (editingTargetIndex !== null) {
      closeTargetEditor();
      return;
    }
    if (activeTab !== null) {
      closeAddPanel();
      return;
    }
    if (showAddChooser) {
      setShowAddChooser(false);
    }
  }

  function addTargetsAndSelect(targets: Target[]) {
    if (targets.length === 0) return;
    const nextIndex = mode.targets.length;
    setMode((m) => ({ ...m, targets: [...m.targets, ...targets] }));
    setSelectedTargetIndex(nextIndex);
    setActiveTab(null);
    setShowAddChooser(false);
  }

  function isRecentDrop(signature: string) {
    const now = Date.now();
    if (
      lastDropSignatureRef.current.signature === signature &&
      now - lastDropSignatureRef.current.at < 120
    ) {
      return true;
    }
    lastDropSignatureRef.current = { signature, at: now };
    return false;
  }

  function isInternalTargetDrag(dataTransfer: DataTransfer | null) {
    return !!dataTransfer?.types?.includes("application/x-flowswitch-target-index");
  }

  function getPointerDropIndex(clientY: number) {
    for (let index = 0; index < mode.targets.length; index += 1) {
      const row = targetRowRefs.current[index];
      if (!row) continue;
      const rect = row.getBoundingClientRect();
      if (clientY <= rect.top + rect.height / 2) {
        return index;
      }
    }
    return Math.max(0, mode.targets.length - 1);
  }

  function handleTargetPointerDown(event: React.PointerEvent, index: number) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".target-summary-edit-btn")) return;
    pendingPointerDragRef.current = {
      index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
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

  useEffect(() => {
    if (mode.targets.length === 0) {
      setSelectedTargetIndex(null);
      setEditingTargetIndex(null);
      return;
    }
    if (selectedTargetIndex === null) return;
    if (selectedTargetIndex >= mode.targets.length) {
      setSelectedTargetIndex(mode.targets.length - 1);
    }
  }, [mode.targets.length, selectedTargetIndex]);

  useEffect(() => {
    if (editingTargetIndex === null) return;
    if (editingTargetIndex >= mode.targets.length) {
      setEditingTargetIndex(null);
    }
  }, [editingTargetIndex, mode.targets.length]);

  useEffect(() => {
    if (selectedTargetIndex === null) return;

    const list = targetListRef.current;
    const row = targetRowRefs.current[selectedTargetIndex];
    const button = targetButtonRefs.current[selectedTargetIndex];
    if (!list || !row || !button) return;

    let innerFrame = 0;
    const frame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        button.focus();

        const margin = 12;
        const rowTop = row.offsetTop - margin;
        const rowBottom = row.offsetTop + row.offsetHeight + margin;
        const visibleTop = list.scrollTop;
        const visibleBottom = list.scrollTop + list.clientHeight;

        if (rowTop < visibleTop) {
          list.scrollTo({ top: Math.max(0, rowTop), behavior: "smooth" });
          return;
        }

        if (rowBottom > visibleBottom) {
          list.scrollTo({
            top: Math.max(0, rowBottom - list.clientHeight),
            behavior: "smooth",
          });
        }
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(innerFrame);
    };
  }, [selectedTargetIndex, mode.targets.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (editingTargetIndex === null && activeTab === null && !showAddChooser) return;
      event.preventDefault();
      handleEscapeClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, editingTargetIndex, showAddChooser]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const pending = pendingPointerDragRef.current;
      if (!pending || event.pointerId !== pending.pointerId) return;

      if (draggingTargetIndex === null) {
        const moved =
          Math.abs(event.clientX - pending.startX) > 6 ||
          Math.abs(event.clientY - pending.startY) > 6;
        if (!moved) return;
        setDraggingTargetIndex(pending.index);
        setDragInsertIndex(pending.index);
        setSelectedTargetIndex(pending.index);
      }

      event.preventDefault();
      setDragInsertIndex(getPointerDropIndex(event.clientY));
    }

    function handlePointerEnd(event: PointerEvent) {
      const pending = pendingPointerDragRef.current;
      if (!pending || event.pointerId !== pending.pointerId) return;

      const from = pending.index;
      const to = dragInsertIndex;
      pendingPointerDragRef.current = null;

      if (draggingTargetIndex !== null && to !== null && to !== from) {
        moveTarget(from, to);
        suppressClickRef.current = true;
      }

      setDraggingTargetIndex(null);
      setDragInsertIndex(null);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [dragInsertIndex, draggingTargetIndex, mode.targets.length]);

  // 笏笏 Targets 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  function addUrlTargets(urls: string[]) {
    const newTargets: Target[] = urls
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"))
      .map((url) => ({ type: "url" as const, value: url, label: "" }));
    addTargetsAndSelect(newTargets);
  }

  function updateTarget(index: number, patch: Partial<Target>) {
    update({ targets: mode.targets.map((t, i) => i === index ? { ...t, ...patch } as Target : t) });
  }

  function removeTarget(index: number) {
    update({ targets: mode.targets.filter((_, i) => i !== index) });
    setSelectedTargetIndex((prev) => {
      if (prev === null) return null;
      if (mode.targets.length === 1) return null;
      if (prev > index) return prev - 1;
      if (prev === index) return Math.max(0, index - 1);
      return prev;
    });
    setEditingTargetIndex((prev) => {
      if (prev === null) return null;
      if (mode.targets.length === 1) return null;
      if (prev > index) return prev - 1;
      if (prev === index) return null;
      return prev;
    });
  }

  function moveTarget(from: number, to: number) {
    const targets = [...mode.targets];
    const [item] = targets.splice(from, 1);
    targets.splice(to, 0, item);
    update({ targets });
    setSelectedTargetIndex((prev) => {
      if (prev === null) return null;
      if (prev === from) return to;
      if (from < prev && prev <= to) return prev - 1;
      if (to <= prev && prev < from) return prev + 1;
      return prev;
    });
    setEditingTargetIndex((prev) => {
      if (prev === null) return null;
      if (prev === from) return to;
      if (from < prev && prev <= to) return prev - 1;
      if (to <= prev && prev < from) return prev + 1;
      return prev;
    });
  }

  // 笏笏 Paste URLs 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  function handlePasteAdd() {
    addUrlTargets(pasteText.split(/[\n\r,]+/));
    setPasteText("");
    setActiveTab(null);
  }

  // 笏笏 Bookmarks 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  async function handleTabBookmarks() {
    setActiveTab("bookmarks");
    setShowAddChooser(false);
    setSelectedTargetIndex(null);
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
    const newTargets: Target[] = bookmarks
      .filter((bookmark) => selectedUrls.has(bookmark.url))
      .map((bookmark) => ({
        type: "url" as const,
        value: bookmark.url,
        label: bookmark.name.trim(),
      }));
    addTargetsAndSelect(newTargets);
    setSelectedUrls(new Set());
    closeAddPanel();
  }

  const filteredBookmarks = bookmarks.filter((b) => {
    const q = bookmarkSearch.toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.folder.toLowerCase().includes(q);
  });

  // 笏笏 App / Dir forms 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  async function browseForApp(os: "macos" | "windows") {
    try {
      const file = await selectFile();
      if (file) setNewApp((a) => ({ ...a, path: { ...a.path, [os]: file } }));
    } catch { /* cancelled */ }
  }

  async function browseForFile(os: "macos" | "windows") {
    try {
      const file = await selectFile();
      if (file) setNewFile((f) => ({ ...f, path: { ...f.path, [os]: file } }));
    } catch { /* cancelled */ }
  }

  async function browseForDir(os: "macos" | "windows") {
    try {
      const dir = await selectDirectory();
      if (dir) setNewDir((d) => ({ ...d, path: { ...d.path, [os]: dir } }));
    } catch { /* cancelled */ }
  }

  async function browseForConsoleDir(os: "macos" | "windows") {
    try {
      const dir = await selectDirectory();
      if (dir) {
        setNewConsole((c) => ({
          ...c,
          workingDir: { ...(c.workingDir ?? {}), [os]: dir },
        }));
      }
    } catch { /* cancelled */ }
  }

  function handleAddApp() {
    addTargetsAndSelect([{ ...newApp }]);
    setNewApp({ type: "application", name: "", path: { macos: "", windows: "" }, args: [] });
  }

  function handleAddDir() {
    addTargetsAndSelect([{ ...newDir }]);
    setNewDir({ type: "directory", path: { macos: "", windows: "" }, label: "" });
  }

  function handleAddFile() {
    addTargetsAndSelect([{ ...newFile }]);
    setNewFile({ type: "file", path: { macos: "", windows: "" }, label: "", args: [] });
  }

  function handleAddConsole() {
    addTargetsAndSelect([{ ...newConsole }]);
    setNewConsole({
      type: "console",
      name: "",
      command: { macos: "", windows: "" },
      workingDir: { macos: "", windows: "" },
    });
  }

  // 笏笏 Drag & drop (via custom Rust IDropTarget 竊・Tauri events) 笏笏笏笏笏笏笏笏笏笏笏笏笏

  useEffect(() => {
    let active = true;
    let unlistens: Array<() => void> = [];

    const reg = async () => {
      const u1 = await listen<void>("app-drag-enter", () => {
        if (!active || internalDragActiveRef.current) return;
        setIsDragOver(true);
      });
      const u2 = await listen<void>("app-drag-leave", () => {
        if (!active || internalDragActiveRef.current) return;
        dragDepthRef.current = 0;
        setIsDragOver(false);
      });
      const u3 = await listen<{ paths: string[]; url: string | null }>("app-drop", async (ev) => {
        if (!active || internalDragActiveRef.current) return;
        dragDepthRef.current = 0;
        setIsDragOver(false);
        const { paths, url } = ev.payload;

        if (url) {
          const signature = `url:${url}`;
          if (!isRecentDrop(signature)) {
            addUrlTargets([url]);
          }
          return;
        }

        if (paths.length > 0) {
          const signature = `paths:${paths.join("|")}`;
          if (isRecentDrop(signature)) {
            return;
          }
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
            return {
              type: "file",
              label: name,
              path: isWin ? { macos: "", windows: p } : { macos: p, windows: "" },
              args: [],
            };
          }));
          const newTargets = results.filter((t): t is Target => t !== null);
          addTargetsAndSelect(newTargets);
        }
      });
      if (active) unlistens = [u1, u2, u3];
      else { u1(); u2(); u3(); }
    };
    reg();

    return () => { active = false; unlistens.forEach((fn) => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragEnter(e: React.DragEvent) {
    if (internalDragActiveRef.current || isInternalTargetDrag(e.dataTransfer)) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      return;
    }
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (internalDragActiveRef.current || isInternalTargetDrag(e.dataTransfer)) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      return;
    }
    e.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (internalDragActiveRef.current || isInternalTargetDrag(e.dataTransfer)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (
      dragDepthRef.current === 0 &&
      (e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight)
    ) {
      setIsDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (internalDragActiveRef.current || isInternalTargetDrag(e.dataTransfer)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);

    const urls = extractDroppedUrls(e.dataTransfer);
    if (urls.length === 0) return;

    const signature = `url:${urls.join("|")}`;
    if (!isRecentDrop(signature)) {
      addUrlTargets(urls);
    }
  }

  function renderAddPanel() {
    if (activeTab === "paste") {
      return (
        <div className="target-inline-panel">
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
              <button className="back-btn" onClick={closeAddPanel}>{t(lang, "cancel")}</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "bookmarks") {
      return (
        <div className="target-inline-panel">
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
                      <span className="bookmark-meta">{b.browser}{b.folder ? ` / ${b.folder}` : ""}</span>
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
              <button className="back-btn" onClick={closeAddPanel}>{t(lang, "close")}</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "app") {
      return (
        <div className="target-inline-panel">
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
                <input type="text" value={newApp.path.windows ?? ""} onChange={(e) => setNewApp((a) => ({ ...a, path: { ...a.path, windows: e.target.value } }))} placeholder="C:\\...\\Code.exe" />
                <button className="browse-btn" onClick={() => browseForApp("windows")}>{t(lang, "browse")}</button>
              </div>
            </div>
            <div className="form-group">
              <label>{t(lang, "launch_args")}</label>
              <input type="text" value={(newApp.args ?? []).join(" ")} onChange={(e) => setNewApp((a) => ({ ...a, args: e.target.value ? e.target.value.split(" ") : [] }))} placeholder="--new-window" />
            </div>
            <div className="tab-panel-footer">
              <button className="btn-save" onClick={handleAddApp} disabled={!newApp.name.trim()}>{t(lang, "add")}</button>
              <button className="back-btn" onClick={closeAddPanel}>{t(lang, "cancel")}</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "dir") {
      return (
        <div className="target-inline-panel">
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
                <input type="text" value={newDir.path.windows ?? ""} onChange={(e) => setNewDir((d) => ({ ...d, path: { ...d.path, windows: e.target.value } }))} placeholder="%USERPROFILE%\\Projects\\myapp" />
                <button className="browse-btn" onClick={() => browseForDir("windows")}>{t(lang, "browse")}</button>
              </div>
            </div>
            <div className="tab-panel-footer">
              <button className="btn-save" onClick={handleAddDir} disabled={!newDir.path.macos && !newDir.path.windows}>{t(lang, "add")}</button>
              <button className="back-btn" onClick={closeAddPanel}>{t(lang, "cancel")}</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "file") {
      return (
        <div className="target-inline-panel">
          <div className="tab-panel">
            <div className="form-group">
              <label>{t(lang, "label_optional")}</label>
              <input
                type="text"
                value={newFile.label ?? ""}
                onChange={(e) => setNewFile((f) => ({ ...f, label: e.target.value }))}
                placeholder="Build Script, Notes..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>{t(lang, "macos_path")}</label>
              <div className="path-row">
                <input
                  type="text"
                  value={newFile.path.macos ?? ""}
                  onChange={(e) => setNewFile((f) => ({ ...f, path: { ...f.path, macos: e.target.value } }))}
                  placeholder="~/Scripts/build.sh"
                />
                <button className="browse-btn" onClick={() => browseForFile("macos")}>{t(lang, "browse")}</button>
              </div>
            </div>
            <div className="form-group">
              <label>{t(lang, "windows_path")}</label>
              <div className="path-row">
                <input
                  type="text"
                  value={newFile.path.windows ?? ""}
                  onChange={(e) => setNewFile((f) => ({ ...f, path: { ...f.path, windows: e.target.value } }))}
                  placeholder="C:\\Scripts\\build.bat"
                />
                <button className="browse-btn" onClick={() => browseForFile("windows")}>{t(lang, "browse")}</button>
              </div>
            </div>
            <div className="form-group">
              <label>{t(lang, "file_args_label")}</label>
              <input
                type="text"
                value={(newFile.args ?? []).join(" ")}
                onChange={(e) => setNewFile((f) => ({ ...f, args: e.target.value ? e.target.value.split(" ") : [] }))}
                placeholder="--watch"
              />
            </div>
            <div className="tab-panel-footer">
              <button className="btn-save" onClick={handleAddFile} disabled={!newFile.path.macos && !newFile.path.windows}>{t(lang, "add")}</button>
              <button className="back-btn" onClick={closeAddPanel}>{t(lang, "cancel")}</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "console") {
      return (
        <div className="target-inline-panel">
          <div className="tab-panel">
            <div className="form-group">
              <label>{t(lang, "console_name_label")}</label>
              <input
                type="text"
                value={newConsole.name ?? ""}
                onChange={(e) => setNewConsole((c) => ({ ...c, name: e.target.value }))}
                placeholder="Build Console"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>{t(lang, "macos_command")}</label>
              <input
                type="text"
                value={newConsole.command?.macos ?? ""}
                onChange={(e) => setNewConsole((c) => ({ ...c, command: { ...(c.command ?? {}), macos: e.target.value } }))}
                placeholder="npm run dev"
              />
            </div>
            <div className="form-group">
              <label>{t(lang, "windows_command")}</label>
              <input
                type="text"
                value={newConsole.command?.windows ?? ""}
                onChange={(e) => setNewConsole((c) => ({ ...c, command: { ...(c.command ?? {}), windows: e.target.value } }))}
                placeholder="npm run dev"
              />
            </div>
            <div className="form-group">
              <label>{t(lang, "macos_path")} ({t(lang, "working_dir_optional")})</label>
              <div className="path-row">
                <input
                  type="text"
                  value={newConsole.workingDir?.macos ?? ""}
                  onChange={(e) => setNewConsole((c) => ({ ...c, workingDir: { ...(c.workingDir ?? {}), macos: e.target.value } }))}
                  placeholder="~/Projects/myapp"
                />
                <button className="browse-btn" onClick={() => browseForConsoleDir("macos")}>{t(lang, "browse")}</button>
              </div>
            </div>
            <div className="form-group">
              <label>{t(lang, "windows_path")} ({t(lang, "working_dir_optional")})</label>
              <div className="path-row">
                <input
                  type="text"
                  value={newConsole.workingDir?.windows ?? ""}
                  onChange={(e) => setNewConsole((c) => ({ ...c, workingDir: { ...(c.workingDir ?? {}), windows: e.target.value } }))}
                  placeholder="%USERPROFILE%\\Projects\\myapp"
                />
                <button className="browse-btn" onClick={() => browseForConsoleDir("windows")}>{t(lang, "browse")}</button>
              </div>
            </div>
            <div className="tab-panel-footer">
              <button className="btn-save" onClick={handleAddConsole}>{t(lang, "add")}</button>
              <button className="back-btn" onClick={closeAddPanel}>{t(lang, "cancel")}</button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="editor-view">
      <div className="editor-header">
        <button className="back-btn" onClick={() => navigateTo("modes")}>{t(lang, "back")}</button>
        <h2>{initialMode.name ? t(lang, "edit_mode_title", initialMode.name) : t(lang, "new_mode")}</h2>
        <button className="btn-save" onClick={handleSave}>{t(lang, "save")}</button>
      </div>

      <div className="editor-content">
        {/* Basic Info */}
        <div className="editor-section basic-info-section">
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
          <div className="basic-info-toggles">
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
        </div>

        {/* Targets */}
        <div
          className={`editor-section target-section drop-zone ${isDragOver ? "drag-over" : ""}`}
          onDragEnter={handleDragEnter}
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

          <div className="targets-stack">
            <div className="targets-toolbar">
              <button
                className="add-target-btn"
                onClick={() => {
                  setShowAddChooser((prev) => !prev);
                  setActiveTab(null);
                }}
              >
                + Add Target
              </button>
            </div>

            {showAddChooser && (
              <div className="target-type-chooser">
                {(["paste", "bookmarks", "app", "dir", "file", "console"] as const).map((tab) => (
                  <button
                    key={tab}
                    className="target-type-option"
                    onClick={tab === "bookmarks" ? handleTabBookmarks : () => startAdding(tab)}
                  >
                    {tab === "paste" && t(lang, "tab_paste")}
                    {tab === "bookmarks" && t(lang, "tab_bookmarks")}
                    {tab === "app" && t(lang, "tab_app")}
                    {tab === "dir" && t(lang, "tab_dir")}
                    {tab === "file" && t(lang, "tab_file")}
                    {tab === "console" && t(lang, "tab_console")}
                  </button>
                ))}
              </div>
            )}

            {renderAddPanel()}

            {mode.targets.length === 0 && !activeTab && !isDragOver && (
              <div className="targets-empty">{t(lang, "targets_empty")}</div>
            )}

            <div ref={targetListRef} className="target-summary-list">
              {mode.targets.map((target, index) => (
                <div
                  key={index}
                  ref={(element) => { targetRowRefs.current[index] = element; }}
                  className={[
                    "target-summary-row",
                    selectedTargetIndex === index && !activeTab ? "selected" : "",
                    draggingTargetIndex === index ? "dragging" : "",
                    dragInsertIndex === index && draggingTargetIndex !== null && draggingTargetIndex > index ? "drop-before" : "",
                    dragInsertIndex === index && draggingTargetIndex !== null && draggingTargetIndex < index ? "drop-after" : "",
                  ].filter(Boolean).join(" ")}
                  onPointerDown={(event) => handleTargetPointerDown(event, index)}
                >
                  <div
                    ref={(element) => { targetButtonRefs.current[index] = element; }}
                    className="target-summary-item"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      if (suppressClickRef.current) {
                        event.preventDefault();
                        suppressClickRef.current = false;
                        return;
                      }
                      selectTarget(index);
                    }}
                    onDoubleClick={(event) => {
                      if (suppressClickRef.current) {
                        event.preventDefault();
                        suppressClickRef.current = false;
                        return;
                      }
                      openTargetEditor(index);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectTarget(index);
                      }
                    }}
                  >
                    <TargetRowIcon target={target} />
                    <span className="target-summary-main">{getTargetSummaryText(target)}</span>
                    <span className="target-summary-actions">
                      <span
                        className="target-summary-edit-btn"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTargetEditor(index);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            openTargetEditor(index);
                          }
                        }}
                      >
                        Edit
                      </span>
                      <span
                        className="target-summary-delete-btn"
                        role="button"
                        tabIndex={0}
                        aria-label="Delete target"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTarget(index);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            removeTarget(index);
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9ZM6 7h12l-1 13H7L6 7Z"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {editingTargetIndex !== null && mode.targets[editingTargetIndex] && (
        <div className="target-editor-modal-backdrop" onClick={closeTargetEditor}>
          <div className="target-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="target-editor-modal-header">
              <h3>Edit Target</h3>
              <button className="target-editor-modal-close" onClick={closeTargetEditor}>
                Close
              </button>
            </div>
            <TargetEditor
              key={editingTargetIndex}
              target={mode.targets[editingTargetIndex]}
              index={editingTargetIndex}
              total={mode.targets.length}
              lang={lang}
              onChange={(patch) => updateTarget(editingTargetIndex, patch)}
              onRemove={() => removeTarget(editingTargetIndex)}
            />
          </div>
        </div>
      )}
      {isDragOver && (
        <div className="editor-drop-overlay">
          <div className="editor-drop-card">
            <div className="editor-drop-title">Drop To Add</div>
            <div className="editor-drop-text">Drop anywhere in this screen to add files, apps, folders, or URLs.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// 笏笏 Sub-components 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

type TargetEditorProps = {
  target: Target;
  index: number;
  total: number;
  lang: Lang;
  onChange: (patch: Partial<Target>) => void;
  onRemove: () => void;
};

function TargetEditor({ target, lang, onChange, onRemove }: TargetEditorProps) {
  const typeLabel = {
    url: t(lang, "type_url"),
    directory: t(lang, "type_dir"),
    application: t(lang, "type_app"),
    file: t(lang, "type_file"),
    console: t(lang, "type_console"),
  };
  return (
    <div className={`target-editor target-type-${target.type}`}>
      <div className="target-editor-header">
        <span className="target-type-badge">{typeLabel[target.type]}</span>
        <div className="target-actions">
          <button className="target-action-btn remove" onClick={onRemove}>Delete</button>
        </div>
      </div>
      {target.type === "url" && <UrlTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<UrlTarget>) => void} />}
      {target.type === "directory" && <DirectoryTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<DirectoryTarget>) => void} />}
      {target.type === "application" && <AppTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<ApplicationTarget>) => void} />}
      {target.type === "file" && <FileTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<FileTarget>) => void} />}
      {target.type === "console" && <ConsoleTargetEditor target={target} lang={lang} onChange={onChange as (p: Partial<ConsoleTarget>) => void} />}
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

function FileTargetEditor({ target, lang, onChange }: { target: FileTarget; lang: Lang; onChange: (p: Partial<FileTarget>) => void }) {
  async function browse(os: "macos" | "windows") {
    try {
      const file = await selectFile();
      if (file) onChange({ path: { ...target.path, [os]: file } });
    } catch { /* cancelled */ }
  }
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>{t(lang, "label_optional")}</label>
        <input type="text" value={target.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Build Script, Notes..." />
      </div>
      <div className="form-group">
        <label>{t(lang, "macos_path")}</label>
        <div className="path-row">
          <input type="text" value={target.path.macos ?? ""} onChange={(e) => onChange({ path: { ...target.path, macos: e.target.value } })} placeholder="~/Scripts/build.sh" />
          <button className="browse-btn" onClick={() => browse("macos")}>{t(lang, "browse")}</button>
        </div>
      </div>
      <div className="form-group">
        <label>{t(lang, "windows_path")}</label>
        <div className="path-row">
          <input type="text" value={target.path.windows ?? ""} onChange={(e) => onChange({ path: { ...target.path, windows: e.target.value } })} placeholder="C:\\Scripts\\build.bat" />
          <button className="browse-btn" onClick={() => browse("windows")}>{t(lang, "browse")}</button>
        </div>
      </div>
      <div className="form-group">
        <label>{t(lang, "file_args_label")}</label>
        <input type="text" value={(target.args ?? []).join(" ")} onChange={(e) => onChange({ args: e.target.value ? e.target.value.split(" ") : [] })} placeholder="--watch" />
      </div>
    </div>
  );
}

function ConsoleTargetEditor({ target, lang, onChange }: { target: ConsoleTarget; lang: Lang; onChange: (p: Partial<ConsoleTarget>) => void }) {
  async function browse(os: "macos" | "windows") {
    try {
      const dir = await selectDirectory();
      if (dir) onChange({ workingDir: { ...(target.workingDir ?? {}), [os]: dir } });
    } catch { /* cancelled */ }
  }
  return (
    <div className="target-fields">
      <div className="form-group">
        <label>{t(lang, "console_name_label")}</label>
        <input type="text" value={target.name ?? ""} onChange={(e) => onChange({ name: e.target.value })} placeholder="Build Console" />
      </div>
      <div className="form-group">
        <label>{t(lang, "macos_command")}</label>
        <input type="text" value={target.command?.macos ?? ""} onChange={(e) => onChange({ command: { ...(target.command ?? {}), macos: e.target.value } })} placeholder="npm run dev" />
      </div>
      <div className="form-group">
        <label>{t(lang, "windows_command")}</label>
        <input type="text" value={target.command?.windows ?? ""} onChange={(e) => onChange({ command: { ...(target.command ?? {}), windows: e.target.value } })} placeholder="npm run dev" />
      </div>
      <div className="form-group">
        <label>{t(lang, "macos_path")} ({t(lang, "working_dir_optional")})</label>
        <div className="path-row">
          <input type="text" value={target.workingDir?.macos ?? ""} onChange={(e) => onChange({ workingDir: { ...(target.workingDir ?? {}), macos: e.target.value } })} placeholder="~/Projects/myapp" />
          <button className="browse-btn" onClick={() => browse("macos")}>{t(lang, "browse")}</button>
        </div>
      </div>
      <div className="form-group">
        <label>{t(lang, "windows_path")} ({t(lang, "working_dir_optional")})</label>
        <div className="path-row">
          <input type="text" value={target.workingDir?.windows ?? ""} onChange={(e) => onChange({ workingDir: { ...(target.workingDir ?? {}), windows: e.target.value } })} placeholder="%USERPROFILE%\\Projects\\myapp" />
          <button className="browse-btn" onClick={() => browse("windows")}>{t(lang, "browse")}</button>
        </div>
      </div>
    </div>
  );
}
