import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    createTab: (url: string, partition?: string, isApp?: boolean, title?: string) => ipcRenderer.invoke('create-tab', url, partition, isApp, title),
    switchTab: (tabId: string) => ipcRenderer.invoke('switch-tab', tabId),
    closeTab: (tabId: string) => ipcRenderer.invoke('close-tab', tabId),
    renameTab: (tabId: string, title: string) => ipcRenderer.invoke('rename-tab', tabId, title),
    navigateTab: (tabId: string, url: string) => ipcRenderer.invoke('navigate-tab', tabId, url),
    setMosaicView: (tabId1: string, tabId2: string) => ipcRenderer.invoke('set-mosaic-view', tabId1, tabId2),
    clearMosaicView: () => ipcRenderer.invoke('clear-mosaic-view'),
    goBack: (tabId: string) => ipcRenderer.invoke('go-back', tabId),
    goForward: (tabId: string) => ipcRenderer.invoke('go-forward', tabId),
    reload: (tabId: string) => ipcRenderer.invoke('reload', tabId),
    navigateTo: (url: string) => ipcRenderer.invoke('navigate-to', url),
    updatePrivacySettings: (settings: any) => ipcRenderer.invoke('update-privacy-settings', settings),
    getInitialData: () => ipcRenderer.invoke('get-initial-data'),
    getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
    getPerformanceSnapshot: () => ipcRenderer.invoke('get-performance-snapshot'),
    nuclearWipe: () => ipcRenderer.invoke('nuclear-wipe'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    toggleSidebar: (collapsed: boolean) => ipcRenderer.invoke('toggle-sidebar', collapsed),
    hideBrowserView: () => ipcRenderer.invoke('hide-browser-view'),
    updateViewBounds: (bounds: any) => ipcRenderer.invoke('update-view-bounds', bounds),
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
    googleLogin: () => ipcRenderer.invoke('google-login'),
    googleLogout: () => ipcRenderer.invoke('google-logout'),
    megaLogin: (email: string, pass: string) => ipcRenderer.invoke('mega-login', email, pass),
    megaLogout: () => ipcRenderer.invoke('mega-logout'),
    startOpenClaw: () => ipcRenderer.invoke('start-openclaw'),
});
