# Zen Browser

Zen Browser is an experimental desktop browser shell built with Electron. The goal is to shape it into a Linux-first browser for controlled web apps, DuckDuckGo-first search, practical privacy controls, encrypted local data where possible, and local-first AI assistance.

This is not a finished Chrome, Brave, Firefox, or Arc replacement yet. It is a prototype that needs hardening before anyone should trust it as a daily driver.

## Current status

Version: `v0.1 Foundation`

The current codebase can render web pages through Electron's Chromium engine and includes early versions of tabs, app profiles, privacy toggles, bookmarks, RSS, MEGA sync, and an OpenClaw AI panel.

The important work now is to make the project honest, stable, testable, and easier to improve.

## What makes a real browser real?

A real browser is not just an app that opens a website. A real browser needs:

- a modern rendering engine
- address/search navigation
- tabs and session restore
- bookmarks and history
- downloads
- permissions for camera, microphone, notifications, location, and clipboard
- storage boundaries
- crash recovery
- security controls
- update/install packaging
- clear privacy behavior that matches the code

Zen already has the beginning of the rendering, navigation, tabs, app profiles, bookmarks, and privacy layers. It still needs stronger downloads, permissions UI, crash recovery, tests, packaging, and privacy hardening before it can be called a daily-driver browser.

See [`docs/real-browser-checklist.md`](docs/real-browser-checklist.md).

## Product identity

Zen should become useful first as:

> A Linux-first browser for DuckDuckGo search, isolated web apps, practical privacy controls, encrypted local profile data where available, and optional local AI help.

DuckDuckGo is the default search identity. Startpage and Qwant are privacy alternatives. Google can exist as a user-selected fallback, but it should not define the browser.

WhatsApp support matters. It should remain one of the strongest web-app profiles, especially for Linux users, but the browser should not become only a WhatsApp wrapper.

## What this browser is trying to become

A focused browser for people who want:

- DuckDuckGo-first desktop browsing
- Linux-first web app profiles
- WhatsApp, GitHub, ChatGPT, Proton Mail, and similar apps in isolated sessions
- clear privacy controls instead of hidden settings
- encrypted local profile storage where the OS supports it
- optional encrypted backup/sync direction
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
- DuckDuckGo-first home search
- split-screen tab view
- custom app shell

### Web apps

- app launcher for common web services
- isolated persistent partitions for launched apps
- WhatsApp Web profile with Windows user-agent spoofing experiment for Linux calling support

### Privacy and encryption controls

- simple ad/tracker host blocking
- HTTPS upgrade attempt for HTTP URLs
- optional user-agent spoofing
- configurable history retention
- local storage through Electron `safeStorage` when available
- encryption status and encrypted backup/sync still need stronger implementation

These controls are early. They should be treated as practical experiments, not strong privacy guarantees.

See [`docs/encryption-plan.md`](docs/encryption-plan.md).

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
  encryption-plan.md
  real-browser-checklist.md
  rebuild-plan.md
```

## Personal path policy

Do not commit personal machine paths such as `/home/imran/...` or private local folder structures into the product UI, docs, defaults, or screenshots.

Use generic paths only:

```text
~/.config/zen-browser
/path/to/openclaw/docker-compose.yml
```

Local developer paths can exist in a private `.env` or ignored local config file, not in source-controlled product defaults.

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
10. Hard-coded local developer assumptions must be moved into user-configurable settings.

## Rebuild path

Use simple version names:

- `v0.1 Foundation` — honest docs, build scripts, verification, project contract
- `v0.2 Stable Tabs` — reliable tab restore, navigation state, crash handling
- `v0.3 Web Apps` — isolated app profiles, permissions, reset controls
- `v0.4 Privacy Controls` — maintained filters, allowlists, visible blocked counts, stable fingerprint profile
- `v0.5 Local Assistant` — streaming, explicit context, provider settings, local/cloud warnings
- `v0.6 Sync and Encryption` — safe sync scope, conflict handling, encrypted backup/import/export
- `v0.7 Packaging` — AppImage, deb, icons, desktop entry
- `v1.0 Daily Driver` — only after stability, packaging, tests, and privacy docs match behavior

Read the detailed plan in [`docs/rebuild-plan.md`](docs/rebuild-plan.md).

## Contribution rules

Keep the project plain and professional.

- Do not oversell features.
- Do not add fake privacy claims.
- Do not add hidden telemetry.
- Do not send page content to AI providers without explicit user action.
- Do not commit personal laptop paths or local-only folder structures.
- Prefer small verified patches over huge rewrites.
- Keep names simple and readable.
- Document every feature that touches user data.

## License

MIT
