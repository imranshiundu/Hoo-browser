/**
 * Feed list management for the Live Reader.
 *
 * Defaults ship with the browser; user-added feeds persist in localStorage
 * (the same convention the bookmark manager and pinned tabs use). All the
 * validation lives here so the view stays thin and the rules are testable.
 */

export interface HooFeed {
    id: string;
    name: string;
    url: string;
    rssUrl: string;
    color: string;
    custom?: boolean;
}

export const FEEDS_STORAGE_KEY = 'hoo:rss-feeds';
export const MAX_CUSTOM_FEEDS = 24;

export const DEFAULT_FEEDS: HooFeed[] = [
    { id: 'hn', name: 'Hacker News', url: 'https://news.ycombinator.com', rssUrl: 'https://hnrss.org/frontpage', color: '#ff6600' },
    { id: 'register', name: 'The Register', url: 'https://www.theregister.com', rssUrl: 'https://www.theregister.com/headlines.atom', color: '#c0392b' },
    { id: 'ars', name: 'Ars Technica', url: 'https://arstechnica.com', rssUrl: 'https://feeds.arstechnica.com/arstechnica/index', color: '#e74c3c' },
    { id: 'wired', name: 'Wired', url: 'https://wired.com', rssUrl: 'https://www.wired.com/feed/rss', color: '#3498db' },
    { id: 'linuxtoday', name: 'Linux Today', url: 'https://linuxtoday.com', rssUrl: 'https://linuxtoday.com/feed', color: '#2ecc71' },
];

const FEED_COLORS = ['#ff6600', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c'];

export function normalizeFeedInput(input: string): { rssUrl: string; name: string } | null {
    const raw = (input || '').trim();
    if (!raw) return null;
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.replace(/^www\./, '');
    if (!host || !host.includes('.')) return null;
    const name = host.split('.')[0];
    return { rssUrl: parsed.toString(), name: name.charAt(0).toUpperCase() + name.slice(1) };
}

export function makeCustomFeed(input: string): HooFeed | null {
    const normalized = normalizeFeedInput(input);
    if (!normalized) return null;
    const hash = [...normalized.rssUrl].reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 7);
    return {
        id: `custom-${hash.toString(36)}`,
        name: normalized.name,
        url: new URL(normalized.rssUrl).origin,
        rssUrl: normalized.rssUrl,
        color: FEED_COLORS[hash % FEED_COLORS.length],
        custom: true
    };
}

export function loadFeeds(): HooFeed[] {
    let custom: HooFeed[] = [];
    try {
        const stored = JSON.parse(localStorage.getItem(FEEDS_STORAGE_KEY) || '[]');
        if (Array.isArray(stored)) {
            custom = stored.filter((feed: HooFeed) =>
                feed && typeof feed.rssUrl === 'string' && /^https?:\/\//i.test(feed.rssUrl) && typeof feed.name === 'string'
            ).slice(0, MAX_CUSTOM_FEEDS);
        }
    } catch {
        custom = [];
    }
    return mergeFeeds(DEFAULT_FEEDS, custom);
}

export function mergeFeeds(defaults: HooFeed[], custom: HooFeed[]): HooFeed[] {
    const seen = new Set<string>();
    const merged: HooFeed[] = [];
    for (const feed of [...custom, ...defaults]) {
        const key = feed.rssUrl.replace(/\/+$/, '');
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(feed);
    }
    return merged;
}

export function saveCustomFeed(feed: HooFeed): HooFeed[] {
    const stored = loadFeeds().filter(item => item.custom);
    const next = [feed, ...stored.filter(item => item.id !== feed.id)].slice(0, MAX_CUSTOM_FEEDS);
    try { localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode: feed lives for this session only */ }
    return loadFeeds();
}

export function removeCustomFeed(feedId: string): HooFeed[] {
    const stored = loadFeeds().filter(item => item.custom);
    const next = stored.filter(item => item.id !== feedId);
    try { localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return loadFeeds();
}
