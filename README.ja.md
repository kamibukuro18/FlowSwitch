[English](README.md) | [日本語](README.ja.md)

# FlowSwitch

<p align="center">
  <img src="./docs/images/flowswitch_hero_v2.png" alt="FlowSwitch hero image" width="960" />
</p>

FlowSwitch は、ワンクリックで作業コンテキストを切り替えるための Tauri デスクトップアプリです。  
URL、アプリ、ファイル、フォルダ、コンソールコマンドをモードとしてまとめて登録し、一括で起動できます。

## 主な機能

- URL、アプリ、フォルダ、ファイル、コンソールコマンドをまとめたモード起動
- ドラッグ&ドロップ対応のコンパクトなモード編集 UI
- トレイ / メニューバー常駐
- アプリ内の `Info` / `About` 導線
- 作者プロフィール、他ツール、サポート、GitHub への外部リンク
- GitHub Releases ベースの軽量な `Updates` パネル

## Info / About と Updates

アプリ内のサイドバーに軽量な `Info` 導線があります。  
開くと小さなモーダルが表示され、次の内容を確認できます。

- アプリ名
- 作者名
- 作者の短い説明
- 現在のバージョン
- 外部リンク
- GitHub Releases から取得した最新リリース情報

新しいバージョンがある場合のみ、`Info` 項目に小さな `NEW` バッジが表示されます。  
強制ポップアップは出さず、通常利用を邪魔しない設計です。

## 更新情報の仕組み

Updates は GitHub Releases API を基準にしています。  
アプリは最新リリースを取得し、現在バージョンと比較して次を表示します。

- 現在バージョン
- 最新バージョン
- リリースタイトル
- 短く整形したリリースノート
- GitHub Release ページへのリンク

通信に失敗した場合やオフライン時でも、アプリ本体の通常機能には影響しません。

## 再利用しやすい設定値

作者情報や各種 URL は次のファイルに集約しています。

- [src/config/appMetadata.ts](src/config/appMetadata.ts)

他のデスクトップアプリへ同じ `Info / About / Updates` の仕組みを流用する場合は、基本的にこのファイルを差し替えれば対応できます。

現在ここで管理している項目:

- `appName`
- `appVersion`
- `authorName`
- `authorDescription`
- `profileUrl`
- `moreToolsUrl`
- `supportUrl`
- `githubRepoUrl`
- `githubReleasesApiUrl`

## リリース運用

この実装では、リリースノートと更新確認の基準を GitHub Releases に寄せています。  
GitHub で新しい Release を公開すると、アプリ内の `Updates` ビューからその情報を参照できます。

## 開発

### 前提

- Node.js 18 以上
- `rustup` で導入した Rust
- Tauri 2 のツールチェーン

プラットフォームごとの補足:

- macOS: Xcode Command Line Tools をインストール
- Windows: Microsoft C++ Build Tools または Visual Studio の C++ ワークロードをインストール

### インストール

```bash
git clone https://github.com/kamibukuro18/FlowSwitch.git
cd FlowSwitch
npm install
cargo install tauri-cli --version "^2"
```

### 開発起動

```bash
npm run tauri dev
```

### ビルド

```bash
npm run tauri build
```

ビルド成果物は `src-tauri/target/release/bundle/` 以下に生成されます。
