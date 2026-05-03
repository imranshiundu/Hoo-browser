import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface DownloadRecord {
    id: string;
    url: string;
    filename: string;
    savePath: string;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
    receivedBytes: number;
    totalBytes: number;
    startedAt: number;
    endedAt?: number;
    danger?: string;
}

export interface CrashedTabRecord {
    id: string;
    tabId: string;
    url: string;
    title: string;
    reason: string;
    exitCode?: number;
    crashedAt: number;
}

export type BrowserTabLifecycle = 'placeholder' | 'loaded' | 'sleeping' | 'crashed';

export interface BrowserTabRecord {
    id: string;
    type: 'browser';
    title: string;
    url: string;
    isApp?: boolean;
    partition?: string;
    lifecycle?: BrowserTabLifecycle;
    lastActiveAt?: number;
    restoredLazy?: boolean;
}

export interface StorageData {
    tabs: any[];
    history: any[];
    downloads: DownloadRecord[];
    crashedTabs: CrashedTabRecord[];
    settings: {
        dataRetention: '1d' | '7d' | '30d' | 'forever';
        [key: string]: any;
    };
    activeTabId: string | null;
    lastUpdated: number;
}

const STORAGE_FILE = path.join(app.getPath('userData'), 'user-data.json');

const defaultData: StorageData = {
    tabs: [],
    history: [],
    downloads: [],
    crashedTabs: [],
    settings: {
        dataRetention: 'forever',
        deepSpoof: true,
        lazySessionRestore: true,
        maxLiveBackgroundTabs: 4,
        sleepIdleTabsAfterMinutes: 15
    },
    activeTabId: 'home',
    lastUpdated: Date.now()
};

function normalizeStorageData(data: Partial<StorageData>): StorageData {
    const browserTabs = (data.tabs || [])
        .filter((tab: any) => tab?.type === 'browser')
        .filter((tab: any) => tab.url && tab.url !== 'about:blank')
        .slice(0, 12);

    const activeTabId = browserTabs.some((tab: any) => tab.id === data.activeTabId)
        ? data.activeTabId || 'home'
        : 'home';

    return {
        ...defaultData,
        ...data,
        tabs: browserTabs,
        activeTabId,
        settings: { ...defaultData.settings, ...(data.settings || {}) },
        history: data.history || [],
        downloads: data.downloads || [],
        crashedTabs: data.crashedTabs || []
    };
}

export class StorageService {
    static encryptionAvailable(): boolean {
        return safeStorage.isEncryptionAvailable();
    }

    static load(): StorageData {
        try {
            if (fs.existsSync(STORAGE_FILE)) {
                const content = fs.readFileSync(STORAGE_FILE);

                let jsonString: string;
                if (safeStorage.isEncryptionAvailable()) {
                    try {
                        jsonString = safeStorage.decryptString(content);
                    } catch (e) {
                        console.warn('[Storage] Decryption failed, attempting plain text read...');
                        jsonString = content.toString('utf8');
                    }
                } else {
                    jsonString = content.toString('utf8');
                }

                const data = JSON.parse(jsonString);
                return normalizeStorageData(data);
            }
        } catch (error) {
            console.error('[Storage] Error loading data:', error);
            try {
                if (fs.existsSync(STORAGE_FILE)) {
                    const brokenPath = `${STORAGE_FILE}.broken-${Date.now()}`;
                    fs.renameSync(STORAGE_FILE, brokenPath);
                    console.warn(`[Storage] Broken profile data moved to ${brokenPath}. Starting clean instead of rendering stale tabs.`);
                }
            } catch (moveError) {
                console.error('[Storage] Could not quarantine broken data:', moveError);
            }
        }
        return defaultData;
    }

    static save(data: Partial<StorageData>) {
        try {
            const currentData = this.load();
            const mergedSettings = data.settings
                ? { ...currentData.settings, ...data.settings }
                : currentData.settings;
            const newData = normalizeStorageData({
                ...currentData,
                ...data,
                settings: mergedSettings,
                lastUpdated: Date.now()
            });
            const jsonString = JSON.stringify(newData, null, 2);

            if (safeStorage.isEncryptionAvailable()) {
                const encrypted = safeStorage.encryptString(jsonString);
                fs.writeFileSync(STORAGE_FILE, encrypted);
            } else {
                fs.writeFileSync(STORAGE_FILE, jsonString);
            }
        } catch (error) {
            console.error('[Storage] Error saving data:', error);
        }
    }

    static upsertDownload(record: DownloadRecord) {
        const data = this.load();
        const index = data.downloads.findIndex(item => item.id === record.id);
        if (index >= 0) data.downloads[index] = record;
        else data.downloads.unshift(record);
        this.save({ downloads: data.downloads.slice(0, 200) });
    }

    static recordCrashedTab(record: CrashedTabRecord) {
        const data = this.load();
        data.crashedTabs.unshift(record);
        this.save({ crashedTabs: data.crashedTabs.slice(0, 50) });
    }

    static markTabLifecycle(tabId: string, lifecycle: BrowserTabLifecycle) {
        const data = this.load();
        const tab = data.tabs.find(item => item.id === tabId && item.type === 'browser');
        if (tab) {
            tab.lifecycle = lifecycle;
            if (lifecycle === 'loaded') tab.lastActiveAt = Date.now();
            this.save({ tabs: data.tabs });
        }
    }

    static wipeAll() {
        try {
            if (fs.existsSync(STORAGE_FILE)) {
                fs.unlinkSync(STORAGE_FILE);
                console.log('[Storage] user-data.json purged.');
            }
        } catch (error) {
            console.error('[Storage] Error wiping data:', error);
        }
    }

    static cleanupHistory(retention: '1d' | '7d' | '30d' | 'forever') {
        if (retention === 'forever') return;

        const now = Date.now();
        const limits = {
            '1d': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };

        const cutoff = now - (limits[retention] || 0);
        const data = this.load();
        const originalCount = data.history.length;
        data.history = data.history.filter(entry => entry.timestamp > cutoff);

        if (data.history.length !== originalCount) {
            console.log(`[Storage] Cleaned up ${originalCount - data.history.length} history entries.`);
            this.save({ history: data.history });
        }
    }
}
