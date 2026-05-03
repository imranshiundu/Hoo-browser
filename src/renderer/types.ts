export type TabType = 'home' | 'browser';

export interface Tab {
    id: string;
    type: TabType;
    title: string;
    url?: string;
    isApp?: boolean;
    partition?: string;
}
