import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { Mode, Target, UrlTarget, DirectoryTarget, ApplicationTarget } from "../types";
import { selectFile, selectDirectory } from "../hooks/useTauri";
import "./ModeEditorView.css";

type Props = {
  store: ReturnType<typeof useAppStore>;
};

const EXIT_ACTIONS = [
  { value: "nothing", label: "Do nothing" },
  { value: "close", label: "Close apps" },
  { value: "minimize", label: "Minimize apps" },
] as const;

const MODE_COLORS = [
  "#6366f1", "#818cf8", "#22d3a4", "#f59e0b",
  "#f43f5e", "#ec4899", "#14b8a6", "#8b5cf6",
];

export function ModeEditorView({ store }: Props) {
  const { state, saveMode, navigateTo } = store;
  const initialMode = state.editingMode!;

  const [mode, setMode] = useState<Mode>({ ...initialMode });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update(patch: Partial<Mode>) {
    setMode((m) => ({ ...m, ...patch }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!mode.name.trim()) {
      newErrors.name = "Mode name is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    saveMode(mode);
  }

  function addTarget(type: Target["type"]) {
    let newTarget: Target;
    switch (type) {
      case "url":
        newTarget = { type: "url", value: "", label: "" };
        break;
      case "directory":
        newTarget = { type: "directory", path: { macos: "", windows: "" }, label: "" };
        break;
      case "application":
        newTarget = { type: "application", name: "", path: { macos: "", windows: "" }, args: [] };
        break;
    }
    update({ targets: [...mode.targets, newTarget] });
  }

  function updateTarget(index: number, patch: Partial<Target>) {
    const targets = mode.targets.map((t, i) =>
      i === index ? { ...t, ...patch } as Target : t
    );
    update({ targets });
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

  return (
    <div className="editor-view">
      <div className="editor-header">
        <button className="back-btn" onClick={() => navigateTo("modes")}>
          ← Back
        </button>
        <h2>{initialMode.name ? `Edit: ${initialMode.name}` : "New Mode"}</h2>
        <button className="btn-save" onClick={handleSave}>
          Save Mode
        </button>
      </div>

      <div className="editor-content">
        <div className="editor-section">
          <h3 className="section-title">Basic Info</h3>

          <div className="form-row">
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
            <div className="form-group icon-group">
              <label>Icon</label>
              <input
                type="text"
                value={mode.icon ?? ""}
                onChange={(e) => update({ icon: e.target.value })}
                placeholder="⚡"
                maxLength={2}
                className="icon-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={mode.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What does this mode do?"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Keyboard Shortcut</label>
              <input
                type="text"
                value={mode.shortcut ?? ""}
                onChange={(e) => update({ shortcut: e.target.value })}
                placeholder="e.g. CmdOrCtrl+Shift+1"
              />
            </div>
            <div className="form-group">
              <label>Exit Action</label>
              <select
                value={mode.exitAction ?? "nothing"}
                onChange={(e) => update({ exitAction: e.target.value as Mode["exitAction"] })}
              >
                {EXIT_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {MODE_COLORS.map((color) => (
                <button
                  key={color}
                  className={`color-swatch ${mode.color === color ? "selected" : ""}`}
                  style={{ background: color }}
                  onClick={() => update({ color })}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="editor-section">
          <div className="section-header">
            <h3 className="section-title">Targets ({mode.targets.length})</h3>
            <div className="add-target-btns">
              <button className="add-target-btn" onClick={() => addTarget("url")}>
                + URL
              </button>
              <button className="add-target-btn" onClick={() => addTarget("application")}>
                + App
              </button>
              <button className="add-target-btn" onClick={() => addTarget("directory")}>
                + Directory
              </button>
            </div>
          </div>

          {mode.targets.length === 0 && (
            <div className="targets-empty">
              No targets yet. Add URLs, apps, or directories to open when this mode launches.
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

        <div className="editor-section">
          <h3 className="section-title">Keep-Alive Apps</h3>
          <p className="section-hint">
            These apps won't be closed when switching away from this mode.
          </p>
          <KeepAliveEditor
            apps={mode.keepAliveApps ?? []}
            onChange={(apps) => update({ keepAliveApps: apps })}
          />
        </div>
      </div>
    </div>
  );
}

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

      {target.type === "url" && (
        <UrlTargetEditor target={target} onChange={onChange as (p: Partial<UrlTarget>) => void} />
      )}
      {target.type === "directory" && (
        <DirectoryTargetEditor target={target} onChange={onChange as (p: Partial<DirectoryTarget>) => void} />
      )}
      {target.type === "application" && (
        <AppTargetEditor target={target} onChange={onChange as (p: Partial<ApplicationTarget>) => void} />
      )}
    </div>
  );
}

function UrlTargetEditor({ target, onChange }: { target: UrlTarget; onChange: (p: Partial<UrlTarget>) => void }) {
  return (
    <div className="target-fields">
      <div className="form-row">
        <div className="form-group">
          <label>Label (optional)</label>
          <input
            type="text"
            value={target.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="GitHub, Notion..."
          />
        </div>
      </div>
      <div className="form-group">
        <label>URL</label>
        <input
          type="url"
          value={target.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}

function DirectoryTargetEditor({ target, onChange }: { target: DirectoryTarget; onChange: (p: Partial<DirectoryTarget>) => void }) {
  async function browse(os: "macos" | "windows") {
    try {
      const dir = await selectDirectory();
      if (dir) {
        onChange({ path: { ...target.path, [os]: dir } });
      }
    } catch { /* dialog cancelled */ }
  }

  return (
    <div className="target-fields">
      <div className="form-group">
        <label>Label (optional)</label>
        <input
          type="text"
          value={target.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="My Projects..."
        />
      </div>
      <div className="form-group">
        <label>macOS Path</label>
        <div className="path-row">
          <input
            type="text"
            value={target.path.macos ?? ""}
            onChange={(e) => onChange({ path: { ...target.path, macos: e.target.value } })}
            placeholder="~/Projects/myapp"
          />
          <button className="browse-btn" onClick={() => browse("macos")}>Browse</button>
        </div>
      </div>
      <div className="form-group">
        <label>Windows Path</label>
        <div className="path-row">
          <input
            type="text"
            value={target.path.windows ?? ""}
            onChange={(e) => onChange({ path: { ...target.path, windows: e.target.value } })}
            placeholder="%USERPROFILE%\Projects\myapp"
          />
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
      if (file) {
        onChange({ path: { ...target.path, [os]: file } });
      }
    } catch { /* cancelled */ }
  }

  return (
    <div className="target-fields">
      <div className="form-group">
        <label>Application Name</label>
        <input
          type="text"
          value={target.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="VSCode, Spotify..."
        />
      </div>
      <div className="form-group">
        <label>macOS Path (.app)</label>
        <div className="path-row">
          <input
            type="text"
            value={target.path.macos ?? ""}
            onChange={(e) => onChange({ path: { ...target.path, macos: e.target.value } })}
            placeholder="/Applications/Visual Studio Code.app"
          />
          <button className="browse-btn" onClick={() => browse("macos")}>Browse</button>
        </div>
      </div>
      <div className="form-group">
        <label>Windows Path (.exe)</label>
        <div className="path-row">
          <input
            type="text"
            value={target.path.windows ?? ""}
            onChange={(e) => onChange({ path: { ...target.path, windows: e.target.value } })}
            placeholder="C:\...\Code.exe"
          />
          <button className="browse-btn" onClick={() => browse("windows")}>Browse</button>
        </div>
      </div>
      <div className="form-group">
        <label>Launch Arguments (optional)</label>
        <input
          type="text"
          value={(target.args ?? []).join(" ")}
          onChange={(e) => onChange({ args: e.target.value ? e.target.value.split(" ") : [] })}
          placeholder="--new-window --verbose"
        />
      </div>
    </div>
  );
}

function KeepAliveEditor({ apps, onChange }: { apps: string[]; onChange: (apps: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const name = input.trim();
    if (name && !apps.includes(name)) {
      onChange([...apps, name]);
      setInput("");
    }
  }

  return (
    <div className="keepalive-editor">
      <div className="keepalive-add">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="App name, e.g. Slack"
        />
        <button className="btn-add" onClick={add}>Add</button>
      </div>
      <div className="keepalive-chips">
        {apps.map((app) => (
          <span key={app} className="app-chip">
            {app}
            <button onClick={() => onChange(apps.filter((a) => a !== app))}>✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}
