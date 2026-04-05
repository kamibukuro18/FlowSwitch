[English](README.md) | [日本語](README.ja.md)

# FlowSwitch

FlowSwitch is a Tauri desktop app for switching work context in one click.
It groups URLs, apps, files, folders, and console commands into reusable modes and launches them together.

## Features

- Mode-based launch sets for URLs, apps, folders, files, and console commands
- Compact mode editor with drag and drop target management
- Tray / menu bar residency support
- `Info` / `About` entry inside the app
- External links for creator profile, more tools, support, and GitHub
- Lightweight `Updates` panel powered by GitHub Releases

## Info / About and Updates

The app now includes a lightweight `Info` entry in the sidebar.
It opens a small modal that shows:

- app name
- author name
- short author description
- current app version
- external links
- latest release information from GitHub Releases

If a newer release is available, the `Info` entry shows a small `NEW` badge.
This is intentionally passive: there is no forced popup and normal usage is not interrupted.

## Release Information

Updates are based on the GitHub Releases API.
The app fetches the latest release, compares it with the current app version, and shows:

- current version
- latest version
- release title
- shortened release notes
- link to the GitHub release page

If the request fails or the app is offline, the main app keeps working normally.

## Reusable Metadata

Author details and URLs are centralized in:

- [src/config/appMetadata.ts](src/config/appMetadata.ts)

This file is the main swap point when reusing the same `Info / About / Updates` pattern in another desktop app.
It currently manages:

- `appName`
- `appVersion`
- `authorName`
- `authorDescription`
- `profileUrl`
- `moreToolsUrl`
- `supportUrl`
- `githubRepoUrl`
- `githubReleasesApiUrl`

## Release Workflow

This implementation assumes GitHub Releases as the source of truth for release notes and update visibility.
If you publish a new release on GitHub, the in-app `Updates` view can pick it up without adding a backend or database.

## Development

### Requirements

- Node.js 18+
- Rust with `rustup`
- Tauri 2 toolchain

Platform notes:

- macOS: install Xcode Command Line Tools
- Windows: install Microsoft C++ Build Tools or Visual Studio with C++ workload

### Install

```bash
git clone https://github.com/kamibukuro18/FlowSwitch.git
cd FlowSwitch
npm install
cargo install tauri-cli --version "^2"
```

### Run in development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Build artifacts are generated under `src-tauri/target/release/bundle/`.
