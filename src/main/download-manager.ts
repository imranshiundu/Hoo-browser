import { app, BrowserWindow, DownloadItem, session, shell } from 'electron';
import * as path from 'path';
import { StorageService, DownloadRecord } from './storage';

function sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || `hoo-download-${Date.now()}`;
}

function riskyFileHint(filename: string): string | undefined {
    const ext = path.extname(filename).toLowerCase();
    const risky = new Set(['.exe', '.msi', '.bat', '.cmd', '.ps1', '.scr', '.vbs', '.jar', '.apk', '.deb', '.appimage']);
    return risky.has(ext) ? `Executable or installer file (${ext}). Only open it if you trust the source.` : undefined;
}

export function setupDownloadManager(mainWindowProvider: () => BrowserWindow | null) {
    session.defaultSession.on('will-download', (_event, item: DownloadItem) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const filename = sanitizeFilename(item.getFilename());
        const savePath = path.join(app.getPath('downloads'), filename);
        const danger = riskyFileHint(filename);

        item.setSavePath(savePath);

        const base: DownloadRecord = {
            id,
            url: item.getURL(),
            filename,
            savePath,
            state: 'progressing',
            receivedBytes: 0,
            totalBytes: item.getTotalBytes(),
            startedAt: Date.now(),
            danger
        };

        StorageService.upsertDownload(base);
        mainWindowProvider()?.webContents.send('download-updated', base);

        item.on('updated', (_event, state) => {
            const record: DownloadRecord = {
                ...base,
                state: state === 'interrupted' ? 'interrupted' : 'progressing',
                receivedBytes: item.getReceivedBytes(),
                totalBytes: item.getTotalBytes()
            };
            StorageService.upsertDownload(record);
            mainWindowProvider()?.webContents.send('download-updated', record);
        });

        item.once('done', (_event, state) => {
            const record: DownloadRecord = {
                ...base,
                state: state as DownloadRecord['state'],
                receivedBytes: item.getReceivedBytes(),
                totalBytes: item.getTotalBytes(),
                endedAt: Date.now()
            };
            StorageService.upsertDownload(record);
            mainWindowProvider()?.webContents.send('download-updated', record);
        });
    });
}

export function openDownloadFolder(savePath?: string) {
    if (savePath) {
        shell.showItemInFolder(savePath);
        return true;
    }
    shell.openPath(app.getPath('downloads'));
    return true;
}
