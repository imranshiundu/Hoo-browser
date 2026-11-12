export type TabType = 'home' | 'browser';

export interface Tab {
    id: string;
    type: TabType;
    title: string;
    url?: string;
    isApp?: boolean;
    partition?: string;
}

export interface Bookmark {
    id: string;
    title: string;
    url: string;
    createdAt: number;
}

/**
 * Deterministic, privacy-preserving site identity for favicons.
 *
 * Hoo previously fetched tab favicons from `google.com/s2/favicons`, which told
 * Google about every domain the user opened — the exact opposite of what a
 * privacy browser should do, and it failed offline. Real favicons now come from
 * the page itself (`page-favicon-updated`); this helper renders a colored
 * initial while a page has not reported one.
 */
export interface SiteInitial {
    letter: string;
    hue: number;
}

export const siteInitial = (url?: string): SiteInitial | null => {
    if (!url) return null;
    let hostname = '';
    try {
        hostname = new URL(url).hostname || '';
    } catch {
        hostname = url.split('/')[0] || '';
    }
    hostname = hostname.replace(/^www\./, '').trim();
    if (!hostname) return null;
    const letter = (hostname[0] || '?').toUpperCase();
    let hash = 0;
    for (let i = 0; i < hostname.length; i += 1) {
        hash = (hash * 31 + hostname.charCodeAt(i)) >>> 0;
    }
    return { letter, hue: hash % 360 };
};

export const siteInitialStyle = (initial: SiteInitial | null): Record<string, string> | undefined => {
    if (!initial) return undefined;
    return {
        background: `linear-gradient(135deg, hsl(${initial.hue} 62% 34%), hsl(${(initial.hue + 28) % 360} 62% 24%))`,
        color: `hsl(${initial.hue} 100% 88%)`
    };
};
