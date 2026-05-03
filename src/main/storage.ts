import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface StorageData {
    tabs: any[];
    history: any[];
    downloads: any[];
    crashedTabs: any[];
    permissions: Record<string, Record<string, 'allow' | 'deny' | 'ask'>>;
    settings: {
        dataRetention: '1d' | '7d' | '30d' | 'forever';
        [key: string]: any;
    };
    activeTabId: string | null;
    lastUpdated: number;
}

const STORAGE_FILE = path.join(app.getPath('userData'), 'user-data.json');

const defaultData: StorageData = {
    tabs: [
        { id: 'home', type: 'home', title: 'Hoo Home' },
        { id: 'dashboard', type: 'dashboard', title: 'Nest' },
        { id: 'apps', type: 'apps', title: 'Apps' },
        { id: 'rss', type: 'rss', title: 'RSS' },
        { id: 'privacy', type: 'privacy', title: 'Privacy' },
        { id: 'bookmarks', type: 'bookmarks', title: 'Bookmarks' },
        { id: 'extensions', type: 'extensions', title: 'Plugins' }
    ],
    history: [],
    downloads: [],
    crashedTabs: [],
    permissions: {},
    settings: {
        dataRetention: 'forever',
        deepSpoof: true,
        defaultSearchEngine: 'duckduckgo',
        browserName: 'Hoo Browser'
    },
    activeTabId: 'home',
    lastUpdated: Date.now()
};

export class StorageService {
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
                return {
                    ...defaultData,
                    ...data,
                    settings: { ...defaultData.settings, ...(data.settings || {}) },
                    downloads: data.downloads || [],
                    crashedTabs: data.crashedTabs || [],
                    permissions: data.permissions || {}
                };
            }
        } catch (error) {
            console.error('[Storage] Error loading data:', error);
        }
        return defaultData;
    }

    static save(data: Partial<StorageData>) {
        try {
            const currentData = this.load();
            const newData = { ...currentData, ...data, lastUpdated: Date.now() };
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

    static getEncryptionStatus() {
        const available = safeStorage.isEncryptionAvailable();
        return {
            available,
            status: available ? 'protected-by-os' : 'plaintext-fallback',
            label: available ? 'Protected by OS encryption' : 'Local encryption unavailable',
            detail: available
                ? 'Hoo can encrypt local profile data through the operating system keychain or secret service.'
                : 'Your OS session does not expose local encryption to Electron. Profile data may be stored as plaintext.'
        };
    }

    static recordDownload(entry: any) {
        const data = this.load();
        const downloads = [entry, ...(data.downloads || [])].slice(0, 250);
        this.save({ downloads });
    }

    static recordCrashedTab(entry: any) {
        const data = this.load();
        const crashedTabs = [entry, ...(data.crashedTabs || [])].slice(0, 50);
        this.save({ crashedTabs });
    }

    static setPermission(origin: string, permission: string, decision: 'allow' | 'deny' | 'ask') {
        const data = this.load();
        const permissions = { ...(data.permissions || {}) };
        permissions[origin] = { ...(permissions[origin] || {}), [permission]: decision };
        this.save({ permissions });
    }

    static getPermission(origin: string, permission: string): 'allow' | 'deny' | 'ask' {
        const data = this.load();
        return data.permissions?.[origin]?.[permission] || 'ask';
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
