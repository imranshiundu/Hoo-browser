import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { Shield, Globe } from 'lucide-react';

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
    const [hooMemoryMb, setHooMemoryMb] = useState(0);
    const [cpuUsage, setCpuUsage] = useState(0);
    const [storageUsage, setStorageUsage] = useState({ usedText: '0 MB', usedBytes: 0 });
    const [trackersBlocked] = useState(1240);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        const fetchMetrics = async () => {
            if (window.electronAPI?.getSystemMetrics) {
                const metrics = await window.electronAPI.getSystemMetrics();
                setCpuUsage(metrics.cpu);
                setRamUsage({ used: metrics.memory.usedGb, total: metrics.memory.totalGb });
                setHooMemoryMb(metrics.memory.processMb);
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
        { icon: 'duckduckgo', name: 'DuckDuckGo', url: 'duckduckgo.com', color: '#FF6A00' },
        { icon: 'proton', name: 'Proton', url: 'proton.me', color: '#6d4aff' },
        { icon: 'whatsapp', name: 'WhatsApp', url: 'web.whatsapp.com', color: '#25d366' },
    ];

    const formatDate = () => currentTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const memoryPercent = ramUsage.total === '0' ? 0 : Math.min(100, (parseFloat(ramUsage.used) / parseFloat(ramUsage.total)) * 100);

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="header-left">
                    <p className="dashboard-subtitle">HOO BROWSER / LIGHTWEIGHT HUD</p>
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
                <input type="text" placeholder="Search privately with DuckDuckGo..." className="dashboard-search-input" />
            </div>

            <div className="widgets-grid">
                <div className="widget">
                    <h3 className="widget-title">Engine Metrics</h3>
                    <div className="widget-content">
                        <div className="status-item">
                            <div className="status-label">System Memory</div>
                            <div className="status-value">
                                {ramUsage.used === '0' ? '---' : ramUsage.used} <span className="status-unit">GB / {ramUsage.total}GB</span>
                            </div>
                            <div className="status-bar"><div className="status-bar-fill optimal" style={{ width: `${memoryPercent}%` }} /></div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Hoo Process Memory</div>
                            <div className="status-value">
                                {hooMemoryMb ? hooMemoryMb : '---'} <span className="status-unit">MB</span>
                            </div>
                            <div className="status-bar"><div className="status-bar-fill optimal" style={{ width: `${Math.min(100, (hooMemoryMb / 500) * 100)}%` }} /></div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Profile Storage</div>
                            <div className="status-value">
                                {storageUsage.usedText} <span className="status-unit">local</span>
                            </div>
                            <div className="status-bar">
                                <div className="status-bar-fill" style={{ width: `${Math.min(100, (storageUsage.usedBytes / (8 * 1024 ** 3)) * 100)}%`, background: 'rgba(255,255,255,0.1)' }} />
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">CPU Estimate</div>
                            <div className="status-value large">{cpuUsage}%</div>
                        </div>
                    </div>
                </div>

                <div className="widget">
                    <h3 className="widget-title">Secure Notes</h3>
                    <div className="widget-content">
                        <textarea className="scratchpad-textarea" placeholder="Type local notes..." value={scratchpadText} onChange={(e) => setScratchpadText(e.target.value)} />
                    </div>
                </div>

                <div className="widget">
                    <h3 className="widget-title">Quick Access</h3>
                    <div className="widget-content">
                        <div className="most-visited-grid">
                            {mostVisitedSites.map((site, index) => (
                                <button key={index} className="most-visited-card" onClick={() => window.electronAPI?.navigateTo?.(`https://${site.url}`)}>
                                    <Globe size={20} style={{ opacity: 0.5 }} />
                                    <div className="site-name">{site.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="widget">
                    <h3 className="widget-title">Shield Status</h3>
                    <div className="widget-content">
                        <div className="status-item">
                            <Shield size={28} />
                            <div className="status-label">Blocked Estimate</div>
                            <div className="status-value large">{trackersBlocked.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Dashboard;
