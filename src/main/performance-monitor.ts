import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StorageService } from './storage';

type PerformanceSnapshot = {
    startupMs: number;
    uptimeSeconds: number;
    cpu: number;
    memory: {
        processMb: number;
        usedGb: string;
        totalGb: string;
    };
    storage: {
        usedBytes: number;
        usedText: string;
    };
    tabs: {
        active: number;
        background: number;
        totalBrowserViews: number;
    };
    network: {
        requestCount: number;
        approxReceivedBytes: number;
        approxReceivedText: string;
    };
    profile: {
        encryptionAvailable: boolean;
        downloadsStored: number;
        crashedTabsStored: number;
    };
    modes: {
        lowDataMode: boolean;
        aiLoaded: boolean;
    };
};

const startedAt = Date.now();
let firstWindowReadyAt: number | null = null;
let requestCount = 0;
let approxReceivedBytes = 0;

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function dirSize(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).reduce((acc, file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        return acc + (stats.isDirectory() ? dirSize(filePath) : stats.size);
    }, 0);
}

export function markWindowReady() {
    if (!firstWindowReadyAt) firstWindowReadyAt = Date.now();
}

export function trackNetworkRequest() {
    requestCount += 1;
}

export function trackNetworkBytes(bytes: number) {
    if (Number.isFinite(bytes) && bytes > 0) {
        approxReceivedBytes += bytes;
    }
}

export async function getPerformanceSnapshot(opts: {
    mainWindow: BrowserWindow | null;
    activeBrowserViews: number;
    totalBrowserViews: number;
    lowDataMode: boolean;
    aiLoaded: boolean;
}): Promise<PerformanceSnapshot> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const load = os.loadavg()[0];
    const cpuCount = os.cpus().length || 1;
    const cpuUsage = Math.min(100, Math.floor((load / cpuCount) * 100));
    const processMemory = process.memoryUsage();
    const userDataPath = app.getPath('userData');
    const storageUsed = dirSize(userDataPath);
    const data = StorageService.load();

    return {
        startupMs: (firstWindowReadyAt || Date.now()) - startedAt,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        cpu: cpuUsage,
        memory: {
            processMb: Math.round(processMemory.rss / (1024 * 1024)),
            usedGb: (usedMem / (1024 ** 3)).toFixed(1),
            totalGb: (totalMem / (1024 ** 3)).toFixed(0)
        },
        storage: {
            usedBytes: storageUsed,
            usedText: formatBytes(storageUsed)
        },
        tabs: {
            active: opts.activeBrowserViews,
            background: Math.max(0, opts.totalBrowserViews - opts.activeBrowserViews),
            totalBrowserViews: opts.totalBrowserViews
        },
        network: {
            requestCount,
            approxReceivedBytes,
            approxReceivedText: formatBytes(approxReceivedBytes)
        },
        profile: {
            encryptionAvailable: StorageService.encryptionAvailable(),
            downloadsStored: data.downloads?.length || 0,
            crashedTabsStored: data.crashedTabs?.length || 0
        },
        modes: {
            lowDataMode: opts.lowDataMode,
            aiLoaded: opts.aiLoaded
        }
    };
}
