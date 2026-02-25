import React from 'react';
import './AppHeader.css';
import { ArrowLeft, RotateCw, X, Maximize2 } from 'lucide-react';

interface AppHeaderProps {
    name: string;
    onBack: () => void;
    onReload: () => void;
    onClose: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ name, onBack, onReload, onClose }) => {
    return (
        <div className="app-header-bar">
            <div className="app-header-left">
                <span className="app-header-title">{name}</span>
            </div>
            <div className="app-header-actions">
                <button className="app-header-btn" onClick={onBack} title="Back">
                    <ArrowLeft size={14} />
                </button>
                <button className="app-header-btn" onClick={onReload} title="Reload">
                    <RotateCw size={14} />
                </button>
                <div className="app-header-divider"></div>
                <button className="app-header-btn close" onClick={onClose} title="Close App">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default AppHeader;
