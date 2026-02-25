import React from 'react';
import './TabStrip.css';
import { X, Plus, Globe, Columns } from 'lucide-react';
import { Tab } from '../types';

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

    const startEditing = (e: React.MouseEvent, tab: Tab) => {
        e.stopPropagation();
        setEditingId(tab.id);
        setEditValue(tab.title);
    };

    const submitRename = async (tabId: string) => {
        if (editValue.trim() && window.electronAPI?.renameTab) {
            await window.electronAPI.renameTab(tabId, editValue);
        }
        setEditingId(null);
    };

    return (
        <div className="tab-strip">
            <div className="tabs-container">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.id === splitTabId ? 'split' : ''}`}
                        onClick={() => onSwitchTab(tab.id)}
                        onDoubleClick={(e) => startEditing(e, tab)}
                    >
                        <Globe size={14} className="tab-favicon" />

                        {editingId === tab.id ? (
                            <input
                                className="tab-rename-input"
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => submitRename(tab.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitRename(tab.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="tab-title" title="Double click to rename">{tab.title}</span>
                        )}

                        <div className="tab-actions">
                            {tab.id !== activeTabId && tab.id !== splitTabId && (
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
                            <button
                                className="tab-action-btn close-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseTab(tab.id);
                                }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <button className="new-tab-btn" onClick={onCreateTab}>
                <Plus size={16} />
            </button>
        </div>
    );
};

export default TabStrip;
