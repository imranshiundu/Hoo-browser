import React, { useState, useEffect, useRef } from 'react';
import './NavigationBar.css';
import { ArrowLeft, ArrowRight, RotateCw, Lock, Globe, Settings, Home, Star, BookOpen, Sparkles, Download, Shield } from 'lucide-react';

interface NavigationBarProps {
    tabId: string;
    url: string;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onOpenSettings?: () => void;
}

const BOOKMARK_KEY = 'hoo:bookmarks';

const NavigationBar: React.FC<NavigationBarProps> = ({
    url,
    onNavigate,
    onBack,
    onForward,
    onReload,
    onOpenSettings
}) => {
    const [inputValue, setInputValue] = useState(url);
    const [bookmarksOpen, setBookmarksOpen] = useState(false);
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

    const normalizeTarget = (value: string): string => {
        let target = value.trim();
        if (!target) return '';
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
    };

    const bookmarkCurrent = (): void => {
        if (!url || url === 'about:blank') return;
        const title = new URL(url).hostname.replace(/^www\./, '');
        const next = [
            { id: `${Date.now()}`, title, url },
            ...bookmarks.filter(item => item.url !== url)
        ].slice(0, 40);
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
        setBookmarks(next);
        setBookmarksOpen(true);
    };

    return (
        <div className="navigation-bar">
            <button className="nav-btn" onClick={onBack} title="Back"><ArrowLeft size={17} /></button>
            <button className="nav-btn" onClick={onForward} title="Forward"><ArrowRight size={17} /></button>
            <button className="nav-btn" onClick={onReload} title="Reload"><RotateCw size={16} /></button>
            <button className="nav-btn" onClick={() => onNavigate('about:blank')} title="Home"><Home size={16} /></button>

            <form onSubmit={handleSubmit} className="address-form">
                <span className="security-indicator">
                    {url.startsWith('https') ? <Lock size={13} /> : <Globe size={13} />}
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    className="address-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Search with DuckDuckGo or enter address"
                />
            </form>

            <button className="nav-btn" onClick={bookmarkCurrent} title="Bookmark page"><Star size={16} /></button>
            <div className="nav-menu-wrap">
                <button className="nav-btn" onClick={() => { loadBookmarks(); setBookmarksOpen(v => !v); }} title="Bookmarks"><BookOpen size={16} /></button>
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
            <button className="nav-btn" onClick={() => onNavigate('https://duck.ai/')} title="Duck.ai"><Sparkles size={16} /></button>
            <button className="nav-btn" title="Downloads"><Download size={16} /></button>
            <button className="nav-btn shield-on" title="Hoo Shields active"><Shield size={16} /></button>
            <button className="nav-btn" onClick={onOpenSettings} title="Settings"><Settings size={17} /></button>
        </div>
    );
};

export default NavigationBar;
