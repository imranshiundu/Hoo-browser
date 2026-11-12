import React from 'react';
import './SettingsModal.css';
import { X, Shield, Download, RotateCw, Trash2, Wifi, PlayCircle, Type, Cookie, History, Brain, Lock, CheckCircle2, AlertTriangle, Zap, RefreshCw, Camera, Eye } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type UpdateState = {
    status: 'idle' | 'checking' | 'success' | 'failed';
    message: string;
    details?: string;
};

interface SitePermissionRow {
    key: string;
    origin: string;
    permission: string;
    decision: 'allow' | 'block';
}

const PERMISSION_LABELS: Record<string, string> = {
    'media': 'Camera & microphone',
    'geolocation': 'Location',
    'notifications': 'Notifications',
    'clipboard-sanitized-read': 'Clipboard read',
    'midi': 'MIDI devices',
    'pointerLock': 'Mouse lock',
    'fullscreen': 'Fullscreen',
    'display-capture': 'Screen capture'
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
    const [updateChannel, setUpdateChannel] = React.useState<'electron-updater' | 'git-source' | 'none'>('none');
    const [autoStatus, setAutoStatus] = React.useState<AppUpdateStatus | null>(null);
    const [sitePermissions, setSitePermissions] = React.useState<SitePermissionRow[]>([]);
    const [siteZoomCount, setSiteZoomCount] = React.useState(0);

    // The updater pushes live status for the lifetime of the app: subscribe once
    // so background download progress is captured even while this modal is closed.
    React.useEffect(() => {
        void window.electronAPI?.getUpdateChannel?.()
            .then(info => { if (info) setUpdateChannel(info.channel); })
            .catch(() => { /* channel stays 'none' */ });
        window.electronAPI?.onAppUpdateStatus?.(status => setAutoStatus(status));
    }, []);

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
        const loadSiteData = async (): Promise<void> => {
            try { setSitePermissions(await window.electronAPI?.getSitePermissions?.() || []); } catch { setSitePermissions([]); }
            try {
                const zooms = await window.electronAPI?.getSiteZooms?.() || {};
                setSiteZoomCount(Object.keys(zooms).length);
            } catch { setSiteZoomCount(0); }
        };
        if (isOpen) {
            void loadSettings();
            void loadSiteData();
        }
    }, [isOpen]);

    const forgetPermission = (key: string): void => {
        void window.electronAPI?.clearSitePermissions?.(key);
        setSitePermissions(prev => prev.filter(row => row.key !== key));
    };

    const resetZoomLevels = (): void => {
        void window.electronAPI?.clearSiteZooms?.();
        setSiteZoomCount(0);
    };

    const updatePrivacy = (next: PrivacySettings): void => {
        void window.electronAPI?.updatePrivacySettings?.(next);
    };

    const checkForUpdates = async (): Promise<void> => {
        setUpdateState({
            status: 'checking',
            message: updateChannel === 'git-source'
                ? 'Checking GitHub… pulling only what changed.'
                : 'Checking GitHub Releases…'
        });
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

    // Packaged builds use electron-updater's quitAndInstall; source checkouts
    // relaunch into the freshly pulled build. Both live behind one IPC call.
    const restartToUpdate = (): void => {
        void window.electronAPI?.installAppUpdate?.();
    };

    const sourceUpdateReady = updateState?.status === 'success' && updateState.message.toLowerCase().includes('restart');
    const autoReady = autoStatus?.phase === 'downloaded';

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
                        <h3>Site permissions</h3>
                        <p className="section-hint">Sites you allowed or blocked through the toolbar prompt. Forgetting a decision makes the site ask again.</p>
                        {sitePermissions.length === 0 ? (
                            <p className="section-empty">No saved site decisions yet.</p>
                        ) : (
                            <div className="permission-list">
                                {sitePermissions.map(row => (
                                    <div key={row.key} className={`permission-row ${row.decision}`}>
                                        <Camera size={13} />
                                        <span className="permission-origin" title={row.origin}>{row.origin.replace(/^https?:\/\//, '')}</span>
                                        <span className="permission-what">{PERMISSION_LABELS[row.permission] || row.permission}</span>
                                        <span className="permission-state">{row.decision === 'allow' ? 'Allowed' : 'Blocked'}</span>
                                        <button onClick={() => forgetPermission(row.key)} title="Forget this decision"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {sitePermissions.length > 0 && (
                            <button className="secondary-button" onClick={() => { void window.electronAPI?.clearSitePermissions?.(); setSitePermissions([]); }}>
                                <Trash2 size={14} /> Forget all site decisions
                            </button>
                        )}
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
                        <button className="secondary-button" onClick={resetZoomLevels} disabled={siteZoomCount === 0}>
                            <Eye size={14} /> Reset site zoom levels{siteZoomCount > 0 ? ` (${siteZoomCount} sites)` : ''}
                        </button>
                        <button className="danger-button" onClick={() => {
                            if (confirm('Delete all Hoo Browser data? This cannot be undone.')) void window.electronAPI?.nuclearWipe?.();
                        }}>
                            <Trash2 size={16} /> Clear all browser data
                        </button>
                    </section>

                    <section className="settings-section update-section">
                        <h3>Updates</h3>
                        {updateChannel === 'electron-updater' && (
                            <>
                                <div className="update-card">
                                    <div className="update-card-copy">
                                        <strong>Automatic updates</strong>
                                        <span>Hoo checks GitHub Releases when it starts and downloads new versions in the background. Restart once to switch over.</span>
                                    </div>
                                    <button className="primary-button update-button" onClick={() => void checkForUpdates()} disabled={updateState?.status === 'checking'}>
                                        {updateState?.status === 'checking' ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
                                        {updateState?.status === 'checking' ? 'Checking…' : 'Check for updates'}
                                    </button>
                                </div>
                                {autoStatus && autoStatus.phase !== 'idle' && (
                                    <div className={`update-message ${autoStatus.phase === 'error' ? 'failed' : autoStatus.phase === 'current' ? 'success' : 'checking'}`}>
                                        <div className="update-status-line">
                                            {autoStatus.phase === 'downloaded' || autoStatus.phase === 'current'
                                                ? <CheckCircle2 size={16} />
                                                : autoStatus.phase === 'error'
                                                    ? <AlertTriangle size={16} />
                                                    : <RefreshCw size={16} className="spin" />}
                                            <p>{autoStatus.message}</p>
                                        </div>
                                        {autoStatus.phase === 'downloading' && typeof autoStatus.percent === 'number' && (
                                            <div className="update-progress" role="progressbar" aria-valuenow={Math.round(autoStatus.percent)} aria-valuemin={0} aria-valuemax={100}>
                                                <div className="update-progress-fill" style={{ width: `${Math.min(100, Math.max(0, autoStatus.percent))}%` }} />
                                            </div>
                                        )}
                                        {autoReady && (
                                            <button className="primary-button" onClick={restartToUpdate}>
                                                <RotateCw size={14} /> Restart to update
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                        {updateChannel === 'git-source' && (
                            <div className="update-card">
                                <div className="update-card-copy">
                                    <strong>Fast GitHub updater</strong>
                                    <span>Pulls changes, skips dependency install when package files did not change, then rebuilds only when needed.</span>
                                </div>
                                <button className="primary-button update-button" onClick={() => void checkForUpdates()} disabled={updateState?.status === 'checking'}>
                                    {updateState?.status === 'checking' ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
                                    {updateState?.status === 'checking' ? 'Updating…' : 'Update now'}
                                </button>
                            </div>
                        )}
                        {updateChannel === 'none' && (
                            <div className="update-card">
                                <div className="update-card-copy">
                                    <strong>Manual updates</strong>
                                    <span>This copy cannot self-update. Get the latest installer from GitHub Releases and Hoo will pick it up from there.</span>
                                </div>
                                <button className="secondary-button update-button" onClick={() => void window.electronAPI?.navigateTo?.('https://github.com/imranshiundu/Hoo-browser/releases')}>
                                    <Download size={16} /> Open releases
                                </button>
                            </div>
                        )}
                        {updateState && (
                            <div className={`update-message ${updateState.status}`}>
                                <div className="update-status-line">
                                    {updateState.status === 'success' ? <CheckCircle2 size={16} /> : updateState.status === 'failed' ? <AlertTriangle size={16} /> : <RefreshCw size={16} className="spin" />}
                                    <p>{updateState.message}</p>
                                </div>
                                {(sourceUpdateReady || autoReady) && (
                                    <button className="secondary-button" onClick={restartToUpdate}>Restart to update</button>
                                )}
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
