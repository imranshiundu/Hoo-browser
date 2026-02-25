# Zen Browser

An open-source, privacy-first desktop web browser built on Electron. Zen Browser is designed to give Linux and power users a browser that is honest about what it does: blocking ads at the network level, protecting your fingerprint, forcing encrypted connections, giving you full control of your privacy settings, and integrating an AI assistant without sending your data to unknown third parties.

This project is open to anyone. Fork it. Break it. Improve it. Submit pull requests. The more people who contribute, the better this gets.

---

## Table of Contents

1. [The Original Idea](#the-original-idea)
2. [What This Browser Actually Is](#what-this-browser-actually-is)
3. [Feature List](#feature-list)
4. [WhatsApp on Linux: The Problem and the Solution](#whatsapp-on-linux-the-problem-and-the-solution)
5. [OpenClaw AI Integration](#openclaw-ai-integration)
6. [Cloud Sync with MEGA](#cloud-sync-with-mega)
7. [Privacy Architecture](#privacy-architecture)
8. [Getting Started](#getting-started)
9. [Running OpenClaw](#running-openclaw)
10. [Project Structure](#project-structure)
11. [Contributing](#contributing)
12. [Known Limitations and Roadmap](#known-limitations-and-roadmap)
13. [License](#license)

---

## The Original Idea

Most browsers are built around a business model. Google Chrome exists to feed Google's advertising network. Microsoft Edge exists to push Microsoft services. Even some privacy-focused browsers have commercial incentives that eventually shape their decisions.

The original idea for Zen Browser was to build something that has no such incentive. A browser where the code is in front of you, where every privacy feature is visible and toggleable and explained, and where integrating an AI assistant does not mean routing your conversations through a Silicon Valley server farm.

The specific problems this browser was designed to address:

1. Linux users are treated as second-class citizens by web services. WhatsApp Web does not offer video calls on Linux because it detects the operating system and removes the feature. This is not a technical limitation. Chromium on Linux is fully capable of video calls. It is a deliberate product decision. This browser works around it.

2. AI assistants in browsers are typically either cloud-only (your data leaves your machine) or non-existent. This browser integrates OpenClaw, a self-hosted AI gateway that can run entirely on your own hardware.

3. Privacy settings in most browsers are buried, vague, and often ineffective. This browser exposes every privacy control on a dedicated screen with plain-language descriptions of what each setting does.

4. Cross-device sync in other browsers requires creating an account with the browser vendor. This browser uses your own MEGA cloud storage, which you control.

---

## What This Browser Actually Is

Zen Browser is an Electron application. That means it runs the Chromium rendering engine inside a Node.js application shell. It is not a fork of Firefox or a Chromium extension. It is a custom application that uses Chromium's web rendering capabilities while giving you full control over the surrounding environment.

When you browse a website in Zen Browser, the web page is rendered by the same engine that powers Google Chrome. The difference is everything that happens before and around that rendering: request blocking, user-agent handling, session isolation, and the shell you see on screen.

This is a trade-off worth understanding. Being Electron-based means:
- Memory usage is higher than a native browser. Electron loads a full Chromium instance.
- You get fine-grained control over network requests in a way that pure browser extensions cannot achieve.
- The privacy features operate at the application layer, not the extension layer, which means they cannot be disabled by a website.

---

## Feature List

### Core Browsing
- Full Chromium rendering engine via Electron's BrowserView
- Unlimited tabs with persistent state across restarts
- Tab titles, favicons, and URLs persist between sessions
- Back, forward, and reload navigation
- Split-screen mode: two tabs side by side simultaneously
- Keyboard shortcut to open the command palette (Ctrl+K or Ctrl+L)
- Custom new tab home page with clock, search bar, and speed dial links

### Search Engines
- DuckDuckGo (default, private)
- Startpage (Google proxied, private)
- Qwant (EU-based, private)
- Google (when needed)
- Switch engines per-session from the home screen

### Privacy and Security
- Network-level ad and tracker blocking using a host blocklist (Ad Shield)
- Browser fingerprint randomization that changes the User-Agent header on every request (Fingerprint Cloak)
- Automatic HTTP to HTTPS upgrade for all requests (Force HTTPS)
- JavaScript blocking mode for maximum script isolation (Script Fortress)
- WhatsApp Windows environment spoofing to unlock video calls on Linux (Deep Spoof)
- All privacy settings are toggleable from the Security screen and take effect immediately without restarting
- History retention with configurable window: 24 hours, 7 days, 30 days, or forever

### Web Apps
The Apps section launches a curated set of web services in isolated, persistent sessions:
- WhatsApp Web (with Windows spoof, enabling video calls on Linux)
- Netflix
- Spotify
- GitHub
- ChatGPT
Each app uses its own browser partition, so your WhatsApp session is completely separate from your normal browsing session. Cookies, local storage, and site data do not bleed between partitions.

### AI Assistant: OpenClaw
- Integrated AI panel that slides in from the sidebar
- Connects to your own locally-running OpenClaw gateway (runs on localhost:3008)
- The AI is told what page you are currently viewing, its title, and URL so it can answer questions about it
- One-click actions: Summarize page, Key points, Explain simply
- If OpenClaw is not running, the panel shows its status and gives you a Start button that launches the Docker container
- The AI never phones home to a third party unless OpenClaw itself is configured to do so on your behalf
- Context updates automatically when you switch tabs

### Reader: Live RSS
- Fetches live articles from Hacker News, Ars Technica, The Register, Wired, and Linux Today
- Click any article to open it in a browser tab
- Filter by source
- Refresh on demand

### Library: Bookmarks
- Add and delete bookmarks
- Organize bookmarks into folders: General, Work, Research, Tech, Media
- Search across all bookmarks by title or URL
- Favicons loaded automatically
- Stored in local storage, persists across restarts

### Dashboard
- Live CPU usage percentage
- Live RAM usage in GB with a visual bar
- Local browser storage usage
- Secure scratchpad that auto-saves to local storage (not synced, not sent anywhere)
- Quick access buttons to GitHub, Reddit, ProtonMail, Discord

### Sync: MEGA Cloud Storage
- Optional cloud sync of your browser profile using your own MEGA.nz account
- Your data is encrypted before upload using MEGA's own client-side encryption
- Auto-syncs every 5 minutes when logged in
- Upload includes tabs, history, and settings
- No Zen-controlled servers. Your data goes from your machine to your MEGA account.

### Window Controls
- Frameless window with custom title bar
- Minimize, maximize, and close
- Sidebar collapse/expand toggle
- The sidebar can run collapsed (icon-only) to give maximum browsing space

---

## WhatsApp on Linux: The Problem and the Solution

WhatsApp Web at web.whatsapp.com serves different JavaScript depending on the browser and operating system it detects. On Linux browsers, WhatsApp disables the video call UI. This is not a Chromium limitation. It is detected and enforced by WhatsApp's JavaScript, which checks `navigator.platform` and the `User-Agent` header.

Zen Browser solves this with a two-layer spoof:

Layer 1 is at the HTTP header level. When any request is made to web.whatsapp.com, the outgoing `User-Agent` header is replaced with a Windows Chrome Electron string before the request leaves your machine:

```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) WhatsApp/2.24.4.78 Chrome/120.0.6099.225 Electron/30.0.0 Safari/537.36
```

This happens in `src/main/main.ts` inside the `onBeforeSendHeaders` hook, which intercepts every HTTP request. The replacement is exact and happens before any JavaScript on the page can affect it.

Layer 2 is at the JavaScript level. When WhatsApp navigates, a script is injected that overrides `navigator.platform` to return `Win32` and overrides `navigator.userAgent` to return the Windows string. This ensures that WhatsApp's own JavaScript, even after the page has loaded, sees a consistent Windows environment.

Camera and microphone permissions are automatically granted to WhatsApp without prompting, which is required for video calls to function.

To use this:
1. Open the Apps section in the sidebar
2. Click WhatsApp
3. Scan the QR code as usual
4. The video call button should now appear in conversations

If it does not work, check that Deep Spoof is enabled in the Security section.

---

## OpenClaw AI Integration

OpenClaw is an open-source AI gateway that can be self-hosted. It supports multiple AI backends including Google Gemini, NVIDIA, and Claude. The Zen Browser integration treats OpenClaw as a local service and communicates with it over HTTP on localhost.

### Architecture

The OpenClaw gateway runs as a Docker container, typically at port 3008. The Zen Browser's main process can start or stop this container. The renderer process (the browser UI) communicates with the gateway directly using the Fetch API since it is connecting to localhost.

When you open the OpenClaw panel:
1. The panel immediately checks if the gateway is reachable at http://localhost:3008/health
2. The status indicator shows green (online), amber (checking), or red (offline)
3. If offline, a Start button calls an IPC handler in the main process which runs the appropriate Docker command
4. When you send a message, the current page's URL and title are included in the system prompt sent to the AI
5. The AI can therefore see what you are reading and answer questions about it

### What the AI knows
When you are browsing web.whatsapp.com and ask the AI a question, the system prompt includes: "The user is currently viewing: WhatsApp Web at https://web.whatsapp.com". The AI uses this to provide contextually relevant answers.

### Running OpenClaw (see full section below)

---

## Running OpenClaw

OpenClaw requires Docker. You need to have Docker installed and your user added to the docker group.

### Step 1: Get OpenClaw

OpenClaw is located at https://github.com/openclaw/openclaw (check their repository for the latest instructions). You can also use a local build.

### Step 2: Create your environment file

Navigate to where OpenClaw's docker-compose.yml is located and create an environment file. You need at minimum a Google API key (free tier from Google AI Studio) to use the Gemini model:

```
OPENCLAW_GATEWAY_TOKEN=your-token-here
GOOGLE_API_KEY=your-key-here
OPENCLAW_CONFIG_DIR=/home/youruser/.openclaw/config
OPENCLAW_WORKSPACE_DIR=/home/youruser/.openclaw/workspace
```

### Step 3: Start the gateway

```bash
docker compose up -d openclaw-gateway
```

The gateway will be available at http://localhost:3008.

### Step 4: Verify it is running

```bash
curl http://localhost:3008/health
```

If you see a 200 OK response, OpenClaw is running and the Zen Browser panel will connect to it.

### From inside Zen Browser

If OpenClaw is not running, open the OpenClaw panel (Bot icon in the sidebar) and click the Start button. This triggers the main process to run the Docker command for you. The status indicator will turn green once the container is ready (this may take a few seconds).

### Troubleshooting

If the status stays red:
- Check that Docker is running: `systemctl status docker`
- Check container logs: `docker logs openclaw-gateway`
- Make sure port 3008 is not blocked by a firewall
- Make sure your environment file has valid API keys

---

## Cloud Sync with MEGA

MEGA is an end-to-end encrypted cloud storage service. Zen Browser uses the `megajs` library to upload your local profile data to your MEGA account.

### What is synced

The sync uploads a single file called `user-data.json` to a folder named `ZenBrowserSync` in your MEGA account. This file contains:
- Open tab list and URLs
- Browsing history
- Privacy settings
- Active tab preference

Passwords are not synced. Cookies are not synced. Session data is not synced.

### How to set it up

1. Open Preferences (gear icon in the sidebar)
2. Find the MEGA.nz Cloud Sync section
3. Enter your MEGA email and password
4. Click Login

The browser will connect to MEGA, create the ZenBrowserSync folder if it does not exist, and upload your current profile. Sync runs automatically every 5 minutes after that.

### Security note

Your MEGA password is sent to MEGA's servers over HTTPS to authenticate. The `megajs` library handles this. Your data is encrypted on your machine before upload using MEGA's client-side encryption, which means MEGA's servers cannot read the content. If you use a two-factor-authenticated MEGA account, you will need an app password.

---

## Privacy Architecture

Understanding exactly what Zen Browser does and does not do to protect your privacy.

### What happens to your requests

Every outgoing HTTP and HTTPS request from a browser tab goes through the Electron session's `webRequest` API hooks before it leaves your machine. Zen Browser registers two hooks:

`onBeforeRequest`: This hook inspects the URL of every request. If Ad Shield is enabled, the URL is checked against a blocklist of known advertising, analytics, and tracking domains. If the URL matches, the request is cancelled before it is sent. The website never receives any signal that the request was blocked.

`onBeforeSendHeaders`: This hook inspects and modifies the HTTP headers of every request. If Fingerprint Cloak is enabled, the `User-Agent` header is replaced with a randomly selected one from a pool of common, real browser strings. If Deep Spoof is enabled and the request is going to WhatsApp, the User-Agent is replaced with the Windows WhatsApp string instead.

These hooks run at the main process level, not inside the web page. This means a website's JavaScript cannot detect or override them.

### What is stored locally

All browser state is stored in a single JSON file at:
```
~/.config/zen-browser/user-data.json
```
On Linux, this is typically:
```
~/.config/Electron/user-data.json
```

If Electron's `safeStorage` API is available (which it is on most modern Linux systems with a keyring), this file is encrypted using the system's secret service before being written to disk. The encryption uses the same mechanism as Chrome's "OS-level encryption" on Linux.

The scratchpad on the Dashboard is stored in the renderer process's `localStorage`, which Electron maps to a file in the user data directory as well. It is not in the main user-data.json.

### What leaves your machine

When you browse a website, HTTP requests go to that website's servers. This is unavoidable.

The RSS reader uses the `allorigins.win` CORS proxy to fetch RSS feeds from news sites. The proxy sees which feed URLs you are fetching.

When you use OpenClaw, your messages and the current page URL are sent to your locally-running OpenClaw gateway. What the gateway does with them depends on which AI backend you have configured. If you use Google Gemini, your message goes to Google's API. You are in control of this. If it concerns you, run a local model.

Favicons in the Bookmarks view are fetched from Google's favicon service (`https://www.google.com/s2/favicons`) using the domain of the bookmarked URL. Google sees which domains you have bookmarked. If this concerns you, the favicon loading can be removed from `src/renderer/views/BookmarksView.tsx`.

The MEGA sync sends your user-data.json to MEGA's servers, encrypted.

Nothing else leaves your machine. There are no analytics, no crash reports, no telemetry, no calls to any Zen Browser server because there is no Zen Browser server.

---

## Getting Started

### Requirements

- Node.js 18 or later
- npm 9 or later
- A Linux system (also works on macOS and Windows but the WhatsApp spoof is most relevant on Linux)
- Docker (optional, required for OpenClaw AI integration)

### Installation

Clone the repository:

```bash
git clone https://github.com/imranshiundu/zen-browser.git
cd zen-browser
```

Install dependencies:

```bash
npm install
```

Build the application:

```bash
npm run build
```

Start the browser:

```bash
npm start
```

Or do both in one command:

```bash
npm run dev:start
```

### Development mode with hot reload

For development, run the webpack watcher in one terminal:

```bash
npm run dev
```

Then in another terminal, start the Electron application:

```bash
npm start
```

When you change a source file, webpack rebuilds it. You can then press Ctrl+R in the browser window or use the reload option to pick up changes.

---

## Project Structure

```
zen-browser/
  src/
    main/
      main.ts           - Electron main process, IPC handlers, BrowserView management
      storage.ts        - Encrypted local storage read/write
      sync.ts           - MEGA cloud sync service
      auth.ts           - Google account authentication handlers
      privacy-filters.ts - Ad blocking host list and user agent rotation
    preload/
      preload.ts        - Secure bridge between renderer and main process using contextBridge
    renderer/
      App.tsx           - Root component, tab orchestration, OpenClaw panel toggle
      components/
        Sidebar.tsx     - Left navigation with tab list and utility menu
        TitleBar.tsx    - Frameless window controls
        TabStrip.tsx    - Browser tab bar shown above web content
        NavigationBar.tsx - Back, forward, reload, URL input
        SettingsModal.tsx - Privacy settings and MEGA sync UI
        OpenClawPanel.tsx - AI assistant panel with context-aware chat
      views/
        Home.tsx        - New tab home screen with clock, search, speed dial
        Dashboard.tsx   - System metrics, scratchpad, quick access
        Browser.tsx     - Wrapper for the BrowserView content area
        Apps.tsx        - Web app launcher with isolated sessions
        RSSView.tsx     - Live RSS reader (Hacker News, Ars Technica, Wired, etc.)
        BookmarksView.tsx - Bookmark manager with folders and search
        PrivacyView.tsx - Live privacy settings with descriptions
        ExtensionsView.tsx - Browser module overview
      electron.d.ts     - TypeScript types for the IPC bridge
      types.ts          - Shared TypeScript types
  package.json
  webpack.config.js
  tsconfig.json
```

---

## Contributing

This project is open source. Contributions of all kinds are welcome.

### How to contribute

1. Fork the repository on GitHub
2. Create a branch for your change: `git checkout -b my-feature`
3. Make your changes
4. Build and test: `npm run build && npm start`
5. Commit your changes with a clear message
6. Push to your fork and open a pull request

### What to work on

The following areas need the most work:

**RSS Reader improvements**: The reader currently uses a CORS proxy which adds a dependency on a third-party service. The main process could fetch RSS feeds directly using Node.js's `https` module and pass the parsed results to the renderer via IPC. This would remove the external dependency.

**Bookmarks**: Currently stored in `localStorage` which is tied to the renderer session. Moving bookmarks into the main process's `StorageService` would make them part of the encrypted user-data.json and sync-able with MEGA.

**History view**: There is history being tracked (visible in the storage data) but there is no UI to view or search it.

**Download manager**: Electron has a download manager API but it is not wired up. Files currently download through the default Electron behavior with no UI.

**Extensions**: The Extensions view currently shows a static list of built-in privacy modules. A real extension loader that imports Chrome extensions using Electron's extension API would be a significant but achievable addition.

**OpenClaw streaming**: The current API call waits for a complete response. OpenClaw's gateway supports streaming responses over SSE (Server-Sent Events). Wiring this up would make the AI responses feel much more responsive.

**Logo**: The project needs a proper logo. The current text-based Zen wordmark in the sidebar is a placeholder. A proper icon file would replace the default Electron icon in the window title bar and taskbar.

**Test coverage**: There are currently no automated tests. Adding tests for the storage service, the privacy filter URL matching, and the IPC handlers would make the project more maintainable.

### Code style

The project uses TypeScript throughout. Keep types explicit. Avoid `any` where a proper type is possible. The renderer uses React functional components with hooks. The main process is plain TypeScript using Electron's Node.js APIs.

There is no linter configuration yet. A PR adding ESLint with sensible defaults would be welcome.

---

## Known Limitations and Roadmap

### Current limitations

**Memory usage**: Because Zen Browser runs Chromium through Electron, it uses more memory than a native browser like Firefox. Each open tab is a BrowserView running in a shared Chromium process. This is similar to how Chrome works but the overhead of the Electron shell adds to it.

**No extensions from the Chrome Web Store**: While Electron supports loading Chrome extensions, there is no UI or mechanism to install them from the Chrome Web Store. Privacy-essential extensions like uBlock Origin cannot currently be added. The built-in Ad Shield covers the most common use case.

**WhatsApp video calls**: The Windows spoof works to display the video call UI. Whether calls fully connect depends on WhatsApp's server-side checks, which vary and change over time. Some users may find voice calls work but not video, or that they need to update to a new User-Agent string. The UA string can be changed in `src/main/main.ts` at the `WHATSAPP_UA` constant.

**OpenClaw Chat API endpoint**: The current integration posts to `/api/chat` on the OpenClaw gateway. The exact endpoint structure depends on the version of OpenClaw you are running. If your AI calls return errors, check the OpenClaw documentation for the correct endpoint and update `src/renderer/components/OpenClawPanel.tsx`.

**RSS CORS proxy**: The RSS feeds are fetched through `allorigins.win`. If this proxy is down or rate-limited, the RSS reader will fail. Moving feed fetching to the main process is the right long-term solution.

**Storage encryption falling back to plaintext**: On systems without a keyring daemon (some minimal Linux installs), `safeStorage.isEncryptionAvailable()` returns false and the user-data.json is stored as plaintext. A warning should be shown to the user in this case.

### Roadmap (not committed, ideas only)

- History view with search
- Download manager UI
- Password manager with local encryption
- Custom CSS injection per-site
- Vertical tab bar option
- Reader mode that strips page formatting for long articles
- Extension loader (unpacked Chrome extensions)
- Per-site granular settings (block scripts on some sites but not others)
- Tab grouping
- Session save and restore
- Dark/light mode toggle (currently dark only)

---

## License

This project is released under the MIT License. You can use it, copy it, modify it, and distribute it for any purpose, including commercial use, with or without changes. The only requirement is that the license notice is preserved.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

This project is not affiliated with, endorsed by, or connected to any company. It is an independent open-source project. If you decide to use it, you are responsible for your own browsing activity and any data you choose to sync or share.
