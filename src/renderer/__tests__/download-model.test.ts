import { describe, expect, it } from 'vitest';
import { DownloadEntry, downloadStatusText, upsertDownloadEntry } from '../download-model';

const entry = (overrides: Partial<DownloadEntry>): DownloadEntry => ({
    id: 'd1',
    filename: 'installer.exe',
    url: 'https://example.com/installer.exe',
    state: 'progressing',
    receivedBytes: 0,
    totalBytes: 0,
    ...overrides,
});

describe('downloadStatusText', () => {
    it('shows percent and total while progressing', () => {
        expect(downloadStatusText(entry({ receivedBytes: 25 * 1048576, totalBytes: 100 * 1048576 }))).toBe('25% of 100 MB');
    });

    it('caps runaway percents at 100', () => {
        expect(downloadStatusText(entry({ receivedBytes: 150, totalBytes: 100 }))).toBe('100% of 100 B');
    });

    it('falls back to received bytes when the total is unknown', () => {
        expect(downloadStatusText(entry({ receivedBytes: 2048, totalBytes: 0 }))).toBe('2.0 KB downloaded');
    });

    it('labels terminal states', () => {
        expect(downloadStatusText(entry({ state: 'completed', totalBytes: 1048576 }))).toBe('1.0 MB');
        expect(downloadStatusText(entry({ state: 'interrupted' }))).toBe('Interrupted');
        expect(downloadStatusText(entry({ state: 'cancelled' }))).toBe('Cancelled');
    });
});

describe('upsertDownloadEntry', () => {
    it('prepends unknown records', () => {
        const list = [entry({ id: 'a' })];
        const next = upsertDownloadEntry(list, entry({ id: 'b' }));
        expect(next.map(item => item.id)).toEqual(['b', 'a']);
        expect(list).toHaveLength(1); // original untouched
    });

    it('replaces in place when the id already exists', () => {
        const list = [entry({ id: 'a', receivedBytes: 10 }), entry({ id: 'b', receivedBytes: 20 })];
        const next = upsertDownloadEntry(list, entry({ id: 'a', receivedBytes: 99 }));
        expect(next.map(item => item.id)).toEqual(['a', 'b']);
        expect(next[0].receivedBytes).toBe(99);
    });
});
