import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
    DEFAULT_FEEDS,
    FEEDS_STORAGE_KEY,
    loadFeeds,
    makeCustomFeed,
    mergeFeeds,
    normalizeFeedInput,
    removeCustomFeed,
    saveCustomFeed,
    HooFeed,
} from '../rss-feeds';

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
    localStorageMock.clear();
});

describe('normalizeFeedInput', () => {
    it('accepts bare hostnames and upgrades them to https', () => {
        const result = normalizeFeedInput('hnrss.org/frontpage');
        expect(result?.rssUrl).toBe('https://hnrss.org/frontpage');
        expect(result?.name).toBe('Hnrss');
    });

    it('keeps explicit http and https URLs untouched', () => {
        expect(normalizeFeedInput('http://example.com/feed.xml')?.rssUrl).toBe('http://example.com/feed.xml');
        expect(normalizeFeedInput('https://example.com/feed.xml')?.rssUrl).toBe('https://example.com/feed.xml');
    });

    it('strips www. when deriving the display name', () => {
        expect(normalizeFeedInput('https://www.theregister.com/headlines.atom')?.name).toBe('Theregister');
    });

    it('rejects junk that is not a web URL', () => {
        expect(normalizeFeedInput('')).toBeNull();
        expect(normalizeFeedInput('not a url at all')).toBeNull();
        expect(normalizeFeedInput('ftp://example.com/feed')).toBeNull();
        expect(normalizeFeedInput('javascript:alert(1)')).toBeNull();
    });

    it('rejects hostnames without a dot', () => {
        expect(normalizeFeedInput('https://localhost/feed')).toBeNull();
    });
});

describe('makeCustomFeed', () => {
    it('builds a deterministic custom feed record', () => {
        const a = makeCustomFeed('example.com/feed');
        const b = makeCustomFeed('https://example.com/feed');
        expect(a).not.toBeNull();
        expect(a?.id).toBe(b?.id);
        expect(a?.custom).toBe(true);
        expect(a?.url).toBe('https://example.com');
    });

    it('returns null for unusable input', () => {
        expect(makeCustomFeed('nope')).toBeNull();
    });
});

describe('mergeFeeds', () => {
    it('puts custom feeds first and removes rssUrl duplicates', () => {
        const custom: HooFeed = { id: 'c1', name: 'Mine', url: 'https://mine.dev', rssUrl: 'https://mine.dev/feed', color: '#fff', custom: true };
        const duplicateOfDefault: HooFeed = { id: 'c2', name: 'HN Copy', url: 'https://x', rssUrl: 'https://hnrss.org/frontpage/', color: '#fff', custom: true };
        const merged = mergeFeeds(DEFAULT_FEEDS, [custom, duplicateOfDefault]);
        expect(merged[0].id).toBe('c1');
        expect(merged.filter(feed => feed.rssUrl.includes('hnrss.org/frontpage'))).toHaveLength(1);
    });
});

describe('persistence round-trip', () => {
    it('saves, loads and removes custom feeds through localStorage', () => {
        const feed = makeCustomFeed('example.com/feed.xml');
        expect(feed).not.toBeNull();
        saveCustomFeed(feed!);
        expect(loadFeeds().some(item => item.id === feed!.id)).toBe(true);

        const stored = JSON.parse(localStorage.getItem(FEEDS_STORAGE_KEY) || '[]');
        expect(stored).toHaveLength(1);

        const afterRemove = removeCustomFeed(feed!.id);
        expect(afterRemove.some(item => item.id === feed!.id)).toBe(false);
    });

    it('drops malformed stored entries instead of crashing', () => {
        localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify([
            { name: 'Broken' },
            { name: 'Ok', rssUrl: 'https://ok.dev/feed' },
            'junk',
            null,
        ]));
        const feeds = loadFeeds();
        expect(feeds.some(feed => feed.name === 'Ok')).toBe(true);
        expect(feeds.length).toBe(DEFAULT_FEEDS.length + 1);
    });

    it('survives a corrupt storage payload', () => {
        localStorage.setItem(FEEDS_STORAGE_KEY, '{not json');
        expect(loadFeeds()).toEqual(DEFAULT_FEEDS);
    });
});
