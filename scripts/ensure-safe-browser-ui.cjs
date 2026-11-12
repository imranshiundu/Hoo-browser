#!/usr/bin/env node
/**
 * Hoo Browser build guard.
 *
 * This used to be a string-patching script that rewrote main.ts on every
 * build, which quietly produced a browser whose context menu, downloads,
 * find-in-page and new-tab links were never wired up. It is now a pure
 * verification step: it fails the build if a critical handler is missing,
 * instead of silently patching source files.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

let failed = false;
const check = (label, haystack, needle) => {
    if (!haystack.includes(needle)) {
        console.error(`[Hoo safe-ui] MISSING in ${label}: ${needle}`);
        failed = true;
    }
};

const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');

// Every entry below corresponds to a real user-facing regression Hoo shipped
// at least once: dead downloads, no right-click menu, broken Ctrl+F, links
// that would not open in new tabs, no favicons, no app menu accelerators.
const mainChecks = [
    'setupDownloadManager(',
    'setupBrowserContextMenu(',
    "ipcMain.handle('find-in-page'",
    "ipcMain.handle('stop-find-in-page'",
    "ipcMain.handle('get-downloads'",
    "ipcMain.handle('open-download'",
    "ipcMain.handle('toggle-tab-mute'",
    "ipcMain.handle('get-history'",
    "ipcMain.handle('stop-loading'",
    "sendToShell('open-url-in-new-tab'",
    "sendToShell('tab-favicon-updated'",
    "sendToShell('tab-audio-updated'",
    "sendToShell('nav-state-updated'",
    "sendToShell('ui-shortcut'",
    "sendToShell('find-result'",
    'Menu.setApplicationMenu',
    'render-process-gone',
    'purgeGhostHomeTabs',
    'createTabIdFactory()'
];

const preloadChecks = [
    'findInPage:',
    'stopFindInPage:',
    'getDownloads:',
    'openDownload:',
    'getHistory:',
    'toggleTabMute:',
    'stopLoading:',
    'onUiShortcut:',
    'onOpenUrlInNewTab:',
    'onTabFaviconUpdated:',
    'onTabAudioUpdated:',
    'onNavStateUpdated:',
    'onDownloadUpdated:',
    'onZoomChanged:'
];

mainChecks.forEach((needle) => check('src/main/main.ts', main, needle));
preloadChecks.forEach((needle) => check('src/preload/preload.ts', preload, needle));

if (failed) {
    console.error('[Hoo safe-ui] Browser wiring is incomplete; refusing to build.');
    process.exit(1);
}

console.log('[Hoo safe-ui] All browser wiring verified.');
