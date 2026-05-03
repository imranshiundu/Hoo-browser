import React from 'react';
import './SettingsModal.css';
import { X, Shield, Download, RotateCw, Trash2, Wifi, PlayCircle, Type, Cookie, History, Brain, Lock } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type UpdateState = {
    status: 'idle' | 'checking' | 'success' | 'failed';
    message: string;
    details?: string;
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [adShield, setAdShield] = React.useState(true);
    const [fingerprintCloak, setFingerprintCloak] = React.useState(true);
    const [forceHttps, setForceHttps] = React.useState(true);
    const [lowDataMode, setLowDataMode] = React.useState(false);
    const [blockThirdPartyFonts, setBlockThirdPartyFonts] = React.useState(false);
    const [blockAutoplayMedia, setBlockAutoplayMedia] = React.useState(false);
    const [deepSpoof, setDeepSpoof] = React.useState(true);
    const [retention, setRetention] = React.useState<PrivacySettings['dataRetention']>('forever');
    const [updateState, setUpdateState] = React.useState<UpdateState | null>(null);

    React.useEffect(() => {
        const loadSettings = async (): Promise<void> => {
            const data = await window.electronAPI?.getInitialData?.();
            const settings = data?.settings;
            if (!settings) return;
            setAdShield(!!settings.adShield);
            setFingerprintCloak(!!settings.fingerprintCloak);
            setForceHttps(settings.forceHttps ?? true);
            setLowDataMode(!!settings.lowDataMode);
            setBlockThirdPartyFonts(!!settings.blockThirdPartyFonts);
            setBlockAutoplayMedia(!!settings.blockAutoplayMedia);
            setDeepSpoof(settings.deepSpoof ?? true);
            setRetention(settings.dataRetention || 'forever');
        };
        if (isOpen) void loadSettings();
    }, [isOpen]);

    const updatePrivacy = (next: PrivacySettings): void => {
        void window.electronAPI?.updatePrivacySettings?.(next);
    };

    const checkForUpdates = async (): Promise<void> => {
        setUpdateState({ status: 'checking', message: 'Checking GitHub for Hoo Browser updates…' });
        try {
            const result = await window.electronAPI?.checkForUpdates?.();
            if (!result) {
                setUpdateState({ status: 'failed', message: 'Updater is not available in this build yet.' });
                return;
            }
            setUpdateState({
                status: result.ok ? 'success' : 'failed',
                message: result.message || 'Update command finished.',
                details: result.details
            });
        } catch (error: unknown) {
            setUpdateState({ status: 'failed', message: error instanceof Error ? error.message : 'Update failed.' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <header className="settings-header">
                    <div>
                        <h2>Settings</h2>
                        <p>Privacy, performance, updates, and browser behavior</p>
                    </div>
                    <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
                </header>

                <div className="settings-list">
                    <section className="settings-section">
                        <h3>Privacy shields</h3>
                        <label className="setting-row">
                            <span><Shield size={18} /> Block ads and trackers</span>
                            <input type="checkbox" checked={adShield} onChange={(e) => { setAdShield(e.target.checked); updatePrivacy({ adShield: e.target.checked }); }} />
                        </label>
                        <label className="setting-row">
                            <span><Brain size={18} /> Reduce fingerprinting</span>
                            <input type="checkbox" checked={fingerprintCloak} onChange={(e) => { setFingerprintCloak(e.target.checked); updatePrivacy({ fingerprintCloak: e.target.checked }); }} />
                        </label>
                        <label className="setting-row">
                            <span><Lock size={18} /> Prefer HTTPS</span>
                            <input type="checkbox" checked={forceHttps} onChange={(e) => { setForceHttps(e.target.checked); updatePrivacy({ forceHttps: e.target.checked }); }} />
                        </label>
                        <label className="setting-row">
                            <span><Cookie size={18} /> Strip third-party cookies</span>
                            <input type="checkbox" checked={adShield} onChange={(e) => { setAdShield(e.target.checked); updatePrivacy({ adShield: e.target.checked }); }} />
                        </label>
                    </section>

                    <section className="settings-section">
                        <h3>Performance</h3>
                        <label className="setting-row">
                            <span><Wifi size={18} /> Low data mode</span>
                            <input type="checkbox" checked={lowDataMode} onChange={(e) => { setLowDataMode(e.target.checked); updatePrivacy({ lowDataMode: e.target.checked }); }} />
                        </label>
                        <label className="setting-row">
                            <span><Type size={18} /> Block third-party fonts</span>
                            <input type="checkbox" checked={blockThirdPartyFonts} onChange={(e) => { setBlockThirdPartyFonts(e.target.checked); updatePrivacy({ blockThirdPartyFonts: e.target.checked }); }} />
                        </label>
                        <label className="setting-row">
                            <span><PlayCircle size={18} /> Block autoplay media</span>
                            <input type="checkbox" checked={blockAutoplayMedia} onChange={(e) => { setBlockAutoplayMedia(e.target.checked); updatePrivacy({ blockAutoplayMedia: e.target.checked }); }} />
                        </label>
                    </section>

                    <section className="settings-section">
                        <h3>Site compatibility</h3>
                        <label className="setting-row">
                            <span><Shield size={18} /> WhatsApp desktop compatibility mode</span>
                            <input type="checkbox" checked={deepSpoof} onChange={(e) => { setDeepSpoof(e.target.checked); updatePrivacy({ deepSpoof: e.target.checked }); }} />
                        </label>
                    </section>

                    <section className="settings-section">
                        <h3>Data</h3>
                        <label className="setting-row">
                            <span><History size={18} /> History retention</span>
                            <select value={retention} onChange={(e) => { const value = e.target.value as PrivacySettings['dataRetention']; setRetention(value); updatePrivacy({ dataRetention: value }); }}>
                                <option value="forever">Forever</option>
                                <option value="30d">30 days</option>
                                <option value="7d">7 days</option>
                                <option value="1d">24 hours</option>
                            </select>
                        </label>
                        <button className="danger-button" onClick={() => {
                            if (confirm('Delete all Hoo Browser data? This cannot be undone.')) void window.electronAPI?.nuclearWipe?.();
                        }}>
                            <Trash2 size={16} /> Clear all browser data
                        </button>
                    </section>

                    <section className="settings-section">
                        <h3>Updates</h3>
                        <button className="primary-button" onClick={() => void checkForUpdates()} disabled={updateState?.status === 'checking'}>
                            <RotateCw size={16} /> {updateState?.status === 'checking' ? 'Checking…' : 'Check for updates'}
                        </button>
                        {updateState && (
                            <div className={`update-message ${updateState.status}`}>
                                <p>{updateState.message}</p>
                                {updateState.details && <pre>{updateState.details}</pre>}
                            </div>
                        )}
                    </section>

                    <section className="settings-section muted-section">
                        <h3>Downloads</h3>
                        <p><Download size={16} /> Download manager button is now in the toolbar. A full downloads page comes after navigation stability.</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
