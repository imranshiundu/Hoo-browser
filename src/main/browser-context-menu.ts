import { BrowserView, BrowserWindow, Menu, MenuItemConstructorOptions, clipboard, shell } from 'electron';

export type BrowserContextMenuActions = {
    openUrlInNewTab: (url: string) => void;
    openUrlInCurrentTab: (url: string) => void;
};

function hasValue(value?: string): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function getSearchUrl(text: string): string {
    return `https://duckduckgo.com/?q=${encodeURIComponent(text.trim())}`;
}

function shortened(value: string, max = 56): string {
    const clean = value.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function isLikelyImage(url: string, mediaType?: string): boolean {
    return mediaType === 'image' || /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|#|$)/i.test(url);
}

function isDownloadable(url: string): boolean {
    return /\.(zip|tar|gz|7z|rar|pdf|docx?|xlsx?|pptx?|apk|exe|deb|rpm|mp[34]|mov|webm|png|jpe?g|gif|webp)(\?|#|$)/i.test(url);
}

export function setupBrowserContextMenu(view: BrowserView, actions: BrowserContextMenuActions): void {
    view.webContents.on('context-menu', (_event, params): void => {
        const selectionText = params.selectionText?.trim() || '';
        const linkUrl = params.linkURL?.trim() || '';
        const srcUrl = params.srcURL?.trim() || '';
        const pageUrl = params.pageURL?.trim() || view.webContents.getURL();
        const isEditable = params.isEditable;
        const template: MenuItemConstructorOptions[] = [];

        if (hasValue(selectionText)) {
            template.push(
                {
                    label: `Search DuckDuckGo for “${shortened(selectionText, 34)}”`,
                    click: () => actions.openUrlInNewTab(getSearchUrl(selectionText))
                },
                {
                    label: 'Copy selected text',
                    accelerator: 'CmdOrCtrl+C',
                    click: () => clipboard.writeText(selectionText)
                },
                { type: 'separator' }
            );
        }

        if (hasValue(linkUrl)) {
            template.push(
                { label: 'Open link in new tab', click: () => actions.openUrlInNewTab(linkUrl) },
                { label: 'Open link here', click: () => actions.openUrlInCurrentTab(linkUrl) },
                { label: 'Open link externally', click: () => shell.openExternal(linkUrl) },
                { label: 'Copy link address', click: () => clipboard.writeText(linkUrl) }
            );
            if (isDownloadable(linkUrl)) template.push({ label: 'Download linked file', click: () => actions.openUrlInNewTab(linkUrl) });
            template.push({ type: 'separator' });
        }

        if (hasValue(srcUrl)) {
            const isImage = isLikelyImage(srcUrl, params.mediaType);
            const isVideo = params.mediaType === 'video';
            const isAudio = params.mediaType === 'audio';
            if (isImage) {
                template.push(
                    { label: 'Open image in new tab', click: () => actions.openUrlInNewTab(srcUrl) },
                    { label: 'Copy image address', click: () => clipboard.writeText(srcUrl) },
                    { label: 'Open image externally', click: () => shell.openExternal(srcUrl) },
                    { type: 'separator' }
                );
            } else if (isVideo || isAudio) {
                const mediaLabel = isVideo ? 'video' : 'audio';
                template.push(
                    { label: `Open ${mediaLabel} in new tab`, click: () => actions.openUrlInNewTab(srcUrl) },
                    { label: `Copy ${mediaLabel} address`, click: () => clipboard.writeText(srcUrl) },
                    { label: `Open ${mediaLabel} externally`, click: () => shell.openExternal(srcUrl) },
                    { type: 'separator' }
                );
            }
        }

        if (isEditable) {
            template.push(
                { role: 'undo', label: 'Undo' },
                { role: 'redo', label: 'Redo' },
                { type: 'separator' },
                { role: 'cut', label: 'Cut' },
                { role: 'copy', label: 'Copy' },
                { role: 'paste', label: 'Paste' },
                { role: 'selectAll', label: 'Select all' },
                { type: 'separator' }
            );
        } else if (!hasValue(selectionText)) {
            template.push(
                { role: 'copy', label: 'Copy' },
                { role: 'selectAll', label: 'Select all' },
                { type: 'separator' }
            );
        }

        template.push(
            { label: 'Back', enabled: view.webContents.canGoBack(), click: () => view.webContents.goBack() },
            { label: 'Forward', enabled: view.webContents.canGoForward(), click: () => view.webContents.goForward() },
            { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => view.webContents.reload() },
            { type: 'separator' },
            { label: 'Copy page address', enabled: hasValue(pageUrl), click: () => clipboard.writeText(pageUrl) },
            { label: 'Open page externally', enabled: hasValue(pageUrl), click: () => shell.openExternal(pageUrl) }
        );

        if (!view.webContents.isDevToolsOpened()) {
            template.push({ type: 'separator' }, { label: 'Inspect element', click: () => view.webContents.inspectElement(params.x, params.y) });
        }

        Menu.buildFromTemplate(template).popup({ window: BrowserWindow.fromWebContents(view.webContents) || undefined });
    });
}
