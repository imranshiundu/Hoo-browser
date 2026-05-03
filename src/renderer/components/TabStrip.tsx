import React from 'react';
import './TabStrip.css';
import { X, Plus, Globe, Columns } from 'lucide-react';
import { Tab, getFaviconUrl } from '../types';

interface TabStripProps {
    tabs: Tab[];
    activeTabId: string;
    splitTabId: string | null;
    onSwitchTab: (id: string) => void;
    onSplitTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onCreateTab: () => void;
}

const TabStrip: React.FC<TabStripProps> = ({
    tabs,
    activeTabId,
    splitTabId,
    onSwitchTab,
    onSplitTab,
    onCloseTab,
    onCreateTab
}) => {
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editValue, setEditValue] = React.useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);
    const activeTabRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        activeTabRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [activeTabId, tabs.length]);

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

    return (
        <div className="tab-strip">
            <div className="tabs-container" ref={containerRef} onWheel={handleWheel}>
                {tabs.map(tab => {
                    const faviconUrl = getFaviconUrl(tab.url);
                    const isActive = tab.id === activeTabId;
                    const canClose = tabs.length > 1 || tab.type === 'browser';
                    return (
                        <div
                            key={tab.id}
                            ref={isActive ? activeTabRef : undefined}
                            className={`tab-item ${isActive ? 'active' : ''} ${tab.id === splitTabId ? 'split' : ''} ${tab.type === 'home' ? 'home-tab' : ''}`}
                            onClick={() => onSwitchTab(tab.id)}
                            onDoubleClick={(e) => startEditing(e, tab)}
                            onMouseDown={(e) => {
                                if (e.button === 1 && canClose) {
                                    e.preventDefault();
                                    onCloseTab(tab.id);
                                }
                            }}
                            title={tab.title}
                        >
                            {faviconUrl ? (
                                <img className="tab-favicon-img" src={faviconUrl} alt="" draggable={false} />
                            ) : (
                                <Globe size={15} className="tab-favicon" />
                            )}

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
                            ) : (
                                <span className="tab-title">{tab.title || 'New Tab'}</span>
                            )}

                            <div className="tab-actions">
                                {tab.type === 'browser' && tab.id !== activeTabId && tab.id !== splitTabId && (
                                    <button
                                        className="tab-action-btn split-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSplitTab(tab.id);
                                        }}
                                        title="Open in Split View"
                                    >
                                        <Columns size={12} />
                                    </button>
                                )}
                                {canClose && (
                                    <button
                                        className="tab-action-btn close-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCloseTab(tab.id);
                                        }}
                                        title="Close tab"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <button className="new-tab-btn" onClick={onCreateTab} title="New tab">
                <Plus size={17} />
            </button>
        </div>
    );
};

export default TabStrip;
