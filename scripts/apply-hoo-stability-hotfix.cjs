#!/usr/bin/env node
/*
 * Hoo stability + auth compatibility hotfix
 *
 * Idempotent local patcher for the BrowserView main-process file.
 * It must not leave main.ts in a half-patched state.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'src/main/main.ts');

function die(message) {
  console.error(`[Hoo hotfix] ${message}`);
  process.exit(1);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    console.warn(`[Hoo hotfix] skipped ${label}; pattern was not found or already applied`);
    return source;
  }
  return source.replace(search, replacement);
}

function replaceRegex(source, regex, replacement, label) {
  if (!regex.test(source)) {
    console.warn(`[Hoo hotfix] skipped ${label}; pattern was not found or already applied`);
    return source;
  }
  return source.replace(regex, replacement);
}

function writeChanged(file, before, after) {
  if (before === after) {
    console.log(`[Hoo hotfix] no changes needed: ${path.relative(root, file)}`);
    return;
  }
  fs.writeFileSync(file, after, 'utf8');
  console.log(`[Hoo hotfix] patched: ${path.relative(root, file)}`);
}

function ensureElectronImport(source) {
  const match = source.match(/import \{([^}]+)\} from ["']electron["'];/);
  if (!match) return source;
  const names = match[1].split(',').map(item => item.trim()).filter(Boolean);
  for (const required of ['app', 'BrowserWindow', 'BrowserView', 'ipcMain', 'session', 'shell']) {
    if (!names.includes(required)) names.push(required);
  }
  return source.replace(match[0], `import { ${names.join(', ')} } from "electron";`);
}

function ensurePrivacyImport(source) {
  const match = source.match(/import \{([^}]+)\} from ["']\.\/privacy-filters["'];/);
  if (!match) return source;
  const names = match[1].split(',').map(item => item.trim()).filter(Boolean);
  for (const required of [
    'shouldBlockRequest',
    'getRandomUserAgent',
    'isMaliciousUrl',
    'stripJunkRequestHeaders',
    'stripJunkResponseHeaders',
    'isLikelyForcedRedirect',
    'isHardBlockedHost',
    'isExternalProtocol',
    'isCompatibilityHost'
  ]) {
    if (!names.includes(required)) names.push(required);
  }
  return source.replace(match[0], `import { ${names.join(', ')} } from "./privacy-filters";`);
}

if (!fs.existsSync(mainPath)) die('Run from the Hoo-browser repo root. Missing src/main/main.ts');

const originalMain = fs.readFileSync(mainPath, 'utf8');
let main = originalMain;

main = ensureElectronImport(main);
main = ensurePrivacyImport(main);

main = replaceOnce(
  main,
  'const WHATSAPP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) WhatsApp/2.24.4.78 Chrome/120.0.6099.225 Electron/30.0.0 Safari/537.36";',
  'const WHATSAPP_UA = getRandomUserAgent();',
  'WhatsApp normal browser UA'
);

main = main.replace(/Electron\.HandlerDetails/g, 'Electron.WindowOpenHandlerResponse');

main = replaceRegex(
  main,
  /function buildErrorPage\(url: string, description: string\): string \{[\s\S]*?\n\}\n\nfunction buildBlockedPage\(url: string, reason: string\): string \{[\s\S]*?\n\}\n\nfunction blockNavigationIfUnsafe/,
  `function escapeHooHtml(value: string): string {
    return String(value || '').replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char] || char));
}

function cleanDisplayUrl(url: string): string {
    if (!url) return 'this page';
    if (isExternalProtocol(url)) return String(url).split(':', 1)[0] + ': link';
    try {
        return new URL(url).hostname.replace(/^www\\./, '');
    } catch {
        return 'this page';
    }
}

function buildHooStatusPage(kind: 'error' | 'blocked', title: string, message: string, url: string): string {
    const owlPath = resolveAssetPath('assets/branding/hoo-app-icon.png').replace(/\\\\/g, '/');
    const owl = fs.existsSync(owlPath) ? 'file://' + owlPath : '';
    const safeTitle = escapeHooHtml(title);
    const safeMessage = escapeHooHtml(message);
    const displayUrl = escapeHooHtml(cleanDisplayUrl(url));
    const html = \`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 25% 18%,rgba(255,102,0,.13),transparent 34%),linear-gradient(180deg,#070909,#020303);color:#f4f4f5;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;overflow:hidden}.wrap{width:min(620px,calc(100vw - 42px));text-align:center;padding:18px}.owl{width:106px;height:106px;border-radius:30px;object-fit:cover;margin:0 auto 18px;filter:drop-shadow(0 18px 35px rgba(255,102,0,.22))}.badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,102,0,.11);border:1px solid rgba(255,102,0,.22);color:#ffb36b;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px}body.blocked .badge{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.22);color:#86efac}h1{margin:0 0 10px;font-size:clamp(28px,4vw,46px);letter-spacing:-.05em;line-height:.98}p{margin:0 auto;color:#b8bec7;font-size:15px;line-height:1.65;max-width:520px}.url{margin:18px auto 0;color:#8b949e;font-size:13px;max-width:520px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:26px}button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:#fff;border-radius:14px;padding:11px 15px;font-weight:750;cursor:pointer}button.primary{background:#ff6a00;border-color:#ff6a00;color:#130800}.details{margin-top:18px;color:#747b86;font-size:12px}
</style></head><body class="\${kind}"><main class="wrap">\${owl ? \`<img class="owl" src="\${owl}" alt="Hoo owl">\` : ''}<div class="badge">\${kind === 'blocked' ? 'Hoo Shield' : 'Hoo'}</div><h1>\${safeTitle}</h1><p>\${safeMessage}</p><div class="url" title="\${displayUrl}">\${displayUrl}</div><div class="actions"><button class="primary" onclick="location.reload()">Refresh</button><button onclick="history.back()">Go back</button><button onclick="location.href='hoo://home'">Go home</button></div><div class="details">Hoo kept the browser alive instead of showing a blank or technical page.</div></main></body></html>\`;
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function buildErrorPage(url: string, description: string): string {
    const message = description && !description.includes('ERR_') ? description : 'The page did not respond. Check your connection and refresh.';
    return buildHooStatusPage('error', 'Hoo could not open this page', message, url);
}

function buildBlockedPage(url: string, reason: string): string {
    return buildHooStatusPage('blocked', 'Hoo stopped a popup', reason || 'This site tried to open a suspicious new window.', url);
}

function blockNavigationIfUnsafe`,
  'Hoo status pages'
);

main = replaceRegex(
  main,
  /function blockNavigationIfUnsafe\(tabId: string, view: BrowserView, event: Electron\.Event, targetUrl: string, sourceUrl\?: string\): boolean \{[\s\S]*?\n\}\n\nfunction injectSitePolish/,
  `function blockNavigationIfUnsafe(tabId: string, view: BrowserView, event: Electron.Event, targetUrl: string, sourceUrl?: string): boolean {
    if (isExternalProtocol(targetUrl)) {
        event.preventDefault();
        void shell.openExternal(targetUrl).catch(() => undefined);
        mainWindow?.webContents.send('tab-loading-state', tabId, false, view.webContents.getURL());
        return true;
    }
    if (isHardBlockedHost(targetUrl) || isLikelyForcedRedirect(targetUrl, sourceUrl || view.webContents.getURL())) {
        event.preventDefault();
        mainWindow?.webContents.send('tab-loading-state', tabId, false, view.webContents.getURL());
        void view.webContents.loadURL(buildBlockedPage(targetUrl, 'This site tried to open a suspicious redirect. Hoo stopped it.'));
        return true;
    }
    return false;
}

function injectSitePolish`,
  'navigation blocker external protocol handling'
);

main = replaceRegex(
  main,
  /view\.webContents\.setWindowOpenHandler\(\(details\): Electron\.WindowOpenHandlerResponse => \{[\s\S]*?\n\s*\}\);/,
  `view.webContents.setWindowOpenHandler((details): Electron.WindowOpenHandlerResponse => {
        const sourceUrl = view.webContents.getURL();
        if (isExternalProtocol(details.url)) {
            void shell.openExternal(details.url).catch(() => undefined);
            return { action: 'deny' };
        }
        if (isHardBlockedHost(details.url) || isLikelyForcedRedirect(details.url, sourceUrl)) {
            mainWindow?.webContents.send('tab-loading-state', tabId, false, sourceUrl);
            return { action: 'deny' };
        }
        if (details.disposition === 'foreground-tab' || details.disposition === 'background-tab' || details.disposition === 'new-window') {
            mainWindow?.webContents.send('open-url-in-new-tab', details.url);
            return { action: 'deny' };
        }
        return { action: 'deny' };
    });`,
  'tab window-open handler'
);

main = replaceRegex(
  main,
  /view\.webContents\.on\('did-fail-load', \(_event, errorCode, errorDescription, validatedURL\): void => \{[\s\S]*?\n\s*\}\);/,
  `view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame): void => {
        mainWindow?.webContents.send('tab-loading-state', tabId, false, validatedURL);
        mainWindow?.webContents.send('tab-load-error', tabId, errorCode, errorDescription, validatedURL);
        if (!isMainFrame) return;
        if (errorCode === -3 || errorCode === -20 || errorCode === -27) return;
        if (validatedURL && !validatedURL.startsWith('data:')) {
            void view.webContents.loadURL(buildErrorPage(validatedURL, errorDescription));
        }
    });`,
  'main-frame-only error handling'
);

main = replaceOnce(
  main,
  "ipcMain.handle('reload', async (_event, tabId: string): Promise<void> => { browserViews.get(tabId)?.webContents.reload(); });",
  "ipcMain.handle('reload', async (_event, tabId: string): Promise<void> => { browserViews.get(tabId)?.webContents.reloadIgnoringCache(); });",
  'reloadIgnoringCache'
);

main = replaceOnce(
  main,
  "let finalUrl = url;\n    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;",
  "if (isExternalProtocol(url)) {\n        void shell.openExternal(url).catch(() => undefined);\n        return;\n    }\n    let finalUrl = url;\n    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;",
  'navigate-tab external protocol'
);

main = replaceOnce(
  main,
  "let finalUrl = url;\n    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;\n    if (await isMaliciousUrl(finalUrl))",
  "if (isExternalProtocol(url)) {\n        void shell.openExternal(url).catch(() => undefined);\n        return null;\n    }\n    let finalUrl = url;\n    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) finalUrl = 'https://' + url;\n    if (await isMaliciousUrl(finalUrl))",
  'navigate-to external protocol'
);

main = replaceRegex(
  main,
  /requestHeaders\['DNT'\] = '1';\n\s*requestHeaders\['Sec-GPC'\] = '1';\n\s*requestHeaders\['Accept-Language'\] = 'en-US,en;q=0.9';\n\s*if \(privacySettings\.deepSpoof && details\.url\.includes\('web\.whatsapp\.com'\)\) requestHeaders\['User-Agent'\] = WHATSAPP_UA;\n\s*else requestHeaders\['User-Agent'\] = getRandomUserAgent\(\);/,
  `if (!isCompatibilityHost(details.url) && !isCompatibilityHost(getPageUrlForRequest(details))) {
            requestHeaders['DNT'] = '1';
            requestHeaders['Sec-GPC'] = '1';
        }
        requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        requestHeaders['User-Agent'] = details.url.includes('web.whatsapp.com') ? WHATSAPP_UA : getRandomUserAgent();`,
  'auth-safe request headers'
);

main = replaceRegex(
  main,
  /if \(privacySettings\.deepSpoof && url\.includes\('web\.whatsapp\.com'\)\) \{[\s\S]*?\n\s*\} else \{\n\s*view\.webContents\.setUserAgent\(getRandomUserAgent\(\)\);\n\s*\}/,
  `if (url.includes('web.whatsapp.com')) {
            view.webContents.setUserAgent(WHATSAPP_UA);
        } else {
            view.webContents.setUserAgent(getRandomUserAgent());
        }`,
  'remove brittle WhatsApp navigator spoof'
);

if (!main.includes("process.env.HOO_USER_DATA_DIR") && main.includes('app.setName("Hoo Browser");')) {
  main = replaceOnce(
    main,
    'app.setName("Hoo Browser");',
    `app.setName("Hoo Browser");
if (process.env.HOO_USER_DATA_DIR) {
    app.setPath('userData', process.env.HOO_USER_DATA_DIR);
}`,
    'auth trace userData path'
  );
}

if (!main.includes("app.on('web-contents-created'")) {
  main = replaceOnce(
    main,
    'app.setName("Hoo Browser");',
    `app.setName("Hoo Browser");

app.on('web-contents-created', (_event, contents): void => {
    contents.setWindowOpenHandler(({ url }): Electron.WindowOpenHandlerResponse => {
        if (isExternalProtocol(url)) {
            void shell.openExternal(url).catch(() => undefined);
            return { action: 'deny' };
        }
        if (isHardBlockedHost(url)) return { action: 'deny' };
        return { action: 'deny' };
    });
});`,
    'global popup blocker'
  );
}

writeChanged(mainPath, originalMain, main);
console.log('[Hoo hotfix] done. Run: npm run build && npm start');
