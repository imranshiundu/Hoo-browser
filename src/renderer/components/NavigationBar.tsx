import React, { useState, useEffect, useRef } from 'react';
import './NavigationBar.css';
import { ArrowLeft, ArrowRight, RotateCw, Lock, Globe, Settings, Home, Star, BookOpen, Sparkles, Download, Shield, Search, MoreHorizontal, Columns2, PanelRightClose } from 'lucide-react';
import { Tab } from '../types';

interface NavigationBarProps {
    tabId: string;
    url: string;
    tabs?: Tab[];
    splitTabId?: string | null;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onSplitWithTab?: (tabId: string) => void;
    onClearSplit?: () => void;
    onOpenSettings?: () => void;
}

const BOOKMARK_KEY = 'hoo:bookmarks';

const NavigationBar: React.FC<NavigationBarProps> = ({
    tabId,
    url,
    tabs = [],
    splitTabId,
    onNavigate,
    onBack,
    onForward,
    onReload,
    onSplitWithTab,
    onClearSplit,
    onOpenSettings
}) => {
    const [inputValue, setInputValue] = useState(url);
    const [bookmarksOpen, setBookmarksOpen] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [splitOpen, setSplitOpen] = useState(false);
    const [bookmarks, setBookmarks] = useState<Array<{ id: string; title: string; url: string }>>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => setInputValue(url), [url]);

    const loadBookmarks = (): void => {
        try {
            setBookmarks(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'));
        } catch {
            setBookmarks([]);
        }
    };

    useEffect(() => loadBookmarks(), []);

    useEffect(() => {
        const focusAddress = (): void => inputRef.current?.focus();
        document.addEventListener('hoo-focus-address', focusAddress);
        return () => document.removeEventListener('hoo-focus-address', focusAddress);
    }, []);

    useEffect(() => {
        const closePopovers = (event: MouseEvent): void => {
            const target = event.target as HTMLElement | null;
            if (!target?.closest('.nav-menu-wrap')) setBookmarksOpen(false);
            if (!target?.closest('.tools-menu-wrap')) setToolsOpen(false);
            if (!target?.closest('.split-menu-wrap')) setSplitOpen(false);
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

    return (
        <div className="navigation-bar">
            <div className="nav-cluster nav-history-cluster" aria-label="Navigation controls">
                <button className="nav-btn" onClick={onBack} title="Back"><ArrowLeft size={17} /></button>
                <button className="nav-btn" onClick={onForward} title="Forward"><ArrowRight size={17} /></button>
                <button className="nav-btn" onClick={onReload} title="Reload"><RotateCw size={16} /></button>
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
                <button className="nav-btn" onClick={bookmarkCurrent} title="Bookmark page"><Star size={16} /></button>
                <div className="nav-menu-wrap">
                    <button className="nav-btn" onClick={() => { loadBookmarks(); setBookmarksOpen(v => !v); setToolsOpen(false); setSplitOpen(false); }} title="Bookmarks"><BookOpen size={16} /></button>
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
                <button className="nav-btn shield-on" title="Hoo Shields active"><Shield size={16} /></button>
            </div>

            <div className="nav-cluster nav-tools-cluster" aria-label="Tools">
                <button className="nav-btn optional-tool" onClick={() => onNavigate('https://duck.ai/')} title="Duck.ai"><Sparkles size={16} /></button>
                <button className="nav-btn optional-tool" title="Downloads"><Download size={16} /></button>
                <div className="tools-menu-wrap">
                    <button className="nav-btn" onClick={() => { setToolsOpen(v => !v); setBookmarksOpen(false); setSplitOpen(false); }} title="More tools"><MoreHorizontal size={18} /></button>
                    {toolsOpen && (
                        <div className="tools-popover">
                            <button onClick={() => { setToolsOpen(false); onNavigate('https://duck.ai/'); }}><Sparkles size={15} /> Duck.ai</button>
                            <button onClick={() => setToolsOpen(false)}><Download size={15} /> Downloads</button>
                            <button onClick={() => { setToolsOpen(false); onOpenSettings?.(); }}><Settings size={15} /> Settings</button>
                        </div>
                    )}
                </div>
                <button className="nav-btn settings-btn" onClick={onOpenSettings} title="Settings"><Settings size={17} /></button>
            </div>
        </div>
    );
};

export default NavigationBar;
