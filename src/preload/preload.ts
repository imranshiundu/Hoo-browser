import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    createTab: (url: string, partition?: string, isApp?: boolean, title?: string) => ipcRenderer.invoke('create-tab', url, partition, isApp, title),
    switchTab: (tabId: string) => ipcRenderer.invoke('switch-tab', tabId),
    closeTab: (tabId: string) => ipcRenderer.invoke('close-tab', tabId),
    renameTab: (tabId: string, title: string) => ipcRenderer.invoke('rename-tab', tabId, title),
    reorderTabs: (orderedIds: string[]) => ipcRenderer.invoke('reorder-tabs', orderedIds),
    navigateTab: (tabId: string, url: string) => ipcRenderer.invoke('navigate-tab', tabId, url),
    setMosaicView: (tabId1: string, tabId2: string) => ipcRenderer.invoke('set-mosaic-view', tabId1, tabId2),
    clearMosaicView: () => ipcRenderer.invoke('clear-mosaic-view'),
    showTabMenu: (payload: any) => ipcRenderer.invoke('show-tab-menu', payload),
    showNewTabMenu: (payload: any) => ipcRenderer.invoke('show-new-tab-menu', payload),
    goBack: (tabId: string) => ipcRenderer.invoke('go-back', tabId),
    goForward: (tabId: string) => ipcRenderer.invoke('go-forward', tabId),
    reload: (tabId: string) => ipcRenderer.invoke('reload', tabId),
    stopLoading: (tabId: string) => ipcRenderer.invoke('stop-loading', tabId),
    navigateTo: (url: string) => ipcRenderer.invoke('navigate-to', url),
    findInPage: (tabId: string, query: string, options?: { forward?: boolean; findNext?: boolean }) => ipcRenderer.invoke('find-in-page', tabId, query, options),
    stopFindInPage: (tabId: string) => ipcRenderer.invoke('stop-find-in-page', tabId),
    toggleTabMute: (tabId: string) => ipcRenderer.invoke('toggle-tab-mute', tabId),
    getDownloads: () => ipcRenderer.invoke('get-downloads'),
    openDownload: (id: string) => ipcRenderer.invoke('open-download', id),
    showDownloadInFolder: (id: string) => ipcRenderer.invoke('show-download-in-folder', id),
    clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
    getHistory: () => ipcRenderer.invoke('get-history'),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    getAllHistory: () => ipcRenderer.invoke('get-all-history'),
    deleteHistoryEntry: (url: string, timestamp: number) => ipcRenderer.invoke('delete-history-entry', url, timestamp),
    clearHistoryRange: (range: 'hour' | 'day' | 'all') => ipcRenderer.invoke('clear-history-range', range),
    getAddressSuggestions: (query: string) => ipcRenderer.invoke('get-address-suggestions', query),
    onHistoryCleared: (callback: () => void) => {
        ipcRenderer.on('history-cleared', () => callback());
    },
    onPermissionRequest: (callback: (request: { requestId: string; permission: string; origin: string; description: string }) => void) => {
        ipcRenderer.on('permission-request', (_event, request) => callback(request));
    },
    resolvePermission: (requestId: string, decision: 'allow' | 'block', remember: boolean) => ipcRenderer.invoke('resolve-permission', requestId, decision, remember),
    getSitePermissions: () => ipcRenderer.invoke('get-site-permissions'),
    clearSitePermissions: (key?: string) => ipcRenderer.invoke('clear-site-permissions', key),
    setSitePermission: (origin: string, permission: string, decision: 'allow' | 'block' | 'ask') => ipcRenderer.invoke('set-site-permission', origin, permission, decision),
    getSiteZooms: () => ipcRenderer.invoke('get-site-zooms'),
    clearSiteZooms: () => ipcRenderer.invoke('clear-site-zooms'),
    restoreCrashedTabs: () => ipcRenderer.invoke('restore-crashed-tabs'),
    rssFetch: (url: string) => ipcRenderer.invoke('rss-fetch', url),
    exportBookmarks: (entries: any[]) => ipcRenderer.invoke('export-bookmarks', entries),
    importBookmarks: () => ipcRenderer.invoke('import-bookmarks'),
    updatePrivacySettings: (settings: any) => ipcRenderer.invoke('update-privacy-settings', settings),
    getInitialData: () => ipcRenderer.invoke('get-initial-data'),
    getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
    getPerformanceSnapshot: () => ipcRenderer.invoke('get-performance-snapshot'),
    nuclearWipe: () => ipcRenderer.invoke('nuclear-wipe'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    installAppUpdate: () => ipcRenderer.invoke('install-app-update'),
    getUpdateChannel: () => ipcRenderer.invoke('get-update-channel'),
    onAppUpdateStatus: (callback: (status: any) => void) => {
        ipcRenderer.on('app-update-status', (_event, status) => callback(status));
    },
    hideBrowserView: () => ipcRenderer.invoke('hide-browser-view'),
    updateViewBounds: (bounds: any) => ipcRenderer.invoke('update-view-bounds', bounds),
    exitPageFullscreen: (tabId?: string) => ipcRenderer.invoke('exit-page-fullscreen', tabId),
    toggleOsFullscreen: () => ipcRenderer.invoke('toggle-os-fullscreen'),
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    reloadApp: () => ipcRenderer.invoke('window-reload'),
    onTabTitleUpdated: (callback: (tabId: string, title: string, url?: string) => void) => {
        ipcRenderer.on('tab-title-updated', (_event, tabId, title, url) => callback(tabId, title, url));
    },
    onTabLoadingState: (callback: (tabId: string, loading: boolean, url?: string) => void) => {
        ipcRenderer.on('tab-loading-state', (_event, tabId, loading, url) => callback(tabId, loading, url));
    },
    onTabLoadError: (callback: (tabId: string, errorCode: number, errorDescription: string, url?: string) => void) => {
        ipcRenderer.on('tab-load-error', (_event, tabId, errorCode, errorDescription, url) => callback(tabId, errorCode, errorDescription, url));
    },
    onSwitchToBrowser: (callback: (tabId: string) => void) => {
        ipcRenderer.on('switch-to-browser', (_event, tabId) => callback(tabId));
    },
    onSwitchToHome: (callback: (tabId?: string) => void) => {
        ipcRenderer.on('switch-to-home', (_event, tabId) => callback(tabId));
    },
    onOpenUrlInNewTab: (callback: (url: string) => void) => {
        ipcRenderer.on('open-url-in-new-tab', (_event, url) => callback(url));
    },
    onUiShortcut: (callback: (action: string) => void) => {
        ipcRenderer.on('ui-shortcut', (_event, action) => callback(action));
    },
    onNavStateUpdated: (callback: (tabId: string, canGoBack: boolean, canGoForward: boolean) => void) => {
        ipcRenderer.on('nav-state-updated', (_event, tabId, canGoBack, canGoForward) => callback(tabId, canGoBack, canGoForward));
    },
    onTabFaviconUpdated: (callback: (tabId: string, favicon: string) => void) => {
        ipcRenderer.on('tab-favicon-updated', (_event, tabId, favicon) => callback(tabId, favicon));
    },
    onTabAudioUpdated: (callback: (tabId: string, audible: boolean, muted: boolean) => void) => {
        ipcRenderer.on('tab-audio-updated', (_event, tabId, audible, muted) => callback(tabId, audible, muted));
    },
    onPageTargetUrl: (callback: (url: string) => void) => {
        ipcRenderer.on('page-target-url', (_event, url) => callback(url));
    },
    onFindResult: (callback: (tabId: string, activeMatch: number, matches: number) => void) => {
        ipcRenderer.on('find-result', (_event, tabId, activeMatch, matches) => callback(tabId, activeMatch, matches));
    },
    onDownloadUpdated: (callback: (record: any) => void) => {
        ipcRenderer.on('download-updated', (_event, record) => callback(record));
    },
    onDownloadListCleared: (callback: () => void) => {
        ipcRenderer.on('download-list-cleared', () => callback());
    },
    onZoomChanged: (callback: (tabId: string, percent: number) => void) => {
        ipcRenderer.on('zoom-changed', (_event, tabId, percent) => callback(tabId, percent));
    },
    onPageFullscreenChanged: (callback: (tabId: string, active: boolean) => void) => {
        ipcRenderer.on('page-fullscreen-changed', (_event, tabId, active) => callback(tabId, active));
    },
    onOsFullscreenChanged: (callback: (active: boolean) => void) => {
        ipcRenderer.on('os-fullscreen-changed', (_event, active) => callback(active));
    },
    googleLogin: () => ipcRenderer.invoke('google-login'),
    googleLogout: () => ipcRenderer.invoke('google-logout'),
    megaLogin: (email: string, pass: string) => ipcRenderer.invoke('mega-login', email, pass),
    megaLogout: () => ipcRenderer.invoke('mega-logout'),
    startOpenClaw: () => ipcRenderer.invoke('start-openclaw'),
});
