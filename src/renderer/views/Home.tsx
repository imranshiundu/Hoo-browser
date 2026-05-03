import React, { useState, useEffect } from 'react';
import './Home.css';
import { Search, Lock, Github, MessageSquare, Mail, Video, Newspaper, Shield, Globe2, KeyRound, Plus } from 'lucide-react';

const hooIcon = require('../assets/branding/hoo-app-icon.svg');
const hooWallpaper = require('../assets/branding/hoo-wallpaper.svg');

const Home: React.FC = () => {
    const [time, setTime] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [activeEngine, setActiveEngine] = useState('duckduckgo');

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        let url = '';
        const query = searchQuery.trim();

        if (query.match(/^https?:\/\//)) {
            url = query;
        } else if (query.includes('.') && !query.includes(' ')) {
            url = 'https://' + query;
        } else {
            switch (activeEngine) {
                case 'startpage':
                    url = `https://www.startpage.com/search?q=${encodeURIComponent(query)}`;
                    break;
                case 'qwant':
                    url = `https://www.qwant.com/?q=${encodeURIComponent(query)}`;
                    break;
                case 'google':
                    url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                    break;
                default:
                    url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
            }
        }

        if (window.electronAPI?.navigateTo) {
            window.electronAPI.navigateTo(url);
        }
    };

    const getGreeting = () => {
        const hour = time.getHours();
        if (hour < 12) return "Good morning. Hoo's got your back.";
        if (hour < 18) return "Good afternoon. Hoo's watching the web with you.";
        return 'Good evening. Night mode suits an owl.';
    };

    const speedDialLinks = [
        { icon: MessageSquare, label: 'WhatsApp', url: 'https://web.whatsapp.com' },
        { icon: Github, label: 'GitHub', url: 'https://github.com' },
        { icon: Video, label: 'YouTube', url: 'https://youtube.com' },
        { icon: Newspaper, label: 'Reddit', url: 'https://reddit.com' },
        { icon: Mail, label: 'Proton', url: 'https://mail.proton.me' },
    ];

    const handleSpeedDialClick = (url: string) => {
        if (window.electronAPI?.navigateTo) {
            window.electronAPI.navigateTo(url);
        }
    };

    const getEngineIcon = () => {
        switch (activeEngine) {
            case 'duckduckgo': return <Shield size={18} />;
            case 'startpage': return <Lock size={18} />;
            case 'qwant': return <Globe2 size={18} />;
            default: return <Search size={18} />;
        }
    };

    return (
        <div className="home-container" style={{ backgroundImage: `url(${hooWallpaper.default || hooWallpaper})` }}>
            <div className="home-vignette" />
            <div className="home-content animate-fade-in">
                <div className="brand-lockup">
                    <img src={hooIcon.default || hooIcon} alt="Hoo Browser owl icon" className="brand-icon" />
                    <div className="brand-wordmark" aria-label="Hoo Browser">
                        <span className="brand-hoo">Hoo</span><span className="brand-browser">Browser</span>
                    </div>
                </div>

                <div className="product-pill">
                    <Shield size={14} />
                    <span>OWL-GUIDED · PRIVACY-FIRST · WEB FREEDOM</span>
                </div>

                <section className="hero-copy">
                    <div className="time">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    <p className="greeting">{getGreeting()}</p>
                    <h1>Private search. No tracking. Just results.</h1>
                    <p className="hero-subtitle">
                        Hoo is a DuckDuckGo-first desktop browser for isolated web apps, practical protection, calm navigation, and Linux-first freedom.
                    </p>
                </section>

                <div className="search-stack">
                    <form onSubmit={handleSearch} className="search-container">
                        <div className="search-engine-preview">{getEngineIcon()}</div>
                        <input
                            type="text"
                            placeholder="Search with DuckDuckGo or enter an address"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                            autoFocus
                        />
                        <button type="submit" className="search-submit" aria-label="Search or navigate">›</button>
                    </form>

                    <div className="engine-selectors" aria-label="Search engine selector">
                        <button className={activeEngine === 'duckduckgo' ? 'active primary-engine' : ''} onClick={() => setActiveEngine('duckduckgo')}>DuckDuckGo</button>
                        <button className={activeEngine === 'startpage' ? 'active' : ''} onClick={() => setActiveEngine('startpage')}>Startpage</button>
                        <button className={activeEngine === 'qwant' ? 'active' : ''} onClick={() => setActiveEngine('qwant')}>Qwant</button>
                        <button className={activeEngine === 'google' ? 'active fallback-engine' : 'fallback-engine'} onClick={() => setActiveEngine('google')}>Google fallback</button>
                    </div>
                </div>

                <div className="speed-dial">
                    {speedDialLinks.map((link) => {
                        const IconComponent = link.icon;
                        return (
                            <button key={link.label} onClick={() => handleSpeedDialClick(link.url)} className="speed-dial-item">
                                <div className="speed-dial-icon"><IconComponent size={22} /></div>
                                <span className="speed-dial-label">{link.label}</span>
                            </button>
                        );
                    })}
                    <button className="speed-dial-item add-app" type="button">
                        <div className="speed-dial-icon"><Plus size={24} /></div>
                        <span className="speed-dial-label">Add App</span>
                    </button>
                </div>
            </div>

            <div className="home-footer">
                <span><Shield size={16} /> DuckDuckGo-first</span>
                <span><KeyRound size={16} /> Website protection</span>
                <span><Globe2 size={16} /> Linux-first</span>
            </div>
        </div>
    );
};

export default Home;
