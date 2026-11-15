import { describe, expect, it } from 'vitest';
import {
    MAX_TOASTS,
    downloadToastKind,
    pruneToasts,
    pushToast,
    toastHeadline,
    DownloadToast
} from '../download-toast-model';

describe('downloadToastKind', () => {
    it('toasts the first sighting of a download, not every progress tick', () => {
        expect(downloadToastKind('progressing', undefined)).toBe('started');
        expect(downloadToastKind('progressing', 'progressing')).toBeNull();
    });

    it('toasts completion and failure', () => {
        expect(downloadToastKind('completed', 'progressing')).toBe('completed');
        expect(downloadToastKind('interrupted', 'progressing')).toBe('failed');
    });

    it('never toasts a deliberate cancel', () => {
        expect(downloadToastKind('cancelled', 'progressing')).toBeNull();
    });
});

describe('toastHeadline', () => {
    it('mirrors the toolbar wording', () => {
        expect(toastHeadline('started', 'report.pdf')).toBe('Downloading report.pdf');
        expect(toastHeadline('completed', 'report.pdf')).toBe('Downloaded report.pdf');
        expect(toastHeadline('failed', 'report.pdf')).toBe('Download failed — report.pdf');
    });
});

describe('pushToast', () => {
    const t = (n: number): DownloadToast => ({ id: `d${n}`, kind: 'started', filename: `f${n}`, at: n, expiresAt: n + 1000 });

    it('replaces the toast of the same download instead of stacking', () => {
        const next = pushToast([t(1), t(2)], 'd1', 'completed', 'f1', 500);
        expect(next.map(toast => toast.id)).toEqual(['d2', 'd1']);
        expect(next[1].kind).toBe('completed');
    });

    it('caps the stack and drops the oldest first', () => {
        let toasts: DownloadToast[] = [];
        for (let i = 0; i < MAX_TOASTS + 2; i += 1) toasts = pushToast(toasts, `d${i}`, 'started', `f${i}`, i);
        expect(toasts.length).toBe(MAX_TOASTS);
        expect(toasts[0].id).toBe('d2');
    });
});

describe('pruneToasts', () => {
    it('drops only expired toasts', () => {
        const toasts: DownloadToast[] = [
            { id: 'a', kind: 'completed', filename: 'a', at: 0, expiresAt: 5000 },
            { id: 'b', kind: 'failed', filename: 'b', at: 1000, expiresAt: 7500 }
        ];
        expect(pruneToasts(toasts, 5000).map(toast => toast.id)).toEqual(['b']);
        expect(pruneToasts(toasts, 9999)).toEqual([]);
    });
});
