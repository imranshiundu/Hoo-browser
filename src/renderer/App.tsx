import React, { useState, useEffect } from 'react';
import './styles/globals.css';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
import Home from './views/Home';
import Browser from './views/Browser';
import TabStrip from './components/TabStrip';
import { Tab } from './types';

const makeHomeTab = (): Tab => ({ id: `home-${Date.now()}`, type: 'home', title: 'New Tab' });
const initialHomeTab = makeHomeTab();

const App: React.FC = () => {
    const [tabs, setTabs] = useState<Tab[]>([initialHomeTab]);
    const [activeTabId, setActiveTabId] = useState<string>(initialHomeTab.id);
    const [splitTabId, setSplitTabId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || initialHomeTab;

    const openHomeTab = (): void => {
        const tab = makeHomeTab();
        setTabs(prev => [...prev, tab]);
        setActiveTabId(tab.id);
        setSplitTabId(null);
        void window.electronAPI?.hideBrowserView?.();
    };

    useEffect(() => {
        const loadInitialData = async (): Promise<void> => {
            if (!window.electronAPI?.getInitialData) return;
            const data: { tabs: Tab[], activeTabId?: string | null } = await window.electronAPI.getInitialData();
            const browserTabs = (data.tabs || []).filter(t => t.type === 'browser');
            const restoredActive = data.activeTabId && browserTabs.some(t => t.id === data.activeTabId)
                ? data.activeTabId
                : browserTabs[0]?.id;
            if (browserTabs.length) {
                setTabs(browserTabs);
                setActiveTabId(restoredActive || browserTabs[0].id);
            } else {
                const home = makeHomeTab();
                setTabs([home]);
                setActiveTabId(home.id);
            }
        };
        void loadInitialData();
    }, []);

    const handleSwitchTab = async (tabId: string): Promise<void> => {
        if (tabId === activeTabId) return;
        const targetTab = tabs.find(t => t.id === tabId);
        if (targetTab?.type === 'browser') await window.electronAPI?.switchTab(tabId);
        else await window.electronAPI?.hideBrowserView?.();
        setActiveTabId(tabId);
        setSplitTabId(null);
    };

    const handleCloseTab = async (tabId: string): Promise<void> => {
        const targetTab = tabs.find(t => t.id === tabId);
        if (!targetTab) return;

        const tabIndex = tabs.findIndex(t => t.id === tabId);
        const remainingTabs = tabs.filter(t => t.id !== tabId);
        const nextTab = remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)] || remainingTabs[remainingTabs.length - 1];

        if (targetTab.type === 'browser') await window.electronAPI?.closeTab(tabId);
        else await window.electronAPI?.hideBrowserView?.();

        if (!remainingTabs.length) {
            const home = makeHomeTab();
            setTabs([home]);
            setActiveTabId(home.id);
            setSplitTabId(null);
            await window.electronAPI?.hideBrowserView?.();
            return;
        }

        setTabs(remainingTabs);
        if (activeTabId === tabId || splitTabId === tabId) {
            setActiveTabId(nextTab.id);
            setSplitTabId(null);
            if (nextTab.type === 'browser') await window.electronAPI?.switchTab(nextTab.id);
            else await window.electronAPI?.hideBrowserView?.();
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            const key = e.key.toLowerCase();
            const mod = e.ctrlKey || e.metaKey;
            if (mod && key === 'l') {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('hoo-focus-address'));
            }
            if (mod && key === 't') {
                e.preventDefault();
                openHomeTab();
            }
            if (mod && key === 'w') {
                e.preventDefault();
                void handleCloseTab(activeTabId);
            }
            if (mod && e.shiftKey && key === 'tab') {
                e.preventDefault();
                const index = tabs.findIndex(t => t.id === activeTabId);
                const next = tabs[(index - 1 + tabs.length) % tabs.length];
                if (next) void handleSwitchTab(next.id);
            } else if (mod && key === 'tab') {
                e.preventDefault();
                const index = tabs.findIndex(t => t.id === activeTabId);
                const next = tabs[(index + 1) % tabs.length];
                if (next) void handleSwitchTab(next.id);
            }
            if (mod && /^[1-9]$/.test(key)) {
                e.preventDefault();
                const index = key === '9' ? tabs.length - 1 : Number(key) - 1;
                const next = tabs[index];
                if (next) void handleSwitchTab(next.id);
            }
            if (e.key === 'Escape' && settingsOpen) {
                e.preventDefault();
                setSettingsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settingsOpen, tabs, activeTabId, splitTabId]);

    useEffect(() => {
        if (settingsOpen) {
            void window.electronAPI?.hideBrowserView?.();
            return;
        }
        if (!activeTab || activeTab.type !== 'browser') void window.electronAPI?.hideBrowserView();
        else void window.electronAPI?.switchTab(activeTab.id);
    }, [activeTabId, activeTab, settingsOpen]);

    useEffect(() => {
        window.electronAPI?.onTabTitleUpdated((tabId, title, url) => {
            setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title, url: url || t.url } : t));
        });
        window.electronAPI?.onSwitchToBrowser((tabId) => {
            setTabs(prev => prev.find(t => t.id === tabId)
                ? prev.filter(t => t.type !== 'home')
                : [...prev.filter(t => t.type !== 'home'), { id: tabId, type: 'browser', title: 'Loading...', url: '' }]);
            setActiveTabId(tabId);
        });
        window.electronAPI?.onSwitchToHome?.(() => {
            const home = makeHomeTab();
            setTabs(prev => [...prev.filter(t => t.type !== 'home'), home]);
            setActiveTabId(home.id);
            setSplitTabId(null);
        });
    }, []);

    const handleNavigateFromHome = async (url: string): Promise<void> => {
        if (!window.electronAPI?.navigateTo) return;
        const tabId = await window.electronAPI.navigateTo(url);
        if (!tabId) return;
        setTabs(prev => prev.find(t => t.id === tabId)
            ? prev.filter(t => t.type !== 'home')
            : [...prev.filter(t => t.type !== 'home'), { id: tabId, type: 'browser', title: 'Loading...', url }]);
        setActiveTabId(tabId);
    };

    const handleSplitTab = async (tabId: string): Promise<void> => {
        if (tabId === activeTabId) return;
        const active = tabs.find(t => t.id === activeTabId);
        const target = tabs.find(t => t.id === tabId);
        if (active?.type !== 'browser' || target?.type !== 'browser') return;
        if (window.electronAPI?.setMosaicView) {
            await window.electronAPI.setMosaicView(activeTabId, tabId);
            setSplitTabId(tabId);
        }
    };

    const browserTabs = tabs.filter(t => t.type === 'browser');

    return (
        <div className="app-shell">
            <TitleBar />
            <main className="browser-shell">
                <TabStrip
                    tabs={tabs}
                    activeTabId={activeTabId}
                    splitTabId={splitTabId}
                    onSwitchTab={(id): void => { void handleSwitchTab(id); }}
                    onSplitTab={(id): void => { void handleSplitTab(id); }}
                    onCloseTab={(id): void => { void handleCloseTab(id); }}
                    onCreateTab={openHomeTab}
                />
                <section className="browser-stage">
                    {activeTab.type === 'browser' ? (
                        <Browser
                            tabs={browserTabs}
                            activeTabId={activeTabId}
                            onSwitchTab={handleSwitchTab}
                            onCloseTab={handleCloseTab}
                            onCreateTab={openHomeTab}
                            onUpdateTabs={(): void => undefined}
                            onOpenSettings={() => setSettingsOpen(true)}
                        />
                    ) : (
                        <Home onNavigate={handleNavigateFromHome} onOpenSettings={() => setSettingsOpen(true)} />
                    )}
                </section>
            </main>
            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
};

export default App;
