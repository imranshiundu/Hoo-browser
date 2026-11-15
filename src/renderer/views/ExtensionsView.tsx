import React from 'react';
import './ExtensionsView.css';
import { Puzzle, Shield, Lock, Brain, Wifi, Type, PlayCircle, Sparkles, BookOpen, ExternalLink } from 'lucide-react';

interface PrivacySettingsLike {
    adShield?: boolean;
    fingerprintCloak?: boolean;
    forceHttps?: boolean;
    deepSpoof?: boolean;
    lowDataMode?: boolean;
    blockThirdPartyFonts?: boolean;
    blockAutoplayMedia?: boolean;
}

interface ModuleRow {
    key: keyof PrivacySettingsLike;
    name: string;
    description: string;
    icon: React.ReactNode;
    defaultOn: boolean;
}

// Hoo has no extension store on purpose: every privacy capability is part of
// the app itself and cannot be silently swapped by a third party. This page
// surfaces those built-ins as switchable modules bound to the SAME settings
// the Settings modal writes — one source of truth, no fake toggles.
const MODULES: ModuleRow[] = [
    {
        key: 'adShield',
        name: 'Ad & Tracker Shield',
        description: 'Blocks known ad and tracking hosts at the network layer before a request leaves the browser.',
        icon: <Shield size={22} />,
        defaultOn: true
    },
    {
        key: 'forceHttps',
        name: 'HTTPS Upgrade',
        description: 'Rewrites plain http:// navigations to https:// so credentials never travel unencrypted.',
        icon: <Lock size={22} />,
        defaultOn: true
    },
    {
        key: 'fingerprintCloak',
        name: 'Fingerprint Cloak',
        description: 'Reduces canvas, font and hardware signals that sites combine to identify your device.',
        icon: <Brain size={22} />,
        defaultOn: true
    },
    {
        key: 'deepSpoof',
        name: 'Site Compatibility Spoof',
        description: 'Presents a WhatsApp-desktop style user agent for stubborn sites that gate Electron browsers.',
        icon: <Sparkles size={22} />,
        defaultOn: true
    },
    {
        key: 'lowDataMode',
        name: 'Low Data Mode',
        description: 'Drops prefetch, beacons and heavy media requests when you are on a metered connection.',
        icon: <Wifi size={22} />,
        defaultOn: false
    },
    {
        key: 'blockThirdPartyFonts',
        name: 'Third-party Font Shield',
        description: 'Stops cross-site font requests, removing a quiet fingerprinting and tracking channel.',
        icon: <Type size={22} />,
        defaultOn: false
    },
    {
        key: 'blockAutoplayMedia',
        name: 'Autoplay Blocker',
        description: 'Keeps videos and audio from playing until you interact with the page.',
        icon: <PlayCircle size={22} />,
        defaultOn: false
    }
];

const ExtensionsView: React.FC = () => {
    const [settings, setSettings] = React.useState<PrivacySettingsLike | null>(null);

    React.useEffect(() => {
        const load = async (): Promise<void> => {
            try {
                const data = await window.electronAPI?.getInitialData?.();
                if (data?.settings) setSettings(data.settings as PrivacySettingsLike);
            } catch { /* fall back to defaults below */ }
        };
        void load();
    }, []);

    const toggleModule = (row: ModuleRow): void => {
        const current = settings?.[row.key] ?? row.defaultOn;
        const next = !current;
        setSettings(prev => ({ ...(prev || {}), [row.key]: next }));
        void window.electronAPI?.updatePrivacySettings?.({ [row.key]: next } as PrivacySettingsLike);
    };

    return (
        <div className="extensions-view">
            <div className="view-header">
                <div className="header-left">
                    <Puzzle size={32} className="header-icon" />
                    <div>
                        <h1 className="view-title">Modules &amp; Extensions</h1>
                        <p className="view-subtitle">Built into Hoo itself — no store, no third-party code, no silent swaps.</p>
                    </div>
                </div>
                <button
                    className="add-extension-btn"
                    onClick={() => window.electronAPI?.navigateTo?.('https://github.com/imranshiundu/Hoo-browser')}
                >
                    <ExternalLink size={16} /> Project home
                </button>
            </div>

            <div className="extension-list">
                {MODULES.map(row => {
                    const enabled = settings?.[row.key] ?? row.defaultOn;
                    return (
                        <div key={row.key} className={`extension-card ${enabled ? '' : 'disabled'}`}>
                            <div className="extension-main">
                                <div className="extension-icon">{row.icon}</div>
                                <div className="extension-info">
                                    <div className="extension-header-row">
                                        <h3 className="extension-name">{row.name}</h3>
                                        <span className="extension-version">built-in</span>
                                    </div>
                                    <p className="extension-desc">{row.description}</p>
                                </div>
                                <div className="extension-toggle">
                                    <label className="ext-switch">
                                        <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={() => toggleModule(row)}
                                            aria-label={row.name}
                                        />
                                        <span className="ext-slider" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="extensions-note">
                <BookOpen size={14} /> Need something the built-ins do not cover? Sites can be opened as isolated
                web apps from the tab menu — each with its own storage partition.
            </p>
        </div>
    );
};

export default ExtensionsView;
