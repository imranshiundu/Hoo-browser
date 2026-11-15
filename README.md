<p align="center">
  <img src="./docs/branding/hoo-branding.svg" alt="Hoo Browser" width="920" />
</p>

<p align="center">
  <strong>OWL-GUIDED. PRIVACY-FIRST. WEB FREEDOM.</strong>
</p>

<p align="center">
  <a href="https://github.com/imranshiundu/Hoo-browser/actions/workflows/ci.yml"><img src="https://github.com/imranshiundu/Hoo-browser/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-3DBB78?style=flat-square" alt="License: MIT" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 40" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.9" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19" /></a>
  <img src="https://img.shields.io/badge/platform-Linux%20%C2%B7%20Windows%20%C2%B7%20macOS-lightgrey?style=flat-square" alt="platform" />
</p>

<p align="center">
  Hoo Browser is a DuckDuckGo-first desktop browser focused on practical privacy,
  isolated web apps, and a calm, watchful browsing experience for Linux and beyond.
</p>

---

# Hoo Browser

Hoo Browser is an experimental desktop browser shell built with Electron, TypeScript and React. The goal is a real installable Linux-first browser for DuckDuckGo-first search, isolated web apps, practical privacy controls, encryption-aware local data, and optional local-first AI assistance.

Hoo is owl-guided: the browser should feel watchful, calm, useful, protective, and honest about what it can and cannot do. That honesty extends to this README — everything listed here exists in the code, and the [known problems](#known-problems) section is kept up to date on purpose.

```text
src/main/       Electron main process — 14 modules for tabs, storage, privacy, downloads, auth
src/preload/    Typed contextIsolation bridge — renderer never touches Node
src/renderer/   React 19 UI — views, command palette, settings, branding
tests           Vitest unit suite over the main-process privacy & storage logic
```

## Why this project is interesting

Building a browser shell means taking real responsibility for the parts most
apps never touch:

- **Network policy engine** — a typed request classifier (`network-policy.ts`)
  that decides per-request blocking across four performance modes, with
  compatibility exemptions for sites that break under aggressive privacy rules.
- **Privacy filter pipeline** — ad/tracker host matching, forced-redirect
  scam detection, third-party cookie/referer stripping, and `X-Client-Data`
  removal (`privacy-filters.ts`), all covered by unit tests.
- **Resilient profile storage** — atomic JSON writes with quarantine of
  corrupted profiles and transparent reads of legacy `safeStorage`-encrypted
  data (`storage.ts`).
- **Process discipline** — tab lifecycle states (`placeholder → loaded →
  sleeping → crashed`), download danger hints for executable files, and a
  strict main/preload/renderer boundary.

## Current status

Version: `v0.5 Ask First`

The current codebase includes working early versions of:

- Chromium rendering through Electron `BrowserView`
- **site permission prompts**: when a page asks for the camera, microphone, location, notifications, screen capture or similar, a bubble under the toolbar lets you Allow or Block (optionally remembering the decision), saved decisions answer instantly, and Settings lists every stored decision so you can change your mind
- **per-site zoom memory**: Ctrl+= / Ctrl+- choices are remembered per origin and re-applied on every future visit (reset with Ctrl+0, clear everything in Settings)
- **a real bookmark manager**: the previously unreachable library view is now a tab (Ctrl+Shift+O) sharing the same storage as the toolbar star, with folders, search, and standard **Netscape HTML bookmark import/export** so you can move bookmarks to and from Firefox/Chrome
- **searchable, clearable history**: the toolbar history popover filters by title/URL as you type and can wipe the list; the app menu History submenu has a Clear Browsing History action
- tabs with persisted basic state and a documented lifecycle
- **drag-to-reorder tabs** (pinned tabs stay locked to the left edge, order survives restarts)
- navigation controls and DuckDuckGo-first home search
- **single-instance lock**: launching Hoo again focuses the existing window and opens any URL passed on the command line
- **window state persistence**: restarts reopen at your size/position/maximized state (clamped to the nearest display so a stale position can never strand the window)
- **a real icon set** (PNG/ICO/ICNS generated from the SVG master) — the taskbar, dock, and packages show the owl, not the default Electron icon
- an application menu whose accelerators work **inside web pages**: Ctrl+T/W/N new & close tabs, Ctrl+Tab and Ctrl+1–9 to switch, Ctrl+R / Ctrl+Shift+R reload, Alt+←/→ back/forward, Ctrl+F find, Ctrl+J downloads, Ctrl+0/+=/- zoom, F12 devtools, Ctrl+P print
- find in page with live match counts ("3 of 17")
- real favicons captured from pages (no third-party favicon service), with privacy-preserving letter avatars as fallback — **and favicon URLs persisted on the tab record so restarts keep tab identity**
- **a bookmark star that toggles**: filled while the current page is saved, click again to remove
- downloads: tracked, live progress in the toolbar, open file / show in folder, executable danger hints
- right-click context menu inside web pages (copy, search selection, open link, save image)
- loading feedback: tab spinners, an indeterminate progress bar, a working stop button, and back/forward buttons that disable themselves
- audio tab indicators with click-to-mute, link-hover URL preview, window title that follows the page
- crash handling: a crashed renderer shows a recoverable error page instead of a silent blank rectangle, **plus a session-recovery notice on the next launch with a one-click "Restore tabs" button**
- **double-click the title bar to maximize** (desktop convention)
- **macOS dock click reopens a window** instead of leaving a zombie process
- isolated web-app profiles (persistent partitions per app)
- privacy toggles and bookmark library (folder manager with import/export)
- simple ad/tracker host blocking with compatibility allowlist
- HTTPS upgrade for HTTP URLs, optional user-agent control
- local storage through Electron `safeStorage` where available
- Linux install/update scripts and cross-platform packaging metadata
- **automatic updates**: packaged installs (AppImage, deb, NSIS, DMG) check GitHub Releases at startup, download new versions in the background, and offer one-click "Restart to update" — with live progress in Settings. Source checkouts keep the git-based updater (pull, selective install, selective rebuild); copies that cannot self-update say so honestly and link to the releases page
- **real internal pages** (like Chrome's `chrome://` pages): a full **Downloads page** (Ctrl+J, live progress, open file / show in folder, clear list), an honest **Modules & Extensions page** (every toggle is a real built-in privacy setting — no fake extension cards), and the **Live Reader** RSS page that fetches feeds through the main process (no third-party CORS proxy) with persistent custom feeds
- **Firefox-style fullscreen**: when a page goes HTML5 fullscreen (YouTube's theater button, video players) or you press F11, the shell chrome gets out of the way entirely, a Firefox-like banner ("*youtube.com* is now full screen — Exit / Esc") appears and auto-hides, and slamming the pointer into the top edge slides a tab strip back down over the page so your tabs stay one click away; leaving a fullscreen tab (switching or closing it) drops the page out of fullscreen, like every real browser
- **download toasts**: a bottom-right stack taps you on the shoulder when a download starts, finishes, or fails — with Open / Folder actions on the finished ones — while every silent progress tick stays out of the way
- **site info panel**: click the padlock in the address bar to see the connection state ("Connection is secure" / an amber warning on plain HTTP) and cycle per-site permission decisions (Ask → Allow → Block) for the camera & microphone, location, notifications, screen recording and more — the same storage the permission prompts and Settings use
- **tab hover previews**: hover a tab for a Firefox-style identity card (favicon, title, site, live loading state) with switch and close actions — honest title/URL content rather than fake thumbnails, since background tabs cannot be screenshotted in Electron
- Vitest unit tests and GitHub Actions CI

The important work now is to make the project stable, testable, installable, and honest — `v0.3 Stable Tabs` (navigation state, find, downloads, crash handling, app-wide shortcuts), `v0.4 Feels Like A Browser` (drag-reorder, single instance, window restore, real icons, bookmark toggle), `v0.5 Ask First` (site permission prompts, per-site zoom, bookmark manager with import/export, history search/clear), `v0.6 Keeps Itself Current` (electron-updater against GitHub Releases, background download, restart-to-update, dual-channel update service), `v0.7 Real Internal Pages` (Downloads page, honest Modules & Extensions page, Live Reader with main-process feed fetching and persistent custom feeds, home-page tool shortcuts), `v0.8 Fullscreen Like Firefox` (HTML5 fullscreen + F11 immersive shell, auto-hiding site banner, top-edge tab strip reveal, dead-code purge), and `v0.9 Polish Pass` (download toasts, padlock site-info panel with per-site permission cycling, tab hover preview cards) have shipped.

## Test suite

The privacy and storage logic is unit-tested with Vitest:

```bash
npm install
npm test          # run the Vitest suite
npm run typecheck # strict tsc --noEmit over src/
npm run build     # webpack build (main + preload + renderer)
npm run verify    # project verification + build
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests, and a production build
on every push and pull request to `main`.

Releases (`.github/workflows/release.yml`) trigger on a `vX.Y.Z` tag: a
three-platform matrix builds the AppImage/deb (Linux), NSIS + portable (Windows),
and dmg/zip (macOS) installers, checks that the tag matches `package.json`,
and publishes one GitHub Release with every artifact plus the `latest*.yml`
metadata the in-app updater consumes. So shipping a version is:

```bash
# bump package.json first, then:
git tag v0.9.0 && git push origin v0.9.0
```

Covered modules today:

| Module | What the tests pin down |
| --- | --- |
| `privacy-filters.ts` | request blocking rules, compatibility-host exemptions, hard-blocked scam hosts, third-party header stripping, URL safety checks |
| `network-policy.ts` | low-data/lite/extreme/compatibility mode behavior for fonts, media, beacons, prefetch and tracker hosts |
| `storage.ts` | profile normalization, corrupt-tab filtering, active-tab validation, atomic save/load round-trips, site permission/zoom persistence |
| `download-manager.ts` | filename sanitization and executable danger hints |
| `tab-utils.ts` | collision-free tab ids, zoom clamping/stepping, find-bar status text, crash reason labels, byte formatting, drag-reorder id mapping, window-state clamping, history search filtering |
| `permissions.ts` | per-origin permission decisions, decision sanitization, DeepSpoof exemption precedence (stored blocks win) |
| `zoom-store.ts` | per-site zoom clamping and origin-keyed persistence sanitization |
| `bookmarks-io.ts` | Netscape HTML bookmark serialization/parsing, entity escaping, folder round-trips, dedupe-merging with caps |
| `update-service.ts` | update-channel resolution (packaged vs source vs none), startup auto-check gating, download progress formatting, updater error translation |
| `rss-feeds.ts` (renderer) | feed URL validation/normalization, custom feed persistence, default/custom merge with dedupe, corrupt-storage recovery |
| `download-model.ts` (renderer) | download status text, size formatting, live record upsert semantics |
| `fullscreen-model.ts` (renderer) | immersive-state resolution (active page vs background tab vs F11), fullscreen origin labels, chrome reveal/hide pointer edge zones |
| `download-toast-model.ts` (renderer) | which download transitions deserve a toast (start/finish/fail, never progress ticks or cancels), stack capping, replacement and expiry |
| `types.ts` (renderer) | privacy-preserving site-initial avatars used instead of third-party favicon services |
| `branding assets` | the generated PNG/ICO/ICNS icon set exists so builds can never silently lose the app icon again |

## Install on Linux

Requirements: Node.js 18+, npm 9+, Git, an Electron-supported Linux desktop.

Install directly from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/imranshiundu/Hoo-browser/main/scripts/install-hoo.sh | bash
```

The installer:

- clones Hoo into `~/.local/share/hoo-browser`
- installs dependencies and builds the app
- creates a `hoo-browser` launcher in `~/.local/bin`
- creates a desktop launcher so Hoo appears in the app menu
- installs a user-level systemd timer that checks for updates every 7 days

Start it from your app launcher or run `hoo-browser`.

## Development setup

```bash
git clone https://github.com/imranshiundu/Hoo-browser.git
cd Hoo-browser
npm install
npm run dev:start   # build + launch
npm start           # launch a built app
npm test            # unit tests
npm run typecheck   # tsc --noEmit
```

Packaging:

```bash
npm run dist            # AppImage + deb (Linux)
npm run dist:appimage   # AppImage only
npm run dist:deb        # deb only
npm run dist:win        # NSIS + portable (Windows)
npm run dist:mac        # dmg + zip (macOS)
```

Packaging needs clean-machine verification before release builds are advertised.

## Architecture notes

```text
src/
  main/                 Electron main process
    main.ts             window + BrowserView orchestration, IPC surface
    storage.ts          atomic profile persistence, crash records, retention
    privacy-filters.ts  ad/tracker/scam filtering, header hygiene
    network-policy.ts   per-mode request policy (balanced/lite/extreme/compatibility)
    tab-lifecycle.ts    tab runtime state machine
    download-manager.ts download records, executable danger hints
    auth.ts, sync.ts, update-service.ts, protocols.ts, ...
  preload/
    preload.ts          contextIsolation bridge — the only renderer door
  renderer/
    App.tsx + views/    React 19 interface
    components/         command palette, settings, panels
docs/
  native-security-architecture.md   security design notes
  browser-hardening-phase-1.md      hardening log
  real-browser-checklist.md         what "real browser" requires
  encryption-plan.md                local data encryption plan
  performance-budget.md             performance targets
  rebuild-plan.md                   roadmap details
```

## Personal path policy

Do not commit personal machine paths such as `/home/imran/...` into product
UI, docs, defaults, or screenshots. Use generic paths only
(`~/.config/hoo-browser`). Local developer paths belong in a private `.env`
that is git-ignored.

## Known problems

These are tracked honestly instead of hidden:

1. The ad/tracker blocker uses a curated static list, not maintained filter lists.
2. Random user-agent rotation can make fingerprinting worse if used incorrectly.
3. ~~Permission prompts need a visible UX~~ **Done in v0.5**: sites now get an Allow/Block bubble with remember-for-site, a synchronous check handler that honors stored decisions, and a Settings manager for stored decisions. Per-site *exceptions UI inside the page* (page-info bubble) is still future work.
4. ~~Crash recovery needs further implementation~~ Crashed tabs now show a recoverable error page, are recorded, and a session-recovery notice with a **one-click Restore tabs button** appears on the next launch.
5. ~~The project has no automated tests yet.~~ 142 unit tests cover main-process logic and key renderer helpers; full component tests are still missing.
6. RSS currently depends on renderer-side fetching patterns that should move to the main process. The RSS view itself is still not reachable from the UI (planned for the v0.6 library).
7. Cloud sync needs stronger conflict handling and clearer data boundaries.
8. IPC actions need tighter validation as the browser grows.
9. AppImage/deb builds need clean-machine verification.
10. ~~Zoom level is remembered per tab in memory only~~ **Done in v0.5**: zoom is remembered per site in the profile and re-applied on navigation.
11. ~~Bookmark folders, search inside history, and bookmarks import/export are not implemented~~ **Done in v0.5**: the bookmark manager tab has folders, search, and Netscape HTML import/export; the history popover has search and clear. Bookmark *backup automation* (scheduled exports) is not implemented.
12. Tab drag-reorder is HTML5-based; dragging a tab out of the strip to tear it into a new window is not supported yet.
13. Several secondary views shipped in earlier milestones (RSS reader, performance dashboard, command palette, extensions stub) are still not wired into the shell; they are dead code until the v0.6 library work, and the README no longer claims them as reachable features.

## Keyboard map

Every shortcut below is an application-menu accelerator, so it works while a
web page has focus — not only while the Hoo UI is focused:

| Keys | Action |
| --- | --- |
| Ctrl+T / Ctrl+W | new tab / close tab |
| Ctrl+Shift+T | reopen closed tab |
| Ctrl+Tab / Ctrl+Shift+Tab | next / previous tab |
| Ctrl+1…8, Ctrl+9 | switch to tab by position (9 = last) |
| Ctrl+L focus | address bar (renderer shortcut) |
| Ctrl+R / Ctrl+Shift+R | reload / force reload |
| Alt+← / Alt+→ | back / forward |
| Ctrl+F | find in page (live match counts) |
| Ctrl+J | downloads panel |
| Ctrl+Shift+O | bookmark manager (library tab) |
| Ctrl+= / Ctrl+- / Ctrl+0 | zoom in / out / actual size |
| F12 / Ctrl+Shift+I | developer tools for the page |
| Ctrl+P | print page |
| Ctrl+, | settings |

## Rebuild path

- `v0.1 Foundation` — honest docs, build scripts, verification, project contract
- `v0.2 Hoo Foundation` — Hoo identity, installer path, branded home UI, packaging metadata, **test suite + CI**
- `v0.3 Stable Tabs` — reliable tab restore, navigation state, crash handling, app-wide shortcuts, find/downloads/favicons wiring
- `v0.4 Feels Like A Browser` — drag-to-reorder tabs, single-instance lock, window state restore, real icon set, bookmark toggle, session-recovery notice ← *current*
- `v0.5 Web Apps` — isolated app profiles, permissions, reset controls
- `v0.6 Privacy Controls` — maintained filters, allowlists, visible blocked counts, stable fingerprint profile
- `v0.7 Local Assistant` — streaming, explicit context, provider settings, local/cloud warnings
- `v0.8 Sync and Encryption` — safe sync scope, conflict handling, encrypted backup/import/export
- `v0.9 Packaging` — verified AppImage, deb, icons, desktop entry
- `v1.0 Daily Driver` — only after stability, packaging, tests, and privacy docs match behavior

Read the detailed plan in [`docs/rebuild-plan.md`](docs/rebuild-plan.md).

## Contributing

Keep the project plain and professional.

- Do not oversell features.
- Do not add fake privacy claims.
- Do not add hidden telemetry.
- Do not send page content to AI providers without explicit user action.
- Do not commit personal laptop paths or local-only folder structures.
- Prefer small verified patches over huge rewrites; add or update tests for anything touching `src/main`.
- Document every feature that touches user data.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — Copyright (c) 2026 Imran Shiundu
