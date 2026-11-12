import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// storage.ts imports `app` and `safeStorage` from electron at module load.
// Swap them for deterministic fakes so the profile logic runs in plain Node.
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoo-storage-test-'));

vi.mock('electron', () => ({
    app: {
        getPath: (_name: string) => userDataDir,
    },
    safeStorage: {
        isEncryptionAvailable: () => false,
        decryptString: (buffer: Buffer) => buffer.toString('utf8'),
    },
}));

import { StorageService, normalizeStorageData } from '../storage';

const browserTab = (id: string, url: string) => ({ id, type: 'browser', title: `Tab ${id}`, url });

describe('normalizeStorageData', () => {
    it('keeps only real browser tabs with usable URLs', () => {
        const data = normalizeStorageData({
            tabs: [
                browserTab('1', 'https://duckduckgo.com'),
                { id: '2', type: 'settings', title: 'Not a tab' },
                { id: '3', type: 'browser', title: 'Blank', url: 'about:blank' },
                { id: '4', type: 'browser', title: 'No url' },
            ] as any,
        });
        expect(data.tabs.map(t => t.id)).toEqual(['1']);
    });

    it('caps restored tabs at 12', () => {
        const tabs = Array.from({ length: 30 }, (_, i) => browserTab(`t${i}`, `https://example.com/${i}`));
        expect(normalizeStorageData({ tabs } as any).tabs).toHaveLength(12);
    });

    it('falls back to the home tab when the stored active tab no longer exists', () => {
        const data = normalizeStorageData({ tabs: [browserTab('1', 'https://x.com')], activeTabId: 'ghost' } as any);
        expect(data.activeTabId).toBe('home');

        const ok = normalizeStorageData({ tabs: [browserTab('1', 'https://x.com')], activeTabId: '1' } as any);
        expect(ok.activeTabId).toBe('1');
    });

    it('merges settings over defaults instead of replacing them', () => {
        const data = normalizeStorageData({ settings: { dataRetention: '7d' } } as any);
        expect(data.settings.dataRetention).toBe('7d');
        expect(data.settings.lazySessionRestore).toBe(true);
        expect(data.settings.maxLiveBackgroundTabs).toBe(4);
    });
});

describe('StorageService', () => {
    beforeEach(() => {
        StorageService.wipeAll();
    });

    it('starts with clean defaults when no profile file exists', () => {
        const data = StorageService.load();
        expect(data.tabs).toEqual([]);
        expect(data.downloads).toEqual([]);
        expect(data.crashedTabs).toEqual([]);
        expect(data.activeTabId).toBe('home');
    });

    it('saves and reloads profile data through an atomic write', () => {
        StorageService.save({
            tabs: [browserTab('a', 'https://example.com')],
            activeTabId: 'a',
        });

        const reloaded = StorageService.load();
        expect(reloaded.tabs).toHaveLength(1);
        expect(reloaded.tabs[0].url).toBe('https://example.com');
        expect(reloaded.activeTabId).toBe('a');
    });

    it('merges settings on save without losing previous keys', () => {
        StorageService.save({ settings: { dataRetention: '30d' } });
        StorageService.save({ settings: { dataRetention: '30d', deepSpoof: true } });

        const settings = StorageService.load().settings;
        expect(settings.dataRetention).toBe('30d');
        expect(settings.deepSpoof).toBe(true);
    });

    it('upserts downloads by id and keeps the newest first, capped at 200', () => {
        const record = (id: string) => ({
            id, url: `https://example.com/${id}.zip`, filename: `${id}.zip`,
            savePath: `/tmp/${id}.zip`, state: 'completed' as const,
            receivedBytes: 10, totalBytes: 10, startedAt: Date.now(), endedAt: Date.now(),
        });

        for (let i = 0; i < 210; i++) StorageService.upsertDownload(record(`d${i}`));
        let downloads = StorageService.load().downloads;
        expect(downloads).toHaveLength(200);
        expect(downloads[0].id).toBe('d209');

        StorageService.upsertDownload({ ...record('d209'), state: 'interrupted' });
        downloads = StorageService.load().downloads;
        expect(downloads).toHaveLength(200);
        expect(downloads[0].state).toBe('interrupted');
    });

    it('records crashed tabs for later recovery, capped at 50', () => {
        for (let i = 0; i < 55; i++) {
            StorageService.recordCrashedTab({
                id: `c${i}`, tabId: `t${i}`, url: `https://example.com/${i}`,
                title: `Crash ${i}`, reason: 'renderer-process-gone', crashedAt: Date.now(),
            });
        }
        const crashed = StorageService.load().crashedTabs;
        expect(crashed).toHaveLength(50);
        expect(crashed[0].id).toBe('c54');
    });

    it('marks tab lifecycle states and refreshes lastActiveAt on load', () => {
        StorageService.save({ tabs: [browserTab('x', 'https://example.com')] });

        StorageService.markTabLifecycle('x', 'sleeping');
        expect(StorageService.load().tabs[0].lifecycle).toBe('sleeping');

        const before = StorageService.load().tabs[0].lastActiveAt;
        StorageService.markTabLifecycle('x', 'loaded');
        const after = StorageService.load().tabs[0];
        expect(after.lifecycle).toBe('loaded');
        expect(after.lastActiveAt).toBeGreaterThanOrEqual(before || 0);
    });

    it('ignores lifecycle updates for unknown or non-browser tabs', () => {
        StorageService.save({ tabs: [browserTab('x', 'https://example.com')] });
        StorageService.markTabLifecycle('missing', 'sleeping');
        StorageService.markTabLifecycle('x', 'sleeping');
        expect(StorageService.load().tabs[0].lifecycle).toBe('sleeping');
    });

    it('quarantines corrupt JSON instead of crashing on load', () => {
        const storageFile = StorageService.getStorageFile();
        fs.writeFileSync(storageFile, '{ this is not json', 'utf8');

        const data = StorageService.load();
        expect(data.tabs).toEqual([]);

        const leftovers = fs.readdirSync(userDataDir).filter(f => f.startsWith('user-data.json.broken-'));
        expect(leftovers.length).toBeGreaterThanOrEqual(1);
        expect(fs.existsSync(storageFile)).toBe(false);
    });

    it('cleans history by retention window', () => {
        const now = Date.now();
        StorageService.save({
            history: [
                { url: 'https://old.example.com', timestamp: now - 40 * 24 * 60 * 60 * 1000 },
                { url: 'https://fresh.example.com', timestamp: now - 1000 },
            ],
        });

        StorageService.cleanupHistory('30d');
        const history = StorageService.load().history;
        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('https://fresh.example.com');

        StorageService.cleanupHistory('forever');
        expect(StorageService.load().history).toHaveLength(1);
    });

    it('normalizes and persists site permission decisions', () => {
        StorageService.save({
            sitePermissions: {
                'https://allowed.com|media': 'allow',
                'https://blocked.com|notifications': 'block',
                'junk|openExternal': 'allow',      // invalid origin + unknown permission
                'https://x.com|media': 'maybe'     // invalid value
            } as any,
        });
        const stored = StorageService.load().sitePermissions;
        expect(stored).toEqual({
            'https://allowed.com|media': 'allow',
            'https://blocked.com|notifications': 'block'
        });

        StorageService.setPermissionDecision('https://allowed.com|media', 'block');
        expect(StorageService.load().sitePermissions['https://allowed.com|media']).toBe('block');

        StorageService.clearPermissionDecisions('https://allowed.com|media');
        expect(StorageService.load().sitePermissions['https://allowed.com|media']).toBeUndefined();
        expect(StorageService.load().sitePermissions['https://blocked.com|notifications']).toBe('block');

        StorageService.clearPermissionDecisions();
        expect(StorageService.load().sitePermissions).toEqual({});
    });

    it('normalizes and persists per-site zoom levels', () => {
        StorageService.save({ siteZooms: { 'https://github.com': 110, 'junk': 999 } as any });
        expect(StorageService.load().siteZooms).toEqual({ 'https://github.com': 110 });

        StorageService.setSiteZoom('https://github.com', 150);
        expect(StorageService.load().siteZooms['https://github.com']).toBe(150);

        StorageService.removeSiteZoom('https://github.com');
        expect(StorageService.load().siteZooms['https://github.com']).toBeUndefined();

        StorageService.setSiteZoom('https://news.ycombinator.com', 90);
        StorageService.clearSiteZooms();
        expect(StorageService.load().siteZooms).toEqual({});
    });

    it('clears all history on demand', () => {
        StorageService.save({ history: [{ url: 'https://x.com', timestamp: Date.now() }] });
        StorageService.clearAllHistory();
        expect(StorageService.load().history).toEqual([]);
    });

    it('survives a profile file that contains corrupt site data', () => {
        StorageService.save({ tabs: [{ id: 'a', type: 'browser', title: 'A', url: 'https://a.com' }], activeTabId: 'a' });
        const storageFile = StorageService.getStorageFile();
        fs.writeFileSync(storageFile, JSON.stringify({
            tabs: [{ id: 'a', type: 'browser', title: 'A', url: 'https://a.com' }],
            activeTabId: 'a',
            sitePermissions: 'garbage',
            siteZooms: { 'nope': 'x' }
        }), 'utf8');
        const data = StorageService.load();
        expect(data.sitePermissions).toEqual({});
        expect(data.siteZooms).toEqual({});
        expect(data.tabs).toHaveLength(1);
    });
});
