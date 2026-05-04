#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'src/main/main.ts');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
}

let main = read(mainPath);

main = main.replace(
  'import { app, BrowserWindow, BrowserView, ipcMain, session } from "electron";',
  'import { app, BrowserWindow, BrowserView, ipcMain, session, Menu, shell, clipboard } from "electron";'
);

if (!main.includes("function getActiveView(): BrowserView | null")) {
  main = main.replace(
    "function isHomeUrl(url?: string): boolean {\n    return !url || url === 'about:blank' || url === 'hoo://home';\n}\n",
    `function isHomeUrl(url?: string): boolean {\n    return !url || url === 'about:blank' || url === 'hoo://home';\n}\n\nfunction getActiveView(): BrowserView | null {\n    return activeTabId ? browserViews.get(activeTabId) || null : null;\n}\n`
  );
  console.log('[Hoo safe-ui] added active view helper');
}

const showBrowserViewFixed = `function showBrowserView(tabId: string, keepSplit = false): void {
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

    updateBrowserViewBounds();
}`;
main = main.replace(/function showBrowserView\(tabId: string, isSplit = false\): void \{[\s\S]*?\n\}/, showBrowserViewFixed);

main = main.replace(
  /ipcMain\.handle\('set-mosaic-view', async \(_event, tabId1: string, tabId2: string\): Promise<any> => \{[\s\S]*?\n\}\);/,
  `ipcMain.handle('set-mosaic-view', async (_event, tabId1: string, tabId2: string): Promise<any> => {
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
});`
);
console.log('[Hoo safe-ui] ensured split-screen handler');

if (!main.includes("ipcMain.handle('show-tab-menu'")) {
  const menuHandlers = `
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
            { label: payload.isPinned ? 'Unpin tab' : 'Pin tab', click: () => choose('toggle-pin') },
            { label: 'Duplicate tab', enabled: !!payload.url, click: () => choose('duplicate') },
            { label: 'Open in split screen', enabled: !!payload.canSplit, click: () => choose('split') },
            { label: 'Copy tab URL', enabled: !!payload.url, click: () => { if (payload.url) clipboard.writeText(payload.url); choose('copy-url'); } },
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
`;
  main = main.replace("ipcMain.handle('update-privacy-settings'", `${menuHandlers}\nipcMain.handle('update-privacy-settings'`);
  console.log('[Hoo safe-ui] added native tab/new-tab menus');
}

if (!main.includes("[Hoo page-menu]")) {
  const contextMenu = `
    view.webContents.on('context-menu', (_event, params): void => {
        const template: Electron.MenuItemConstructorOptions[] = [];
        const selected = (params.selectionText || '').trim();
        const linkUrl = params.linkURL || '';
        const imageUrl = params.srcURL || '';

        if (selected) {
            template.push({ label: 'Copy', click: () => clipboard.writeText(selected) });
            template.push({ label: 'Search selected text', click: () => {
                const query = encodeURIComponent(selected);
                void view.webContents.loadURL(\`https://duckduckgo.com/?q=\${query}\`);
            }});
        }

        if (linkUrl) {
            if (template.length) template.push({ type: 'separator' });
            template.push({ label: 'Open link in new tab', click: () => mainWindow?.webContents.send('open-url-in-new-tab', linkUrl) });
            template.push({ label: 'Copy link address', click: () => clipboard.writeText(linkUrl) });
            template.push({ label: 'Open link externally', click: () => shell.openExternal(linkUrl).catch(() => undefined) });
        }

        if (imageUrl) {
            if (template.length) template.push({ type: 'separator' });
            template.push({ label: 'Open image in new tab', click: () => mainWindow?.webContents.send('open-url-in-new-tab', imageUrl) });
            template.push({ label: 'Copy image address', click: () => clipboard.writeText(imageUrl) });
            template.push({ label: 'Save image as…', click: () => view.webContents.downloadURL(imageUrl) });
        }

        if (!template.length) {
            template.push({ label: 'Back', enabled: !!view.webContents.navigationHistory?.canGoBack?.(), click: () => view.webContents.navigationHistory?.goBack?.() });
            template.push({ label: 'Forward', enabled: !!view.webContents.navigationHistory?.canGoForward?.(), click: () => view.webContents.navigationHistory?.goForward?.() });
            template.push({ label: 'Reload', click: () => view.webContents.reload() });
        }

        template.push({ type: 'separator' });
        template.push({ label: 'Copy page URL', click: () => clipboard.writeText(view.webContents.getURL()) });
        console.log('[Hoo page-menu] show context menu');
        Menu.buildFromTemplate(template).popup({ window: mainWindow || undefined });
    });
`;
  main = main.replace("    view.webContents.setWindowOpenHandler((details): Electron.HandlerDetails => {", `${contextMenu}\n    view.webContents.setWindowOpenHandler((details): Electron.HandlerDetails => {`);
  console.log('[Hoo safe-ui] added page/image/link context menu');
}

write(mainPath, main);
console.log('[Hoo safe-ui] source checks complete');
