import React, { useState, useEffect } from 'react';
import './styles/globals.css';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
import Home from './views/Home';
import Browser from './views/Browser';
import TabStrip from './components/TabStrip';
import { Tab } from './types';

const HOME_TAB: Tab = { id: 'home', type: 'home', title: 'New Tab' };

const App: React.FC = () => {
    const [tabs, setTabs] = useState<Tab[]>([HOME_TAB]);
    const [activeTabId, setActiveTabId] = useState<string>('home');
    const [splitTabId, setSplitTabId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

    useEffect(() => {
        const loadInitialData = async (): Promise<void> => {
            if (!window.electronAPI?.getInitialData) return;
            const data: { tabs: Tab[], activeTabId?: string | null } = await window.electronAPI.getInitialData();
            const browserTabs = (data.tabs || []).filter(t => t.type === 'browser');
            setTabs([HOME_TAB, ...browserTabs]);
            setActiveTabId(data.activeTabId && browserTabs.some(t => t.id === data.activeTabId) ? data.activeTabId : 'home');
        };
        void loadInitialData();
    }, []);

    const activeTab = tabs.find(t => t.id === activeTabId) || HOME_TAB;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('hoo-focus-address'));
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
                e.preventDefault();
                setActiveTabId('home');
            }
            if (e.key === 'Escape' && settingsOpen) {
                e.preventDefault();
                setSettingsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settingsOpen]);

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
            setTabs(prev => prev.find(t => t.id === tabId) ? prev : [...prev.filter(t => t.id !== 'home'), { id: tabId, type: 'browser', title: 'Loading...', url: '' }]);
            setActiveTabId(tabId);
        });
    }, []);

    const openHomeTab = (): void => {
        setTabs(prev => prev.some(t => t.id === 'home') ? prev : [HOME_TAB, ...prev]);
        setActiveTabId('home');
    };

    const handleNavigateFromHome = async (url: string): Promise<void> => {
        if (!window.electronAPI?.navigateTo) return;
        const tabId = await window.electronAPI.navigateTo(url);
        if (!tabId) return;
        setTabs(prev => prev.find(t => t.id === tabId) ? prev : [...prev.filter(t => t.id !== 'home'), { id: tabId, type: 'browser', title: 'Loading...', url }]);
        setActiveTabId(tabId);
    };

    const handleSwitchTab = async (tabId: string): Promise<void> => {
        if (tabId === activeTabId) return;
        const targetTab = tabs.find(t => t.id === tabId);
        if (targetTab?.type === 'browser') await window.electronAPI?.switchTab(tabId);
        setActiveTabId(tabId);
        setSplitTabId(null);
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

    const handleCloseTab = async (tabId: string): Promise<void> => {
        const targetTab = tabs.find(t => t.id === tabId);
        if (!targetTab || targetTab.type !== 'browser') return;
        await window.electronAPI?.closeTab(tabId);
        const remaining = tabs.filter(t => t.id !== tabId);
        const remainingBrowserTabs = remaining.filter(t => t.type === 'browser');
        setTabs(remainingBrowserTabs.length ? [HOME_TAB, ...remainingBrowserTabs] : [HOME_TAB]);
        if (activeTabId === tabId) setActiveTabId(remainingBrowserTabs[remainingBrowserTabs.length - 1]?.id || 'home');
    };

    const browserTabs = tabs.filter(t => t.type === 'browser');
    const stripTabs = [HOME_TAB, ...browserTabs];
    const showBrowserChrome = true;

    return (
        <div className="app-shell">
            <TitleBar />
            <main className="browser-shell">
                {showBrowserChrome && (
                    <TabStrip
                        tabs={stripTabs}
                        activeTabId={activeTabId}
                        splitTabId={splitTabId}
                        onSwitchTab={(id): void => { void handleSwitchTab(id); }}
                        onSplitTab={(id): void => { void handleSplitTab(id); }}
                        onCloseTab={(id): void => { void handleCloseTab(id); }}
                        onCreateTab={openHomeTab}
                    />
                )}
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
