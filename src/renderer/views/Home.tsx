import React, { useState, useEffect } from 'react';
import './Home.css';
import { Search, Mic, Lock, Github, MessageSquare, Mail, Video, Newspaper, Mountain, Shield } from 'lucide-react';

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

        // Check if it's a URL
        if (query.match(/^https?:\/\//)) {
            url = query;
        } else if (query.includes('.') && !query.includes(' ')) {
            url = 'https://' + query;
        } else {
            // Search query
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

        // Navigate to browser view with the URL
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
        { icon: MessageSquare, label: 'Reddit', url: 'https://reddit.com', color: '#FF4500' },
        { icon: Github, label: 'GitHub', url: 'https://github.com', color: '#6cc644' },
        { icon: Mail, label: 'Proton', url: 'https://proton.me', color: '#6d4aff' },
        { icon: Video, label: 'Invidious', url: 'https://invidious.io', color: '#ff0000' },
        { icon: Newspaper, label: 'News', url: 'https://news.ycombinator.com', color: '#ff6600' },
    ];

    const handleSpeedDialClick = (url: string) => {
        if (window.electronAPI?.navigateTo) {
            window.electronAPI.navigateTo(url);
        }
    };

    const getEngineIcon = () => {
        switch (activeEngine) {
            case 'duckduckgo': return <Lock size={18} />;
            case 'startpage': return <Search size={18} />;
            case 'qwant': return <Search size={18} />;
            default: return <Search size={18} />;
        }
    };

    return (
        <div className="home-container">
            <div className="home-overlay"></div>
            <div className="home-content animate-fade-in">
                {/* Privacy Badge */}
                <div className="privacy-badge">
                    <Shield size={14} className="shield-green" />
                    <span>2.4K TRACKERS SHIELDED</span>
                </div>

                {/* Clock & Greeting */}
                <div className="clock-section">
                    <div className="time">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    <div className="greeting">{getGreeting()}, Zen User</div>
                </div>

                {/* Search Bar */}
                <div className="search-stack">
                    <form onSubmit={handleSearch} className="search-container">
                        <div className="search-engine-preview">
                            {getEngineIcon()}
                        </div>
                        <input
                            type="text"
                            placeholder={`Search ${activeEngine.charAt(0).toUpperCase() + activeEngine.slice(1)} privately...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                        <button type="submit" className="search-submit">
                            <Search size={18} />
                        </button>
                    </form>

                    {/* Quick Search Engines */}
                    <div className="engine-selectors">
                        <button
                            className={activeEngine === 'duckduckgo' ? 'active' : ''}
                            onClick={() => setActiveEngine('duckduckgo')}
                        >DDG</button>
                        <button
                            className={activeEngine === 'startpage' ? 'active' : ''}
                            onClick={() => setActiveEngine('startpage')}
                        >SP</button>
                        <button
                            className={activeEngine === 'qwant' ? 'active' : ''}
                            onClick={() => setActiveEngine('qwant')}
                        >QT</button>
                        <button
                            className={activeEngine === 'google' ? 'active' : ''}
                            onClick={() => setActiveEngine('google')}
                        >G</button>
                    </div>
                </div>

                {/* Speed Dial */}
                <div className="speed-dial">
                    {speedDialLinks.map((link, index) => {
                        const IconComponent = link.icon;
                        return (
                            <button
                                key={index}
                                onClick={() => handleSpeedDialClick(link.url)}
                                className="speed-dial-item"
                            >
                                <div className="speed-dial-icon">
                                    <IconComponent size={24} />
                                </div>
                                <span className="speed-dial-label">{link.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="home-footer">
                <div className="wallpaper-credit">
                    <Mountain size={16} className="credit-icon" />
                    Misty Forest
                </div>
                <button className="focus-mode-btn">
                    <Mountain size={16} className="focus-icon" />
                    FOCUS MODE
                </button>
            </div>
        </div>
    );
};

export default Home;
