export type Lang = "en" | "ja";

const dict = {
  // Sidebar
  nav_modes:        { en: "Modes",    ja: "モード" },
  nav_new_mode:     { en: "New Mode", ja: "新規モード" },
  nav_settings:     { en: "Settings", ja: "設定" },

  // ModeListView
  search_placeholder:  { en: "Search modes...",            ja: "モードを検索..." },
  sort_default:        { en: "Default order",              ja: "デフォルト順" },
  sort_name:           { en: "Sort by name",               ja: "名前順" },
  sort_targets:        { en: "Sort by targets",            ja: "ターゲット数順" },
  reload_config:       { en: "Reload config",              ja: "設定を再読み込み" },
  no_match:            { en: 'No modes match "%s"',        ja: '"%s" に一致するモードがありません' },
  clear_search:        { en: "Clear search",               ja: "検索をクリア" },
  no_modes:            { en: "No modes yet. Create your first mode!", ja: "モードがありません。最初のモードを作成しましょう！" },
  create_mode:         { en: "+ Create Mode",              ja: "+ モードを作成" },

  // ModeEditorView
  back:                 { en: "← Back",                   ja: "← 戻る" },
  new_mode:             { en: "New Mode",                  ja: "新規モード" },
  edit_mode_title:      { en: "Edit: %s",                  ja: "編集: %s" },
  save:                 { en: "Save",                      ja: "保存" },
  basic_info:           { en: "Basic Info",                ja: "基本情報" },
  mode_name_label:      { en: "Mode Name *",               ja: "モード名 *" },
  mode_name_ph:         { en: "e.g. Development, Writing...", ja: "例: 開発, ライティング..." },
  mode_name_required:   { en: "Mode name is required",    ja: "モード名は必須です" },
  close_others:         { en: "Close other browser tabs on Launch", ja: "Launch 時に他のブラウザを閉じる" },
  close_apps:           { en: "Close other apps on Launch",         ja: "Launch 時に他のアプリを閉じる" },
  close_dirs:           { en: "Close other directories on Launch",  ja: "Launch 時に他のディレクトリを閉じる" },
  targets_header:       { en: "Targets (%d)",              ja: "ターゲット (%d)" },
  delete_all:           { en: "Delete All",                ja: "全て削除" },
  tab_paste:            { en: "+ Paste URLs",              ja: "+ URLをペースト" },
  tab_bookmarks:        { en: "+ Bookmarks",               ja: "+ ブックマーク" },
  tab_app:              { en: "+ App",                     ja: "+ App" },
  tab_dir:              { en: "+ Dir",                     ja: "+ Dir" },
  paste_ph:             { en: "Paste URLs (one per line)\nhttps://github.com\nhttps://notion.so", ja: "URLを貼り付け（複数可・1行1URL）\nhttps://github.com\nhttps://notion.so" },
  add:                  { en: "Add",                       ja: "追加" },
  cancel:               { en: "Cancel",                    ja: "キャンセル" },
  bookmark_search_ph:   { en: "Search bookmarks...",       ja: "ブックマークを検索..." },
  loading:              { en: "Loading...",                ja: "読み込み中..." },
  no_bookmarks:         { en: "No Chrome / Edge / Brave bookmarks found", ja: "Chrome / Edge / Brave のブックマークが見つかりません" },
  no_matching_bookmarks:{ en: "No matching bookmarks",    ja: "一致するブックマークがありません" },
  selected_count:       { en: "%d selected",               ja: "%d 件選択" },
  count_items:          { en: "%d items",                  ja: "%d 件" },
  add_selected:         { en: "Add %d",                    ja: "%d 件を追加" },
  deselect_all:         { en: "Deselect All",              ja: "全解除" },
  select_all:           { en: "Select All",                ja: "全選択" },
  close:                { en: "Close",                     ja: "閉じる" },
  app_name_label:       { en: "Application Name",         ja: "アプリ名" },
  macos_path_app:       { en: "macOS Path (.app)",         ja: "macOS パス (.app)" },
  windows_path_exe:     { en: "Windows Path (.exe)",       ja: "Windows パス (.exe)" },
  launch_args:          { en: "Launch Arguments (optional)", ja: "起動引数（任意）" },
  label_optional:       { en: "Label (optional)",          ja: "ラベル（任意）" },
  macos_path:           { en: "macOS Path",                ja: "macOS パス" },
  windows_path:         { en: "Windows Path",              ja: "Windows パス" },
  drop_hint:            { en: "Drop URL here",             ja: "URLをここにドロップ" },
  targets_empty:        { en: "Drag & drop URLs, apps, or folders, or use the buttons above.", ja: "URLやアプリ、フォルダをドラッグ&ドロップするか、上のタブで追加してください。" },
  browse:               { en: "Browse",                    ja: "参照" },
  type_url:             { en: "URL",                       ja: "URL" },
  type_dir:             { en: "Directory",                 ja: "ディレクトリ" },
  type_app:             { en: "Application",               ja: "アプリ" },
  url_label:            { en: "URL",                       ja: "URL" },

  // ExecutionResultView
  launched:    { en: "— Launched",      ja: "— 起動完了" },
  succeeded:   { en: "✓ %d succeeded",  ja: "✓ %d 件成功" },
  skipped:     { en: "✕ %d skipped",    ja: "✕ %d 件スキップ" },
  done:        { en: "Done",            ja: "完了" },

  // SettingsView
  settings:          { en: "Settings",               ja: "設定" },
  config_file:       { en: "Config File",             ja: "設定ファイル" },
  config_file_desc:  { en: "Specify where your modes configuration file is stored. Use a synced folder (iCloud, Dropbox, etc.) to share between devices.", ja: "モード設定ファイルの保存場所を指定します。iCloud や Dropbox などの同期フォルダを使うとデバイス間で共有できます。" },
  default_btn:       { en: "Default",                 ja: "デフォルト" },
  load_config:       { en: "Load Config",             ja: "設定を読み込む" },
  save_config_btn:   { en: "Save Current Config",     ja: "現在の設定を保存" },
  saved_indicator:   { en: "✓ Saved",                 ja: "✓ 保存しました" },
  appearance:        { en: "Appearance",              ja: "外観" },
  theme_label:       { en: "Theme",                   ja: "テーマ" },
  language_label:    { en: "Language",                ja: "言語" },
  theme_dark:        { en: "Dark",                    ja: "ダーク" },
  theme_light:       { en: "Light",                   ja: "ライト" },
  theme_system:      { en: "System",                  ja: "システム" },
  config_format:     { en: "Config File Format",      ja: "設定ファイルフォーマット" },
  config_format_desc:{ en: "The config file is a JSON file with the following structure. You can edit it directly or use this app to manage modes.", ja: "設定ファイルは以下の構造を持つ JSON ファイルです。直接編集するか、このアプリでモードを管理できます。" },
  // Onboarding wizard
  welcome_title:       { en: "Welcome to FlowSwitch",    ja: "FlowSwitch へようこそ" },
  welcome_desc:        { en: "Switch your work context in one click.\nURLs, apps, and folders — organized into modes\nthat launch together instantly.", ja: "ワンクリックで作業コンテキストを切り替え。\nURL・アプリ・フォルダをモードにまとめて\n一瞬で起動できます。" },
  get_started:         { en: "Get Started",               ja: "はじめる" },
  step_of:             { en: "Step %d of %d",             ja: "ステップ %d / %d" },
  setup_path_title:    { en: "Config File Location",      ja: "設定ファイルの保存先" },
  setup_path_desc:     { en: "FlowSwitch saves your modes to a JSON file.\nUse a synced folder (iCloud, Dropbox) to share between devices.", ja: "FlowSwitch はモード設定を JSON ファイルに保存します。\niCloud や Dropbox の同期フォルダを使えば\nデバイス間で共有できます。" },
  next:                { en: "Next",                      ja: "次へ" },
  first_mode_title:    { en: "Create Your First Mode",   ja: "最初のモードを作成" },
  first_mode_desc:     { en: "A mode is a set of URLs, apps, and folders that launch together.\nGive it a name and paste some URLs to get started.", ja: "モードは、まとめて起動する URL・アプリ・フォルダのセットです。\n名前をつけて、URL を貼り付けてみましょう。" },
  mode_name_wizard_ph: { en: "e.g. Work, Study, Side Project...", ja: "例: 仕事, 勉強, 副業..." },
  urls_wizard_ph:      { en: "Paste URLs (one per line)\nhttps://github.com\nhttps://notion.so", ja: "URL を貼り付け（1行1URL）\nhttps://github.com\nhttps://notion.so" },
  skip:                { en: "Skip",                      ja: "スキップ" },
  create_and_finish:   { en: "Create & Start",            ja: "作成して開始" },
  ready_title:         { en: "You're all set!",           ja: "準備完了！" },
  ready_desc:          { en: "Drag & drop URLs, apps, or folders onto a mode to add targets.\nRight-click the tray icon for quick launch.", ja: "URL・アプリ・フォルダをドラッグ＆ドロップで追加。\nトレイアイコンの右クリックで素早く起動できます。" },
  start_app:           { en: "Start Using FlowSwitch",    ja: "FlowSwitch を使い始める" },
} satisfies Record<string, Record<Lang, string>>;

export type TKey = keyof typeof dict;

/** Translate a key, with optional sprintf-style %s / %d substitution. */
export function t(lang: Lang, key: TKey, ...args: (string | number)[]): string {
  const str = dict[key][lang] ?? dict[key].en;
  return args.reduce<string>((s, arg) => s.replace(/%[sd]/, String(arg)), str);
}
