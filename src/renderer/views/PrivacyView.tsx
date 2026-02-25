import React, { useState, useEffect } from 'react';
import './PrivacyView.css';
import { Shield, Lock, EyeOff, Fingerprint, Activity, CheckCircle2, XCircle, Zap } from 'lucide-react';

interface PrivacySettings {
    adShield: boolean;
    scriptFortress: boolean;
    fingerprintCloak: boolean;
    forceHttps: boolean;
    deepSpoof: boolean;
    dataRetention: string;
}

const PrivacyView: React.FC = () => {
    const [settings, setSettings] = useState<PrivacySettings>({
        adShield: true,
        scriptFortress: false,
        fingerprintCloak: true,
        forceHttps: true,
        deepSpoof: true,
        dataRetention: 'forever'
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (window.electronAPI?.getInitialData) {
                const data = await window.electronAPI.getInitialData();
                if (data.settings) setSettings(s => ({ ...s, ...data.settings }));
            }
        };
        load();
    }, []);

    const toggle = async (key: keyof PrivacySettings) => {
        const newVal = !settings[key];
        const updated = { ...settings, [key]: newVal };
        setSettings(updated);
        await window.electronAPI?.updatePrivacySettings?.({ [key]: newVal });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const modules = [
        {
            key: 'adShield' as keyof PrivacySettings,
            icon: Shield,
            title: 'Ad & Tracker Shield',
            description: 'Blocks ads, analytics trackers, and cross-site data collectors at the network level before they load. Uses a curated host blocklist updated regularly.',
            color: '#22c55e'
        },
        {
            key: 'fingerprintCloak' as keyof PrivacySettings,
            icon: Fingerprint,
            title: 'Fingerprint Cloak',
            description: 'Randomizes your browser fingerprint on every request — User-Agent, platform, renderer info — so advertising networks cannot build a profile of you.',
            color: '#3b82f6'
        },
        {
            key: 'forceHttps' as keyof PrivacySettings,
            icon: Lock,
            title: 'Force HTTPS',
            description: 'Automatically upgrades all HTTP requests to HTTPS. If a site does not support HTTPS, it will fail rather than send your data in cleartext.',
            color: '#a855f7'
        },
        {
            key: 'scriptFortress' as keyof PrivacySettings,
            icon: Activity,
            title: 'Script Fortress',
            description: 'Blocks inline and third-party JavaScript from executing. This is a strong protection against malicious scripts and zero-day browser exploits. Warning: may break some sites.',
            color: '#f59e0b'
        },
        {
            key: 'deepSpoof' as keyof PrivacySettings,
            icon: Zap,
            title: 'WhatsApp Windows Spoof',
            description: 'Convinces WhatsApp Web that you are on Windows by overriding the User-Agent and navigator.platform on whatsapp.com. This unlocks video calls and voice calls for Linux users.',
            color: '#25d366'
        },
    ];

    const activeCount = modules.filter(m => settings[m.key]).length;

    return (
        <div className="privacy-view">
            <div className="privacy-hero">
                <div className="shield-container">
                    <Shield size={80} className="giant-shield" />
                    <div className="shield-glow" />
                </div>
                <h1 className="privacy-title">Privacy Control Centre</h1>
                <p className="privacy-description">
                    {activeCount} of {modules.length} shields active.
                    {saved && <span className="saved-badge"> Saved.</span>}
                </p>
                <div className={`security-badge ${activeCount === modules.length ? '' : 'partial'}`}>
                    {activeCount === modules.length
                        ? <><CheckCircle2 size={14} /> FULLY HARDENED</>
                        : <><XCircle size={14} /> PARTIAL PROTECTION</>
                    }
                </div>
            </div>

            <div className="privacy-modules">
                {modules.map(mod => (
                    <div key={mod.key} className={`privacy-module ${settings[mod.key] ? 'on' : 'off'}`}>
                        <div className="mod-icon" style={{ color: mod.color }}>
                            <mod.icon size={22} />
                        </div>
                        <div className="mod-info">
                            <div className="mod-title-row">
                                <span className="mod-title">{mod.title}</span>
                                <span className={`mod-status ${settings[mod.key] ? 'active' : 'inactive'}`}>
                                    {settings[mod.key] ? 'ON' : 'OFF'}
                                </span>
                            </div>
                            <p className="mod-description">{mod.description}</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={!!settings[mod.key]}
                                onChange={() => toggle(mod.key)}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                ))}

                <div className="privacy-module retention-module">
                    <div className="mod-icon" style={{ color: '#64748b' }}>
                        <EyeOff size={22} />
                    </div>
                    <div className="mod-info">
                        <div className="mod-title-row">
                            <span className="mod-title">History Retention</span>
                        </div>
                        <p className="mod-description">How long browsing history is stored locally. "Forever" keeps it until you wipe manually.</p>
                    </div>
                    <select
                        className="retention-select"
                        value={settings.dataRetention}
                        onChange={async e => {
                            setSettings(s => ({ ...s, dataRetention: e.target.value }));
                            await window.electronAPI?.updatePrivacySettings?.({ dataRetention: e.target.value as any });
                        }}
                    >
                        <option value="forever">Forever</option>
                        <option value="30d">30 days</option>
                        <option value="7d">7 days</option>
                        <option value="1d">24 hours</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default PrivacyView;
