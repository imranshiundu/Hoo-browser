import React, { useState } from 'react';
import './styles/globals.css';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
import Home from './views/Home';
import Dashboard from './views/Dashboard';
import RSSView from './views/RSSView';
import PrivacyView from './views/PrivacyView';
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
    const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
    const [openClawVisible, setOpenClawVisible] = useState<boolean>(false);

    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            if (window.electronAPI?.getInitialData) {
                const data: { tabs: Tab[], history: any[], settings: any, activeTabId?: string | null } = await window.electronAPI.getInitialData();
                if (data.settings?.user) {
                    setUser(data.settings.user);
                }
                if (data.tabs && data.tabs.length > 0) {
                    setTabs(data.tabs);
                    setActiveTabId(data.activeTabId || data.tabs[0].id);
                } else {
                    const defaultTabs: Tab[] = [
                        { id: 'home', type: 'home', title: 'Overview' },
                        { id: 'dashboard', type: 'dashboard', title: 'Dashboard' },
                        { id: 'apps', type: 'apps', title: 'Apps' },
                        { id: 'rss', type: 'rss', title: 'RSS' },
                        { id: 'privacy', type: 'privacy', title: 'Privacy' },
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

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]; // Derived activeTab

    // Listen for Command Palette shortcut (Ctrl+L or Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'k')) {
                e.preventDefault();
                setCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Synchronize visibility of BrowserView in Main process
    useEffect(() => {
        if (!activeTab) return;

        if (activeTab.type !== 'browser') {
            window.electronAPI?.hideBrowserView();
        } else {
            // Ensure the main process shows the view even on initial load
            window.electronAPI?.switchTab(activeTab.id);
        }
    }, [activeTabId, activeTab]);

    // Handle Tab Title Updates from Main Process
    useEffect(() => {
        const unsubscribeTitle = window.electronAPI?.onTabTitleUpdated((tabId, title, url) => {
            setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title, url: url || t.url } : t));
        });

        const unsubscribeSwitch = window.electronAPI?.onSwitchToBrowser((tabId) => {
            setActiveTabId(tabId);
            setTabs(prev => {
                if (prev.find(t => t.id === tabId)) return prev;
                return [...prev, { id: tabId, type: 'browser', title: 'Loading...', url: '' }]; // Added type: 'browser'
            });
        });

        return () => {
            // Unsubscribe logic if needed
        };
    }, []);

    const toggleSidebar = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        window.electronAPI?.toggleSidebar(newState);
    };

    const handleCreateTab = async (url: string = 'about:blank') => {
        if (!window.electronAPI?.createTab) return;
        const tabId = await window.electronAPI.createTab(url);
        const newTab: Tab = { id: tabId, type: 'browser', title: 'New Tab', url }; // Added type: 'browser'
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(tabId);
        if (sidebarCollapsed) toggleSidebar(); // Auto-expand for better tab visibility
    };

    const handleLaunchApp = async (url: string, name: string) => {
        if (!window.electronAPI?.createTab) return;
        const partition = name.toLowerCase().replace(/\s+/g, '-');
        const tabId = await window.electronAPI.createTab(url, partition, true, name);
        const newTab: Tab = { id: tabId, type: 'browser', title: name, url, isApp: true, partition };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(tabId);
        if (sidebarCollapsed) toggleSidebar();
    };

    const handleSwitchTab = async (tabId: string) => {
        if (tabId === activeTabId) return;

        const targetTab = tabs.find(t => t.id === tabId);
        if (targetTab && targetTab.type === 'browser') {
            if (window.electronAPI?.switchTab) await window.electronAPI.switchTab(tabId);
        }

        setActiveTabId(tabId);
        setSplitTabId(null); // Clear split view on direct switch
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
        // Don't close pinned tabs
        const targetTab = tabs.find(t => t.id === tabId);
        if (!targetTab || targetTab.type !== 'browser') return; // Prevent closing non-browser tabs

        if (window.electronAPI?.closeTab) await window.electronAPI.closeTab(tabId);

        const filtered = tabs.filter(t => t.id !== tabId);
        setTabs(filtered);

        if (activeTabId === tabId) {
            const lastTab = filtered[filtered.length - 1];
            if (lastTab) {
                handleSwitchTab(lastTab.id);
            } else {
                // If no tabs left, create a new one or switch to a pinned tab
                handleSwitchTab('home'); // Fallback to home if no tabs left
            }
        }
    };

    const handleNavigate = async (url: string) => { // Added handleNavigate function
        if (activeTab.type === 'browser') {
            await window.electronAPI?.navigateTab(activeTabId, url);
        } else {
            handleCreateTab(url);
        }
    };

    const renderView = () => {
        if (!activeTab) return <Home />;

        switch (activeTab.type) {
            case 'home':
                return <Home />;
            case 'dashboard':
                return <Dashboard />;
            case 'rss':
                return <RSSView />;
            case 'privacy':
                return <PrivacyView />;
            case 'bookmarks':
                return <BookmarksView />;
            case 'extensions':
                return <ExtensionsView />;
            case 'apps':
                return <Apps onLaunchApp={handleLaunchApp} />;
            case 'browser':
                return (
                    <Browser
                        tabs={tabs.filter(t => t.type === 'browser')}
                        activeTabId={activeTabId}
                        onSwitchTab={handleSwitchTab}
                        onCloseTab={handleCloseTab}
                        onCreateTab={() => handleCreateTab()}
                        onUpdateTabs={(update: any) => {
                            if (typeof update === 'function') {
                                setTabs(prev => {
                                    const browserTabs = prev.filter(t => t.type === 'browser');
                                    const updatedBrowserTabs = update(browserTabs);
                                    const pinnedTabs = prev.filter(t => t.type !== 'browser');
                                    return [...pinnedTabs, ...updatedBrowserTabs];
                                });
                            }
                        }}
                    />
                );
            default:
                return <Home />;
        }
    };

    const handleLogin = async () => {
        if (!window.electronAPI?.googleLogin) return;
        try {
            const profile = await window.electronAPI.googleLogin();
            setUser(profile);
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    const handleLogout = async () => {
        if (!window.electronAPI?.googleLogout) return;
        await window.electronAPI.googleLogout();
        setUser(null);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}>
            <TitleBar />
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 20px 20px 0' }}>
                <Sidebar
                    activeTabId={activeTabId}
                    tabs={tabs}
                    collapsed={sidebarCollapsed}
                    user={user}
                    onToggleCollapse={toggleSidebar}
                    onSwitchTab={handleSwitchTab}
                    onCloseTab={handleCloseTab}
                    onCreateTab={() => handleCreateTab()}
                    onSettingsClick={() => setSettingsOpen(true)}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    openClawVisible={openClawVisible}
                    onToggleOpenClaw={() => setOpenClawVisible(!openClawVisible)}
                />
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    margin: '24px 0 0 10px'
                }}>
                    {activeTab?.type === 'browser' && (
                        <TabStrip
                            tabs={tabs.filter(t => t.type === 'browser')}
                            activeTabId={activeTabId}
                            splitTabId={splitTabId}
                            onSwitchTab={handleSwitchTab}
                            onSplitTab={handleSplitTab}
                            onCloseTab={handleCloseTab}
                            onCreateTab={() => handleCreateTab()}
                        />
                    )}
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                        {renderView()}
                    </div>
                </div>
                {openClawVisible && (
                    <div style={{
                        width: '360px',
                        marginLeft: '10px',
                        marginTop: '24px',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1px solid rgba(34, 197, 94, 0.12)'
                    }}>
                        <OpenClawPanel
                            activeTabUrl={tabs.find(t => t.id === activeTabId)?.url}
                            activeTabTitle={tabs.find(t => t.id === activeTabId)?.title}
                            onClose={() => setOpenClawVisible(false)}
                        />
                    </div>
                )}
            </div>
            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
        </div>
    );
};

export default App;
