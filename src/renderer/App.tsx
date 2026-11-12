import React, { useState, useEffect, useRef } from 'react';
import './styles/globals.css';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
import Home from './views/Home';
import Browser from './views/Browser';
import TabStrip from './components/TabStrip';
import { Tab, TabType } from './types';
import { reorderTabsByIds } from '../main/tab-utils';
import { AlertTriangle, X } from 'lucide-react';

const makeHomeTab = (): Tab => ({ id: `home-${Date.now()}`, type: 'home', title: 'New Tab' });
const initialHomeTab = makeHomeTab();
const PINNED_TABS_KEY = 'hoo:pinned-tabs';
const BOOKMARK_KEY = 'hoo:bookmarks';

type ClosedTab = { title: string; url: string };

const App: React.FC = () => {
    const [tabs, setTabs] = useState<Tab[]>([initialHomeTab]);
    const [activeTabId, setActiveTabId] = useState<string>(initialHomeTab.id);
    const [splitTabId, setSplitTabId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
    const [closedTabs, setClosedTabs] = useState<ClosedTab[]>([]);
    const [pinnedTabIds, setPinnedTabIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(PINNED_TABS_KEY) || '[]'); }
        catch { return []; }
    });

    // Runtime state mirrored from the main process: which tabs are loading,
    // their real favicons, audio indicators and back/forward availability.
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
    const [favicons, setFavicons] = useState<Record<string, string>>({});
    const [audibleMap, setAudibleMap] = useState<Record<string, boolean>>({});
    const [mutedMap, setMutedMap] = useState<Record<string, boolean>>({});
    const [navState, setNavState] = useState<Record<string, { canGoBack: boolean; canGoForward: boolean }>>({});
    const [zoomBadge, setZoomBadge] = useState<{ percent: number; at: number } | null>(null);
    const [crashNotice, setCrashNotice] = useState<string | null>(null);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || initialHomeTab;

    useEffect(() => {
        localStorage.setItem(PINNED_TABS_KEY, JSON.stringify(pinnedTabIds.filter(id => tabs.some(tab => tab.id === id))));
    }, [pinnedTabIds, tabs]);

    const rememberClosedTab = (tab: Tab): void => {
        if (tab.type !== 'browser' || !tab.url) return;
        setClosedTabs(prev => [{ title: tab.title || tab.url, url: tab.url }, ...prev].slice(0, 20));
    };

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
            const data: { tabs: Tab[], activeTabId?: string | null, crashedTabs?: Array<{ title?: string }> } = await window.electronAPI.getInitialData();
            const browserTabs = (data.tabs || []).filter(t => t.type === 'browser' && t.url !== 'about:blank');
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
            // Favicons persisted on the tab record keep tab identity across restarts.
            const faviconSeeds: Record<string, string> = {};
            browserTabs.forEach(tab => {
                const favicon = (tab as Tab & { favicon?: string }).favicon;
                if (favicon) faviconSeeds[tab.id] = favicon;
            });
            setFavicons(prev => ({ ...faviconSeeds, ...prev }));
            // The renderer stores per-crash records but never surfaced them; tell
            // the user Hoo recovered instead of failing silently.
            const crashed = data.crashedTabs || [];
            if (crashed.length) {
                setCrashNotice(crashed.length === 1
                    ? `Hoo recovered 1 tab that crashed last session: ${crashed[0].title || 'Untitled'}`
                    : `Hoo recovered ${crashed.length} tabs that crashed last session.`);
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
        if (pinnedTabIds.includes(tabId)) return;
        rememberClosedTab(targetTab);

        const tabIndex = tabs.findIndex(t => t.id === tabId);
        const remainingTabs = tabs.filter(t => t.id !== tabId);
        const nextTab = remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)] || remainingTabs[remainingTabs.length - 1];

        if (targetTab.type === 'browser') await window.electronAPI?.closeTab(tabId);
        else await window.electronAPI?.hideBrowserView?.();

        setPinnedTabIds(prev => prev.filter(id => id !== tabId));

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

    const duplicateTab = async (tabId: string): Promise<void> => {
        const tab = tabs.find(item => item.id === tabId);
        if (!tab) return;
        if (tab.type !== 'browser' || !tab.url) {
            openHomeTab();
            return;
        }
        const newTabId = await window.electronAPI?.navigateTo?.(tab.url);
        if (!newTabId) return;
        setTabs(prev => prev.find(t => t.id === newTabId)
            ? prev
            : [...prev, { id: newTabId, type: 'browser', title: tab.title || 'Loading...', url: tab.url }]);
        setActiveTabId(newTabId);
    };

    const reopenClosedTab = async (): Promise<void> => {
        const [last, ...rest] = closedTabs;
        if (!last) return;
        setClosedTabs(rest);
        const newTabId = await window.electronAPI?.navigateTo?.(last.url);
        if (!newTabId) return;
        setTabs(prev => [...prev, { id: newTabId, type: 'browser', title: last.title || 'Loading...', url: last.url }]);
        setActiveTabId(newTabId);
    };

    const closeOtherTabs = async (tabId: string): Promise<void> => {
        const keepIds = new Set([tabId, ...pinnedTabIds]);
        const closing = tabs.filter(tab => !keepIds.has(tab.id));
        closing.forEach(rememberClosedTab);
        for (const tab of closing) {
            if (tab.type === 'browser') await window.electronAPI?.closeTab(tab.id);
        }
        const nextTabs = tabs.filter(tab => keepIds.has(tab.id));
        setTabs(nextTabs.length ? nextTabs : [makeHomeTab()]);
        setSplitTabId(null);
        await handleSwitchTab(tabId);
    };

    const closeTabsToRight = async (tabId: string): Promise<void> => {
        const index = tabs.findIndex(tab => tab.id === tabId);
        if (index < 0) return;
        const closing = tabs.slice(index + 1).filter(tab => !pinnedTabIds.includes(tab.id));
        closing.forEach(rememberClosedTab);
        for (const tab of closing) {
            if (tab.type === 'browser') await window.electronAPI?.closeTab(tab.id);
        }
        const closingIds = new Set(closing.map(tab => tab.id));
        setTabs(prev => prev.filter(tab => !closingIds.has(tab.id)));
        if (splitTabId && closingIds.has(splitTabId)) setSplitTabId(null);
    };

    const closeDuplicateTabs = async (): Promise<void> => {
        const seen = new Set<string>();
        const closing: Tab[] = [];
        for (const tab of tabs) {
            if (tab.type !== 'browser' || !tab.url || pinnedTabIds.includes(tab.id)) continue;
            if (seen.has(tab.url)) closing.push(tab);
            else seen.add(tab.url);
        }
        closing.forEach(rememberClosedTab);
        for (const tab of closing) await window.electronAPI?.closeTab(tab.id);
        const closingIds = new Set(closing.map(tab => tab.id));
        setTabs(prev => prev.filter(tab => !closingIds.has(tab.id)));
        if (closingIds.has(activeTabId)) {
            const next = tabs.find(tab => !closingIds.has(tab.id));
            if (next) await handleSwitchTab(next.id);
        }
    };

    const bookmarkAllTabs = (): void => {
        try {
            const current = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
            const browserTabs = tabs.filter(tab => tab.type === 'browser' && tab.url);
            const next = [
                ...browserTabs.map(tab => ({ id: `${Date.now()}-${tab.id}`, title: tab.title || tab.url, url: tab.url })),
                ...current
            ];
            const deduped = next.filter((item, index, all) => all.findIndex(other => other.url === item.url) === index).slice(0, 80);
            localStorage.setItem(BOOKMARK_KEY, JSON.stringify(deduped));
        } catch {
            // localStorage can fail in rare private/profile states; ignore so browser UX does not crash.
        }
    };

    const togglePinTab = (tabId: string): void => {
        setPinnedTabIds(prev => prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]);
    };

    // Drag-to-reorder. The strip sends the full id order; unknown ids are
    // filtered out and unmentioned tabs keep their relative order at the end.
    const handleReorderTabs = (orderedIds: string[]): void => {
        setTabs(prev => reorderTabsByIds(prev, orderedIds));
        void window.electronAPI?.reorderTabs?.(orderedIds);
    };

    const handleToggleMute = (tabId: string): void => {
        void window.electronAPI?.toggleTabMute?.(tabId);
    };

    const handleNavigateFromHome = async (url: string): Promise<void> => {
        if (!window.electronAPI?.navigateTo) return;
        // Home tabs are renderer-only views; close their storage records so no
        // phantom about:blank tabs come back on the next launch.
        const homeTabs = tabs.filter(t => t.type === 'home');
        for (const homeTab of homeTabs) void window.electronAPI?.closeTab?.(homeTab.id);

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

    // App-menu shortcuts (Ctrl+T/W/F/J..., Ctrl+Tab, Ctrl+1-9) arrive through
    // this channel because the shell never sees keystrokes aimed at a page.
    const shortcutRef = useRef<(action: string) => void>(() => undefined);
    shortcutRef.current = (action: string): void => {
        switch (action) {
            case 'new-tab': openHomeTab(); break;
            case 'close-tab': void handleCloseTab(activeTabId); break;
            case 'reopen-closed': void reopenClosedTab(); break;
            case 'next-tab': {
                const index = tabs.findIndex(t => t.id === activeTabId);
                const next = tabs[(index + 1) % tabs.length];
                if (next) void handleSwitchTab(next.id);
                break;
            }
            case 'prev-tab': {
                const index = tabs.findIndex(t => t.id === activeTabId);
                const next = tabs[(index - 1 + tabs.length) % tabs.length];
                if (next) void handleSwitchTab(next.id);
                break;
            }
            case 'select-tab-9': {
                const next = tabs[tabs.length - 1];
                if (next) void handleSwitchTab(next.id);
                break;
            }
            default: {
                const selectMatch = /^select-tab-([1-8])$/.exec(action);
                if (selectMatch) {
                    const next = tabs[Number(selectMatch[1]) - 1];
                    if (next) void handleSwitchTab(next.id);
                } else if (action === 'find') {
                    document.dispatchEvent(new CustomEvent('hoo-open-find'));
                } else if (action === 'focus-address') {
                    document.dispatchEvent(new CustomEvent('hoo-focus-address'));
                } else if (action === 'downloads') {
                    document.dispatchEvent(new CustomEvent('hoo-open-downloads'));
                } else if (action === 'history') {
                    document.dispatchEvent(new CustomEvent('hoo-open-history'));
                } else if (action === 'settings') {
                    setSettingsOpen(true);
                }
            }
        }
    };

    const openFromPageRef = useRef<(url: string) => void>(() => undefined);
    openFromPageRef.current = (url: string): void => {
        void (async (): Promise<void> => {
            const tabId = await window.electronAPI?.navigateTo?.(url);
            if (!tabId) return;
            setTabs(prev => prev.some(t => t.id === tabId)
                ? prev
                : [...prev, { id: tabId, type: 'browser', title: 'Loading...', url }]);
            setActiveTabId(tabId);
        })();
    };

    useEffect(() => {
        window.electronAPI?.onUiShortcut?.((action) => shortcutRef.current(action));
        window.electronAPI?.onOpenUrlInNewTab?.((url) => openFromPageRef.current(url));
        window.electronAPI?.onTabLoadingState?.((tabId, loading) => {
            setLoadingIds(prev => {
                const next = { ...prev };
                if (loading) next[tabId] = true;
                else delete next[tabId];
                return next;
            });
        });
        window.electronAPI?.onTabFaviconUpdated?.((tabId, favicon) => {
            setFavicons(prev => ({ ...prev, [tabId]: favicon }));
        });
        window.electronAPI?.onTabAudioUpdated?.((tabId, audible, muted) => {
            setAudibleMap(prev => ({ ...prev, [tabId]: audible }));
            setMutedMap(prev => ({ ...prev, [tabId]: muted }));
        });
        window.electronAPI?.onNavStateUpdated?.((tabId, canGoBack, canGoForward) => {
            setNavState(prev => ({ ...prev, [tabId]: { canGoBack, canGoForward } }));
        });
        window.electronAPI?.onZoomChanged?.((tabId, percent) => {
            if (tabId === activeTabId) setZoomBadge({ percent, at: Date.now() });
        });
    }, []);

    // Only Escape remains as a shell-level key handler; every other browser
    // shortcut is an app-menu accelerator so it also works inside pages.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
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
            setTabs(prev => prev.find(t => t.id === tabId)
                ? prev.filter(t => t.type !== 'home')
                : [...prev.filter(t => t.type !== 'home'), { id: tabId, type: 'browser', title: 'Loading...', url: '' }]);
            setActiveTabId(tabId);
        });
        window.electronAPI?.onSwitchToHome?.((tabId?: string) => {
            setSplitTabId(null);
            // The Home button converts the current tab in place (main already
            // rewrote its storage record), so mirror that instead of spawning
            // a duplicate "New Tab" while the old entry lingered in the strip.
            if (tabId) {
                setTabs(prev => prev.some(t => t.id === tabId)
                    ? prev.map((t): Tab => t.id === tabId
                        ? { ...t, type: 'home' as TabType, title: 'New Tab', url: undefined }
                        : t)
                    : [...prev.filter(t => t.type !== 'home'), { id: tabId, type: 'home' as TabType, title: 'New Tab' }]);
                setActiveTabId(tabId);
                return;
            }
            const home = makeHomeTab();
            setTabs(prev => [...prev.filter(t => t.type !== 'home'), home]);
            setActiveTabId(home.id);
        });
    }, []);

    const browserTabs = tabs.filter(t => t.type === 'browser');
    const activeLoading = !!loadingIds[activeTabId];
    const activeNavState = navState[activeTabId] || { canGoBack: true, canGoForward: true };

    return (
        <div className="app-shell">
            <TitleBar />
            {crashNotice && (
                <div className="crash-notice" role="status">
                    <AlertTriangle size={15} />
                    <span>{crashNotice}</span>
                    <button onClick={() => setCrashNotice(null)} title="Dismiss" aria-label="Dismiss crash notice"><X size={14} /></button>
                </div>
            )}
            <main className="browser-shell">
                <TabStrip
                    tabs={tabs}
                    activeTabId={activeTabId}
                    splitTabId={splitTabId}
                    pinnedTabIds={pinnedTabIds}
                    canReopenClosedTab={closedTabs.length > 0}
                    loadingIds={loadingIds}
                    favicons={favicons}
                    audibleTabs={audibleMap}
                    mutedTabs={mutedMap}
                    onSwitchTab={(id): void => { void handleSwitchTab(id); }}
                    onSplitTab={(id): void => { void handleSplitTab(id); }}
                    onCloseTab={(id): void => { void handleCloseTab(id); }}
                    onCreateTab={openHomeTab}
                    onReorderTabs={handleReorderTabs}
                    onToggleMute={handleToggleMute}
                    onDuplicateTab={(id): void => { void duplicateTab(id); }}
                    onCloseOtherTabs={(id): void => { void closeOtherTabs(id); }}
                    onCloseTabsToRight={(id): void => { void closeTabsToRight(id); }}
                    onTogglePinTab={togglePinTab}
                    onReopenClosedTab={() => { void reopenClosedTab(); }}
                    onBookmarkAllTabs={bookmarkAllTabs}
                    onCloseDuplicateTabs={() => { void closeDuplicateTabs(); }}
                />
                <section className="browser-stage">
                    {activeTab.type === 'browser' ? (
                        <Browser
                            tabs={browserTabs}
                            activeTabId={activeTabId}
                            loading={activeLoading}
                            canGoBack={activeNavState.canGoBack}
                            canGoForward={activeNavState.canGoForward}
                            zoomBadge={zoomBadge}
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
