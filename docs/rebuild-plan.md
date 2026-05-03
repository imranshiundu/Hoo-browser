# Zen Browser Rebuild Plan

Zen Browser should not try to compete with Chrome, Brave, Firefox, or Arc on day one. The first serious version should be a focused Linux-first browser shell for people who want controlled web apps, practical privacy controls, and a local AI assistant they understand.

## What failed

The first version failed because the README promised a mature privacy browser while the implementation is still a prototype. That mismatch hurts trust. A browser is a trust product before it is a UI product.

Main problems:

1. The privacy layer is too small.
   The current ad and tracker blocker uses a short hard-coded list. That is useful for a demo but not enough for daily browsing.

2. Fingerprint protection is oversold.
   Randomizing the user agent per request can make a user more unique, not less unique. Fingerprint defense needs consistency per site/session and should not claim full anonymity.

3. The product scope is too wide.
   Browser, web-app launcher, WhatsApp spoofing, RSS reader, bookmarks, cloud sync, local AI, system dashboard, and future extensions are too much for an early codebase.

4. The build system is not release-ready.
   The project had development-mode webpack settings only, no verification script, no typecheck command, no tests, and no clear production build path.

5. Security-critical actions need tighter boundaries.
   Browser projects must treat IPC, local command execution, storage, sync, and permissions as dangerous surfaces.

6. The documentation sounds more finished than the code.
   The README should tell contributors what exists, what is experimental, and what still needs proof.

## Product direction

Position Zen Browser as:

> A Linux-first desktop browser shell for controlled web apps, practical privacy, and local-first AI assistance.

Do not position it as:

- a Chrome replacement yet
- a Firefox replacement
- an anonymity browser
- a hardened security browser
- a finished privacy product

## Version names

Use plain version names. Avoid mythological, over-technical, or AI-generated sounding names.

Recommended naming:

- v0.1 Foundation
- v0.2 Stable Tabs
- v0.3 Web Apps
- v0.4 Privacy Controls
- v0.5 Local Assistant
- v0.6 Sync
- v0.7 Packaging
- v1.0 Daily Driver

## v0.1 Foundation

Goal: make the repo honest, buildable, and easier to continue.

Required:

- clear README
- production/development build split
- typecheck script
- verification script
- remove forced devtools in production
- remove unsafe default start flag
- document known weak spots
- create a small issue roadmap

## v0.2 Stable Tabs

Goal: make normal browsing reliable.

Required:

- stable tab restore
- correct active tab persistence
- crash recovery
- loading/error states
- navigation state updates
- title/favicon handling
- memory cleanup after closing tabs

## v0.3 Web Apps

Goal: make Zen useful even before it becomes a full browser.

Required:

- app profiles with isolated partitions
- WhatsApp app profile
- GitHub app profile
- ChatGPT app profile
- Proton Mail app profile
- per-app permissions
- visible session reset button per app

## v0.4 Privacy Controls

Goal: ship practical privacy without fake claims.

Required:

- use maintained filter lists or import compatible host lists
- show blocked request count
- per-site allowlist
- consistent user agent mode instead of per-request random mode
- HTTPS upgrade with fallback if the site breaks
- storage encryption status warning
- remove claims that are not implemented

## v0.5 Local Assistant

Goal: make the assistant useful but bounded.

Required:

- gateway status check
- model/provider settings
- streaming responses
- current page summary through explicit user action
- no hidden page scraping without user consent
- clear warning when cloud providers are used

## v0.6 Sync

Goal: sync only what is safe and explainable.

Required:

- sync tabs/settings/bookmarks only
- never sync cookies/passwords/session tokens by default
- conflict handling
- last synced timestamp
- manual export/import fallback

## v0.7 Packaging

Goal: make it installable.

Required:

- AppImage build
- .deb build
- icon assets
- desktop entry
- update instructions
- release checklist

## v1.0 Daily Driver

Only call it v1.0 when it can survive daily use.

Required:

- no critical startup crashes
- reliable browsing
- reliable app profiles
- tested data wipe/export
- basic automated tests
- packaging works on a clean Ubuntu machine
- privacy documentation matches behavior

## Immediate next patches

1. Fix main process development behavior.
2. Move RSS fetching to the main process to remove third-party proxy dependency.
3. Add a privacy status panel showing what is actually active.
4. Add a history page.
5. Add a download manager.
6. Add test coverage for storage and URL filtering.
7. Replace fingerprint randomization with stable browser profiles.
