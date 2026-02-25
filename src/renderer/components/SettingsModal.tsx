import React from 'react';
import './SettingsModal.css';
import { X, Shield, Code, Fingerprint, Cpu, Lock, Globe } from 'lucide-react';

interface SettingsModule {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    enabled: boolean;
    badge?: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [modules, setModules] = React.useState<SettingsModule[]>([
        {
            id: 'ad-shield',
            icon: <Shield size={20} />,
            title: 'Ad Shield',
            description: 'Block intrusive ads and trackers across all sites.',
            enabled: true,
        },
        {
            id: 'script-fortress',
            icon: <Code size={20} />,
            title: 'Script Fortress',
            description: 'Prevent unauthorized JavaScript execution.',
            enabled: false,
        },
        {
            id: 'fingerprint-cloak',
            icon: <Fingerprint size={20} />,
            title: 'Fingerprint Cloak',
            description: 'Randomize browser signature to prevent profiling.',
            enabled: true,
        },
        {
            id: 'local-ai',
            icon: <Cpu size={20} />,
            title: 'Local AI Assistant',
            description: 'Enable on-device LLM for page summarization. No data leaves your machine.',
            enabled: true,
            badge: 'BETA',
        },
        {
            id: 'deep-spoof',
            icon: <Globe size={20} />,
            title: 'Experimental: Deep Spoof',
            description: 'Trick sites like WhatsApp into thinking you are on Windows to unlock restricted features like video calls.',
            enabled: true,
            badge: 'BETA',
        },
    ]);
    const [retention, setRetention] = React.useState<string>('forever');
    const [megaEmail, setMegaEmail] = React.useState('');
    const [megaPass, setMegaPass] = React.useState('');
    const [isMegaLoggedIn, setIsMegaLoggedIn] = React.useState(false);

    React.useEffect(() => {
        const loadSettings = async () => {
            if (window.electronAPI?.getInitialData) {
                const data = await window.electronAPI.getInitialData();
                const s = data.settings;
                setRetention(s.dataRetention || 'forever');

                // Sync module states
                setModules(prev => prev.map(m => {
                    if (m.id === 'ad-shield') return { ...m, enabled: !!s.adShield };
                    if (m.id === 'script-fortress') return { ...m, enabled: !!s.scriptFortress };
                    if (m.id === 'fingerprint-cloak') return { ...m, enabled: !!s.fingerprintCloak };
                    if (m.id === 'force-https') return { ...m, enabled: !!s.forceHttps };
                    if (m.id === 'deep-spoof') return { ...m, enabled: s.deepSpoof ?? true };
                    return m;
                }));
            }
        };
        if (isOpen) loadSettings();
    }, [isOpen]);

    const toggleModule = (id: string) => {
        const newModules = modules.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m);
        setModules(newModules);

        // Map UI module IDs to privacy settings
        const settingsMap: Record<string, string> = {
            'ad-shield': 'adShield',
            'script-fortress': 'scriptFortress',
            'fingerprint-cloak': 'fingerprintCloak',
            'force-https': 'forceHttps',
            'deep-spoof': 'deepSpoof',
        };

        // Send updated settings to main process
        if (window.electronAPI?.updatePrivacySettings && settingsMap[id]) {
            const module = newModules.find(m => m.id === id);
            if (module) {
                const settings = {
                    [settingsMap[id]]: module.enabled
                };
                window.electronAPI.updatePrivacySettings(settings).then(() => {
                    console.log(`✅ Privacy: ${settingsMap[id]} = ${module.enabled}`);
                });
            }
        }
    };

    const resetToDefaults = () => {
        setModules(modules.map(m => ({
            ...m,
            enabled: m.id === 'ad-shield' || m.id === 'fingerprint-cloak' || m.id === 'local-ai' || m.id === 'force-https' || m.id === 'deep-spoof'
        })));

        // Reset all privacy settings in main process
        if (window.electronAPI?.updatePrivacySettings) {
            window.electronAPI.updatePrivacySettings({
                adShield: true,
                scriptFortress: false,
                fingerprintCloak: true,
                forceHttps: true,
                deepSpoof: true,
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="settings-header">
                    <div className="settings-header-left">
                        <Shield className="settings-header-icon" size={20} />
                        <div>
                            <h2 className="settings-title">Browser Modules</h2>
                            <p className="settings-status">
                                <span className="status-dot"></span>
                                SYSTEM SECURE
                            </p>
                        </div>
                    </div>
                    <div className="settings-header-right">
                        <button className="reset-btn" onClick={resetToDefaults}>
                            Reset to Defaults
                        </button>
                        <button className="close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Modules List */}
                <div className="settings-modules">
                    <div className="settings-section-title">Identity & Sync</div>
                    <div className="module-item user-profile">
                        <div className="module-icon profile-icon">
                            <Lock size={20} />
                        </div>
                        <div className="module-info">
                            <div className="module-title-row">
                                <h3 className="module-title">Mega.nz Cloud Sync</h3>
                                <span className={isMegaLoggedIn ? "module-badge status-online" : "module-badge status-offline"}>
                                    {isMegaLoggedIn ? "SYNCING 100%" : "NOT LOGGED IN"}
                                </span>
                            </div>
                            <p className="module-description">Log in with your MEGA account for encrypted full-profile sync.</p>
                            {!isMegaLoggedIn && (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={megaEmail}
                                        onChange={(e) => setMegaEmail(e.target.value)}
                                        style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={megaPass}
                                        onChange={(e) => setMegaPass(e.target.value)}
                                        style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            )}
                        </div>
                        {isMegaLoggedIn ? (
                            <button className="auth-btn" onClick={async () => {
                                await window.electronAPI?.megaLogout();
                                setIsMegaLoggedIn(false);
                            }}>Logout</button>
                        ) : (
                            <button className="auth-btn" onClick={async () => {
                                if (!megaEmail || !megaPass) return;
                                const success = await window.electronAPI?.megaLogin(megaEmail, megaPass);
                                if (success) {
                                    setIsMegaLoggedIn(true);
                                } else {
                                    alert('MEGA Login Failed');
                                }
                            }}>Login</button>
                        )}
                    </div>

                    <div className="settings-section-title">Data & Persistence</div>
                    <div className="module-item">
                        <div className="module-icon"><Cpu size={20} /></div>
                        <div className="module-info">
                            <h3 className="module-title">History Retention</h3>
                            <p className="module-description">Set how long your browsing history and tabs are saved locally.</p>
                        </div>
                        <select
                            className="settings-select"
                            value={retention}
                            onChange={(e) => {
                                setRetention(e.target.value);
                                if (window.electronAPI?.updatePrivacySettings) {
                                    window.electronAPI.updatePrivacySettings({ dataRetention: e.target.value as any });
                                }
                            }}
                        >
                            <option value="forever">Forever</option>
                            <option value="30d">30 Days</option>
                            <option value="7d">7 Days</option>
                            <option value="1d">24 Hours</option>
                        </select>
                    </div>

                    <div className="module-item">
                        <div className="module-icon"><Shield size={20} style={{ color: '#ef4444' }} /></div>
                        <div className="module-info">
                            <h3 className="module-title" style={{ color: '#ef4444' }}>Nuclear Kill-Switch</h3>
                            <p className="module-description">Permanently wipe all tabs, history, cookies, and local data. The app will restart wiped to defaults.</p>
                        </div>
                        <button
                            className="nuclear-btn"
                            onClick={() => {
                                if (confirm('☢️ WARNING: This will permanently delete ALL browser data, history, and settings. This cannot be undone. Proceed?')) {
                                    window.electronAPI?.nuclearWipe();
                                }
                            }}
                        >
                            Execute Wipe
                        </button>
                    </div>

                    <div className="settings-section-title">Security Modules</div>
                    {modules.map((module) => (
                        <div key={module.id} className="module-item">
                            <div className="module-icon">{module.icon}</div>
                            <div className="module-info">
                                <div className="module-title-row">
                                    <h3 className="module-title">{module.title}</h3>
                                    {module.badge && <span className="module-badge">{module.badge}</span>}
                                </div>
                                <p className="module-description">{module.description}</p>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={module.enabled}
                                    onChange={() => toggleModule(module.id)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="settings-footer">
                    <p className="settings-footer-text">Changes apply immediately</p>
                    <button className="done-btn" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
