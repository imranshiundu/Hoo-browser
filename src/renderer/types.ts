export type TabType = 'home' | 'dashboard' | 'browser' | 'rss' | 'privacy' | 'bookmarks' | 'extensions' | 'apps';

export interface Tab {
    id: string;
    type: TabType;
    title: string;
    url?: string;
    isApp?: boolean;
    partition?: string;
}
