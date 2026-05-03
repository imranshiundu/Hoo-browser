import React, { useState, useEffect } from 'react';
import './Home.css';
import { Search, Lock, Github, MessageSquare, Mail, Video, Newspaper, Shield, Globe2, KeyRound } from 'lucide-react';

const Home: React.FC = () => {
    const [time, setTime] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [activeEngine, setActiveEngine] = useState('duckduckgo');
    const [osProfile, setOSProfile] = useState<any>(null);
    const [encryption, setEncryption] = useState<any>(null);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        window.electronAPI?.getOSProfile?.().then(setOSProfile).catch(() => null);
        window.electronAPI?.getEncryptionStatus?.().then(setEncryption).catch(() => null);
        return () => clearInterval(timer);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        const query = searchQuery.trim();
        let url = '';
        if (query.match(/^https?:\/\//)) url = query;
        else if (query.includes('.') && !query.includes(' ')) url = 'https://' + query;
        else if (activeEngine === 'startpage') url = `https://www.startpage.com/search?q=${encodeURIComponent(query)}`;
        else if (activeEngine === 'qwant') url = `https://www.qwant.com/?q=${encodeURIComponent(query)}`;
        else if (activeEngine === 'google') url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        else url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        window.electronAPI?.navigateTo?.(url);
    };

    const getGreeting = () => {
        const hour = time.getHours();
        if (hour < 12) return 'Hoo is awake. Good morning.';
        if (hour < 18) return 'Hoo is watching the web with you.';
        return 'Night mode suits an owl.';
    };

    const speedDialLinks = [
        { icon: MessageSquare, label: 'WhatsApp', url: 'https://web.whatsapp.com' },
        { icon: Github, label: 'GitHub', url: 'https://github.com' },
        { icon: Mail, label: 'Proton', url: 'https://mail.proton.me' },
        { icon: Video, label: 'Invidious', url: 'https://invidious.io' },
        { icon: Newspaper, label: 'News', url: 'https://news.ycombinator.com' },
    ];

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
                <div className="mascot-lockup">
                    <div className="hoo-mascot" aria-hidden="true"><span className="owl-eye left" /><span className="owl-eye right" /><span className="owl-beak" /></div>
                    <div className="product-pill"><Shield size={14} /><span>HOO BROWSER · DUCKDUCKGO-FIRST · OWL-GUIDED</span></div>
                </div>
                <section className="hero-copy">
                    <div className="time">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    <p className="greeting">{getGreeting()}</p>
                    <h1>Search quietly. Keep apps nested. Let Hoo watch the risky parts.</h1>
                    <p className="hero-subtitle">A DuckDuckGo-first browser with isolated web apps, practical shields, OS-aware setup, and local profile encryption where your system supports it.</p>
                </section>
                <div className="search-stack">
                    <form onSubmit={handleSearch} className="search-container">
                        <div className="search-engine-preview">{getEngineIcon()}</div>
                        <input type="text" placeholder="Ask DuckDuckGo or enter a URL" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" autoFocus />
                        <button type="submit" className="search-submit" aria-label="Search or navigate"><Search size={18} /></button>
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
                    <div><KeyRound size={16} /><span>{encryption?.available ? 'OS encryption ready' : 'Encryption check needed'}</span></div>
                    <div><MessageSquare size={16} /><span>WhatsApp profile</span></div>
                    <div><Globe2 size={16} /><span>{osProfile?.desktopHint ? `${osProfile.desktopHint} aware` : 'OS aware'}</span></div>
                </div>
                <div className="speed-dial">
                    {speedDialLinks.map((link) => {
                        const IconComponent = link.icon;
                        return <button key={link.label} onClick={() => window.electronAPI?.navigateTo?.(link.url)} className="speed-dial-item"><div className="speed-dial-icon"><IconComponent size={22} /></div><span className="speed-dial-label">{link.label}</span></button>;
                    })}
                </div>
            </div>
            <div className="home-footer">
                <span>Hoo Browser Foundation</span>
                <span>{osProfile?.packagingTarget ? `Target package: ${osProfile.packagingTarget}` : 'Real browser hardening in progress'}</span>
            </div>
        </div>
    );
};

export default Home;
