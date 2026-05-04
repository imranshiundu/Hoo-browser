import React from 'react';
import './TabStrip.css';
import { X, Plus, Globe, Columns, Pin, Copy, PanelRight, RotateCcw, BookmarkPlus, History, Layers, Trash2 } from 'lucide-react';
import { Tab, getFaviconUrl } from '../types';

interface TabStripProps {
    tabs: Tab[];
    activeTabId: string;
    splitTabId: string | null;
    pinnedTabIds?: string[];
    canReopenClosedTab?: boolean;
    onSwitchTab: (id: string) => void;
    onSplitTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onCreateTab: () => void;
    onDuplicateTab?: (id: string) => void;
    onCloseOtherTabs?: (id: string) => void;
    onCloseTabsToRight?: (id: string) => void;
    onTogglePinTab?: (id: string) => void;
    onReopenClosedTab?: () => void;
    onBookmarkAllTabs?: () => void;
    onCloseDuplicateTabs?: () => void;
}

const MENU_WIDTH = 224;
const MENU_MAX_HEIGHT = 320;
const TOOLBAR_SAFE_TOP = 78;

const clampMenuPosition = (x: number, y: number, width = MENU_WIDTH, height = MENU_MAX_HEIGHT): { left: number; top: number } => ({
    left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
    top: Math.max(TOOLBAR_SAFE_TOP, Math.min(y, window.innerHeight - height - 8))
});

const TabStrip: React.FC<TabStripProps> = ({
    tabs,
    activeTabId,
    splitTabId,
    pinnedTabIds = [],
    canReopenClosedTab = false,
    onSwitchTab,
    onSplitTab,
    onCloseTab,
    onCreateTab,
    onDuplicateTab,
    onCloseOtherTabs,
    onCloseTabsToRight,
    onTogglePinTab,
    onReopenClosedTab,
    onBookmarkAllTabs,
    onCloseDuplicateTabs
}) => {
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editValue, setEditValue] = React.useState('');
    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; tabId: string } | null>(null);
    const [newTabMenu, setNewTabMenu] = React.useState<{ x: number; y: number } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const activeTabRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        activeTabRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [activeTabId, tabs.length]);

    React.useEffect(() => {
        const close = () => {
            setContextMenu(null);
            setNewTabMenu(null);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };
        window.addEventListener('click', close);
        window.addEventListener('blur', close);
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('blur', close);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, []);

    const startEditing = (e: React.MouseEvent, tab: Tab) => {
        e.stopPropagation();
        if (tab.type !== 'browser') return;
        setEditingId(tab.id);
        setEditValue(tab.title);
    };

    const submitRename = async (tabId: string) => {
        if (editValue.trim() && window.electronAPI?.renameTab) {
            await window.electronAPI.renameTab(tabId, editValue.trim());
        }
        setEditingId(null);
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            containerRef.current.scrollLeft += event.deltaY;
        } else {
            containerRef.current.scrollLeft += event.deltaX;
        }
    };

    const orderedTabs = [...tabs].sort((a, b) => {
        const aPinned = pinnedTabIds.includes(a.id);
        const bPinned = pinnedTabIds.includes(b.id);
        if (aPinned === bPinned) return 0;
        return aPinned ? -1 : 1;
    });

    const executeTabAction = (action: string | null, tab: Tab) => {
        if (!action) return;
        if (action === 'toggle-pin') onTogglePinTab?.(tab.id);
        if (action === 'duplicate') onDuplicateTab?.(tab.id);
        if (action === 'split') onSplitTab(tab.id);
        if (action === 'close-others') onCloseOtherTabs?.(tab.id);
        if (action === 'close-right') onCloseTabsToRight?.(tab.id);
        if (action === 'close') onCloseTab(tab.id);
    };

    const executeNewTabAction = (action: string | null) => {
        if (!action) return;
        if (action === 'new-tab') onCreateTab();
        if (action === 'reopen-closed') onReopenClosedTab?.();
        if (action === 'bookmark-all') onBookmarkAllTabs?.();
        if (action === 'close-duplicates') onCloseDuplicateTabs?.();
        if (action === 'copy-all-urls') {
            void navigator.clipboard?.writeText(tabs.filter(t => t.type === 'browser').map(t => t.url).filter(Boolean).join('\n'));
        }
    };

    const openContextMenu = async (event: React.MouseEvent, tabId: string) => {
        event.preventDefault();
        event.stopPropagation();
        setNewTabMenu(null);

        const tab = tabs.find(candidate => candidate.id === tabId);
        if (!tab) return;

        const contextIndex = tabs.findIndex(candidate => candidate.id === tabId);
        const isPinned = pinnedTabIds.includes(tabId);
        const hasTabsToRight = contextIndex >= 0 && tabs.slice(contextIndex + 1).some(candidate => !pinnedTabIds.includes(candidate.id));

        if (window.electronAPI?.showTabMenu) {
            const action = await window.electronAPI.showTabMenu({
                x: event.clientX,
                y: event.clientY,
                tabId,
                title: tab.title,
                url: tab.url,
                isPinned,
                isActive: tabId === activeTabId,
                canClose: !isPinned && (tabs.length > 1 || tab.type === 'browser'),
                canSplit: tab.type === 'browser' && tabId !== activeTabId && tabId !== splitTabId,
                hasTabsToRight
            });
            executeTabAction(action, tab);
            return;
        }

        setContextMenu({ x: event.clientX, y: event.clientY, tabId });
    };

    const openNewTabMenu = async (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu(null);

        const browserUrls = tabs.filter(tab => tab.type === 'browser').map(tab => tab.url).filter(Boolean);
        const hasDuplicateTabs = new Set(browserUrls).size < browserUrls.length;

        if (window.electronAPI?.showNewTabMenu) {
            const action = await window.electronAPI.showNewTabMenu({
                x: event.clientX,
                y: event.clientY,
                canReopenClosedTab,
                hasDuplicateTabs
            });
            executeNewTabAction(action);
            return;
        }

        setNewTabMenu({ x: event.clientX, y: event.clientY });
    };

    const runMenuAction = (action: () => void) => {
        action();
        setContextMenu(null);
        setNewTabMenu(null);
    };

    const contextTab = contextMenu ? tabs.find(tab => tab.id === contextMenu.tabId) : null;
    const contextPinned = contextTab ? pinnedTabIds.includes(contextTab.id) : false;
    const contextIndex = contextTab ? tabs.findIndex(tab => tab.id === contextTab.id) : -1;
    const hasTabsToRight = contextIndex >= 0 && tabs.slice(contextIndex + 1).some(tab => !pinnedTabIds.includes(tab.id));
    const browserUrls = tabs.filter(tab => tab.type === 'browser').map(tab => tab.url).filter(Boolean);
    const hasDuplicateTabs = new Set(browserUrls).size < browserUrls.length;
    const contextPosition = contextMenu ? clampMenuPosition(contextMenu.x, contextMenu.y) : null;
    const newTabPosition = newTabMenu ? clampMenuPosition(newTabMenu.x, newTabMenu.y, MENU_WIDTH, 260) : null;

    return (
        <div className="tab-strip">
            <div className="tabs-container" ref={containerRef} onWheel={handleWheel}>
                {orderedTabs.map(tab => {
                    const faviconUrl = getFaviconUrl(tab.url);
                    const isActive = tab.id === activeTabId;
                    const isPinned = pinnedTabIds.includes(tab.id);
                    const canClose = !isPinned && (tabs.length > 1 || tab.type === 'browser');
                    return (
                        <div
                            key={tab.id}
                            ref={isActive ? activeTabRef : undefined}
                            className={`tab-item ${isActive ? 'active' : ''} ${tab.id === splitTabId ? 'split' : ''} ${tab.type === 'home' ? 'home-tab' : ''} ${isPinned ? 'pinned' : ''}`}
                            onClick={() => onSwitchTab(tab.id)}
                            onDoubleClick={(e) => startEditing(e, tab)}
                            onContextMenu={(e) => void openContextMenu(e, tab.id)}
                            onMouseDown={(e) => {
                                if (e.button === 1 && canClose) {
                                    e.preventDefault();
                                    onCloseTab(tab.id);
                                }
                            }}
                            title={tab.title}
                        >
                            {isPinned && <Pin size={10} className="pin-indicator" />}
                            {faviconUrl ? <img className="tab-favicon-img" src={faviconUrl} alt="" draggable={false} /> : <Globe size={15} className="tab-favicon" />}
                            {editingId === tab.id ? (
                                <input
                                    className="tab-rename-input"
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => submitRename(tab.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') void submitRename(tab.id);
                                        if (e.key === 'Escape') setEditingId(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : !isPinned && <span className="tab-title">{tab.title || 'New Tab'}</span>}
                            <div className="tab-actions">
                                {tab.type === 'browser' && tab.id !== activeTabId && tab.id !== splitTabId && !isPinned && (
                                    <button className="tab-action-btn split-btn" onClick={(e) => { e.stopPropagation(); onSplitTab(tab.id); }} title="Open in Split View"><Columns size={12} /></button>
                                )}
                                {canClose && <button className="tab-action-btn close-btn" onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }} title="Close tab"><X size={13} /></button>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <button className="new-tab-btn" onClick={onCreateTab} onContextMenu={(e) => void openNewTabMenu(e)} title="New tab">
                <Plus size={17} />
            </button>

            {contextMenu && contextTab && contextPosition && (
                <div className="tab-context-menu" style={{ left: contextPosition.left, top: contextPosition.top }} onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => runMenuAction(() => onTogglePinTab?.(contextTab.id))}><Pin size={14} /> {contextPinned ? 'Unpin tab' : 'Pin tab'}</button>
                    {contextTab.type === 'browser' && <button onClick={() => runMenuAction(() => onDuplicateTab?.(contextTab.id))}><Copy size={14} /> Duplicate tab</button>}
                    {contextTab.type === 'browser' && contextTab.id !== activeTabId && <button onClick={() => runMenuAction(() => onSplitTab(contextTab.id))}><PanelRight size={14} /> Open in split screen</button>}
                    {contextTab.type === 'browser' && <button onClick={() => runMenuAction(() => navigator.clipboard?.writeText(contextTab.url || ''))}><Copy size={14} /> Copy tab URL</button>}
                    <span className="tab-context-divider" />
                    <button onClick={() => runMenuAction(() => onCloseOtherTabs?.(contextTab.id))}><RotateCcw size={14} /> Close other tabs</button>
                    <button disabled={!hasTabsToRight} onClick={() => runMenuAction(() => onCloseTabsToRight?.(contextTab.id))}><X size={14} /> Close tabs to the right</button>
                    <button disabled={contextPinned} onClick={() => runMenuAction(() => onCloseTab(contextTab.id))}><X size={14} /> Close tab</button>
                </div>
            )}

            {newTabMenu && newTabPosition && (
                <div className="tab-context-menu" style={{ left: newTabPosition.left, top: newTabPosition.top }} onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => runMenuAction(onCreateTab)}><Plus size={14} /> New tab</button>
                    <button disabled={!canReopenClosedTab} onClick={() => runMenuAction(() => onReopenClosedTab?.())}><History size={14} /> Reopen closed tab</button>
                    <button onClick={() => runMenuAction(() => onBookmarkAllTabs?.())}><BookmarkPlus size={14} /> Bookmark all tabs</button>
                    <button disabled={!hasDuplicateTabs} onClick={() => runMenuAction(() => onCloseDuplicateTabs?.())}><Trash2 size={14} /> Close duplicate tabs</button>
                    <span className="tab-context-divider" />
                    <button onClick={() => runMenuAction(() => navigator.clipboard?.writeText(tabs.filter(t => t.type === 'browser').map(t => t.url).join('\n')))}><Layers size={14} /> Copy all tab URLs</button>
                </div>
            )}
        </div>
    );
};

export default TabStrip;
