import React from 'react';
import './TabStrip.css';
import { X, Plus, Globe, Columns, Pin, Copy, PanelRight, RotateCcw, BookmarkPlus, History, Layers, Trash2, Volume2, VolumeX, Home } from 'lucide-react';
import { Tab, siteInitial, siteInitialStyle } from '../types';

interface TabStripProps {
    tabs: Tab[];
    activeTabId: string;
    splitTabId: string | null;
    pinnedTabIds?: string[];
    canReopenClosedTab?: boolean;
    loadingIds?: Record<string, boolean>;
    favicons?: Record<string, string>;
    audibleTabs?: Record<string, boolean>;
    mutedTabs?: Record<string, boolean>;
    onSwitchTab: (id: string) => void;
    onSplitTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onCreateTab: () => void;
    onReorderTabs?: (orderedIds: string[]) => void;
    onToggleMute?: (id: string) => void;
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
    loadingIds = {},
    favicons = {},
    audibleTabs = {},
    mutedTabs = {},
    onSwitchTab,
    onSplitTab,
    onCloseTab,
    onCreateTab,
    onReorderTabs,
    onToggleMute,
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
    // Drag-to-reorder: the tab being dragged and the tab currently hovered over.
    const [dragTabId, setDragTabId] = React.useState<string | null>(null);
    const [dragOverId, setDragOverId] = React.useState<string | null>(null);
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

    // Drop the dragged tab at the target's position. Pinned tabs are re-partitioned
    // to the front afterwards — browsers keep pinned tabs locked to the left edge.
    const handleDropOn = (targetId: string): void => {
        setDragOverId(null);
        if (!dragTabId || dragTabId === targetId) {
            setDragTabId(null);
            return;
        }
        const ids = tabs.map(tab => tab.id);
        const from = ids.indexOf(dragTabId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) {
            setDragTabId(null);
            return;
        }
        ids.splice(to, 0, ...ids.splice(from, 1));
        const pinned = new Set(pinnedTabIds);
        const nextIds = [...ids.filter(id => pinned.has(id)), ...ids.filter(id => !pinned.has(id))];
        setDragTabId(null);
        onReorderTabs?.(nextIds);
    };

    const endDrag = (): void => {
        setDragTabId(null);
        setDragOverId(null);
    };

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
    const contextIndex = contextTab ? tabs.findIndex(tab => tab.id === contextMenu.tabId) : -1;
    const hasTabsToRight = contextIndex >= 0 && tabs.slice(contextIndex + 1).some(tab => !pinnedTabIds.includes(tab.id));
    const browserUrls = tabs.filter(tab => tab.type === 'browser').map(tab => tab.url).filter(Boolean);
    const hasDuplicateTabs = new Set(browserUrls).size < browserUrls.length;
    const contextPosition = contextMenu ? clampMenuPosition(contextMenu.x, contextMenu.y) : null;
    const newTabPosition = newTabMenu ? clampMenuPosition(newTabMenu.x, newTabMenu.y, MENU_WIDTH, 260) : null;

    const renderTabIcon = (tab: Tab): React.ReactNode => {
        if (loadingIds[tab.id]) return <span className="tab-spinner" aria-label="Loading" />;
        if (tab.type === 'home') return <Home size={15} className="tab-favicon" />;
        const favicon = favicons[tab.id];
        if (favicon) return <img className="tab-favicon-img" src={favicon} alt="" draggable={false} />;
        const initial = siteInitial(tab.url);
        if (initial) {
            return <span className="tab-favicon-initial" style={siteInitialStyle(initial)}>{initial.letter}</span>;
        }
        return <Globe size={15} className="tab-favicon" />;
    };

    const renderAudioIndicator = (tab: Tab): React.ReactNode => {
        if (!audibleTabs[tab.id] && !mutedTabs[tab.id]) return null;
        const muted = mutedTabs[tab.id];
        return (
            <button
                className={`tab-action-btn audio-btn ${muted ? 'muted' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleMute?.(tab.id); }}
                onDoubleClick={(e) => e.stopPropagation()}
                title={muted ? 'Unmute tab' : 'Mute tab'}
            >
                {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
        );
    };

    return (
        <div className="tab-strip">
            <div className="tabs-container" ref={containerRef} onWheel={handleWheel}>
                {orderedTabs.map(tab => {
                    const isActive = tab.id === activeTabId;
                    const isPinned = pinnedTabIds.includes(tab.id);
                    const canClose = !isPinned && (tabs.length > 1 || tab.type === 'browser');
                    return (
                        <div
                            key={tab.id}
                            ref={isActive ? activeTabRef : undefined}
                            className={`tab-item ${isActive ? 'active' : ''} ${tab.id === splitTabId ? 'split' : ''} ${tab.type === 'home' ? 'home-tab' : ''} ${isPinned ? 'pinned' : ''} ${loadingIds[tab.id] ? 'loading' : ''} ${dragTabId === tab.id ? 'dragging' : ''} ${dragOverId === tab.id && dragTabId && dragTabId !== tab.id ? 'drag-over' : ''}`}
                            onClick={() => onSwitchTab(tab.id)}
                            onDoubleClick={(e) => startEditing(e, tab)}
                            onContextMenu={(e) => void openContextMenu(e, tab.id)}
                            draggable={!editingId}
                            onDragStart={(e) => {
                                setDragTabId(tab.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', tab.url || tab.title);
                            }}
                            onDragOver={(e) => {
                                if (!dragTabId || dragTabId === tab.id) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                setDragOverId(tab.id);
                            }}
                            onDragLeave={() => setDragOverId(prev => (prev === tab.id ? null : prev))}
                            onDrop={(e) => { e.preventDefault(); handleDropOn(tab.id); }}
                            onDragEnd={endDrag}
                            onMouseDown={(e) => {
                                if (e.button === 1 && canClose) {
                                    e.preventDefault();
                                    onCloseTab(tab.id);
                                }
                            }}
                            title={tab.title}
                        >
                            {isPinned && <Pin size={10} className="pin-indicator" />}
                            {renderTabIcon(tab)}
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
                                {renderAudioIndicator(tab)}
                                {tab.type === 'browser' && tab.id !== activeTabId && tab.id !== splitTabId && !isPinned && (
                                    <button className="tab-action-btn split-btn" onClick={(e) => { e.stopPropagation(); onSplitTab(tab.id); }} title="Open in Split View"><Columns size={12} /></button>
                                )}
                                {canClose && <button className="tab-action-btn close-btn" onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }} title="Close tab"><X size={13} /></button>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <button className="new-tab-btn" onClick={onCreateTab} onContextMenu={(e) => void openNewTabMenu(e)} title="New tab (Ctrl+T)">
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
