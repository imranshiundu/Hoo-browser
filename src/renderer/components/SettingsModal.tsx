import React from 'react';
import './SettingsModal.css';
import { X, Shield, Download, RotateCw, Trash2 } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [adShield, setAdShield] = React.useState(true);
    const [fingerprintCloak, setFingerprintCloak] = React.useState(true);
    const [forceHttps, setForceHttps] = React.useState(true);
    const [retention, setRetention] = React.useState('forever');
    const [updateState, setUpdateState] = React.useState<{ status: string; message: string } | null>(null);

    React.useEffect(() => {
        const loadSettings = async () => {
            const data = await window.electronAPI?.getInitialData?.();
            const settings = data?.settings;
            if (!settings) return;
            setAdShield(!!settings.adShield);
            setFingerprintCloak(!!settings.fingerprintCloak);
            setForceHttps(settings.forceHttps ?? true);
            setRetention(settings.dataRetention || 'forever');
        };
        if (isOpen) loadSettings();
    }, [isOpen]);

    const updatePrivacy = (next: Record<string, unknown>) => {
        window.electronAPI?.updatePrivacySettings?.(next);
    };

    const checkForUpdates = async () => {
        setUpdateState({ status: 'checking', message: 'Checking GitHub for Hoo Browser updates…' });
        try {
            const result = await window.electronAPI?.runUpdater?.();
            if (!result) {
                setUpdateState({ status: 'failed', message: 'Updater is not available in this build yet.' });
                return;
            }
            setUpdateState({ status: result.success ? 'success' : 'failed', message: result.message || result.output || 'Update command finished.' });
        } catch (error: any) {
            setUpdateState({ status: 'failed', message: error?.message || 'Update failed.' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <header className="settings-header">
                    <div>
                        <h2>Settings</h2>
                        <p>Hoo Browser basics</p>
                    </div>
                    <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
                </header>

                <div className="settings-list">
                    <section className="settings-section">
                        <h3>Privacy</h3>
                        <label className="setting-row">
                            <span><Shield size={18} /> Block ads and trackers</span>
                            <input type="checkbox" checked={adShield} onChange={(e) => { setAdShield(e.target.checked); updatePrivacy({ adShield: e.target.checked }); }} />
                        </label>
                        <label className="setting-row">
                            <span><Shield size={18} /> Reduce fingerprinting</span>
                            <input type="checkbox" checked={fingerprintCloak} onChange={(e) => { setFingerprintCloak(e.target.checked); updatePrivacy({ fingerprintCloak: e.target.checked }); }} />
                        </label>
                        <label className="setting-row">
                            <span><Shield size={18} /> Prefer HTTPS</span>
                            <input type="checkbox" checked={forceHttps} onChange={(e) => { setForceHttps(e.target.checked); updatePrivacy({ forceHttps: e.target.checked }); }} />
                        </label>
                    </section>

                    <section className="settings-section">
                        <h3>Data</h3>
                        <label className="setting-row">
                            <span>History retention</span>
                            <select value={retention} onChange={(e) => { setRetention(e.target.value); updatePrivacy({ dataRetention: e.target.value }); }}>
                                <option value="forever">Forever</option>
                                <option value="30d">30 days</option>
                                <option value="7d">7 days</option>
                                <option value="1d">24 hours</option>
                            </select>
                        </label>
                        <button className="danger-button" onClick={() => {
                            if (confirm('Delete all Hoo Browser data? This cannot be undone.')) window.electronAPI?.nuclearWipe?.();
                        }}>
                            <Trash2 size={16} /> Clear all browser data
                        </button>
                    </section>

                    <section className="settings-section">
                        <h3>Updates</h3>
                        <button className="primary-button" onClick={checkForUpdates}>
                            <RotateCw size={16} /> Check for updates
                        </button>
                        {updateState && <p className={`update-message ${updateState.status}`}>{updateState.message}</p>}
                    </section>

                    <section className="settings-section muted-section">
                        <h3>Downloads</h3>
                        <p><Download size={16} /> Download manager is planned next. Current downloads still use Electron/Chromium defaults.</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
