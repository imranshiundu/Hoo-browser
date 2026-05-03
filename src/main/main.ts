import { app, BrowserWindow, BrowserView, ipcMain, session } from "electron";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { exec } from "child_process";
import { shouldBlockRequest, getRandomUserAgent, isMaliciousUrl, stripJunkRequestHeaders, stripJunkResponseHeaders } from "./privacy-filters";
import { StorageService } from "./storage";
import { setupAuthHandlers } from "./auth";
import { MegaSyncService } from "./sync";
import { checkForHooUpdates } from "./update-service";
import { markWindowReady, trackNetworkRequest, trackNetworkBytes, getPerformanceSnapshot } from "./performance-monitor";
import { shouldBlockForLowData } from "./network-policy";

app.setName("Hoo Browser");
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
let manualBounds: { x: number, y: number, width: number, height: number } | null = null;
let openClawLoaded = false;

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

const WHATSAPP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) WhatsApp/2.24.4.78 Chrome/120.0.6099.225 Electron/30.0.0 Safari/537.36";

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

function hideAllBrowserViews(): void {
    if (!mainWindow) return;
    browserViews.forEach((view): void => mainWindow!.removeBrowserView(view));
    activeTabId = null;
    splitTabId = null;
}

function showHomeForTab(tabId?: string): void {
    hideAllBrowserViews();
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
    mainWindow?.webContents.send('switch-to-home', tabId);
}

function buildErrorPage(url: string, description: string): string {
    const safeUrl = encodeURIComponent(url || 'unknown');
    const safeMessage = encodeURIComponent(description || 'This page could not be reached.');
    return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#080a0a;color:#f3f4f6;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}.card{width:min(680px,calc(100vw - 48px));border:1px solid rgba(255,102,0,.32);border-radius:22px;padding:34px;background:linear-gradient(135deg,rgba(255,102,0,.12),rgba(255,255,255,.035));box-shadow:0 24px 80px rgba(0,0,0,.45)}h1{margin:0 0 10px;font-size:28px}p{color:#b7bbc2;line-height:1.6}.url{margin-top:18px;font-size:13px;color:#f97316;word-break:break-all}.hint{margin-top:18px;font-size:13px;color:#9ca3af}</style></head><body><section class="card"><h1>Hoo could not open this page</h1><p>${decodeURIComponent(safeMessage)}</p><div class="url">${decodeURIComponent(safeUrl)}</div><div class="hint">Check your connection, reload, or open a new tab. Hoo kept the browser UI alive instead of leaving a blank page.</div></section></body></html>`)}`;
}

function injectSitePolish(view: BrowserView): void {
    try {
        const css = `
            html, body { scrollbar-width: thin !important; }
            ::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
            ::-webkit-scrollbar-track { background: transparent !important; }
            ::-webkit-scrollbar-thumb { background: rgba(140,140,140,.28) !important; border-radius: 999px !important; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(180,180,180,.42) !important; }
            form[role="search"], [data-testid="searchbox"], .searchbox_searchbox__eaWKL { max-width: 820px !important; }
        `;
        void Promise.resolve((view.webContents.insertCSS as any)(css)).catch((): undefined => undefined);
    } catch {
        // Site CSS injection is cosmetic; never break page loading for it.
    }
}

function attachViewHandlers(tabId: string, view: BrowserView): void {
    view.setAutoResize({ width: true, height: true });
    view.webContents.setBackgroundThrottling(false);

    view.webContents.session.setPermissionRequestHandler((webContents, permission, callback): void => {
        const url = webContents.getURL();
        if (privacySettings.deepSpoof && url.includes('web.whatsapp.com') && permission === 'media') {
            console.log(`[DeepSpoof] Auto-granting media to WhatsApp`);
            callback(true);
            return;
        }
        callback(false);
    });

    view.webContents.on('did-start-navigation', (_event, url): void => {
        mainWindow?.webContents.send('tab-loading-state', tabId, true, url);
        if (privacySettings.deepSpoof && url.includes('web.whatsapp.com')) {
            view.webContents.setUserAgent(WHATSAPP_UA);
            void view.webContents.executeJavaScript(`
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                Object.defineProperty(navigator, 'userAgent', { get: () => '${WHATSAPP_UA}' });
                console.log('[Hoo] Windows environment spoofed.');
            `).catch((): undefined => undefined);
        } else {
            view.webContents.setUserAgent(getRandomUserAgent());
        }
    });

    view.webContents.on('did-finish-load', (): void => {
        injectSitePolish(view);
        const title = view.webContents.getTitle();
        const url = view.webContents.getURL();
        mainWindow?.webContents.send('tab-loading-state', tabId, false, url);
        if (title) mainWindow?.webContents.send('tab-title-updated', tabId, title, url);
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL): void => {
        mainWindow?.webContents.send('tab-loading-state', tabId, false, validatedURL);
        mainWindow?.webContents.send('tab-load-error', tabId, errorCode, errorDescription, validatedURL);
        if (errorCode !== -3 && validatedURL && !validatedURL.startsWith('data:')) {
            void view.webContents.loadURL(buildErrorPage(validatedURL, errorDescription));
        }
    });

    view.webContents.on('page-title-updated', (_event, title): void => {
        const url = view.webContents.getURL();
        mainWindow?.webContents.send('tab-title-updated', tabId, title, url);
        const stData = StorageService.load();
        const targetTab = stData.tabs.find(t => t.id === tabId);
        if (targetTab) {
            targetTab.title = title;
            targetTab.url = url;
            StorageService.save({ tabs: stData.tabs });
        }
    });
}

function restoreTabs(): void {
    if (!persistentData.tabs) return;
    const tabs = [...persistentData.tabs].sort((a: any, b: any) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
    const activeRestoreId = persistentData.activeTabId || tabs.find((tab: any) => tab.type === 'browser')?.id;

    tabs.forEach((tab: any): void => {
        if (tab.type !== 'browser' || tab.id !== activeRestoreId || isHomeUrl(tab.url)) return;
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

function createWindow(): void {
    mainWindow = new BrowserWindow({
        height: 800,
        width: 1400,
        frame: false,
        title: "Hoo Browser",
        icon: resolveAssetPath('assets/branding/hoo-app-icon.png'),
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

    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    mainWindow.once('ready-to-show', markWindowReady);
    if (!app.isPackaged && process.env.HOO_OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools();

    setupPrivacyFilters();
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
        if (activeTabId) updateBrowserViewBounds();
    };
    mainWindow.on('resize', triggerResize);
    mainWindow.on('maximize', triggerResize);
    mainWindow.on('unmaximize', triggerResize);
}

ipcMain.handle('hide-browser-view', async (): Promise<void> => {
    hideAllBrowserViews();
    manualBounds = null;
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
ipcMain.handle('check-for-updates', async (): Promise<any> => checkForHooUpdates());

ipcMain.handle('get-performance-snapshot', async (): Promise<any> => getPerformanceSnapshot({
    mainWindow,
    activeBrowserViews: activeTabId ? 1 + (splitTabId ? 1 : 0) : 0,
    totalBrowserViews: browserViews.size,
    lowDataMode: !!privacySettings.lowDataMode,
    aiLoaded: openClawLoaded
}));

function applyPrivacyToSession(ses: Electron.Session): void {
    const filter = { urls: ['<all_urls>'] };

    ses.setPermissionCheckHandler((_webContents, permission): boolean => {
        return permission === 'media' ? true : false;
    });

    ses.webRequest.onBeforeRequest(filter, (details, callback): void => {
        trackNetworkRequest();
        const lowDataDecision = shouldBlockForLowData(details.url, details.resourceType, privacySettings);
        if (lowDataDecision.block) return callback({ cancel: true });
        if (privacySettings.adShield && shouldBlockRequest(details.url)) return callback({ cancel: true });
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
        requestHeaders['DNT'] = '1';
        requestHeaders['Sec-GPC'] = '1';
        requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        if (privacySettings.deepSpoof && details.url.includes('web.whatsapp.com')) requestHeaders['User-Agent'] = WHATSAPP_UA;
        else requestHeaders['User-Agent'] = getRandomUserAgent();
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

function showBrowserView(tabId: string, isSplit = false): void {
    if (!mainWindow) return;
    const view = browserViews.get(tabId);
    if (!view) {
        showHomeForTab(tabId);
        return;
    }
    if (isSplit) splitTabId = tabId;
    else {
        activeTabId = tabId;
        splitTabId = null;
    }

    const needed = new Set<string>([tabId]);
    if (splitTabId) needed.add(splitTabId);

    browserViews.forEach((browserView, id): void => {
        if (!needed.has(id)) mainWindow!.removeBrowserView(browserView);
    });

    if (!mainWindow.getBrowserViews().includes(view)) mainWindow.addBrowserView(view);
    if (splitTabId) {
        const splitView = browserViews.get(splitTabId);
        if (splitView && !mainWindow.getBrowserViews().includes(splitView)) mainWindow.addBrowserView(splitView);
    }
    updateBrowserViewBounds();
}

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

ipcMain.handle('get-initial-data', async (): Promise<any> => {
    StorageService.cleanupHistory(privacySettings.dataRetention as any);
    const data = StorageService.load();
    return { tabs: data.tabs, history: data.history, downloads: data.downloads, crashedTabs: data.crashedTabs, settings: privacySettings, activeTabId: data.activeTabId };
});

function createBrowserViewForTab(tabId: string, partition?: string): BrowserView {
    const view = new BrowserView({ webPreferences: { nodeIntegration: false, contextIsolation: true, partition: partition ? `persist:${partition}` : undefined, sandbox: false, backgroundThrottling: false } });
    browserViews.set(tabId, view);
    applyPrivacyToSession(view.webContents.session);
    attachViewHandlers(tabId, view);
    return view;
}

ipcMain.handle('create-tab', async (_event, url: string, partition?: string, isApp?: boolean, title?: string): Promise<string | null> => {
    if (!mainWindow) return null;
    const tabId = Date.now().toString();
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
    activeTabId = tabId1;
    splitTabId = tabId2;
    showBrowserView(tabId1, true);
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

ipcMain.handle('navigate-tab', async (_event, tabId: string, url: string): Promise<void> => {
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
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;
    try {
        if (await isMaliciousUrl(finalUrl)) return;
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
ipcMain.handle('reload', async (_event, tabId: string): Promise<void> => { browserViews.get(tabId)?.webContents.reload(); });

ipcMain.handle('rename-tab', async (_event, tabId: string, title: string): Promise<void> => {
    const data = StorageService.load();
    const tab = data.tabs.find(t => t.id === tabId);
    if (tab) {
        tab.title = title;
        StorageService.save({ tabs: data.tabs });
    }
});

ipcMain.handle('close-tab', async (_event, tabId: string): Promise<void> => {
    const view = browserViews.get(tabId);
    if (view) {
        if (!view.webContents.isDestroyed()) view.webContents.close();
        mainWindow?.removeBrowserView(view);
        browserViews.delete(tabId);
    }
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

ipcMain.handle('toggle-sidebar', async (): Promise<void> => updateBrowserViewBounds());

ipcMain.handle('navigate-to', async (_event, url: string): Promise<string | null> => {
    if (!mainWindow) return null;
    if (isHomeUrl(url)) {
        const tabId = Date.now().toString();
        const data = StorageService.load();
        data.tabs.push({ id: tabId, type: 'browser', title: 'New Tab', url: 'about:blank', lastActiveAt: Date.now() });
        StorageService.save({ tabs: data.tabs, activeTabId: tabId });
        showHomeForTab(tabId);
        return tabId;
    }
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;
    if (await isMaliciousUrl(finalUrl)) return null;
    const tabId = Date.now().toString();
    const view = createBrowserViewForTab(tabId);
    showBrowserView(tabId);
    void view.webContents.loadURL(finalUrl);
    const data = StorageService.load();
    data.tabs.push({ id: tabId, type: 'browser', title: 'Loading...', url: finalUrl, lastActiveAt: Date.now() });
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });
    mainWindow.webContents.send('switch-to-browser', tabId);
    return tabId;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", (): void => { if (process.platform !== "darwin") app.quit(); });
