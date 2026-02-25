import { app, BrowserWindow, BrowserView, ipcMain, session } from "electron";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { exec } from "child_process";
import { shouldBlockRequest, getRandomUserAgent, isMaliciousUrl } from "./privacy-filters";
import { StorageService, StorageData } from "./storage";
import { setupAuthHandlers } from "./auth";
import { MegaSyncService } from "./sync";

let mainWindow: BrowserWindow | null = null;
const browserViews: Map<string, BrowserView> = new Map();
let activeTabId: string | null = null;
let splitTabId: string | null = null; // Second tab for split screen
let manualBounds: { x: number, y: number, width: number, height: number } | null = null;
let isSidebarCollapsed = true;

// Load initial data from storage
let persistentData = StorageService.load();

// Privacy settings state derived from storage
let privacySettings = {
    adShield: true,
    scriptFortress: false,
    fingerprintCloak: true,
    forceHttps: true,
    deepSpoof: persistentData.settings?.deepSpoof ?? true,
    dataRetention: persistentData.settings?.dataRetention || 'forever',
    ...persistentData.settings
};

const WHATSAPP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) WhatsApp/2.24.4.78 Chrome/120.0.6099.225 Electron/30.0.0 Safari/537.36";

function attachViewHandlers(tabId: string, view: BrowserView) {
    // Permission Handling (Camera/Mic for WhatsApp)
    view.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const url = webContents.getURL();
        if (privacySettings.deepSpoof && url.includes('web.whatsapp.com') && permission === 'media') {
            console.log(`[DeepSpoof] Auto-granting media to WhatsApp`);
            return callback(true);
        }
        callback(false);
    });

    // Site-Specific Spoofing
    view.webContents.on('did-start-navigation', (event, url) => {
        if (privacySettings.deepSpoof && url.includes('web.whatsapp.com')) {
            console.log(`[DeepSpoof] Hijacking environment for WhatsApp...`);
            view.webContents.setUserAgent(WHATSAPP_UA);

            // Inject Win32 platform spoof
            view.webContents.executeJavaScript(`
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                Object.defineProperty(navigator, 'userAgent', { get: () => '${WHATSAPP_UA}' });
                console.log('[Zen] Windows environment spoofed.');
            `);
        } else {
            view.webContents.setUserAgent(getRandomUserAgent());
        }
    });

    view.webContents.on('did-finish-load', () => {
        const title = view.webContents.getTitle();
        const url = view.webContents.getURL();
        if (title) mainWindow?.webContents.send('tab-title-updated', tabId, title, url);
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

    persistentData.tabs.forEach((tab: any) => {
        if (tab.type === 'browser') {
            const view = new BrowserView({
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    partition: tab.partition ? `persist:${tab.partition}` : undefined,
                    sandbox: true,
                }
            });

            browserViews.set(tab.id, view);
            applyPrivacyToSession(view.webContents.session);
            attachViewHandlers(tab.id, view);

            if (tab.url) {
                view.webContents.loadURL(tab.url);
            }
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        height: 800,
        width: 1400,
        frame: false, // Frameless window
        titleBarStyle: 'hidden', // Hide title bar but keep traffic lights on Mac (if any)
        webPreferences: {
            preload: path.join(__dirname, "../preload/preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    mainWindow.webContents.openDevTools(); // Temporary for development

    setupPrivacyFilters();
    setupAuthHandlers(mainWindow);
    restoreTabs();

    mainWindow.on("closed", () => {
        mainWindow = null;
        browserViews.forEach(view => {
            if (!view.webContents.isDestroyed()) {
                view.webContents.close();
            }
        });
        browserViews.clear();
    });

    const triggerResize = () => {
        if (activeTabId) {
            updateBrowserViewBounds();
        }
    };

    mainWindow.on('resize', triggerResize);
    mainWindow.on('maximize', triggerResize);
    mainWindow.on('unmaximize', triggerResize);
}

// ... existing code ...

ipcMain.handle('hide-browser-view', async () => {
    if (!mainWindow) return;
    browserViews.forEach(view => {
        mainWindow!.removeBrowserView(view);
    });
    activeTabId = null;
    manualBounds = null; // Clear manual bounds when hidden
});

ipcMain.handle('update-view-bounds', async (_event, bounds: { x: number, y: number, width: number, height: number }) => {
    manualBounds = bounds;
    updateBrowserViewBounds();
});

ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.handle('window-close', () => {
    mainWindow?.close();
});

ipcMain.handle('window-reload', () => {
    mainWindow?.webContents.reloadIgnoringCache();
});

function applyPrivacyToSession(ses: Electron.Session) {
    const filter = { urls: ['<all_urls>'] };

    ses.webRequest.onBeforeRequest(filter, (details, callback) => {
        // 1. Ad Shield logic
        if (privacySettings.adShield && shouldBlockRequest(details.url)) {
            console.log('[Zen Shield] Blocked:', details.url);
            return callback({ cancel: true });
        }

        // 2. Force HTTPS logic
        if (privacySettings.forceHttps && details.url.startsWith('http://')) {
            const httpsUrl = details.url.replace('http://', 'https://');
            return callback({ redirectURL: httpsUrl });
        }

        callback({ cancel: false });
    });

    ses.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        if (privacySettings.deepSpoof && details.url.includes('web.whatsapp.com')) {
            details.requestHeaders['User-Agent'] = WHATSAPP_UA;
        } else if (privacySettings.fingerprintCloak) {
            details.requestHeaders['User-Agent'] = getRandomUserAgent();
        }
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
    const padding = 10; // Space between split views

    const availableWidth = Math.max(0, bounds.width - sidebarWidth - (margin * 2));
    const availableHeight = Math.max(0, bounds.height - topBarHeight - margin);

    if (manualBounds) {
        // Use exact bounds from renderer for perfect framing
        const view = browserViews.get(activeTabId);
        if (view) view.setBounds(manualBounds);
        return;
    }

    if (activeTabId && splitTabId) {
        // Split Screen (Horizontal 50/50)
        const view1 = browserViews.get(activeTabId);
        const view2 = browserViews.get(splitTabId);
        const splitWidth = (availableWidth - padding) / 2;

        if (view1) {
            view1.setBounds({
                x: sidebarWidth + margin,
                y: topBarHeight,
                width: Math.floor(splitWidth),
                height: availableHeight
            });
        }
        if (view2) {
            view2.setBounds({
                x: sidebarWidth + margin + Math.floor(splitWidth) + padding,
                y: topBarHeight,
                width: Math.floor(splitWidth),
                height: availableHeight
            });
        }
    } else if (activeTabId) {
        // Single View
        const view = browserViews.get(activeTabId);
        if (view) {
            view.setBounds({
                x: sidebarWidth + margin,
                y: topBarHeight,
                width: availableWidth,
                height: availableHeight
            });
        }
    }
}

function showBrowserView(tabId: string, isSplit = false) {
    if (!mainWindow) return;

    if (isSplit) {
        splitTabId = tabId;
    } else {
        activeTabId = tabId;
        // If not splitting, clear splitTabId
        if (!isSplit) splitTabId = null;
    }

    // Hide all views first
    browserViews.forEach(view => {
        mainWindow!.removeBrowserView(view);
    });

    // Add active views
    if (activeTabId) {
        const view = browserViews.get(activeTabId);
        if (view) mainWindow.addBrowserView(view);
    }
    if (splitTabId) {
        const view = browserViews.get(splitTabId);
        if (view) mainWindow.addBrowserView(view);
    }

    updateBrowserViewBounds();
}

ipcMain.handle('update-privacy-settings', async (_event, settings) => {
    privacySettings = { ...privacySettings, ...settings };
    StorageService.save({ settings: privacySettings });

    if (settings.dataRetention) {
        StorageService.cleanupHistory(settings.dataRetention);
    }

    return privacySettings;
});

ipcMain.handle('mega-login', async (_event, email: string, pass: string) => {
    return await MegaSyncService.login(email, pass);
});

ipcMain.handle('mega-logout', async () => {
    await MegaSyncService.logout();
});

ipcMain.handle('start-openclaw', async () => {
    const openclaw_sh = path.join(os.homedir(), 'openclaw.sh');
    const dc_path = path.join(os.homedir(), 'Code', 'Managers', 'docker-compose.yml');
    const cmd = fs.existsSync(openclaw_sh)
        ? `bash ${openclaw_sh}`
        : `docker compose -f "${dc_path}" up -d openclaw-gateway`;
    return new Promise((resolve) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error('[OpenClaw] Start failed:', stderr);
                resolve({ ok: false, error: stderr });
            } else {
                console.log('[OpenClaw] Started:', stdout);
                resolve({ ok: true });
            }
        });
    });
});

ipcMain.handle('get-initial-data', async () => {
    // Run cleanup on startup
    StorageService.cleanupHistory(privacySettings.dataRetention as any);
    const data = StorageService.load();
    return {
        tabs: data.tabs,
        history: data.history,
        settings: privacySettings,
        activeTabId: data.activeTabId
    };
});

ipcMain.handle('create-tab', async (_event, url: string, partition?: string, isApp?: boolean, title?: string) => {
    if (!mainWindow) return null;

    const tabId = Date.now().toString();
    const view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: partition ? `persist:${partition}` : undefined,
            sandbox: true,
        }
    });
    browserViews.set(tabId, view);
    applyPrivacyToSession(view.webContents.session);
    attachViewHandlers(tabId, view);
    showBrowserView(tabId);

    if (url && url !== 'about:blank') {
        view.webContents.loadURL(url);

        // Track History
        const historyEntry = {
            url,
            title: url,
            timestamp: Date.now()
        };
        const stData = StorageService.load();
        stData.history.push(historyEntry);
        StorageService.save({ history: stData.history });
    }

    // Persistent tab state
    const data = StorageService.load();
    data.tabs.push({
        id: tabId,
        type: 'browser',
        title: title || (isApp ? 'App' : 'New Tab'),
        url,
        isApp,
        partition
    });
    StorageService.save({ tabs: data.tabs });

    return tabId;
});

ipcMain.handle('switch-tab', async (_event, tabId: string) => {
    showBrowserView(tabId);
    StorageService.save({ activeTabId: tabId });
    return tabId;
});

ipcMain.handle('set-mosaic-view', async (_event, tabId1: string, tabId2: string) => {
    activeTabId = tabId1;
    splitTabId = tabId2;
    showBrowserView(tabId1, true); // Use the split logic
    return { activeTabId, splitTabId };
});

ipcMain.handle('clear-mosaic-view', async () => {
    splitTabId = null;
    showBrowserView(activeTabId || '');
});

ipcMain.handle('get-system-metrics', async () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // CPU Load (1 min average)
    const load = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuUsage = Math.min(100, Math.floor((load / cpuCount) * 100));

    // Storage info (browser data dir)
    const userDataPath = app.getPath('userData');
    let storageUsed = 0;
    try {
        if (fs.existsSync(userDataPath)) {
            const getDirSize = (dir: string): number => {
                const files = fs.readdirSync(dir);
                return files.reduce((acc: number, file: string) => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory()) return acc + getDirSize(filePath);
                    return acc + stats.size;
                }, 0);
            };
            storageUsed = getDirSize(userDataPath);
        }
    } catch (e) {
        console.error('[Main] Disk usage error:', e);
    }

    return {
        cpu: cpuUsage,
        ram: {
            used: (usedMem / (1024 ** 3)).toFixed(1),
            total: (totalMem / (1024 ** 3)).toFixed(0)
        },
        storage: {
            usedBytes: storageUsed,
            usedText: (storageUsed / (1024 ** 2)).toFixed(2) + ' MB'
        }
    };
});

ipcMain.handle('nuclear-wipe', async () => {
    console.log('☢️ NUCLEAR WIPE INITIATED');

    // 1. Clear session data (Cookies, Cache, etc.)
    await session.defaultSession.clearStorageData();

    // 2. Wipe local storage file
    StorageService.wipeAll();

    // 3. Relaunch app
    app.relaunch();
    app.exit(0);
});

ipcMain.handle('navigate-tab', async (_event, tabId: string, url: string) => {
    console.log(`[Main] IPC: navigate-tab for ${tabId} to ${url}`);
    const view = browserViews.get(tabId);
    if (!view) {
        console.error(`[Main] Tab ${tabId} not found in browserViews map`);
        return;
    }

    if (view.webContents.isDestroyed()) {
        console.error(`[Main] Tab ${tabId} webContents is destroyed`);
        return;
    }

    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
        finalUrl = 'https://' + url;
    }

    try {
        if (await isMaliciousUrl(finalUrl)) {
            console.error(`[Security] Blocked navigation to malicious URL: ${finalUrl}`);
            // We could redirect to a safe page here
            return;
        }

        await view.webContents.loadURL(finalUrl);

        // Persist URL change in tab
        const stData = StorageService.load();
        const tab = stData.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.url = url;
            StorageService.save({ tabs: stData.tabs });
        }

        // Track History
        const historyEntry = {
            url,
            title: view.webContents.getTitle() || url,
            timestamp: Date.now()
        };
        const data = StorageService.load();
        data.history.push(historyEntry);
        StorageService.save({ history: data.history });

        console.log(`[Main] Navigation tracked for ${tabId}`);
    } catch (error) {
        console.error(`[Main] Failed to load URL ${url}:`, error);
    }
});

ipcMain.handle('go-back', async (_event, tabId: string) => {
    const view = browserViews.get(tabId);
    if (view?.webContents.canGoBack()) view.webContents.goBack();
});

ipcMain.handle('go-forward', async (_event, tabId: string) => {
    const view = browserViews.get(tabId);
    if (view?.webContents.canGoForward()) view.webContents.goForward();
});

ipcMain.handle('reload', async (_event, tabId: string) => {
    browserViews.get(tabId)?.webContents.reload();
});

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

    // Persistent storage update
    const data = StorageService.load();
    data.tabs = data.tabs.filter(t => t.id !== tabId);
    StorageService.save({ tabs: data.tabs });

    if (activeTabId === tabId && browserViews.size > 0) {
        const nextTabId = Array.from(browserViews.keys())[0];
        showBrowserView(nextTabId);
    }
});

ipcMain.handle('toggle-sidebar', async (_event, collapsed: boolean) => {
    isSidebarCollapsed = collapsed;
    if (activeTabId) {
        updateBrowserViewBounds();
    }
});

ipcMain.handle('navigate-to', async (_event, url: string) => {
    if (!mainWindow) return;

    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
        finalUrl = 'https://' + url;
    }

    if (await isMaliciousUrl(finalUrl)) {
        console.error(`[Security] Blocked navigation to malicious URL: ${finalUrl}`);
        return null;
    }

    const tabId = Date.now().toString();
    const view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        }
    });
    browserViews.set(tabId, view);
    applyPrivacyToSession(view.webContents.session);
    attachViewHandlers(tabId, view);
    showBrowserView(tabId);
    view.webContents.loadURL(finalUrl);

    // Persist new tab
    const data = StorageService.load();
    data.tabs.push({ id: tabId, type: 'browser', title: 'Loading...', url: finalUrl });
    StorageService.save({ tabs: data.tabs });

    mainWindow.webContents.send('switch-to-browser', tabId);
    return tabId;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
