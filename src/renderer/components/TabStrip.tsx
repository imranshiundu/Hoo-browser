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

    const openContextMenu = (event: React.MouseEvent, tabId: string) => {
        event.preventDefault();
        event.stopPropagation();
        setNewTabMenu(null);
        setContextMenu({ x: event.clientX, y: event.clientY, tabId });
    };

    const openNewTabMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu(null);
        setNewTabMenu({ x: event.clientX, y: event.clientY });
    };

    const runMenuAction = (action: () => void) => {
        action();
        setContextMenu(null);
        setNewTabMenu(null);
    };

    const orderedTabs = [...tabs].sort((a, b) => {
        const aPinned = pinnedTabIds.includes(a.id);
        const bPinned = pinnedTabIds.includes(b.id);
        if (aPinned === bPinned) return 0;
        return aPinned ? -1 : 1;
    });
    const contextTab = contextMenu ? tabs.find(tab => tab.id === contextMenu.tabId) : null;
    const contextPinned = contextTab ? pinnedTabIds.includes(contextTab.id) : false;
    const contextIndex = contextTab ? tabs.findIndex(tab => tab.id === contextTab.id) : -1;
    const hasTabsToRight = contextIndex >= 0 && tabs.slice(contextIndex + 1).some(tab => !pinnedTabIds.includes(tab.id));
    const hasDuplicateTabs = new Set(tabs.filter(tab => tab.type === 'browser').map(tab => tab.url).filter(Boolean)).size < tabs.filter(tab => tab.type === 'browser' && tab.url).length;

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
                            onContextMenu={(e) => openContextMenu(e, tab.id)}
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
            <button className="new-tab-btn" onClick={onCreateTab} onContextMenu={openNewTabMenu} title="New tab">
                <Plus size={17} />
            </button>

            {contextMenu && contextTab && (
                <div className="tab-context-menu" style={{ left: Math.min(contextMenu.x, window.innerWidth - 230), top: Math.min(contextMenu.y, window.innerHeight - 260) }} onClick={(event) => event.stopPropagation()}>
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

            {newTabMenu && (
                <div className="tab-context-menu" style={{ left: Math.min(newTabMenu.x, window.innerWidth - 230), top: Math.min(newTabMenu.y, window.innerHeight - 230) }} onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => runMenuAction(onCreateTab)}><Plus size={14} /> New tab</button>
                    <button disabled={!canReopenClosedTab} onClick={() => runMenuAction(() => onReopenClosedTab?.())}><History size={14} /> Reopen closed tab</button>
                    <button onClick={() => runMenuAction(() => onBookmarkAllTabs?.())}><BookmarkPlus size={14} /> Bookmark all tabs</button>
                    <button disabled={!hasDuplicateTabs} onClick={() => runMenuAction(() => onCloseDuplicateTabs?.())}><Trash2 size={14} /> Close duplicate tabs</button>
                    <span className="tab-context-divider" />
                    <button onClick={() => runMenuAction(() => tabs.forEach(tab => tab.type === 'browser' && navigator.clipboard?.writeText(tabs.filter(t => t.type === 'browser').map(t => t.url).join('\n'))))}><Layers size={14} /> Copy all tab URLs</button>
                </div>
            )}
        </div>
    );
};

export default TabStrip;
