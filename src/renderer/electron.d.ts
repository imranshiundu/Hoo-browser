// Type definitions for Electron API exposed via contextBridge

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

interface ElectronAPI {
    navigateTab: (tabId: string, url: string) => Promise<void>;
    setMosaicView: (tabId1: string, tabId2: string) => Promise<{ activeTabId: string, splitTabId: string }>;
    clearMosaicView: () => Promise<void>;
    goBack: (tabId: string) => Promise<void>;
    goForward: (tabId: string) => Promise<void>;
    reload: (tabId: string) => Promise<void>;
    createTab: (url: string, partition?: string, isApp?: boolean, title?: string) => Promise<string>;
    updateViewBounds: (bounds: { x: number, y: number, width: number, height: number }) => Promise<void>;
    switchTab: (tabId: string) => Promise<string>;
    closeTab: (tabId: string) => Promise<void>;
    renameTab: (tabId: string, title: string) => Promise<void>;
    navigateTo: (url: string) => Promise<void>;
    updatePrivacySettings: (settings: PrivacySettings) => Promise<PrivacySettings>;
    getInitialData: () => Promise<{ tabs: any[], history: any[], downloads?: any[], crashedTabs?: any[], settings: PrivacySettings }>;
    getSystemMetrics: () => Promise<HooPerformanceSnapshot>;
    getPerformanceSnapshot: () => Promise<HooPerformanceSnapshot>;
    nuclearWipe: () => Promise<void>;
    checkForUpdates: () => Promise<HooUpdateResult>;
    toggleSidebar: (collapsed: boolean) => Promise<void>;
    hideBrowserView: () => Promise<void>;
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    reloadApp: () => Promise<void>;
    onTabTitleUpdated: (callback: (tabId: string, title: string, url?: string) => void) => void;
    onSwitchToBrowser: (callback: (tabId: string) => void) => void;
    googleLogin: () => Promise<any>;
    googleLogout: () => Promise<boolean>;
    megaLogin: (email: string, pass: string) => Promise<boolean>;
    megaLogout: () => Promise<void>;
    startOpenClaw: () => Promise<{ ok: boolean; error?: string }>;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
