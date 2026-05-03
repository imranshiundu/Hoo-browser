import React, { useState } from 'react';
import './Home.css';
import { Search, Github, MessageSquare, Mail, Video, Newspaper, Settings } from 'lucide-react';

const hooIcon = require('../assets/branding/hoo-app-icon.svg');
const hooWallpaper = require('../assets/branding/hoo-wallpaper.svg');

interface HomeProps {
    onNavigate?: (url: string) => void;
    onOpenSettings?: () => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate, onOpenSettings }) => {
    const [searchQuery, setSearchQuery] = useState('');

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

    const speedDialLinks = [
        { icon: MessageSquare, label: 'WhatsApp', url: 'https://web.whatsapp.com' },
        { icon: Github, label: 'GitHub', url: 'https://github.com' },
        { icon: Video, label: 'YouTube', url: 'https://youtube.com' },
        { icon: Newspaper, label: 'Reddit', url: 'https://reddit.com' },
        { icon: Mail, label: 'Proton', url: 'https://mail.proton.me' },
    ];

    const handleSpeedDialClick = (url: string) => {
        if (onNavigate) onNavigate(url);
        else window.electronAPI?.navigateTo?.(url);
    };

    return (
        <div className="home-container" style={{ backgroundImage: `url(${hooWallpaper.default || hooWallpaper})` }}>
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
                </form>

                <div className="speed-dial" aria-label="Quick links">
                    {speedDialLinks.map((link) => {
                        const IconComponent = link.icon;
                        return (
                            <button key={link.label} onClick={() => handleSpeedDialClick(link.url)} className="speed-dial-item">
                                <span className="speed-dial-icon"><IconComponent size={22} /></span>
                                <span className="speed-dial-label">{link.label}</span>
                            </button>
                        );
                    })}
                </div>
            </main>
        </div>
    );
};

export default Home;
