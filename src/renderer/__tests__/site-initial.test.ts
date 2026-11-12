import { describe, expect, it } from 'vitest';
import { siteInitial, siteInitialStyle } from '../types';

describe('siteInitial', () => {
    it('extracts the first hostname letter', () => {
        expect(siteInitial('https://github.com/imranshiundu')).toEqual(
            expect.objectContaining({ letter: 'G' })
        );
    });

    it('strips www and is stable per hostname', () => {
        const a = siteInitial('https://www.wikipedia.org/wiki/Owl');
        const b = siteInitial('https://wikipedia.org/wiki/Owl');
        expect(a).toEqual(b);
    });

    it('gives a deterministic hue in range for the same host', () => {
        const first = siteInitial('https://duckduckgo.com');
        const second = siteInitial('https://duckduckgo.com/?q=owl');
        expect(first).toEqual(second);
        expect(first!.hue).toBeGreaterThanOrEqual(0);
        expect(first!.hue).toBeLessThan(360);
    });

    it('falls back to the first path segment for non-URL input', () => {
        expect(siteInitial('duckduckgo.com/?q=x')).toEqual(
            expect.objectContaining({ letter: 'D' })
        );
    });

    it('returns null for empty input', () => {
        expect(siteInitial(undefined)).toBeNull();
        expect(siteInitial('')).toBeNull();
    });
});

describe('siteInitialStyle', () => {
    it('returns a gradient style for an initial', () => {
        const style = siteInitialStyle({ letter: 'G', hue: 210 });
        expect(style?.background).toContain('hsl(210');
    });

    it('returns undefined without an initial', () => {
        expect(siteInitialStyle(null)).toBeUndefined();
    });
});
