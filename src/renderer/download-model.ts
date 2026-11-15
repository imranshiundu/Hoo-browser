/**
 * Pure view-model helpers for the Downloads page. Kept free of React and
 * Electron so the vitest suite can pin the user-facing text down.
 */

export interface DownloadEntry {
    id: string;
    filename: string;
    url: string;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
    receivedBytes: number;
    totalBytes: number;
    danger?: string;
}

const formatMb = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

export function downloadStatusText(entry: DownloadEntry): string {
    if (entry.state === 'progressing') {
        if (entry.totalBytes > 0) {
            const percent = Math.min(100, Math.round((entry.receivedBytes / entry.totalBytes) * 100));
            return `${percent}% of ${formatMb(entry.totalBytes)}`;
        }
        return `${formatMb(entry.receivedBytes)} downloaded`;
    }
    if (entry.state === 'completed') return formatMb(entry.totalBytes || entry.receivedBytes);
    if (entry.state === 'interrupted') return 'Interrupted';
    return 'Cancelled';
}

export function upsertDownloadEntry(
    entries: DownloadEntry[],
    record: DownloadEntry
): DownloadEntry[] {
    const index = entries.findIndex(item => item.id === record.id);
    if (index === -1) return [record, ...entries];
    const next = entries.slice();
    next[index] = record;
    return next;
}
