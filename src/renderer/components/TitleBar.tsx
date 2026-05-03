import React from 'react';
import './TitleBar.css';
import { Minus, Square, X, RefreshCw } from 'lucide-react';
import logo from '../assets/branding/hoo-app-icon.svg';

const TitleBar: React.FC = () => {
    const handleMinimize = () => window.electronAPI?.minimize();
    const handleMaximize = () => window.electronAPI?.maximize();
    const handleClose = () => window.electronAPI?.close();
    const handleReload = () => window.electronAPI?.reloadApp();

    return (
        <div className="title-bar">
            <div className="title-bar-drag">
                <img src={logo} alt="" className="logo-mini" style={{ width: 14, height: 14, marginRight: 8 }} />
                <span className="title-bar-text">HOO BROWSER</span>
            </div>
            <div className="window-controls">
                <button className="control-btn refresh" onClick={handleReload} title="Reload Hoo UI">
                    <RefreshCw size={14} />
                </button>
                <button className="control-btn minimize" onClick={handleMinimize} title="Minimize">
                    <Minus size={14} />
                </button>
                <button className="control-btn maximize" onClick={handleMaximize} title="Maximize">
                    <Square size={12} />
                </button>
                <button className="control-btn close" onClick={handleClose} title="Close">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
