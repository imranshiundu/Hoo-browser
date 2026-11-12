import React, { useState, useEffect, useRef } from 'react';
import './NavigationBar.css';
import { ArrowLeft, ArrowRight, RotateCw, X, Lock, Globe, Settings, Home, Star, BookOpen, Sparkles, Download, Shield, Search, MoreHorizontal, Columns2, PanelRightClose, History, Clock, FolderOpen, ExternalLink, FileWarning } from 'lucide-react';
import { Tab } from '../types';
import { formatBytes } from '../../main/tab-utils';

interface NavigationBarProps {
    tabId: string;
    url: string;
    tabs?: Tab[];
    splitTabId?: string | null;
    loading?: boolean;
    canGoBack?: boolean;
    canGoForward?: boolean;
    zoomBadge?: { percent: number; at: number } | null;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onStop?: () => void;
    onSplitWithTab?: (tabId: string) => void;
    onClearSplit?: () => void;
    onOpenSettings?: () => void;
}

interface DownloadEntry {
    id: string;
    filename: string;
    url: string;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
    receivedBytes: number;
    totalBytes: number;
    danger?: string;
}

interface HistoryEntry {
    url: string;
    title: string;
    timestamp: number;
}

const BOOKMARK_KEY = 'hoo:bookmarks';

const stateLabel = (entry: DownloadEntry): string => {
    if (entry.state === 'progressing') {
        if (entry.totalBytes > 0) {
            const percent = Math.min(100, Math.round((entry.receivedBytes / entry.totalBytes) * 100));
            return `${percent}% of ${formatBytes(entry.totalBytes)}`;
        }
        return `${formatBytes(entry.receivedBytes)} downloaded`;
    }
    if (entry.state === 'completed') return formatBytes(entry.totalBytes || entry.receivedBytes);
    if (entry.state === 'interrupted') return 'Interrupted';
    return 'Cancelled';
};

const NavigationBar: React.FC<NavigationBarProps> = ({
    tabId,
    url,
    tabs = [],
    splitTabId,
    loading = false,
    canGoBack = true,
    canGoForward = true,
    zoomBadge = null,
    onNavigate,
    onBack,
    onForward,
    onReload,
    onStop,
    onSplitWithTab,
    onClearSplit,
    onOpenSettings
}) => {
    const [inputValue, setInputValue] = useState(url);
    const [bookmarksOpen, setBookmarksOpen] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [splitOpen, setSplitOpen] = useState(false);
    const [downloadsOpen, setDownloadsOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [bookmarks, setBookmarks] = useState<Array<{ id: string; title: string; url: string }>>([]);
    const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [zoomVisible, setZoomVisible] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => setInputValue(url), [url]);

    const loadBookmarks = (): void => {
        try {
            setBookmarks(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'));
        } catch {
            setBookmarks([]);
        }
    };

    useEffect(() => loadBookmarks(), [url]);

    const refreshDownloads = async (): Promise<void> => {
        if (!window.electronAPI?.getDownloads) return;
        try { setDownloads(await window.electronAPI.getDownloads()); } catch { /* panel still opens with an empty list */ }
    };

    const refreshHistory = async (): Promise<void> => {
        if (!window.electronAPI?.getHistory) return;
        try { setHistory(await window.electronAPI.getHistory()); } catch { /* panel still opens with an empty list */ }
    };

    // App dispatches these when the app-menu shortcuts (Ctrl+J / history) fire.
    useEffect(() => {
        const openDownloads = (): void => { void refreshDownloads(); setHistoryOpen(false); setDownloadsOpen(true); };
        const openHistory = (): void => { void refreshHistory(); setDownloadsOpen(false); setHistoryOpen(true); };
        document.addEventListener('hoo-open-downloads', openDownloads);
        document.addEventListener('hoo-open-history', openHistory);
        return () => {
            document.removeEventListener('hoo-open-downloads', openDownloads);
            document.removeEventListener('hoo-open-history', openHistory);
        };
    }, []);

    // Live progress while the downloads popover is open.
    useEffect(() => {
        if (!window.electronAPI?.onDownloadUpdated) return;
        window.electronAPI.onDownloadUpdated((record: DownloadEntry) => {
            setDownloads(prev => [record, ...prev.filter(item => item.id !== record.id)]);
        });
        window.electronAPI.onDownloadListCleared?.(() => setDownloads([]));
    }, []);

    useEffect(() => {
        if (!zoomBadge) return;
        setZoomVisible(true);
        const timer = window.setTimeout(() => setZoomVisible(false), 1600);
        return () => window.clearTimeout(timer);
    }, [zoomBadge]);

    useEffect(() => {
        const focusAddress = (): void => {
            inputRef.current?.focus();
            inputRef.current?.select();
        };
        document.addEventListener('hoo-focus-address', focusAddress);
        return () => document.removeEventListener('hoo-focus-address', focusAddress);
    }, []);

    useEffect(() => {
        const closePopovers = (event: MouseEvent): void => {
            const target = event.target as HTMLElement | null;
            if (!target?.closest('.nav-menu-wrap')) setBookmarksOpen(false);
            if (!target?.closest('.tools-menu-wrap')) setToolsOpen(false);
            if (!target?.closest('.split-menu-wrap')) setSplitOpen(false);
            if (!target?.closest('.downloads-menu-wrap')) setDownloadsOpen(false);
            if (!target?.closest('.history-menu-wrap')) setHistoryOpen(false);
        };
        document.addEventListener('mousedown', closePopovers);
        return () => document.removeEventListener('mousedown', closePopovers);
    }, []);

    const normalizeTarget = (value: string): string => {
        let target = value.trim();
        if (!target) return '';
        if (/^(magnet:|mailto:|tel:|sms:|bitcoin:|ethereum:|tg:|whatsapp:)/i.test(target)) return target;
        if (target.startsWith('!w ')) return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(target.substring(3))}`;
        if (target.startsWith('!y ')) return `https://www.youtube.com/results?search_query=${encodeURIComponent(target.substring(3))}`;
        if (target.startsWith('!g ')) return `https://www.google.com/search?q=${encodeURIComponent(target.substring(3))}`;
        if (target.startsWith('!d ')) return `https://duckduckgo.com/?q=${encodeURIComponent(target.substring(3))}`;
        if (target.startsWith('!ai ')) return `https://duck.ai/?q=${encodeURIComponent(target.substring(4))}`;
        const isUrl = target.includes('.') && !target.includes(' ') && (target.startsWith('http') || target.split('/')[0].includes('.'));
        if (!isUrl) return `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
        if (!target.startsWith('http')) return `https://${target}`;
        return target;
    };

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        const target = normalizeTarget(inputValue);
        if (target) onNavigate(target);
        inputRef.current?.blur();
    };

    const bookmarkCurrent = (): void => {
        if (!url || url === 'about:blank') return;
        // Real browsers toggle: the star fills when the page is saved and
        // clicking again removes it.
        if (isBookmarked) {
            const next = bookmarks.filter(item => item.url !== url);
            localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
            setBookmarks(next);
            return;
        }
        let title = url;
        try {
            title = new URL(url).hostname.replace(/^www\./, '');
        } catch {
            title = url.slice(0, 42);
        }
        const next = [
            { id: `${Date.now()}`, title, url },
            ...bookmarks.filter(item => item.url !== url)
        ].slice(0, 40);
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
        setBookmarks(next);
        setBookmarksOpen(true);
    };

    const getHostLabel = (): string => {
        if (!url || url === 'about:blank') return 'New tab';
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            if (/^(magnet:|mailto:|tel:|sms:)/i.test(url)) return 'External app';
            return 'Search';
        }
    };

    const splitCandidates = tabs.filter(tab => tab.id !== tabId && tab.type === 'browser');
    const isSecure = url.startsWith('https://');
    const isExternal = /^(magnet:|mailto:|tel:|sms:|bitcoin:|ethereum:|tg:|whatsapp:)/i.test(url || inputValue);
    const isBookmarked = !!url && bookmarks.some(item => item.url === url);

    const handleOpenDownload = (entry: DownloadEntry): void => {
        void window.electronAPI?.openDownload?.(entry.id);
    };

    const handleShowDownload = (entry: DownloadEntry): void => {
        void window.electronAPI?.showDownloadInFolder?.(entry.id);
    };

    const handleClearDownloads = (): void => {
        void window.electronAPI?.clearDownloads?.();
        setDownloads([]);
    };

    return (
        <div className="navigation-bar">
            <div className="nav-cluster nav-history-cluster" aria-label="Navigation controls">
                <button className="nav-btn" onClick={onBack} disabled={!canGoBack} title="Back (Alt+←)"><ArrowLeft size={17} /></button>
                <button className="nav-btn" onClick={onForward} disabled={!canGoForward} title="Forward (Alt+→)"><ArrowRight size={17} /></button>
                {loading ? (
                    <button className="nav-btn stop-btn" onClick={onStop} title="Stop loading"><X size={17} /></button>
                ) : (
                    <button className="nav-btn" onClick={onReload} title="Reload (Ctrl+R)"><RotateCw size={16} /></button>
                )}
                <button className="nav-btn" onClick={() => onNavigate('about:blank')} title="Home"><Home size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className={`address-form ${isSecure ? 'secure' : ''} ${isExternal ? 'external' : ''}`}>
                <span className="security-indicator" title={isSecure ? 'Secure connection' : isExternal ? 'External protocol' : 'Search or normal connection'}>
                    {isSecure ? <Lock size={13} /> : isExternal ? <Globe size={13} /> : <Search size={14} />}
                </span>
                <span className="address-host-pill">{getHostLabel()}</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="address-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setInputValue(url);
                            inputRef.current?.blur();
                        }
                    }}
                    placeholder="Search or enter address"
                    spellCheck={false}
                />
                {zoomVisible && zoomBadge && zoomBadge.percent !== 100 && (
                    <span className="zoom-badge" title="Page zoom (Ctrl+0 resets)">{zoomBadge.percent}%</span>
                )}
            </form>

            <div className="nav-cluster nav-actions-cluster" aria-label="Page actions">
                <div className="split-menu-wrap">
                    <button
                        className={`nav-btn ${splitTabId ? 'split-active' : ''}`}
                        onClick={() => {
                            if (splitTabId) onClearSplit?.();
                            else setSplitOpen(v => !v);
                            setBookmarksOpen(false);
                            setToolsOpen(false);
                            setDownloadsOpen(false);
                            setHistoryOpen(false);
                        }}
                        title={splitTabId ? 'Exit split screen' : 'Split screen'}
                    >
                        {splitTabId ? <PanelRightClose size={16} /> : <Columns2 size={16} />}
                    </button>
                    {splitOpen && !splitTabId && (
                        <div className="split-popover">
                            <strong>Split screen</strong>
                            {splitCandidates.length === 0 ? (
                                <button onClick={() => { setSplitOpen(false); onNavigate('https://duckduckgo.com/'); }}>Open a second tab first</button>
                            ) : splitCandidates.map(tab => (
                                <button key={tab.id} onClick={() => { setSplitOpen(false); onSplitWithTab?.(tab.id); }}>
                                    <span>{tab.title || 'Untitled tab'}</span>
                                    <small>{tab.url || 'New tab'}</small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    className={`nav-btn ${isBookmarked ? 'bookmarked' : ''}`}
                    onClick={bookmarkCurrent}
                    title={isBookmarked ? 'Remove bookmark' : 'Bookmark page'}
                    disabled={!url || url === 'about:blank'}
                >
                    <Star size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
                </button>
                <div className="nav-menu-wrap">
                    <button className="nav-btn" onClick={() => { loadBookmarks(); setBookmarksOpen(v => !v); setToolsOpen(false); setSplitOpen(false); setDownloadsOpen(false); setHistoryOpen(false); }} title="Bookmarks"><BookOpen size={16} /></button>
                    {bookmarksOpen && (
                        <div className="bookmarks-popover">
                            <strong>Bookmarks</strong>
                            {bookmarks.length === 0 ? <span className="empty-bookmarks">No saved bookmarks yet.</span> : bookmarks.map(item => (
                                <button key={item.id} onClick={() => { setBookmarksOpen(false); onNavigate(item.url); }}>
                                    <span>{item.title}</span>
                                    <small>{item.url}</small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="downloads-menu-wrap">
                    <button
                        className={`nav-btn ${downloads.length > 0 && downloads.some(d => d.state === 'progressing') ? 'busy' : ''}`}
                        onClick={() => { void refreshDownloads(); setDownloadsOpen(v => !v); setHistoryOpen(false); setBookmarksOpen(false); setToolsOpen(false); setSplitOpen(false); }}
                        title="Downloads (Ctrl+J)"
                    >
                        <Download size={16} />
                    </button>
                    {downloadsOpen && (
                        <div className="downloads-popover">
                            <header>
                                <strong>Downloads</strong>
                                {downloads.length > 0 && <button onClick={handleClearDownloads}>Clear list</button>}
                            </header>
                            {downloads.length === 0 ? (
                                <span className="empty-panel">Files you download will show up here.</span>
                            ) : downloads.map(entry => (
                                <div key={entry.id} className={`download-row ${entry.state}`}>
                                    <span className="download-name" title={entry.filename}>{entry.filename}</span>
                                    <span className="download-meta">{stateLabel(entry)}</span>
                                    {entry.danger && <span className="download-danger"><FileWarning size={12} /> {entry.danger}</span>}
                                    <div className="download-actions">
                                        {entry.state === 'completed' && (
                                            <button onClick={() => handleOpenDownload(entry)} title="Open file"><ExternalLink size={13} /> Open</button>
                                        )}
                                        <button onClick={() => handleShowDownload(entry)} title="Show in folder"><FolderOpen size={13} /> Folder</button>
                                    </div>
                                    {entry.state === 'progressing' && (
                                        <div className="download-progress">
                                            <div className="download-progress-fill" style={{ width: entry.totalBytes > 0 ? `${Math.min(100, (entry.receivedBytes / entry.totalBytes) * 100)}%` : '12%' }} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="history-menu-wrap">
                    <button
                        className="nav-btn"
                        onClick={() => { void refreshHistory(); setHistoryOpen(v => !v); setDownloadsOpen(false); setBookmarksOpen(false); setToolsOpen(false); setSplitOpen(false); }}
                        title="Recent history"
                    >
                        <Clock size={16} />
                    </button>
                    {historyOpen && (
                        <div className="history-popover">
                            <header><strong>Recent history</strong><small>Cleared automatically per your retention setting</small></header>
                            {history.length === 0 ? (
                                <span className="empty-panel">Pages you visit will show up here.</span>
                            ) : history.map((entry, index) => (
                                <button key={`${entry.timestamp}-${index}`} className="history-row" onClick={() => { setHistoryOpen(false); onNavigate(entry.url); }}>
                                    <span className="history-title">{entry.title || entry.url}</span>
                                    <small className="history-url">{entry.url}</small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button className="nav-btn shield-on" title="Hoo Shields active"><Shield size={16} /></button>
            </div>

            <div className="nav-cluster nav-tools-cluster" aria-label="Tools">
                <button className="nav-btn optional-tool" onClick={() => onNavigate('https://duck.ai/')} title="Duck.ai"><Sparkles size={16} /></button>
                <div className="tools-menu-wrap">
                    <button className="nav-btn" onClick={() => { setToolsOpen(v => !v); setBookmarksOpen(false); setSplitOpen(false); setDownloadsOpen(false); setHistoryOpen(false); }} title="More tools"><MoreHorizontal size={18} /></button>
                    {toolsOpen && (
                        <div className="tools-popover">
                            <button onClick={() => { setToolsOpen(false); onNavigate('https://duck.ai/'); }}><Sparkles size={15} /> Duck.ai</button>
                            <button onClick={() => { setToolsOpen(false); void refreshDownloads(); setDownloadsOpen(true); }}><Download size={15} /> Downloads</button>
                            <button onClick={() => { setToolsOpen(false); void refreshHistory(); setHistoryOpen(true); }}><History size={15} /> Recent history</button>
                            <button onClick={() => { setToolsOpen(false); onOpenSettings?.(); }}><Settings size={15} /> Settings</button>
                        </div>
                    )}
                </div>
                <button className="nav-btn settings-btn" onClick={onOpenSettings} title="Settings (Ctrl+,)"><Settings size={17} /></button>
            </div>
        </div>
    );
};

export default NavigationBar;
