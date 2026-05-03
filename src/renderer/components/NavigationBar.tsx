import React, { useState, useEffect, useRef } from 'react';
import './NavigationBar.css';
import { ArrowLeft, ArrowRight, RotateCw, Lock, Globe, Settings } from 'lucide-react';

interface NavigationBarProps {
    tabId: string;
    url: string;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onOpenSettings?: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
    url,
    onNavigate,
    onBack,
    onForward,
    onReload,
    onOpenSettings
}) => {
    const [inputValue, setInputValue] = useState(url);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => setInputValue(url), [url]);

    useEffect(() => {
        const focusAddress = () => inputRef.current?.focus();
        document.addEventListener('hoo-focus-address', focusAddress);
        return () => document.removeEventListener('hoo-focus-address', focusAddress);
    }, []);

    const normalizeTarget = (value: string) => {
        let target = value.trim();
        if (!target) return '';
        if (target.startsWith('!w ')) return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(target.substring(3))}`;
        if (target.startsWith('!y ')) return `https://www.youtube.com/results?search_query=${encodeURIComponent(target.substring(3))}`;
        if (target.startsWith('!g ')) return `https://www.google.com/search?q=${encodeURIComponent(target.substring(3))}`;
        if (target.startsWith('!d ')) return `https://duckduckgo.com/?q=${encodeURIComponent(target.substring(3))}`;
        const isUrl = target.includes('.') && !target.includes(' ') && (target.startsWith('http') || target.split('/')[0].includes('.'));
        if (!isUrl) return `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
        if (!target.startsWith('http')) return `https://${target}`;
        return target;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const target = normalizeTarget(inputValue);
        if (target) onNavigate(target);
    };

    return (
        <div className="navigation-bar">
            <button className="nav-btn" onClick={onBack} title="Back"><ArrowLeft size={17} /></button>
            <button className="nav-btn" onClick={onForward} title="Forward"><ArrowRight size={17} /></button>
            <button className="nav-btn" onClick={onReload} title="Reload"><RotateCw size={16} /></button>

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

            <button className="nav-btn" onClick={onOpenSettings} title="Settings"><Settings size={17} /></button>
        </div>
    );
};

export default NavigationBar;
