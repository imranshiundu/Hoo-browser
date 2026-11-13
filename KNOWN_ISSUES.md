# Hoo Browser — state & known issues (post-update to v0.10.1)

## Current state
- Repo: `~/.local/share/hoo-browser`, branch `main`, commit `88c33f4` (tag `v0.10.1`).
- Local `main` is identical to `origin/main`. Build (`npm run build`) and typecheck (`npm run typecheck`) both pass cleanly.
- Electron `40.1.0`, Node `v22.21.1`, React `19`, TypeScript `5.9`, webpack `5`.
- App entry: `~/.local/bin/hoo-browser` → `npm start` in `~/.local/share/hoo-browser`.
- Storage profile measured: `~/.config/Hoo Browser` ≈ **682 MB** and growing.
- Stashed backup of the pre-update local customizations (inline context menus / tab menus) kept at `git stash@{0}` — superseded by upstream's `setupBrowserContextMenu` + tab menus; not applied.

---

## Issues for the next agent

### 1. Slowness — synchronous main-thread storage I/O (CRITICAL)
`src/main/storage.ts:184` `StorageService.save()` calls `this.load()`, which **reads + JSON.parse the ENTIRE `user-data.json` on every single save**, then rewrites the whole file atomically.

It is invoked on every tab switch, tab title/URL change, navigation, permission decision, zoom, download, crashed-tab mark, and history cleanup. With a **682 MB** profile this is synchronous main-thread file I/O blocking the browser UI on nearly every interaction — the #1 cause of perceived slowness, getting worse as the profile grows.

**Suggested fix:** debounce/batch saves, keep an in-memory copy and write only on change, avoid `load()` inside `save()`, or move to append-only/segmented storage.

### 2. Slowness — `dirSize()` on every metrics poll
`src/main/performance-monitor.ts:53-60` `dirSize()` **recursively `stat`s the entire userData directory** on every metrics call. Synchronous, O(profile size), blocks the main thread.

### 3. Slowness — per-frame bounds IPC
`src/renderer/views/Browser.tsx:62-89` uses a `ResizeObserver` + `requestAnimationFrame` loop calling `updateViewBounds` (IPC to main) on every resize/frame.

### 4. RAM — no tab sleeping / discarding
`src/main/storage.ts` defaults include `maxLiveBackgroundTabs: 4` and `sleepIdleTabsAfterMinutes: 15`, but **nothing enforces them**. Every open tab is a resident `BrowserView` (separate Chromium renderer process) that stays alive indefinitely.

### 5. Storage bloat — unbounded growth
- `~/.config/Hoo Browser` ≈ **682 MB** measured.
- `user-data.json` rewritten in full on every change (write amplification).
- History and tabs are unbounded (`dataRetention` defaults to `forever`).

### 6. UI / app icon / branding
- `src/renderer/index.html:5`: `<title>Pied Piper Browser</title>` — wrong brand, leftover placeholder.
- `src/renderer/assets/branding/hoo-owl-wallpaper.png` is **1.44 MB** — bloats the build.

### 7. Website previews / tab previews
`src/renderer/components/TabStrip.tsx:683-685`: hover preview is an **identity card only** (title + host + favicon), not a live page thumbnail. No live website previews today.

### 8. Build/config hygiene
- `webpack.config.js` uses `transpileOnly: true` (type errors don't block builds).
- `dist/` and `release/` are gitignored (build output not tracked — correct).
