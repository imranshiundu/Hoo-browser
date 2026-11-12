import { describe, expect, it } from 'vitest';
import { shouldBlockForLowData } from '../network-policy';

const base = { lowDataMode: false };

describe('shouldBlockForLowData', () => {
    it('never blocks in compatibility mode', () => {
        const settings = { ...base, performanceMode: 'compatibility' as const };
        expect(shouldBlockForLowData('https://x.com/font.woff2', 'font', settings).block).toBe(false);
        expect(shouldBlockForLowData('https://x.com/video.mp4', 'media', settings).block).toBe(false);
        expect(shouldBlockForLowData('https://x.com/beacon', 'beacon', settings).block).toBe(false);
    });

    it('keeps everything in balanced mode when low-data features are off', () => {
        expect(shouldBlockForLowData('https://x.com/font.woff2', 'font', base).block).toBe(false);
        expect(shouldBlockForLowData('https://x.com/video.mp4', 'media', base).block).toBe(false);
        expect(shouldBlockForLowData('https://x.com/track', 'beacon', base).block).toBe(false);
    });

    it('low-data mode blocks fonts and media when the toggles are on', () => {
        const settings = { lowDataMode: true, blockThirdPartyFonts: true, blockAutoplayMedia: true };
        expect(shouldBlockForLowData('https://x.com/fonts/a.woff2', 'font', settings)).toEqual({ block: true, reason: 'font' });
        expect(shouldBlockForLowData('https://x.com/clip.webm', 'media', settings)).toEqual({ block: true, reason: 'media' });
    });

    it('low-data mode blocks background telemetry regardless of toggles', () => {
        const settings = { lowDataMode: true };
        expect(shouldBlockForLowData('https://x.com/analytics', 'beacon', settings)).toEqual({ block: true, reason: 'background telemetry' });
        expect(shouldBlockForLowData('https://x.com/analytics', 'ping', settings)).toEqual({ block: true, reason: 'background telemetry' });
    });

    it('low-data mode blocks prefetch and metrics URL signals', () => {
        const settings = { lowDataMode: true };
        const result = shouldBlockForLowData('https://x.com/page?utm=1&generate_204', 'xhr', settings);
        expect(result.block).toBe(true);
        expect(result.reason).toBe('prefetch or metrics junk');
    });

    it('low-data mode blocks known lite tracker hosts and their subdomains', () => {
        const settings = { lowDataMode: true };
        expect(shouldBlockForLowData('https://www.googletagmanager.com/gtm.js', 'script', settings).block).toBe(true);
        expect(shouldBlockForLowData('https://cdn.amplitude.com/lib.js', 'script', settings).block).toBe(true);
        expect(shouldBlockForLowData('https://example.com/lib.js', 'script', settings).block).toBe(false);
    });

    it('extreme mode additionally blocks embedded frames and objects', () => {
        const settings = { performanceMode: 'extreme' as const };
        expect(shouldBlockForLowData('https://ads.example.com/frame', 'subFrame', settings)).toEqual({ block: true, reason: 'extreme embedded content' });
        expect(shouldBlockForLowData('https://ads.example.com/embed', 'object', settings)).toEqual({ block: true, reason: 'extreme embedded content' });
    });

    it('lite mode does not block embedded frames the way extreme does', () => {
        const settings = { performanceMode: 'lite' as const };
        expect(shouldBlockForLowData('https://x.com/frame', 'subFrame', settings).block).toBe(false);
    });

    it('respects an explicit performanceMode over lowDataMode', () => {
        const settings = { lowDataMode: true, performanceMode: 'compatibility' as const };
        expect(shouldBlockForLowData('https://x.com/font.woff2', 'font', settings).block).toBe(false);
    });
});
