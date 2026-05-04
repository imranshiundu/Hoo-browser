#!/usr/bin/env node
/*
 * Hoo Google auth compatibility patch.
 *
 * Google rejects many Electron/in-app browser login surfaces with:
 * "This browser or app may not be secure."
 * The safe browser behavior is to open Google account auth in the user's trusted
 * system browser instead of trapping it inside Hoo's BrowserView.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'src/main/main.ts');

function log(message) {
  console.log(`[Hoo Google auth] ${message}`);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    log(`skipped ${label}; pattern not found or already patched`);
    return source;
  }
  log(`patched ${label}`);
  return source.replace(search, replacement);
}

function ensureElectronShell(source) {
  const match = source.match(/import \{([^}]+)\} from ["']electron["'];/);
  if (!match) return source;
  const names = match[1].split(',').map(item => item.trim()).filter(Boolean);
  if (!names.includes('shell')) names.push('shell');
  return source.replace(match[0], `import { ${names.join(', ')} } from "electron";`);
}

if (!fs.existsSync(mainPath)) {
  console.error('[Hoo Google auth] Missing src/main/main.ts. Run from repo root.');
  process.exit(1);
}

const before = fs.readFileSync(mainPath, 'utf8');
let main = before;

main = ensureElectronShell(main);

if (!main.includes('function isGoogleAuthUrl(')) {
  main = replaceOnce(
    main,
    `function getPageUrlForRequest(details: any): string {
    return details?.webContents?.getURL?.() || details?.referrer || '';
}
`,
    `function getPageUrlForRequest(details: any): string {
    return details?.webContents?.getURL?.() || details?.referrer || '';
}

function isGoogleAuthUrl(url?: string): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        return host === 'accounts.google.com' || host.endsWith('.accounts.google.com');
    } catch {
        return /^https?:\\/\\/accounts\\.google\\.com/i.test(url);
    }
}

function openGoogleAuthExternally(url: string): void {
    console.warn('[Hoo Auth] Opening Google account login externally because Google rejects embedded/Electron auth surfaces.');
    void shell.openExternal(url).catch((error) => console.error('[Hoo Auth] Failed to open Google auth externally:', error));
}
`,
    'Google auth helpers'
  );
}

main = replaceOnce(
  main,
  `function blockNavigationIfUnsafe(tabId: string, view: BrowserView, event: Electron.Event, targetUrl: string, sourceUrl?: string): boolean {
    if (isExternalProtocol(targetUrl)) {`,
  `function blockNavigationIfUnsafe(tabId: string, view: BrowserView, event: Electron.Event, targetUrl: string, sourceUrl?: string): boolean {
    if (isGoogleAuthUrl(targetUrl)) {
        event.preventDefault();
        openGoogleAuthExternally(targetUrl);
        mainWindow?.webContents.send('tab-loading-state', tabId, false, view.webContents.getURL());
        return true;
    }
    if (isExternalProtocol(targetUrl)) {`,
  'navigation Google auth external mode after stability hotfix'
);

main = replaceOnce(
  main,
  `function blockNavigationIfUnsafe(tabId: string, view: BrowserView, event: Electron.Event, targetUrl: string, sourceUrl?: string): boolean {
    if (isHardBlockedHost(targetUrl)`,
  `function blockNavigationIfUnsafe(tabId: string, view: BrowserView, event: Electron.Event, targetUrl: string, sourceUrl?: string): boolean {
    if (isGoogleAuthUrl(targetUrl)) {
        event.preventDefault();
        openGoogleAuthExternally(targetUrl);
        mainWindow?.webContents.send('tab-loading-state', tabId, false, view.webContents.getURL());
        return true;
    }
    if (isHardBlockedHost(targetUrl)`,
  'navigation Google auth external mode on base main.ts'
);

main = replaceOnce(
  main,
  `view.webContents.setWindowOpenHandler((details): Electron.WindowOpenHandlerResponse => {
        const sourceUrl = view.webContents.getURL();
        if (isExternalProtocol(details.url)) {`,
  `view.webContents.setWindowOpenHandler((details): Electron.WindowOpenHandlerResponse => {
        const sourceUrl = view.webContents.getURL();
        if (isGoogleAuthUrl(details.url)) {
            openGoogleAuthExternally(details.url);
            return { action: 'deny' };
        }
        if (isExternalProtocol(details.url)) {`,
  'window-open Google auth external mode after stability hotfix'
);

main = replaceOnce(
  main,
  `view.webContents.setWindowOpenHandler((details): Electron.HandlerDetails => {
        const sourceUrl = view.webContents.getURL();
        if (isHardBlockedHost(details.url)`,
  `view.webContents.setWindowOpenHandler((details): Electron.WindowOpenHandlerResponse => {
        const sourceUrl = view.webContents.getURL();
        if (isGoogleAuthUrl(details.url)) {
            openGoogleAuthExternally(details.url);
            return { action: 'deny' };
        }
        if (isHardBlockedHost(details.url)`,
  'window-open Google auth external mode on base main.ts'
);

main = replaceOnce(
  main,
  `ipcMain.handle('navigate-tab', async (_event, tabId: string, url: string): Promise<void> => {
    if (isHomeUrl(url)) {`,
  `ipcMain.handle('navigate-tab', async (_event, tabId: string, url: string): Promise<void> => {
    if (isGoogleAuthUrl(url)) {
        openGoogleAuthExternally(url);
        return;
    }
    if (isHomeUrl(url)) {`,
  'navigate-tab Google auth external mode'
);

main = replaceOnce(
  main,
  `ipcMain.handle('navigate-to', async (_event, url: string): Promise<string | null> => {
    if (!mainWindow) return null;
    if (isHomeUrl(url)) {`,
  `ipcMain.handle('navigate-to', async (_event, url: string): Promise<string | null> => {
    if (!mainWindow) return null;
    if (isGoogleAuthUrl(url)) {
        openGoogleAuthExternally(url);
        return null;
    }
    if (isHomeUrl(url)) {`,
  'navigate-to Google auth external mode'
);

if (before !== main) {
  fs.writeFileSync(mainPath, main, 'utf8');
  log('patched src/main/main.ts');
} else {
  log('no changes needed');
}
