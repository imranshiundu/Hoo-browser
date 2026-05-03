import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    // Tab Management
    createTab: (url: string, partition?: string, isApp?: boolean, title?: string) => ipcRenderer.invoke('create-tab', url, partition, isApp, title),
    switchTab: (tabId: string) => ipcRenderer.invoke('switch-tab', tabId),
    closeTab: (tabId: string) => ipcRenderer.invoke('close-tab', tabId),
    renameTab: (tabId: string, title: string) => ipcRenderer.invoke('rename-tab', tabId, title),

    // Navigation
    navigateTab: (tabId: string, url: string) => ipcRenderer.invoke('navigate-tab', tabId, url),
    setMosaicView: (tabId1: string, tabId2: string) => ipcRenderer.invoke('set-mosaic-view', tabId1, tabId2),
    clearMosaicView: () => ipcRenderer.invoke('clear-mosaic-view'),
    goBack: (tabId: string) => ipcRenderer.invoke('go-back', tabId),
    goForward: (tabId: string) => ipcRenderer.invoke('go-forward', tabId),
    reload: (tabId: string) => ipcRenderer.invoke('reload', tabId),

    // Quick Navigation
    navigateTo: (url: string) => ipcRenderer.invoke('navigate-to', url),

    // Privacy Settings and Browser Status
    updatePrivacySettings: (settings: any) => ipcRenderer.invoke('update-privacy-settings', settings),
    getInitialData: () => ipcRenderer.invoke('get-initial-data'),
    getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
    getEncryptionStatus: () => ipcRenderer.invoke('get-encryption-status'),
    getOSProfile: () => ipcRenderer.invoke('get-os-profile'),
    getDownloads: () => ipcRenderer.invoke('get-downloads'),
    getCrashedTabs: () => ipcRenderer.invoke('get-crashed-tabs'),
    setSitePermission: (origin: string, permission: string, decision: 'allow' | 'deny' | 'ask') => ipcRenderer.invoke('set-site-permission', origin, permission, decision),
    nuclearWipe: () => ipcRenderer.invoke('nuclear-wipe'),

    // Sidebar
    toggleSidebar: (collapsed: boolean) => ipcRenderer.invoke('toggle-sidebar', collapsed),
    hideBrowserView: () => ipcRenderer.invoke('hide-browser-view'),
    updateViewBounds: (bounds: any) => ipcRenderer.invoke('update-view-bounds', bounds),

    // Window Controls
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    reloadApp: () => ipcRenderer.invoke('window-reload'),

    // Event Listeners
    onTabTitleUpdated: (callback: (tabId: string, title: string, url?: string) => void) => {
        ipcRenderer.on('tab-title-updated', (_event, tabId, title, url) => callback(tabId, title, url));
    },
    onSwitchToBrowser: (callback: (tabId: string) => void) => {
        ipcRenderer.on('switch-to-browser', (_event, tabId) => callback(tabId));
    },
    onDownloadUpdated: (callback: (download: any) => void) => {
        ipcRenderer.on('download-updated', (_event, download) => callback(download));
    },
    onPermissionRequest: (callback: (request: any) => void) => {
        ipcRenderer.on('permission-request', (_event, request) => callback(request));
    },
    onTabCrashed: (callback: (crash: any) => void) => {
        ipcRenderer.on('tab-crashed', (_event, crash) => callback(crash));
    },

    // Auth
    googleLogin: () => ipcRenderer.invoke('google-login'),
    googleLogout: () => ipcRenderer.invoke('google-logout'),
    megaLogin: (email: string, pass: string) => ipcRenderer.invoke('mega-login', email, pass),
    megaLogout: () => ipcRenderer.invoke('mega-logout'),
    startOpenClaw: () => ipcRenderer.invoke('start-openclaw'),
});
