import React, { useState, useEffect, useRef } from 'react';
import './NavigationBar.css';
import { ArrowLeft, ArrowRight, RotateCw, X, Lock, Globe, Search, Star, BookOpen, Download, Clock, Shield, MoreHorizontal, Settings, FolderOpen, ExternalLink, FileWarning, Home, Columns2, PanelRightClose, Sparkles, History, BookMarked, Trash2, ShieldAlert, Columns } from 'lucide-react';
import { filterHistoryEntries } from '../../main/tab-utils';
import { Tab } from '../types';
import { formatBytes } from '../../main/tab-utils';
import { originFromUrl, permissionPanelLabel, cycleDecision, DECIDABLE_PERMISSIONS, PermissionResolution } from '../../main/permissions';
import { AwesomeInputRow, buildAwesomeResults, moveHighlight, resolveAwesomeTarget } from '../awesomebar-model';

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
    onSwitchToTab?: (tabId: string) => void;
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
// Panel order: the capabilities real sites ask for first.
const SITE_INFO_PERMISSIONS: readonly string[] = [
    'media', 'geolocation', 'notifications', 'display-capture',
    'clipboard-sanitized-read', 'midi', 'pointerLock', 'fullscreen'
].filter(p => (DECIDABLE_PERMISSIONS as readonly string[]).includes(p));

const decisionChipClass = (decision: PermissionResolution): string =>
    decision === 'allow' ? 'allow' : decision === 'block' ? 'block' : 'ask';

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
    onOpenSettings,
    onSwitchToTab
}) => {
    const [inputValue, setInputValue] = useState(url);
    const [bookmarksOpen, setBookmarksOpen] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [splitOpen, setSplitOpen] = useState(false);
    const [downloadsOpen, setDownloadsOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [siteInfoOpen, setSiteInfoOpen] = useState(false);
    // `origin|permission` -> stored decision; a missing key means "Ask".
    const [siteDecisions, setSiteDecisions] = useState<Record<string, 'allow' | 'block'>>({});
    const [bookmarks, setBookmarks] = useState<Array<{ id: string; title: string; url: string }>>([]);
    const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [zoomVisible, setZoomVisible] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    // Awesome Bar state: dropdown visibility, keyboard highlight and the
    // live DuckDuckGo suggestions fetched through the main process.
    const [awesomeOpen, setAwesomeOpen] = useState(false);
    const [awesomeHighlight, setAwesomeHighlight] = useState(-1);
    const [awesomeSuggestions, setAwesomeSuggestions] = useState<string[]>([]);
    const [suggestionsEnabled, setSuggestionsEnabled] = useState<boolean>(() => localStorage.getItem('hoo:address-suggestions') !== 'off');
    const suggestionRequestId = useRef(0);
    const suggestionTimer = useRef<number | null>(null);

    useEffect(() => setInputValue(url), [url]);

    // Navigating away invalidates the panel's site; close it rather than
    // showing decisions for a site you just left.
    useEffect(() => setSiteInfoOpen(false), [url]);

    const loadBookmarks = (): void => {
        try {
            setBookmarks(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'));
        } catch {
            setBookmarks([]);
        }
    };

    const notifyBookmarksChanged = (): void => {
        // The bookmark manager tab and the star button live in different
        // components; this keeps them showing the same list.
        document.dispatchEvent(new Event('hoo-bookmarks-changed'));
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
        document.addEventListener('hoo-suggestions-changed', () => {
            setSuggestionsEnabled(localStorage.getItem('hoo:address-suggestions') !== 'off');
        });
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
            if (!target?.closest('.siteinfo-menu-wrap')) setSiteInfoOpen(false);
            // Clicking anywhere outside the address form drops the Awesome Bar.
            if (!target?.closest('.address-form')) setAwesomeOpen(false);
        };
        document.addEventListener('mousedown', closePopovers);
        return () => document.removeEventListener('mousedown', closePopovers);
    }, []);

    // ---- Awesome Bar -------------------------------------------------------
    // One ranked, deduped list built by the pure model: primary action,
    // switch-to-tab, bookmarks + history, then live DuckDuckGo suggestions.
    const awesomeResults = React.useMemo(
        () => buildAwesomeResults(inputValue, { tabs, bookmarks, history, suggestions: awesomeSuggestions }),
        [inputValue, tabs, bookmarks, history, awesomeSuggestions]
    );

    useEffect(() => {
        // Highlight follows the list; reset whenever its shape changes.
        setAwesomeHighlight(current => (current >= awesomeResults.flat.length ? -1 : current));
    }, [awesomeResults]);

    useEffect(() => () => {
        if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current);
        suggestionRequestId.current += 1;
    }, []);

    const scheduleSuggestions = (value: string): void => {
        if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current);
        const trimmed = value.trim();
        if (!suggestionsEnabled || trimmed.length < 2) {
            setAwesomeSuggestions([]);
            return;
        }
        suggestionTimer.current = window.setTimeout(async (): Promise<void> => {
            const requestId = ++suggestionRequestId.current;
            try {
                const result = await window.electronAPI?.getAddressSuggestions?.(trimmed);
                if (requestId === suggestionRequestId.current && result?.ok) {
                    setAwesomeSuggestions(result.suggestions || []);
                }
            } catch { /* offline: suggestions simply stay empty */ }
        }, 180);
    };

    const activateAwesomeRow = (row: AwesomeInputRow): void => {
        setAwesomeOpen(false);
        setAwesomeHighlight(-1);
        if (row.kind === 'tab' && row.tabId && onSwitchToTab) {
            onSwitchToTab(row.tabId);
            return;
        }
        if (row.target) onNavigate(row.target);
    };

    const handleAddressChange = (value: string): void => {
        setInputValue(value);
        setAwesomeOpen(!!value.trim());
        scheduleSuggestions(value);
    };

    const handleAddressKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!awesomeOpen || !awesomeResults.flat.length) return;
            event.preventDefault();
            setAwesomeHighlight(current => moveHighlight(
                current < 0 && event.key === 'ArrowDown' ? -1 : current,
                event.key === 'ArrowDown' ? 1 : -1,
                awesomeResults.flat.length
            ));
            return;
        }
        if (event.key === 'Escape') {
            setAwesomeOpen(false);
            setAwesomeHighlight(-1);
            setInputValue(url);
            inputRef.current?.blur();
            return;
        }
        if (event.key === 'Enter' && awesomeOpen && awesomeHighlight >= 0 && awesomeResults.flat[awesomeHighlight]) {
            event.preventDefault();
            activateAwesomeRow(awesomeResults.flat[awesomeHighlight]);
            inputRef.current?.blur();
        }
    };

    const normalizeTarget = (value: string): string => resolveAwesomeTarget(value);

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        // Arrow keys pick a row; plain Enter always navigates.
        if (awesomeOpen && awesomeHighlight >= 0 && awesomeResults.flat[awesomeHighlight]) {
            activateAwesomeRow(awesomeResults.flat[awesomeHighlight]);
            inputRef.current?.blur();
            return;
        }
        const target = normalizeTarget(inputValue);
        setAwesomeOpen(false);
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
            notifyBookmarksChanged();
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
        notifyBookmarksChanged();
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

    const siteOrigin = originFromUrl(url);

    const refreshSiteDecisions = async (): Promise<void> => {
        if (!siteOrigin || !window.electronAPI?.getSitePermissions) return;
        try {
            const rows: Array<{ key: string; origin: string; decision: 'allow' | 'block' }> = await window.electronAPI.getSitePermissions();
            const mine: Record<string, 'allow' | 'block'> = {};
            rows.filter(row => row.origin === siteOrigin).forEach(row => { mine[row.key] = row.decision; });
            setSiteDecisions(mine);
        } catch { /* panel still opens; every row reads "Ask" */ }
    };

    const cycleSitePermission = async (permission: string): Promise<void> => {
        if (!siteOrigin) return;
        const key = `${siteOrigin}|${permission}`;
        const next = cycleDecision(siteDecisions[key] || 'ask');
        const result = await window.electronAPI?.setSitePermission?.(siteOrigin, permission, next);
        if (result && !result.ok) return;
        setSiteDecisions(prev => {
            const copy = { ...prev };
            if (next === 'ask') delete copy[key];
            else copy[key] = next;
            return copy;
        });
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

    const openBookmarkManager = (): void => {
        setBookmarksOpen(false);
        setToolsOpen(false);
        document.dispatchEvent(new Event('hoo-open-library'));
    };

    const handleClearHistory = (): void => {
        if (!window.confirm('Clear all browsing history?')) return;
        void window.electronAPI?.clearHistory?.();
        setHistory([]);
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
                {siteOrigin ? (
                    <div className="siteinfo-menu-wrap">
                        <button
                            type="button"
                            className={`security-indicator ${siteInfoOpen ? 'open' : ''} ${isSecure ? '' : 'amber'}`}
                            onClick={() => { void refreshSiteDecisions(); setSiteInfoOpen(v => !v); setBookmarksOpen(false); setToolsOpen(false); setSplitOpen(false); setDownloadsOpen(false); setHistoryOpen(false); }}
                            title="Site information"
                            aria-expanded={siteInfoOpen}
                        >
                            {isSecure ? <Lock size={13} /> : <ShieldAlert size={13} />}
                        </button>
                        {siteInfoOpen && (
                            <div className="siteinfo-popover" role="dialog" aria-label="Site information">
                                <div className={`siteinfo-connection ${isSecure ? 'secure' : 'insecure'}`}>
                                    {isSecure ? <Lock size={15} /> : <ShieldAlert size={15} />}
                                    <div>
                                        <strong>{isSecure ? 'Connection is secure' : 'Connection is not secure'}</strong>
                                        <span>
                                            {isSecure
                                                ? `Standard TLS encryption on ${siteOrigin.replace('https://', '')}.`
                                                : 'This site does not encrypt traffic. Do not enter passwords here.'}
                                        </span>
                                    </div>
                                </div>
                                <div className="siteinfo-permissions">
                                    <strong>Permissions for {siteOrigin.replace(/^https?:\/\//, '')}</strong>
                                    <span className="siteinfo-hint">Click a value to cycle Ask → Allow → Block. Changes apply on reload.</span>
                                    {SITE_INFO_PERMISSIONS.map(permission => {
                                        const decision: PermissionResolution = siteDecisions[`${siteOrigin}|${permission}`] || 'ask';
                                        return (
                                            <div key={permission} className="siteinfo-row">
                                                <span>{permissionPanelLabel(permission)}</span>
                                                <button
                                                    className={`decision-chip ${decisionChipClass(decision)}`}
                                                    onClick={() => { void cycleSitePermission(permission); }}
                                                    title={`Cycle decision for ${permissionPanelLabel(permission)}`}
                                                >
                                                    {decision === 'allow' ? 'Allow' : decision === 'block' ? 'Block' : 'Ask'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <footer className="popover-footer">
                                    <button onClick={() => { setSiteInfoOpen(false); onOpenSettings?.(); }} title="Open Settings → Site permissions">
                                        <Shield size={13} /> Manage all site permissions
                                    </button>
                                </footer>
                            </div>
                        )}
                    </div>
                ) : (
                    <span className="security-indicator" title={isSecure ? 'Secure connection' : isExternal ? 'External protocol' : 'Search or normal connection'}>
                        {isSecure ? <Lock size={13} /> : isExternal ? <Globe size={13} /> : <Search size={14} />}
                    </span>
                )}
                <span className="address-host-pill">{getHostLabel()}</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="address-input"
                    value={inputValue}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    onFocus={(e) => { e.target.select(); if (e.target.value.trim()) setAwesomeOpen(true); }}
                    onKeyDown={handleAddressKeyDown}
                    placeholder="Search or enter address"
                    spellCheck={false}
                    aria-expanded={awesomeOpen}
                    role="combobox"
                    aria-controls="awesome-dropdown"
                />
                {awesomeOpen && awesomeResults.flat.length > 0 && (
                    <div
                        id="awesome-dropdown"
                        className="awesome-dropdown"
                        role="listbox"
                        // mousedown preventDefault keeps input focus while clicking rows.
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {(() => {
                            let rowCursor = 0;
                            return awesomeResults.sections.map(section => (
                                <div key={section.id} className={`awesome-section ${section.id}`}>
                                    {section.label && <span className="awesome-section-label">{section.label}</span>}
                                    {section.rows.map(row => {
                                        const index = rowCursor++;
                                        const rowIcon =
                                            row.kind === 'tab' ? <Columns size={13} /> :
                                            row.kind === 'bookmark' ? <Star size={13} /> :
                                            row.kind === 'history' ? <Clock size={13} /> :
                                            row.kind === 'navigate' ? <Globe size={13} /> :
                                            <Search size={13} />;
                                        return (
                                            <button
                                                key={`${row.kind}:${row.target}:${index}`}
                                                role="option"
                                                aria-selected={index === awesomeHighlight}
                                                className={`awesome-row ${index === awesomeHighlight ? 'active' : ''}`}
                                                onMouseEnter={() => setAwesomeHighlight(index)}
                                                onClick={() => activateAwesomeRow(row)}
                                                title={row.subtitle}
                                            >
                                                <span className="awesome-row-icon">{rowIcon}</span>
                                                <span className="awesome-row-title">{row.title}</span>
                                                <span className="awesome-row-sub">{row.subtitle}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ));
                        })()}
                    </div>
                )}
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
                            <footer className="popover-footer">
                                <button onClick={openBookmarkManager} title="Open the full bookmark manager (Ctrl+Shift+O)">
                                    <BookMarked size={13} /> Manage bookmarks
                                </button>
                            </footer>
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
                            <header>
                                <strong>Recent history</strong>
                                <div className="history-header-actions">
                                    {history.length > 0 && <button onClick={handleClearHistory} title="Clear all browsing history"><Trash2 size={13} /> Clear</button>}
                                </div>
                            </header>
                            {history.length > 0 && (
                                <div className="history-search">
                                    <Search size={13} />
                                    <input
                                        type="text"
                                        placeholder="Search history..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                            {history.length === 0 ? (
                                <span className="empty-panel">Pages you visit will show up here.</span>
                            ) : filterHistoryEntries(history, historySearch).length === 0 ? (
                                <span className="empty-panel">No history matches “{historySearch}”.</span>
                            ) : filterHistoryEntries(history, historySearch).map((entry, index) => (
                                <button key={`${entry.timestamp}-${index}`} className="history-row" onClick={() => { setHistoryOpen(false); setHistorySearch(''); onNavigate(entry.url); }}>
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
                            <button onClick={openBookmarkManager}><BookMarked size={15} /> Bookmark manager</button>
                            <button onClick={() => { setToolsOpen(false); void refreshDownloads(); setDownloadsOpen(true); }}><Download size={15} /> Downloads</button>
                            <button onClick={() => { setToolsOpen(false); void refreshHistory(); setHistoryOpen(true); }}><Clock size={15} /> Recent history</button>
                            <button onClick={() => { setToolsOpen(false); document.dispatchEvent(new Event('hoo-open-history-page')); }}><History size={15} /> Full history</button>
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
