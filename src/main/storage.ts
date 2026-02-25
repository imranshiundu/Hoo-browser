import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface StorageData {
    tabs: any[];
    history: any[];
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
        { id: 'home', type: 'home', title: 'Home' },
        { id: 'dashboard', type: 'dashboard', title: 'Dashboard' },
        { id: 'apps', type: 'apps', title: 'Apps' },
        { id: 'rss', type: 'rss', title: 'RSS' },
        { id: 'privacy', type: 'privacy', title: 'Privacy' },
        { id: 'bookmarks', type: 'bookmarks', title: 'Bookmarks' },
        { id: 'extensions', type: 'extensions', title: 'Plugins' }
    ],
    history: [],
    settings: {
        dataRetention: 'forever',
        deepSpoof: true
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
                        // Fallback to plain text if decryption fails (likely transition from unencrypted)
                        console.warn('[Storage] Decryption failed, attempting plain text read...');
                        jsonString = content.toString('utf8');
                    }
                } else {
                    jsonString = content.toString('utf8');
                }

                const data = JSON.parse(jsonString);
                return { ...defaultData, ...data };
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

    static wipeAll() {
        try {
            if (fs.existsSync(STORAGE_FILE)) {
                fs.unlinkSync(STORAGE_FILE);
                console.log('☢️ [Storage] user-data.json purged.');
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
