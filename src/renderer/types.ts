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

export const getFaviconUrl = (url?: string): string | null => {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (!parsed.hostname) return null;
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
    } catch {
        return null;
    }
};
