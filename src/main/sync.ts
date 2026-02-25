import { Storage } from 'megajs';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { StorageService } from './storage';

const STORAGE_FILE = path.join(app.getPath('userData'), 'user-data.json');

export class MegaSyncService {
    private static storage: Storage | null = null;
    private static isSyncing = false;
    private static syncInterval: any = null;

    static async login(email: string, pass: string): Promise<boolean> {
        try {
            console.log('[MegaSync] Attempting login...');
            this.storage = await new Storage({ email, password: pass }).ready;
            console.log('[MegaSync] Login successful.');
            this.startAutoSync();

            // Initial Sync (Download if cloud is newer, otherwise upload)
            // For simplicity, we'll just trigger an upload on login for now.
            // A full two-way sync requires comparing timestamps inside the JSON.
            this.syncNow();

            return true;
        } catch (error) {
            console.error('[MegaSync] Login failed:', error);
            return false;
        }
    }

    static async logout() {
        this.stopAutoSync();
        this.storage = null;
        console.log('[MegaSync] Logged out.');
    }

    static startAutoSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => this.syncNow(), 5 * 60 * 1000); // 5 mins
    }

    static stopAutoSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
    }

    static async syncNow() {
        if (!this.storage || this.isSyncing) return;
        this.isSyncing = true;
        console.log('[MegaSync] Starting sync...');
        try {
            await this.storage.reload(); // Refresh the node tree

            let folder = this.storage.root.children?.find(c => c.name === 'ZenBrowserSync');

            if (!folder) {
                console.log('[MegaSync] Creating ZenBrowserSync folder...');
                folder = await this.storage.mkdir('ZenBrowserSync');
            }

            if (fs.existsSync(STORAGE_FILE) && folder) {
                const fileContent = fs.readFileSync(STORAGE_FILE);

                const existingFile = folder.children?.find((c: any) => c.name === 'user-data.json');
                if (existingFile) {
                    await existingFile.delete();
                }

                await new Promise((resolve, reject) => {
                    folder.upload({
                        name: 'user-data.json',
                        size: fileContent.length
                    }, fileContent, (err: any, file: any) => {
                        if (err) reject(err);
                        else resolve(file);
                    });
                });

                console.log('[MegaSync] Synchronized user-data.json successfully.');
            }
        } catch (e) {
            console.error('[MegaSync] Sync error:', e);
        } finally {
            this.isSyncing = false;
        }
    }
}
