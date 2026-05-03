import React, { useState, useEffect } from 'react';
import './Home.css';
import { Search, Lock, Github, MessageSquare, Mail, Video, Newspaper, Shield, Globe2, KeyRound } from 'lucide-react';

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
                case 'duckduckgo':
                    url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
                    break;
                case 'startpage':
                    url = `https://www.startpage.com/search?q=${encodeURIComponent(query)}`;
                    break;
                case 'qwant':
                    url = `https://www.qwant.com/?q=${encodeURIComponent(query)}`;
                    break;
                default:
                    url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
        }

        if (window.electronAPI?.navigateTo) {
            window.electronAPI.navigateTo(url);
        }
    };

    const getGreeting = () => {
        const hour = time.getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const speedDialLinks = [
        { icon: MessageSquare, label: 'WhatsApp', url: 'https://web.whatsapp.com' },
        { icon: Github, label: 'GitHub', url: 'https://github.com' },
        { icon: Mail, label: 'Proton', url: 'https://mail.proton.me' },
        { icon: Video, label: 'Invidious', url: 'https://invidious.io' },
        { icon: Newspaper, label: 'News', url: 'https://news.ycombinator.com' },
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
        <div className="home-container">
            <div className="home-grid" />
            <div className="home-content animate-fade-in">
                <div className="product-pill">
                    <Shield size={14} />
                    <span>DUCKDUCKGO-FIRST · LOCAL PROFILE · WEB APP READY</span>
                </div>

                <section className="hero-copy">
                    <div className="time">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    <p className="greeting">{getGreeting()}, Zen User</p>
                    <h1>Browse clean. Keep apps separate. Search with DuckDuckGo.</h1>
                    <p className="hero-subtitle">
                        A Linux-first browser shell for private search, isolated web apps, practical shields, and encrypted local profile storage where your OS supports it.
                    </p>
                </section>

                <div className="search-stack">
                    <form onSubmit={handleSearch} className="search-container">
                        <div className="search-engine-preview">
                            {getEngineIcon()}
                        </div>
                        <input
                            type="text"
                            placeholder="Search DuckDuckGo or enter a URL"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                            autoFocus
                        />
                        <button type="submit" className="search-submit" aria-label="Search or navigate">
                            <Search size={18} />
                        </button>
                    </form>

                    <div className="engine-selectors" aria-label="Search engine selector">
                        <button className={activeEngine === 'duckduckgo' ? 'active primary-engine' : ''} onClick={() => setActiveEngine('duckduckgo')}>DuckDuckGo</button>
                        <button className={activeEngine === 'startpage' ? 'active' : ''} onClick={() => setActiveEngine('startpage')}>Startpage</button>
                        <button className={activeEngine === 'qwant' ? 'active' : ''} onClick={() => setActiveEngine('qwant')}>Qwant</button>
                        <button className={activeEngine === 'google' ? 'active fallback-engine' : 'fallback-engine'} onClick={() => setActiveEngine('google')}>Google fallback</button>
                    </div>
                </div>

                <div className="trust-strip">
                    <div><Shield size={16} /><span>Practical shields</span></div>
                    <div><KeyRound size={16} /><span>Encryption-aware storage</span></div>
                    <div><MessageSquare size={16} /><span>WhatsApp profile</span></div>
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
                </div>
            </div>

            <div className="home-footer">
                <span>Zen Browser Foundation</span>
                <span>Daily-driver status: prototype, hardening in progress</span>
            </div>
        </div>
    );
};

export default Home;
