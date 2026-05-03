import React, { useState } from 'react';
import './styles/globals.css';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
import Home from './views/Home';
import Dashboard from './views/Dashboard';
import RSSView from './views/RSSView';
import PrivacyView from './views/PrivacyView';
import PerformanceView from './views/PerformanceView';
import BookmarksView from './views/BookmarksView';
import ExtensionsView from './views/ExtensionsView';
import Browser from './views/Browser';
import Apps from './views/Apps';
import TabStrip from './components/TabStrip';
import OpenClawPanel from './components/OpenClawPanel';
import { useEffect } from 'react';
import { Tab } from './types';

const App: React.FC = () => {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');
    const [splitTabId, setSplitTabId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
    const [openClawVisible, setOpenClawVisible] = useState<boolean>(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            if (window.electronAPI?.getInitialData) {
                const data: { tabs: Tab[], history: any[], settings: any, activeTabId?: string | null } = await window.electronAPI.getInitialData();
                if (data.settings?.user) setUser(data.settings.user);
                if (data.tabs && data.tabs.length > 0) {
                    const hasPerformance = data.tabs.some(t => t.id === 'performance');
                    const mergedTabs = hasPerformance ? data.tabs : [...data.tabs, { id: 'performance', type: 'performance' as any, title: 'Performance' }];
                    setTabs(mergedTabs);
                    setActiveTabId(data.activeTabId || mergedTabs[0].id);
                } else {
                    const defaultTabs: Tab[] = [
                        { id: 'home', type: 'home', title: 'Overview' },
                        { id: 'dashboard', type: 'dashboard', title: 'Dashboard' },
                        { id: 'apps', type: 'apps', title: 'Apps' },
                        { id: 'rss', type: 'rss', title: 'RSS' },
                        { id: 'privacy', type: 'privacy', title: 'Privacy' },
                        { id: 'performance', type: 'performance' as any, title: 'Performance' },
                        { id: 'bookmarks', type: 'bookmarks', title: 'Bookmarks' },
                        { id: 'extensions', type: 'extensions', title: 'Extensions' },
                    ];
                    setTabs(defaultTabs);
                    setActiveTabId('home');
                }
            }
        };
        loadInitialData();
    }, []);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'k')) e.preventDefault();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!activeTab) return;
        if (activeTab.type !== 'browser') window.electronAPI?.hideBrowserView();
        else window.electronAPI?.switchTab(activeTab.id);
    }, [activeTabId, activeTab]);

    useEffect(() => {
        window.electronAPI?.onTabTitleUpdated((tabId, title, url) => setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title, url: url || t.url } : t)));
        window.electronAPI?.onSwitchToBrowser((tabId) => {
            setActiveTabId(tabId);
            setTabs(prev => prev.find(t => t.id === tabId) ? prev : [...prev, { id: tabId, type: 'browser', title: 'Loading...', url: '' }]);
        });
    }, []);

    const toggleSidebar = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        window.electronAPI?.toggleSidebar(newState);
    };

    const handleCreateTab = async (url: string = 'about:blank') => {
        if (!window.electronAPI?.createTab) return;
        const tabId = await window.electronAPI.createTab(url);
        setTabs(prev => [...prev, { id: tabId, type: 'browser', title: 'New Tab', url }]);
        setActiveTabId(tabId);
        if (sidebarCollapsed) toggleSidebar();
    };

    const handleLaunchApp = async (url: string, name: string) => {
        if (!window.electronAPI?.createTab) return;
        const partition = name.toLowerCase().replace(/\s+/g, '-');
        const tabId = await window.electronAPI.createTab(url, partition, true, name);
        setTabs(prev => [...prev, { id: tabId, type: 'browser', title: name, url, isApp: true, partition }]);
        setActiveTabId(tabId);
        if (sidebarCollapsed) toggleSidebar();
    };

    const handleSwitchTab = async (tabId: string) => {
        if (tabId === activeTabId) return;
        const targetTab = tabs.find(t => t.id === tabId);
        if (targetTab && targetTab.type === 'browser') await window.electronAPI?.switchTab(tabId);
        setActiveTabId(tabId);
        setSplitTabId(null);
        if (targetTab?.type === 'browser' && sidebarCollapsed) toggleSidebar();
    };

    const handleSplitTab = async (tabId: string) => {
        if (tabId === activeTabId) return;
        if (window.electronAPI?.setMosaicView) {
            await window.electronAPI.setMosaicView(activeTabId, tabId);
            setSplitTabId(tabId);
        }
    };

    const handleCloseTab = async (tabId: string) => {
        const targetTab = tabs.find(t => t.id === tabId);
        if (!targetTab || targetTab.type !== 'browser') return;
        await window.electronAPI?.closeTab(tabId);
        const filtered = tabs.filter(t => t.id !== tabId);
        setTabs(filtered);
        if (activeTabId === tabId) handleSwitchTab(filtered[filtered.length - 1]?.id || 'home');
    };

    const renderView = () => {
        if (!activeTab) return <Home />;
        switch (activeTab.type as any) {
            case 'home': return <Home />;
            case 'dashboard': return <Dashboard />;
            case 'rss': return <RSSView />;
            case 'privacy': return <PrivacyView />;
            case 'performance': return <PerformanceView />;
            case 'bookmarks': return <BookmarksView />;
            case 'extensions': return <ExtensionsView />;
            case 'apps': return <Apps onLaunchApp={handleLaunchApp} />;
            case 'browser': return <Browser tabs={tabs.filter(t => t.type === 'browser')} activeTabId={activeTabId} onSwitchTab={handleSwitchTab} onCloseTab={handleCloseTab} onCreateTab={() => handleCreateTab()} onUpdateTabs={(update: any) => {
                if (typeof update === 'function') setTabs(prev => [...prev.filter(t => t.type !== 'browser'), ...update(prev.filter(t => t.type === 'browser'))]);
            }} />;
            default: return <Home />;
        }
    };

    const handleLogin = async () => {
        if (!window.electronAPI?.googleLogin) return;
        try { setUser(await window.electronAPI.googleLogin()); } catch (error) { console.error('Login failed:', error); }
    };
    const handleLogout = async () => { await window.electronAPI?.googleLogout?.(); setUser(null); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}>
            <TitleBar />
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 20px 20px 0' }}>
                <Sidebar activeTabId={activeTabId} tabs={tabs} collapsed={sidebarCollapsed} user={user} onToggleCollapse={toggleSidebar} onSwitchTab={handleSwitchTab} onCloseTab={handleCloseTab} onCreateTab={() => handleCreateTab()} onSettingsClick={() => setSettingsOpen(true)} onLogin={handleLogin} onLogout={handleLogout} openClawVisible={openClawVisible} onToggleOpenClaw={() => setOpenClawVisible(!openClawVisible)} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)', margin: '24px 0 0 10px' }}>
                    {activeTab?.type === 'browser' && <TabStrip tabs={tabs.filter(t => t.type === 'browser')} activeTabId={activeTabId} splitTabId={splitTabId} onSwitchTab={handleSwitchTab} onSplitTab={handleSplitTab} onCloseTab={handleCloseTab} onCreateTab={() => handleCreateTab()} />}
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{renderView()}</div>
                </div>
                {openClawVisible && <div style={{ width: '360px', marginLeft: '10px', marginTop: '24px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', border: '1px solid rgba(34, 197, 94, 0.12)' }}><OpenClawPanel activeTabUrl={tabs.find(t => t.id === activeTabId)?.url} activeTabTitle={tabs.find(t => t.id === activeTabId)?.title} onClose={() => setOpenClawVisible(false)} /></div>}
            </div>
            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
};

export default App;
