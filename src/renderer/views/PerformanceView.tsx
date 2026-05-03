import React, { useEffect, useState } from 'react';
import './PerformanceView.css';
import { Gauge, Cpu, Database, Wifi, ShieldCheck, Clock, Layers, BrainCircuit } from 'lucide-react';

const fallback = {
    startupMs: 0,
    uptimeSeconds: 0,
    cpu: 0,
    memory: { processMb: 0, usedGb: '0', totalGb: '0' },
    storage: { usedBytes: 0, usedText: '0 MB' },
    tabs: { active: 0, background: 0, totalBrowserViews: 0 },
    network: { requestCount: 0, approxReceivedBytes: 0, approxReceivedText: '0 B' },
    profile: { encryptionAvailable: false, downloadsStored: 0, crashedTabsStored: 0 },
    modes: { lowDataMode: false, aiLoaded: false }
};

const MetricCard = ({ icon: Icon, label, value, sub }: any) => (
    <div className="perf-card">
        <div className="perf-icon"><Icon size={20} /></div>
        <div><p>{label}</p><strong>{value}</strong>{sub && <span>{sub}</span>}</div>
    </div>
);

const PerformanceView: React.FC = () => {
    const [snapshot, setSnapshot] = useState<any>(fallback);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            const data = await window.electronAPI?.getPerformanceSnapshot?.();
            if (mounted && data) setSnapshot(data);
        };
        load();
        const timer = window.setInterval(load, 3000);
        return () => { mounted = false; window.clearInterval(timer); };
    }, []);

    const startupStatus = snapshot.startupMs <= 2500 ? 'Within budget' : 'Above target';
    const memoryStatus = snapshot.memory.processMb <= 350 ? 'Light profile' : 'Watch memory';

    return (
        <div className="performance-view">
            <section className="perf-hero">
                <p className="eyebrow">Hoo performance lab</p>
                <h1>Keep Hoo quiet, light, and measurable.</h1>
                <p>These numbers are not marketing. They are the browser budget we use to stop Hoo from becoming heavy.</p>
            </section>

            <div className="perf-grid">
                <MetricCard icon={Clock} label="Startup" value={`${snapshot.startupMs} ms`} sub={startupStatus} />
                <MetricCard icon={Cpu} label="CPU estimate" value={`${snapshot.cpu}%`} sub="System load approximation" />
                <MetricCard icon={Gauge} label="Hoo memory" value={`${snapshot.memory.processMb} MB`} sub={memoryStatus} />
                <MetricCard icon={Database} label="Profile storage" value={snapshot.storage.usedText} sub="Local profile size" />
                <MetricCard icon={Layers} label="Tabs" value={`${snapshot.tabs.totalBrowserViews}`} sub={`${snapshot.tabs.active} active · ${snapshot.tabs.background} background`} />
                <MetricCard icon={Wifi} label="Network observed" value={snapshot.network.approxReceivedText} sub={`${snapshot.network.requestCount} requests this run`} />
                <MetricCard icon={ShieldCheck} label="Profile encryption" value={snapshot.profile.encryptionAvailable ? 'Available' : 'Unavailable'} sub="Electron safeStorage" />
                <MetricCard icon={BrainCircuit} label="AI loaded" value={snapshot.modes.aiLoaded ? 'Yes' : 'No'} sub={snapshot.modes.aiLoaded ? 'OpenClaw started' : 'Off by default'} />
            </div>

            <section className="perf-budget">
                <h2>Current lightweight rules</h2>
                <div className="budget-list">
                    <div><strong>Low Data Mode</strong><span>{snapshot.modes.lowDataMode ? 'Enabled' : 'Disabled'}</span></div>
                    <div><strong>Downloads stored</strong><span>{snapshot.profile.downloadsStored}</span></div>
                    <div><strong>Crashed tabs stored</strong><span>{snapshot.profile.crashedTabsStored}</span></div>
                    <div><strong>Idle promise</strong><span>No AI/sync startup work by default</span></div>
                </div>
            </section>
        </div>
    );
};

export default PerformanceView;
