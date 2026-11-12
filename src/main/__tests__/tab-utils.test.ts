import { describe, expect, it } from 'vitest';
import {
    clampZoomFactor,
    crashReasonLabel,
    createTabIdFactory,
    findStatusText,
    formatBytes,
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
