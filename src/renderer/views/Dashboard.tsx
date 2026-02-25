import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { Activity, Shield, Clock, Plus, Edit3, Terminal, Cpu, Globe } from 'lucide-react';

interface MostVisitedSite {
    icon: string;
    name: string;
    url: string;
    color: string;
}

const Dashboard: React.FC = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [scratchpadText, setScratchpadText] = useState('');
    const [ramUsage, setRamUsage] = useState({ used: '0', total: '0' });
    const [cpuUsage, setCpuUsage] = useState(0);
    const [storageUsage, setStorageUsage] = useState({ usedText: '0 MB', usedBytes: 0 });
    const [trackersBlocked, setTrackersBlocked] = useState(1240);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        // Poll for system metrics
        const fetchMetrics = async () => {
            if (window.electronAPI?.getSystemMetrics) {
                const metrics = await window.electronAPI.getSystemMetrics();
                setCpuUsage(metrics.cpu);
                setRamUsage(metrics.ram);
                setStorageUsage(metrics.storage);
            }
        };
        fetchMetrics();
        const metricsTimer = setInterval(fetchMetrics, 3000);

        const saved = localStorage.getItem('scratchpad');
        if (saved) setScratchpadText(saved);

        return () => {
            clearInterval(timer);
            clearInterval(metricsTimer);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('scratchpad', scratchpadText);
    }, [scratchpadText]);

    const mostVisitedSites: MostVisitedSite[] = [
        { icon: 'github', name: 'GitHub', url: 'github.com', color: '#333' },
        { icon: 'reddit', name: 'Reddit', url: 'reddit.com', color: '#FF4500' },
        { icon: 'proton', name: 'Proton', url: 'proton.me', color: '#6d4aff' },
        { icon: 'discord', name: 'Discord', url: 'discord.com', color: '#5865F2' },
    ];

    const formatDate = () => {
        return currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="header-left">
                    <p className="dashboard-subtitle">ZEN BROWSER / SECURITY HUD</p>
                    <h1 className="dashboard-title">System Overview</h1>
                </div>
                <div className="header-right">
                    <div className="datetime-info">
                        <div className="time-display">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                        <div className="date-display">{formatDate()}</div>
                    </div>
                </div>
            </div>

            <div className="dashboard-search">
                <input
                    type="text"
                    placeholder="Search or execute secure command..."
                    className="dashboard-search-input"
                />
            </div>

            <div className="widgets-grid">
                <div className="widget">
                    <h3 className="widget-title">Engine Metrics</h3>
                    <div className="widget-content">
                        <div className="status-item">
                            <div className="status-label">Memory</div>
                            <div className="status-value">
                                {ramUsage.used === '0' ? '---' : ramUsage.used} <span className="status-unit">GB / {ramUsage.total}GB</span>
                            </div>
                            <div className="status-bar">
                                <div
                                    className="status-bar-fill optimal"
                                    style={{ width: `${ramUsage.total === '0' ? 0 : (parseFloat(ramUsage.used) / parseFloat(ramUsage.total)) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Sandbox Integrity</div>
                            <div className="status-value">
                                {storageUsage.usedText} <span className="status-unit">/ 8.00 GB</span>
                            </div>
                            <div className="status-bar">
                                <div
                                    className="status-bar-fill"
                                    style={{
                                        width: `${(storageUsage.usedBytes / (8 * 1024 ** 3)) * 100}%`,
                                        background: 'rgba(255,255,255,0.1)'
                                    }}
                                ></div>
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Mitigated Threats</div>
                            <div className="status-value large">{trackersBlocked.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                <div className="widget">
                    <h3 className="widget-title">Secure Vault</h3>
                    <div className="widget-content">
                        <textarea
                            className="scratchpad-textarea"
                            placeholder="Type to save encrypted notes..."
                            value={scratchpadText}
                            onChange={(e) => setScratchpadText(e.target.value)}
                        />
                    </div>
                </div>

                <div className="widget">
                    <h3 className="widget-title">Quick Access</h3>
                    <div className="widget-content">
                        <div className="most-visited-grid">
                            {mostVisitedSites.map((site, index) => (
                                <button
                                    key={index}
                                    className="most-visited-card"
                                    onClick={() => {
                                        if (window.electronAPI?.navigateTo) {
                                            window.electronAPI.navigateTo(`https://${site.url}`);
                                        }
                                    }}
                                >
                                    <Globe size={20} style={{ opacity: 0.5 }} />
                                    <div className="site-name">{site.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Dashboard;
