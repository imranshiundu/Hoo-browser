# Browser Hardening Phase 1

This phase moves Hoo from branded prototype toward usable browser.

## Priority

1. Download manager
2. Permission prompt UI
3. Crash recovery
4. Maintained privacy filter lists
5. Stronger session restore
6. Verified release builds
7. Windows packaging
8. Rust profile vault prototype

## Download manager

A browser must capture downloads from Chromium, choose a safe path, store download records, show progress in UI, and allow users to reveal completed files.

Implemented foundation:

- `src/main/download-manager.ts`
- download record storage model
- risky file hints for executable/installable files

Next:

- wire `setupDownloadManager()` into the main process
- expose downloads through preload
- add a Downloads view/panel

## Permission prompts

Hoo must not silently grant sensitive permissions. Required prompts:

- camera
- microphone
- notifications
- location
- clipboard

Required choices:

- allow once
- always allow for this site
- deny

WhatsApp can have compatibility handling, but the user should still see what is being granted.

## Crash recovery

Hoo needs to record crashed tab metadata and let users restore crashed tabs.

Needed Electron events:

- `render-process-gone`
- `unresponsive`
- `did-fail-load`

## Maintained privacy filter lists

The current blocker is not enough. Hoo should support downloaded maintained host/filter lists with:

- last update timestamp
- fallback built-in rules
- allowlist
- per-session blocked count

## Session restore

Current session restore is basic. It needs:

- URL validation
- duplicate prevention
- active tab restore
- crashed tab exclusion unless user chooses restore
- app profile isolation retained

## Release builds

Linux must be verified first:

- AppImage opens on clean Ubuntu/Linux Mint
- deb installs into app launcher
- icons display correctly
- update button behavior is documented

Then Windows:

- NSIS installer
- portable build
- Start Menu shortcut
- AppData profile location

Then macOS only after signing/notarization strategy is clear.
