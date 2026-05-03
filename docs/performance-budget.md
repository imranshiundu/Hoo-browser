# Hoo Performance Budget

Hoo must treat speed, memory, and data usage as product requirements.

Because Hoo is Electron-based, it must be disciplined. Electron gives cross-platform reach, but it can become heavy if the app loads too many panels, background services, animations, sync tasks, or AI processes at startup.

## Product rule

Hoo should be:

> control-heavy, resource-light.

That means users get privacy controls, isolated web apps, encrypted local data, downloads, permissions, session restore, and safety tools without Hoo running unnecessary background work.

## Hard targets

These are budgets, not marketing claims.

| Area | Target |
| --- | --- |
| Cold startup | under 2.5s on a normal laptop |
| Warm startup | under 1.2s |
| New tab shell overhead | under 200ms |
| Search submit overhead | under 200ms before navigation starts |
| Idle CPU | near 0% |
| Idle network | 0 requests except user action or scheduled update/filter tasks |
| First-launch memory | aim for 250–350MB or less where possible |
| Background tabs | throttled first, later suspended safely |
| AI | off by default |
| Sync | off unless user enables it |
| Update checks | manual plus 7-day timer only |

Do not claim Hoo is faster than another browser until there is a repeatable benchmark.

## Lightweight design rules

### 1. Lazy-load panels

Do not load all features during startup.

Load immediately:

- shell
- home/new tab
- active browser view
- minimal settings

Load only when opened:

- downloads
- RSS
- bookmarks
- privacy dashboard
- performance dashboard
- sync
- OpenClaw/AI
- extensions/plugins

### 2. No always-on AI

AI must not start when the browser starts.

Rules:

- no background AI worker by default
- no page scraping without explicit user action
- no polling
- no provider calls during startup

### 3. Network silence

Hoo should be quiet unless the user or a scheduled maintenance task asks for network access.

Allowed background network:

- update check from the button
- 7-day updater timer
- privacy filter list refresh when implemented
- sync only if enabled

### 4. Low Data Mode

Low Data Mode should reduce unnecessary traffic.

Default behavior when enabled:

- block trackers
- block prefetch/prerender hints where possible
- block autoplay-heavy behavior where possible
- optionally block third-party fonts
- optionally block large third-party media
- warn before large downloads

### 5. Efficient storage

Do not rewrite large encrypted blobs for every small UI change.

Near-term:

- debounce session saves
- cap stored downloads and crashed tabs
- avoid frequent full-history writes

Long-term:

- use a proper encrypted profile vault with smaller records

### 6. Background tab lifecycle

Near-term:

- track active/idle/background tabs
- keep only active BrowserView visible
- avoid rendering hidden Hoo panels

Later:

- safe tab suspend/freezing
- restore-on-focus
- never suspend active audio/video/download tabs

## Metrics Hoo should show

The Performance panel should expose:

- startup time
- memory usage
- CPU/load estimate
- active browser tabs
- background browser tabs
- downloads stored
- crashed tabs stored
- storage size
- estimated network requests
- estimated received bytes
- encryption availability
- low-data mode status

## Release gate

Before a release is called stable:

- `npm run verify` must pass
- Linux AppImage must open on a clean machine
- deb package must install and launch from the app menu
- startup time must be measured
- memory must be measured
- idle network must be checked
- browser must not start AI/sync by default
