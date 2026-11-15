// Type definitions for the Electron API exposed through contextBridge.

declare global {
    interface PrivacySettings {
        adShield?: boolean;
        scriptFortress?: boolean;
        fingerprintCloak?: boolean;
        forceHttps?: boolean;
        deepSpoof?: boolean;
        lowDataMode?: boolean;
        blockThirdPartyFonts?: boolean;
        blockAutoplayMedia?: boolean;
        dataRetention?: '1d' | '7d' | '30d' | 'forever';
    }

    interface HooUpdateResult {
        ok: boolean;
        status: 'updated' | 'current' | 'unsupported' | 'busy' | 'failed' | 'restart-required' | 'downloading';
        message: string;
        details?: string;
        channel: 'electron-updater' | 'git-source' | 'none';
        version?: string;
    }

    interface AppUpdateStatus {
        phase: 'idle' | 'checking' | 'downloading' | 'downloaded' | 'current' | 'error';
        message: string;
        channel: 'electron-updater' | 'git-source' | 'none';
        version?: string;
        percent?: number;
    }

    interface HooPerformanceSnapshot {
        startupMs: number;
        uptimeSeconds: number;
        cpu: number;
        memory: {
            processMb: number;
            usedGb: string;
            totalGb: string;
        };
        storage: {
            usedBytes: number;
            usedText: string;
        };
        tabs: {
            active: number;
            background: number;
            totalBrowserViews: number;
        };
        network: {
            requestCount: number;
            approxReceivedBytes: number;
            approxReceivedText: string;
        };
        profile: {
            encryptionAvailable: boolean;
            downloadsStored: number;
            crashedTabsStored: number;
        };
        modes: {
            lowDataMode: boolean;
            aiLoaded: boolean;
        };
    }

    interface HooDownloadRecord {
        id: string;
        url: string;
        filename: string;
        savePath: string;
        state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
        receivedBytes: number;
        totalBytes: number;
        startedAt: number;
        endedAt?: number;
        danger?: string;
    }

    interface HooHistoryEntry {
        url: string;
        title: string;
        timestamp: number;
    }

    interface HooPermissionRequest {
        requestId: string;
        permission: string;
        origin: string;
        description: string;
    }

    interface HooSitePermissionRow {
        key: string;
        origin: string;
        permission: string;
        decision: 'allow' | 'block';
    }

    interface HooBookmarkEntry {
        id: string;
        title: string;
        url: string;
        folder?: string;
        addedAt?: number;
    }

    interface ElectronAPI {
        navigateTab: (tabId: string, url: string) => Promise<void>;
        setMosaicView: (tabId1: string, tabId2: string) => Promise<{ activeTabId: string, splitTabId: string }>;
        clearMosaicView: () => Promise<void>;
        goBack: (tabId: string) => Promise<void>;
        goForward: (tabId: string) => Promise<void>;
        reload: (tabId: string) => Promise<void>;
        stopLoading: (tabId: string) => Promise<void>;
        createTab: (url: string, partition?: string, isApp?: boolean, title?: string) => Promise<string>;
        updateViewBounds: (bounds: { x: number, y: number, width: number, height: number }) => Promise<void>;
        switchTab: (tabId: string) => Promise<string>;
        closeTab: (tabId: string) => Promise<void>;
        renameTab: (tabId: string, title: string) => Promise<void>;
        reorderTabs: (orderedIds: string[]) => Promise<void>;
        showTabMenu: (payload: any) => Promise<string | null>;
        showNewTabMenu: (payload: any) => Promise<string | null>;
        findInPage: (tabId: string, query: string, options?: { forward?: boolean; findNext?: boolean }) => Promise<void>;
        stopFindInPage: (tabId: string) => Promise<void>;
        toggleTabMute: (tabId: string) => Promise<void>;
        getDownloads: () => Promise<HooDownloadRecord[]>;
        openDownload: (id: string) => Promise<{ ok: boolean; error?: string }>;
        showDownloadInFolder: (id: string) => Promise<boolean>;
        clearDownloads: () => Promise<void>;
        getHistory: () => Promise<HooHistoryEntry[]>;
        clearHistory: () => Promise<void>;
        onHistoryCleared: (callback: () => void) => void;
        onPermissionRequest: (callback: (request: HooPermissionRequest) => void) => void;
        resolvePermission: (requestId: string, decision: 'allow' | 'block', remember: boolean) => Promise<boolean>;
        getSitePermissions: () => Promise<HooSitePermissionRow[]>;
        clearSitePermissions: (key?: string) => Promise<void>;
        getSiteZooms: () => Promise<Record<string, number>>;
        clearSiteZooms: () => Promise<void>;
        restoreCrashedTabs: () => Promise<number>;
        rssFetch: (url: string) => Promise<{ ok: boolean; contents?: string; error?: string }>;
        exportBookmarks: (entries: HooBookmarkEntry[]) => Promise<{ ok: boolean; path?: string; error?: string }>;
        importBookmarks: () => Promise<{ ok: boolean; bookmarks?: HooBookmarkEntry[]; error?: string }>;
        navigateTo: (url: string) => Promise<string | null>;
        updatePrivacySettings: (settings: PrivacySettings) => Promise<PrivacySettings>;
        getInitialData: () => Promise<{ tabs: any[], history: any[], downloads?: any[], crashedTabs?: any[], settings: PrivacySettings, activeTabId?: string | null }>;
        getSystemMetrics: () => Promise<HooPerformanceSnapshot>;
        getPerformanceSnapshot: () => Promise<HooPerformanceSnapshot>;
        checkForUpdates: () => Promise<HooUpdateResult>;
        installAppUpdate: () => Promise<{ ok: boolean; message: string }>;
        getUpdateChannel: () => Promise<{ channel: 'electron-updater' | 'git-source' | 'none'; isPackaged: boolean }>;
        onAppUpdateStatus: (callback: (status: AppUpdateStatus) => void) => void;
        nuclearWipe: () => Promise<void>;
        hideBrowserView: () => Promise<void>;
        exitPageFullscreen: (tabId?: string) => Promise<void>;
        toggleOsFullscreen: () => Promise<void>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        reloadApp: () => Promise<void>;
        onTabTitleUpdated: (callback: (tabId: string, title: string, url?: string) => void) => void;
        onTabLoadingState: (callback: (tabId: string, loading: boolean, url?: string) => void) => void;
        onSwitchToBrowser: (callback: (tabId: string) => void) => void;
        onSwitchToHome: (callback: () => void) => void;
        onOpenUrlInNewTab: (callback: (url: string) => void) => void;
        onUiShortcut: (callback: (action: string) => void) => void;
        onNavStateUpdated: (callback: (tabId: string, canGoBack: boolean, canGoForward: boolean) => void) => void;
        onTabFaviconUpdated: (callback: (tabId: string, favicon: string) => void) => void;
        onTabAudioUpdated: (callback: (tabId: string, audible: boolean, muted: boolean) => void) => void;
        onPageTargetUrl: (callback: (url: string) => void) => void;
        onFindResult: (callback: (tabId: string, activeMatch: number, matches: number) => void) => void;
        onDownloadUpdated: (callback: (record: HooDownloadRecord) => void) => void;
        onDownloadListCleared: (callback: () => void) => void;
        onZoomChanged: (callback: (tabId: string, percent: number) => void) => void;
        onPageFullscreenChanged: (callback: (tabId: string, active: boolean) => void) => void;
        onOsFullscreenChanged: (callback: (active: boolean) => void) => void;
        googleLogin: () => Promise<any>;
        googleLogout: () => Promise<boolean>;
        megaLogin: (email: string, pass: string) => Promise<boolean>;
        megaLogout: () => Promise<void>;
        startOpenClaw: () => Promise<{ ok: boolean; error?: string }>;
    }

    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
