import React, { useState, useEffect } from 'react';
import './NavigationBar.css';
import { ArrowLeft, ArrowRight, RotateCw, Shield, Lock, Globe, Search } from 'lucide-react';

interface NavigationBarProps {
    tabId: string;
    url: string;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
    tabId,
    url,
    onNavigate,
    onBack,
    onForward,
    onReload
}) => {
    const [inputValue, setInputValue] = useState(url);

    useEffect(() => {
        setInputValue(url);
    }, [url]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let target = inputValue.trim();
        if (target) {
            // Search shortcuts
            if (target.startsWith('!w ')) {
                target = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(target.substring(3))}`;
            } else if (target.startsWith('!y ')) {
                target = `https://www.youtube.com/results?search_query=${encodeURIComponent(target.substring(3))}`;
            } else if (target.startsWith('!g ')) {
                target = `https://www.google.com/search?q=${encodeURIComponent(target.substring(3))}`;
            } else if (target.startsWith('!d ')) {
                target = `https://duckduckgo.com/?q=${encodeURIComponent(target.substring(3))}`;
            } else {
                // URL detection
                const isUrl = target.includes('.') && !target.includes(' ') && (target.startsWith('http') || target.split('/')[0].includes('.'));
                if (!isUrl) {
                    // Fallback to Google Search
                    target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
                } else if (!target.startsWith('http')) {
                    target = `https://${target}`;
                }
            }

            onNavigate(target);
        }
    };

    return (
        <div className="navigation-bar">
            <div className="nav-controls">
                <button className="nav-btn" onClick={onBack} title="Back">
                    <ArrowLeft size={16} />
                </button>
                <button className="nav-btn" onClick={onForward} title="Forward">
                    <ArrowRight size={16} />
                </button>
                <button className="nav-btn" onClick={onReload} title="Reload">
                    <RotateCw size={16} />
                </button>
            </div>

            <div className="address-bar-wrapper">
                <div className="security-indicator">
                    {url.startsWith('https') ? <Lock size={12} className="lock-icon" /> : <Globe size={12} />}
                </div>
                <form onSubmit={handleSubmit} className="address-form">
                    <input
                        type="text"
                        className="address-input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="Search or enter URL"
                    />
                </form>
                <div className="zen-shield-indicator" title="Shields Active">
                    <Shield size={14} />
                    <span className="shield-count">12</span>
                </div>
            </div>

            <div className="nav-right-actions">
                <div className="user-mode-badge">PRIVATE</div>
            </div>
        </div>
    );
};

export default NavigationBar;
