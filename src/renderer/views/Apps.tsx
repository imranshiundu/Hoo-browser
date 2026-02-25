import React from 'react';
import './Apps.css';
import { LayoutGrid, MessageCircle, Play, Music, Github, Globe, ExternalLink } from 'lucide-react';

interface AppShortcut {
    id: string;
    name: string;
    url: string;
    icon: React.ReactNode;
    color: string;
    description: string;
}

const APPS: AppShortcut[] = [
    {
        id: 'whatsapp',
        name: 'WhatsApp',
        url: 'https://web.whatsapp.com',
        icon: <MessageCircle size={32} />,
        color: '#25D366',
        description: 'Secure messaging and video calls.'
    },
    {
        id: 'netflix',
        name: 'Netflix',
        url: 'https://www.netflix.com',
        icon: <Play size={32} />,
        color: '#E50914',
        description: 'Stream your favorite movies and shows.'
    },
    {
        id: 'spotify',
        name: 'Spotify',
        url: 'https://open.spotify.com',
        icon: <Music size={32} />,
        color: '#1DB954',
        description: 'Music for every moment.'
    },
    {
        id: 'github',
        name: 'GitHub',
        url: 'https://github.com',
        icon: <Github size={32} />,
        color: '#ffffff',
        description: 'Where the world builds software.'
    },
    {
        id: 'chatgpt',
        name: 'ChatGPT',
        url: 'https://chat.openai.com',
        icon: <Globe size={32} />,
        color: '#74aa9c',
        description: 'Advanced AI assistance.'
    }
];

const Apps: React.FC<{ onLaunchApp: (url: string, name: string) => void }> = ({ onLaunchApp }) => {
    const launchApp = (url: string, name: string) => {
        onLaunchApp(url, name);
    };

    return (
        <div className="apps-container animate-fade-in">
            <div className="apps-header">
                <div className="apps-title-section">
                    <LayoutGrid className="apps-header-icon" />
                    <div>
                        <h1>Zen Workspace</h1>
                        <p>Launch your favorite utilities in standalone mode.</p>
                    </div>
                </div>
            </div>

            <div className="apps-grid">
                {APPS.map(app => (
                    <div
                        key={app.id}
                        className="app-card"
                        onClick={() => launchApp(app.url, app.name)}
                    >
                        <div className="app-card-glass"></div>
                        <div className="app-icon-wrapper" style={{ boxShadow: `0 0 20px ${app.color}22` }}>
                            <div className="app-icon" style={{ color: app.color }}>
                                {app.icon}
                            </div>
                        </div>
                        <div className="app-info">
                            <h3>{app.name}</h3>
                            <p>{app.description}</p>
                        </div>
                        <div className="app-launch-btn">
                            <ExternalLink size={16} />
                            Launch
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Apps;
