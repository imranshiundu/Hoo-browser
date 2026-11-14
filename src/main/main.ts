import { app, BrowserWindow, BrowserView, ipcMain, session, Menu, shell, clipboard, dialog, screen, net } from "electron";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { exec } from "child_process";
import { shouldBlockRequest, getRandomUserAgent, isMaliciousUrl, stripJunkRequestHeaders, stripJunkResponseHeaders, isLikelyForcedRedirect, isHardBlockedHost, isExternalProtocol, isCompatibilityHost } from "./privacy-filters";
import { StorageService } from "./storage";
import { setupAuthHandlers } from "./auth";
import { MegaSyncService } from "./sync";
import { checkForAppUpdates, installAppUpdate, initAutoUpdater, shouldAutoCheckOnStartup, resolveUpdateChannel, hasSourceGitRepo } from "./update-service";
import { markWindowReady, trackNetworkRequest, trackNetworkBytes, getPerformanceSnapshot } from "./performance-monitor";
import { shouldBlockForLowData } from "./network-policy";
import { setupDownloadManager, openDownloadFolder } from "./download-manager";
import { setupBrowserContextMenu } from "./browser-context-menu";
import { createTabIdFactory, stepZoomFactor, zoomPercent, crashReasonLabel, reorderTabsByIds, clampWindowState } from "./tab-utils";
import { originFromUrl, decisionKey, describePermission, resolvePermissionDecision, permissionRows, withDecision, withoutDecision, DECIDABLE_PERMISSIONS } from "./permissions";
import { serializeNetscapeBookmarks, parseNetscapeBookmarks } from "./bookmarks-io";
import { zoomPercentToFactor } from "./zoom-store";
import { SuggestService } from "./suggest-service";

app.setName("Hoo Browser");

app.on('web-contents-created', (_event, contents): void => {
    contents.setWindowOpenHandler(({ url }): Electron.WindowOpenHandlerResponse => {
        if (isExternalProtocol(url)) {
            void shell.openExternal(url).catch((): undefined => undefined);
            return { action: 'deny' };
        }
        if (isHardBlockedHost(url)) return { action: 'deny' };
        return { action: 'deny' };
    });
});
if (process.env.HOO_USER_DATA_DIR) {
    app.setPath('userData', process.env.HOO_USER_DATA_DIR);
}
// One browser, one process. A second `hoo-browser` launch now focuses the
// existing window (and opens any URL passed on the command line) instead of
// starting a parallel browser with a second profile.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
}

function focusOrCreateWindow(urlToOpen?: string): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        if (urlToOpen) void openUrlInNewTabInternal(urlToOpen);
        return;
    }
    createWindow();
    if (urlToOpen) {
        mainWindow?.webContents.once('did-finish-load', (): void => {
            void openUrlInNewTabInternal(urlToOpen);
        });
    }
}

function urlFromArgv(argv: string[]): string | undefined {
    return argv.find(arg => /^https?:\/\//i.test(arg));
}

app.on('second-instance', (_event, argv): void => {
    focusOrCreateWindow(urlFromArgv(argv));
});
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-systemd-scope');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
app.commandLine.appendSwitch('disable-webrtc-hw-decoding');
app.commandLine.appendSwitch('disable-webrtc-hw-encoding');
app.commandLine.appendSwitch('disable-features', 'OptimizationHints,MediaRouter,AutofillServerCommunication,Translate,WebRTCAllowInputVolumeAdjustment');

let mainWindow: BrowserWindow | null = null;
const browserViews: Map<string, BrowserView> = new Map();
let activeTabId: string | null = null;
let splitTabId: string | null = null;
// Tab whose page took over the screen with HTML5 fullscreen (YouTube theater,
// video players). The shell hides its chrome while this tab is active.
let pageFullscreenTabId: string | null = null;
let manualBounds: { x: number, y: number, width: number, height: number } | null = null;
let openClawLoaded = false;

// Runtime per-tab state mirrored by the shell UI.
const nextTabId = createTabIdFactory();
const zoomByTab: Map<string, number> = new Map();
const audibleTabs: Set<string> = new Set();
const mutedTabs: Set<string> = new Set();

// Site permission prompts that are waiting for the user to click
// Allow/Block in the shell. Requests the user never answers are denied
// after two minutes so a forgotten bubble cannot pin renderer state.
const nextPermissionRequestId = createTabIdFactory();
interface PendingPermissionRequest {
    tabId: string;
    origin: string;
    permission: string;
    callback: (allowed: boolean) => void;
    timer: NodeJS.Timeout;
}
const pendingPermissionRequests = new Map<string, PendingPermissionRequest>();
const PERMISSION_PROMPT_TIMEOUT_MS = 120_000;

let persistentData = StorageService.load();

let privacySettings = {
    adShield: true,
    scriptFortress: false,
    fingerprintCloak: false,
    forceHttps: true,
    deepSpoof: persistentData.settings?.deepSpoof ?? true,
    lowDataMode: persistentData.settings?.lowDataMode ?? false,
    blockThirdPartyFonts: persistentData.settings?.blockThirdPartyFonts ?? false,
    blockAutoplayMedia: persistentData.settings?.blockAutoplayMedia ?? false,
    dataRetention: persistentData.settings?.dataRetention || 'forever',
    ...persistentData.settings
};

const WHATSAPP_UA = getRandomUserAgent();

function sendToShell(channel: string, ...args: unknown[]): void {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
}

function resolveAssetPath(...segments: string[]): string {
    const distAsset = path.join(__dirname, "../renderer", ...segments);
    if (fs.existsSync(distAsset)) return distAsset;
    const sourceAsset = path.join(__dirname, "../../src/renderer", ...segments);
    if (fs.existsSync(sourceAsset)) return sourceAsset;
    return distAsset;
}

function getPageUrlForRequest(details: any): string {
    return details?.webContents?.getURL?.() || details?.referrer || '';
}

function isHomeUrl(url?: string): boolean {
    return !url || url === 'about:blank' || url === 'hoo://home';
}

function getActiveView(): BrowserView | null {
    return activeTabId ? browserViews.get(activeTabId) || null : null;
}

function hideAllBrowserViews(): void {
    if (!mainWindow) return;
    browserViews.forEach((view): void => mainWindow!.removeBrowserView(view));
    activeTabId = null;
    splitTabId = null;
}

function setWindowTitle(title: string): void {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(title);
}

function showHomeForTab(tabId?: string): void {
    hideAllBrowserViews();
    setWindowTitle('New Tab - Hoo Browser');
    if (tabId) {
        const data = StorageService.load();
        const tab = data.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.url = 'about:blank';
            tab.title = tab.title || 'New Tab';
            tab.lastActiveAt = Date.now();
            StorageService.save({ tabs: data.tabs, activeTabId: tabId });
        }
    }
    sendToShell('switch-to-home', tabId);
}

function escapeHooHtml(value: string): string {
    return String(value || '').replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char] || char));
}

function cleanDisplayUrl(url: string): string {
    if (!url) return 'this page';
    if (isExternalProtocol(url)) return String(url).split(':', 1)[0] + ': link';
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return 'this page';
    }
}

function buildHooStatusPage(kind: 'error' | 'blocked', title: string, message: string, url: string): string {
    const owlPath = resolveAssetPath('assets/branding/hoo-app-icon.svg').replace(/\\/g, '/');
    const owl = fs.existsSync(owlPath) ? 'file://' + owlPath : '';
    const safeTitle = escapeHooHtml(title);
    const safeMessage = escapeHooHtml(message);
    const displayUrl = escapeHooHtml(cleanDisplayUrl(url));
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 25% 18%,rgba(255,102,0,.13),transparent 34%),linear-gradient(180deg,#070909,#020303);color:#f4f4f5;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;overflow:hidden}.wrap{width:min(620px,calc(100vw - 42px));text-align:center;padding:18px}.owl{width:106px;height:106px;border-radius:30px;object-fit:cover;margin:0 auto 18px;filter:drop-shadow(0 18px 35px rgba(255,102,0,.22))}.badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,102,0,.11);border:1px solid rgba(255,102,0,.22);color:#ffb36b;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px}body.blocked .badge{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.22);color:#86efac}h1{margin:0 0 10px;font-size:clamp(28px,4vw,46px);letter-spacing:-.05em;line-height:.98}p{margin:0 auto;color:#b8bec7;font-size:15px;line-height:1.65;max-width:520px}.url{margin:18px auto 0;color:#8b949e;font-size:13px;max-width:520px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:26px}button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:#fff;border-radius:14px;padding:11px 15px;font-weight:750;cursor:pointer}button.primary{background:#ff6a00;border-color:#ff6a00;color:#130800}.details{margin-top:18px;color:#747b86;font-size:12px}
</style></head><body class="${kind}"><main class="wrap">${owl ? `<img class="owl" src="${owl}" alt="Hoo owl">` : ''}<div class="badge">${kind === 'blocked' ? 'Hoo Shield' : 'Hoo'}</div><h1>${safeTitle}</h1><p>${safeMessage}</p><div class="url" title="${displayUrl}">${displayUrl}</div><div class="actions"><button class="primary" onclick="location.reload()">Refresh</button><button onclick="history.back()">Go back</button><button onclick="location.href='hoo://home'">Go home</button></div><div class="details">Hoo kept the browser alive instead of showing a blank or technical page.</div></main></body></html>`;
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function buildErrorPage(url: string, description: string): string {
    const message = description && !description.includes('ERR_') ? description : 'The page did not respond. Check your connection and refresh.';
    return buildHooStatusPage('error', 'Hoo could not open this page', message, url);
}

function buildBlockedPage(url: string, reason: string): string {
    return buildHooStatusPage('blocked', 'Hoo stopped a popup', reason || 'This site tried to open a suspicious new window.', url);
}

function blockNavigationIfUnsafe(tabId: string, view: BrowserView, event: Electron.Event, targetUrl: string, sourceUrl?: string): boolean {
    if (isExternalProtocol(targetUrl)) {
        event.preventDefault();
        void shell.openExternal(targetUrl).catch((): undefined => undefined);
        sendToShell('tab-loading-state', tabId, false, view.webContents.getURL());
        return true;
    }
    if (isHardBlockedHost(targetUrl) || isLikelyForcedRedirect(targetUrl, sourceUrl || view.webContents.getURL())) {
        event.preventDefault();
        sendToShell('tab-loading-state', tabId, false, view.webContents.getURL());
        void view.webContents.loadURL(buildBlockedPage(targetUrl, 'This site tried to open a suspicious redirect. Hoo stopped it.'));
        return true;
    }
    return false;
}

function injectSitePolish(view: BrowserView): void {
    try {
        const url = view.webContents.getURL();
        const css = `
            html, body { scrollbar-width: thin !important; }
            ::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
            ::-webkit-scrollbar-track { background: transparent !important; }
            ::-webkit-scrollbar-thumb { background: rgba(140,140,140,.28) !important; border-radius: 999px !important; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(180,180,180,.42) !important; }
            form[role="search"], [data-testid="searchbox"], .searchbox_searchbox__eaWKL { max-width: 820px !important; }
            ${url.includes('youtube.com') ? `
                ytd-comments, ytd-item-section-renderer#sections, ytd-watch-next-secondary-results-renderer,
                ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-merch-shelf-renderer,
                ytd-promoted-sparkles-web-renderer, ytd-popup-container, tp-yt-paper-dialog,
                ytd-mealbar-promo-renderer, ytd-companion-slot-renderer, ytd-ad-slot-renderer,
                .ytp-ce-element, .ytp-paid-content-overlay, #masthead-ad, #player-ads,
                #panels, #secondary, #chat, #related, #offer-module, #clarify-box { display: none !important; }
                ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: 1180px !important; margin: 0 auto !important; }
                ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: 4 !important; }
            ` : ''}
        `;
        void Promise.resolve((view.webContents.insertCSS as any)(css)).catch((): undefined => undefined);
        if (url.includes('youtube.com')) {
            void view.webContents.executeJavaScript(`
                (() => {
                    try {
                        const kill = () => {
                            document.querySelectorAll('video').forEach(v => { v.autoplay = false; });
                            document.querySelectorAll('ytd-comments,#comments,#secondary,#related,ytd-watch-next-secondary-results-renderer,ytd-reel-shelf-renderer,ytd-rich-section-renderer,ytd-popup-container,tp-yt-paper-dialog,ytd-mealbar-promo-renderer,ytd-ad-slot-renderer,#player-ads,#masthead-ad,#chat').forEach(el => el.remove());
                        };
                        kill();
                        new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true });
                    } catch (_) {}
                })();
            `).catch((): undefined => undefined);
        }
    } catch {
        // Site CSS injection is cosmetic; never break page loading for it.
    }
}

function sendNavState(tabId: string, view: BrowserView): void {
    try {
        const history = view.webContents.navigationHistory;
        sendToShell('nav-state-updated', tabId, history.canGoBack(), history.canGoForward());
    } catch {
        // A destroyed view can no longer report navigation state.
    }
}

function cleanupTabRuntimeState(tabId: string): void {
    zoomByTab.delete(tabId);
    audibleTabs.delete(tabId);
    mutedTabs.delete(tabId);
    // Closing the fullscreen tab restores the normal shell immediately.
    if (pageFullscreenTabId === tabId) {
        pageFullscreenTabId = null;
        sendToShell('page-fullscreen-changed', tabId, false);
    }
    // Deny any permission prompt the user never answered for this tab.
    pendingPermissionRequests.forEach((pending, requestId): void => {
        if (pending.tabId !== tabId) return;
        clearTimeout(pending.timer);
        pendingPermissionRequests.delete(requestId);
        try { pending.callback(false); } catch { /* callback is user code */ }
    });
}

function attachViewHandlers(tabId: string, view: BrowserView): void {
    view.setAutoResize({ width: true, height: true });
    view.webContents.setBackgroundThrottling(false);

    // Right-click menu for web pages: copy, search selection, open links,
    // save images. Without this a right click did literally nothing.
    setupBrowserContextMenu(view, {
        openUrlInNewTab: (url): void => { void openUrlInNewTabInternal(url); },
        openUrlInCurrentTab: (url): void => { void navigateTabInternal(tabId, url); }
    });

    view.webContents.setWindowOpenHandler((details): Electron.WindowOpenHandlerResponse => {
        const sourceUrl = view.webContents.getURL();
        if (isExternalProtocol(details.url)) {
            void shell.openExternal(details.url).catch((): undefined => undefined);
            return { action: 'deny' };
        }
        if (isHardBlockedHost(details.url) || isLikelyForcedRedirect(details.url, sourceUrl)) {
            sendToShell('tab-loading-state', tabId, false, sourceUrl);
            return { action: 'deny' };
        }
        if (details.disposition === 'foreground-tab' || details.disposition === 'background-tab' || details.disposition === 'new-window') {
            sendToShell('open-url-in-new-tab', details.url);
            return { action: 'deny' };
        }
        return { action: 'deny' };
    });

    view.webContents.session.setPermissionRequestHandler((webContents, permission, callback): void => {
        const url = webContents.getURL();
        const origin = originFromUrl(url);
        // Stored decisions answer instantly; the WhatsApp DeepSpoof media
        // exemption survives so calls keep working in compatibility mode.
        const resolution = resolvePermissionDecision(
            StorageService.load().sitePermissions || {},
            origin,
            permission,
            { deepSpoofWhatsappMedia: privacySettings.deepSpoof }
        );
        if (resolution !== 'ask') {
            callback(resolution === 'allow');
            return;
        }
        // Ask the user, like every real browser. The shell shows a bubble
        // anchored under the toolbar and replies over 'resolve-permission'.
        if (!mainWindow || mainWindow.isDestroyed() || !origin) {
            callback(false);
            return;
        }
        const requestId = nextPermissionRequestId();
        const timer = setTimeout((): void => {
            if (pendingPermissionRequests.delete(requestId)) callback(false);
        }, PERMISSION_PROMPT_TIMEOUT_MS);
        pendingPermissionRequests.set(requestId, { tabId, origin, permission, callback, timer });
        sendToShell('permission-request', {
            requestId,
            permission,
            origin,
            description: describePermission(permission)
        });
    });

    view.webContents.on('did-navigate', (_event, url): void => {
        // Re-apply the remembered zoom for this site on every main-frame
        // navigation; per-tab state alone lost the preference.
        const origin = originFromUrl(url);
        if (!origin) return;
        const percent = (StorageService.load().siteZooms || {})[origin];
        if (percent === undefined || percent === 100) return;
        const factor = zoomPercentToFactor(percent);
        view.webContents.setZoomFactor(factor);
        zoomByTab.set(tabId, factor);
        if (tabId === activeTabId) sendToShell('zoom-changed', tabId, Math.round(percent));
    });

    view.webContents.on('will-navigate', (event, targetUrl): void => {
        blockNavigationIfUnsafe(tabId, view, event, targetUrl);
    });

    view.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame): void => {
        if (isMainFrame && !isInPlace && blockNavigationIfUnsafe(tabId, view, event, url)) return;
        sendToShell('tab-loading-state', tabId, true, url);
        if (url.includes('web.whatsapp.com')) {
            view.webContents.setUserAgent(WHATSAPP_UA);
        } else {
            view.webContents.setUserAgent(getRandomUserAgent());
        }
    });

    view.webContents.on('did-finish-load', (): void => {
        injectSitePolish(view);
        const title = view.webContents.getTitle();
        const url = view.webContents.getURL();
        sendToShell('tab-loading-state', tabId, false, url);
        if (title) {
            sendToShell('tab-title-updated', tabId, title, url);
            if (tabId === activeTabId) setWindowTitle(`${title} - Hoo Browser`);
        }
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame): void => {
        sendToShell('tab-loading-state', tabId, false, validatedURL);
        sendToShell('tab-load-error', tabId, errorCode, errorDescription, validatedURL);
        if (!isMainFrame) return;
        if (errorCode === -3 || errorCode === -20 || errorCode === -27) return;
        if (validatedURL && !validatedURL.startsWith('data:')) {
            void view.webContents.loadURL(buildErrorPage(validatedURL, errorDescription));
        }
    });

    view.webContents.on('page-title-updated', (_event, title): void => {
        const url = view.webContents.getURL();
        sendToShell('tab-title-updated', tabId, title, url);
        const stData = StorageService.load();
        const targetTab = stData.tabs.find(t => t.id === tabId);
        if (targetTab) {
            targetTab.title = title;
            targetTab.url = url;
            StorageService.save({ tabs: stData.tabs });
        }
        if (tabId === activeTabId) setWindowTitle(`${title} - Hoo Browser`);
    });

    view.webContents.on('did-navigate', (): void => {
        sendNavState(tabId, view);
    });

    view.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame): void => {
        if (isMainFrame) sendNavState(tabId, view);
    });

    // Real favicons captured from the page itself. Tabs used to depend on a
    // Google favicon service, which leaked every visited domain and failed offline.
    // The URL is also persisted on the tab record so restarts keep tab identity.
    view.webContents.on('page-favicon-updated', (_event, favicons: string[]): void => {
        const icon = favicons && favicons.length ? favicons[favicons.length - 1] : '';
        if (icon && !icon.startsWith('data:')) {
            sendToShell('tab-favicon-updated', tabId, icon);
            const data = StorageService.load();
            const record = data.tabs.find(t => t.id === tabId);
            if (record && record.favicon !== icon) {
                record.favicon = icon;
                StorageService.save({ tabs: data.tabs });
            }
        }
    });

    view.webContents.on('audio-state-changed', (event): void => {
        const audible = event.audible;
        if (audible) audibleTabs.add(tabId);
        else audibleTabs.delete(tabId);
        sendToShell('tab-audio-updated', tabId, audible, mutedTabs.has(tabId));
    });

    // Link hover preview in the shell's corner overlay.
    view.webContents.on('update-target-url', (_event, url: string): void => {
        if (tabId === activeTabId) sendToShell('page-target-url', url || '');
    });

    // HTML5 fullscreen (YouTube's theater button, video players, games). The
    // shell collapses its own chrome in response and shows the Firefox-style
    // "<site> is now full screen" banner with an Exit button.
    view.webContents.on('enter-html-full-screen', (): void => {
        pageFullscreenTabId = tabId;
        sendToShell('page-fullscreen-changed', tabId, true);
    });
    view.webContents.on('leave-html-full-screen', (): void => {
        if (pageFullscreenTabId === tabId) pageFullscreenTabId = null;
        sendToShell('page-fullscreen-changed', tabId, false);
    });

    // A crashed renderer used to leave a silent blank rectangle.
    view.webContents.on('render-process-gone', (_event, details): void => {
        audibleTabs.delete(tabId);
        mutedTabs.delete(tabId);
        sendToShell('tab-loading-state', tabId, false, view.webContents.getURL());
        const url = view.webContents.getURL();
        StorageService.recordCrashedTab({
            id: nextTabId(),
            tabId,
            url,
            title: view.webContents.getTitle() || 'Tab crashed',
            reason: details.reason,
            exitCode: details.exitCode,
            crashedAt: Date.now()
        });
        StorageService.markTabLifecycle(tabId, 'crashed');
        sendToShell('tab-load-error', tabId, -1, details.reason, url);
        if (!url.startsWith('data:') && !isHomeUrl(url)) {
            void view.webContents.loadURL(buildErrorPage(url, `${crashReasonLabel(details.reason)} Hoo kept the tab so you can reload it.`));
        }
    });

    // Sites with a beforeunload guard (unsaved forms) now ask instead of silently discarding.
    view.webContents.on('will-prevent-unload', (event): void => {
        void dialog.showMessageBox(mainWindow!, {
            type: 'question',
            buttons: ['Leave', 'Stay'],
            defaultId: 1,
            cancelId: 1,
            message: 'Leave this site?',
            detail: 'Changes you made on this page may not be saved.'
        }).then(({ response }): void => {
            if (response === 0) event.preventDefault();
        }).catch((): undefined => undefined);
    });

    view.webContents.on('found-in-page', (_event, result): void => {
        sendToShell('find-result', tabId, result.activeMatchOrdinal, result.matches);
    });
}

function restoreTabs(): void {
    if (!persistentData.tabs) return;
    const tabs = [...persistentData.tabs].sort((a: any, b: any) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
    const activeRestoreId = persistentData.activeTabId || tabs.find((tab: any) => tab.type === 'browser')?.id;

    tabs.forEach((tab: any): void => {
        if (tab.type !== 'browser' || tab.id !== activeRestoreId || isHomeUrl(tab.url)) return;
        // Skip tabs whose view already exists (macOS activate can call this again).
        if (browserViews.has(tab.id)) return;
        const view = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                partition: tab.partition ? `persist:${tab.partition}` : undefined,
                sandbox: false,
                backgroundThrottling: false,
            }
        });
        browserViews.set(tab.id, view);
        applyPrivacyToSession(view.webContents.session);
        attachViewHandlers(tab.id, view);
        void view.webContents.loadURL(tab.url);
    });
}

// ---- Window state persistence -------------------------------------------
// Browsers reopen at the size/position you left them. State is debounced so
// live-dragging a window does not hammer the profile file.

let windowStateSaveTimer: NodeJS.Timeout | null = null;

function scheduleWindowStateSave(): void {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = setTimeout((): void => {
        windowStateSaveTimer = null;
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const fullscreen = mainWindow.isFullScreen();
        const bounds = fullscreen ? mainWindow.getNormalBounds() : mainWindow.getBounds();
        StorageService.save({
            windowState: {
                bounds,
                maximized: mainWindow.isMaximized(),
                fullscreen
            }
        });
    }, 350);
}

function restoreWindowStateOptions(): Electron.BrowserWindowConstructorOptions {
    const saved = clampWindowState(StorageService.load().windowState, screen.getAllDisplays());
    const bounds = saved.bounds || {};
    return {
        width: bounds.width || 1400,
        height: bounds.height || 800,
        x: bounds.x,
        y: bounds.y
    };
}

function createWindow(): void {
    if (!gotSingleInstanceLock) return;
    const restored = restoreWindowStateOptions();
    mainWindow = new BrowserWindow({
        height: restored.height,
        width: restored.width,
        x: restored.x,
        y: restored.y,
        frame: false,
        title: "Hoo Browser",
        icon: resolveAssetPath('assets/branding/hoo-app-icon.svg'),
        backgroundColor: "#0E1111",
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, "../preload/preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: false,
            sandbox: false,
            backgroundThrottling: false,
        },
    });
    mainWindow.setMaxListeners(40);
    if (StorageService.load().windowState?.maximized) mainWindow.maximize();
    if (StorageService.load().windowState?.fullscreen) mainWindow.setFullScreen(true);

    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    mainWindow.once('ready-to-show', markWindowReady);
    if (!app.isPackaged && process.env.HOO_OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools();

    setupPrivacyFilters();
    setupDownloadManager((): BrowserWindow | null => mainWindow);
    setupAppMenu();
    setupAuthHandlers(mainWindow);
    restoreTabs();

    mainWindow.on("closed", (): void => {
        mainWindow = null;
        browserViews.forEach((view): void => {
            if (!view.webContents.isDestroyed()) view.webContents.close();
        });
        browserViews.clear();
    });

    const triggerResize = (): void => {
        scheduleWindowStateSave();
        if (activeTabId) updateBrowserViewBounds();
    };
    mainWindow.on('resize', triggerResize);
    mainWindow.on('maximize', triggerResize);
    mainWindow.on('unmaximize', triggerResize);
    // F11 (OS fullscreen) drives the same immersive shell as HTML5 fullscreen:
    // chrome hides, and moving the pointer to the top edge slides it back down.
    mainWindow.on('enter-full-screen', (): void => { sendToShell('os-fullscreen-changed', true); scheduleWindowStateSave(); });
    mainWindow.on('leave-full-screen', (): void => { sendToShell('os-fullscreen-changed', false); scheduleWindowStateSave(); });
    mainWindow.on('close', scheduleWindowStateSave);
}

ipcMain.handle('hide-browser-view', async (): Promise<void> => {
    hideAllBrowserViews();
    manualBounds = null;
    setWindowTitle('New Tab - Hoo Browser');
});

// Exit button / Esc fallback for HTML5 fullscreen. userGesture=true because
// document.exitFullscreen() normally requires transient user activation.
ipcMain.handle('exit-page-fullscreen', async (_event, tabId?: string): Promise<void> => {
    const target = tabId || pageFullscreenTabId;
    const view = target ? browserViews.get(target) : undefined;
    if (view && !view.webContents.isDestroyed()) {
        await view.webContents.executeJavaScript(
            'if (document.fullscreenElement) document.exitFullscreen();',
            true
        ).catch((): undefined => undefined);
    }
    if (pageFullscreenTabId) {
        const exited = pageFullscreenTabId;
        pageFullscreenTabId = null;
        sendToShell('page-fullscreen-changed', exited, false);
    }
});

ipcMain.handle('toggle-os-fullscreen', async (): Promise<void> => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.handle('update-view-bounds', async (_event, bounds: { x: number, y: number, width: number, height: number }): Promise<void> => {
    manualBounds = {
        x: Math.max(0, Math.floor(bounds.x)),
        y: Math.max(0, Math.floor(bounds.y)),
        width: Math.max(100, Math.floor(bounds.width)),
        height: Math.max(100, Math.floor(bounds.height))
    };
    updateBrowserViewBounds();
});

ipcMain.handle('window-minimize', async (): Promise<void> => { mainWindow?.minimize(); });
ipcMain.handle('window-maximize', async (): Promise<void> => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.handle('window-close', async (): Promise<void> => { mainWindow?.close(); });
ipcMain.handle('window-reload', async (): Promise<void> => { mainWindow?.webContents.reloadIgnoringCache(); });
ipcMain.handle('check-for-updates', async (): Promise<any> => checkForAppUpdates());
ipcMain.handle('install-app-update', async (): Promise<{ ok: boolean; message: string }> => installAppUpdate());
ipcMain.handle('get-update-channel', async (): Promise<{ channel: string; isPackaged: boolean }> => ({
    channel: resolveUpdateChannel({ isPackaged: app.isPackaged, hasGitRepo: hasSourceGitRepo() }),
    isPackaged: app.isPackaged
}));

ipcMain.handle('get-performance-snapshot', async (): Promise<any> => getPerformanceSnapshot({
    mainWindow,
    activeBrowserViews: activeTabId ? 1 + (splitTabId ? 1 : 0) : 0,
    totalBrowserViews: browserViews.size,
    lowDataMode: !!privacySettings.lowDataMode,
    aiLoaded: openClawLoaded
}));

function applyPrivacyToSession(ses: Electron.Session): void {
    const filter = { urls: ['<all_urls>'] };

    ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin): boolean => {
        // Synchronous checks (navigator.permissions.query) answer from the
        // stored decisions only — they can never prompt. Unknown requests
        // report as available so the page triggers a real request, which
        // our request handler turns into a visible prompt instead of the
        // old unconditional "yes to every media query" hole.
        const origin = originFromUrl(requestingOrigin);
        if (origin) {
            const stored = (StorageService.load().sitePermissions || {})[decisionKey(origin, permission)];
            if (stored === 'block') return false;
            if (stored === 'allow') return true;
        }
        return permission === 'media' || permission === 'geolocation' || permission === 'notifications' || (permission as string) === 'display-capture';
    });

    ses.webRequest.onBeforeRequest(filter, (details, callback): void => {
        trackNetworkRequest();
        const lowDataDecision = shouldBlockForLowData(details.url, details.resourceType, privacySettings);
        if (lowDataDecision.block) return callback({ cancel: true });
        if (privacySettings.adShield && shouldBlockRequest(details.url, details.resourceType)) return callback({ cancel: true });
        if (privacySettings.forceHttps && details.url.startsWith('http://')) return callback({ redirectURL: details.url.replace('http://', 'https://') });
        callback({ cancel: false });
    });

    ses.webRequest.onHeadersReceived(filter, (details, callback): void => {
        const responseHeadersIn = details.responseHeaders as unknown as Record<string, string[] | undefined> | undefined;
        const lengthHeader = responseHeadersIn?.['content-length'] || responseHeadersIn?.['Content-Length'];
        const lengthValue = Array.isArray(lengthHeader) ? Number(lengthHeader[0]) : Number(lengthHeader);
        trackNetworkBytes(lengthValue);
        const responseHeaders = stripJunkResponseHeaders(responseHeadersIn, details.url, getPageUrlForRequest(details));
        (callback as any)({ responseHeaders });
    });

    ses.webRequest.onBeforeSendHeaders(filter, (details, callback): void => {
        const headersIn = details.requestHeaders as unknown as Record<string, string | string[] | undefined>;
        const requestHeaders = stripJunkRequestHeaders(headersIn, details.url, getPageUrlForRequest(details));
        if (!isCompatibilityHost(details.url) && !isCompatibilityHost(getPageUrlForRequest(details))) {
            requestHeaders['DNT'] = '1';
            requestHeaders['Sec-GPC'] = '1';
        }
        requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        requestHeaders['User-Agent'] = details.url.includes('web.whatsapp.com') ? WHATSAPP_UA : getRandomUserAgent();
        (callback as any)({ requestHeaders });
    });
}

function setupPrivacyFilters(): void {
    applyPrivacyToSession(session.defaultSession);
}

function updateBrowserViewBounds(): void {
    if (!mainWindow || !activeTabId) return;
    const content = mainWindow.getContentBounds();
    const bounds = manualBounds || { x: 0, y: 118, width: content.width, height: Math.max(100, content.height - 118) };
    const safeBounds = {
        x: Math.max(0, Math.floor(bounds.x)),
        y: Math.max(0, Math.floor(bounds.y)),
        width: Math.max(100, Math.floor(bounds.width)),
        height: Math.max(100, Math.floor(bounds.height))
    };
    if (activeTabId && splitTabId) {
        const view1 = browserViews.get(activeTabId);
        const view2 = browserViews.get(splitTabId);
        const splitWidth = Math.floor((safeBounds.width - 8) / 2);
        if (view1) view1.setBounds({ x: safeBounds.x, y: safeBounds.y, width: splitWidth, height: safeBounds.height });
        if (view2) view2.setBounds({ x: safeBounds.x + splitWidth + 8, y: safeBounds.y, width: splitWidth, height: safeBounds.height });
    } else {
        const view = browserViews.get(activeTabId);
        if (view) view.setBounds(safeBounds);
    }
}

function showBrowserView(tabId: string, keepSplit = false): void {
    if (!mainWindow) return;
    const view = browserViews.get(tabId);
    if (!view) {
        showHomeForTab(tabId);
        return;
    }

    activeTabId = tabId;
    if (!keepSplit) splitTabId = null;
    if (splitTabId === activeTabId) splitTabId = null;

    const needed = new Set<string>([activeTabId]);
    if (splitTabId) needed.add(splitTabId);

    browserViews.forEach((browserView, id): void => {
        if (!needed.has(id) && mainWindow!.getBrowserViews().includes(browserView)) {
            mainWindow!.removeBrowserView(browserView);
        }
    });

    needed.forEach((id): void => {
        const neededView = browserViews.get(id);
        if (neededView && !mainWindow!.getBrowserViews().includes(neededView)) {
            mainWindow!.addBrowserView(neededView);
        }
    });

    const savedZoom = zoomByTab.get(tabId);
    if (savedZoom !== undefined) view.webContents.setZoomFactor(savedZoom);

    updateBrowserViewBounds();
    sendNavState(tabId, view);
    const stData = StorageService.load();
    const tabRecord = stData.tabs.find(t => t.id === tabId);
    setWindowTitle(`${tabRecord?.title || view.webContents.getTitle() || 'Hoo Browser'} - Hoo Browser`);
}

ipcMain.handle('show-tab-menu', async (_event, payload: {
    x: number;
    y: number;
    tabId: string;
    title?: string;
    url?: string;
    isPinned?: boolean;
    isActive?: boolean;
    canClose?: boolean;
    canSplit?: boolean;
    hasTabsToRight?: boolean;
    /** Groups this tab could join (its own group excluded). */
    joinableGroups?: Array<{ id: string; name: string; color: string }>;
    /** Set when the tab already belongs to a group. */
    inGroupName?: string;
}): Promise<string | null> => {
    if (!mainWindow) return null;
    return new Promise((resolve): void => {
        let done = false;
        const choose = (action: string | null): void => {
            if (done) return;
            done = true;
            resolve(action);
        };
        // Firefox's "Add Tab to New Group" lives at the top of the tab menu.
        const groupItems: Electron.MenuItemConstructorOptions[] = [];
        if (payload.inGroupName) {
            groupItems.push({ label: `Remove from “${payload.inGroupName}”`, click: () => choose('ungroup') });
        }
        const joinable = payload.joinableGroups || [];
        if (joinable.length) {
            groupItems.push({
                label: 'Add tab to group',
                submenu: joinable.map(group => ({
                    label: group.name,
                    click: () => choose(`group:${group.id}`)
                }))
            });
        }
        if (groupItems.length) {
            groupItems.push({ type: 'separator' } as Electron.MenuItemConstructorOptions);
        }
        const template: Electron.MenuItemConstructorOptions[] = [
            { label: payload.isPinned ? 'Unpin tab' : 'Pin tab', click: () => choose('toggle-pin') },
            { label: 'Duplicate tab', enabled: !!payload.url, click: () => choose('duplicate') },
            { label: 'Open in split screen', enabled: !!payload.canSplit, click: () => choose('split') },
            { label: 'Copy tab URL', enabled: !!payload.url, click: () => { if (payload.url) clipboard.writeText(payload.url); choose('copy-url'); } },
            { type: 'separator' },
            ...groupItems,
            { label: payload.inGroupName ? 'New group with this tab' : 'Add tab to new group', click: () => choose('group-new') },
            { type: 'separator' },
            { label: 'Close other tabs', click: () => choose('close-others') },
            { label: 'Close tabs to the right', enabled: !!payload.hasTabsToRight, click: () => choose('close-right') },
            { label: 'Close tab', enabled: payload.canClose !== false, click: () => choose('close') },
        ];
        Menu.buildFromTemplate(template).popup({
            window: mainWindow,
            x: Math.max(8, Math.floor(payload.x || 8)),
            y: Math.max(42, Math.floor(payload.y || 42)),
            callback: () => choose(null)
        });
    });
});

ipcMain.handle('show-new-tab-menu', async (_event, payload: {
    x: number;
    y: number;
    canReopenClosedTab?: boolean;
    hasDuplicateTabs?: boolean;
}): Promise<string | null> => {
    if (!mainWindow) return null;
    return new Promise((resolve): void => {
        let done = false;
        const choose = (action: string | null): void => {
            if (done) return;
            done = true;
            resolve(action);
        };
        const template: Electron.MenuItemConstructorOptions[] = [
            { label: 'New tab', click: () => choose('new-tab') },
            { label: 'Reopen closed tab', enabled: !!payload.canReopenClosedTab, click: () => choose('reopen-closed') },
            { label: 'Bookmark all tabs', click: () => choose('bookmark-all') },
            { label: 'Close duplicate tabs', enabled: !!payload.hasDuplicateTabs, click: () => choose('close-duplicates') },
            { type: 'separator' },
            { label: 'Copy all tab URLs', click: () => choose('copy-all-urls') },
        ];
        Menu.buildFromTemplate(template).popup({
            window: mainWindow,
            x: Math.max(8, Math.floor(payload.x || 8)),
            y: Math.max(42, Math.floor(payload.y || 42)),
            callback: () => choose(null)
        });
    });
});

ipcMain.handle('update-privacy-settings', async (_event, settings): Promise<any> => {
    privacySettings = { ...privacySettings, ...settings };
    StorageService.save({ settings: privacySettings });
    if (settings.dataRetention) StorageService.cleanupHistory(settings.dataRetention);
    return privacySettings;
});

ipcMain.handle('mega-login', async (_event, email: string, pass: string): Promise<any> => MegaSyncService.login(email, pass));
ipcMain.handle('mega-logout', async (): Promise<any> => MegaSyncService.logout());

ipcMain.handle('start-openclaw', async (): Promise<any> => {
    openClawLoaded = true;
    const configuredCommand = process.env.HOO_OPENCLAW_COMMAND;
    const openclawScript = path.join(os.homedir(), 'openclaw.sh');
    if (!configuredCommand && !fs.existsSync(openclawScript)) {
        return { ok: false, error: 'OpenClaw is not configured. Set HOO_OPENCLAW_COMMAND or create ~/openclaw.sh. Hoo no longer ships with a developer-specific local path.' };
    }
    const cmd = configuredCommand || `bash "${openclawScript}"`;
    return new Promise((resolve): void => {
        exec(cmd, (err, stdout, stderr): void => {
            if (err) resolve({ ok: false, error: stderr || err.message });
            else resolve({ ok: true });
        });
    });
});

function purgeGhostHomeTabs(): void {
    // Navigations from the home page used to leave `about:blank` tab records
    // behind, which came back as a pile of phantom "New Tab" tabs after restart.
    const data = StorageService.load();
    const hadGhosts = data.tabs.some(t => t.type === 'browser' && isHomeUrl(t.url));
    if (hadGhosts) {
        data.tabs = data.tabs.filter(t => !(t.type === 'browser' && isHomeUrl(t.url)));
        StorageService.save({ tabs: data.tabs });
    }
}

ipcMain.handle('get-initial-data', async (): Promise<any> => {
    StorageService.cleanupHistory(privacySettings.dataRetention as any);
    purgeGhostHomeTabs();
    const data = StorageService.load();
    return { tabs: data.tabs, history: data.history, downloads: data.downloads, crashedTabs: data.crashedTabs, settings: privacySettings, activeTabId: data.activeTabId };
});

function createBrowserViewForTab(tabId: string, partition?: string): BrowserView {
    const view = new BrowserView({ webPreferences: { nodeIntegration: false, contextIsolation: true, partition: partition ? `persist:${partition}` : undefined, sandbox: false, backgroundThrottling: false } });
    browserViews.set(tabId, view);
    applyPrivacyToSession(view.webContents.session);
    attachViewHandlers(tabId, view);
    const savedZoom = zoomByTab.get(tabId);
    if (savedZoom !== undefined) view.webContents.setZoomFactor(savedZoom);
    return view;
}

ipcMain.handle('create-tab', async (_event, url: string, partition?: string, isApp?: boolean, title?: string): Promise<string | null> => {
    if (!mainWindow) return null;
    const tabId = nextTabId();
    const data = StorageService.load();
    const isHome = isHomeUrl(url);
    data.tabs.push({ id: tabId, type: 'browser', title: title || (isApp ? 'App' : 'New Tab'), url: isHome ? 'about:blank' : url, isApp, partition, lastActiveAt: Date.now() });
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });

    if (isHome) {
        showHomeForTab(tabId);
        return tabId;
    }

    const view = createBrowserViewForTab(tabId, partition);
    showBrowserView(tabId);
    void view.webContents.loadURL(url);
    const stData = StorageService.load();
    stData.history.push({ url, title: url, timestamp: Date.now() });
    StorageService.save({ history: stData.history });
    return tabId;
});

ipcMain.handle('switch-tab', async (_event, tabId: string): Promise<string> => {
    // Leaving the fullscreen tab drops its page out of fullscreen, like every
    // real browser; returning to it later restores the normal view.
    if (pageFullscreenTabId && pageFullscreenTabId !== tabId) {
        const previous = browserViews.get(pageFullscreenTabId);
        if (previous && !previous.webContents.isDestroyed()) {
            void previous.webContents.executeJavaScript(
                'if (document.fullscreenElement) document.exitFullscreen();',
                true
            ).catch((): undefined => undefined);
        }
        const exited = pageFullscreenTabId;
        pageFullscreenTabId = null;
        sendToShell('page-fullscreen-changed', exited, false);
    }
    const data = StorageService.load();
    const tab = data.tabs.find(t => t.id === tabId);
    if (tab && isHomeUrl(tab.url)) {
        showHomeForTab(tabId);
    } else if (tab && !browserViews.has(tabId)) {
        const view = createBrowserViewForTab(tabId, tab.partition);
        if (tab.url) void view.webContents.loadURL(tab.url);
        showBrowserView(tabId);
    } else {
        showBrowserView(tabId);
    }
    if (tab) tab.lastActiveAt = Date.now();
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });
    return tabId;
});

ipcMain.handle('set-mosaic-view', async (_event, tabId1: string, tabId2: string): Promise<any> => {
    if (!mainWindow || tabId1 === tabId2) return { activeTabId, splitTabId };
    const data = StorageService.load();
    const first = data.tabs.find(t => t.id === tabId1);
    const second = data.tabs.find(t => t.id === tabId2);
    if (!first || !second || isHomeUrl(first.url) || isHomeUrl(second.url)) return { activeTabId, splitTabId };

    if (!browserViews.has(tabId1)) {
        const firstView = createBrowserViewForTab(tabId1, first.partition);
        if (first.url) void firstView.webContents.loadURL(first.url);
    }
    if (!browserViews.has(tabId2)) {
        const secondView = createBrowserViewForTab(tabId2, second.partition);
        if (second.url) void secondView.webContents.loadURL(second.url);
    }

    activeTabId = tabId1;
    splitTabId = tabId2;
    showBrowserView(tabId1, true);
    StorageService.save({ activeTabId: tabId1 });
    return { activeTabId, splitTabId };
});

ipcMain.handle('clear-mosaic-view', async (): Promise<void> => {
    splitTabId = null;
    if (activeTabId) showBrowserView(activeTabId);
});

ipcMain.handle('get-system-metrics', async (): Promise<any> => getPerformanceSnapshot({
    mainWindow,
    activeBrowserViews: activeTabId ? 1 + (splitTabId ? 1 : 0) : 0,
    totalBrowserViews: browserViews.size,
    lowDataMode: !!privacySettings.lowDataMode,
    aiLoaded: openClawLoaded
}));

ipcMain.handle('nuclear-wipe', async (): Promise<void> => {
    await session.defaultSession.clearStorageData();
    StorageService.wipeAll();
    app.relaunch();
    app.exit(0);
});

async function navigateTabInternal(tabId: string, url: string): Promise<void> {
    if (isHomeUrl(url)) {
        const oldView = browserViews.get(tabId);
        if (oldView) {
            if (!oldView.webContents.isDestroyed()) oldView.webContents.close();
            mainWindow?.removeBrowserView(oldView);
            browserViews.delete(tabId);
        }
        showHomeForTab(tabId);
        return;
    }
    let view = browserViews.get(tabId);
    if (!view || view.webContents.isDestroyed()) view = createBrowserViewForTab(tabId);
    showBrowserView(tabId);
    if (isExternalProtocol(url)) {
        void shell.openExternal(url).catch((): undefined => undefined);
        return;
    }
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;
    try {
        if (await isMaliciousUrl(finalUrl)) {
            void view.webContents.loadURL(buildBlockedPage(finalUrl, 'This URL matched Hoo Shield malware/scam rules.'));
            return;
        }
        void view.webContents.loadURL(finalUrl);
        const stData = StorageService.load();
        const tab = stData.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.url = finalUrl;
            tab.lastActiveAt = Date.now();
            StorageService.save({ tabs: stData.tabs });
        }
        const data = StorageService.load();
        data.history.push({ url: finalUrl, title: view.webContents.getTitle() || finalUrl, timestamp: Date.now() });
        StorageService.save({ history: data.history });
    } catch (error) {
        console.error(`[Main] Failed to load URL ${url}:`, error);
        void view.webContents.loadURL(buildErrorPage(finalUrl, 'The browser could not start this navigation.'));
    }
}

ipcMain.handle('navigate-tab', async (_event, tabId: string, url: string): Promise<void> => {
    await navigateTabInternal(tabId, url);
});

ipcMain.handle('go-back', async (_event, tabId: string): Promise<void> => {
    const view = browserViews.get(tabId);
    const history = view?.webContents.navigationHistory;
    if (history?.canGoBack()) history.goBack();
});
ipcMain.handle('go-forward', async (_event, tabId: string): Promise<void> => {
    const view = browserViews.get(tabId);
    const history = view?.webContents.navigationHistory;
    if (history?.canGoForward()) history.goForward();
});
ipcMain.handle('reload', async (_event, tabId: string): Promise<void> => { browserViews.get(tabId)?.webContents.reloadIgnoringCache(); });
ipcMain.handle('stop-loading', async (_event, tabId: string): Promise<void> => {
    const view = browserViews.get(tabId);
    if (view && !view.webContents.isDestroyed()) view.webContents.stop();
});

ipcMain.handle('reorder-tabs', async (_event, orderedIds: string[]): Promise<void> => {
    const data = StorageService.load();
    data.tabs = reorderTabsByIds(data.tabs, Array.isArray(orderedIds) ? orderedIds : []);
    StorageService.save({ tabs: data.tabs });
});

ipcMain.handle('rename-tab', async (_event, tabId: string, title: string): Promise<void> => {
    const data = StorageService.load();
    const tab = data.tabs.find(t => t.id === tabId);
    if (tab) {
        tab.title = title;
        StorageService.save({ tabs: data.tabs });
        if (tabId === activeTabId) setWindowTitle(`${title} - Hoo Browser`);
    }
});

ipcMain.handle('close-tab', async (_event, tabId: string): Promise<void> => {
    const view = browserViews.get(tabId);
    if (view) {
        if (!view.webContents.isDestroyed()) view.webContents.close();
        mainWindow?.removeBrowserView(view);
        browserViews.delete(tabId);
    }
    cleanupTabRuntimeState(tabId);
    const data = StorageService.load();
    data.tabs = data.tabs.filter(t => t.id !== tabId);
    StorageService.save({ tabs: data.tabs });
    if (activeTabId === tabId) {
        const nextTab = data.tabs[data.tabs.length - 1];
        if (nextTab) {
            if (isHomeUrl(nextTab.url)) showHomeForTab(nextTab.id);
            else showBrowserView(nextTab.id);
        } else {
            showHomeForTab();
        }
    }
});

async function openUrlInNewTabInternal(url: string): Promise<string | null> {
    if (!mainWindow) return null;
    if (isHomeUrl(url)) {
        const tabId = nextTabId();
        const data = StorageService.load();
        data.tabs.push({ id: tabId, type: 'browser', title: 'New Tab', url: 'about:blank', lastActiveAt: Date.now() });
        StorageService.save({ tabs: data.tabs, activeTabId: tabId });
        showHomeForTab(tabId);
        return tabId;
    }
    purgeGhostHomeTabs();
    if (isExternalProtocol(url)) {
        void shell.openExternal(url).catch((): undefined => undefined);
        return null;
    }
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;
    if (await isMaliciousUrl(finalUrl)) return null;
    const tabId = nextTabId();
    const view = createBrowserViewForTab(tabId);
    showBrowserView(tabId);
    void view.webContents.loadURL(finalUrl);
    const data = StorageService.load();
    data.tabs.push({ id: tabId, type: 'browser', title: 'Loading...', url: finalUrl, lastActiveAt: Date.now() });
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });
    data.history.push({ url: finalUrl, title: finalUrl, timestamp: Date.now() });
    StorageService.save({ history: data.history });
    sendToShell('switch-to-browser', tabId);
    return tabId;
}

ipcMain.handle('navigate-to', async (_event, url: string): Promise<string | null> => {
    return openUrlInNewTabInternal(url);
});

// ---- Find in page -------------------------------------------------------

ipcMain.handle('find-in-page', async (_event, tabId: string, query: string, options?: { forward?: boolean; findNext?: boolean }): Promise<void> => {
    const view = browserViews.get(tabId);
    if (!view || view.webContents.isDestroyed() || !query.trim()) return;
    view.webContents.findInPage(query, { forward: options?.forward !== false, findNext: options?.findNext === true });
});

ipcMain.handle('stop-find-in-page', async (_event, tabId: string): Promise<void> => {
    const view = browserViews.get(tabId);
    if (view && !view.webContents.isDestroyed()) view.webContents.stopFindInPage('clearSelection');
});

// ---- Zoom ---------------------------------------------------------------

function applyZoomToActiveView(direction: 'in' | 'out' | 'reset'): void {
    const view = getActiveView();
    if (!view || !activeTabId || view.webContents.isDestroyed()) return;
    const next = stepZoomFactor(view.webContents.getZoomFactor(), direction);
    view.webContents.setZoomFactor(next);
    zoomByTab.set(activeTabId, next);
    // Remember the choice per site (reset clears the override) so every
    // future visit to this origin reopens at the same zoom.
    const origin = originFromUrl(view.webContents.getURL());
    if (origin) {
        if (next === 1) StorageService.removeSiteZoom(origin);
        else StorageService.setSiteZoom(origin, zoomPercent(next));
    }
    sendToShell('zoom-changed', activeTabId, zoomPercent(next));
}

// ---- Tab audio ----------------------------------------------------------

ipcMain.handle('toggle-tab-mute', async (_event, tabId: string): Promise<void> => {
    const view = browserViews.get(tabId);
    if (!view || view.webContents.isDestroyed()) return;
    const nextMuted = !view.webContents.isAudioMuted();
    view.webContents.setAudioMuted(nextMuted);
    if (nextMuted) mutedTabs.add(tabId);
    else mutedTabs.delete(tabId);
    sendToShell('tab-audio-updated', tabId, audibleTabs.has(tabId), nextMuted);
});

// ---- Downloads ----------------------------------------------------------

ipcMain.handle('get-downloads', async (): Promise<any[]> => {
    const data = StorageService.load();
    return [...(data.downloads || [])].slice(-100).reverse();
});

ipcMain.handle('open-download', async (_event, id: string): Promise<{ ok: boolean; error?: string }> => {
    const data = StorageService.load();
    const record = (data.downloads || []).find(item => item.id === id);
    if (!record) return { ok: false, error: 'Download record not found.' };
    if (record.state !== 'completed' || !fs.existsSync(record.savePath)) {
        openDownloadFolder(record.savePath);
        return { ok: false, error: 'File is not ready yet; opened the folder instead.' };
    }
    const result = await shell.openPath(record.savePath);
    return result ? { ok: false, error: result } : { ok: true };
});

ipcMain.handle('show-download-in-folder', async (_event, id: string): Promise<boolean> => {
    const data = StorageService.load();
    const record = (data.downloads || []).find(item => item.id === id);
    if (!record) return false;
    openDownloadFolder(record.savePath);
    return true;
});

ipcMain.handle('clear-downloads', async (): Promise<void> => {
    StorageService.save({ downloads: [] });
    sendToShell('download-list-cleared');
});

// ---- History ------------------------------------------------------------

ipcMain.handle('get-history', async (): Promise<any[]> => {
    const data = StorageService.load();
    return [...(data.history || [])].slice(-60).reverse();
});

// Full history for the Library-style history page (newest first).
ipcMain.handle('get-all-history', async (): Promise<any[]> => {
    const data = StorageService.load();
    return [...(data.history || [])].reverse();
});

// Remove one visit (timestamp + url disambiguate repeat visits).
ipcMain.handle('delete-history-entry', async (_event, url: string, timestamp: number): Promise<number> => {
    const data = StorageService.load();
    const before = (data.history || []).length;
    const next = (data.history || []).filter(entry => !(entry.url === url && entry.timestamp === timestamp));
    if (next.length !== before) StorageService.save({ history: next });
    return before - next.length;
});

// "Forget" a range: last hour, today, or everything (hours = null).
ipcMain.handle('clear-history-range', async (_event, range: 'hour' | 'day' | 'all'): Promise<number> => {
    if (range === 'all') {
        const data = StorageService.load();
        const removed = (data.history || []).length;
        StorageService.clearAllHistory();
        sendToShell('history-cleared');
        return removed;
    }
    const now = Date.now();
    const cutoff = range === 'hour' ? now - 3600000 : (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const data = StorageService.load();
    const before = (data.history || []).length;
    const next = (data.history || []).filter(entry => entry.timestamp < cutoff);
    if (next.length !== before) StorageService.save({ history: next });
    sendToShell('history-cleared');
    return before - next.length;
});

ipcMain.handle('clear-history', async (): Promise<void> => {
    StorageService.clearAllHistory();
    sendToShell('history-cleared');
});

// ---- Address bar suggestions (DuckDuckGo autocomplete) --------------------
// Main-process only: the renderer never talks to the network for this, and
// the request carries nothing but the typed characters.
const suggestService = new SuggestService();

ipcMain.handle('get-address-suggestions', async (_event, query: string): Promise<{ ok: boolean; suggestions: string[] }> => {
    const result = await suggestService.suggest(typeof query === 'string' ? query : '');
    return { ok: result.ok, suggestions: result.suggestions };
});

// ---- Site permissions ----------------------------------------------------

ipcMain.handle('resolve-permission', async (_event, requestId: string, decision: 'allow' | 'block', remember: boolean): Promise<boolean> => {
    const pending = pendingPermissionRequests.get(requestId);
    if (!pending) return false; // already answered, timed out, or tab closed
    clearTimeout(pending.timer);
    pendingPermissionRequests.delete(requestId);
    if (remember) StorageService.setPermissionDecision(decisionKey(pending.origin, pending.permission), decision);
    pending.callback(decision === 'allow');
    return true;
});

ipcMain.handle('get-site-permissions', async (): Promise<any[]> => permissionRows(StorageService.load().sitePermissions || {}));

ipcMain.handle('clear-site-permissions', async (_event, key?: string): Promise<void> => {
    StorageService.clearPermissionDecisions(typeof key === 'string' && key ? key : undefined);
});

// The padlock panel's per-site toggles: Allow / Block / Ask for one
// origin+permission pair. 'ask' removes the stored decision so the site
// prompts again. Invalid input is rejected rather than silently stored.
ipcMain.handle('set-site-permission', async (_event, origin: string, permission: string, decision: 'allow' | 'block' | 'ask'): Promise<{ ok: boolean; error?: string }> => {
    if (!origin || originFromUrl(origin) !== origin) return { ok: false, error: 'Invalid site origin.' };
    if (!(DECIDABLE_PERMISSIONS as readonly string[]).includes(permission)) return { ok: false, error: 'Unknown permission.' };
    if (decision !== 'allow' && decision !== 'block' && decision !== 'ask') return { ok: false, error: 'Invalid decision.' };
    const data = StorageService.load();
    const decisions = data.sitePermissions || {};
    const next = decision === 'ask'
        ? withoutDecision(decisions, decisionKey(origin, permission))
        : withDecision(decisions, origin, permission, decision);
    StorageService.save({ sitePermissions: next });
    return { ok: true };
});

// ---- Site zoom levels ----------------------------------------------------

ipcMain.handle('get-site-zooms', async (): Promise<Record<string, number>> => StorageService.load().siteZooms || {});

ipcMain.handle('clear-site-zooms', async (): Promise<void> => {
    StorageService.clearSiteZooms();
    zoomByTab.clear();
});

// ---- Crash recovery ------------------------------------------------------

ipcMain.handle('restore-crashed-tabs', async (): Promise<number> => {
    const data = StorageService.load();
    const crashed = data.crashedTabs || [];
    let restored = 0;
    for (const record of crashed) {
        if (record.url && /^https?:\/\//i.test(record.url)) {
            await openUrlInNewTabInternal(record.url);
            restored += 1;
        }
    }
    if (crashed.length) StorageService.save({ crashedTabs: [] });
    return restored;
});

// ---- Bookmark import/export ----------------------------------------------

ipcMain.handle('export-bookmarks', async (_event, entries: any[]): Promise<{ ok: boolean; path?: string; error?: string }> => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'Hoo is shutting down.' };
    const html = serializeNetscapeBookmarks(Array.isArray(entries) ? entries : []);
    if (!html.includes('HREF=')) return { ok: false, error: 'No bookmarks to export yet.' };
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export bookmarks',
        defaultPath: 'hoo-bookmarks.html',
        filters: [{ name: 'HTML bookmarks', extensions: ['html'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, error: 'Export cancelled.' };
    try {
        fs.writeFileSync(result.filePath, html, 'utf8');
        return { ok: true, path: result.filePath };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not write the file.' };
    }
});

ipcMain.handle('import-bookmarks', async (): Promise<{ ok: boolean; bookmarks?: any[]; error?: string }> => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'Hoo is shutting down.' };
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import bookmarks',
        properties: ['openFile'],
        filters: [{ name: 'HTML bookmarks', extensions: ['html', 'htm'] }]
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, error: 'Import cancelled.' };
    try {
        const html = fs.readFileSync(result.filePaths[0], 'utf8');
        const parsed = parseNetscapeBookmarks(html);
        if (!parsed.length) return { ok: false, error: 'No usable bookmarks found in that file.' };
        return { ok: true, bookmarks: parsed };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not read the file.' };
    }
});

// ---- Live Reader feed fetching -------------------------------------------
// The renderer cannot fetch cross-origin RSS without a CORS proxy, and a
// privacy browser must not route every read through api.allorigins.win. The
// main process fetches with Electron's net stack instead: no CORS, no proxy,
// and the host sees the request the same as any page load.
ipcMain.handle('rss-fetch', async (_event, url: string): Promise<{ ok: boolean; contents?: string; error?: string }> => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return { ok: false, error: 'Only http(s) feed URLs are supported.' };
    }
    try {
        const response = await net.fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return { ok: false, error: `The feed server returned ${response.status}.` };
        return { ok: true, contents: await response.text() };
    } catch (error: unknown) {
        return { ok: false, error: error instanceof Error ? error.message : 'Fetching this feed failed.' };
    }
});

// ---- Application menu ---------------------------------------------------
// Menu accelerators are the only reliable way to make browser shortcuts work
// while a web page has focus: shell-side keydown listeners never see keys that
// land inside a BrowserView.

function sendUiShortcut(action: string): void {
    sendToShell('ui-shortcut', action);
}

function runViewAction(action: (view: BrowserView) => void): void {
    const view = getActiveView();
    if (view && !view.webContents.isDestroyed()) action(view);
}

async function checkUpdatesFromMenu(): Promise<void> {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const result = await checkForAppUpdates();
    if (result.status === 'restart-required') {
        const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Hoo Browser updates',
            message: result.message,
            buttons: ['Restart to update', 'Later'],
            defaultId: 0,
            cancelId: 1
        });
        if (response === 0) await installAppUpdate();
        return;
    }
    void dialog.showMessageBox(mainWindow, {
        type: result.ok ? 'info' : 'warning',
        title: 'Hoo Browser updates',
        message: result.message,
        detail: result.status === 'unsupported' || result.status === 'downloading' ? 'Releases: https://github.com/imranshiundu/Hoo-browser/releases' : undefined,
        buttons: ['OK']
    });
}

function setupAppMenu(): void {
    const tabShortcut = (n: number): string => `select-tab-${n}`;
    const tabItems: Electron.MenuItemConstructorOptions[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n): Electron.MenuItemConstructorOptions => ({
        label: `Switch to tab ${n}`,
        accelerator: `CmdOrCtrl+${n}`,
        click: (): void => sendUiShortcut(tabShortcut(n))
    }));

    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: (): void => sendUiShortcut('new-tab') },
                { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: (): void => sendUiShortcut('close-tab') },
                { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+T', click: (): void => sendUiShortcut('reopen-closed') },
                { type: 'separator' },
                { label: 'Bookmark Manager', accelerator: 'CmdOrCtrl+Shift+O', click: (): void => sendUiShortcut('open-library') },
                { label: 'History', accelerator: 'CmdOrCtrl+H', click: (): void => sendUiShortcut('history-page') },
                { label: 'Downloads', accelerator: 'CmdOrCtrl+J', click: (): void => sendUiShortcut('downloads') },
                { label: 'RSS Reader', click: (): void => sendUiShortcut('open-reader') },
                { label: 'Modules & Extensions', click: (): void => sendUiShortcut('open-extensions') },
                { label: 'Find in Page', accelerator: 'CmdOrCtrl+F', click: (): void => sendUiShortcut('find') },
                { label: 'Focus Address Bar', accelerator: 'CmdOrCtrl+L', click: (): void => sendUiShortcut('focus-address') },
                { type: 'separator' },
                { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: (): void => sendUiShortcut('settings') },
                { label: 'Close Window', role: 'close' },
                { label: 'Quit', role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Reload Page', accelerator: 'CmdOrCtrl+R', click: (): void => { if (activeTabId) void browserViews.get(activeTabId)?.webContents.reload(); } },
                { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: (): void => runViewAction((view): void => view.webContents.reloadIgnoringCache()) },
                { type: 'separator' },
                { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: (): void => applyZoomToActiveView('in') },
                { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: (): void => applyZoomToActiveView('out') },
                { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: (): void => applyZoomToActiveView('reset') },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { label: 'Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: (): void => runViewAction((view): void => view.webContents.openDevTools({ mode: 'detach' })) },
                { label: 'Developer Tools (F12)', accelerator: 'F12', click: (): void => runViewAction((view): void => view.webContents.openDevTools({ mode: 'detach' })) },
                { label: 'Print Page', accelerator: 'CmdOrCtrl+P', click: (): void => runViewAction((view): void => view.webContents.print()) }
            ]
        },
        {
            label: 'History',
            submenu: [
                { label: 'Back', accelerator: 'Alt+Left', click: (): void => runViewAction((view): void => view.webContents.navigationHistory.goBack()) },
                { label: 'Forward', accelerator: 'Alt+Right', click: (): void => runViewAction((view): void => view.webContents.navigationHistory.goForward()) },
                { type: 'separator' },
                { label: 'Clear Browsing History', click: (): void => { void dialog.showMessageBox(mainWindow!, { type: 'warning', title: 'Clear history', message: 'Clear all browsing history?', detail: 'This removes every visited-page entry stored in the Hoo profile. Bookmarks and saved site permissions are kept.', buttons: ['Clear history', 'Cancel'], defaultId: 0, cancelId: 1 }).then(({ response }): void => { if (response === 0) { StorageService.clearAllHistory(); sendToShell('history-cleared'); } }); } }
            ]
        },
        {
            label: 'Tabs',
            submenu: [
                { label: 'Next Tab', accelerator: 'Control+Tab', click: (): void => sendUiShortcut('next-tab') },
                { label: 'Previous Tab', accelerator: 'Control+Shift+Tab', click: (): void => sendUiShortcut('prev-tab') },
                { type: 'separator' },
                ...tabItems,
                { label: 'Switch to last tab', accelerator: 'CmdOrCtrl+9', click: (): void => sendUiShortcut('select-tab-9') }
            ]
        },
        {
            label: 'Help',
            submenu: [
                { label: 'Check for Updates...', click: (): void => { void checkUpdatesFromMenu(); } }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then((): void => {
    if (!gotSingleInstanceLock) return; // another Hoo instance owns the profile
    createWindow();
    // Real browsers keep themselves current: packaged installs check GitHub
    // Releases shortly after launch, download silently, and offer a restart.
    // The shell listens on 'app-update-status' for live progress.
    initAutoUpdater((status): void => sendToShell('app-update-status', status));
    if (shouldAutoCheckOnStartup({ isPackaged: app.isPackaged, disabledEnv: process.env.HOO_DISABLE_AUTO_UPDATE })) {
        setTimeout((): void => { void checkForAppUpdates(); }, 5000);
    }
});
// macOS keeps the app alive with the window closed; the dock click must
// reopen a window instead of leaving a zombie process.
app.on('activate', (): void => {
    if (mainWindow === null && gotSingleInstanceLock) createWindow();
});
app.on("window-all-closed", (): void => { if (process.platform !== "darwin") app.quit(); });
