# FlowSwitch

作業モードをワンクリックで切り替えるクロスプラットフォームデスクトップアプリ。

「開発」「執筆」「制作」などのモードを切り替えるとき、必要なURL・アプリ・ディレクトリを一括で開きます。

## スクリーンショット

- **モード一覧**: 登録済みモードをカード形式で表示。検索・ソート対応。
- **1クリック起動**: ▶ Launch ボタンでURL・アプリ・フォルダを一括オープン。
- **モード編集**: URL / アプリ / ディレクトリをそれぞれ追加・編集・並び替え。
- **実行結果**: 成功・スキップをリスト表示。エラーがあっても処理は継続。

---

## 動作環境

| OS | 対応状況 |
|----|---------|
| macOS | ✅ |
| Windows | ✅ |
| Linux | ⚠️ MVP対象外（ビルドは可能） |

---

## セットアップ

### 必要なもの

- [Node.js](https://nodejs.org/) v18 以上
- [Rust](https://www.rust-lang.org/tools/install) (rustup)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) または Visual Studio
- **Linux**: `libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev`

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/kamibukuro18/FlowSwitch.git
cd FlowSwitch

# npm 依存パッケージをインストール
npm install

# Tauri CLI をインストール（初回のみ）
cargo install tauri-cli --version "^2"
```

---

## 起動方法

### 開発モード（ホットリロードあり）

```bash
npm run tauri dev
```

> **注意**: `tauri` コマンドを直接実行しないでください。必ず `npm run tauri dev` を使用してください。

ブラウザは開きません。デスクトップウィンドウが起動します。

### プロダクションビルド

```bash
npm run tauri build
```

ビルド成果物は `src-tauri/target/release/bundle/` に生成されます。

| OS | 形式 |
|----|------|
| macOS | `.dmg` / `.app` |
| Windows | `.msi` / `.exe` |

---

## 設定ファイル

初回起動時はサンプルモードが表示されます。

実際に使うには **Settings** 画面で設定ファイルのパスを指定し、**Load Config** してください。

設定ファイルは JSON 形式です。`example-config.json` をベースに編集してください。

```json
{
  "version": 1,
  "modes": [
    {
      "id": "dev",
      "name": "Development",
      "description": "Start coding environment",
      "shortcut": "CmdOrCtrl+Shift+1",
      "color": "#6366f1",
      "icon": "⌨️",
      "exitAction": "minimize",
      "targets": [
        { "type": "url", "value": "https://github.com", "label": "GitHub" },
        {
          "type": "directory",
          "label": "Projects",
          "path": {
            "macos": "~/Projects",
            "windows": "%USERPROFILE%\\Projects"
          }
        },
        {
          "type": "application",
          "name": "VSCode",
          "path": {
            "macos": "/Applications/Visual Studio Code.app",
            "windows": "C:\\...\\Code.exe"
          }
        }
      ]
    }
  ]
}
```

### macOS / Windows 共通ファイルとして使う

`path.macos` と `path.windows` を両方書いておけば、同じファイルを iCloud Drive や Dropbox で共有して Mac/Windows どちらでも使えます。片方が未定義の場合はスキップされます。

---

## ターゲットの種類

| type | 動作 |
|------|------|
| `url` | デフォルトブラウザで開く |
| `directory` | Finder / エクスプローラーで開く |
| `application` | アプリを起動する |

---

## フロントエンド単体の開発（Tauri なし）

Tauri コマンドが呼ばれない範囲であれば、ブラウザで確認できます。

```bash
npm run dev
# → http://localhost:1420
```
