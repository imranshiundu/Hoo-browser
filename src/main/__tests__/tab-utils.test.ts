import { describe, expect, it } from 'vitest';
import {
    clampWindowState,
    clampZoomFactor,
    crashReasonLabel,
    createTabIdFactory,
    findStatusText,
    formatBytes,
    reorderTabsByIds,
    stepZoomFactor,
    zoomPercent
} from '../tab-utils';

describe('createTabIdFactory', () => {
    it('never produces the same id twice in a tight loop', () => {
        const nextId = createTabIdFactory();
        const ids = new Set(Array.from({ length: 5000 }, () => nextId()));
        expect(ids.size).toBe(5000);
    });

    it('produces short opaque string ids', () => {
        const id = createTabIdFactory()();
        expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
        expect(id.length).toBeLessThan(40);
    });
});

describe('zoom helpers', () => {
    it('clamps zoom factor into Chromium bounds', () => {
        expect(clampZoomFactor(0.1)).toBe(0.3);
        expect(clampZoomFactor(50)).toBe(5);
        expect(clampZoomFactor(Number.NaN)).toBe(1);
        expect(clampZoomFactor(0)).toBe(1);
        expect(clampZoomFactor(-2)).toBe(1);
        expect(clampZoomFactor(1.44)).toBeCloseTo(1.44);
    });

    it('steps zoom in and out by 1.2x', () => {
        expect(stepZoomFactor(1, 'in')).toBeCloseTo(1.2);
        expect(stepZoomFactor(1.2, 'out')).toBeCloseTo(1, 5);
        expect(stepZoomFactor(4.9, 'in')).toBe(5);
        expect(stepZoomFactor(0.32, 'out')).toBe(0.3);
    });

    it('resets zoom to actual size', () => {
        expect(stepZoomFactor(2.7, 'reset')).toBe(1);
    });

    it('renders zoom percent for the badge', () => {
        expect(zoomPercent(1)).toBe(100);
        expect(zoomPercent(1.2)).toBe(120);
        expect(zoomPercent(0.8)).toBe(80);
        expect(zoomPercent(9)).toBe(500);
    });
});

describe('findStatusText', () => {
    it('is empty without a query', () => {
        expect(findStatusText(1, 5, false)).toBe('');
    });

    it('says searching before the first result', () => {
        expect(findStatusText(undefined, undefined, true)).toBe('Searching');
    });

    it('reports no matches', () => {
        expect(findStatusText(0, 0, true)).toBe('No matches');
    });

    it('reports active of total', () => {
        expect(findStatusText(3, 17, true)).toBe('3 of 17');
        expect(findStatusText(0, 4, true)).toBe('1 of 4');
    });
});

describe('crashReasonLabel', () => {
    it('maps known crash reasons', () => {
        expect(crashReasonLabel('oom')).toContain('memory');
        expect(crashReasonLabel('crashed')).toContain('crashed');
    });

    it('falls back to the raw reason', () => {
        expect(crashReasonLabel('???')).toContain('???');
    });
});

describe('formatBytes', () => {
    it('formats the usual download sizes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2.0 KB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
        expect(formatBytes(3.5 * 1024 ** 3)).toBe('3.5 GB');
    });
});

describe('reorderTabsByIds', () => {
    const tabs = [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' }
    ];

    it('reorders records to match the drag order', () => {
        expect(reorderTabsByIds(tabs, ['c', 'a', 'b']).map(t => t.id)).toEqual(['c', 'a', 'b']);
    });

    it('keeps the original records (identity), not copies', () => {
        const ordered = reorderTabsByIds(tabs, ['b', 'a', 'c']);
        expect(ordered[0]).toBe(tabs[1]);
    });

    it('ignores unknown and duplicate ids', () => {
        expect(reorderTabsByIds(tabs, ['c', 'zzz', 'c', 'a']).map(t => t.id)).toEqual(['c', 'a', 'b']);
    });

    it('appends tabs the renderer never mentioned', () => {
        expect(reorderTabsByIds(tabs, ['b']).map(t => t.id)).toEqual(['b', 'a', 'c']);
    });

    it('returns the input untouched for empty or invalid input', () => {
        expect(reorderTabsByIds(tabs, [])).toBe(tabs);
        expect(reorderTabsByIds(tabs, undefined as unknown as string[])).toBe(tabs);
    });
});

describe('clampWindowState', () => {
    const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];

    it('falls back to a sane default window when nothing was saved', () => {
        const restored = clampWindowState(undefined, displays);
        expect(restored.bounds?.width).toBe(1400);
        expect(restored.bounds?.height).toBe(800);
        expect(restored.bounds?.x).toBeUndefined();
    });

    it('restores a saved size inside the work area', () => {
        const restored = clampWindowState(
            { bounds: { x: 40, y: 30, width: 1200, height: 720 } },
            displays
        );
        expect(restored.bounds).toEqual({ x: 40, y: 30, width: 1200, height: 720 });
    });

    it('shrinks windows larger than the screen and grows tiny ones', () => {
        const restored = clampWindowState(
            { bounds: { x: 0, y: 0, width: 4000, height: 300 } },
            displays
        );
        expect(restored.bounds?.width).toBe(1920);
        expect(restored.bounds?.height).toBe(600);
    });

    it('keeps an off-screen window reachable on the nearest edge', () => {
        const restored = clampWindowState(
            { bounds: { x: 18000, y: -900, width: 1200, height: 720 } },
            displays
        );
        expect(restored.bounds?.x).toBe(1920 - 80);
        expect(restored.bounds?.y).toBe(0);
    });

    it('remembers maximized and fullscreen flags', () => {
        const restored = clampWindowState(
            { bounds: { x: 0, y: 0, width: 1200, height: 720 }, maximized: true, fullscreen: true },
            displays
        );
        expect(restored.maximized).toBe(true);
        expect(restored.fullscreen).toBe(true);
    });
});
