import { describe, expect, it } from 'vitest';
import {
    CHROME_HIDE_EDGE_PX,
    CHROME_REVEAL_EDGE_PX,
    fullscreenOriginLabel,
    isImmersive,
    shouldHideChrome,
    shouldRevealChrome
} from '../fullscreen-model';

describe('fullscreenOriginLabel', () => {
    it('shows the bare hostname, like Firefox', () => {
        expect(fullscreenOriginLabel('https://www.youtube.com/watch?v=abc')).toBe('youtube.com');
    });

    it('keeps meaningful subdomains', () => {
        expect(fullscreenOriginLabel('https://music.youtube.com/watch?v=abc')).toBe('music.youtube.com');
    });

    it('falls back for non-web and unparseable URLs', () => {
        expect(fullscreenOriginLabel('about:blank')).toBe('This page');
        expect(fullscreenOriginLabel('magnet:?xt=urn:btih:xyz')).toBe('This page');
        expect(fullscreenOriginLabel('not a url')).toBe('This page');
        expect(fullscreenOriginLabel(undefined)).toBe('This page');
    });
});

describe('isImmersive', () => {
    const base = { pageFullscreenTabId: null as string | null, activeTabId: 'tab-a', osFullscreen: false };

    it('stays normal with no fullscreen anywhere', () => {
        expect(isImmersive(base)).toBe(false);
    });

    it('hides chrome while the active page is fullscreen', () => {
        expect(isImmersive({ ...base, pageFullscreenTabId: 'tab-a' })).toBe(true);
    });

    it('ignores a background tab going fullscreen', () => {
        expect(isImmersive({ ...base, pageFullscreenTabId: 'tab-b' })).toBe(false);
    });

    it('OS fullscreen is always immersive, even on the home page', () => {
        expect(isImmersive({ ...base, osFullscreen: true })).toBe(true);
    });
});

describe('chrome reveal edges', () => {
    it('reveals at the very top of the window', () => {
        expect(shouldRevealChrome(0)).toBe(true);
        expect(shouldRevealChrome(CHROME_REVEAL_EDGE_PX)).toBe(true);
        expect(shouldRevealChrome(CHROME_REVEAL_EDGE_PX + 1)).toBe(false);
        expect(shouldRevealChrome(-10)).toBe(false);
    });

    it('hides once the pointer leaves the strip zone', () => {
        expect(shouldHideChrome(CHROME_HIDE_EDGE_PX)).toBe(false);
        expect(shouldHideChrome(CHROME_HIDE_EDGE_PX + 1)).toBe(true);
        expect(shouldHideChrome(20)).toBe(false);
    });
});
