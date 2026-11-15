import React, { useEffect, useMemo, useState } from 'react';
import './Home.css';
import { Check, Image, Search, Settings, BookmarkPlus, Download, Rss, Puzzle } from 'lucide-react';
import { siteInitial, siteInitialStyle } from '../types';
import { getWallpaperById, HOO_WALLPAPERS, HOO_WALLPAPER_STORAGE_KEY } from '../assets/wallpapers';

const hooIcon = require('../assets/branding/hoo-app-icon.svg');
const fallbackWallpaper = require('../assets/branding/hoo-wallpaper.svg');

interface HomeProps {
    onNavigate?: (url: string) => void;
    onOpenSettings?: () => void;
    onOpenInternal?: (target: 'library' | 'downloads' | 'extensions' | 'reader') => void;
}

const BOOKMARK_KEY = 'hoo:bookmarks';

const Home: React.FC<HomeProps> = ({ onNavigate, onOpenSettings, onOpenInternal }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [wallpaperId, setWallpaperId] = useState(() => localStorage.getItem(HOO_WALLPAPER_STORAGE_KEY) || 'owl-night');
    const [imageFallback, setImageFallback] = useState(false);
    const [wallpapersOpen, setWallpapersOpen] = useState(false);

    const activeWallpaper = getWallpaperById(wallpaperId);
    const fallbackUrl = fallbackWallpaper.default || fallbackWallpaper;
    const wallpaperStyle = activeWallpaper.kind === 'image'
        ? { backgroundImage: `url(${imageFallback ? fallbackUrl : activeWallpaper.value})`, backgroundPosition: activeWallpaper.position || 'center' }
        : { backgroundImage: activeWallpaper.value };

    useEffect(() => {
        localStorage.setItem(HOO_WALLPAPER_STORAGE_KEY, wallpaperId);
        setImageFallback(false);
    }, [wallpaperId]);

    useEffect(() => {
        if (activeWallpaper.kind !== 'image') return;
        const img = new window.Image();
        img.onload = (): void => setImageFallback(false);
        img.onerror = (): void => setImageFallback(true);
        img.src = activeWallpaper.value;
    }, [activeWallpaper]);

    const toUrl = (value: string): string => {
        const query = value.trim();
        if (!query) return '';
        if (/^(magnet:|mailto:|tel:|sms:|bitcoin:|ethereum:|tg:|whatsapp:)/i.test(query)) return query;
        if (query.match(/^https?:\/\//)) return query;
        if (query.includes('.') && !query.includes(' ')) return `https://${query}`;
        return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    };

    const handleSearch = (e: React.FormEvent): void => {
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

    const handleOpen = (url: string): void => {
        if (onNavigate) onNavigate(url);
        else window.electronAPI?.navigateTo?.(url);
    };

    const addBookmarkFromInput = (): void => {
        const url = toUrl(searchQuery);
        if (!url) return;
        let title = url;
        try {
            title = new URL(url).hostname.replace(/^www\./, '');
        } catch {
            title = url.slice(0, 48);
        }
        const existing = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify([
            { id: `${Date.now()}`, title, url, createdAt: Date.now() },
            ...existing.filter((item: { url: string }) => item.url !== url)
        ].slice(0, 40)));
    };

    return (
        <div className="home-container" style={wallpaperStyle}>
            <div className="home-shade" />
            <div className="home-controls">
                <button className="home-control-button" type="button" onClick={() => setWallpapersOpen(value => !value)} aria-label="Change wallpaper">
                    <Image size={18} />
                </button>
                <button className="home-control-button" type="button" onClick={onOpenSettings} aria-label="Open settings">
                    <Settings size={18} />
                </button>
            </div>

            {wallpapersOpen && (
                <aside className="wallpaper-panel">
                    <header>
                        <strong>Wallpapers</strong>
                        <small>Lightweight Hoo backgrounds</small>
                    </header>
                    <div className="wallpaper-grid">
                        {HOO_WALLPAPERS.map((wallpaper) => (
                            <button
                                key={wallpaper.id}
                                type="button"
                                className={`wallpaper-option ${wallpaper.id === wallpaperId ? 'active' : ''}`}
                                onClick={() => setWallpaperId(wallpaper.id)}
                            >
                                <span
                                    className="wallpaper-thumb"
                                    style={{ backgroundImage: wallpaper.kind === 'image' ? `url(${wallpaper.value})` : wallpaper.value, backgroundPosition: wallpaper.position || 'center' }}
                                />
                                <span>{wallpaper.name}</span>
                                {wallpaper.id === wallpaperId && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </aside>
            )}

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
                        const initial = siteInitial(link.url);
                        return (
                            <button key={link.label} onClick={() => handleOpen(link.url)} className="speed-dial-item">
                                <span className="speed-dial-icon" style={siteInitialStyle(initial)}>{initial?.letter || '•'}</span>
                                <span className="speed-dial-label">{link.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="home-tools" aria-label="Browser tools">
                    <button type="button" className="home-tool-chip" onClick={() => onOpenInternal?.('downloads')}>
                        <Download size={14} /> Downloads
                    </button>
                    <button type="button" className="home-tool-chip" onClick={() => onOpenInternal?.('reader')}>
                        <Rss size={14} /> Live Reader
                    </button>
                    <button type="button" className="home-tool-chip" onClick={() => onOpenInternal?.('extensions')}>
                        <Puzzle size={14} /> Modules
                    </button>
                </div>
            </main>
        </div>
    );
};

export default Home;
