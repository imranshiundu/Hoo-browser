import React, { useEffect, useMemo, useState } from 'react';
import './Home.css';
import { Search, Newspaper, Settings, BookmarkPlus, Trash2 } from 'lucide-react';
import { Bookmark, getFaviconUrl } from '../types';

const hooIcon = require('../assets/branding/hoo-app-icon.svg');
const fallbackWallpaper = require('../assets/branding/hoo-wallpaper.svg');
const customWallpaperPath = 'assets/branding/hoo-owl-wallpaper.png';

interface HomeProps {
    onNavigate?: (url: string) => void;
    onOpenSettings?: () => void;
}

const BOOKMARK_KEY = 'hoo:bookmarks';

const readBookmarks = (): Bookmark[] => {
    try {
        return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
    } catch {
        return [];
    }
};

const Home: React.FC<HomeProps> = ({ onNavigate, onOpenSettings }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(readBookmarks);
    const [wallpaperUrl, setWallpaperUrl] = useState(customWallpaperPath);

    useEffect(() => {
        const img = new Image();
        img.onload = () => setWallpaperUrl(customWallpaperPath);
        img.onerror = () => setWallpaperUrl(fallbackWallpaper.default || fallbackWallpaper);
        img.src = customWallpaperPath;
    }, []);

    useEffect(() => {
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks.slice(0, 18)));
    }, [bookmarks]);

    const toUrl = (value: string) => {
        const query = value.trim();
        if (!query) return '';
        if (query.match(/^https?:\/\//)) return query;
        if (query.includes('.') && !query.includes(' ')) return `https://${query}`;
        return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const url = toUrl(searchQuery);
        if (!url) return;
        if (onNavigate) onNavigate(url);
        else window.electronAPI?.navigateTo?.(url);
    };

    const speedDialLinks = useMemo(() => [
        { label: 'WhatsApp', url: 'https://web.whatsapp.com' },
        { label: 'GitHub', url: 'https://github.com' },
        { label: 'YouTube', url: 'https://youtube.com' },
        { label: 'Reddit', url: 'https://reddit.com' },
        { label: 'Proton', url: 'https://mail.proton.me' },
    ], []);

    const handleOpen = (url: string) => {
        if (onNavigate) onNavigate(url);
        else window.electronAPI?.navigateTo?.(url);
    };

    const addBookmarkFromInput = () => {
        const url = toUrl(searchQuery);
        if (!url) return;
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        setBookmarks(prev => [
            { id: `${Date.now()}`, title: hostname, url, createdAt: Date.now() },
            ...prev.filter(item => item.url !== url)
        ].slice(0, 18));
    };

    const removeBookmark = (id: string) => {
        setBookmarks(prev => prev.filter(item => item.id !== id));
    };

    return (
        <div className="home-container" style={{ backgroundImage: `url(${wallpaperUrl})` }}>
            <div className="home-shade" />
            <button className="home-settings" type="button" onClick={onOpenSettings} aria-label="Open settings">
                <Settings size={18} />
            </button>

            <main className="home-center">
                <div className="home-brand">
                    <img src={hooIcon.default || hooIcon} alt="Hoo Browser" />
                    <span><strong>Hoo</strong> Browser</span>
                </div>

                <form onSubmit={handleSearch} className="home-search">
                    <Search size={19} />
                    <input
                        type="text"
                        placeholder="Search with DuckDuckGo or enter address"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <button type="button" className="home-search-action" onClick={addBookmarkFromInput} title="Bookmark this address">
                        <BookmarkPlus size={18} />
                    </button>
                </form>

                <div className="speed-dial" aria-label="Quick links">
                    {speedDialLinks.map((link) => {
                        const favicon = getFaviconUrl(link.url);
                        return (
                            <button key={link.label} onClick={() => handleOpen(link.url)} className="speed-dial-item">
                                <span className="speed-dial-icon">{favicon ? <img src={favicon} alt="" /> : null}</span>
                                <span className="speed-dial-label">{link.label}</span>
                            </button>
                        );
                    })}
                </div>

                <section className="bookmarks-panel" aria-label="Bookmarks">
                    <header>
                        <span>Bookmarks</span>
                        <small>{bookmarks.length ? 'saved locally' : 'type an address, then tap the bookmark icon'}</small>
                    </header>
                    <div className="bookmark-grid">
                        {bookmarks.map(bookmark => {
                            const favicon = getFaviconUrl(bookmark.url);
                            return (
                                <div className="bookmark-card" key={bookmark.id}>
                                    <button className="bookmark-main" onClick={() => handleOpen(bookmark.url)} title={bookmark.url}>
                                        {favicon ? <img src={favicon} alt="" /> : <Newspaper size={16} />}
                                        <span>{bookmark.title}</span>
                                    </button>
                                    <button className="bookmark-remove" onClick={() => removeBookmark(bookmark.id)} title="Remove bookmark">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Home;
