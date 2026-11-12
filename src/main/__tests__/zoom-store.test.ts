import { describe, expect, it } from 'vitest';
import {
    clampZoomPercent,
    zoomPercentToFactor,
    normalizeSiteZooms
} from '../zoom-store';

describe('clampZoomPercent', () => {
    it('keeps values inside the Chromium-supported range', () => {
        expect(clampZoomPercent(110)).toBe(110);
        expect(clampZoomPercent(30)).toBe(30);
        expect(clampZoomPercent(500)).toBe(500);
    });

    it('clamps out-of-range values', () => {
        expect(clampZoomPercent(10)).toBe(30);
        expect(clampZoomPercent(900)).toBe(500);
        expect(clampZoomPercent(-25)).toBe(30);
    });

    it('rounds fractional percents and falls back to 100 for junk', () => {
        expect(clampZoomPercent(110.4)).toBe(110);
        expect(clampZoomPercent(NaN)).toBe(100);
        expect(clampZoomPercent(Infinity)).toBe(100);
    });
});

describe('zoomPercentToFactor', () => {
    it('converts percent to a Chromium zoom factor', () => {
        expect(zoomPercentToFactor(100)).toBe(1);
        expect(zoomPercentToFactor(110)).toBeCloseTo(1.1, 5);
        expect(zoomPercentToFactor(50)).toBeCloseTo(0.5, 5);
    });

    it('never produces an out-of-range factor', () => {
        expect(zoomPercentToFactor(1000)).toBeLessThanOrEqual(5);
        expect(zoomPercentToFactor(1)).toBeGreaterThanOrEqual(0.3);
    });
});

describe('normalizeSiteZooms', () => {
    it('keeps valid origin keys with sane values', () => {
        const raw = { 'https://github.com': 110, 'http://news.ycombinator.com': 90 };
        expect(normalizeSiteZooms(raw)).toEqual(raw);
    });

    it('drops junk keys and junk values', () => {
        const raw = {
            'https://ok.com': 110,
            'not an origin': 110,
            'file:///etc/passwd': 110,
            'https://bad.com': 'huge',
            'https://also-bad.com': NaN
        };
        expect(normalizeSiteZooms(raw)).toEqual({ 'https://ok.com': 110 });
    });

    it('clamps stored values into range', () => {
        expect(normalizeSiteZooms({ 'https://x.com': 20 })).toEqual({ 'https://x.com': 30 });
        expect(normalizeSiteZooms({ 'https://x.com': 800 })).toEqual({ 'https://x.com': 500 });
    });

    it('returns empty for junk input', () => {
        expect(normalizeSiteZooms(null)).toEqual({});
        expect(normalizeSiteZooms([1, 2])).toEqual({});
        expect(normalizeSiteZooms('x')).toEqual({});
    });
});
