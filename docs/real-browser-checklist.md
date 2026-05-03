# What Makes Zen a Real Browser

A real browser is not just an app that opens websites. A real browser is a complete trust system around the web engine.

Zen can become real, but it has to earn that label through reliability, security, and daily-use features.

## Minimum real-browser requirements

### 1. Rendering engine

Zen uses Chromium through Electron. That means it can render modern sites, run JavaScript, play media, and load complex web apps.

This is real browser capability, but it comes with Electron overhead and must be handled carefully.

### 2. Navigation

Required:

- address bar
- search bar
- back, forward, reload
- safe URL parsing
- search fallback when text is not a URL
- visible loading and error states
- blocked-page screen for unsafe URLs

### 3. Search identity

Zen should be DuckDuckGo-first.

Default:

- DuckDuckGo as the main search engine
- Startpage and Qwant as privacy alternatives
- Google available only as a user-selected fallback

The home page should visually make DuckDuckGo the main search path, not just one option in a row.

### 4. Tabs and sessions

Required:

- create tab
- close tab
- restore tabs after restart
- persist active tab
- recover from crashed tabs
- clean memory after close
- avoid duplicate restored tabs
- app tabs separated from normal browsing tabs

### 5. Web app profiles

This is where Zen can be useful quickly.

Required app profiles:

- WhatsApp
- GitHub
- ChatGPT
- Proton Mail
- Spotify or YouTube alternative

Each app should have:

- isolated storage partition
- clear permission rules
- reset session button
- visible app identity
- optional pinned status

WhatsApp can be one of Zen's strongest reasons to exist on Linux, but it should be treated as an app profile, not the entire browser identity.

### 6. Permissions

A real browser must control access to:

- camera
- microphone
- location
- notifications
- clipboard
- downloads
- external links

Zen should never silently grant broad permissions. App profiles can have special rules, but those rules must be visible to the user.

### 7. Downloads

Required:

- download prompt or default folder
- progress state
- cancel/retry
- open downloaded file
- show completed downloads
- protect against suspicious file types with warnings

### 8. History and bookmarks

Required:

- searchable history
- clear history
- configurable retention
- bookmarks with folders
- import/export bookmarks
- local encrypted storage where available

### 9. Privacy controls

Required:

- maintained filter lists or imported host lists
- blocked request count
- per-site allowlist
- HTTPS upgrade with fallback
- stable privacy profile instead of random user-agent per request
- clear explanation of what each setting does and does not do

Zen should never claim anonymity. Practical privacy is good. Fake privacy claims destroy trust.

### 10. Encryption

Encryption should protect local user data and synced data. It should not be marketing decoration.

Required:

- local profile encryption when OS keychain support exists
- visible encryption status
- warning when local encryption is unavailable
- export backup encryption with user passphrase
- optional sync encryption before upload
- no syncing of cookies, passwords, or session tokens by default

### 11. AI assistant

Required:

- explicit user action before page content is sent to any model
- local gateway support
- clear cloud-provider warning when cloud models are used
- streaming responses
- no hidden page scraping
- no silent telemetry

### 12. Updates and packaging

Required:

- AppImage or deb package
- icon and desktop entry
- release notes
- update instructions
- clean production build
- no forced developer tools in release mode

## What Zen should become first

Zen should become a reliable Linux web-app browser before trying to become a full mainstream browser replacement.

The first serious use case:

> Open Zen, search privately with DuckDuckGo, run WhatsApp/GitHub/ChatGPT/Proton in clean isolated profiles, keep local data controlled, and optionally use a local AI assistant.

That is useful. That is believable. That is buildable.

## What must be removed from public-facing code/docs

- personal machine paths
- private folder structures
- exaggerated privacy claims
- fake blocked-count numbers
- claims that imply full anonymity
- hard-coded local developer assumptions

Use generic paths only, such as:

```text
~/.config/zen-browser
/path/to/openclaw/docker-compose.yml
```
