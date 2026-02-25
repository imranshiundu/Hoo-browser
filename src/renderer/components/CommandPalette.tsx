import React, { useState, useEffect, useRef } from 'react';
import './CommandPalette.css';
import { Search, Globe, Command, X } from 'lucide-react';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (url: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.metaKey && e.key === 'k') { e.preventDefault(); onClose(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let target = query.trim();
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
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette-container" onClick={e => e.stopPropagation()}>
                <div className="command-palette-header">
                    <Search size={18} className="search-icon" />
                    <form onSubmit={handleSubmit} style={{ flex: 1 }}>
                        <input
                            ref={inputRef}
                            type="text"
                            className="command-input"
                            placeholder="Search or enter website..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </form>
                    <div className="command-palette-shortcut">
                        <Command size={12} /> ENTER
                    </div>
                </div>
                <div className="command-palette-results">
                    <div className="result-item hint">
                        <Globe size={14} />
                        <span>Type a URL or search query and press <strong>Enter</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
