import React, { useState, useEffect } from 'react';
import './PrivacyView.css';
import { Shield, Lock, EyeOff, Fingerprint, Activity, CheckCircle2, AlertTriangle, Zap, KeyRound, Database, RefreshCw, DownloadCloud, Gauge, WifiOff, Type, Film } from 'lucide-react';

interface PrivacySettings {
    adShield: boolean;
    scriptFortress: boolean;
    fingerprintCloak: boolean;
    forceHttps: boolean;
    deepSpoof: boolean;
    lowDataMode: boolean;
    blockThirdPartyFonts: boolean;
    blockAutoplayMedia: boolean;
    dataRetention: string;
}

const PrivacyView: React.FC = () => {
    const [settings, setSettings] = useState<PrivacySettings>({
        adShield: true,
        scriptFortress: false,
        fingerprintCloak: true,
        forceHttps: true,
        deepSpoof: true,
        lowDataMode: false,
        blockThirdPartyFonts: false,
        blockAutoplayMedia: false,
        dataRetention: 'forever'
    });
    const [saved, setSaved] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [updateResult, setUpdateResult] = useState<{ ok: boolean; status: string; message: string; details?: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            if (window.electronAPI?.getInitialData) {
                const data = await window.electronAPI.getInitialData();
                if (data.settings) setSettings(s => ({ ...s, ...data.settings }));
            }
        };
        load();
    }, []);

    const setPartialSettings = async (patch: Partial<PrivacySettings>) => {
        const updated = { ...settings, ...patch };
        setSettings(updated);
        await window.electronAPI?.updatePrivacySettings?.(patch as any);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const toggle = async (key: keyof PrivacySettings) => {
        await setPartialSettings({ [key]: !settings[key] } as Partial<PrivacySettings>);
    };

    const checkForUpdates = async () => {
        if (!window.electronAPI?.checkForUpdates || updating) return;
        setUpdating(true);
        setUpdateResult(null);
        try {
            const result = await window.electronAPI.checkForUpdates();
            setUpdateResult(result);
        } catch (error: any) {
            setUpdateResult({ ok: false, status: 'failed', message: error?.message || 'Hoo could not check for updates.' });
        } finally {
            setUpdating(false);
        }
    };

    const modules = [
        { key: 'adShield' as keyof PrivacySettings, icon: Shield, title: 'Ad & Tracker Shield', description: 'Blocks known ad and tracker hosts before they load. Current implementation is useful but still needs maintained filter-list support.', color: '#3DBB78' },
        { key: 'fingerprintCloak' as keyof PrivacySettings, icon: Fingerprint, title: 'Fingerprint Profile', description: 'Experimental identity masking. This must evolve into stable per-profile fingerprints; random per-request identities are not a finished privacy design.', color: '#8EB876' },
        { key: 'forceHttps' as keyof PrivacySettings, icon: Lock, title: 'HTTPS Upgrade', description: 'Attempts to upgrade insecure HTTP navigation to HTTPS where available. Some sites may still need fallback handling.', color: '#FF6A00' },
        { key: 'scriptFortress' as keyof PrivacySettings, icon: Activity, title: 'Script Fortress', description: 'Future strict mode for blocking risky scripts. Kept off by default because aggressive script blocking can break normal websites.', color: '#f59e0b' },
        { key: 'deepSpoof' as keyof PrivacySettings, icon: Zap, title: 'WhatsApp Linux Compatibility', description: 'Experimental WhatsApp Web profile behavior for Linux users. This is a compatibility feature, not a privacy shield.', color: '#25d366' },
    ];

    const activeCount = modules.filter(m => settings[m.key]).length;

    return (
        <div className="privacy-view">
            <div className="privacy-hero">
                <div className="shield-container"><Shield size={72} className="giant-shield" /><div className="shield-glow" /></div>
                <p className="eyebrow">Hoo control center</p>
                <h1 className="privacy-title">Protection, updates, and lightweight browser controls.</h1>
                <p className="privacy-description">{activeCount} of {modules.length} browser controls active.{saved && <span className="saved-badge"> Saved.</span>}</p>
                <div className="status-row">
                    <div className="security-badge partial"><AlertTriangle size={14} /> PROTOTYPE SHIELDS</div>
                    <div className="security-badge"><CheckCircle2 size={14} /> DUCKDUCKGO-FIRST</div>
                </div>
            </div>

            <div className="update-card">
                <div className="mod-icon update-icon"><DownloadCloud size={24} /></div>
                <div className="update-info">
                    <div className="mod-title-row"><span className="mod-title">Hoo Browser updates</span><span className={`mod-status ${updateResult?.ok ? 'active' : updateResult ? 'inactive' : 'active'}`}>{updating ? 'CHECKING' : updateResult?.status?.toUpperCase() || 'GITHUB'}</span></div>
                    <p className="mod-description">Press this anytime to fetch the latest Hoo Browser changes from GitHub, rebuild the app, and keep the installed browser current.</p>
                    {updateResult && <p className={`update-result ${updateResult.ok ? 'ok' : 'bad'}`}>{updateResult.message}{updateResult.details && <span>{updateResult.details}</span>}</p>}
                </div>
                <button className="update-button" type="button" onClick={checkForUpdates} disabled={updating}><RefreshCw size={16} className={updating ? 'spinning' : ''} />{updating ? 'Checking…' : 'Check for Updates'}</button>
            </div>

            <div className="update-card low-data-card">
                <div className="mod-icon low-data-icon"><Gauge size={24} /></div>
                <div className="update-info">
                    <div className="mod-title-row"><span className="mod-title">Low Data Mode</span><span className={`mod-status ${settings.lowDataMode ? 'active' : 'inactive'}`}>{settings.lowDataMode ? 'ON' : 'OFF'}</span></div>
                    <p className="mod-description">Keeps Hoo quieter by blocking optional heavy resources. This helps on hotspots, costly bundles, and slower connections.</p>
                    <div className="mini-toggle-row">
                        <button className={`mini-toggle ${settings.lowDataMode ? 'active' : ''}`} onClick={() => toggle('lowDataMode')}><WifiOff size={14} /> Low Data</button>
                        <button className={`mini-toggle ${settings.blockThirdPartyFonts ? 'active' : ''}`} onClick={() => toggle('blockThirdPartyFonts')} disabled={!settings.lowDataMode}><Type size={14} /> Fonts</button>
                        <button className={`mini-toggle ${settings.blockAutoplayMedia ? 'active' : ''}`} onClick={() => toggle('blockAutoplayMedia')} disabled={!settings.lowDataMode}><Film size={14} /> Heavy media</button>
                    </div>
                </div>
            </div>

            <div className="encryption-card">
                <div className="mod-icon encryption-icon"><KeyRound size={24} /></div>
                <div><div className="mod-title-row"><span className="mod-title">Local profile encryption</span><span className="mod-status active">OS-PROTECTED WHEN AVAILABLE</span></div><p className="mod-description">Hoo uses Electron safeStorage for local profile data when the operating system exposes encryption. Next step: show live encryption availability and add passphrase-protected backup export.</p></div>
            </div>

            <div className="privacy-modules">
                {modules.map(mod => (
                    <div key={mod.key} className={`privacy-module ${settings[mod.key] ? 'on' : 'off'}`}>
                        <div className="mod-icon" style={{ color: mod.color }}><mod.icon size={22} /></div>
                        <div className="mod-info"><div className="mod-title-row"><span className="mod-title">{mod.title}</span><span className={`mod-status ${settings[mod.key] ? 'active' : 'inactive'}`}>{settings[mod.key] ? 'ON' : 'OFF'}</span></div><p className="mod-description">{mod.description}</p></div>
                        <label className="toggle-switch"><input type="checkbox" checked={!!settings[mod.key]} onChange={() => toggle(mod.key)} /><span className="toggle-slider" /></label>
                    </div>
                ))}

                <div className="privacy-module retention-module">
                    <div className="mod-icon" style={{ color: '#94a3b8' }}><Database size={22} /></div>
                    <div className="mod-info"><div className="mod-title-row"><span className="mod-title">History Retention</span></div><p className="mod-description">How long browsing history is stored locally. Use shorter retention for a cleaner profile.</p></div>
                    <select className="retention-select" value={settings.dataRetention} onChange={async e => setPartialSettings({ dataRetention: e.target.value })}>
                        <option value="forever">Forever</option><option value="30d">30 days</option><option value="7d">7 days</option><option value="1d">24 hours</option>
                    </select>
                </div>

                <div className="privacy-note"><EyeOff size={16} /><span>Hoo should describe protection precisely. No fake anonymity claims, no inflated tracker counts, no hidden page sharing.</span></div>
            </div>
        </div>
    );
};

export default PrivacyView;
