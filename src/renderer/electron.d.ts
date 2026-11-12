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
        status: 'updated' | 'current' | 'unsupported' | 'busy' | 'failed';
        message: string;
        details?: string;
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
        navigateTo: (url: string) => Promise<string | null>;
        updatePrivacySettings: (settings: PrivacySettings) => Promise<PrivacySettings>;
        getInitialData: () => Promise<{ tabs: any[], history: any[], downloads?: any[], crashedTabs?: any[], settings: PrivacySettings, activeTabId?: string | null }>;
        getSystemMetrics: () => Promise<HooPerformanceSnapshot>;
        getPerformanceSnapshot: () => Promise<HooPerformanceSnapshot>;
        checkForUpdates: () => Promise<HooUpdateResult>;
        nuclearWipe: () => Promise<void>;
        toggleSidebar: (collapsed: boolean) => Promise<void>;
        hideBrowserView: () => Promise<void>;
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
