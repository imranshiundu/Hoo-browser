import { BrowserView } from 'electron';
import { StorageService } from './storage';

export type TabRuntimeState = 'placeholder' | 'loaded' | 'sleeping' | 'crashed';

type StoredBrowserTab = {
    id: string;
    type: 'browser';
    title: string;
    url: string;
    isApp?: boolean;
    partition?: string;
    lifecycle?: TabRuntimeState;
    lastActiveAt?: number;
    restoredLazy?: boolean;
};

function isBrowserTab(tab: any): tab is StoredBrowserTab {
    return tab?.type === 'browser' && typeof tab.id === 'string';
}

export function shouldRestoreTabAsPlaceholder(tab: StoredBrowserTab, activeTabId: string | null, lazyRestore: boolean): boolean {
    if (!lazyRestore) return false;
    if (tab.id === activeTabId) return false;
    if (!tab.url || tab.url === 'about:blank') return false;
    return true;
}

export function prepareLazyRestoredTabs() {
    const data = StorageService.load();
    const lazyRestore = data.settings.lazySessionRestore !== false;
    const activeTabId = data.activeTabId;

    const tabs = data.tabs.map(tab => {
        if (!isBrowserTab(tab)) return tab;
        if (shouldRestoreTabAsPlaceholder(tab, activeTabId, lazyRestore)) {
            return { ...tab, lifecycle: 'placeholder', restoredLazy: true };
        }
        return { ...tab, lifecycle: tab.lifecycle || 'loaded' };
    });

    StorageService.save({ tabs });
    return { tabs, activeTabId, lazyRestore };
}

export function liveTabCount(browserViews: Map<string, BrowserView>) {
    return browserViews.size;
}

export function enforceLiveTabBudget(browserViews: Map<string, BrowserView>, protectedTabIds: Set<string>, maxLiveBackgroundTabs: number) {
    const data = StorageService.load();
    const browserTabs = data.tabs.filter(isBrowserTab);
    const loadedBackgroundTabs = browserTabs
        .filter(tab => browserViews.has(tab.id) && !protectedTabIds.has(tab.id))
        .sort((a, b) => (a.lastActiveAt || 0) - (b.lastActiveAt || 0));

    while (loadedBackgroundTabs.length > maxLiveBackgroundTabs) {
        const tab = loadedBackgroundTabs.shift();
        if (!tab) break;
        const view = browserViews.get(tab.id);
        if (!view) continue;

        const isAudible = typeof view.webContents.isCurrentlyAudible === 'function' && view.webContents.isCurrentlyAudible();
        if (isAudible) continue;

        if (!view.webContents.isDestroyed()) view.webContents.close();
        browserViews.delete(tab.id);
        StorageService.markTabLifecycle(tab.id, 'sleeping');
    }
}
