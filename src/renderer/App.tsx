import React, { useState, useEffect, useRef } from 'react';
import './styles/globals.css';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
import Home from './views/Home';
import Browser from './views/Browser';
import BookmarksView from './views/BookmarksView';
import DownloadsView from './views/DownloadsView';
import ExtensionsView from './views/ExtensionsView';
import RSSView from './views/RSSView';
import PermissionPrompt, { PendingPermissionRequest } from './components/PermissionPrompt';
import TabStrip from './components/TabStrip';
import DownloadToasts from './components/DownloadToasts';
import HistoryView from './views/HistoryView';
import { Tab, TabType, siteInitial, siteInitialStyle } from './types';
import { reorderTabsByIds } from '../main/tab-utils';
import {
    TabGroup,
    TabGroupColor,
    GROUP_COLORS,
    addTabsToGroup,
    createGroup,
    nextGroupColor,
    pruneGroups,
    recolorGroup,
    removeTabFromGroup,
    renameGroup,
    restoreGroups,
    toggleGroupCollapse
} from '../main/tab-groups';
import {
    CHROME_HIDE_EDGE_PX,
    INFOBAR_AUTO_HIDE_MS,
    fullscreenOriginLabel,
    isImmersive,
    shouldHideChrome,
    shouldRevealChrome
} from './fullscreen-model';
import { AlertTriangle, Maximize2, X } from 'lucide-react';

const makeHomeTab = (): Tab => ({ id: `home-${Date.now()}`, type: 'home', title: 'New Tab' });
// Internal pages behave like Chrome's chrome:// pages: renderer-only tabs,
// one instance each, reachable from the menu, home page and shortcuts.
const INTERNAL_TABS: Record<string, { id: string; type: TabType; title: string }> = {
    library: { id: 'hoo-library', type: 'library', title: 'Bookmarks' },
    downloads: { id: 'hoo-downloads', type: 'downloads', title: 'Downloads' },
    extensions: { id: 'hoo-extensions', type: 'extensions', title: 'Modules & Extensions' },
    reader: { id: 'hoo-reader', type: 'reader', title: 'Live Reader' },
    history: { id: 'hoo-history', type: 'history', title: 'History' }
};
const initialHomeTab = makeHomeTab();
const PINNED_TABS_KEY = 'hoo:pinned-tabs';
const TAB_GROUPS_KEY = 'hoo:tab-groups';
const BOOKMARK_KEY = 'hoo:bookmarks';

type ClosedTab = { title: string; url: string };

const App: React.FC = () => {
    const [tabs, setTabs] = useState<Tab[]>([initialHomeTab]);
    const [activeTabId, setActiveTabId] = useState<string>(initialHomeTab.id);
    const [splitTabId, setSplitTabId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
    const [closedTabs, setClosedTabs] = useState<ClosedTab[]>([]);
    const [permissionQueue, setPermissionQueue] = useState<PendingPermissionRequest[]>([]);
    const [pinnedTabIds, setPinnedTabIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(PINNED_TABS_KEY) || '[]'); }
        catch { return []; }
    });
    // Firefox 137-style tab groups: named, colored, collapsible. Persisted in
    // localStorage and repaired against the live tab list on every load.
    const [tabGroups, setTabGroups] = useState<TabGroup[]>(() => {
        try { return restoreGroups(JSON.parse(localStorage.getItem(TAB_GROUPS_KEY) || '[]'), []); }
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
    // Firefox-style fullscreen: a page (YouTube theater, video players) or F11
    // takes over the window; the chrome hides, a banner explains how to leave,
    // and bumping the pointer against the top edge slides the tabs back down.
    const [pageFullscreenTabId, setPageFullscreenTabId] = useState<string | null>(null);
    const [osFullscreen, setOsFullscreen] = useState(false);
    const [chromeRevealed, setChromeRevealed] = useState(false);
    const [infobarVisible, setInfobarVisible] = useState(false);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || initialHomeTab;
    const immersive = isImmersive({ pageFullscreenTabId, activeTabId, osFullscreen });
    const fullscreenOrigin = fullscreenOriginLabel(activeTab?.url);

    useEffect(() => {
        localStorage.setItem(PINNED_TABS_KEY, JSON.stringify(pinnedTabIds.filter(id => tabs.some(tab => tab.id === id))));
    }, [pinnedTabIds, tabs]);

    useEffect(() => {
        // Keep groups in sync with reality: drop closed tabs, then persist.
        setTabGroups(prev => {
            const pruned = pruneGroups(prev, tabs.map(tab => tab.id));
            localStorage.setItem(TAB_GROUPS_KEY, JSON.stringify(pruned));
            return pruned.length === prev.length ? prev : pruned;
        });
    }, [tabs]);

    const applyTabGroups = (updater: (prev: TabGroup[]) => TabGroup[]): void => {
        setTabGroups(prev => {
            const next = updater(prev);
            localStorage.setItem(TAB_GROUPS_KEY, JSON.stringify(next));
            return next;
        });
    };

    const handleAddTabToGroup = (tabId: string, groupId: string | null): void => {
        if (groupId) {
            applyTabGroups(prev => prev.map(group => group.id === groupId ? addTabsToGroup(group, [tabId]) : group));
            return;
        }
        applyTabGroups(prev => {
            const made = createGroup(`grp-${Date.now()}`, 'New group', nextGroupColor(prev), [tabId]);
            return [...prev, made];
        });
    };

    const handleRemoveTabFromGroup = (tabId: string): void => {
        applyTabGroups(prev => prev.map(group => removeTabFromGroup(group, tabId)).filter(group => group.tabIds.length > 0));
    };

    const handleRenameGroup = (groupId: string, name: string): void => {
        applyTabGroups(prev => prev.map(group => group.id === groupId ? renameGroup(group, name) : group));
    };

    const handleRecolorGroup = (groupId: string, color: TabGroupColor): void => {
        applyTabGroups(prev => prev.map(group => group.id === groupId ? recolorGroup(group, color) : group));
    };

    const handleToggleGroupCollapse = (groupId: string): void => {
        applyTabGroups(prev => prev.map(group => group.id === groupId ? toggleGroupCollapse(group) : group));
    };

    const handleUngroupGroup = (groupId: string): void => {
        applyTabGroups(prev => prev.filter(group => group.id !== groupId));
    };

    // Dropping a tab on a group pill: join the group and land next to its
    // last member so the group stays one contiguous run in the strip.
    const handleDropTabOnGroup = (tabId: string, groupId: string): void => {
        const group = tabGroups.find(item => item.id === groupId);
        if (!group) return;
        const anchor = group.tabIds[group.tabIds.length - 1];
        const ids = tabs.map(tab => tab.id);
        const from = ids.indexOf(tabId);
        const target = ids.indexOf(anchor);
        if (from >= 0 && target >= 0 && from !== target) {
            ids.splice(target, 0, ...ids.splice(from, 1));
            const pinned = new Set(pinnedTabIds);
            const nextIds = [...ids.filter(id => pinned.has(id)), ...ids.filter(id => !pinned.has(id))];
            setTabs(prev => reorderTabsByIds(prev, nextIds));
            void window.electronAPI?.reorderTabs?.(nextIds);
        }
        handleAddTabToGroup(tabId, groupId);
    };

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

    // The bookmark manager lives in its own renderer tab (like Chrome's
    // bookmark manager page). One instance at a time.
    const openInternalTab = (key: keyof typeof INTERNAL_TABS): void => {
        const page = INTERNAL_TABS[key];
        setTabs(prev => prev.some(t => t.id === page.id)
            ? prev
            : [...prev, { id: page.id, type: page.type as TabType, title: page.title }]);
        setActiveTabId(page.id);
        setSplitTabId(null);
        void window.electronAPI?.hideBrowserView?.();
    };

    const openLibraryTab = (): void => {
        openInternalTab('library');
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
            case 'open-library': openLibraryTab(); break;
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
                    openInternalTab('downloads');
                } else if (action === 'open-library') {
                    openInternalTab('library');
                } else if (action === 'open-reader') {
                    openInternalTab('reader');
                } else if (action === 'open-extensions') {
                    openInternalTab('extensions');
                } else if (action === 'history') {
                    document.dispatchEvent(new CustomEvent('hoo-open-history'));
                } else if (action === 'history-page') {
                    openInternalTab('history');
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

    const openLibraryRef = useRef<() => void>(() => undefined);
    openLibraryRef.current = openLibraryTab;

    useEffect(() => {
        // The toolbar's "Manage bookmarks" entry opens the same library tab
        // as the Ctrl+Shift+O menu accelerator, and "Full history" opens the
        // same page as the Ctrl+H accelerator.
        const openLibrary = (): void => openLibraryRef.current();
        const openHistoryPage = (): void => shortcutRef.current('history-page');
        document.addEventListener('hoo-open-library', openLibrary);
        document.addEventListener('hoo-open-history-page', openHistoryPage);
        return () => {
            document.removeEventListener('hoo-open-library', openLibrary);
            document.removeEventListener('hoo-open-history-page', openHistoryPage);
        };
    }, []);

    useEffect(() => {
        window.electronAPI?.onUiShortcut?.((action) => shortcutRef.current(action));
        window.electronAPI?.onOpenUrlInNewTab?.((url) => openFromPageRef.current(url));
        window.electronAPI?.onPermissionRequest?.((request) => {
            setPermissionQueue(prev => prev.some(item => item.requestId === request.requestId)
                ? prev
                : [...prev, request]);
        });
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
        window.electronAPI?.onPageFullscreenChanged?.((tabId, active) => {
            setPageFullscreenTabId(current => active ? tabId : (current === tabId ? null : current));
        });
        window.electronAPI?.onOsFullscreenChanged?.((active) => setOsFullscreen(active));
    }, []);

    // A page (or F11) taking over the screen: drop split view, announce the
    // banner, and reset the reveal overlay. Leaving reverses everything.
    useEffect(() => {
        if (!immersive) {
            setChromeRevealed(false);
            setInfobarVisible(false);
            return;
        }
        setSplitTabId(null);
        setChromeRevealed(false);
        setInfobarVisible(true);
        if (pageFullscreenTabId) void window.electronAPI?.clearMosaicView?.();
    }, [immersive, pageFullscreenTabId]);

    // The banner is a hint, not a keeper: it auto-hides like Firefox's.
    useEffect(() => {
        if (!immersive || !infobarVisible) return;
        const timer = window.setTimeout((): void => setInfobarVisible(false), INFOBAR_AUTO_HIDE_MS);
        return () => window.clearTimeout(timer);
    }, [immersive, infobarVisible]);

    // Firefox's signature move: slam the pointer into the top edge and the
    // tab strip slides down over the page; move away and it hides again.
    useEffect(() => {
        if (!immersive) return;
        const onMove = (event: MouseEvent): void => {
            if (shouldRevealChrome(event.clientY)) setChromeRevealed(true);
            else if (shouldHideChrome(event.clientY, CHROME_HIDE_EDGE_PX)) setChromeRevealed(false);
        };
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, [immersive]);

    const exitImmersive = (): void => {
        if (pageFullscreenTabId) void window.electronAPI?.exitPageFullscreen?.(pageFullscreenTabId);
        else if (osFullscreen) void window.electronAPI?.toggleOsFullscreen?.();
    };

    // Only Escape remains as a shell-level key handler; every other browser
    // shortcut is an app-menu accelerator so it also works inside pages.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape' && settingsOpen) {
                e.preventDefault();
                setSettingsOpen(false);
                return;
            }
            // Esc fallback for fullscreen when the page itself does not have
            // focus (after clicking the banner or the revealed tab strip).
            // The in-page find bar gets the key first and must not be skipped.
            if (e.key === 'Escape' && immersive && pageFullscreenTabId && !document.querySelector('.find-in-page-bar')) {
                void window.electronAPI?.exitPageFullscreen?.(pageFullscreenTabId);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settingsOpen, immersive, pageFullscreenTabId]);

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

    const resolvePermission = (requestId: string, decision: 'allow' | 'block', remember: boolean): void => {
        void window.electronAPI?.resolvePermission?.(requestId, decision, remember);
        setPermissionQueue(prev => prev.filter(item => item.requestId !== requestId));
    };

    const dismissPermission = (requestId: string): void => {
        // Dismissing answers "block" without remembering, so the site asks
        // again next time instead of being silently locked out forever.
        void window.electronAPI?.resolvePermission?.(requestId, 'block', false);
        setPermissionQueue(prev => prev.filter(item => item.requestId !== requestId));
    };

    const restoreCrashedTabs = async (): Promise<void> => {
        await window.electronAPI?.restoreCrashedTabs?.();
        setCrashNotice(null);
    };

    const browserTabs = tabs.filter(t => t.type === 'browser');
    const activeLoading = !!loadingIds[activeTabId];
    const activeNavState = navState[activeTabId] || { canGoBack: true, canGoForward: true };

    return (
        <div className={`app-shell ${immersive ? 'immersive' : ''}`}>
            <TitleBar />
            {crashNotice && (
                <div className="crash-notice" role="status">
                    <AlertTriangle size={15} />
                    <span>{crashNotice}</span>
                    <button onClick={() => { void restoreCrashedTabs(); }} className="crash-restore-btn" title="Reopen the tabs that crashed">Restore tabs</button>
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
                    tabGroups={tabGroups}
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
                    onAddTabToGroup={handleAddTabToGroup}
                    onRemoveTabFromGroup={handleRemoveTabFromGroup}
                    onRenameGroup={handleRenameGroup}
                    onRecolorGroup={handleRecolorGroup}
                    onToggleGroupCollapse={handleToggleGroupCollapse}
                    onUngroupGroup={handleUngroupGroup}
                    onDropTabOnGroup={handleDropTabOnGroup}
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
                    ) : activeTab.type === 'library' ? (
                        <BookmarksView onNavigate={(url): void => { void handleNavigateFromHome(url); }} />
                    ) : activeTab.type === 'downloads' ? (
                        <DownloadsView />
                    ) : activeTab.type === 'extensions' ? (
                        <ExtensionsView />
                    ) : activeTab.type === 'reader' ? (
                        <RSSView />
                    ) : activeTab.type === 'history' ? (
                        <HistoryView onNavigate={(url): void => { void handleNavigateFromHome(url); }} />
                    ) : (
                        <Home onNavigate={handleNavigateFromHome} onOpenSettings={() => setSettingsOpen(true)} onOpenInternal={openInternalTab} />
                    )}
                </section>
            </main>
            {/* Firefox-style fullscreen chrome: slides down when the pointer
                hits the top edge, hides again when it leaves. Tabs stay one
                click away while a video owns the screen. */}
            {immersive && (
                <div className={`fullscreen-overlay ${chromeRevealed ? 'revealed' : ''}`}>
                    <div className="fullscreen-tabs" role="tablist" aria-label="Open tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={tab.id === activeTabId}
                                className={`fullscreen-tab ${tab.id === activeTabId ? 'active' : ''}`}
                                onClick={(): void => { void handleSwitchTab(tab.id); setChromeRevealed(false); }}
                                title={tab.title || 'New Tab'}
                            >
                                {favicons[tab.id]
                                    ? <img className="fullscreen-tab-favicon" src={favicons[tab.id]} alt="" />
                                    : <span className="fullscreen-tab-favicon" style={siteInitialStyle(siteInitial(tab.url))}>{siteInitial(tab.url)?.letter || '•'}</span>}
                                <span className="fullscreen-tab-title">{tab.title || 'New Tab'}</span>
                            </button>
                        ))}
                    </div>
                    <button className="fullscreen-exit-btn" onClick={exitImmersive} title="Leave fullscreen (Esc)">
                        <Maximize2 size={13} /> Exit full screen
                    </button>
                </div>
            )}
            {immersive && infobarVisible && !chromeRevealed && (
                <div className="fullscreen-infobar" role="status">
                    <Maximize2 size={13} />
                    <span><strong>{fullscreenOrigin}</strong> is now full screen</span>
                    <button onClick={exitImmersive}>Exit</button>
                    <kbd>Esc</kbd>
                </div>
            )}
            <PermissionPrompt
                request={permissionQueue.length ? permissionQueue[0] : null}
                onResolve={resolvePermission}
                onDismiss={dismissPermission}
            />
            <DownloadToasts />
            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
};

export default App;
