# Hoo Lightweight Browser Engine Strategy

Hoo should not try to copy Safari, Brave, Firefox, and uBlock Origin blindly. It should study what they do well and adapt the principle into a realistic Electron/Chromium shell.

## Product target

Hoo should become:

> A quiet, low-data, privacy-first browser that loads less junk, sleeps heavy tabs, protects local data, and stays usable on old laptops.

Target machines:

- 16 GB RAM laptop such as ThinkPad T470: Hoo should handle 20 normal tabs if background tabs are lazy-restored/slept.
- 4 GB RAM laptop such as older Toshiba Satellite: Hoo should default to aggressive low-memory behavior and avoid loading many background tabs at once.

## What to copy from Safari

Safari feels light mainly because it is deeply integrated with macOS and WebKit. Hoo cannot copy that OS-level advantage while using Electron.

Principles to adapt:

- energy discipline
- fewer background services
- no unnecessary background networking
- efficient media behavior
- stable session restore
- simple UI that does not fight the page

Hoo implementation:

- keep AI/sync off by default
- lazy-load internal panels
- avoid animated wallpapers and expensive blur effects
- do not mount hidden React views
- throttle and later suspend background tabs

## What to copy from Brave

Brave feels fast because it blocks a lot of junk before it loads.

Principles to adapt:

- block third-party ads and trackers by default
- show what was blocked
- support aggressive mode
- update maintained filter lists
- allow site exceptions when sites break

Hoo implementation:

- built-in Hoo Shields
- maintained filter list updater
- uBlock-compatible static filter support where realistic
- per-site Shields menu
- strict mode and balanced mode
- blocked count per page

## What to copy from Firefox

Firefox privacy design is strong because it combines blocklists with storage isolation.

Principles to adapt:

- site-specific cookie/storage jars
- strict tracking protection mode
- container/profile isolation
- clear user controls

Hoo implementation:

- isolated app profiles for WhatsApp/Gmail/etc.
- per-site storage partitions where possible
- cookie controls in permissions UI
- strict tracking mode
- private sessions that do not persist history

## What to copy from uBlock Origin

uBlock Origin is respected because it is efficient and rule-based.

Principles to adapt:

- filter lists
- cosmetic filtering later
- scriptlet support only if safe and maintainable
- per-site allow/deny controls

Hoo implementation path:

1. Host/domain blocking first.
2. Static network filter syntax subset.
3. Per-site allowlist.
4. Cosmetic filters later.
5. Rust filter engine later if JS becomes too slow.

Do not depend only on Chrome extension APIs. Chromium Manifest V3 has limits for full-power ad blockers, so Hoo should build its own blocker in the main process first and add extensions later.

## Extensions policy

Hoo should support plugins/extensions carefully, not immediately as a full Chrome clone.

Phase 1:

- built-in Hoo Shields
- built-in download manager
- built-in permission prompts
- no third-party extensions by default

Phase 2:

- curated plugins only
- install one plugin at a time
- plugin permission review
- plugin disable/reset button

Phase 3:

- Chrome extension compatibility research
- uBlock Origin Lite or MV3-compatible extension support if feasible
- original uBlock Origin support only if the runtime can safely support it

Reason: extensions are one of the biggest sources of memory use, security risk, and weird browser behavior.

## Tab memory plan

Tabs are the main RAM problem.

### 16 GB RAM target

Hoo should support about 20 normal tabs by:

- loading only the active restored tab on startup
- keeping background restored tabs as URL/title placeholders
- throttling background tabs
- sleeping old tabs
- never sleeping audio/video/download tabs without warning
- allowing pinned web apps to opt out of sleep

### 4 GB RAM target

Hoo should enter low-memory behavior:

- load active tab only
- keep at most 3-5 live background tabs
- sleep everything idle after a shorter timeout
- show memory pressure warnings
- disable heavy wallpapers/animations
- turn Low Data Mode on by recommendation

## Lazy session restore

Bad behavior:

- reopening 20 tabs and loading all 20 pages immediately

Correct behavior:

- restore title and URL for every tab
- load only active tab
- when user clicks a background tab, load it then
- if tab was slept, show a lightweight restore screen first

This is the biggest single improvement for old laptops.

## Image and media loading

Hoo cannot rewrite every website's image pipeline, but it can reduce waste.

Near-term:

- block trackers and ad iframes that load heavy images/videos
- Low Data Mode can block heavy third-party media
- warn before large downloads
- use static optimized Hoo assets

Later:

- image compression proxy only if user opts in
- per-site data saver profile
- media autoplay controls
- lazy media restore for background tabs

Do not secretly proxy user traffic. That would create privacy and trust problems.

## Database and storage plan

Near-term:

- encrypted local JSON through safeStorage where available
- cap downloads/crashed tabs/history
- debounce writes
- avoid rewriting huge blobs too often

Medium-term:

- SQLite profile database
- smaller tables for tabs, history, downloads, permissions, shields stats
- WAL mode where safe
- scheduled cleanup/compaction

Long-term:

- Rust profile vault for encrypted records
- compressed backup/export format
- per-profile encryption keys

Compression should be used for backups and large archives, not constantly for every small setting write.

## GPU discipline

Avoid:

- animated wallpapers
- video backgrounds
- constant blur/backdrop-filter
- huge box shadows everywhere
- high-frequency JavaScript animations
- mounting every panel at once

Allowed:

- static owl wallpaper
- light CSS transitions
- simple cards
- one visible panel at a time

## Hoo modes

### Balanced Mode

Default. Blocks trackers and common ad junk without breaking many sites.

### Strict Mode

Blocks more third-party scripts/cookies/media. Sites may break.

### Low Data Mode

Blocks optional heavy resources, third-party fonts, heavy media, and background junk.

### Low Memory Mode

Sleeps tabs aggressively and avoids loading restored background tabs.

### Private Session

Does not persist history/session after close.

### Kill Switch

Wipes selected local data immediately.

## Immediate implementation order

1. Lazy session restore.
2. Sleeping tab placeholders.
3. Download manager UI.
4. Permission prompt UI.
5. Hoo Shields panel with maintained lists.
6. Cookie/storage controls.
7. Low-memory mode.
8. SQLite storage design.
9. Curated plugin system.
10. Rust filter/vault prototype.

## Non-negotiable rule

Hoo should never load a feature just because it exists.

Every feature must answer:

- Does it make browsing safer?
- Does it make browsing faster?
- Does it reduce data waste?
- Does it protect local data?
- Can it stay off until the user needs it?

If not, it should not be in startup path.
