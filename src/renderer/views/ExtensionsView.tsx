import React from 'react';
import './ExtensionsView.css';
import { Puzzle, Settings, Trash2, Power, Plus } from 'lucide-react';

const ExtensionsView: React.FC = () => {
    const extensions = [
        { id: 'brave-shields', name: 'Brave Shields Engine', version: 'Core v1', description: 'Aggressive ad-blocking and finger-print protection from the Brave DNA.', enabled: true },
        { id: 'firefox-containers', name: 'Firefox Containers', version: 'Core v1', description: 'Multi-account container isolation for tabs and apps.', enabled: true },
        { id: 'chrome-performance', name: 'V8 Speed Engine', version: 'Core v1', description: 'Enable high-performance Chrome flags and memory management.', enabled: true },
        { id: 'ad-shield', name: 'Ad Shield Pro', version: '2.4.1', description: 'Advanced network-level ad and tracker interception.', enabled: true },
        { id: 'zen-sync', name: 'Zen Sync', version: '0.9.0', description: 'End-to-end encrypted synchronization for your Pied Piper data.', enabled: true },
    ];

    return (
        <div className="extensions-view">
            <div className="view-header">
                <div className="header-left">
                    <Puzzle size={32} className="header-icon" />
                    <div>
                        <h1 className="view-title">Plugin Manager</h1>
                        <p className="view-subtitle">Enhance your privacy with modular components.</p>
                    </div>
                </div>
                <button className="add-extension-btn">
                    <Plus size={18} /> Get More
                </button>
            </div>

            <div className="extension-list">
                {extensions.map(ext => (
                    <div key={ext.id} className={`extension-card ${ext.enabled ? '' : 'disabled'}`}>
                        <div className="extension-main">
                            <div className="extension-icon">
                                <Puzzle size={24} />
                            </div>
                            <div className="extension-info">
                                <div className="extension-header-row">
                                    <h3 className="extension-name">{ext.name}</h3>
                                    <span className="extension-version">v{ext.version}</span>
                                </div>
                                <p className="extension-desc">{ext.description}</p>
                            </div>
                            <div className="extension-toggle">
                                <label className="ext-switch">
                                    <input type="checkbox" checked={ext.enabled} readOnly />
                                    <span className="ext-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div className="extension-actions">
                            <button className="ext-action-btn"><Settings size={14} /> Options</button>
                            <button className="ext-action-btn delete"><Trash2 size={14} /> Remove</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExtensionsView;
