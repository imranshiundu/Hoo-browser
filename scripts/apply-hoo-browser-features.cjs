#!/usr/bin/env node
/*
 * Hoo browser-product features patcher.
 * Keeps small browser UX features idempotent while main.ts is still being
 * stabilized by prebuild patchers.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'src/main/main.ts');

function log(message) {
  console.log(`[Hoo browser features] ${message}`);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    log(`skipped ${label}; pattern not found or already patched`);
    return source;
  }
  log(`patched ${label}`);
  return source.replace(search, replacement);
}

function ensureElectronImports(source) {
  const match = source.match(/import \{([^}]+)\} from ["']electron["'];/);
  if (!match) return source;
  const names = match[1].split(',').map(item => item.trim()).filter(Boolean);
  for (const required of ['app', 'BrowserWindow', 'BrowserView', 'ipcMain', 'session', 'shell', 'Menu', 'clipboard']) {
    if (!names.includes(required)) names.push(required);
  }
  return source.replace(match[0], `import { ${names.join(', ')} } from "electron";`);
}

if (!fs.existsSync(mainPath)) {
  console.error('[Hoo browser features] Missing src/main/main.ts. Run from repo root.');
  process.exit(1);
}

const before = fs.readFileSync(mainPath, 'utf8');
let main = before;

main = ensureElectronImports(main);

// Fix the broken split logic: showBrowserView(tabId, true) used to replace the
// split target with the active tab. Split state should be set by set-mosaic-view.
main = replaceOnce(
  main,
  `function showBrowserView(tabId: string, isSplit = false): void {
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
}`,
  `function showBrowserView(tabId: string, preserveSplit = false): void {
    if (!mainWindow) return;
    const view = browserViews.get(tabId);
    if (!view) {
        showHomeForTab(tabId);
        return;
    }
    activeTabId = tabId;
    if (!preserveSplit) splitTabId = null;
    if (splitTabId === activeTabId) splitTabId = null;

    const needed = new Set<string>([activeTabId]);
    if (splitTabId && browserViews.has(splitTabId)) needed.add(splitTabId);

    browserViews.forEach((browserView, id): void => {
        if (!needed.has(id)) mainWindow!.removeBrowserView(browserView);
    });

    for (const id of needed) {
        const neededView = browserViews.get(id);
        if (neededView && !mainWindow.getBrowserViews().includes(neededView)) mainWindow.addBrowserView(neededView);
    }
    updateBrowserViewBounds();
}`,
  'showBrowserView split preservation'
);

main = replaceOnce(
  main,
  `ipcMain.handle('set-mosaic-view', async (_event, tabId1: string, tabId2: string): Promise<any> => {
    activeTabId = tabId1;
    splitTabId = tabId2;
    showBrowserView(tabId1, true);
    return { activeTabId, splitTabId };
});`,
  `ipcMain.handle('set-mosaic-view', async (_event, tabId1: string, tabId2: string): Promise<any> => {
    const view1 = browserViews.get(tabId1);
    const view2 = browserViews.get(tabId2);
    if (!mainWindow || !view1 || !view2 || tabId1 === tabId2) {
        return { ok: false, activeTabId, splitTabId, error: 'Both split tabs must be loaded browser tabs.' };
    }
    activeTabId = tabId1;
    splitTabId = tabId2;
    showBrowserView(tabId1, true);
    StorageService.save({ activeTabId: tabId1 });
    return { ok: true, activeTabId, splitTabId };
});`,
  'set-mosaic-view validation'
);

main = replaceOnce(
  main,
  `ipcMain.handle('switch-tab', async (_event, tabId: string): Promise<string> => {
    const data = StorageService.load();`,
  `ipcMain.handle('switch-tab', async (_event, tabId: string): Promise<string> => {
    splitTabId = null;
    const data = StorageService.load();`,
  'clear split on normal tab switch'
);

main = replaceOnce(
  main,
  `function attachViewHandlers(tabId: string, view: BrowserView): void {
    view.setAutoResize({ width: true, height: true });
    view.webContents.setBackgroundThrottling(false);
`,
  `function attachViewHandlers(tabId: string, view: BrowserView): void {
    view.setAutoResize({ width: true, height: true });
    view.webContents.setBackgroundThrottling(false);
    attachPageContextMenu(tabId, view);
`,
  'attach page context menu'
);

if (!main.includes('function attachPageContextMenu(')) {
  main = replaceOnce(
    main,
    `function attachViewHandlers(tabId: string, view: BrowserView): void {`,
    `function attachPageContextMenu(tabId: string, view: BrowserView): void {
    view.webContents.on('context-menu', (_event, params): void => {
        const template: Electron.MenuItemConstructorOptions[] = [];
        const selectedText = (params.selectionText || '').trim();
        const linkUrl = params.linkURL || '';
        const srcUrl = params.srcURL || '';
        const pageUrl = view.webContents.getURL();

        if (selectedText) {
            template.push(
                { label: 'Copy selected text', click: (): void => clipboard.writeText(selectedText) },
                { label: 'Search DuckDuckGo for selection', click: (): void => { void createNewTabFromMain('https://duckduckgo.com/?q=' + encodeURIComponent(selectedText)); } }
            );
        }

        if (linkUrl) {
            if (template.length) template.push({ type: 'separator' });
            template.push(
                { label: 'Open link in new tab', click: (): void => { void createNewTabFromMain(linkUrl); } },
                { label: 'Open link externally', click: (): void => { void shell.openExternal(linkUrl).catch(() => undefined); } },
                { label: 'Copy link address', click: (): void => clipboard.writeText(linkUrl) }
            );
        }

        if (srcUrl) {
            if (template.length) template.push({ type: 'separator' });
            template.push(
                { label: 'Open media in new tab', click: (): void => { void createNewTabFromMain(srcUrl); } },
                { label: 'Copy media address', click: (): void => clipboard.writeText(srcUrl) }
            );
            if (params.mediaType === 'image') {
                template.push({ label: 'Save image as...', click: (): void => view.webContents.downloadURL(srcUrl) });
            }
        }

        if (template.length) template.push({ type: 'separator' });
        template.push(
            { label: 'Back', enabled: view.webContents.navigationHistory?.canGoBack?.() ?? false, click: (): void => view.webContents.navigationHistory?.goBack?.() },
            { label: 'Forward', enabled: view.webContents.navigationHistory?.canGoForward?.() ?? false, click: (): void => view.webContents.navigationHistory?.goForward?.() },
            { label: 'Reload', click: (): void => view.webContents.reloadIgnoringCache() },
            { type: 'separator' },
            { label: 'Copy page URL', enabled: !!pageUrl, click: (): void => clipboard.writeText(pageUrl) },
            { label: 'Open page externally', enabled: !!pageUrl && /^https?:/i.test(pageUrl), click: (): void => { void shell.openExternal(pageUrl).catch(() => undefined); } }
        );

        Menu.buildFromTemplate(template).popup({ window: mainWindow || undefined });
    });
}

function attachViewHandlers(tabId: string, view: BrowserView): void {`,
    'page context menu helper'
  );
}

if (!main.includes('async function createNewTabFromMain(')) {
  main = replaceOnce(
    main,
    `function createBrowserViewForTab(tabId: string, partition?: string): BrowserView {`,
    `async function createNewTabFromMain(url: string): Promise<string | null> {
    if (!mainWindow) return null;
    const tabId = Date.now().toString();
    const data = StorageService.load();
    data.tabs.push({ id: tabId, type: 'browser', title: 'Loading...', url, lastActiveAt: Date.now() });
    StorageService.save({ tabs: data.tabs, activeTabId: tabId });
    const view = createBrowserViewForTab(tabId);
    showBrowserView(tabId);
    mainWindow.webContents.send('switch-to-browser', tabId);
    void view.webContents.loadURL(url);
    return tabId;
}

function createBrowserViewForTab(tabId: string, partition?: string): BrowserView {`,
    'createNewTabFromMain helper'
  );
}

main = replaceOnce(
  main,
  `ipcMain.handle('reload', async (_event, tabId: string): Promise<void> => { browserViews.get(tabId)?.webContents.reload(); });`,
  `ipcMain.handle('reload', async (_event, tabId: string): Promise<void> => { browserViews.get(tabId)?.webContents.reloadIgnoringCache(); });`,
  'reload ignoring cache'
);

if (before !== main) {
  fs.writeFileSync(mainPath, main, 'utf8');
  log('patched src/main/main.ts');
} else {
  log('no changes needed');
}
