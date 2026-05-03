# Zen Browser

Zen Browser is an experimental desktop browser shell built with Electron. The goal is to shape it into a Linux-first browser for controlled web apps, practical privacy controls, and local-first AI assistance.

This is not a finished Chrome, Brave, Firefox, or Arc replacement yet. It is a prototype that needs hardening before anyone should trust it as a daily driver.

## Current status

Version: `v0.1 Foundation`

The current codebase can render web pages through Electron's Chromium engine and includes early versions of tabs, app profiles, privacy toggles, bookmarks, RSS, MEGA sync, and an OpenClaw AI panel.

The important work now is to make the project honest, stable, testable, and easier to improve.

## What this browser is trying to become

A focused browser for people who want:

- Linux-first desktop browsing
- web apps in isolated sessions
- clear privacy controls instead of hidden settings
- optional local-first AI assistance
- no browser-vendor account requirement for basic usage
- practical tools for builders, researchers, and power users

## What it is not yet

Zen Browser is not yet:

- a full privacy browser
- an anonymity tool
- a hardened security browser
- a complete replacement for mainstream browsers
- a production-ready password/session manager
- a proven WhatsApp calling solution across all accounts and future WhatsApp updates

## Core features in the prototype

### Browsing

- Electron `BrowserView` based Chromium rendering
- tabs with persisted basic state
- navigation controls
- split-screen tab view
- custom app shell

### Web apps

- app launcher for common web services
- isolated persistent partitions for launched apps
- WhatsApp Web profile with Windows user-agent spoofing experiment for Linux calling support

### Privacy controls

- simple ad/tracker host blocking
- HTTPS upgrade attempt for HTTP URLs
- optional user-agent spoofing
- configurable history retention
- local storage through Electron `safeStorage` when available

These controls are early. They should be treated as practical experiments, not strong privacy guarantees.

### AI panel

- OpenClaw panel in the sidebar
- local gateway status check
- current page title and URL can be passed as context

The AI layer should remain explicit and user-controlled. The browser should not silently scrape or send page content.

### Other tools

- bookmarks
- RSS reader
- dashboard
- MEGA profile sync experiment

## Setup

Requirements:

- Node.js 18 or newer
- npm 9 or newer
- Electron-supported desktop OS
- Linux recommended for the current direction

Install dependencies:

```bash
npm install
```

Run a development build:

```bash
npm run dev:start
```

Build only:

```bash
npm run build
```

Run type checking:

```bash
npm run typecheck
```

Run the basic verification command:

```bash
npm run verify
```

Start the app:

```bash
npm start
```

Only use the unsafe no-sandbox command when debugging a local environment that requires it:

```bash
npm run start:unsafe-no-sandbox
```

## Project structure

```text
src/
  main/        Electron main process, BrowserView management, storage, sync, privacy filters
  preload/     safe bridge exposed to the renderer
  renderer/    React interface, views, panels, navigation, settings

docs/
  rebuild-plan.md
```

## Known problems

These are not small issues. They are the reason the browser needs a rebuild path.

1. The ad/tracker blocker uses a small hard-coded list, not maintained filter lists.
2. Random user-agent rotation can make fingerprinting worse if used incorrectly.
3. Some README claims were stronger than the implementation.
4. The project has no automated tests yet.
5. RSS currently depends on renderer-side fetching patterns that should move to the main process.
6. Cloud sync needs stronger conflict handling and clearer data boundaries.
7. IPC actions need tighter validation as the browser grows.
8. Packaging is not ready for normal users.
9. The app needs a clean release mode that does not behave like a development build.

## Rebuild path

Use simple version names:

- `v0.1 Foundation` — honest docs, build scripts, verification, project contract
- `v0.2 Stable Tabs` — reliable tab restore, navigation state, crash handling
- `v0.3 Web Apps` — isolated app profiles, permissions, reset controls
- `v0.4 Privacy Controls` — maintained filters, allowlists, visible blocked counts, stable fingerprint profile
- `v0.5 Local Assistant` — streaming, explicit context, provider settings, local/cloud warnings
- `v0.6 Sync` — safe sync scope, conflict handling, manual export/import
- `v0.7 Packaging` — AppImage, deb, icons, desktop entry
- `v1.0 Daily Driver` — only after stability, packaging, tests, and privacy docs match behavior

Read the detailed plan in [`docs/rebuild-plan.md`](docs/rebuild-plan.md).

## Contribution rules

Keep the project plain and professional.

- Do not oversell features.
- Do not add fake privacy claims.
- Do not add hidden telemetry.
- Do not send page content to AI providers without explicit user action.
- Prefer small verified patches over huge rewrites.
- Keep names simple and readable.
- Document every feature that touches user data.

## License

MIT
