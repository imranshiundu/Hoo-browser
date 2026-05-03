# Tauri vs Electron Decision for Hoo

Tauri is a strong framework, but it is not the right replacement for Hoo's main browser shell right now.

## What Tauri is

Tauri is not a language. It is a desktop/mobile app framework that combines:

- a web frontend such as HTML, CSS, JavaScript, TypeScript, React, Vue, or Svelte
- a Rust backend in `src-tauri`
- a native operating-system webview

This makes Tauri apps much smaller than Electron apps because Tauri does not bundle a full Chromium runtime into every app.

## Why Tauri is attractive

Tauri is excellent for:

- small desktop utilities
- dashboards
- vault apps
- launchers
- settings panels
- file tools
- companion apps
- admin apps

Benefits:

- smaller installers
- lower idle memory
- Rust backend
- native OS integration
- good security model when configured well

## Why Hoo should not migrate to Tauri now

Hoo is not only an app. Hoo is a browser.

A browser needs predictable behavior for:

- WhatsApp Web
- Gmail
- YouTube
- complex web apps
- media permissions
- downloads
- cookies
- storage partitions
- devtools
- future extension research
- ad/tracker blocking
- session restore

Tauri uses different webviews per OS:

- Windows: WebView2 / Chromium-based Edge runtime
- macOS: WebKit
- Linux: WebKitGTK

That means Hoo would not have one consistent browser engine across platforms. A feature that works on Windows may behave differently on Linux or macOS.

Electron is heavier, but it gives Hoo one predictable Chromium baseline across Linux, Windows, and macOS.

## Decision

Keep Hoo's main browser shell on Electron/Chromium for now.

Use Tauri later only for a companion module if needed:

- Hoo Vault
- Hoo Updater
- Hoo Profile Manager
- Hoo Settings Companion
- Hoo Password/Key Manager

## Correct long-term stack

Main browser:

- Electron
- TypeScript
- React
- Chromium BrowserView/WebContents

Native/security modules later:

- Rust through Node native bindings or sidecar binaries

Possible Tauri sidecar apps later:

- smaller vault/settings/updater tools

## What matters more than framework

Hoo becomes light through browser discipline:

- lazy session restore
- sleeping tabs
- Low Data Mode
- strict blocking
- no AI/sync at startup
- no hidden panels mounted at startup
- no heavy animated UI
- maintained filter lists
- efficient storage

Switching frameworks before these are solved would delay the browser without fixing the real browser problems.
