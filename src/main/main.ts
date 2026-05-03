import { app, BrowserWindow, BrowserView, ipcMain, session } from "electron";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { exec } from "child_process";
import { shouldBlockRequest, getRandomUserAgent, isMaliciousUrl } from "./privacy-filters";
import { StorageService } from "./storage";
import { setupAuthHandlers } from "./auth";
import { MegaSyncService } from "./sync";
import { checkForHooUpdates } from "./update-service";
import { markWindowReady, trackNetworkRequest, trackNetworkBytes, getPerformanceSnapshot } from "./performance-monitor";
import { shouldBlockForLowData } from "./network-policy";

app.setName("Hoo Browser");
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-systemd-scope');
app.commandLine.appendSwitch('disable-features', 'OptimizationHints,MediaRouter,AutofillServerCommunication,Translate');

let mainWindow: BrowserWindow | null = null;
const browserViews: Map<string, BrowserView> = new Map();
let activeTabId: string | null = null;
let splitTabId: string | null = null;
let manualBounds: { x: number, y: number, width: number, height: number } | null = null;
let isSidebarCollapsed = true;
let openClawLoaded = false;

let persistentData = StorageService.load();

let privacySettings = {
    adShield: true,
    scriptFortress: false,
    fingerprintCloak: true,
    forceHttps: true,
    deepSpoof: persistentData.settings?.deepSpoof ?? true,
    lowDataMode: persistentData.settings?.lowDataMode ?? false,
    blockThirdPartyFonts: persistentData.settings?.blockThirdPartyFonts ?? false,
    blockAutoplayMedia: persistentData.settings?.blockAutoplayMedia ?? false,
    dataRetention: persistentData.settings?.dataRetention || 'forever',
    ...persistentData.settings
};

const WHATSAPP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) WhatsApp/2.24.4.78 Chrome/120.0.6099.225 Electron/30.0.0 Safari/537.36";

function resolveAssetPath(...segments: string[]) {
    const distAsset = path.join(__dirname, "../renderer", ...segments);
    if (fs.existsSync(distAsset)) return distAsset;
    const sourceAsset = path.join(__dirname, "../../src/renderer", ...segments);
    if (fs.existsSync(sourceAsset)) return sourceAsset;
    return distAsset;
}

function attachViewHandlers(tabId: string, view: BrowserView) {
    view.setAutoResize({ width: true, height: true });
    view.webContents.setBackgroundThrottling(true);

    view.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const url = webContents.getURL();
        if (privacySettings.deepSpoof && url.includes('web.whatsapp.com') && permission === 'media') {
            console.log(`[DeepSpoof] Auto-granting media to WhatsApp`);
            return callback(true);
        }
        callback(false);
    });

    view.webContents.on('did-start-navigation', (_event, url) => {
        mainWindow?.webContents.send('tab-loading-state', tabId, true, url);
        if (privacySettings.deepSpoof && url.includes('web.whatsapp.com')) {
            console.log(`[DeepSpoof] Hijacking environment for WhatsApp...`);
            view.webContents.setUserAgent(WHATSAPP_UA);
            view.webContents.executeJavaScript(`
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                Object.defineProperty(navigator, 'userAgent', { get: () => '${WHATSAPP_UA}' });
                console.log('[Hoo] Windows environment spoofed.');
            `);
        } else {
            view.webContents.setUserAgent(getRandomUserAgent());
        }
    });

    view.webContents.on('did-finish-load', () => {
        const title = view.webContents.getTitle();
        const url = view.webContents.getURL();
        mainWindow?.webContents.send('tab-loading-state', tabId, false, url);
        if (title) mainWindow?.webContents.send('tab-title-updated', tabId, title, url);
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        mainWindow?.webContents.send('tab-loading-state', tabId, false, validatedURL);
        mainWindow?.webContents.send('tab-load-error', tabId, errorCode, errorDescription, validatedURL);
    });

    view.webContents.on('page-title-updated', (_event, title) => {
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

function restoreTabs() {
    if (!persistentData.tabs) return;

    const tabs = [...persistentData.tabs].sort((a: any, b: any) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
    const activeRestoreId = persistentData.activeTabId || tabs.find((tab: any) => tab.type === 'browser')?.id;

    tabs.forEach((tab: any) => {
        if (tab.type !== 'browser') return;
        const shouldLoadNow = tab.id === activeRestoreId;
        if (!shouldLoadNow) return;

        const view = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                partition: tab.partition ? `persist:${tab.partition}` : undefined,
                sandbox: true,
                backgroundThrottling: true,
            }
        });

        browserViews.set(tab.id, view);
        applyPrivacyToSession(view.webContents.session);
        attachViewHandlers(tab.id, view);

        if (tab.url) view.webContents.loadURL(tab.url);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        height: 800,
        width: 1400,
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
            backgroundThrottling: true,
        },
    });

    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    mainWindow.once('ready-to-show', markWindowReady);
    if (!app.isPackaged && process.env.HOO_OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools();

    setupPrivacyFilters();
    setupAuthHandlers(mainWindow);
    restoreTabs();

    mainWindow.on("closed", () => {
        mainWindow = null;
        browserViews.forEach(view => {
            if (!view.webContents.isDestroyed()) view.webContents.close();
        });
        browserViews.clear();
    });

    const triggerResize = () => {
        if (activeTabId) updateBrowserViewBounds();
    };

    mainWindow.on('resize', triggerResize);
    mainWindow.on('maximize', triggerResize);
    mainWindow.on('unmaximize', triggerResize);
}

ipcMain.handle('hide-browser-view', async () => {
    if (!mainWindow) return;
    browserViews.forEach(view => mainWindow!.removeBrowserView(view));
    activeTabId = null;
    manualBounds = null;
});

ipcMain.handle('update-view-bounds', async (_event, bounds: { x: number, y: number, width: number, height: number }) => {
    manualBounds = {
        x: Math.max(0, Math.floor(bounds.x)),
        y: Math.max(0, Math.floor(bounds.y)),
        width: Math.max(100, Math.floor(bounds.width)),
        height: Math.max(100, Math.floor(bounds.height))
    };
    updateBrowserViewBounds();
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('window-reload', () => mainWindow?.webContents.reloadIgnoringCache());
ipcMain.handle('check-for-updates', async () => checkForHooUpdates());

ipcMain.handle('get-performance-snapshot', async () => getPerformanceSnapshot({
    mainWindow,
    activeBrowserViews: activeTabId ? 1 + (splitTabId ? 1 : 0) : 0,
    totalBrowserViews: browserViews.size,
    lowDataMode: !!privacySettings.lowDataMode,
    aiLoaded: openClawLoaded
}));

function applyPrivacyToSession(ses: Electron.Session) {
    const filter = { urls: ['<all_urls>'] };

    ses.webRequest.onBeforeRequest(filter, (details, callback) => {
        trackNetworkRequest();

        const lowDataDecision = shouldBlockForLowData(details.url, details.resourceType, privacySettings);
        if (lowDataDecision.block) {
            console.log(`[Low Data] Blocked ${lowDataDecision.reason}:`, details.url);
            return callback({ cancel: true });
        }

        if (privacySettings.adShield && shouldBlockRequest(details.url)) {
            console.log('[Hoo Shield] Blocked:', details.url);
            return callback({ cancel: true });
        }

        if (privacySettings.forceHttps && details.url.startsWith('http://')) {
            const httpsUrl = details.url.replace('http://', 'https://');
            return callback({ redirectURL: httpsUrl });
        }

        callback({ cancel: false });
    });

    ses.webRequest.onHeadersReceived(filter, (details, callback) => {
        const lengthHeader = details.responseHeaders?.['content-length'] || details.responseHeaders?.['Content-Length'];
        const lengthValue = Array.isArray(lengthHeader) ? Number(lengthHeader[0]) : Number(lengthHeader);
        trackNetworkBytes(lengthValue);
        callback({ responseHeaders: details.responseHeaders });
    });

    ses.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        if (privacySettings.deepSpoof && details.url.includes('web.whatsapp.com')) details.requestHeaders['User-Agent'] = WHATSAPP_UA;
        else if (privacySettings.fingerprintCloak) details.requestHeaders['User-Agent'] = getRandomUserAgent();
        callback({ requestHeaders: details.requestHeaders });
    });
}

function setupPrivacyFilters() {
    applyPrivacyToSession(session.defaultSession);
}

function updateBrowserViewBounds() {
    if (!mainWindow) return;
    const bounds = mainWindow.getContentBounds();
    const sidebarWidth = isSidebarCollapsed ? (68 + 12 + 10) : (250 + 20 + 20);
    const topBarHeight = 32 + 40;
    const margin = 10;
    const padding = 10;
    const availableWidth = Math.max(0, bounds.width - sidebarWidth - (margin * 2));
    const availableHeight = Math.max(0, bounds.height - topBarHeight - margin);

    if (manualBounds) {
        const view = browserViews.get(activeTabId || '');
        if (view) view.setBounds(manualBounds);
        return;
    }

    if (activeTabId && splitTabId) {
        const view1 = browserViews.get(activeTabId);
        const view2 = browserViews.get(splitTabId);
        const splitWidth = (availableWidth - padding) / 2;
        if (view1) view1.setBounds({ x: sidebarWidth + margin, y: topBarHeight, width: Math.floor(splitWidth), height: availableHeight });
        if (view2) view2.setBounds({ x: sidebarWidth + margin + Math.floor(splitWidth) + padding, y: topBarHeight, width: Math.floor(splitWidth), height: availableHeight });
    } else if (activeTabId) {
        const view = browserViews.get(activeTabId);
        if (view) view.setBounds({ x: sidebarWidth + margin, y: topBarHeight, width: availableWidth, height: availableHeight });
    }
}

function showBrowserView(tabId: string, isSplit = false) {
    if (!mainWindow) return;
    if (isSplit) splitTabId = tabId;
    else {
        activeTabId = tabId;
        splitTabId = null;
    }

    browserViews.forEach(view => mainWindow!.removeBrowserView(view));
    if (activeTabId) {
        const view = browserViews.get(activeTabId);
        if (view) {
            mainWindow.addBrowserView(view);
            mainWindow.setTopBrowserView(view);
        }
    }
    if (splitTabId) {
        const view = browserViews.get(splitTabId);
        if (view) {
            mainWindow.addBrowserView(view);
            mainWindow.setTopBrowserView(view);
        }
    }
    updateBrowserViewBounds();
}

ipcMain.handle('update-privacy-settings', async (_event, settings) => {
    privacySettings = { ...privacySettings, ...settings };
    StorageService.save({ settings: privacySettings });
    if (settings.dataRetention) StorageService.cleanupHistory(settings.dataRetention);
    return privacySettings;
});

ipcMain.handle('mega-login', async (_event, email: string, pass: string) => MegaSyncService.login(email, pass));
ipcMain.handle('mega-logout', async () => MegaSyncService.logout());

ipcMain.handle('start-openclaw', async () => {
    openClawLoaded = true;
    const configuredCommand = process.env.HOO_OPENCLAW_COMMAND;
    const openclawScript = path.join(os.homedir(), 'openclaw.sh');
    if (!configuredCommand && !fs.existsSync(openclawScript)) {
        return { ok: false, error: 'OpenClaw is not configured. Set HOO_OPENCLAW_COMMAND or create ~/openclaw.sh. Hoo no longer ships with a developer-specific local path.' };
    }
    const cmd = configuredCommand || `bash "${openclawScript}"`;
    return new Promise((resolve) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) resolve({ ok: false, error: stderr || err.message });
            else {
                console.log('[OpenClaw] Started:', stdout);
                resolve({ ok: true });
            }
        });
    });
});

ipcMain.handle('get-initial-data', async () => {
    StorageService.cleanupHistory(privacySettings.dataRetention as any);
    const data = StorageService.load();
    return { tabs: data.tabs, history: data.history, downloads: data.downloads, crashedTabs: data.crashedTabs, settings: privacySettings, activeTabId: data.activeTabId };
});

function createBrowserViewForTab(tabId: string, partition?: string) {
    const view = new BrowserView({ webPreferences: { nodeIntegration: false, contextIsolation: true, partition: partition ? `persist:${partition}` : undefined, sandbox: true, backgroundThrottling: true } });
    browserViews.set(tabId, view);
    applyPrivacyToSession(view.webContents.session);
    attachViewHandlers(tabId, view);
    return view;
}

ipcMain.handle('create-tab', async (_event, url: string, partition?: string, isApp?: boolean, title?: string) => {
    if (!mainWindow) return null;
    const tabId = Date.now().toString();
    const view = createBrowserViewForTab(tabId, partition);
    showBrowserView(tabId);

    if (url && url !== 'about:blank') {
        view.webContents.loadURL(url);
        const stData = StorageService.load();
        stData.history.push({ url, title: url, timestamp: Date.now() });
        StorageService.save({ history: stData.history });
    }

    const data = StorageService.load();
    data.tabs.push({ id: tabId, type: 'browser', title: title || (isApp ? 'App' : 'New Tab'), url, isApp, partition, lastActiveAt: Date.now() });
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });
    return tabId;
});

ipcMain.handle('switch-tab', async (_event, tabId: string) => {
    const data = StorageService.load();
    const tab = data.tabs.find(t => t.id === tabId);
    if (tab && !browserViews.has(tabId)) {
        const view = createBrowserViewForTab(tabId, tab.partition);
        if (tab.url && tab.url !== 'about:blank') view.webContents.loadURL(tab.url);
    }
    showBrowserView(tabId);
    if (tab) tab.lastActiveAt = Date.now();
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });
    return tabId;
});

ipcMain.handle('set-mosaic-view', async (_event, tabId1: string, tabId2: string) => {
    activeTabId = tabId1;
    splitTabId = tabId2;
    showBrowserView(tabId1, true);
    return { activeTabId, splitTabId };
});

ipcMain.handle('clear-mosaic-view', async () => {
    splitTabId = null;
    showBrowserView(activeTabId || '');
});

ipcMain.handle('get-system-metrics', async () => getPerformanceSnapshot({
    mainWindow,
    activeBrowserViews: activeTabId ? 1 + (splitTabId ? 1 : 0) : 0,
    totalBrowserViews: browserViews.size,
    lowDataMode: !!privacySettings.lowDataMode,
    aiLoaded: openClawLoaded
}));

ipcMain.handle('nuclear-wipe', async () => {
    console.log('NUCLEAR WIPE INITIATED');
    await session.defaultSession.clearStorageData();
    StorageService.wipeAll();
    app.relaunch();
    app.exit(0);
});

ipcMain.handle('navigate-tab', async (_event, tabId: string, url: string) => {
    const view = browserViews.get(tabId);
    if (!view || view.webContents.isDestroyed()) return;
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) finalUrl = 'https://' + url;
    try {
        if (await isMaliciousUrl(finalUrl)) return;
        await view.webContents.loadURL(finalUrl);
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
    }
});

ipcMain.handle('go-back', async (_event, tabId: string) => {
    const view = browserViews.get(tabId);
    const history = view?.webContents.navigationHistory;
    if (history?.canGoBack()) history.goBack();
});
ipcMain.handle('go-forward', async (_event, tabId: string) => {
    const view = browserViews.get(tabId);
    const history = view?.webContents.navigationHistory;
    if (history?.canGoForward()) history.goForward();
});
ipcMain.handle('reload', async (_event, tabId: string) => browserViews.get(tabId)?.webContents.reload());

ipcMain.handle('rename-tab', async (_event, tabId: string, title: string) => {
    const data = StorageService.load();
    const tab = data.tabs.find(t => t.id === tabId);
    if (tab) {
        tab.title = title;
        StorageService.save({ tabs: data.tabs });
    }
});

ipcMain.handle('close-tab', async (_event, tabId: string) => {
    const view = browserViews.get(tabId);
    if (!view) return;
    if (!view.webContents.isDestroyed()) view.webContents.close();
    mainWindow?.removeBrowserView(view);
    browserViews.delete(tabId);
    const data = StorageService.load();
    data.tabs = data.tabs.filter(t => t.id !== tabId);
    StorageService.save({ tabs: data.tabs });
    if (activeTabId === tabId && browserViews.size > 0) showBrowserView(Array.from(browserViews.keys())[0]);
});

ipcMain.handle('toggle-sidebar', async (_event, collapsed: boolean) => {
    isSidebarCollapsed = collapsed;
    if (activeTabId) updateBrowserViewBounds();
});

ipcMain.handle('navigate-to', async (_event, url: string) => {
    if (!mainWindow) return;
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) finalUrl = 'https://' + url;
    if (await isMaliciousUrl(finalUrl)) return null;
    const tabId = Date.now().toString();
    const view = createBrowserViewForTab(tabId);
    showBrowserView(tabId);
    view.webContents.loadURL(finalUrl);
    const data = StorageService.load();
    data.tabs.push({ id: tabId, type: 'browser', title: 'Loading...', url: finalUrl, lastActiveAt: Date.now() });
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });
    mainWindow.webContents.send('switch-to-browser', tabId);
    return tabId;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
